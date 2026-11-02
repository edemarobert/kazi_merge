# Kazi Merge Milestone 0 Review

**Review date:** 2 November 2026
**Scope:** Milestone 0 foundation compared with `docs/spec/`
**Review type:** Audit updated after remediation
**Remediation commits:** `876275d`, `8f8d37d`

## Executive summary

Milestone 0 remediation added active tenant middleware, fail-closed Prisma
query extensions, company-aware seed selectors, relational policy evaluation,
403 error handling with denial audit logging, CI, and a translation dictionary.

The local database-backed isolation check remains unverified because PostgreSQL
is unavailable in this environment. The test is configured to run in CI
against the PostgreSQL service.

**Overall status: CONDITIONALLY PASS — live PostgreSQL verification pending**

## 1. Database query scoping

The original audit identified four unscoped seed selectors. They are now
company-scoped:

| Query | Location | Current result |
|---|---|---|
| `prisma.employee.upsert` | `prisma/seed.ts` | Fixed: uses `membershipId_companyId`. |
| `prisma.department.upsert` | `prisma/seed.ts` | Fixed: uses `id_companyId`. |
| `prisma.team.upsert` | `prisma/seed.ts` | Fixed: uses `id_companyId`. |
| `prisma.task.upsert` | `prisma/seed.ts` | Fixed: uses `id_companyId`. |

`Company` and `User` remain exempt because the specification excludes them
from the `company_id` requirement. Membership and team-member seed selectors
already used company-aware composite keys.

The Prisma extension in `apps/api/src/db/prisma.ts` now:

- applies to all business models;
- injects the active `companyId` into normal filters and writes;
- checks company IDs inside compound selectors;
- rejects cross-company overrides;
- fails closed when a business query runs without tenant context.

The existing helpers in `apps/api/src/db/company-scope.ts` remain available
for explicit scoped query construction.

## 2. Policy module status

The policy module is no longer a boolean-flag skeleton.

### Implemented

- `PolicyContext` no longer accepts `isOwnTeam`, `isOwnResource`, or
  `isOwnAccount` from callers.
- The policy service derives authorization facts from:
  - active `companyId`;
  - active actor user ID;
  - active `Membership`;
  - `Employee` ownership;
  - `TeamMember` membership;
  - task assignee and team relationships.
- Role-change and person-removal policy actions were added.
- Integration ownership is checked before the owner shortcut.
- `PolicyDeniedError` is handled by Express middleware.
- Denied actions return structured HTTP 403 responses.
- Denied actions are recorded as `authorization.denied` activity rows when an
  actor is available.

### Remaining limitations

- The API currently exposes only `/api/v1/health`, so no business route yet
  exercises the policy module.
- Separate policies for own profile, teammate basic information, sensitive
  versus non-sensitive fields, comments, task history, and notification
  ownership still need explicit route-level implementation.
- Manager task creation remains allowed without a target-team check, matching
  the current foundation policy but requiring review when task routes are
  implemented.
- Full endpoint-wide denied-request coverage cannot be verified until business
  endpoints exist.

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
| CI | PASS | `.github/workflows/ci.yml` runs PostgreSQL, migrations, seed data, formatting, lint, typecheck, and tests. |
| Section 5 Prisma model | PASS | `prisma/schema.prisma` contains the 14 specified entities. |
| `company_id` structure | PASS | Business models carry `companyId` mapped to `company_id`; `User` and `Company` are exceptions. |
| Cross-company relational constraints | PASS | Composite company-aware relations are used across business entities. |
| Task workload index | PASS | The required workload index exists. |
| Integration lookup index | PASS | The required provider/external ID index exists. |
| Company context | PASS | `AsyncLocalStorage`, `requireCompanyId`, actor context, and scoped helpers exist. |
| Active tenant middleware | PASS as foundation | `tenant-context.ts` reads `x-company-id`, accepts `x-user-id` for testing, and binds request context. |
| Prisma company scoping | PASS as foundation | `prisma.ts` extends business models and fails closed without tenant context. |
| Shared policy module | PASS as foundation | Policy facts are relationally loaded; caller-supplied scope flags were removed. |
| Policy error handling | PASS as foundation | The error middleware returns 403 and records denied actions. |
| Two-company seed definition | PASS | Two deterministic companies are declared in `apps/api/src/seed/demo-data.ts`. |
| Two companies in PostgreSQL | UNTESTED locally | PostgreSQL is unavailable at `localhost:5432`. |
| Helper-level isolation test | PASS | The test rejects an explicitly different company in an active context. |
| Database isolation test | UNTESTED locally / CI-ready | `seed-isolation.test.ts` queries both seeded tasks through the extended Prisma client when `DATABASE_URL` is configured; it skips locally without that variable. |
| Web app shell | PASS | Responsive shell and navigation are implemented. |
| Required navigation | PASS | Desktop and mobile labels match Section 7.3. |
| Installable PWA metadata | PASS | Manifest and icon endpoints are implemented. |
| Design tokens | PASS | Specified colors, radius, spacing, and typography values are present. |
| Dashboard shell | PARTIAL | Four cards, workload, activity, and trial banner exist; values remain static until dashboard routes are implemented. |
| Translation dictionary | PASS as foundation | Dashboard strings are centralized in `apps/web/app/translations.ts`. |
| Mobile-first layout | PASS structurally | Mobile breakpoint, bottom navigation, floating action, and 44px-plus targets exist. |
| Browser/device acceptance | UNTESTED | Build and HTTP smoke checks passed; no recorded desktop/mobile browser test exists. |

### Acceptance-criteria conclusion

Section 6 has no criteria specifically labeled for Milestone 0; its first
criteria belong to M1. The implementation satisfies the Milestone 0
foundation requirements in code and CI configuration. The only outstanding
evidence item is execution against a live PostgreSQL instance.

## 4. Code not specified by the specification

These items remain additions, placeholders, or deviations from the written
specification:

1. **Static dashboard data**
   `apps/web/app/page.tsx` still hardcodes the greeting, trial days, metrics,
   workload rows, and activity entries.

2. **Links to unimplemented routes**
   The shell links to `/tasks`, `/people`, `/teams`, `/settings`, `/activity`,
   and `/tasks/new`, but only the home page exists.

3. **Ungated floating action**
   `+ New task` is shown to every visitor, although the specification limits
   the action to owners and managers.

4. **Non-functional profile button**
   The profile button has no menu or behavior.

5. **No business routes yet**
   The API currently exposes only `/api/v1/health`; authentication, people,
   task, and dashboard routes belong to later milestones.

6. **Testing tenant headers**
   `x-company-id` and `x-user-id` are intentionally supported as a temporary
   testing/request-context mechanism until session authentication is built.

7. **Additional implementation structures**
   The code adds branded `CompanyId`, `CompanyScopeViolation`, supporting
   indexes and composite uniqueness constraints, a health endpoint, npm
   convenience scripts, and a generated SVG icon. These are not explicitly
   named in the specification but generally support its requirements.

## Recommended disposition

Milestone 0 can proceed as **conditionally complete**. The remaining
verification step is to run migrations, seed the two companies, and execute
the database isolation test with PostgreSQL available. CI is configured to
perform that verification automatically.

Do not treat Milestone 1 access acceptance criteria as complete yet. Business
routes still need to use the tenant middleware, Prisma client, shared policy
module, and denial logging.
