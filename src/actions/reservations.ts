"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withTransaction } from "@/src/lib/db";
import { requireUser } from "@/src/server/auth";

const requestSchema = z.object({
  resourceId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(120),
  purpose: z.string().trim().min(1).max(2000),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
});

export async function requestReservation(formData: FormData) {
  const user = await requireUser();
  const parsed = requestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/reservations/new?error=Complete all reservation fields");

  const startAt = new Date(parsed.data.startAt);
  const endAt = new Date(parsed.data.endAt);
  if (Number.isNaN(startAt.valueOf()) || Number.isNaN(endAt.valueOf()) || endAt <= startAt) {
    redirect("/reservations/new?error=Enter a valid time range");
  }

  try {
    await withTransaction(async (client) => {
      const maintenance = await client.query(
        `SELECT id
         FROM blackouts
         WHERE resource_id = $1
           AND active = true
           AND tstzrange(start_at, end_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
         LIMIT 1`,
        [parsed.data.resourceId, startAt, endAt],
      );
      if (maintenance.rowCount) {
        throw new Error("RESOURCE_MAINTENANCE_CONFLICT");
      }

      const result = await client.query<{ id: number }>(
        `INSERT INTO reservations (resource_id, reserved_by, title, purpose, start_at, end_at, status, priority)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
         RETURNING id`,
        [parsed.data.resourceId, user.id, parsed.data.title, parsed.data.purpose, startAt, endAt, parsed.data.priority],
      );
      await client.query(
        `INSERT INTO reservation_audit_log (reservation_id, action, changed_by, note)
         VALUES ($1, 'created', $2, $3)`,
        [result.rows[0].id, user.id, `Requested with ${parsed.data.priority} priority`],
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message === "RESOURCE_MAINTENANCE_CONFLICT") {
      redirect("/reservations/new?error=This resource is scheduled for maintenance during that time");
    }
    redirect("/reservations/new?error=The request could not be submitted");
  }
  revalidatePath("/admin");
  revalidatePath("/my-bookings");
  redirect("/my-bookings");
}
