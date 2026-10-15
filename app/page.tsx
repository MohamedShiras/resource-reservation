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
  const dashboard = await getDashboardData(APP_TIMEZONE, user.id);

  const firstName = user.fullName.split(" ")[0];

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
          <a className="nav-item active" href="#overview"><span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 20 20"><rect x="3.5" y="3.5" width="5" height="5" rx="1" /><rect x="11.5" y="3.5" width="5" height="5" rx="1" /><rect x="3.5" y="11.5" width="5" height="5" rx="1" /><rect x="11.5" y="11.5" width="5" height="5" rx="1" /></svg></span>Overview</a>
          <a className="nav-item" href="/resources"><span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m10 2.8 7 7.2-7 7.2-7-7.2 7-7.2Z" /><circle cx="10" cy="10" r="2.1" /></svg></span>Resources</a>
          <a className="nav-item" href="/calendar"><span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 20 20"><rect x="3" y="4.5" width="14" height="12" rx="2" /><path d="M6.5 2.8v3M13.5 2.8v3M3 8h14" /></svg></span>Calendar</a>
          <a className="nav-item" href="/my-bookings"><span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"><rect x="3" y="4.5" width="14" height="12" rx="2" /><path d="M6.5 2.8v3M13.5 2.8v3M3 8h14M6.5 11.5h.01M10 11.5h.01M13.5 11.5h.01M6.5 14.5h.01M10 14.5h.01" /></svg></span>My bookings</a>
        </nav>

        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar">{user.fullName.slice(0, 2).toUpperCase()}</div>
            <div><strong>{user.fullName}</strong><span>{user.role}</span></div>
          </div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>Overview</strong></div>
          <div className="topbar-actions">
            <form action={signOut}><button className="topbar-sign-out" type="submit">Sign out</button></form>
          </div>
        </header>

        <div className="page-content" id="overview">

          {/* ── Page heading ── */}
          <div className="ov-heading">
            <div className="ov-heading-copy">
              <p className="eyebrow">Workspace overview</p>
              <h1>Good day, {firstName} <span aria-hidden="true">✦</span></h1>
              <p className="heading-subtitle">Here&apos;s what&apos;s happening in your workspace today.</p>
            </div>
            <a className="primary-button ov-new-btn" href="/reservations/new">
              <span>+</span> New reservation
            </a>
          </div>

          {/* ── Stat row ── */}
          <div className="ov-stat-row">
            <article className="ov-stat-card">
              <div className="ov-stat-icon ov-icon-blue">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="14" height="12" rx="2"/><path d="M6.5 2.8v3M13.5 2.8v3M3 8h14"/><path d="M7 12l2 2 4-4" strokeWidth="1.7"/></svg>
              </div>
              <div className="ov-stat-body">
                <span className="ov-stat-label">Upcoming bookings</span>
                <strong className="ov-stat-value">{dashboard.upcomingBookingCount}</strong>
                <span className="ov-stat-sub">Confirmed future reservations</span>
              </div>
            </article>

            <article className="ov-stat-card">
              <div className="ov-stat-icon ov-icon-purple">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 2.5"/></svg>
              </div>
              <div className="ov-stat-body">
                <span className="ov-stat-label">Resources available</span>
                <strong className="ov-stat-value">{dashboard.resources.filter(r => r.status === "available").length}<small>/{dashboard.resources.length}</small></strong>
                <span className="ov-stat-sub">Ready to reserve right now</span>
              </div>
            </article>

          </div>



          {/* ── Main grid ── */}
          <div className="dashboard-grid">
            <section className="panel schedule-panel" id="calendar">
              <div className="panel-header">
                <div><h2>Upcoming schedule</h2><p>Your confirmed reservations</p></div>
                <a href="/calendar">View calendar <span>→</span></a>
              </div>
              <div className={dashboard.reservations.length === 0 ? "empty-state" : "schedule-list"}>
                {dashboard.reservations.length > 0 ? dashboard.reservations.map((reservation) => (
                  <div className="timeline-row" key={`${reservation.title}-${reservation.startAt}`}>
                    <div className="timeline-time">
                      {new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", timeZone: APP_TIMEZONE }).format(new Date(reservation.startAt))}
                      <small>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: APP_TIMEZONE }).format(new Date(reservation.startAt))}</small>
                    </div>
                    <div className="timeline-card bg-blue-500">
                      <div><strong>{reservation.title}</strong><span>{reservation.resourceName}</span></div>
                    </div>
                  </div>
                )) : (<>
                  <span className="empty-state-icon">▣</span>
                  <strong>No upcoming bookings</strong>
                  <p>Your confirmed reservations will appear here.</p>
                </>)}
              </div>
              <a className="outline-button full-width" href="/my-bookings">See all bookings <span>→</span></a>
            </section>

            <section className="panel resources-panel" id="resources">
              <div className="panel-header">
                <div><h2>Resource availability</h2><p>Live status across your workspace</p></div>
                <a href="/resources">View all <span>→</span></a>
              </div>
              <div className={dashboard.resources.length === 0 ? "empty-state resource-empty-state" : "resource-list"}>
                {dashboard.resources.length > 0 ? dashboard.resources.map((resource) => (
                  <div className="resource-row" key={resource.name}>
                    <span className={`resource-dot ${resource.kind === "facility" ? "blue" : resource.kind === "amenity" ? "emerald" : "violet"}`} />
                    <div className="resource-info"><strong>{resource.name}</strong><span>{resource.kind}</span></div>
                    <span className={`status ${resource.status === "available" ? "available" : resource.status === "maintenance" ? "maintenance" : "in-use"}`}>{resource.status}</span>
                  </div>
                )) : (<>
                  <span className="empty-state-icon">◈</span>
                  <strong>No resources yet</strong>
                  <p>Resources will appear here after they are added.</p>
                </>)}
              </div>
            </section>
          </div>

        </div>
      </section>
    </main>
  );
}
