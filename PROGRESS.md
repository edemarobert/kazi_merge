# Kazi Merge MVP progress

## Current task

- Milestone 3 is approved. Milestone 4 notification tasks 1-10 are implemented sequentially and under validation.
- Assignment events enqueue tenant-scoped jobs when REDIS_URL is configured; the worker owns delivery and retry handling.
- Dashboard loading, empty, and error states now have Playwright browser coverage.

## Active remediation

- [x] Issue secure session cookies from Google and passwordless sign-in.
- [x] Enforce CSRF protection and authentication rate limits.
- [x] Encrypt integration tokens at rest.
- [x] Enforce owner-only removal and sanitized teammate profiles.
- [x] Connect CSV import and dashboard UI to scoped API data.
- [x] Harden dashboard tenant isolation and replace static People, Teams, and profile views with live API data.
- [x] Update [MILESTONE_1_REVIEW.md](MILESTONE_1_REVIEW.md) with remediation
      evidence and remaining gaps.

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
- **M1 — Cross-company isolation:** **Pass.** Company-scoped query tests and
  the live PostgreSQL isolation test pass after migration and seed setup.
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
- [x] Add mentions and uploaded attachments.
- [x] Add Google Drive link attachment contracts.
- [x] Verify M4, M5, and M9 acceptance criteria.

- **Task 5 status:** Complete for the initial app conversation thread. The task detail view loads the task timeline in chronological order and presents the conversation area.
- **Task 6 status:** Complete. Comments are validated and persisted as task updates, status changes append authored status events, and both actions write append-only activity rows. Update responses and the task timeline include the author.
- **Task 6 validation:** Focused API tests pass; web/API typecheck, lint, and formatting pass. The live PostgreSQL isolation test passes after local migration and seed setup.
- **Task 6 remaining M5 work:** WhatsApp thread messages and notification delivery remain future tasks.
- **Task 7 status:** Complete. Thread comments now normalize and record @mention tokens, and the task detail composer supports validated multipart uploads up to 10 MB. Uploaded files receive generated storage keys and are linked to the creating task update and activity row.
- **Task 7 validation:** API mention and task tests pass (37 passed, 1 skipped); web/API typecheck, lint, and formatting pass. Local uploaded files are stored under the ignored `uploads/` directory or `ATTACHMENTS_DIR`; production object storage remains outside this task.
- **Task 8 status:** Complete. Drive-link requests validate an HTTPS Google Drive or Docs URL, store only the link and optional file ID as an attachment on a task update, and record a task activity row. The task detail composer can add a Drive link.
- **Task 8 validation:** API tests pass (38 passed, 1 skipped); web/API typecheck, lint, and formatting pass. Google OAuth/Drive Picker authorization and live Drive access remain part of the later Google integration milestone.
- **Task 9 status:** Complete as an acceptance review. M4 blocked-reason validation, overdue flags, task views, and status transitions pass available automated evidence. M5 app-thread comments, authored status events, mentions, uploads, and Drive-link metadata pass available automated evidence. M9 task activity rows are written for the implemented task changes.
- **Task 9 validation:** Typecheck passed; all 41 API tests passed; production build passed with existing non-blocking Next.js ESLint and autoprefixer warnings; API health returned 200; web home route returned 200. Runtime plan: `.tsupgrader/runtime-validation/eval-plan.json`.
- **Task 9 acceptance gaps:** M4 task reassignment notifications are not implemented. M5 preferred-channel delivery and WhatsApp replies are not implemented, and Drive-link rendering/opening plus live provider flows remain untested. M9 complete before/after coverage and owner activity views remain incomplete.

### Milestone 3 — Dashboard

- [x] Implement scoped workload queries.
- [x] Add open-task and overdue counts.
- [x] Add due-this-week and blocked-task views.
- [x] Add per-person workload indicators.
- [x] Calculate 30-day on-time completion rate.
- [x] Add the recent activity feed.
- [x] Link dashboard counts to filtered task lists.
- [x] Add loading, empty, and error states.
- [x] Benchmark 50 employees and 2,000 tasks.
- [x] Verify M6 acceptance criteria.
- **Task 10 status:** M6 acceptance review complete. The dashboard benchmark ran against 50 employees and 2,000 tasks with a 126.03 ms p95 API response, and dashboard counts matched the linked filtered task-list responses.
- **Task 10 validation:** Production build passed; formatting, typecheck, and format checks passed; 47 API tests and 3 Playwright dashboard tests passed. The hardening regression tests prove missing business `where` clauses receive the active company predicate and empty unique selectors are rejected.
- **Task 10 hardening follow-up:** The dashboard activity feed now has an explicit company predicate, blocked counts exclude soft-deleted tasks, the Blocked counter initializes the task status filter, and People, Teams, and employee profiles load from scoped APIs.
- **Task 10 remaining evidence gap:** An authenticated manager route/browser integration test is still needed to prove the rendered dashboard cannot expose data outside the manager's scope.

### Milestone 4 — Notification engine

