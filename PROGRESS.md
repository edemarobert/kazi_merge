# Kazi Merge MVP progress

## Current task

- [ ] Add the shared role-policy module skeleton.

## Milestones and tasks

### Milestone 0 — Foundation

- [x] Confirm repository structure and local development commands.
- [x] Create the web app and API modular-monolith shells.
- [x] Configure TypeScript, formatting, linting, and test runners.
- [x] Configure PostgreSQL, Prisma, and the initial migration.
- [x] Model the Section 5 entities and required indexes.
- [x] Add company-scoping context and query guards.
- [ ] Add the shared role-policy module skeleton.
- [ ] Add two-company seed data and cross-company isolation tests.
- [ ] Add the PWA shell, navigation, and design tokens.

### Milestone 1 — Accounts, people, and access

- [ ] Implement session and identity foundations.
- [ ] Add Google sign-in adapter and flow.
- [ ] Add phone OTP and email-link adapter contracts and flows.
- [ ] Implement company creation and the 30-day trial.
- [ ] Implement invitations and invite acceptance.
- [ ] Build employee directory and profile views.
- [ ] Build departments, teams, and reporting lines.
- [ ] Build CSV import with preview and per-row errors.
- [ ] Implement role checks across account and people routes.
- [ ] Verify M1–M3 acceptance criteria.

### Milestone 2 — Tasks, conversation, and activity

- [ ] Implement task creation, assignment, priorities, and due dates.
- [ ] Implement task status transitions and blocked-reason validation.
- [ ] Build My Tasks, Team Tasks, and All Tasks views.
- [ ] Add task filters and overdue indicators.
- [ ] Implement the task conversation thread.
- [ ] Add comments, status events, and system events.
- [ ] Add mentions and uploaded attachments.
- [ ] Add Google Drive link attachment contracts.
- [ ] Implement append-only activity logging and task history.
- [ ] Verify M4, M5, and M9 acceptance criteria.

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
- The repository is documentation-only at the start of Milestone 0.
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
- The company-scoping guard is currently a reusable API helper; route and
  Prisma-client wiring will be added as business modules are implemented.

## Open questions for the product owner

- Who owns the Meta Business account and is the WhatsApp number verified?
- Is the target company size 5–50 or 10–50 employees?
- Should an MVP task have one assignee or several?
- Is English sufficient, or is Luganda required at launch?
- What brand, logo, and final color palette should replace the placeholders?
- Will billing remain manual during the pilot?
- Where should data be hosted, and are there data-location requirements?
- Can one person belong to more than one company in the MVP?
