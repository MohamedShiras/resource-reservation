import Link from "next/link";
import { requireUser } from "@/src/server/auth";
import { query } from "@/src/lib/db";
import { requestReservation } from "@/src/actions/reservations";

export default async function NewReservationPage({ searchParams }: { searchParams: Promise<{ resource?: string; error?: string }> }) {
  const params = await searchParams;
  const user = await requireUser();
  const resources = await query<{ id: number; name: string }>("SELECT id, name FROM resources WHERE status::text = 'available' ORDER BY name");
  return (
    <main className="simple-page">
      <div className="simple-page-header"><div><p className="eyebrow">Reservations</p><h1>New reservation</h1><p className="heading-subtitle">Choose a resource and time for your booking.</p></div><Link className="outline-button" href="/#">Back to Overview</Link></div>
      <form className="simple-panel reservation-form" action={requestReservation}><label>Resource<select name="resourceId" defaultValue={params.resource ?? ""} required><option value="">Select a resource</option>{resources.rows.map((resource) => <option value={resource.id} key={resource.id}>{resource.name}</option>)}</select></label><label>Title<input name="title" placeholder="What is this reservation for?" required /></label><label>Purpose<textarea name="purpose" placeholder="Explain what this resource will be used for" rows={3} required /></label><label>Priority<select name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><div className="form-grid"><label>Start<input name="startAt" type="datetime-local" required /></label><label>End<input name="endAt" type="datetime-local" required /></label></div><div className="notice signed-in-notice"><strong>Signed in as {user.fullName}</strong><p>Your request will be sent to an administrator for approval.</p></div>{params.error && <p className="auth-error">{params.error}</p>}<button className="primary-button" type="submit">Submit reservation request</button></form>
    </main>
  );
}
