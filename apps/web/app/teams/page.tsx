"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "../shell";
import { translations } from "../translations";

type OrganizationMember = {
  employee: { id: string; membership: { user: { name: string } } };
};
type OrganizationTeam = {
  id: string;
  name: string;
  lead: { id: string; membership: { user: { name: string } } };
  members: OrganizationMember[];
};
type OrganizationDepartment = {
  id: string;
  name: string;
  head: { membership: { user: { name: string } } } | null;
  teams: OrganizationTeam[];
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export default function TeamsPage() {
  const [departments, setDepartments] = useState<OrganizationDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${apiBase}/api/v1/people/organization`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Organization unavailable.");
        return (await response.json()) as {
          departments: OrganizationDepartment[];
        };
      })
      .then((data) => setDepartments(data.departments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">{translations.teams.eyebrow}</p>
            <h1>{translations.teams.title}</h1>
            <p className="page-intro">{translations.teams.intro}</p>
          </div>
          <Link className="primary-button" href="/people">
            {translations.dashboard.viewPeople}
          </Link>
        </header>
        {loading && <p role="status">Loading teams...</p>}
        {error && (
          <p role="alert">Organization data is unavailable. Please try again.</p>
        )}
        {!loading && !error && (
          <section
            className="organization-tree"
            aria-label={translations.teams.departments}
          >
            {departments.map((department) => (
              <article className="organization-department panel" key={department.id}>
                <div className="organization-heading">
                  <div>
                    <p className="eyebrow">{translations.teams.departments}</p>
                    <h2>{department.name}</h2>
                  </div>
                  <span className="organization-head">
                    {department.head?.membership.user.name ??
                      translations.people.noManager}
                  </span>
                </div>
                <div className="organization-teams">
                  {department.teams.map((team) => (
                    <div className="organization-team" key={team.id}>
                      <div className="team-heading">
                        <strong>{team.name}</strong>
                        <span>
                          {team.members.length} {translations.teams.members}
                        </span>
                      </div>
                      <p className="team-lead">{team.lead.membership.user.name}</p>
                      <ul>
                        {team.members.map(({ employee }) => (
                          <li key={employee.id}>
                            <span className="avatar">
                              {initials(employee.membership.user.name)}
                            </span>
                            <span>{employee.membership.user.name}</span>
                            {employee.id !== team.lead.id && (
                              <small>
                                {translations.teams.reportsTo}{" "}
                                {team.lead.membership.user.name}
                              </small>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </article>
            ))}
            {departments.length === 0 && (
              <p className="empty-state">No departments are visible yet.</p>
            )}
          </section>
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
