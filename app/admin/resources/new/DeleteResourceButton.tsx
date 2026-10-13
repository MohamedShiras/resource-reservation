"use client";

import { useRef } from "react";
import { deleteResource } from "@/src/actions/admin-resources";

export default function DeleteResourceButton({
  resourceId,
  resourceName,
}: {
  resourceId: number;
  resourceName: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <form ref={formRef} action={deleteResource}>
        <input type="hidden" name="resourceId" value={resourceId} />
        <button
          className="resource-delete-button"
          type="button"
          onClick={() => dialogRef.current?.showModal()}
        >
          Delete
        </button>
      </form>
      <dialog className="confirmation-dialog" ref={dialogRef}>
        <div className="confirmation-dialog-content">
          <h2>Delete this resource?</h2>
          <p className="resource-delete-message">
            <span>This will permanently remove</span>
            <strong>{resourceName}.</strong>
            <span>Resources with reservation history cannot be deleted.</span>
          </p>
          <div className="confirmation-actions">
            <button className="action-button outline-button" type="button" onClick={() => dialogRef.current?.close()}>
              No, keep it
            </button>
            <button className="resource-delete-confirm-button" type="button" onClick={() => formRef.current?.requestSubmit()}>
              Delete resource
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
