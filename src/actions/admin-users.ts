"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { query } from "@/src/lib/db";
import { requireAdmin } from "@/src/server/auth";

const createUserSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(100),
  role: z.enum(["member", "admin"]),
});

export async function createUser(formData: FormData) {
  await requireAdmin();
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    redirect("/admin/users/new?error=Enter a name, valid email, password of at least 8 characters, and role");
  }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    await query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, true)`,
      [parsed.data.fullName, parsed.data.email, passwordHash, parsed.data.role],
    );
  } catch {
    redirect("/admin/users/new?error=The user could not be added. The email may already be in use.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users/new");
  revalidatePath("/admin/reservations/new");
  redirect("/admin");
}
