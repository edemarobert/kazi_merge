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
    onTimeCompletionRate: number | null;
  };
  workload: { id: string; name: string; open: number; overdue: number }[];
  activity: { id: string; action: string; actorName: string; createdAt: string }[];
};

const emptyData: DashboardData = {
  companyName: null,
  trialDays: null,
  metrics: {
    openTasks: 0,
    overdue: 0,
    dueThisWeek: 0,
    blocked: 0,
    onTimeCompletionRate: null,
  },
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

  const maxOpenTasks = Math.max(1, ...data.workload.map((person) => person.open));

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
            href="/tasks?open=true"
          />
          <Metric
            label={translations.dashboard.metrics.overdue}
            value={data.metrics.overdue}
            href="/tasks?overdue=true"
          />
          <Metric
            label={translations.dashboard.metrics.dueThisWeek}
            value={data.metrics.dueThisWeek}
            href="/tasks?dueThisWeek=true"
          />
          <Metric
            label={translations.dashboard.metrics.blocked}
            value={data.metrics.blocked}
            href="/tasks?status=blocked"
          />{" "}
          <Metric
            label={translations.dashboard.metrics.onTimeCompletion}
            value={data.metrics.onTimeCompletionRate}
            suffix="%"
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
                <WorkloadRow key={person.id} {...person} maxOpenTasks={maxOpenTasks} />
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
                    <strong>
                      {item.actorName} - {item.action}
                    </strong>
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

function Metric({
  label,
  value,
  suffix = "",
  href,
}: {
  label: string;
  value: number | null;
  suffix?: string;
  href?: string;
}) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value === null ? "N/A" : `${value}${suffix}`}</strong>
    </>
  );

  return href ? (
    <Link className="metric-card" href={href}>
      {content}
    </Link>
  ) : (
    <article className="metric-card">{content}</article>
  );
}

function WorkloadRow({
  name,
  open,
  overdue,
  maxOpenTasks,
}: {
  id: string;
  name: string;
  open: number;
  overdue: number;
  maxOpenTasks: number;
}) {
  const workloadPercent = Math.round((open / maxOpenTasks) * 100);

  return (
    <div className="workload-row">
      <span className="avatar">{name.slice(0, 2).toUpperCase()}</span>
      <span className="workload-person">
        <strong>{name}</strong>
        <small>
          {open} {translations.dashboard.workloadOpenTasks}
        </small>
      </span>
      <span
        className="workload-bar"
        role="progressbar"
        aria-label={`${name} workload`}
        aria-valuemin={0}
        aria-valuemax={maxOpenTasks}
        aria-valuenow={open}
      >
        <span style={{ width: `${workloadPercent}%` }} />
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
