# Kazi Merge Milestone 0 Review

**Review date:** 2 November 2026  
**Scope:** Milestone 0 foundation compared with `docs/spec/`  
**Review type:** Read-only audit; no application fixes were made

## Executive summary

Milestone 0 is substantially implemented, but it does not yet fully pass the
specification. The repository has the web/API shells, Prisma model, company
context helpers, policy module, seed definitions, tests, PWA shell, and design
tokens. The explicit isolation result is only proven at the helper/unit-test
level: the seed was not verified against a running PostgreSQL database, no
business routes exist, and four seed upserts use unscoped selectors.

**Overall status: FAIL / incomplete**

## 1. Database queries not scoped by `company_id`

The application has no business-data API queries yet. The direct Prisma
queries are in `prisma/seed.ts`.

| Query | Location | Finding |
|---|---|---|
| `prisma.employee.upsert` | `prisma/seed.ts:51` | Selector uses `membershipId` only; it does not include `companyId`. |
| `prisma.department.upsert` | `prisma/seed.ts:66` | Selector uses `id` only; it does not include `companyId`. |
| `prisma.team.upsert` | `prisma/seed.ts:76` | Selector uses `id` only; it does not include `companyId`. |
| `prisma.task.upsert` | `prisma/seed.ts:102` | Selector uses `id` only; it does not include `companyId`. |

These are seed-time writes rather than request-time reads, but they still
violate the project-wide rule that business-owned data access is scoped by
company.

The following queries are either explicitly exempt or already use scoped
selectors:

- `Company` upsert: `Company` is exempt from carrying `company_id`.
- `User` upsert: `User` is exempt from carrying `company_id`.
- `Membership` upsert: uses `companyId_userId`.
- `TeamMember` upsert: uses `companyId_teamId_employeeId`.

The reusable helpers in
`apps/api/src/db/company-scope.ts` add or validate `companyId`, but they are
not wired into a Prisma client or API route.

## 2. Policy module skeleton areas

The policy module exists and has tests, but it is not yet a complete,
route-enforced authorization system.

### Missing or incomplete policy coverage

The `PolicyAction` union does not separately represent all permissions in
Section 8, including:

- changing roles;
- removing people;
- viewing the employee's own profile versus all profiles;
- viewing teammates' basic information;
- editing sensitive versus non-sensitive employee fields;
- changing trial/plan separately from general company settings;
- commenting separately from task status updates;
- task-history scope;
- explicit notification ownership checks.

### Caller-supplied scope flags

`PolicyContext` accepts `isOwnTeam`, `isOwnResource`, and `isOwnAccount` as
plain booleans. The module does not independently verify:

- that the target belongs to the active company;
- that the user belongs to the target team;
- that the target resource belongs to the user;
- that an integration account belongs to the authenticated user;
- that membership is active rather than invited or suspended;
- that a manager has the required reporting-line scope.

### No route integration

The only API route is `/api/v1/health`. No business route calls `can` or
`requirePolicy`, so the shared policy module is not yet used by every API
route.

### No HTTP denial handling

`PolicyDeniedError` exists, but Express error middleware does not convert it
to the required HTTP 403 response. There is also no authentication or request
context from which to derive policy scope.

### No denied-request activity logging

Denied requests are not written to `ActivityLog`, despite the M3 requirement
that every denied request return 403 and be recorded.

### Rule mismatches

- Owners receive every declared action unconditionally, including integration
  access without an account-ownership check.
- Managers can create tasks without a scope check.
- Managers can view the dashboard without the module calculating or verifying
  their actual scope.
- Employee task-creation semantics depend on the caller's interpretation of
  `isOwnResource`.
- Employee activity access uses a generic resource flag rather than an
  explicit task-history rule.
- Sensitive and non-sensitive employee fields are not distinguished.

## 3. Milestone 0 review

Milestone 0 is defined in `docs/spec/08-milestones.md` as:

> Repo, stack, CI, Prisma schema for Section 5, company-scoping middleware,
> policy module, seed data, app shell with design tokens.

Its completion criterion is:

> Two seeded companies exist and a test proves they cannot see each other's
> data.

