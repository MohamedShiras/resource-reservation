import Link from "next/link";
import { requireAdmin } from "@/src/server/auth";
import { getAdminBookingOptions } from "@/src/server/repositories/admin";
import { createAdminReservation } from "@/src/actions/admin-reservations";

export default async function AdminNewReservationPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { resources, users, teams } = await getAdminBookingOptions();
  const { error } = await searchParams;

  return (
    <main className="simple-page">
      <div className="simple-page-header"><div><p className="eyebrow">Administrator workspace</p><h1>Book for a member or team</h1><p className="heading-subtitle">Create a confirmed reservation on behalf of someone else.</p></div><Link className="outline-button" href="/admin">Back to admin</Link></div>
      <form className="simple-panel reservation-form" action={createAdminReservation}>
        <label>Resource<select name="resourceId" required><option value="">Select a resource</option>{resources.map((resource) => <option value={resource.id} key={resource.id}>{resource.name}</option>)}</select></label>
        <label>Reserved for member<select name="reservedBy" required><option value="">Select a member</option>{users.map((user) => <option value={user.id} key={user.id}>{user.fullName} ({user.email})</option>)}</select></label>
        <label>Team (optional)<select name="teamId"><option value="">Personal reservation</option>{teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
        <label>Title<input name="title" placeholder="What is this reservation for?" required /></label>
        <div className="form-grid"><label>Start<input name="startAt" type="datetime-local" required /></label><label>End<input name="endAt" type="datetime-local" required /></label></div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit">Create confirmed reservation</button>
      </form>
    </main>
  );
}
