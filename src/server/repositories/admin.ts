import "server-only";

import { query } from "@/src/lib/db";

export type AdminReservation = {
  id: number;
  title: string;
  purpose: string | null;
  hasConflict: boolean;
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
  activeMaintenanceId: number | null;
};

export type AdminMaintenanceHistory = {
  id: number;
  resourceName: string;
  startAt: string;
  endAt: string;
  reason: string;
};

export type AdminResourceFormOptions = {
  categories: { id: number; name: string }[];
};

export type AdminUser = {
  id: number;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  teamName: string | null;
  teamMemberRole: string | null;
};

export type AdminUserFormOptions = {
  teams: { id: number; name: string }[];
  teamMemberRoles: { id: number; name: string }[];
};

export async function getAdminReservations() {
  const result = await query<AdminReservation>(
    `SELECT
      reservations.id,
      reservations.title,
      reservations.purpose,
      EXISTS (
        SELECT 1
        FROM reservations AS confirmed
        WHERE confirmed.resource_id = reservations.resource_id
          AND confirmed.id <> reservations.id
          AND confirmed.status::text = 'confirmed'
          AND tstzrange(confirmed.start_at, confirmed.end_at, '[)')
              && tstzrange(reservations.start_at, reservations.end_at, '[)')
      ) AS "hasConflict",
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
     WHERE reservations.end_at >= CURRENT_TIMESTAMP
     ORDER BY
       CASE WHEN reservations.status::text = 'confirmed' THEN 0 ELSE 1 END,
       reservations.start_at ASC`,
  );
  return result.rows;
}

export async function getAdminReservationHistory(
  filters: { date?: string; resourceId?: number; timeZone?: string } = {},
) {
  const params: (string | number)[] = [];
  const where: string[] = ["reservations.end_at < CURRENT_TIMESTAMP"];

  if (filters.resourceId) {
    params.push(filters.resourceId);
    where.push(`reservations.resource_id = $${params.length}`);
  }

  if (filters.date && /^\d{4}-\d{2}-\d{2}$/.test(filters.date)) {
    const tz = filters.timeZone ?? "Asia/Colombo";
    params.push(filters.date, tz);
    where.push(
      `(reservations.start_at AT TIME ZONE $${params.length})::date <= $${params.length - 1}::date` +
      ` AND (reservations.end_at AT TIME ZONE $${params.length})::date >= $${params.length - 1}::date`,
    );
  }

  const result = await query<AdminReservation>(
    `SELECT
      reservations.id,
      reservations.title,
      reservations.purpose,
      false AS "hasConflict",
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
     WHERE ${where.join(" AND ")}
     ORDER BY reservations.end_at DESC`,
    params.length ? params : undefined,
  );
  return result.rows;
}

export async function getResourcesForFilter(): Promise<{ id: number; name: string }[]> {
  const result = await query<{ id: number; name: string }>(
    `SELECT id, name FROM resources ORDER BY name`,
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
    `SELECT resources.id, resources.name, resources.kind::text,
            active_blackout.id AS "activeMaintenanceId",
            CASE WHEN active_blackout.id IS NOT NULL
            THEN 'maintenance' ELSE resources.status::text END AS status
     FROM resources
     LEFT JOIN LATERAL (
       SELECT blackouts.id
       FROM blackouts
       WHERE blackouts.resource_id = resources.id
         AND blackouts.active = true
         AND blackouts.start_at <= CURRENT_TIMESTAMP
         AND blackouts.end_at > CURRENT_TIMESTAMP
       ORDER BY blackouts.start_at DESC
       LIMIT 1
     ) AS active_blackout ON true
     ORDER BY name`,
  );
  return result.rows;
}

export async function getAdminMaintenanceHistory(
  filters: { date?: string; resourceId?: number; timeZone?: string } = {},
): Promise<AdminMaintenanceHistory[]> {
  const params: (string | number)[] = [];
  const where: string[] = ["(blackouts.active = false OR blackouts.end_at <= CURRENT_TIMESTAMP)"];

  if (filters.resourceId) {
    params.push(filters.resourceId);
    where.push(`blackouts.resource_id = $${params.length}`);
  }

  if (filters.date && /^\d{4}-\d{2}-\d{2}$/.test(filters.date)) {
    const tz = filters.timeZone ?? "Asia/Colombo";
    params.push(filters.date, tz);
    where.push(
      `(blackouts.start_at AT TIME ZONE $${params.length})::date <= $${params.length - 1}::date` +
      ` AND (blackouts.end_at AT TIME ZONE $${params.length})::date >= $${params.length - 1}::date`,
    );
  }

  const result = await query<AdminMaintenanceHistory>(
    `SELECT
       blackouts.id,
       resources.name AS "resourceName",
       blackouts.start_at AS "startAt",
       blackouts.end_at AS "endAt",
       blackouts.reason
     FROM blackouts
     JOIN resources ON resources.id = blackouts.resource_id
     WHERE ${where.join(" AND ")}
     ORDER BY blackouts.end_at DESC`,
    params.length ? params : undefined,
  );
  return result.rows;
}

export async function getAdminResourceFormOptions(): Promise<AdminResourceFormOptions> {
  const categories = await query<{ id: number; name: string }>(
    `SELECT id, name FROM resource_categories ORDER BY name`,
  );
  return { categories: categories.rows };
}

export async function getAdminUserFormOptions(): Promise<AdminUserFormOptions> {
  const teams = await query<{ id: number; name: string }>(
    `SELECT id, name FROM teams
     ORDER BY name`,
  );
  const teamMemberRoles = await query<{ id: number; name: string }>(
    `SELECT role_id AS id, role_name AS name FROM team_member_role ORDER BY role_id`,
  );

  return {
    teams: teams.rows,
    teamMemberRoles: teamMemberRoles.rows,
  };
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const result = await query<AdminUser>(
    `SELECT
       id,
       full_name AS "fullName",
       email,
       role::text,
       is_active AS "isActive",
       user_teams."teamName",
       user_teams."teamMemberRole"
     FROM users
     LEFT JOIN LATERAL (
       SELECT
         STRING_AGG(DISTINCT teams.name, ', ' ORDER BY teams.name) AS "teamName",
         STRING_AGG(DISTINCT team_members.member_role, ', ' ORDER BY team_members.member_role) AS "teamMemberRole"
       FROM team_members
       JOIN teams ON teams.id = team_members.team_id
       WHERE team_members.user_id = users.id
     ) AS user_teams ON true
     ORDER BY full_name`,
  );
  return result.rows;
}
