import { connection } from "next/server";
import { getEnv } from "@/src/lib/env";
import { getDashboardData } from "@/src/server/repositories/dashboard";
import { requireUser } from "@/src/server/auth";
import { redirect } from "next/navigation";
import { signOut } from "@/src/actions/session";

export default async function Home() {
  await connection();
  const user = await requireUser();
  if (user.role === "admin") {
    redirect("/admin");
  }
  const { APP_TIMEZONE } = getEnv();
  const dashboard = await getDashboardData(APP_TIMEZONE);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">R</div>
          <div>
            <strong>Reserve</strong>
            <span>Workspace</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#overview"><span className="nav-icon">□</span>Overview</a>
          <a className="nav-item" href="/resources"><span className="nav-icon">◈</span>Resources</a>
          <a className="nav-item" href="/calendar"><span className="nav-icon">▣</span>Calendar</a>
          <a className="nav-item" href="/my-bookings"><span className="nav-icon">✓</span>My bookings</a>
        </nav>

        <div className="sidebar-section-label">Workspace</div>
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          <a className="nav-item" href="#teams"><span className="nav-icon">◉</span>Teams</a>
          <a className="nav-item" href="#reports"><span className="nav-icon">▤</span>Reports</a>
        </nav>

        <div className="sidebar-bottom">
          <a className="nav-item" href="#settings"><span className="nav-icon">⚙</span>Settings</a>
          <div className="profile">
            <div className="avatar">{user.fullName.slice(0, 2).toUpperCase()}</div>
            <div><strong>{user.fullName}</strong><span>{user.role}</span></div>
            <form action={signOut}><button className="profile-sign-out" type="submit">Sign out</button></form>
          </div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>Overview</strong></div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Notifications">♧<span className="notification-dot" /></button>
            <div className="topbar-avatar">{user.fullName.slice(0, 2).toUpperCase()}</div>
          </div>
        </header>

        <div className="page-content" id="overview">
          <div className="page-heading">
            <div>
              <p className="eyebrow">Workspace overview</p>
              <h1>Welcome to your workspace <span aria-hidden="true">✦</span></h1>
              <p className="heading-subtitle">Create resources and reservations to get started.</p>
            </div>
            <a className="primary-button" href="/reservations/new"><span>+</span> New reservation</a>
          </div>

          <div className="stat-grid">
            <article className="stat-card"><div className="stat-card-top"><span>Today&apos;s bookings</span><span className="stat-icon blue">▣</span></div><strong>{dashboard.bookingCount}</strong><p>Confirmed reservations today</p></article>
            <article className="stat-card"><div className="stat-card-top"><span>Available now</span><span className="stat-icon green">◈</span></div><strong>{dashboard.availableResourceCount} <small>/ {dashboard.resourceCount}</small></strong><p>Resources available</p></article>
            <article className="stat-card"><div className="stat-card-top"><span>Upcoming bookings</span><span className="stat-icon purple">✓</span></div><strong>{dashboard.upcomingBookingCount}</strong><p>Confirmed future reservations</p></article>
            <article className="stat-card"><div className="stat-card-top"><span>Utilization</span><span className="stat-icon orange">◒</span></div><strong>—</strong><p>No utilization data yet</p></article>
          </div>

          <div className="dashboard-grid">
            <section className="panel schedule-panel" id="calendar">
              <div className="panel-header"><div><h2>Upcoming schedule</h2><p>Confirmed reservations from your workspace</p></div><a href="/calendar">View calendar <span>→</span></a></div>
              <div className={dashboard.reservations.length === 0 ? "empty-state" : "schedule-list"}>
                {dashboard.reservations.length > 0 ? dashboard.reservations.map((reservation) => (
                  <div className="timeline-row" key={`${reservation.title}-${reservation.startAt}`}>
                    <div className="timeline-time">{new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", timeZone: APP_TIMEZONE }).format(new Date(reservation.startAt))}</div>
                    <div className="timeline-card bg-blue-500"><div><strong>{reservation.title}</strong><span>{reservation.resourceName}</span></div></div>
                  </div>
                )) : (<>
                  <span className="empty-state-icon">▣</span>
                  <strong>No bookings yet</strong>
                  <p>Confirmed reservations will appear here.</p>
                </>)}
              </div>
              <a className="outline-button full-width" href="/my-bookings">See all bookings <span>→</span></a>
            </section>

            <section className="panel resources-panel" id="resources">
              <div className="panel-header"><div><h2>Resource availability</h2><p>Live status across your workspace</p></div><a href="/resources">View all <span>→</span></a></div>
              <div className={dashboard.resources.length === 0 ? "empty-state resource-empty-state" : "resource-list"}>
                {dashboard.resources.length > 0 ? dashboard.resources.map((resource) => (
                  <div className="resource-row" key={resource.name}><span className={`resource-dot ${resource.kind === "facility" ? "blue" : "emerald"}`} /><div className="resource-info"><strong>{resource.name}</strong><span>{resource.kind}</span></div><span className={`status ${resource.status === "available" ? "available" : "in-use"}`}>{resource.status}</span></div>
                )) : (<>
                  <span className="empty-state-icon">◈</span>
                  <strong>No resources yet</strong>
                  <p>Resources will appear here after they are added.</p>
                </>)}
              </div>
              <div className="availability-summary"><span className="summary-ring">{dashboard.resourceCount > 0 ? `${Math.round((dashboard.availableResourceCount / dashboard.resourceCount) * 100)}%` : "—"}</span><div><strong>{dashboard.resourceCount > 0 ? "Live availability" : "Availability unavailable"}</strong><p>{dashboard.resourceCount > 0 ? `${dashboard.availableResourceCount} of ${dashboard.resourceCount} resources are available` : "Add resources to see live availability."}</p></div></div>
            </section>
          </div>

          <section className="quick-booking">
            <div className="quick-copy"><span className="quick-spark">✦</span><div><h2>Find the right space</h2><p>Search availability and book a resource in seconds.</p></div></div>
            <a className="search-control" href="/resources"><span>⌕</span><span className="search-placeholder">Search rooms, equipment, or amenities</span><span className="search-submit">Search</span></a>
          </section>
        </div>
      </section>
    </main>
  );
}
