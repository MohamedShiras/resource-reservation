import Link from "next/link";
import { requireAdmin } from "@/src/server/auth";
import { createResource, endResourceMaintenance } from "@/src/actions/admin-resources";
import { getAdminMaintenanceHistory, getAdminResourceFormOptions, getAdminResources, getResourcesForFilter } from "@/src/server/repositories/admin";
import { getEnv } from "@/src/lib/env";
import DeleteResourceButton from "./DeleteResourceButton";
import ScheduleMaintenanceButton from "./ScheduleMaintenanceButton";

export default async function AdminNewResourcePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; maint_date?: string; maint_resource?: string }>;
}) {
  await requireAdmin();
  const { error, maint_date, maint_resource } = await searchParams;
  const { APP_TIMEZONE } = getEnv();

  const maintResourceId = maint_resource ? Number(maint_resource) : undefined;
  const validResourceId = Number.isFinite(maintResourceId) && maintResourceId! > 0 ? maintResourceId : undefined;

  const [resources, options, maintenanceHistory, filterResources] = await Promise.all([
    getAdminResources(),
    getAdminResourceFormOptions(),
    getAdminMaintenanceHistory({
      date: maint_date,
      resourceId: validResourceId,
      timeZone: APP_TIMEZONE,
    }),
    getResourcesForFilter(),
  ]);

  const hasFilter = !!(maint_date || validResourceId);

  const maintenanceDateTime = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIMEZONE,
  });

  return (
    <main className="simple-page">
      <div className="simple-page-header">
        <div>
          <p className="eyebrow">Administrator workspace</p>
          <h1>Manage resources</h1>
          <p className="heading-subtitle">Add facilities, equipment, and amenities available for common reservations.</p>
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
              <option value="amenities">Amenities</option>
            </select>
          </label>
          <label>
            Resource category
            <select name="categoryId" defaultValue="" required>
              <option value="" disabled>Select a category</option>
              {options.categories.map((category) => (
                <option value={category.id} key={category.id}>{category.name}</option>
              ))}
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
          {resources.length === 0 ? (
            <div className="admin-empty-state">No resources have been added yet.</div>
          ) : (
            <div className="admin-resource-list">
              {resources.map((resource) => (
                <article className="admin-resource-row" key={resource.id}>
                  <div className="admin-resource-copy">
                    <span className={`resource-dot ${resource.kind === "facility" ? "blue" : resource.kind === "amenities" ? "violet" : "emerald"}`} />
                    <div><strong>{resource.name}</strong><p>{resource.kind}</p></div>
                  </div>
                  <div className="admin-resource-actions">
                    <span className={`status ${resource.status === "available" ? "available" : resource.status === "maintenance" ? "maintenance" : "in-use"}`}>{resource.status}</span>
                    {resource.status === "maintenance" ? (
                      <form action={endResourceMaintenance}>
                        <input type="hidden" name="blackoutId" value={resource.activeMaintenanceId ?? ""} />
                        <button className="resource-maintenance-button resource-maintenance-active" type="submit">Over Maintenance</button>
                      </form>
                    ) : (
                      <ScheduleMaintenanceButton resourceId={resource.id} resourceName={resource.name} />
                    )}
                    <DeleteResourceButton resourceId={resource.id} resourceName={resource.name} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="simple-panel resource-maintenance-history">
        <div className="panel-header">
          <div><h2>Resource Maintenance History</h2><p>Finished maintenance periods recorded for workspace resources.</p></div>

          {/* Filter bar */}
          <form method="GET" action="/admin/resources/new" className="hist-filter-bar">
            <label className="hist-filter-label" htmlFor="maint_date">Date</label>
            <input
              id="maint_date"
              className="hist-filter-input"
              type="date"
              name="maint_date"
              defaultValue={maint_date ?? ""}
            />
            <label className="hist-filter-label" htmlFor="maint_resource">Resource</label>
            <select
              id="maint_resource"
              className="hist-filter-select"
              name="maint_resource"
              defaultValue={maint_resource ?? ""}
            >
              <option value="">All resources</option>
              {filterResources.map((r) => (
                <option key={r.id} value={String(r.id)}>{r.name}</option>
              ))}
            </select>
            <button className="hist-filter-btn" type="submit">Filter</button>
            {hasFilter && (
              <Link className="hist-filter-clear" href="/admin/resources/new">Clear</Link>
            )}
          </form>
        </div>

        {maintenanceHistory.length === 0 ? (
          <div className="admin-empty-state">No maintenance history matches the selected filters.</div>
        ) : (
          <div className="admin-maintenance-history-list">
            {maintenanceHistory.map((maintenance) => (
              <article className="admin-maintenance-history-row" key={maintenance.id}>
                <div>
                  <strong>{maintenance.resourceName}</strong>
                  <p>{maintenance.reason}</p>
                </div>
                <time>{maintenanceDateTime.format(new Date(maintenance.startAt))} – {maintenanceDateTime.format(new Date(maintenance.endAt))}</time>
                <span className="maintenance-history-status">Finished</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
