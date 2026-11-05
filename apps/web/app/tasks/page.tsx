"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "../shell";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high";
  dueAt: string | null;
  overdue: boolean;
  assignee: { membership: { user: { name: string } } };
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function initialQueryParam(name: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) ?? "";
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(
    () => initialQueryParam("overdue") === "true",
  );
  const [openOnly, setOpenOnly] = useState(() => initialQueryParam("open") === "true");
  const [dueThisWeekOnly, setDueThisWeekOnly] = useState(
    () => initialQueryParam("dueThisWeek") === "true",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (priority) query.set("priority", priority);
    if (overdueOnly) query.set("overdue", "true");
    if (openOnly) query.set("open", "true");
    if (dueThisWeekOnly) query.set("dueThisWeek", "true");
    const queryString = query.toString();
    setLoading(true);
    setError(false);
    fetch(`${apiBase}/api/v1/tasks${queryString ? `?${queryString}` : ""}`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Tasks unavailable.");
        return (await response.json()) as { tasks: Task[] };
      })
      .then((data) => setTasks(data.tasks))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [dueThisWeekOnly, openOnly, overdueOnly, priority, status]);

  return (
    <AppShell>
      <div className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Work queue</p>
            <h1>Tasks</h1>
            <p className="page-intro">
              See assigned work, due dates, priorities, and blocked reasons in one list.
            </p>
          </div>
          <Link className="button button-primary" href="/tasks/new">
            New task
          </Link>
        </header>
        {loading && <p role="status">Loading tasks...</p>}
        {error && <p role="alert">Task data is unavailable. Please try again.</p>}
        <section className="panel task-filters" aria-label="Task filters">
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label>
            Priority
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              <option value="">All priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(event) => setOverdueOnly(event.target.checked)}
            />
            Overdue only
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(event) => setOpenOnly(event.target.checked)}
            />
            Open only
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={dueThisWeekOnly}
              onChange={(event) => setDueThisWeekOnly(event.target.checked)}
            />
            Due this week
          </label>
        </section>
        <section className="panel" aria-label="Task list">
          {!loading && tasks.length === 0 && !error ? (
            <p>No tasks are visible yet.</p>
          ) : !loading && !error ? (
            <ul className="activity-list">
              {tasks.map((task) => (
                <li key={task.id}>
                  <span className={`status-dot status-${task.status}`} />
                  <span>
                    <Link href={`/tasks/${task.id}`}>
                      <strong>{task.title}</strong>
                    </Link>
                    <small>
                      {task.assignee.membership.user.name} ·{" "}
                      {task.status.replace("_", " ")}
                      {task.dueAt
                        ? ` · due ${new Date(task.dueAt).toLocaleDateString()}`
                        : ""}
                      {task.overdue ? " · overdue" : ""}
                    </small>
                  </span>
                  <span className={`priority priority-${task.priority}`}>
                    {task.priority}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
