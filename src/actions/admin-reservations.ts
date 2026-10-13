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
  purpose: z.string().trim().min(1).max(2000),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
});

const getReservationInput = (formData: FormData) => {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/reservations/new?error=Enter all reservation details");
  const startAt = new Date(parsed.data.startAt);
  const endAt = new Date(parsed.data.endAt);
  if (Number.isNaN(startAt.valueOf()) || Number.isNaN(endAt.valueOf()) || endAt <= startAt) {
    redirect("/admin/reservations/new?error=Enter a valid time range");
  }
  return { parsed: parsed.data, startAt, endAt };
};

export async function findAdminReservationConflicts(formData: FormData) {
  await requireAdmin();
  const { parsed, startAt, endAt } = getReservationInput(formData);
  const result = await withTransaction(async (client) => client.query<{
    id: number;
    title: string;
    reservedBy: string;
    startAt: string;
    endAt: string;
  }>(
    `SELECT reservations.id, reservations.title, users.full_name AS "reservedBy",
            reservations.start_at AS "startAt", reservations.end_at AS "endAt"
     FROM reservations
     JOIN users ON users.id = reservations.reserved_by
     WHERE reservations.resource_id = $1
       AND reservations.status = 'confirmed'
       AND tstzrange(reservations.start_at, reservations.end_at, '[)')
           && tstzrange($2, $3, '[)')`,
    [parsed.resourceId, startAt, endAt],
  ));
  return result.rows;
}

export async function createAdminReservation(formData: FormData) {
  const admin = await requireAdmin();
  const { parsed, startAt, endAt } = getReservationInput(formData);
  const decision = String(formData.get("conflictDecision") || "approve");
  if (!["approve", "revoke", "adjust"].includes(decision)) {
    redirect("/admin/reservations/new?error=Invalid reservation conflict decision");
  }

  try {
    await withTransaction(async (client) => {
      const conflicts = await client.query<{ id: number }>(
        `SELECT id FROM reservations
         WHERE resource_id = $1 AND status = 'confirmed'
           AND tstzrange(start_at, end_at, '[)') && tstzrange($2, $3, '[)')
         FOR UPDATE`,
        [parsed.resourceId, startAt, endAt],
      );
      if (conflicts.rowCount && decision === "approve") {
        throw new Error("A confirmed reservation overlaps this time");
      }
      if (decision === "revoke") {
        const ids = conflicts.rows.map((row) => row.id);
        if (!ids.length) throw new Error("No confirmed reservation was found to revoke");
        await client.query(
          `UPDATE reservations SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1::bigint[])`,
          [ids],
        );
        for (const id of ids) {
          await client.query(
            `INSERT INTO reservation_audit_log (reservation_id, action, changed_by, note)
             VALUES ($1, 'cancelled', $2, 'Revoked by administrator for a new confirmed reservation')`,
            [id, admin.id],
          );
        }
      }
      if (decision === "adjust" && conflicts.rowCount) {
        throw new Error("The adjusted time still overlaps a confirmed reservation");
      }
      const reservation = await client.query<{ id: number }>(
        `INSERT INTO reservations
          (resource_id, reserved_by, team_id, title, purpose, start_at, end_at, status, priority)
         VALUES ($1, $2, NULLIF($3, '')::bigint, $4, $5, $6, $7, 'confirmed', 'normal')
         RETURNING id`,
        [parsed.resourceId, parsed.reservedBy, parsed.teamId, parsed.title, parsed.purpose, startAt, endAt],
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

export async function cancelAdminReservation(formData: FormData) {
  const admin = await requireAdmin();
  const reservationId = Number(formData.get("reservationId"));
  if (!Number.isInteger(reservationId) || reservationId < 1) {
    redirect("/admin?error=Invalid reservation");
  }

  try {
    await withTransaction(async (client) => {
      const result = await client.query<{ id: number }>(
        `UPDATE reservations
         SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'confirmed' AND start_at > CURRENT_TIMESTAMP
         RETURNING id`,
        [reservationId],
      );
      if (result.rowCount !== 1) throw new Error("Reservation cannot be cancelled");
      await client.query(
        `INSERT INTO reservation_audit_log (reservation_id, action, changed_by, note)
         VALUES ($1, 'cancelled', $2, 'Cancelled by administrator')`,
        [reservationId, admin.id],
      );
    });
  } catch {
    redirect("/admin?error=This reservation cannot be cancelled");
  }

  revalidatePath("/admin");
  revalidatePath("/calendar");
  revalidatePath("/");
  redirect("/admin");
}
