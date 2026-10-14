import Link from "next/link";
import { connection } from "next/server";
import { getCalendarBlackouts, getCalendarReservations, type DashboardBlackout, type DashboardReservation } from "@/src/server/repositories/dashboard";
import { getEnv } from "@/src/lib/env";
import { requireUser } from "@/src/server/auth";

function getDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])) as {
    year: string;
    month: string;
    day: string;
  };
}

function dateKey(date: Date, timeZone: string) {
  const parts = getDateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getCurrentMonth(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}

function normalizeMonth(value: string | undefined, fallback: string) {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return fallback;
  return value;
}

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await connection();
  const user = await requireUser();
  const timeZone = getEnv().APP_TIMEZONE;
  const currentMonth = getCurrentMonth(timeZone);
  const todayParts = getDateParts(new Date(), timeZone);
  const todayKey = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
  const { month: requestedMonth } = await searchParams;
  const selectedMonth = normalizeMonth(requestedMonth, currentMonth);
  const [reservations, blackouts] = await Promise.all([
    getCalendarReservations(timeZone, selectedMonth, user.id),
    getCalendarBlackouts(timeZone, selectedMonth),
  ]);
  const data = { reservations, blackouts };
  const [selectedYear, selectedMonthNumber] = selectedMonth.split("-").map(Number);
  const year = selectedYear;
  const month = selectedMonthNumber - 1;
  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthName = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone }).format(monthStart);
  const previousMonth = shiftMonth(selectedMonth, -1);
  const nextMonth = shiftMonth(selectedMonth, 1);
  const firstWeekday = (monthStart.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const reservationsByDay = new Map<string, DashboardReservation[]>();
  const blackoutsByDay = new Map<string, DashboardBlackout[]>();

  for (const reservation of data.reservations) {
    const key = dateKey(new Date(reservation.startAt), timeZone);
    const reservations = reservationsByDay.get(key) ?? [];
    reservations.push(reservation);
    reservationsByDay.set(key, reservations);
  }

  for (const reservations of reservationsByDay.values()) {
    reservations.sort((left, right) => Number(right.reservedById === user.id) - Number(left.reservedById === user.id) || new Date(left.startAt).valueOf() - new Date(right.startAt).valueOf());
  }
  for (const blackout of data.blackouts) {
    const startKey = dateKey(new Date(blackout.startAt), timeZone);
    const endKey = dateKey(new Date(blackout.endAt), timeZone);
    const cursor = new Date(`${startKey}T00:00:00Z`);
    const last = new Date(`${endKey}T00:00:00Z`);
    while (cursor <= last) {
      const key = cursor.toISOString().slice(0, 10);
      const entries = blackoutsByDay.get(key) ?? [];
      entries.push(blackout);
      blackoutsByDay.set(key, entries);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const timeFormatter = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone });

  return (
    <main className="simple-page">
      <div className="simple-page-header"><div><Link className="back-link" href="/">← Back to overview</Link><p className="eyebrow">Workspace</p><h1>Calendar</h1><p className="heading-subtitle">Check your reservations and workspace availability at a glance.</p></div><Link className="primary-button" href="/reservations/new"><span>+</span> New reservation</Link></div>
      <section className="calendar-legend" aria-label="Calendar reservation types"><span className="calendar-legend-item"><i className="calendar-dot mine" /> My reservations</span><span className="calendar-legend-item"><i className="calendar-dot other" /> Other reservations</span><span className="calendar-legend-item"><i className="calendar-dot maintenance" /> Maintenance</span></section>
      <section className="simple-panel calendar-panel">
        <div className="calendar-toolbar"><div className="calendar-month-navigation"><Link className="calendar-nav-button" href={`/calendar?month=${previousMonth}`} aria-label="Previous month">←</Link><h2>{monthName}</h2><Link className="calendar-nav-button" href={`/calendar?month=${nextMonth}`} aria-label="Next month">→</Link><Link className="calendar-today-button" href="/calendar">Today</Link></div><span>{data.reservations.length} confirmed reservation{data.reservations.length === 1 ? "" : "s"} this month</span></div>
        <div className="calendar-weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {cells.map((day, index) => {
            const key = day === null ? `empty-${index}` : `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const reservations = day === null ? [] : reservationsByDay.get(key) ?? [];
            const dayBlackouts = day === null ? [] : blackoutsByDay.get(key) ?? [];
            return <div className={`calendar-cell${day === null ? " calendar-cell-empty" : ""}${key === todayKey ? " calendar-cell-today" : ""}`} key={key}>{day !== null && <><time>{key === todayKey ? <span className="calendar-today-number" aria-label="Today">{day}</span> : day}</time><div className="calendar-cell-reservations">{dayBlackouts.map((blackout) => <article className="calendar-event calendar-event-maintenance" key={`maintenance-${blackout.id}-${key}`}><strong>Maintenance</strong><span>{blackout.resourceName}</span><small>{timeFormatter.format(new Date(blackout.startAt))}</small><small className="calendar-event-owner">{blackout.reason}</small></article>)}{reservations.map((reservation) => { const isMine = reservation.reservedById === user.id; return <article className={`calendar-event ${isMine ? "calendar-event-mine" : "calendar-event-other"}`} key={reservation.id}><strong>{reservation.title}</strong><span>{reservation.resourceName}</span><small>{timeFormatter.format(new Date(reservation.startAt))}</small><small className="calendar-event-owner" title={isMine ? "My reservation" : `Reserved by ${reservation.reservedBy}`}>{isMine ? "My reservation" : `Reserved by ${reservation.reservedBy}`}</small></article>; })}</div></>}</div>;
          })}
        </div>
        {data.reservations.length === 0 && data.blackouts.length === 0 && <div className="calendar-empty">No upcoming confirmed reservations or maintenance.</div>}
      </section>
      <section className="simple-panel calendar-confirmed-list">
        <div className="panel-header">
          <div><h2>Confirmed reservations</h2><p>All confirmed workspace reservations for {monthName}.</p></div>
        </div>
        {data.reservations.length === 0 ? <div className="calendar-list-empty">No confirmed reservations this month.</div> : <div className="calendar-reservation-list">{data.reservations.map((reservation) => { const isMine = reservation.reservedById === user.id; return <article className="calendar-reservation-item" key={reservation.id}><div className={`calendar-reservation-marker ${isMine ? "mine" : "other"}`} /><div className="calendar-reservation-copy"><strong>{reservation.title}</strong><span>{reservation.resourceName}</span><small>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(reservation.startAt))}</small></div><div className={`calendar-reservation-owner ${isMine ? "mine" : "other"}`}>{isMine ? "My reservation" : `Reserved by ${reservation.reservedBy}`}</div></article>; })}</div>}
      </section>
    </main>
  );
}
