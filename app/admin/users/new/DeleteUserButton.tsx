"use client";

import { useRef } from "react";
import { deleteUser } from "@/src/actions/admin-users";

export default function DeleteUserButton({
  userId,
  userName,
}: {
  userId: number;
  userName: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <div className="admin-resource-actions">
        <form ref={formRef} action={deleteUser}>
          <input type="hidden" name="userId" value={userId} />
          <button
            className="resource-delete-button"
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            aria-label={`Delete ${userName}`}
          >
            Delete
          </button>
        </form>
      </div>
      <dialog className="confirmation-dialog" ref={dialogRef}>
        <div className="confirmation-dialog-content">
          <h2>Delete this user?</h2>
          <p className="resource-delete-message">
            <span>This will permanently remove</span>
            <strong>{userName}.</strong>
            <span>Users with reservation history cannot be deleted.</span>
          </p>
          <div className="confirmation-actions">
            <button className="action-button outline-button" type="button" onClick={() => dialogRef.current?.close()}>
              Keep user
            </button>
            <button className="resource-delete-confirm-button" type="button" onClick={() => formRef.current?.requestSubmit()}>
              Delete user
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
