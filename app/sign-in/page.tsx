import { redirect } from "next/navigation";
import Image from "next/image";
import SignInForm from "./SignInForm";
import { getCurrentUser } from "@/src/server/auth";
import posterImg from "../assets/signup-poster.jpg";

export default async function SignInPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/");

  return (
    <main className="auth-split-page">
      <div className="auth-split-card">
        {/* Left — poster */}
        <div className="auth-poster-panel">
          <Image
            src={posterImg}
            alt="Resource reservation workspace illustration"
            fill
            sizes="(max-width: 768px) 0px, 45vw"
            className="auth-poster-img"
            priority
          />
        </div>

        {/* Right — form */}
        <section className="auth-form-panel">
          <div className="brand auth-brand">
            <div className="brand-mark">R</div>
            <div><strong>Reserve</strong><span>Workspace</span></div>
          </div>
          <div className="auth-heading">
            <p className="eyebrow">Workspace access</p>
            <h1>Welcome back</h1>
            <p>Sign in to manage resources and reservations.</p>
          </div>
          <SignInForm />
        </section>
      </div>
    </main>
  );
}
