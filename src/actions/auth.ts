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
    }>(
      `SELECT id, full_name, email, role::text, password_hash
       FROM users
       WHERE lower(email) = lower($1) AND is_active = true
       LIMIT 1`,
      [parsed.data.email],
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
      return { error: "The email or password is incorrect." };
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
