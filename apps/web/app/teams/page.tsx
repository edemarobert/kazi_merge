import Link from "next/link";
import { AppShell } from "../shell";
import { translations } from "../translations";

const departments = [
  {
    name: "Operations",
    head: "Amina Nakato",
    teams: [
      {
        name: "Operations",
        lead: "Brian Kato",
        members: ["Brian Kato", "Peter Okello"],
      },
    ],
  },
  {
    name: "Customer success",
    head: "Grace Atim",
    teams: [{ name: "Customer success", lead: "Grace Atim", members: ["Grace Atim"] }],
  },
  {
    name: "Finance",
    head: "Sarah Namukasa",
    teams: [{ name: "Finance", lead: "Sarah Namukasa", members: ["Sarah Namukasa"] }],
  },
] as const;

export default function TeamsPage() {
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
        <section
          className="organization-tree"
          aria-label={translations.teams.departments}
        >
          {departments.map((department) => (
            <article className="organization-department panel" key={department.name}>
              <div className="organization-heading">
                <div>
                  <p className="eyebrow">{translations.teams.departments}</p>
                  <h2>{department.name}</h2>
                </div>
                <span className="organization-head">{department.head}</span>
              </div>
              <div className="organization-teams">
                {department.teams.map((team) => (
                  <div className="organization-team" key={team.name}>
                    <div className="team-heading">
                      <strong>{team.name}</strong>
                      <span>
                        {team.members.length} {translations.teams.members}
                      </span>
                    </div>
                    <p className="team-lead">{team.lead}</p>
                    <ul>
                      {team.members.map((member) => (
                        <li key={member}>
                          <span className="avatar">{initials(member)}</span>
                          <span>{member}</span>
                          {member !== team.lead && (
                            <small>
                              {translations.teams.reportsTo} {team.lead}
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
        </section>
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
