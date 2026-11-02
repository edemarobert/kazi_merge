# Kazi Merge MVP progress

## Current task

- Build Milestone 2: tasks, conversation, and activity.

## Active remediation

- [x] Issue secure session cookies from Google and passwordless sign-in.
- [x] Enforce CSRF protection and authentication rate limits.
- [x] Encrypt integration tokens at rest.
- [x] Enforce owner-only removal and sanitized teammate profiles.
- [x] Connect CSV import and dashboard UI to scoped API data.
- [x] Update [MILESTONE_1_REVIEW.md](MILESTONE_1_REVIEW.md) with remediation
  evidence and remaining gaps.
- [ ] Fix dashboard company lookup and run the live PostgreSQL isolation test.

## Milestones and tasks

### Milestone 0 — Foundation

- [x] Confirm repository structure and local development commands.
- [x] Create the web app and API modular-monolith shells.
- [x] Configure TypeScript, formatting, linting, and test runners.
- [x] Configure PostgreSQL, Prisma, and the initial migration.
- [x] Model the Section 5 entities and required indexes.
- [x] Add company-scoping context and query guards.
- [x] Add the shared role-policy module skeleton.
- [x] Add two-company seed data and cross-company isolation tests.
- [x] Add the PWA shell, navigation, and design tokens.

### Milestone 1 — Accounts, people, and access

- [x] Implement session and identity foundations.
- [x] Add Google sign-in adapter and flow.
- [x] Add phone OTP and email-link adapter contracts and flows.
- [x] Implement company creation and the 30-day trial.
- [x] Implement invitations and invite acceptance.
- [x] Build employee directory and profile views.
- [x] Build departments, teams, and reporting lines.
- [x] Build CSV import with preview and per-row errors.
- [x] Implement role checks across account and people routes.
- [ ] Verify M1–M3 acceptance criteria.

### M1–M3 acceptance verification

- **M1 — Google-only owner onboarding:** **Untested.** The company creation
  service and Google adapter are covered by unit tests, but no browser or live
  end-to-end sign-up flow has been executed.
- **M1 — Phone OTP sign-up:** **Pass (unit evidence).** OTP expiry, five
  attempts, cooldown, hashing, and single-use behavior pass
  `apps/api/test/passwordless.test.ts`; a live provider flow remains untested.
- **M1 — Invite acceptance activates the invited role:** **Pass (unit
  evidence).** `apps/api/test/invites.test.ts` verifies expiry and activation;
  live database verification remains unavailable.
- **M1 — Cross-company isolation:** **Pass (test-double evidence), untested
  against live PostgreSQL.** Company-scoped query tests pass, while the
  PostgreSQL isolation test is skipped without `DATABASE_URL`.
- **M2 — Import 30 employees with non-blocking row errors:** **Partial.** The
  API parser/import service and focused tests pass, but
  `apps/web/app/people/import/page.tsx` only performs a local preview and does
  not call the import API.
- **M2 — Manager changes update the org tree:** **Pass (service evidence).**
  Manager validation and organization retrieval tests pass; live browser
  refresh evidence is untested.
- **M2 — Deactivation preserves history and removes assignees:** **Fail.**
  No employee deactivation route or service exists yet.
- **M3 — Employee task visibility:** **Untested.** Policy facts support
  employee/team task scope, but task routes and route-level tests are not yet
  implemented.
- **M3 — Manager team/reporting scope:** **Partial.** Policy logic and
  dedicated manager-change checks exist, but manager-scoped organization
  filtering and complete route coverage are not yet verified.
- **M3 — Owner-only role changes, manager invites, and removals:** **Fail.**
  Role-change and employee-removal routes are not implemented.
- **M3 — Denials return 403 and create activity logs:** **Partial.** The
  global error middleware implements this behavior, but route-level denial
  tests and live database evidence are still missing.

### Milestone 2 — Tasks, conversation, and activity

- [x] Implement task creation, assignment, priorities, and due dates.
- [x] Implement task status transitions and blocked-reason validation.
- [x] Build the initial task list and task detail views.
- [x] Add status/priority filters and overdue indicators to the API/list.
- [x] Implement the task conversation thread.
- [x] Add comments, status events, and append-only activity rows.
- [ ] Add mentions and uploaded attachments.
- [ ] Add Google Drive link attachment contracts.
- [ ] Verify M4, M5, and M9 acceptance criteria.

### Milestone 2 implementation checkpoint

- **Task API:** `GET/POST /api/v1/tasks`, task detail, status transitions, and
  comments are implemented with company scoping and shared policy checks.
- **Task history:** task status changes and comments create `TaskUpdate` rows
  and append-only `ActivityLog` rows.
- **Task UI:** `/tasks`, `/tasks/new`, and `/tasks/[taskId]` are connected to
  the API with loading/error states, overdue indicators, status updates, and
  comments.
- **Validation:** API tests pass (32 passed, 1 skipped); lint, typecheck, and
  production build pass. The PostgreSQL isolation test remains skipped because
  `DATABASE_URL` is unavailable.
- **Remaining:** mentions, uploads, Drive links, notification delivery, and
  live end-to-end task acceptance tests.

### Milestone 3 — Dashboard

- [ ] Implement scoped workload queries.
- [ ] Add open-task and overdue counts.
- [ ] Add due-this-week and blocked-task views.
- [ ] Add per-person workload indicators.
- [ ] Calculate 30-day on-time completion rate.
- [ ] Add the recent activity feed.
- [ ] Link dashboard counts to filtered task lists.
- [ ] Add loading, empty, and error states.
- [ ] Benchmark 50 employees and 2,000 tasks.
- [ ] Verify M6 acceptance criteria.

