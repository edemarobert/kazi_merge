"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "./shell";
import { translations } from "./translations";

type DashboardData = {
  companyName: string | null;
  trialDays: number | null;
  metrics: {
    openTasks: number;
    overdue: number;
    dueThisWeek: number;
    blocked: number;
  };
  workload: { id: string; name: string; open: number; overdue: number }[];
  activity: { id: string; action: string; createdAt: string }[];
};

const emptyData: DashboardData = {
  companyName: null,
  trialDays: null,
  metrics: { openTasks: 0, overdue: 0, dueThisWeek: 0, blocked: 0 },
  workload: [],
  activity: [],
};

export default function HomePage() {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/api/v1/dashboard`,
      { credentials: "include" },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Dashboard unavailable.");
        return (await response.json()) as DashboardData;
      })
      .then(setData)
      .catch(() => setError(true));
  }, []);

  return (
    <AppShell>
      <div className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">{new Date().toLocaleDateString()}</p>
            <h1>{data.companyName ?? translations.dashboard.greeting}</h1>
            <p className="page-intro">{translations.dashboard.intro}</p>
          </div>
          {data.trialDays !== null && (
            <div className="trial-banner">
              <strong>{data.trialDays} days left</strong>
              <span>{translations.dashboard.trialLabel}</span>
            </div>
          )}
        </header>
        {error && <p role="alert">Dashboard data is unavailable.</p>}

        <section
          className="metric-grid"
          aria-label={translations.dashboard.workSummary}
        >
          <Metric
            label={translations.dashboard.metrics.openTasks}
            value={data.metrics.openTasks}
          />
          <Metric
            label={translations.dashboard.metrics.overdue}
            value={data.metrics.overdue}
          />
          <Metric
            label={translations.dashboard.metrics.dueThisWeek}
            value={data.metrics.dueThisWeek}
          />
          <Metric
            label={translations.dashboard.metrics.blocked}
            value={data.metrics.blocked}
          />
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
              {data.workload.map((person) => (
                <WorkloadRow key={person.id} {...person} />
              ))}
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
              {data.activity.map((item) => (
                <li key={item.id}>
                  <span className="activity-dot primary-dot" />
                  <span>
                    <strong>{item.action}</strong>
                    <small>{new Date(item.createdAt).toLocaleString()}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function WorkloadRow({
  name,
  open,
  overdue,
}: {
  id: string;
  name: string;
  open: number;
  overdue: number;
}) {
  return (
    <div className="workload-row">
      <span className="avatar">{name.slice(0, 2).toUpperCase()}</span>
      <span className="workload-person">
        <strong>{name}</strong>
        <small>
          {open} {translations.dashboard.workloadOpenTasks}
        </small>
      </span>
      <span className="workload-bar">
        <span style={{ width: `${Math.min(open * 10, 100)}%` }} />
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
