"use client";

import { useRef } from "react";
import { cancelReservation } from "@/src/actions/user-reservations";

export default function CancelReservationButton({ reservationId }: { reservationId: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <>
      <form ref={formRef} action={cancelReservation}>
        <input type="hidden" name="reservationId" value={reservationId} />
        <button className="admin-cancel-reservation-button" type="button" onClick={() => dialogRef.current?.showModal()}>
          Cancel
        </button>
      </form>
      <dialog className="confirmation-dialog" ref={dialogRef}>
        <div className="confirmation-dialog-content">
          <h2>Cancel this reservation?</h2>
          <p>This action will cancel the reservation and release the resource time.</p>
          <div className="confirmation-actions">
            <button className="action-button outline-button" type="button" onClick={() => dialogRef.current?.close()}>
              No, keep it
            </button>
            <button className="cancel-button" type="button" onClick={() => formRef.current?.requestSubmit()}>
              Cancel reservation
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
