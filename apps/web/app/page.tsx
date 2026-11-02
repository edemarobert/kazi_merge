import { AppShell } from "./shell";

export default function HomePage() {
  return (
    <AppShell>
      <div className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Monday, 2 November</p>
            <h1>Good morning, Amina</h1>
            <p className="page-intro">Here is what needs your attention today.</p>
          </div>
          <div className="trial-banner">
            <strong>24 days left</strong>
            <span>in your free trial</span>
          </div>
        </header>

        <section className="metric-grid" aria-label="Work summary">
          <article className="metric-card">
            <span>Open tasks</span>
            <strong>18</strong>
            <small>Across your company</small>
          </article>
          <article className="metric-card danger">
            <span>Overdue</span>
            <strong>3</strong>
            <small>Needs attention</small>
          </article>
          <article className="metric-card warning">
            <span>Due this week</span>
            <strong>7</strong>
            <small>Keep work moving</small>
          </article>
          <article className="metric-card success">
            <span>Blocked</span>
            <strong>2</strong>
            <small>Waiting for a next step</small>
          </article>
        </section>

        <div className="dashboard-grid">
          <section className="panel workload-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Team view</p>
                <h2>Workload</h2>
              </div>
              <Link href="/people">View people</Link>
            </div>
            <div className="workload-list">
              <WorkloadRow name="Brian Kato" open={6} overdue={1} initials="BK" />
              <WorkloadRow name="Grace Atim" open={4} overdue={0} initials="GA" />
              <WorkloadRow name="Peter Okello" open={3} overdue={2} initials="PO" />
            </div>
          </section>

          <section className="panel activity-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Latest updates</p>
                <h2>Recent activity</h2>
              </div>
              <Link href="/activity">View all</Link>
            </div>
            <ul className="activity-list">
              <li>
                <span className="activity-dot success-dot" />
                <span>
                  <strong>Brian</strong> marked stock levels Done
                  <small>12 minutes ago</small>
                </span>
              </li>
              <li>
                <span className="activity-dot warning-dot" />
                <span>
                  <strong>Grace</strong> added a note to client follow-up
                  <small>45 minutes ago</small>
                </span>
              </li>
              <li>
                <span className="activity-dot primary-dot" />
                <span>
                  <strong>You</strong> assigned a new task to Peter
                  <small>1 hour ago</small>
                </span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

import Link from "next/link";

function WorkloadRow({
  name,
  open,
  overdue,
  initials,
}: {
  name: string;
  open: number;
  overdue: number;
  initials: string;
}) {
  return (
    <div className="workload-row">
      <span className="avatar">{initials}</span>
      <span className="workload-person">
        <strong>{name}</strong>
        <small>{open} open tasks</small>
      </span>
      <span className="workload-bar">
        <span style={{ width: `${open * 10}%` }} />
      </span>
      {overdue > 0 ? (
        <span className="overdue-label">{overdue} late</span>
      ) : (
        <span className="on-track">On track</span>
      )}
    </div>
  );
}
