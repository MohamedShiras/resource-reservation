"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withTransaction } from "@/src/lib/db";
import { requireAdmin } from "@/src/server/auth";

const createResourceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  kind: z.enum(["facility", "equipment"]),
  categoryId: z.coerce.number().int().positive(),
  locationId: z.coerce.number().int().positive(),
  capacity: z.coerce.number().int().positive(),
  assetTag: z.string().trim().max(100),
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
        `INSERT INTO resources (category_id, location_id, kind, name, status)
         VALUES ($1, $2, $3, $4, 'available')
         RETURNING id`,
        [parsed.data.categoryId, parsed.data.locationId, parsed.data.kind, parsed.data.name],
      );
      const resourceId = resource.rows[0].id;

      if (parsed.data.kind === "facility") {
        await client.query(
          `INSERT INTO facilities (resource_id, kind, capacity)
           VALUES ($1, 'facility', $2)`,
          [resourceId, parsed.data.capacity],
        );
      } else {
        await client.query(
          `INSERT INTO equipment (resource_id, kind, asset_tag)
           VALUES ($1, 'equipment', $2)`,
          [resourceId, parsed.data.assetTag],
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
