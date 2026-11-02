import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "../../shell";
import { translations } from "../../translations";

const profiles = {
  "brian-kato": {
    name: "Brian Kato",
    initials: "BK",
    title: "Operations lead",
    department: "Operations",
    manager: "Amina Nakato",
    teams: ["Operations"],
    phone: "+256 700 000 001",
    email: "brian@example.com",
    startDate: "12 March 2025",
    status: "Active",
  },
  "grace-atim": {
    name: "Grace Atim",
    initials: "GA",
    title: "Client success manager",
    department: "Customer success",
    manager: "Amina Nakato",
    teams: ["Customer success"],
    phone: "+256 700 000 002",
    email: "grace@example.com",
    startDate: "4 June 2025",
    status: "Active",
  },
  "peter-okello": {
    name: "Peter Okello",
    initials: "PO",
    title: "Stock coordinator",
    department: "Operations",
    manager: "Brian Kato",
    teams: ["Operations"],
    phone: "+256 700 000 003",
    email: "peter@example.com",
    startDate: "19 August 2025",
    status: "Active",
  },
  "sarah-namukasa": {
    name: "Sarah Namukasa",
    initials: "SN",
    title: "Finance assistant",
    department: "Finance",
    manager: "",
    teams: ["Finance"],
    phone: "+256 700 000 004",
    email: "sarah@example.com",
    startDate: "10 January 2025",
    status: "Inactive",
  },
} as const;

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const profile = profiles[employeeId as keyof typeof profiles];
  if (!profile) notFound();

  return (
    <AppShell>
      <div className="page">
        <Link className="back-link" href="/people">
          ← {translations.people.profileBack}
        </Link>
        <section className="profile-header panel">
          <span className="avatar profile-avatar">{profile.initials}</span>
          <div>
            <p className="eyebrow">{profile.department}</p>
            <h1>{profile.name}</h1>
            <p className="page-intro">{profile.title}</p>
          </div>
          <span className={`status-pill ${profile.status.toLowerCase()}`}>
            {profile.status}
          </span>
        </section>
        <div className="profile-grid">
          <section className="panel">
            <p className="eyebrow">{translations.people.profileContact}</p>
            <dl className="details-list">
              <Detail label="Phone" value={profile.phone} />
              <Detail label="Email" value={profile.email} />
              <Detail
                label={translations.people.profileStartDate}
                value={profile.startDate}
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
                value={profile.manager || translations.people.noManager}
              />
              <Detail label="Department" value={profile.department} />
              <Detail
                label={translations.people.profileTeams}
                value={profile.teams.join(", ") || translations.people.noTeams}
              />
            </dl>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
