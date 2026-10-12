"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withTransaction } from "@/src/lib/db";
import { requireAdmin } from "@/src/server/auth";

export async function decideReservation(formData: FormData) {
  const admin = await requireAdmin();
  const reservationId = Number(formData.get("reservationId"));
  const decision = formData.get("decision");
  if (!Number.isInteger(reservationId) || !["approve", "reject"].includes(String(decision))) {
    redirect("/admin?error=Invalid reservation decision");
  }

  try {
    await withTransaction(async (client) => {
      const current = await client.query<{
        resource_id: number;
        start_at: Date;
        end_at: Date;
        priority: string;
      }>(
        `SELECT resource_id, start_at, end_at, priority::text AS priority
         FROM reservations WHERE id = $1 AND status = 'pending' FOR UPDATE`,
        [reservationId],
      );
      const reservation = current.rows[0];
      if (!reservation) throw new Error("Reservation is no longer pending");

      if (decision === "approve") {
        await client.query(
          `UPDATE reservations
           SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
           WHERE resource_id = $1 AND status = 'confirmed'
             AND tstzrange(start_at, end_at, '[)') && tstzrange($2, $3, '[)')`,
          [reservation.resource_id, reservation.start_at, reservation.end_at],
        );
        await client.query(
          `UPDATE reservations SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [reservationId],
        );
      } else {
        await client.query(
          `UPDATE reservations SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [reservationId],
        );
      }
      await client.query(
        `INSERT INTO reservation_audit_log (reservation_id, action, changed_by, note)
         VALUES ($1, 'updated', $2, $3)`,
        [reservationId, admin.id, decision === "approve" ? `Approved (${reservation.priority} priority); overlapping confirmed bookings rejected` : "Rejected by administrator"],
      );
    });
  } catch {
    redirect("/admin?error=The reservation decision could not be completed");
  }
  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin");
}
