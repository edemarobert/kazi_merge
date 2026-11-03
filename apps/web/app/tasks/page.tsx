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

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${apiBase}/api/v1/tasks`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Tasks unavailable.");
        return (await response.json()) as { tasks: Task[] };
      })
      .then((data) => setTasks(data.tasks))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

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
