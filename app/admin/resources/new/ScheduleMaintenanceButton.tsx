"use client";

import { useRef } from "react";
import { scheduleResourceMaintenance } from "@/src/actions/admin-resources";

export default function ScheduleMaintenanceButton({
  resourceId,
  resourceName,
}: {
  resourceId: number;
  resourceName: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button className="resource-maintenance-button" type="button" onClick={() => dialogRef.current?.showModal()}>
        Maintenance
      </button>
      <dialog className="confirmation-dialog maintenance-dialog" ref={dialogRef}>
        <div className="confirmation-dialog-content">
          <p className="eyebrow">Resource maintenance</p>
          <h2>Schedule maintenance</h2>
          <p><strong>{resourceName}</strong></p>
          <form className="maintenance-form" action={scheduleResourceMaintenance}>
            <input type="hidden" name="resourceId" value={resourceId} />
            <label><span>Starts</span><input name="startAt" type="datetime-local" min={new Date().toISOString().slice(0, 16)} required /></label>
            <label><span>Ends</span><input name="endAt" type="datetime-local" required /></label>
            <label><span>Reason</span><input name="reason" maxLength={255} placeholder="e.g. Inspection and repairs" required /></label>
            <div className="confirmation-actions">
              <button className="action-button outline-button" type="button" onClick={() => dialogRef.current?.close()}>Cancel</button>
              <button className="primary-button" type="submit">Schedule maintenance</button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
