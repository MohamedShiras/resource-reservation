import Link from "next/link";
import { requireAdmin } from "@/src/server/auth";
import { createUser } from "@/src/actions/admin-users";
import { getAdminUserFormOptions, getAdminUsers } from "@/src/server/repositories/admin";
import DeleteUserButton from "./DeleteUserButton";

export default async function AdminNewUserPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleteError?: string }>;
}) {
  await requireAdmin();
  const [{ error, deleteError }, users, formOptions] = await Promise.all([
    searchParams,
    getAdminUsers(),
    getAdminUserFormOptions(),
  ]);

  return (
    <main className="simple-page">
      <div className="simple-page-header">
        <div>
          <p className="eyebrow">Administrator workspace</p>
          <h1>Manage users</h1>
          <p className="heading-subtitle">Add members and administrators who can access the reservation workspace.</p>
        </div>
        <Link className="outline-button" href="/admin">Back to admin</Link>
      </div>
      <div className="resource-management-grid">
        <form className="simple-panel reservation-form resource-create-form" action={createUser}>
          <div className="panel-header"><div><h2>Add user</h2><p>New users can sign in immediately.</p></div></div>
          <label>
            Full name
            <input name="fullName" placeholder="e.g. Alex Perera" required maxLength={120} />
          </label>
          <label>
            Email address
            <input name="email" type="email" placeholder="alex@example.com" required maxLength={255} />
          </label>
          <label>
            Temporary password
            <input name="password" type="password" placeholder="At least 8 characters" required minLength={8} maxLength={100} />
          </label>
          <label>
            Team
            <select name="teamId" defaultValue="">
              <option value="">No team assignment</option>
              {formOptions.teams.map((team) => (
                <option value={team.id} key={team.id}>{team.name}</option>
              ))}
            </select>
          </label>
          <label>
            Team member role
            <select name="memberRole" defaultValue="">
              <option value="">Select a role</option>
              {formOptions.teamMemberRoles.map((role) => (
                <option value={role.name} key={role.id}>{role.name}</option>
              ))}
            </select>
          </label>
          <label>
            User role
            <select name="role" defaultValue="member" required>
              <option value="member">Member</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit">Add user</button>
        </form>
        <section className="simple-panel resource-management-list">
          <div className="panel-header"><div><h2>Current users</h2><p>{users.length} user{users.length === 1 ? "" : "s"} in this workspace.</p></div></div>
          {deleteError && <p className="auth-error" role="alert">{deleteError}</p>}
          <div className="admin-resource-list">{users.map((user) => <article className="admin-resource-row" key={user.id}><div className="admin-user-copy"><div className="admin-user-avatar">{user.fullName.slice(0, 2).toUpperCase()}</div><div><strong>{user.fullName}</strong><p>{user.email}</p>{user.teamName && <p>Team: {user.teamName}</p>}{user.teamMemberRole && <p>Team member role: {user.teamMemberRole}</p>}</div></div><div className="admin-user-meta"><span className="admin-user-role">{user.role}</span><span className={`status ${user.isActive ? "available" : "in-use"}`}>{user.isActive ? "active" : "inactive"}</span><DeleteUserButton userId={user.id} userName={user.fullName} /></div></article>)}</div>
        </section>
      </div>
    </main>
  );
}
