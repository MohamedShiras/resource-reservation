import Link from "next/link";
import { requireUser } from "@/src/server/auth";
import { query } from "@/src/lib/db";
import CancelReservationButton from "./CancelReservationButton";

type UserBooking = {
  id: number;
  title: string;
  status: string;
  priority: string;
  startAt: string;
  endAt: string;
  resourceName: string;
  teamName: string | null;
};

export default async function MyBookingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const result = await query<UserBooking>(
    `SELECT
      reservations.id,
      reservations.title,
      reservations.status::text AS status,
      reservations.priority::text AS priority,
      reservations.start_at AS "startAt",
      reservations.end_at AS "endAt",
      resources.name AS "resourceName",
      teams.name AS "teamName"
     FROM reservations
     JOIN resources ON resources.id = reservations.resource_id
     LEFT JOIN teams ON teams.id = reservations.team_id
     WHERE reservations.reserved_by = $1
     ORDER BY reservations.start_at DESC`,
    [user.id],
  );
  const bookings = result.rows;

  return (
    <main className="simple-page">
      <div className="simple-page-header"><div><Link className="back-link" href="/">← Back to overview</Link><p className="eyebrow">Personal workspace</p><h1>My bookings</h1><p className="heading-subtitle">Reservations for {user.fullName}.</p></div><Link className="primary-button" href="/reservations/new"><span>+</span> New reservation</Link></div>
      <section className="simple-panel">
        {params.error && <p className="auth-error" role="alert">{params.error}</p>}
        {bookings.length === 0 ? <div className="empty-state"><strong>No bookings yet</strong><p>Your reservation requests will appear here after you submit them.</p><Link className="outline-button" href="/reservations/new">Create a reservation request <span>→</span></Link></div> : bookings.map((booking) => <article className="booking-detail" key={booking.id}><div><strong>{booking.title}</strong><p>{booking.resourceName}{booking.teamName ? ` · ${booking.teamName}` : " · Personal"} · {booking.priority} priority</p></div><time>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(booking.startAt))}</time><span className={`status ${booking.status === "confirmed" ? "available" : booking.status === "pending" ? "pending" : "in-use"}`}>{booking.status}</span>{["pending", "confirmed"].includes(booking.status) && new Date(booking.startAt) > new Date() && <CancelReservationButton reservationId={booking.id} />}</article>)}
      </section>
    </main>
  );
}
