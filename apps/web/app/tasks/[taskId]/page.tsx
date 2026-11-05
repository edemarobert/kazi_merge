"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AppShell } from "../../shell";

type Update = {
  id: string;
  body: string;
  kind: "comment" | "status_change" | "system";
  createdAt: string;
  author: { membership: { user: { name: string } } };
  attachments?: { id: string; name: string; mimeType: string | null }[];
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

type PickerDocument = {
  id?: string;
  name?: string;
  url?: string;
  mimeType?: string;
};

type PickerData = {
  action?: string;
  docs?: PickerDocument[];
};

type PickerView = {
  setMimeTypes(mimeTypes: string): PickerView;
};

type PickerBuilder = {
  setDeveloperKey(key: string): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  addView(view: PickerView): PickerBuilder;
  setCallback(callback: (data: PickerData) => void): PickerBuilder;
  build(): { setVisible(visible: boolean): void };
};

type GooglePickerNamespace = {
  Action: { PICKED: string };
  DocsView: new () => PickerView;
  PickerBuilder: new () => PickerBuilder;
};

declare global {
  interface Window {
    gapi?: {
      load(name: string, options: { callback: () => void }): void;
    };
    google?: {
      picker?: GooglePickerNamespace;
    };
  }
}
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  const [task, setTask] = useState<Task | null>(null);
  const [comment, setComment] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [driveName, setDriveName] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [driveFileId, setDriveFileId] = useState("");
  const [driveMimeType, setDriveMimeType] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
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

  async function addAttachment() {
    if (!attachment) return;
    const formData = new FormData();
    formData.set("body", comment);
    formData.set("file", attachment);
    const response = await fetch(
      `${apiBase}/api/v1/tasks/${taskId}/comments/attachments`,
      {
        method: "POST",
        credentials: "include",
        body: formData,
      },
    );
    if (!response.ok) {
      setError(true);
      return;
    }
    const data = (await response.json()) as { update: Update };
    setTask((current) =>
      current ? { ...current, updates: [...current.updates, data.update] } : current,
    );
    setComment("");
    setAttachment(null);
  }
  async function chooseDriveFile() {
    setPickerLoading(true);
    setError(false);
    const response = await fetch(apiBase + "/api/v1/integrations/google/drive/token", {
      credentials: "include",
    });
    if (!response.ok) {
      setPickerLoading(false);
      setError(true);
      return;
    }
    const pickerConfig = (await response.json()) as {
      accessToken: string;
      developerKey: string;
    };

    const openPicker = () => {
      const picker = window.google?.picker;
      if (!picker) {
        setPickerLoading(false);
        setError(true);
        return;
      }
      const view = new picker.DocsView().setMimeTypes(
        "application/vnd.google-apps.document,application/vnd.google-apps.spreadsheet,application/vnd.google-apps.presentation,application/pdf",
      );
      new picker.PickerBuilder()
        .setDeveloperKey(pickerConfig.developerKey)
        .setOAuthToken(pickerConfig.accessToken)
        .addView(view)
        .setCallback((data) => {
          if (data.action === picker.Action.PICKED && data.docs?.[0]) {
            const file = data.docs[0];
            setDriveFileId(file.id ?? "");
            setDriveMimeType(file.mimeType ?? "");
            setDriveName(file.name ?? "");
            setDriveUrl(file.url ?? "");
          }
          setPickerLoading(false);
        })
        .build()
        .setVisible(true);
    };

    if (window.google?.picker) {
      openPicker();
      return;
    }

    const existingScript = document.getElementById("google-picker-script");
    if (existingScript) {
      window.gapi?.load("picker", { callback: openPicker });
      return;
    }

    const script = document.createElement("script");
    script.id = "google-picker-script";
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = () => window.gapi?.load("picker", { callback: openPicker });
    script.onerror = () => {
      setPickerLoading(false);
      setError(true);
    };
    document.body.appendChild(script);
  }
  async function addDriveLink() {
    const response = await fetch(
      `${apiBase}/api/v1/tasks/${taskId}/comments/drive-links`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: driveName,
          url: driveUrl,
          driveFileId,
          mimeType: driveMimeType,
        }),
      },
    );
    if (!response.ok) {
      setError(true);
      return;
    }
    const data = (await response.json()) as { update: Update };
    setTask((current) =>
      current ? { ...current, updates: [...current.updates, data.update] } : current,
    );
    setDriveName("");
    setDriveUrl("");
    setDriveFileId("");
    setDriveMimeType("");
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
    const data = (await response.json()) as { task: Task; update: Update };
    setTask((current) =>
      current
        ? { ...current, ...data.task, updates: [...current.updates, data.update] }
        : data.task,
    );
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
                          {update.body} · {update.author.membership.user.name} ·{" "}
                          {new Date(update.createdAt).toLocaleString()}
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
              <label>
                Attach a file
                <input
                  type="file"
                  onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                />
              </label>
              <button
                className="button button-secondary"
                type="button"
                onClick={addAttachment}
                disabled={!attachment}
              >
                Upload attachment
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={chooseDriveFile}
                disabled={pickerLoading}
              >
                {pickerLoading ? "Opening Drive..." : "Choose from Google Drive"}
              </button>{" "}
              <label>
                Drive file name
                <input
                  value={driveName}
                  onChange={(event) => setDriveName(event.target.value)}
                />
              </label>
              <label>
                Google Drive link
                <input
                  type="url"
                  value={driveUrl}
                  onChange={(event) => setDriveUrl(event.target.value)}
                  placeholder="https://drive.google.com/..."
                />
              </label>
              <button
                className="button button-secondary"
                type="button"
                onClick={addDriveLink}
                disabled={!driveName || !driveUrl}
              >
                Add Drive link
              </button>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
