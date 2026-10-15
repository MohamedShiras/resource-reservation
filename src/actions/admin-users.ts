"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withTransaction } from "@/src/lib/db";
import { requireAdmin } from "@/src/server/auth";

const createUserSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(255),
    password: z.string().min(8).max(100),
    role: z.enum(["member", "admin"]),
    teamId: z.union([z.coerce.number().int().positive(), z.literal("")]),
    memberRole: z.string().trim().max(50),
  })
  .superRefine((data, ctx) => {
    if (data.teamId && !data.memberRole) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a team member role when assigning a team",
        path: ["memberRole"],
      });
    }
    if (!data.teamId && data.memberRole) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a team when choosing a team member role",
        path: ["teamId"],
      });
    }
  });

export async function createUser(formData: FormData) {
  await requireAdmin();
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    const teamIssue = parsed.error.issues.find((issue) => issue.path[0] === "teamId" || issue.path[0] === "memberRole");
    redirect(
      `/admin/users/new?error=${encodeURIComponent(
        teamIssue?.message ?? "Enter a name, valid email, password of at least 8 characters, and role",
      )}`,
    );
  }

  let createResult: "created" | "invalid-role";
  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    createResult = await withTransaction(async (client) => {
      if (parsed.data.teamId) {
        const role = await client.query<{ roleName: string }>(
          "SELECT role_name AS \"roleName\" FROM team_member_role WHERE role_name = $1",
          [parsed.data.memberRole],
        );
        if (!role.rows[0]) return "invalid-role" as const;
      }

      const user = await client.query<{ id: number }>(
        `INSERT INTO users (full_name, email, password_hash, role, is_active, temporary_password)
         VALUES ($1, $2, $3, $4, true, 0)
         RETURNING id`,
        [parsed.data.fullName, parsed.data.email, passwordHash, parsed.data.role],
      );
      if (parsed.data.teamId) {
        await client.query(
          `INSERT INTO team_members (team_id, user_id, member_role)
           VALUES ($1, $2, $3)`,
          [parsed.data.teamId, user.rows[0].id, parsed.data.memberRole],
        );
      }
      return "created" as const;
    });
  } catch {
    redirect("/admin/users/new?error=The user could not be added. The email may already be in use.");
  }
  if (createResult === "invalid-role") {
    redirect("/admin/users/new?error=Select a valid team member role");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users/new");
  revalidatePath("/admin/reservations/new");
  redirect("/admin");
}

export async function deleteUser(formData: FormData) {
  const admin = await requireAdmin();
  const userId = Number(formData.get("userId"));

  if (!Number.isInteger(userId) || userId <= 0) {
    redirect("/admin/users/new?deleteError=Select a valid user to delete.");
  }
  if (userId === admin.id) {
    redirect("/admin/users/new?deleteError=You cannot delete your own account.");
  }

  const result = await withTransaction(async (client) => {
    const target = await client.query<{ role: string; isActive: boolean }>(
      "SELECT role::text AS role, is_active AS \"isActive\" FROM users WHERE id = $1 FOR UPDATE",
      [userId],
    );
    if (!target.rows[0]) return "missing" as const;

    if (target.rows[0].role === "admin" && target.rows[0].isActive) {
      const admins = await client.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM users WHERE role::text = 'admin' AND is_active = true",
      );
      if (Number(admins.rows[0]?.count ?? 0) <= 1) return "last-admin" as const;
    }

    const reservations = await client.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM reservations WHERE reserved_by = $1) AS has_reservations",
      [userId],
    );
    if (reservations.rows[0]?.has_reservations) return "has-reservations" as const;

    await client.query("DELETE FROM team_members WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM users WHERE id = $1", [userId]);
    return "deleted" as const;
  });

  if (result !== "deleted") {
    const message = {
      missing: "That user no longer exists.",
      "last-admin": "The last active administrator cannot be deleted.",
      "has-reservations": "Users with reservation history cannot be deleted.",
    }[result];
    redirect(`/admin/users/new?deleteError=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/users/new");
  revalidatePath("/admin/reservations/new");
  revalidatePath("/admin");
}
