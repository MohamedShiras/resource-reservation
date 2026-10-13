import "server-only";

import { query } from "@/src/lib/db";

export type DashboardResource = {
  id: number;
  name: string;
  kind: string;
  status: string;
};

export type DashboardReservation = {
  id: number;
  title: string;
  startAt: string;
  endAt: string;
  resourceName: string;
  reservedBy: string;
  reservedById: number;
};

export type DashboardData = {
  resourceCount: number;
  availableResourceCount: number;
  bookingCount: number;
  upcomingBookingCount: number;
  resources: DashboardResource[];
  reservations: DashboardReservation[];
};

export async function getCalendarReservations(
  timeZone: string,
  month: string,
  userId: number,
): Promise<DashboardReservation[]> {
  const [year, monthNumber] = month.split("-").map(Number);
  const startDate = `${month}-01`;
  const endDate = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  const result = await query<DashboardReservation>(
    `SELECT
      reservations.id,
      reservations.title,
      reservations.start_at AS "startAt",
      reservations.end_at AS "endAt",
      resources.name AS "resourceName",
      users.full_name AS "reservedBy",
      reservations.reserved_by AS "reservedById"
     FROM reservations
     JOIN resources ON resources.id = reservations.resource_id
     JOIN users ON users.id = reservations.reserved_by
     WHERE reservations.status::text = 'confirmed'
       AND (reservations.start_at AT TIME ZONE $1)::date < $3::date
       AND (reservations.end_at AT TIME ZONE $1)::date >= $2::date
     ORDER BY
       CASE WHEN reservations.reserved_by = $4 THEN 0 ELSE 1 END,
       reservations.start_at`,
    [timeZone, startDate, endDate, userId],
  );
  return result.rows;
}

export async function getDashboardData(timeZone: string, reservationUserId?: number): Promise<DashboardData> {
  const [resourceSummary, bookingSummary, resources, reservations] = await Promise.all([
    query<{ resource_count: number; available_resource_count: number }>(
      `SELECT
        COUNT(*)::int AS resource_count,
        COUNT(*) FILTER (WHERE status::text = 'available')::int AS available_resource_count
       FROM resources`,
    ),
    query<{ booking_count: number; upcoming_booking_count: number }>(
      `SELECT
        COUNT(*) FILTER (
          WHERE status::text = 'confirmed'
          AND (start_at AT TIME ZONE $1)::date = (CURRENT_TIMESTAMP AT TIME ZONE $1)::date
        )::int AS booking_count,
        COUNT(*) FILTER (
          WHERE status::text = 'confirmed' AND start_at >= CURRENT_TIMESTAMP
        )::int AS upcoming_booking_count
       FROM reservations`,
      [timeZone],
    ),
    query<DashboardResource>(
      `SELECT id, name, kind::text, status::text
       FROM resources
       ORDER BY name`,
    ),
    query<DashboardReservation>(
      `SELECT
        reservations.id,
        reservations.title,
        reservations.start_at AS "startAt",
        reservations.end_at AS "endAt",
        resources.name AS "resourceName",
        users.full_name AS "reservedBy",
        reservations.reserved_by AS "reservedById"
       FROM reservations
       JOIN resources ON resources.id = reservations.resource_id
       JOIN users ON users.id = reservations.reserved_by
       WHERE reservations.status::text = 'confirmed'
         AND reservations.end_at >= CURRENT_TIMESTAMP
         ${reservationUserId === undefined ? "" : "AND reservations.reserved_by = $1"}
       ORDER BY reservations.start_at
       LIMIT 100`,
      reservationUserId === undefined ? undefined : [reservationUserId],
    ),
  ]);

  return {
    resourceCount: resourceSummary.rows[0]?.resource_count ?? 0,
    availableResourceCount: resourceSummary.rows[0]?.available_resource_count ?? 0,
    bookingCount: bookingSummary.rows[0]?.booking_count ?? 0,
    upcomingBookingCount: bookingSummary.rows[0]?.upcoming_booking_count ?? 0,
    resources: resources.rows,
    reservations: reservations.rows,
  };
}
