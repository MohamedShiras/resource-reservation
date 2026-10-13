import Link from "next/link";
import { requireAdmin } from "@/src/server/auth";
import { createResource } from "@/src/actions/admin-resources";
import { getAdminResourceFormOptions, getAdminResources } from "@/src/server/repositories/admin";

export default async function AdminNewResourcePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const [{ error }, resources, options] = await Promise.all([
    searchParams,
    getAdminResources(),
    getAdminResourceFormOptions(),
  ]);

  return (
    <main className="simple-page">
      <div className="simple-page-header">
        <div>
          <p className="eyebrow">Administrator workspace</p>
          <h1>Manage resources</h1>
          <p className="heading-subtitle">Add facilities and equipment available for common reservations.</p>
        </div>
        <Link className="outline-button" href="/admin">Back to admin</Link>
      </div>
      <div className="resource-management-grid">
        <form className="simple-panel reservation-form resource-create-form" action={createResource}>
          <div className="panel-header"><div><h2>Add resource</h2><p>New resources start as available.</p></div></div>
          <label>
            Resource name
            <input name="name" placeholder="e.g. Conference Room C" required maxLength={100} />
          </label>
          <label>
            Resource type
            <select name="kind" defaultValue="" required>
              <option value="" disabled>Select a type</option>
              <option value="facility">Facility</option>
              <option value="equipment">Equipment</option>
            </select>
          </label>
          <label>
            Resource category
            <select name="categoryId" defaultValue="" required>
              <option value="" disabled>Select a category</option>
              {options.categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label>
            Location
            <select name="locationId" defaultValue="" required>
              <option value="" disabled>Select a location</option>
              {options.locations.map((location) => <option value={location.id} key={location.id}>{location.building} · Floor {location.floorNo}</option>)}
            </select>
          </label>
          <label>
            Capacity
            <input name="capacity" type="number" min="1" defaultValue="1" required />
          </label>
          <label>
            Asset tag <span className="field-hint">(required for equipment)</span>
            <input name="assetTag" placeholder="e.g. EQ-003" maxLength={100} />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit">Add resource</button>
        </form>
        <section className="simple-panel resource-management-list">
          <div className="panel-header"><div><h2>Current resources</h2><p>{resources.length} resource{resources.length === 1 ? "" : "s"} available in this workspace.</p></div></div>
          {resources.length === 0 ? <div className="admin-empty-state">No resources have been added yet.</div> : <div className="admin-resource-list">{resources.map((resource) => <article className="admin-resource-row" key={resource.id}><div className="admin-resource-copy"><span className={`resource-dot ${resource.kind === "facility" ? "blue" : "emerald"}`} /><div><strong>{resource.name}</strong><p>{resource.kind}</p></div></div><span className={`status ${resource.status === "available" ? "available" : "in-use"}`}>{resource.status}</span></article>)}</div>}
        </section>
      </div>
    </main>
  );
}
