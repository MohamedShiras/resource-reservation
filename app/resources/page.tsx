import Link from "next/link";
import { connection } from "next/server";
import { getDashboardData } from "@/src/server/repositories/dashboard";
import { getEnv } from "@/src/lib/env";
import { requireUser } from "@/src/server/auth";

export default async function ResourcesPage() {
  await connection();
  await requireUser();
  const data = await getDashboardData(getEnv().APP_TIMEZONE);

  return (
    <main className="simple-page">
      <div className="simple-page-header"><div><Link className="back-link" href="/">← Back to overview</Link><p className="eyebrow">Workspace</p><h1>Resources</h1><p className="heading-subtitle">Browse every facility and piece of equipment available to your workspace.</p></div><Link className="primary-button" href="/reservations/new"><span>+</span> New reservation</Link></div>
      <section className="simple-panel">
        {data.resources.length === 0 ? <div className="empty-state"><strong>No resources yet</strong><p>Resources will appear here when an administrator adds them.</p></div> : data.resources.map((resource) => <article className="resource-detail" key={resource.id}><div><span className={`resource-dot ${resource.kind === "facility" ? "blue" : "emerald"}`} /><strong>{resource.name}</strong><p>{resource.kind}</p></div><span className={`status ${resource.status === "available" ? "available" : "in-use"}`}>{resource.status}</span><Link className="resource-reserve-button" href={`/reservations/new?resource=${resource.id}`}>Reserve <span>→</span></Link></article>)}
      </section>
    </main>
  );
}
