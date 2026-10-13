import Link from "next/link";
import { connection } from "next/server";
import { requireAdmin } from "@/src/server/auth";
import { getAdminReservations } from "@/src/server/repositories/admin";
import { signOut } from "@/src/actions/session";
import { decideReservation } from "@/src/actions/admin-workflow";

export default async function AdminPage() {
  await connection();
  const admin = await requireAdmin();
  const reservations = await getAdminReservations();
  const sections = [
    { status: "confirmed", title: "Confirmed reservations", description: "All confirmed reservations across your workspace.", empty: "No confirmed reservations." },
    { status: "pending", title: "Pending requests", description: "Requests waiting for an administrator decision.", empty: "No pending requests." },
    { status: "cancelled", title: "Cancelled reservations", description: "Reservations cancelled by a member or administrator.", empty: "No cancelled reservations." },
    { status: "rejected", title: "Rejected reservations", description: "Requests that were not approved.", empty: "No rejected reservations." },
  ] as const;

  const renderReservation = (reservation: (typeof reservations)[number]) => (
    <article className="admin-reservation-row" key={reservation.id}>
      <div><strong>{reservation.title}</strong><p>{reservation.resourceName} · for {reservation.reservedBy}{reservation.teamName ? ` · ${reservation.teamName}` : ""} · {reservation.priority} priority</p></div>
      <time>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(reservation.startAt))}</time>
      <span className={`status status-${reservation.status}`}>{reservation.status}</span>
      {reservation.status === "pending" && <form action={decideReservation} className="decision-actions"><input type="hidden" name="reservationId" value={reservation.id} /><button name="decision" value="approve" className="decision-approve">Approve</button><button name="decision" value="reject" className="decision-reject">Reject</button></form>}
    </article>
  );

  return (
    <main className="simple-page">
      <div className="simple-page-header"><div><p className="eyebrow">Administrator workspace</p><h1>Operations overview</h1><p className="heading-subtitle">Review reservations and create bookings for members or teams.</p></div><div className="admin-header-actions"><Link className="outline-button" href="/admin/users/new">Manage users</Link><Link className="outline-button" href="/admin/resources/new">Add resource</Link><Link className="primary-button" href="/admin/reservations/new"><span>+</span> Book for someone</Link></div></div>
      <section className="admin-banner"><div><strong>Signed in as {admin.fullName}</strong><span>Admin controls are enabled for this account.</span></div><form action={signOut}><button className="outline-button" type="submit">Sign out</button></form></section>
      <section className="admin-sections">
        {sections.map((section) => {
          const sectionReservations = reservations.filter((reservation) => reservation.status === section.status);
          return <section className="simple-panel admin-status-section" key={section.status}><div className="panel-header"><div><h2>{section.title}</h2><p>{section.description}</p></div></div>{sectionReservations.length === 0 ? <div className="admin-empty-state">{section.empty}</div> : sectionReservations.map(renderReservation)}</section>;
        })}
      </section>
    </main>
  );
}
