"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { query, withTransaction } from "@/src/lib/db";
import { requireAdmin } from "@/src/server/auth";

const createResourceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  kind: z.enum(["facility", "equipment", "amenities"]),
  categoryId: z.coerce.number().int().positive(),
  capacity: z.coerce.number().int().positive(),
  assetTag: z.string().trim().max(100),
});

const RESOURCE_HAS_HISTORY = "RESOURCE_HAS_HISTORY";
const maintenanceSchema = z.object({
  resourceId: z.coerce.number().int().positive(),
  startAt: z.string().datetime({ local: true }),
  endAt: z.string().datetime({ local: true }),
  reason: z.string().trim().min(1).max(255),
});

export async function createResource(formData: FormData) {
  await requireAdmin();
  const parsed = createResourceSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    redirect("/admin/resources/new?error=Enter a resource name and type");
  }

  if (parsed.data.kind === "equipment" && !parsed.data.assetTag) {
    redirect("/admin/resources/new?error=Enter an asset tag for equipment");
  }

  try {
    await withTransaction(async (client) => {
      const resource = await client.query<{ id: number }>(
        `INSERT INTO resources (category_id, kind, name, status)
         VALUES ($1, $2, $3, 'available')
         RETURNING id`,
        [parsed.data.categoryId, parsed.data.kind, parsed.data.name],
      );
      const resourceId = resource.rows[0].id;

      if (parsed.data.kind === "facility") {
        await client.query(
          `INSERT INTO facilities (resource_id, kind, capacity)
           VALUES ($1, 'facility', $2)`,
          [resourceId, parsed.data.capacity],
        );
      } else if (parsed.data.kind === "equipment") {
        await client.query(
          `INSERT INTO equipment (resource_id, kind, asset_tag)
           VALUES ($1, 'equipment', $2)`,
          [resourceId, parsed.data.assetTag],
        );
      } else {
        await client.query(
          `INSERT INTO amenity_resources (resource_id, kind, capacity)
           VALUES ($1, 'amenities', $2)`,
          [resourceId, parsed.data.capacity],
        );
      }
    });
  } catch {
    redirect("/admin/resources/new?error=The resource could not be added. Check the details and try again.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/reservations/new");
  revalidatePath("/resources");
  revalidatePath("/reservations/new");
  revalidatePath("/");
  redirect("/admin");
}

export async function deleteResource(formData: FormData) {
  await requireAdmin();
  const resourceId = Number(formData.get("resourceId"));

  if (!Number.isInteger(resourceId) || resourceId <= 0) {
    redirect("/admin/resources/new?error=The resource could not be deleted.");
  }

  try {
    await withTransaction(async (client) => {
      const reservations = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM reservations WHERE resource_id = $1`,
        [resourceId],
      );

      if (reservations.rows[0]?.count !== "0") {
        throw new Error(RESOURCE_HAS_HISTORY);
      }

      const result = await client.query(
        `DELETE FROM resources WHERE id = $1`,
        [resourceId],
      );

      if (result.rowCount !== 1) {
        throw new Error("RESOURCE_NOT_FOUND");
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === RESOURCE_HAS_HISTORY) {
      redirect("/admin/resources/new?error=This resource cannot be deleted because it has reservation history.");
    }
    redirect("/admin/resources/new?error=The resource could not be deleted.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/resources/new");
  revalidatePath("/admin/reservations/new");
  revalidatePath("/resources");
  revalidatePath("/reservations/new");
  revalidatePath("/");
  redirect("/admin/resources/new");
}

export async function scheduleResourceMaintenance(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = maintenanceSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    redirect("/admin/resources/new?error=Enter a valid maintenance period and reason.");
  }

  const startAt = new Date(parsed.data.startAt);
  const endAt = new Date(parsed.data.endAt);
  if (endAt <= startAt || startAt < new Date()) {
    redirect("/admin/resources/new?error=Maintenance must start in the future and end after it starts.");
  }

  try {
    await withTransaction(async (client) => {
      const resource = await client.query<{ id: number }>(
        `SELECT id FROM resources WHERE id = $1 FOR UPDATE`,
        [parsed.data.resourceId],
      );
      if (resource.rowCount !== 1) {
        throw new Error("RESOURCE_NOT_FOUND");
      }

      const conflict = await client.query<{ id: number }>(
        `SELECT id
         FROM reservations
         WHERE resource_id = $1
           AND status::text = 'confirmed'
           AND tstzrange(start_at, end_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
         LIMIT 1`,
        [parsed.data.resourceId, startAt.toISOString(), endAt.toISOString()],
      );
      if (conflict.rowCount) {
        throw new Error("MAINTENANCE_RESERVATION_CONFLICT");
      }

      await client.query(
        `INSERT INTO blackouts (resource_id, created_by, start_at, end_at, reason, active)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [parsed.data.resourceId, admin.id, startAt.toISOString(), endAt.toISOString(), parsed.data.reason],
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message === "MAINTENANCE_RESERVATION_CONFLICT") {
      redirect("/admin/resources/new?error=Maintenance overlaps a confirmed reservation.");
    }
    redirect("/admin/resources/new?error=The maintenance period could not be scheduled.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/resources/new");
  revalidatePath("/resources");
  revalidatePath("/reservations/new");
  revalidatePath("/admin/reservations/new");
  revalidatePath("/");
  redirect("/admin/resources/new");
}

export async function endResourceMaintenance(formData: FormData) {
  await requireAdmin();
  const blackoutId = Number(formData.get("blackoutId"));

  if (!Number.isInteger(blackoutId) || blackoutId <= 0) {
    redirect("/admin/resources/new?error=The maintenance period could not be ended.");
  }

  try {
    const result = await query(
      `UPDATE blackouts
       SET active = false
       WHERE id = $1 AND active = true`,
      [blackoutId],
    );
    if (result.rowCount !== 1) {
      throw new Error("MAINTENANCE_NOT_ACTIVE");
    }
  } catch {
    redirect("/admin/resources/new?error=The maintenance period could not be ended.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/resources/new");
  revalidatePath("/resources");
  revalidatePath("/reservations/new");
  revalidatePath("/");
  redirect("/admin/resources/new");
}