### Milestone 4 — Notification engine

- [ ] Define notification events and delivery records.
- [ ] Implement the notification router and channel preferences.
- [ ] Implement the in-app notification channel and bell.
- [ ] Implement email adapter and delivery handling.
- [ ] Implement SMS adapter and delivery handling.
- [ ] Configure Redis, BullMQ, retries, and dead-letter handling.
- [ ] Move all notification sending into worker jobs.
- [ ] Add due-soon, overdue, assignment, and comment jobs.
- [ ] Test fallback behavior and delivery failures.
- [ ] Verify the non-WhatsApp M7 acceptance criteria.

### Milestone 5 — WhatsApp

- [ ] Configure WhatsApp Cloud API adapter contracts.
- [ ] Implement signed webhook verification and fast acknowledgement.
- [ ] Deduplicate inbound message IDs.
- [ ] Implement invite-link opt-in and JOIN handling.
- [ ] Add the five approved notification templates.
- [ ] Handle Done, In progress, and Blocked button replies.
- [ ] Handle inbound note replies in task threads.
- [ ] Add WhatsApp delivery fallback to SMS or email.
- [ ] Add STOP opt-out and preference updates.
- [ ] Verify the WhatsApp M7 acceptance criteria.

### Milestone 6 — Google extras

- [ ] Add incremental Calendar authorization.
- [ ] Implement one-way task due-date Calendar sync.
- [ ] Update and remove Calendar events on task changes.
- [ ] Implement secure Google disconnect and token removal.
- [ ] Integrate the narrow-scope Google Drive Picker.
- [ ] Store Drive file metadata and links only.
- [ ] Implement Google Sheets import.
- [ ] Reuse CSV preview and per-row validation for Sheets.
- [ ] Test integration-disabled behavior and narrow scopes.
- [ ] Verify M8 acceptance criteria.

### Milestone 7 — Hardening and pilot

- [ ] Run cross-company access tests against every endpoint.
- [ ] Add sign-in, OTP, and webhook rate limits.
- [ ] Complete input validation and security-header review.
- [ ] Configure daily backups and perform a restore test.
- [ ] Add error tracking and health/status checks.
- [ ] Record the required product metrics and analytics events.
- [ ] Run performance checks for dashboard and task lists.
- [ ] Complete deployment configuration and a staging deployment.
- [ ] Polish onboarding and pilot setup flows.
- [ ] Walk through every acceptance criterion on the deployed system.

## Done

- [x] Read and split the full specification into topic documents.
- [x] Create project engineering rules.
- [x] Create the milestone and task tracker.
- [x] Approve the setup and milestone breakdown.

## Decisions made

- The text in `docs/SPEC_FULL.md` is the source of truth.
- The specification is split into nine topic files without summarizing requirements.
- No application code is to be written until setup is approved.
- The product name is Kazi Merge; Kazi is the Kiswahili word for work.
- Milestone 0 was approved at 95% completion; live PostgreSQL isolation
  verification remains the deferred evidence item.
- Node.js v24.18.1 and npm v11.16.0 are available; pnpm is not installed.
- No project-defined build, test, or start commands exist yet.

## Assumptions

- The default stack in the specification remains the starting point.
- Milestone 0–7 means eight milestones.
- Open questions remain unresolved until the product owner answers them.

## Known gaps

- Product-owner decisions in the open-questions document are not yet confirmed.
- External provider credentials, production domains, and deployment settings are not configured.
- No database migrations, deployment artifacts, or business features have been
  created; the web/API foundation shells and one API health test now exist.
- The initial Next.js shell dependency was upgraded from 15.5.6 to 15.5.28
  after npm audit reported a critical advisory.
- npm audit still reports transitive postcss and sharp advisories; full
  remediation requires a breaking Next.js 16 upgrade and is outside this task.
- The Next.js build reports that the Next.js ESLint plugin is not detected in
  the flat ESLint configuration; this is a non-blocking warning to revisit
  when Next-specific lint rules are needed.
- Local PostgreSQL is not running in this environment, so the empty migration
  baseline was generated and validated but not applied to a database.
- The Section 5 migration is generated and validated, but cannot be applied
  locally until PostgreSQL connection details are available.
- The company-scoping guard is wired into the Prisma client and authenticated
  request context; business routes will be added as their modules are built.
- The role-policy module is framework-neutral and now receives actor identity
  from authenticated request context.
- Demo seed data is deterministic and idempotent, but the seed command could
  not run because PostgreSQL is not available at localhost:5432.
- Prisma 6 reports that the package.json seed configuration will need to move
  to prisma.config.ts before a future Prisma 7 upgrade.
- The PWA shell uses placeholder dashboard data and profile information until
  authentication and business routes are implemented.
- The navigation includes links to future screens; those routes are not
  implemented yet.
- Session persistence and authenticated request context are implemented, but
  provider-specific sign-in adapters and user-facing sign-in routes are not
  implemented yet.

## Open questions for the product owner

- Who owns the Meta Business account and is the WhatsApp number verified?
- Is the target company size 5–50 or 10–50 employees?
- Should an MVP task have one assignee or several?
- Is English sufficient, or is Luganda required at launch?
- What brand, logo, and final color palette should replace the placeholders?
- Will billing remain manual during the pilot?
- Where should data be hosted, and are there data-location requirements?
- Can one person belong to more than one company in the MVP?
