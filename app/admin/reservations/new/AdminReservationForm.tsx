"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { createAdminReservation, findAdminReservationConflicts } from "@/src/actions/admin-reservations";

type Conflict = {
  id: number;
  title: string;
  reservedBy: string;
  startAt: string;
  endAt: string;
};

const formatRange = (startAt: string, endAt: string) => {
  const formatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
  return `${formatter.format(new Date(startAt))} – ${formatter.format(new Date(endAt))}`;
};

export default function AdminReservationForm({ children }: { children: ReactNode }) {
  const formRef = useRef<HTMLFormElement>(null);
  const draftRef = useRef<Record<string, FormDataEntryValue>>({});
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [open, setOpen] = useState(false);
  const [adjustStart, setAdjustStart] = useState("");
  const [adjustEnd, setAdjustEnd] = useState("");
  const [adjustError, setAdjustError] = useState("");

  const checkConflicts = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    draftRef.current = Object.fromEntries(formData.entries());
    const found = await findAdminReservationConflicts(formData);
    if (found.length) {
      setConflicts(found);
      setAdjustStart(String(formData.get("startAt") || ""));
      setAdjustEnd(String(formData.get("endAt") || ""));
      setAdjustError("");
      setOpen(true);
      return;
    }
    await createAdminReservation(formData);
  };

  const finish = async (decision: "revoke" | "adjust") => {
    if (!formRef.current) return;
    const formData = new FormData();
    for (const [name, value] of Object.entries(draftRef.current)) {
      formData.set(name, value);
    }
    formData.set("conflictDecision", decision);
    if (decision === "adjust") {
      formData.set("startAt", adjustStart);
      formData.set("endAt", adjustEnd);
      const adjustedConflicts = await findAdminReservationConflicts(formData);
      if (adjustedConflicts.length) {
        setConflicts(adjustedConflicts);
        setAdjustError("The adjusted time still overlaps a confirmed reservation. Choose a time outside the listed reservation.");
        return;
      }
      setOpen(false);
      await createAdminReservation(formData);
      return;
    }
    setOpen(false);
    await createAdminReservation(formData);
  };

  return (
    <>
      <form ref={formRef} className="simple-panel reservation-form" onSubmit={checkConflicts}>
        <input type="hidden" name="conflictDecision" value="approve" />
        {children}
      </form>
      <dialog className="confirmation-dialog admin-conflict-dialog" open={open}>
        <div className="confirmation-dialog-content">
          <p className="eyebrow">Confirmed reservation conflict</p>
          <h2>This resource is already reserved</h2>
          <p>The selected time overlaps the following confirmed reservation{conflicts.length > 1 ? "s" : ""}.</p>
          <div className="admin-conflict-list">
            {conflicts.map((conflict) => <div className="admin-conflict-item" key={conflict.id}><strong>{conflict.title}</strong><span>Reserved by {conflict.reservedBy}</span><small>{formatRange(conflict.startAt, conflict.endAt)}</small></div>)}
          </div>
          <div className="admin-adjust-fields">
            <label>Adjusted start<input type="datetime-local" value={adjustStart} onChange={(event) => setAdjustStart(event.target.value)} /></label>
            <label>Adjusted end<input type="datetime-local" value={adjustEnd} onChange={(event) => setAdjustEnd(event.target.value)} /></label>
          </div>
          {adjustError && <p className="auth-error admin-adjust-error" role="alert">{adjustError}</p>}
          <div className="confirmation-actions admin-conflict-actions">
            <button className="outline-button" type="button" onClick={() => setOpen(false)}>Discard reservation</button>
            <button className="decision-adjust" type="button" onClick={() => void finish("adjust")}>Adjust date/time &amp; approve</button>
            <button className="decision-revoke" type="button" onClick={() => void finish("revoke")}>Revoke &amp; reserve</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
