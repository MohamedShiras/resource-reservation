import "server-only";

import { query } from "@/src/lib/db";

export type AdminReservation = {
  id: number;
  title: string;
  status: string;
  priority: string;
  startAt: string;
  endAt: string;
  resourceName: string;
  reservedBy: string;
  teamName: string | null;
};

export type AdminBookingOptions = {
  resources: { id: number; name: string }[];
  users: { id: number; fullName: string; email: string }[];
  teams: { id: number; name: string }[];
};

export type AdminResource = {
  id: number;
  name: string;
  kind: string;
  status: string;
};

export type AdminResourceFormOptions = {
  categories: { id: number; name: string }[];
  locations: { id: number; building: string; floorNo: number }[];
};

export type AdminUser = {
  id: number;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
};

export async function getAdminReservations() {
  const result = await query<AdminReservation>(
    `SELECT
      reservations.id,
      reservations.title,
      reservations.status::text AS status,
      reservations.priority::text AS priority,
      reservations.start_at AS "startAt",
      reservations.end_at AS "endAt",
      resources.name AS "resourceName",
      users.full_name AS "reservedBy",
      teams.name AS "teamName"
     FROM reservations
     JOIN resources ON resources.id = reservations.resource_id
     JOIN users ON users.id = reservations.reserved_by
     LEFT JOIN teams ON teams.id = reservations.team_id
     ORDER BY
       CASE WHEN reservations.status::text = 'confirmed' THEN 0 ELSE 1 END,
       reservations.start_at ASC`,
  );
  return result.rows;
}

export async function getAdminBookingOptions(): Promise<AdminBookingOptions> {
  const [resources, users, teams] = await Promise.all([
    query<{ id: number; name: string }>(
      `SELECT id, name FROM resources WHERE status::text = 'available' ORDER BY name`,
    ),
    query<{ id: number; fullName: string; email: string }>(
      `SELECT id, full_name AS "fullName", email FROM users WHERE is_active = true ORDER BY full_name`,
    ),
    query<{ id: number; name: string }>(
      `SELECT id, name FROM teams ORDER BY name`,
    ),
  ]);
  return { resources: resources.rows, users: users.rows, teams: teams.rows };
}

export async function getAdminResources(): Promise<AdminResource[]> {
  const result = await query<AdminResource>(
    `SELECT id, name, kind::text, status::text
     FROM resources
     ORDER BY name`,
  );
  return result.rows;
}

export async function getAdminResourceFormOptions(): Promise<AdminResourceFormOptions> {
  const [categories, locations] = await Promise.all([
    query<{ id: number; name: string }>(
      `SELECT id, name FROM resource_categories ORDER BY name`,
    ),
    query<{ id: number; building: string; floorNo: number }>(
      `SELECT id, building, floor_no AS "floorNo"
       FROM locations
       ORDER BY building, floor_no`,
    ),
  ]);
  return { categories: categories.rows, locations: locations.rows };
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const result = await query<AdminUser>(
    `SELECT
       id,
       full_name AS "fullName",
       email,
       role::text,
       is_active AS "isActive"
     FROM users
     ORDER BY full_name`,
  );
  return result.rows;
}
