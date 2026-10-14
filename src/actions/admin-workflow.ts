"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withTransaction } from "@/src/lib/db";
import { requireAdmin } from "@/src/server/auth";
import { sendReservationSms } from "@/src/lib/sms";

export async function decideReservation(formData: FormData) {
  const admin = await requireAdmin();
  const reservationId = Number(formData.get("reservationId"));
  const decision = formData.get("decision");
  const startAt = formData.get("startAt");
  const endAt = formData.get("endAt");
  const revokedReservations: { userId: number; title: string }[] = [];
  let notification: { userId: number; message: string } | null = null;
  if (!Number.isInteger(reservationId) || !["approve", "reject", "revoke-and-approve", "adjust-and-approve"].includes(String(decision))) {
    redirect("/admin?error=Invalid reservation decision");
  }

  try {
    await withTransaction(async (client) => {
      const current = await client.query<{
        resource_id: number;
        reserved_by: number;
        title: string;
        start_at: Date;
        end_at: Date;
        priority: string;
      }>(
        `SELECT id, resource_id, reserved_by, title, start_at, end_at, priority::text AS priority
         FROM reservations WHERE id = $1 AND status = 'pending' FOR UPDATE`,
        [reservationId],
      );
      const reservation = current.rows[0];
      if (!reservation) throw new Error("Reservation is no longer pending");

      let requestedStart = reservation.start_at;
      let requestedEnd = reservation.end_at;
      if (decision === "adjust-and-approve") {
        requestedStart = new Date(String(startAt));
        requestedEnd = new Date(String(endAt));
        if (!startAt || !endAt || Number.isNaN(requestedStart.valueOf()) || Number.isNaN(requestedEnd.valueOf()) || requestedEnd <= requestedStart) {
          throw new Error("The adjusted reservation time is invalid");
        }
        await client.query(
          `UPDATE reservations SET start_at = $2, end_at = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [reservationId, requestedStart, requestedEnd],
        );
      }

      const overlaps = await client.query<{ id: number; userId: number; title: string }>(
      `SELECT id, reserved_by AS "userId", title
         FROM reservations
         WHERE resource_id = $1 AND status = 'confirmed'
           AND tstzrange(start_at, end_at, '[)') && tstzrange($2, $3, '[)')
         FOR UPDATE`,
        [reservation.resource_id, requestedStart, requestedEnd],
      );

      if (decision === "approve" && overlaps.rowCount) {
        throw new Error("This request overlaps a confirmed reservation");
      }
      if (decision === "adjust-and-approve" && overlaps.rowCount) {
        throw new Error("The adjusted time still overlaps a confirmed reservation");
      }
      if (decision === "revoke-and-approve" && overlaps.rowCount) {
        await client.query(
          `UPDATE reservations
           SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
           WHERE id = ANY($1::bigint[])`,
          [overlaps.rows.map((overlap) => overlap.id)],
        );
        revokedReservations.push(...overlaps.rows);
        for (const overlap of overlaps.rows) {
          await client.query(
            `INSERT INTO reservation_audit_log (reservation_id, action, changed_by, note)
             VALUES ($1, 'cancelled', $2, $3)`,
            [overlap.id, admin.id, `Revoked by administrator to approve reservation ${reservationId}`],
          );
        }
      }
      if (decision === "revoke-and-approve" && !overlaps.rowCount) {
        throw new Error("No confirmed overlap was found to revoke");
      }

      if (decision === "approve" || decision === "revoke-and-approve" || decision === "adjust-and-approve") {
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
      notification = {
        userId: reservation.reserved_by,
        message: decision === "reject"
          ? `Your reservation "${reservation.title}" was rejected.`
          : `Your reservation "${reservation.title}" was approved.`,
      };
      await client.query(
        `INSERT INTO reservation_audit_log (reservation_id, action, changed_by, note)
         VALUES ($1, 'updated', $2, $3)`,
        [reservationId, admin.id, decision === "revoke-and-approve" ? `Approved (${reservation.priority} priority); overlapping confirmed bookings revoked by administrator` : decision === "adjust-and-approve" ? `Approved (${reservation.priority} priority) after administrator adjusted the reservation time` : decision === "approve" ? `Approved (${reservation.priority} priority)` : "Rejected by administrator"],
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The reservation decision could not be completed";
    redirect(`/admin?error=${encodeURIComponent(message)}`);
  }
  if (notification) {
    const note = notification as { userId: number; message: string };
    try {
      await sendReservationSms(note.userId, note.message);
      for (const revoked of revokedReservations) {
        await sendReservationSms(revoked.userId, `Your confirmed reservation "${revoked.title}" was cancelled because the resource was reassigned.`);
      }
    } catch (error) {
      console.error("Reservation decision saved, but an SMS notification failed.", error);
    }
  }
  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin");
}