- [x] Define notification events and delivery records.
- **Task 1 status:** Complete. Defined the five approved notification events/templates, four delivery channels, and queued/sent/delivered/failed delivery lifecycle in [contracts.ts](apps/api/src/notifications/contracts.ts).
- **Task 1 validation:** 49 API tests passed, including notification contract tests; web/API typecheck and formatting passed.
- **Task 1 boundary:** Notification routing, channel adapters, preferences, queues, retries, and worker delivery were implemented in Tasks 2-7.
- [x] Implement the notification router and channel preferences.
- [x] Implement the in-app notification channel and bell.
- [x] Implement email adapter and delivery handling.
- [x] Implement SMS adapter and delivery handling.
- [x] Configure Redis, BullMQ, retries, and dead-letter handling.
- [x] Move all notification sending into worker jobs.
- [x] Add due-soon, overdue, assignment, and comment jobs.
- [x] Test fallback behavior and delivery failures.
- [x] Verify the non-WhatsApp M7 acceptance criteria.
- **Milestone 4 validation:** 52 API tests pass, including tenant-scoped fallback delivery and failure recording; API and web typechecks pass. Assignment creation enqueues `task_assigned` only when `REDIS_URL` is configured, and the server starts a tenant-aware BullMQ worker with exponential retries and a dead-letter queue. WhatsApp provider integration and webhook handling remain Milestone 5 scope.

### Milestone 5 — WhatsApp

- [x] Configure WhatsApp Cloud API adapter contracts.
- [x] Implement signed webhook verification and fast acknowledgement.
- [x] Deduplicate inbound message IDs.
- [x] Implement invite-link opt-in and JOIN handling.
- [x] Add the five approved notification templates.
- [x] Handle Done, In progress, and Blocked button replies.
- [x] Handle inbound note replies in task threads.
- [x] Add WhatsApp delivery fallback to SMS or email.
- [x] Add STOP opt-out and preference updates.
- [x] Verify the WhatsApp M7 acceptance criteria.
- **Milestone 5 status:** Complete in automated validation. The Cloud API transport sends approved template payloads with quick-reply buttons, inbound webhook events are signed, acknowledged quickly, deduplicated, and mapped to scoped task updates, and failed or unavailable WhatsApp delivery falls through configured SMS/email adapters with recorded delivery failures.

### Milestone 6 — Google extras

- **Task 1 status:** Complete. Added authenticated incremental Calendar authorization with signed purpose-specific state and the narrow Calendar scope.
- **Task 1 validation:** API typecheck, formatting, and focused Google tests pass; live OAuth remains untested without provider credentials.
- **Task 2 status:** Complete. Due-dated task creation enqueues a tenant-scoped BullMQ job that creates and stores the assignee's Google Calendar event.
- **Task 2 validation:** Prisma validation, API typecheck, build, formatting, and focused Calendar tests pass; full API execution remains blocked by the local database migration/schema mismatch.
- **Task 3 status:** Complete. Due-date changes enqueue Calendar upsert/removal jobs; completion, WhatsApp completion, and soft deletion enqueue removal jobs. The worker patches/deletes events off-thread and clears stored event IDs after removal.
- **Task 3 validation:** API typecheck, build, Prisma validation, formatting, diff checks, and focused Calendar tests pass.
- **Task 4 status:** Complete. Authenticated Google Calendar disconnect is scoped to the active user and company. It revokes the token when possible, always clears the encrypted token, removes Calendar scope, and marks the account disconnected without breaking Google identity sign-in.
- **Task 4 validation:** API typecheck, formatting, diff checks, and focused Google/Calendar tests (8/8) pass. Remote revocation and database-backed route behavior remain untested locally due unavailable provider credentials and the local database migration.

- [x] Add incremental Calendar authorization.
- [x] Implement one-way task due-date Calendar sync.
- [x] Update and remove Calendar events on task changes.
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
  verification is complete.
- Node.js v24.18.1 and npm v11.16.0 are available; pnpm is not installed.
- Project build, test, lint, format, migration, and seed commands are defined.

## Assumptions

- The default stack in the specification remains the starting point.
- Milestone 0–7 means eight milestones.
- Open questions remain unresolved until the product owner answers them.

## Known gaps

- Product-owner decisions in the open-questions document are not yet confirmed.
- External provider credentials, production domains, and deployment settings are not configured.
- Database migrations are applied locally, demo data is seeded, and the web/API
  foundation plus business feature modules are under active implementation.
- The initial Next.js shell dependency was upgraded from 15.5.6 to 15.5.28
  after npm audit reported a critical advisory.
- npm audit still reports transitive postcss and sharp advisories; full
  remediation requires a breaking Next.js 16 upgrade and is outside this task.
- The Next.js build reports that the Next.js ESLint plugin is not detected in
  the flat ESLint configuration; this is a non-blocking warning to revisit
  when Next-specific lint rules are needed.
- The company-scoping guard is wired into the Prisma client and authenticated request context; missing collection filters now default to the active company and empty unique selectors are rejected.
- The role-policy module is framework-neutral and now receives actor identity
  from authenticated request context.
- Demo seed data is deterministic and idempotent; the local database is seeded.
- Prisma 6 reports that the package.json seed configuration will need to move
  to prisma.config.ts before a future Prisma 7 upgrade.
- The PWA shell still contains placeholder authenticated-user identity data; People, Teams, employee profiles, and dashboard data now load through business APIs.
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
