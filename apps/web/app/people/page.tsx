"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "../shell";
import { translations } from "../translations";

const employees = [
  {
    id: "brian-kato",
    name: "Brian Kato",
    initials: "BK",
    title: "Operations lead",
    team: "Operations",
    status: "active",
  },
  {
    id: "grace-atim",
    name: "Grace Atim",
    initials: "GA",
    title: "Client success manager",
    team: "Customer success",
    status: "active",
  },
  {
    id: "peter-okello",
    name: "Peter Okello",
    initials: "PO",
    title: "Stock coordinator",
    team: "Operations",
    status: "active",
  },
  {
    id: "sarah-namukasa",
    name: "Sarah Namukasa",
    initials: "SN",
    title: "Finance assistant",
    team: "Finance",
    status: "inactive",
  },
] as const;

export default function PeoplePage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        const matchesSearch = `${employee.name} ${employee.title}`
          .toLowerCase()
          .includes(search.toLowerCase());
        return matchesSearch && (status === "all" || employee.status === status);
      }),
    [search, status],
  );

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
              <span className="avatar large">{employee.initials}</span>
              <span className="person-card-copy">
                <strong>{employee.name}</strong>
                <span>{employee.title}</span>
                <small>{employee.team}</small>
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
      </div>
    </AppShell>
  );
}
