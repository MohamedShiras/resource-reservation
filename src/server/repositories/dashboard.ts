import "server-only";

import { query } from "@/src/lib/db";

export type DashboardResource = {
  name: string;
  kind: string;
  status: string;
};

export type DashboardReservation = {
  title: string;
  startAt: string;
  endAt: string;
  resourceName: string;
};

export type DashboardData = {
  resourceCount: number;
  availableResourceCount: number;
  bookingCount: number;
  upcomingBookingCount: number;
  resources: DashboardResource[];
  reservations: DashboardReservation[];
};

export async function getDashboardData(timeZone: string): Promise<DashboardData> {
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
      `SELECT name, kind::text, status::text
       FROM resources
       ORDER BY name`,
    ),
    query<DashboardReservation>(
      `SELECT
        reservations.title,
        reservations.start_at AS "startAt",
        reservations.end_at AS "endAt",
        resources.name AS "resourceName"
       FROM reservations
       JOIN resources ON resources.id = reservations.resource_id
       WHERE reservations.status::text = 'confirmed'
       ORDER BY reservations.start_at
       LIMIT 10`,
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
