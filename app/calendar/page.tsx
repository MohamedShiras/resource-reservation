import Link from "next/link";
import { connection } from "next/server";
import { getDashboardData } from "@/src/server/repositories/dashboard";
import { getEnv } from "@/src/lib/env";
import { requireUser } from "@/src/server/auth";

export default async function CalendarPage() {
  await connection();
  await requireUser();
  const data = await getDashboardData(getEnv().APP_TIMEZONE);

  return (
    <main className="simple-page">
      <div className="simple-page-header"><div><Link className="back-link" href="/">← Back to overview</Link><p className="eyebrow">Workspace</p><h1>Calendar</h1><p className="heading-subtitle">See confirmed reservations across your resources.</p></div><Link className="primary-button" href="/reservations/new"><span>+</span> New reservation</Link></div>
      <section className="simple-panel">
        {data.reservations.length === 0 ? <div className="empty-state"><strong>No confirmed reservations</strong><p>Create a reservation to see it on the calendar.</p></div> : data.reservations.map((reservation) => <article className="calendar-row" key={`${reservation.title}-${reservation.startAt}`}><time dateTime={reservation.startAt}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: getEnv().APP_TIMEZONE }).format(new Date(reservation.startAt))}</time><div><strong>{reservation.title}</strong><p>{reservation.resourceName}</p></div></article>)}
      </section>
    </main>
  );
}
