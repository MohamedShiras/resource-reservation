"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withTransaction } from "@/src/lib/db";
import { requireAdmin } from "@/src/server/auth";

const schema = z.object({
  resourceId: z.coerce.number().int().positive(),
  reservedBy: z.coerce.number().int().positive(),
  teamId: z.union([z.coerce.number().int().positive(), z.literal("")]),
  title: z.string().trim().min(1).max(120),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
});

export async function createAdminReservation(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect("/admin/reservations/new?error=Enter all reservation details");
  }

  const startAt = new Date(parsed.data.startAt);
  const endAt = new Date(parsed.data.endAt);
  if (Number.isNaN(startAt.valueOf()) || Number.isNaN(endAt.valueOf()) || endAt <= startAt) {
    redirect("/admin/reservations/new?error=Enter a valid time range");
  }

  try {
    await withTransaction(async (client) => {
      const reservation = await client.query<{ id: number }>(
        `INSERT INTO reservations
          (resource_id, reserved_by, team_id, title, start_at, end_at, status)
         VALUES ($1, $2, NULLIF($3, '')::bigint, $4, $5, $6, 'confirmed')
         RETURNING id`,
        [parsed.data.resourceId, parsed.data.reservedBy, parsed.data.teamId, parsed.data.title, startAt, endAt],
      );
      await client.query(
        `INSERT INTO reservation_audit_log (reservation_id, action, changed_by, note)
         VALUES ($1, 'created', $2, $3)`,
        [reservation.rows[0].id, admin.id, "Created by administrator"],
      );
    });
  } catch {
    redirect("/admin/reservations/new?error=The reservation could not be created. Check availability and team membership.");
  }

  revalidatePath("/admin");
  redirect("/admin");
}
