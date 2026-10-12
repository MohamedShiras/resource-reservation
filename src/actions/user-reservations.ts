"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withTransaction } from "@/src/lib/db";
import { requireUser } from "@/src/server/auth";

export async function cancelReservation(formData: FormData) {
  const user = await requireUser();
  const reservationId = Number(formData.get("reservationId"));

  if (!Number.isInteger(reservationId) || reservationId < 1) {
    redirect("/my-bookings?error=Invalid reservation");
  }

  try {
    await withTransaction(async (client) => {
      const result = await client.query<{ id: number }>(
        `UPDATE reservations
         SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND reserved_by = $2
           AND status IN ('pending', 'confirmed')
           AND start_at > CURRENT_TIMESTAMP
         RETURNING id`,
        [reservationId, user.id],
      );

      if (result.rowCount !== 1) {
        throw new Error("Reservation cannot be cancelled");
      }

      await client.query(
        `INSERT INTO reservation_audit_log (reservation_id, action, changed_by, note)
         VALUES ($1, 'cancelled', $2, 'Cancelled by reservation owner')`,
        [reservationId, user.id],
      );
    });
  } catch {
    redirect("/my-bookings?error=This reservation cannot be cancelled");
  }

  revalidatePath("/my-bookings");
  revalidatePath("/calendar");
  revalidatePath("/");
  redirect("/my-bookings");
}
