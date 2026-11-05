"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "../../shell";
import { translations } from "../../translations";

type EmployeeProfile = {
  id: string;
  status: "active" | "inactive";
  jobTitle: string | null;
  startDate: string | null;
  membership: {
    user: { name: string; email: string | null; phoneE164: string | null };
  };
  department: { name: string } | null;
  manager: { membership: { user: { name: string } } } | null;
  teamMembers: { team: { name: string } }[];
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export default function EmployeeProfilePage() {
  const params = useParams<{ employeeId: string }>();
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!params.employeeId) return;
    fetch(`${apiBase}/api/v1/people/${params.employeeId}`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Profile unavailable.");
        return (await response.json()) as { employee: EmployeeProfile };
      })
      .then((data) => setProfile(data.employee))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [params.employeeId]);

  return (
    <AppShell>
      <div className="page">
        <Link className="back-link" href="/people">
          ← {translations.people.profileBack}
        </Link>
        {loading && <p role="status">Loading profile...</p>}
        {error && <p role="alert">Employee data is unavailable. Please try again.</p>}
        {!loading && !error && profile && (
          <>
            <section className="profile-header panel">
              <span className="avatar profile-avatar">
                {initials(profile.membership.user.name)}
              </span>
              <div>
                <p className="eyebrow">{profile.department?.name ?? ""}</p>
                <h1>{profile.membership.user.name}</h1>
                <p className="page-intro">{profile.jobTitle ?? ""}</p>
              </div>
              <span className={`status-pill ${profile.status}`}>
                {profile.status === "active"
                  ? translations.people.active
                  : translations.people.inactive}
              </span>
            </section>
            <div className="profile-grid">
              <section className="panel">
                <p className="eyebrow">{translations.people.profileContact}</p>
                <dl className="details-list">
                  <Detail
                    label="Phone"
                    value={profile.membership.user.phoneE164 ?? "—"}
                  />
                  <Detail label="Email" value={profile.membership.user.email ?? "—"} />
                  <Detail
                    label={translations.people.profileStartDate}
                    value={formatDate(profile.startDate)}
                  />
                  <Detail
                    label={translations.people.profileStatus}
                    value={profile.status}
                  />
                </dl>
              </section>
              <section className="panel">
                <p className="eyebrow">{translations.people.profileOrganisation}</p>
                <dl className="details-list">
                  <Detail
                    label={translations.people.profileManager}
                    value={
                      profile.manager?.membership.user.name ??
                      translations.people.noManager
                    }
                  />
                  <Detail label="Department" value={profile.department?.name ?? "—"} />
                  <Detail
                    label={translations.people.profileTeams}
                    value={
                      profile.teamMembers
                        .map((member) => member.team.name)
                        .join(", ") || translations.people.noTeams
                    }
                  />
                </dl>
              </section>
            </div>
          </>
        )}
        {!loading && !error && !profile && <p role="alert">Employee not found.</p>}
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

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
