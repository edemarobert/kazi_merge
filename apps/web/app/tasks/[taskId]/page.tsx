"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AppShell } from "../../shell";

type Update = {
  id: string;
  body: string;
  kind: "comment" | "status_change" | "system";
  createdAt: string;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high";
  blockedReason: string | null;
  dueAt: string | null;
  updates: Update[];
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  const [task, setTask] = useState<Task | null>(null);
  const [comment, setComment] = useState("");
  const [blockedReason, setBlockedReason] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${apiBase}/api/v1/tasks/${taskId}`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Task unavailable.");
        return (await response.json()) as { task: Task };
      })
      .then((data) => setTask(data.task))
      .catch(() => setError(true));
  }, [taskId]);

  async function addComment() {
    const response = await fetch(`${apiBase}/api/v1/tasks/${taskId}/comments`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: comment }),
    });
    if (!response.ok) {
      setError(true);
      return;
    }

    const data = (await response.json()) as { update: Update };
    setTask((current) =>
      current ? { ...current, updates: [...current.updates, data.update] } : current,
    );
    setComment("");
  }

  async function changeStatus(status: Task["status"]) {
    const response = await fetch(`${apiBase}/api/v1/tasks/${taskId}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, blockedReason }),
    });
    if (!response.ok) {
      setError(true);
      return;
    }
    const data = (await response.json()) as { task: Task };
    setTask((current) => (current ? { ...current, ...data.task } : data.task));
    setBlockedReason("");
  }

  return (
    <AppShell>
      <div className="page">
        <Link href="/tasks">← Tasks</Link>
        {error && <p role="alert">Task data is unavailable.</p>}
        {task && (
          <>
            <header className="page-header">
              <div>
                <p className="eyebrow">{task.priority} priority</p>
                <h1>{task.title}</h1>
                <p className="page-intro">{task.description ?? "No description."}</p>
              </div>
              <span className={`status-badge status-${task.status}`}>
                {task.status.replace("_", " ")}
              </span>
            </header>
            {task.blockedReason && (
              <p className="callout" role="status">
                Blocked: {task.blockedReason}
              </p>
            )}
            <section className="panel">
              <label>
                Update status
                <select
                  value={task.status}
                  onChange={(event) => changeStatus(event.target.value as Task["status"])}
                >
                  <option value="todo">To do</option>
                  <option value="in_progress">In progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </label>
              {task.status === "blocked" && (
                <label>
                  Blocked reason
                  <input
                    value={blockedReason}
                    onChange={(event) => setBlockedReason(event.target.value)}
                    placeholder={task.blockedReason ?? "Why is this blocked?"}
                  />
                </label>
              )}
              <h2>Conversation</h2>
              <ul className="activity-list">
                {task.updates.map((update) => (
                  <li key={update.id}>
                    <span className="activity-dot primary-dot" />
                    <span>
                      <strong>{update.kind.replace("_", " ")}</strong>
                      <small>
                        {update.body} · {new Date(update.createdAt).toLocaleString()}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
              <label>
                Add a comment
                <textarea value={comment} onChange={(event) => setComment(event.target.value)} />
              </label>
              <button className="button button-primary" type="button" onClick={addComment}>
                Comment
              </button>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
