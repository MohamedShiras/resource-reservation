import Link from "next/link";
import { connection } from "next/server";
import { requireAdmin } from "@/src/server/auth";
import { getAdminReservationHistory, getAdminReservations } from "@/src/server/repositories/admin";
import { getDashboardData } from "@/src/server/repositories/dashboard";
import { getEnv } from "@/src/lib/env";
import { signOut } from "@/src/actions/session";
import { decideReservation } from "@/src/actions/admin-workflow";
import AdminCancelReservationButton from "./AdminCancelReservationButton";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  const admin = await requireAdmin();
  const { error } = await searchParams;
  const [reservations, history, dashboard] = await Promise.all([
    getAdminReservations(),
    getAdminReservationHistory(),
    getDashboardData(getEnv().APP_TIMEZONE),
  ]);
  const sections = [
    { source: "reservations", status: "confirmed", title: "Confirmed reservations", empty: "No confirmed reservations." },
    { source: "reservations", status: "pending", title: "Pending requests", empty: "No pending requests." },
    { source: "reservations", status: "cancelled", title: "Cancelled reservations", empty: "No cancelled reservations." },
    { source: "reservations", status: "rejected", title: "Rejected reservations", empty: "No rejected reservations." },
    { source: "history", title: "Reservation history", empty: "No past reservations yet." },
  ] as const;
  const toDateTimeLocal = (value: string) => new Date(value).toISOString().slice(0, 16);
  const formatReservationRange = (startAt: string, endAt: string) => {
    const formatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
    const start = new Date(startAt);
    const end = new Date(endAt);
    return `${formatter.format(start)} – ${formatter.format(end)}`;
  };

  const renderReservation = (reservation: (typeof reservations)[number], showActions = true) => (
    <article className="admin-reservation-row" key={reservation.id}>
      <div className="admin-reservation-copy"><strong>{reservation.title}</strong><p>{reservation.resourceName} · for {reservation.reservedBy}{reservation.teamName ? ` · ${reservation.teamName}` : ""} · {reservation.priority} priority</p>{reservation.purpose && <p className="admin-reservation-purpose"><span>Purpose:</span> {reservation.purpose}</p>}</div>
      <time>{formatReservationRange(reservation.startAt, reservation.endAt)}</time>
      <span className={`status status-${reservation.status}`}>{reservation.status}</span>
      {showActions && reservation.status === "confirmed" && <AdminCancelReservationButton reservationId={reservation.id} />}
      {showActions && reservation.status === "pending" && <div className="admin-pending-controls"><form action={decideReservation} className="decision-actions"><input type="hidden" name="reservationId" value={reservation.id} />{reservation.hasConflict ? <button name="decision" value="revoke-and-approve" className="decision-revoke">Revoke conflict &amp; approve</button> : <button name="decision" value="approve" className="decision-approve">Approve</button>}<button name="decision" value="reject" className="decision-reject">Reject</button>{reservation.hasConflict && <button name="decision" value="adjust-and-approve" className="decision-adjust" form={`adjust-form-${reservation.id}`}>Adjust time &amp; approve</button>}</form>{reservation.hasConflict && <form action={decideReservation} className="admin-adjust-form" id={`adjust-form-${reservation.id}`}><input type="hidden" name="reservationId" value={reservation.id} /><input type="datetime-local" name="startAt" defaultValue={toDateTimeLocal(reservation.startAt)} aria-label="Adjusted start time" required /><span>to</span><input type="datetime-local" name="endAt" defaultValue={toDateTimeLocal(reservation.endAt)} aria-label="Adjusted end time" required /></form>}</div>}
    </article>
  );

  return (
    <main className="simple-page">
      <div className="simple-page-header"><div><p className="eyebrow">Administrator workspace</p><h1>Operations overview</h1><p className="heading-subtitle">Review reservations and create bookings for members or teams.</p></div><div className="admin-header-actions"><Link className="outline-button" href="/admin/users/new">Manage users</Link><Link className="outline-button" href="/admin/resources/new">Add & Manage resource</Link><Link className="primary-button" href="/admin/reservations/new"><span>+</span> Book for someone</Link></div></div>
      <section className="admin-banner"><div><strong>Signed in as {admin.fullName}</strong><span>Admin controls are enabled for this account.</span></div><form action={signOut}><button className="outline-button" type="submit">Sign out</button></form></section>
      {error && <p className="form-error admin-decision-error">{error}</p>}
      <div className="stat-grid admin-stat-grid">
        <article className="stat-card"><div className="stat-card-top"><span>Today&apos;s bookings</span><span className="stat-icon blue">▣</span></div><strong>{dashboard.bookingCount}</strong><p>Confirmed reservations today</p></article>
        <article className="stat-card"><div className="stat-card-top"><span>Available now</span><span className="stat-icon green">◈</span></div><strong>{dashboard.availableResourceCount} <small>/ {dashboard.resourceCount}</small></strong><p>Resources available</p></article>
      </div>
      <section className="admin-sections">
        {sections.map((section) => {
          const sectionReservations = section.source === "history"
            ? history
            : reservations.filter((reservation) => reservation.status === section.status);
          return <section className={`simple-panel admin-status-section${section.source === "history" ? " admin-history-section" : ""}`} key={section.title}><div className="panel-header"><div><h2>{section.title}</h2></div></div>{sectionReservations.length === 0 ? <div className="admin-empty-state">{section.empty}</div> : sectionReservations.map((reservation) => renderReservation(reservation, section.source !== "history"))}</section>;
        })}
      </section>
    </main>
  );
}
