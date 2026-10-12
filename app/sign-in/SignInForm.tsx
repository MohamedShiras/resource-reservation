"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/src/actions/auth";

const initialState: SignInState = {};

export default function SignInForm() {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <form className="auth-form" action={action}>
      <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />{state.fieldErrors?.email?.map((error) => <span className="field-error" key={error}>{error}</span>)}</label>
      <label>Password<input name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required />{state.fieldErrors?.password?.map((error) => <span className="field-error" key={error}>{error}</span>)}</label>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      <button className="primary-button auth-submit" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</button>
    </form>
  );
}
