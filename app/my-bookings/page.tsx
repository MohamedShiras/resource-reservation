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
  const now = new Date();
  const upcomingBookings = bookings
    .filter((booking) => new Date(booking.startAt) >= now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const pastBookings = bookings
    .filter((booking) => new Date(booking.startAt) < now)
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

  const renderBooking = (booking: UserBooking) => (
    <article className="booking-detail" key={booking.id}>
      <div>
        <strong className="booking-title">{booking.title}</strong>
        <p>{booking.resourceName}{booking.teamName ? ` · ${booking.teamName}` : " · Personal"} · {booking.priority} priority</p>
      </div>
      <time>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(booking.startAt))}</time>
      <span className={`status ${booking.status === "confirmed" ? "available" : booking.status === "pending" ? "pending" : "in-use"}`}>{booking.status}</span>
      {["pending", "confirmed"].includes(booking.status) && new Date(booking.startAt) > now && <CancelReservationButton reservationId={booking.id} />}
    </article>
  );

  return (
    <main className="simple-page">
      <div className="simple-page-header"><div><Link className="back-link" href="/">← Back to overview</Link><p className="eyebrow">Personal workspace</p><h1>My bookings</h1></div></div>
      <section className="simple-panel">
        {params.error && <p className="auth-error" role="alert">{params.error}</p>}
        {bookings.length === 0 ? <div className="empty-state"><strong>No bookings yet</strong><p>Your reservation requests will appear here after you submit them.</p><Link className="outline-button" href="/reservations/new">Create a reservation request <span>→</span></Link></div> : (
          <div className="booking-sections">
            <section className="booking-section" aria-labelledby="upcoming-bookings-heading">
              <div className="booking-section-heading">
                <div>
                  <h2 id="upcoming-bookings-heading">Upcoming bookings</h2>
                  <p>Reservations scheduled for the future</p>
                </div>
              </div>
              {upcomingBookings.length > 0 ? <div className="booking-list">{upcomingBookings.map(renderBooking)}</div> : <p className="booking-section-empty">No upcoming bookings.</p>}
            </section>

            <section className="booking-section" aria-labelledby="past-reservations-heading">
              <div className="booking-section-heading">
                <div>
                  <h2 id="past-reservations-heading">Past reservations</h2>
                  <p>Completed or previously scheduled reservations</p>
                </div>
              </div>
              {pastBookings.length > 0 ? <div className="booking-list">{pastBookings.map(renderBooking)}</div> : <p className="booking-section-empty">No past reservations.</p>}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
