"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "../../shell";

type Employee = {
  id: string;
  membership: { user: { name: string } };
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export default function NewTaskPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeEmployeeId, setAssigneeEmployeeId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${apiBase}/api/v1/people`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("People unavailable.");
        return (await response.json()) as { employees: Employee[] };
      })
      .then((data) => {
        setEmployees(data.employees);
        if (data.employees[0]) setAssigneeEmployeeId(data.employees[0].id);
      })
      .catch(() => setError("People data is unavailable."));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/v1/tasks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          assigneeEmployeeId,
          priority,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "Task could not be created.");
      }
      window.location.href = "/tasks";
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Task could not be created.",
      );
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="page">
        <Link href="/tasks">← Tasks</Link>
        <header className="page-header">
          <div>
            <p className="eyebrow">Task setup</p>
            <h1>New task</h1>
            <p className="page-intro">
              Create focused work with an owner, priority, and due date.
            </p>
          </div>
        </header>
        <form className="panel form-stack" onSubmit={submit}>
          {error && <p role="alert">{error}</p>}
          <label>
            Title
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label>
            Assignee
            <select
              required
              value={assigneeEmployeeId}
              onChange={(event) => setAssigneeEmployeeId(event.target.value)}
            >
              <option value="" disabled>
                Select a person
              </option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.membership.user.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>
            Due date and time
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </label>
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create task"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
