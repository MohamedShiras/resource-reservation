import { redirect } from "next/navigation";
import SignInForm from "./SignInForm";
import { getCurrentUser } from "@/src/server/auth";

export default async function SignInPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/");

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand auth-brand"><div className="brand-mark">R</div><div><strong>Reserve</strong><span>Workspace</span></div></div>
        <div className="auth-heading"><p className="eyebrow">Workspace access</p><h1>Welcome back</h1><p>Sign in to manage resources and reservations.</p></div>
        <SignInForm />
      </section>
    </main>
  );
}
