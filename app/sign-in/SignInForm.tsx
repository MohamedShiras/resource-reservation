"use client";

import { useActionState } from "react";
import { changeTemporaryPassword, signIn, type SignInState } from "@/src/actions/auth";

const initialState: SignInState = {};

export default function SignInForm() {
  const [state, action, pending] = useActionState(signIn, initialState);
  const [passwordState, passwordAction, passwordPending] = useActionState(changeTemporaryPassword, initialState);

  return (
    <>
    <form className="auth-form" action={action}>
      <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />{state.fieldErrors?.email?.map((error) => <span className="field-error" key={error}>{error}</span>)}</label>
      <label>Password<input name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required />{state.fieldErrors?.password?.map((error) => <span className="field-error" key={error}>{error}</span>)}</label>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      <button className="primary-button auth-submit" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</button>
    </form>
    {state.temporaryPassword && <><div className="password-dialog-backdrop" aria-hidden="true" /><dialog className="confirmation-dialog password-dialog" open>
      <div className="confirmation-dialog-content">
        <p className="eyebrow">First sign-in</p>
        <h2>Enter new password</h2>
        <p>Your administrator provided a temporary password. Create a new password to continue.</p>
        <form className="password-change-form" action={passwordAction}>
          <input type="hidden" name="email" value={state.temporaryEmail} />
          <label>Temporary password<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
          <label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
          <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
          {passwordState.error && <p className="auth-error" role="alert">{passwordState.error}</p>}
          <button className="primary-button auth-submit" disabled={passwordPending}>{passwordPending ? "Saving..." : "Save new password"}</button>
        </form>
      </div>
    </dialog></>}
    </>
  );
}