| Area | Result | Evidence |
|---|---|---|
| Repository foundation | PASS | npm workspaces, web shell, API shell, and scripts exist. |
| Default stack | PARTIAL | Next.js, React, TypeScript, Express, Prisma, and PostgreSQL exist; Tailwind CSS is absent. |
| CI | FAIL | No GitHub Actions or other CI workflow was found. |
| Section 5 Prisma model | PASS | `prisma/schema.prisma` contains the 14 specified entities. |
| `company_id` structure | PASS | Business models carry `companyId` mapped to `company_id`; `User` and `Company` are exceptions. |
| Cross-company relational constraints | PASS | Composite company-aware relations are used across business entities. |
| Task workload index | PASS | `@@index([companyId, assigneeEmployeeId, status, dueAt])` exists. |
| Integration lookup index | PASS | `@@index([provider, externalId])` exists. |
| Company context | PASS as helper | `AsyncLocalStorage`, `requireCompanyId`, and scoped helpers exist. |
| Company-scoping middleware | FAIL | No Express middleware establishes company context from an authenticated request. |
| Prisma company scoping | FAIL | Helpers are not wired into Prisma; four seed selectors are unscoped. |
| Shared policy module | PARTIAL | Typed role checks and tests exist, but coverage is incomplete and routes do not use it. |
| Two-company seed definition | PASS | Two deterministic companies are declared in `apps/api/src/seed/demo-data.ts`. |
| Two companies in PostgreSQL | UNTESTED | PostgreSQL was unavailable during the previous seed attempt. |
| Helper-level isolation test | PASS | The test rejects an explicitly different company in an active context. |
| Database/API isolation test | UNTESTED | No business API routes exist and the test does not use a real database. |
| Web app shell | PASS | Responsive shell and navigation are implemented. |
| Required navigation | PASS | Desktop and mobile labels match Section 7.3. |
| Installable PWA metadata | PASS | Manifest and icon endpoints are implemented. |
| Design tokens | PASS | Specified colors, radius, spacing, and typography values are present. |
| Dashboard shell | PARTIAL | Four cards, workload, activity, and trial banner exist, but values are static. |
| Mobile-first layout | PASS structurally | Mobile breakpoint, bottom navigation, floating action, and 44px-plus targets exist. |
| Browser/device acceptance | UNTESTED | Build and HTTP smoke checks passed; no recorded desktop/mobile browser test exists. |

### Acceptance-criteria conclusion

Section 6 has no criteria specifically labeled for Milestone 0; its first
criteria belong to M1. The Milestone 0 completion criterion is therefore not
fully demonstrated. The current evidence proves helper-level isolation, not
that two real seeded companies can be isolated through the database and API.

## 4. Code not specified by the specification

These items are additions, placeholders, or deviations from the written
specification:

1. **Static dashboard data**  
   `apps/web/app/page.tsx` hardcodes the greeting, trial days, metrics,
   workload rows, and activity entries.

2. **Links to unimplemented routes**  
   The shell links to `/tasks`, `/people`, `/teams`, `/settings`, `/activity`,
   and `/tasks/new`, but only the home page exists.

3. **Ungated floating action**  
   `+ New task` is shown to every visitor, although the specification limits
   the action to owners and managers.

4. **Non-functional profile button**  
   The profile button has no menu or behavior.

5. **Non-interactive dashboard cards**  
   The metric cards do not open filtered task lists as required by the
   dashboard specification.

6. **Inline UI strings**  
   UI text is embedded in TSX files rather than stored in a translation file,
   contrary to the language/localization convention in Section 7.1.

7. **Notification preference defaults**  
   `NotificationPreference` defaults WhatsApp, SMS, and email all to `true`;
   the specification says WhatsApp should be on only after opt-in, otherwise
   SMS or email should be used.

8. **Missing explicit WhatsApp opt-in state**  
   There is no explicit opt-in timestamp or STOP opt-out state in the schema.

9. **No append-only enforcement**  
   `TaskUpdate` and `ActivityLog` are modeled, but no database or API guard
   prevents updates or deletes.

10. **Additional implementation structures**  
    The code adds branded `CompanyId`, `CompanyScopeViolation`, supporting
    indexes and composite uniqueness constraints, a health endpoint, npm
    convenience scripts, and a generated SVG icon. These are not explicitly
    named in the specification but generally support its requirements.

## Recommended disposition

Do not mark Milestone 0 fully passed yet. Before proceeding as if the
milestone is complete, the project should at minimum verify real two-company
database/API isolation, wire company context into request handling and data
access, resolve the unscoped seed selectors, and add the specified CI
foundation. Policy route integration and complete denial logging should be
treated as required follow-up work before M3 is considered complete.
