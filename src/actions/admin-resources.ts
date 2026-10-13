"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withTransaction } from "@/src/lib/db";
import { requireAdmin } from "@/src/server/auth";

const createResourceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  kind: z.enum(["facility", "equipment", "amenities"]),
  categoryId: z.coerce.number().int().positive(),
  capacity: z.coerce.number().int().positive(),
  assetTag: z.string().trim().max(100),
});

const RESOURCE_HAS_HISTORY = "RESOURCE_HAS_HISTORY";

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
