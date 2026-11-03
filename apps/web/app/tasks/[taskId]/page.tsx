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
  assignee: { membership: { user: { name: string } } };
  createdBy: { membership: { user: { name: string } } };
  team: { id: string; name: string } | null;
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
  const [selectedStatus, setSelectedStatus] = useState<Task["status"]>("todo");
  const [savingStatus, setSavingStatus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${apiBase}/api/v1/tasks/${taskId}`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Task unavailable.");
        return (await response.json()) as { task: Task };
      })
      .then((data) => {
        setTask(data.task);
        setSelectedStatus(data.task.status);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
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

  async function changeStatus() {
    setSavingStatus(true);
    const response = await fetch(`${apiBase}/api/v1/tasks/${taskId}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: selectedStatus, blockedReason }),
    });
    if (!response.ok) {
      setError(true);
      setSavingStatus(false);
      return;
    }
    const data = (await response.json()) as { task: Task };
    setTask((current) => (current ? { ...current, ...data.task } : data.task));
    setBlockedReason("");
    setSavingStatus(false);
  }

  return (
    <AppShell>
      <div className="page">
        <Link href="/tasks">← Tasks</Link>
        {loading && <p role="status">Loading task...</p>}
        {error && (
          <p role="alert">
            Task data is unavailable. Please return to the task list and try again.
          </p>
        )}
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
            <section className="panel" aria-label="Task details">
              <dl className="detail-grid">
                <div>
                  <dt>Assignee</dt>
                  <dd>{task.assignee.membership.user.name}</dd>
                </div>
                <div>
                  <dt>Created by</dt>
                  <dd>{task.createdBy.membership.user.name}</dd>
                </div>
                <div>
                  <dt>Priority</dt>
                  <dd>{task.priority}</dd>
                </div>
                <div>
                  <dt>Due</dt>
                  <dd>
                    {task.dueAt ? new Date(task.dueAt).toLocaleString() : "No due date"}
                  </dd>
                </div>
                <div>
                  <dt>Team</dt>
                  <dd>{task.team?.name ?? "No team"}</dd>
                </div>
              </dl>
              {task.dueAt &&
                task.status !== "done" &&
                new Date(task.dueAt) < new Date() && (
                  <p className="callout" role="status">
                    This task is overdue.
                  </p>
                )}
            </section>
            {task.blockedReason && (
              <p className="callout" role="status">
                Blocked: {task.blockedReason}
              </p>
            )}
            <section className="panel">
              <label>
                Update status
                <select
                  value={selectedStatus}
                  onChange={(event) =>
                    setSelectedStatus(event.target.value as Task["status"])
                  }
                >
                  <option value="todo">To do</option>
                  <option value="in_progress">In progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </label>
              {selectedStatus === "blocked" && (
                <label>
                  Blocked reason
                  <input
                    value={blockedReason}
                    onChange={(event) => setBlockedReason(event.target.value)}
                    placeholder={task.blockedReason ?? "Why is this blocked?"}
                  />
                </label>
              )}
              <button
                className="button button-primary"
                type="button"
                onClick={changeStatus}
                disabled={savingStatus || selectedStatus === task.status}
              >
                {savingStatus ? "Saving..." : "Save status"}
              </button>
              <h2>Conversation</h2>
              {task.updates.length > 0 ? (
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
              ) : (
                <p>No updates yet.</p>
              )}
              <label>
                Add a comment
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />
              </label>
              <button
                className="button button-primary"
                type="button"
                onClick={addComment}
              >
                Comment
              </button>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
