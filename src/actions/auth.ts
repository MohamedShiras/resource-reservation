"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { query } from "@/src/lib/db";
import { createSession } from "@/src/server/auth";

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export type SignInState = {
  error?: string;
  fieldErrors?: { email?: string[]; password?: string[] };
  temporaryPassword?: boolean;
  temporaryEmail?: string;
};

type SignInFormData = FormData;

export async function signIn(_: SignInState, formData: SignInFormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let signedInRole: string | undefined;
  try {
    const result = await query<{
      id: number;
      full_name: string;
      email: string;
      role: string;
      password_hash: string;
      temporary_password: number;
    }>(
      `SELECT id, full_name, email, role::text, password_hash, temporary_password
       FROM users
       WHERE lower(email) = lower($1) AND is_active = true
       LIMIT 1`,
      [parsed.data.email],
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
      return { error: "The email or password is incorrect." };
    }

    if (user.temporary_password === 0) {
      return { temporaryPassword: true, temporaryEmail: user.email };
    }

    const sessionUser = {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
    };
    await createSession(sessionUser);
    signedInRole = sessionUser.role;
  } catch {
    return { error: "Unable to sign in right now. Please try again." };
  }

  redirect(signedInRole === "admin" ? "/admin" : "/");
}

const changePasswordSchema = z.object({
  email: z.string().trim().email(),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100),
});

export async function changeTemporaryPassword(_: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a new password with at least 8 characters." };
  if (parsed.data.newPassword !== parsed.data.confirmPassword) return { error: "The new passwords do not match." };

  let destination: string | undefined;
  try {
    const result = await query<{
      id: number;
      full_name: string;
      email: string;
      role: string;
      password_hash: string;
      temporary_password: number;
    }>(
      `SELECT id, full_name, email, role::text, password_hash, temporary_password
       FROM users
       WHERE lower(email) = lower($1) AND is_active = true
       LIMIT 1`,
      [parsed.data.email],
    );
    const user = result.rows[0];
    if (!user || user.temporary_password !== 0 || !(await bcrypt.compare(parsed.data.currentPassword, user.password_hash))) {
      return { error: "The temporary password is incorrect or has already been changed." };
    }
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await query(
      `UPDATE users SET password_hash = $1, temporary_password = 1 WHERE id = $2`,
      [passwordHash, user.id],
    );
    await createSession({ id: user.id, fullName: user.full_name, email: user.email, role: user.role });
    destination = user.role === "admin" ? "/admin" : "/";
  } catch {
    return { error: "Unable to change the password right now. Please try again." };
  }
  redirect(destination ?? "/sign-in");
}
