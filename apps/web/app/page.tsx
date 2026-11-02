import Link from "next/link";
import { AppShell } from "./shell";
import { translations } from "./translations";

export default function HomePage() {
  return (
    <AppShell>
      <div className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">{translations.dashboard.date}</p>
            <h1>{translations.dashboard.greeting}</h1>
            <p className="page-intro">{translations.dashboard.intro}</p>
          </div>
          <div className="trial-banner">
            <strong>{translations.dashboard.trialDays}</strong>
            <span>{translations.dashboard.trialLabel}</span>
          </div>
        </header>

        <section
          className="metric-grid"
          aria-label={translations.dashboard.workSummary}
        >
          <article className="metric-card">
            <span>{translations.dashboard.metrics.openTasks}</span>
            <strong>18</strong>
            <small>{translations.dashboard.metrics.openTasksHint}</small>
          </article>
          <article className="metric-card danger">
            <span>{translations.dashboard.metrics.overdue}</span>
            <strong>3</strong>
            <small>{translations.dashboard.metrics.overdueHint}</small>
          </article>
          <article className="metric-card warning">
            <span>{translations.dashboard.metrics.dueThisWeek}</span>
            <strong>7</strong>
            <small>{translations.dashboard.metrics.dueThisWeekHint}</small>
          </article>
          <article className="metric-card success">
            <span>{translations.dashboard.metrics.blocked}</span>
            <strong>2</strong>
            <small>{translations.dashboard.metrics.blockedHint}</small>
          </article>
        </section>

        <div className="dashboard-grid">
          <section className="panel workload-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{translations.dashboard.teamView}</p>
                <h2>{translations.dashboard.workload}</h2>
              </div>
              <Link href="/people">{translations.dashboard.viewPeople}</Link>
            </div>
            <div className="workload-list">
              <WorkloadRow
                name={translations.dashboard.workloadRows.brian}
                open={6}
                overdue={1}
                initials="BK"
              />
              <WorkloadRow
                name={translations.dashboard.workloadRows.grace}
                open={4}
                overdue={0}
                initials="GA"
              />
              <WorkloadRow
                name={translations.dashboard.workloadRows.peter}
                open={3}
                overdue={2}
                initials="PO"
              />
            </div>
          </section>

          <section className="panel activity-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{translations.dashboard.latestUpdates}</p>
                <h2>{translations.dashboard.recentActivity}</h2>
              </div>
              <Link href="/activity">{translations.dashboard.viewAll}</Link>
            </div>
            <ul className="activity-list">
              <li>
                <span className="activity-dot success-dot" />
                <span>
                  <strong>{translations.dashboard.activity.brian}</strong>{" "}
                  {translations.dashboard.activity.brianAction}
                  <small>{translations.dashboard.activity.twelveMinutes}</small>
                </span>
              </li>
              <li>
                <span className="activity-dot warning-dot" />
                <span>
                  <strong>{translations.dashboard.activity.grace}</strong>{" "}
                  {translations.dashboard.activity.graceAction}
                  <small>{translations.dashboard.activity.fortyFiveMinutes}</small>
                </span>
              </li>
              <li>
                <span className="activity-dot primary-dot" />
                <span>
                  <strong>{translations.dashboard.activity.you}</strong>{" "}
                  {translations.dashboard.activity.youAction}
                  <small>{translations.dashboard.activity.oneHour}</small>
                </span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

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
        <small>
          {open} {translations.dashboard.workloadOpenTasks}
        </small>
      </span>
      <span className="workload-bar">
        <span style={{ width: `${open * 10}%` }} />
      </span>
      {overdue > 0 ? (
        <span className="overdue-label">
          {overdue} {translations.dashboard.late}
        </span>
      ) : (
        <span className="on-track">{translations.dashboard.onTrack}</span>
      )}
    </div>
  );
}
