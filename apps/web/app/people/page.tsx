"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../shell";
import { translations } from "../translations";

type Employee = {
  id: string;
  status: "active" | "inactive";
  jobTitle: string | null;
  startDate: string | null;
  membership: { user: { name: string; email: string | null } };
  department: { name: string } | null;
  teamMembers: { team: { name: string } }[];
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export default function PeoplePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams();
    if (status !== "all") query.set("status", status);
    if (search.trim()) query.set("search", search.trim());
    setLoading(true);
    setError(false);
    fetch(`${apiBase}/api/v1/people${query.toString() ? `?${query}` : ""}`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("People unavailable.");
        return (await response.json()) as { employees: Employee[] };
      })
      .then((data) => setEmployees(data.employees))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [search, status]);

  const filteredEmployees = useMemo(() => employees, [employees]);

  return (
    <AppShell>
      <div className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">{translations.people.eyebrow}</p>
            <h1>{translations.people.title}</h1>
            <p className="page-intro">{translations.people.intro}</p>
          </div>
          <Link className="primary-button" href="/people/invite">
            {translations.people.invite}
          </Link>
        </header>

        <section className="directory-toolbar" aria-label="People filters">
          <label className="search-field">
            <span className="sr-only">{translations.people.searchPlaceholder}</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={translations.people.searchPlaceholder}
              type="search"
            />
          </label>
          <label className="filter-field">
            <span>{translations.people.statusLabel}</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">{translations.people.allStatuses}</option>
              <option value="active">{translations.people.active}</option>
              <option value="inactive">{translations.people.inactive}</option>
            </select>
          </label>
        </section>

        {loading && <p role="status">Loading people...</p>}
        {error && <p role="alert">People data is unavailable. Please try again.</p>}
        {!loading && !error && (
          <>
            <p className="directory-count">
              {filteredEmployees.length} {translations.people.peopleCount}
            </p>
            <section className="people-grid" aria-label={translations.people.title}>
              {filteredEmployees.map((employee) => (
                <Link
                  className="person-card"
                  href={`/people/${employee.id}`}
                  key={employee.id}
                >
                  <span className="avatar large">
                    {initials(employee.membership.user.name)}
                  </span>
                  <span className="person-card-copy">
                    <strong>{employee.membership.user.name}</strong>
                    <span>{employee.jobTitle ?? ""}</span>
                    <small>
                      {employee.teamMembers
                        .map((member) => member.team.name)
                        .join(", ")}
                    </small>
                  </span>
                  <span className={`status-pill ${employee.status}`}>
                    {employee.status === "active"
                      ? translations.people.active
                      : translations.people.inactive}
                  </span>
                </Link>
              ))}
              {filteredEmployees.length === 0 && (
                <p className="empty-state">{translations.people.noResults}</p>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}
