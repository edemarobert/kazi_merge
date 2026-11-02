# Kazi Merge – MVP Build Specification

Nov 2, 2026 · @Edema Robert

## 1. How to use this document

Give this whole document to your LLM coding assistant as the single source of truth, then build one milestone at a time (Section 9) and check each against its acceptance criteria (Section 6) before moving on.

**Rules for the LLM building this system**

1. Build only what Section 2 marks as MVP. Anything marked Later is out of scope, even if it looks easy.
2. Work milestone by milestone. Do not start the next milestone until the current one's acceptance criteria pass.
3. Multi-tenancy is mandatory: every business-owned table carries `company_id`, and every query is scoped by it.
4. Every external service (Google, WhatsApp, SMS, email) sits behind an adapter interface. The core product must still work with all integrations switched off.
5. Mobile-first and low-bandwidth: design for a mid-range Android phone on an unstable connection before desktop.
6. When this document is silent or lists an open question (Section 10), ask the product owner instead of guessing.
7. The text specifications are authoritative. The wireframes in Section 7 illustrate them; if they ever disagree, follow the text.

**Default technical stack** (assumption, based on tools the product owner already works with; change it if you have a good reason and say why)

| Layer | Choice | Why |
| --- | --- | --- |
| Web app | Next.js (React, TypeScript) + Tailwind CSS, installable as a PWA | One codebase for desktop and phone, no app-store step for early customers |
| API | Node.js, Express, TypeScript, organised as a modular monolith | Simple to build and deploy; modules can be split later |
| Database | PostgreSQL (Supabase) with Prisma | Relational data fits employees, teams and tasks; Supabase also gives storage and realtime |
| Background jobs | Redis + BullMQ | Reminders, notification sending and webhook processing |
| SMS and OTP fallback | Africa's Talking | Reaches users who are not on WhatsApp or Google |
| Hosting | Railway | Already familiar; cheap for an MVP |
| Payments | Not in MVP (trial plus manual invoicing). Later: MTN MoMo and Airtel Money via Flutterwave | Keeps the MVP focused on the core workflow |

## 2. Product overview and MVP scope

Kazi Merge is a simple work operating system for growing Kampala businesses with 5 to 50 employees. It puts employees, teams, tasks and work conversations in one place, and meets people inside the tools they already use (Google and WhatsApp) instead of asking them to learn a new one.

**The problem.** Employee information sits in spreadsheets and paper, work is assigned in WhatsApp, and managers spend their day chasing updates. Nobody can easily answer who is working on what, what is late, and why.

**Who uses it**

| Role | Who they are | What they need from the MVP |
| --- | --- | --- |
| Owner | Founder or business owner | See the whole business at a glance; control who sees what |
| Manager | Team or operations lead | Assign work, follow progress, see each person's workload |
| Employee | Staff member, often phone-only | Know what is assigned, update progress in seconds, ask questions in context |

**The core idea.** Every piece of work is one connected chain: Task, Employee, Conversation, Progress, Completion. This chain is the product's differentiator and must never be broken into separate screens.

**Integration principle (from mentor review).** Users should not have to change their habits. Google handles sign-in, calendars and files. WhatsApp handles notifications and quick replies. Kazi Merge stores the single record of truth behind both.

**MVP scope**

| Area | In the MVP | Later |
| --- | --- | --- |
| Accounts | Company sign-up, sign-in with Google, phone or email, invites | SSO, multiple companies per user |
| People | Employee profiles, departments and teams, reporting lines, bulk import from CSV or Google Sheets | Documents vault, onboarding checklists |
| Access | Owner, Manager and Employee roles with team-scoped visibility | Custom roles |
| Work | Tasks, due dates, priority, status, task conversation thread, attachments (upload or Google Drive link) | Dependencies, recurring tasks, subtasks |
| Visibility | Manager workload dashboard, overdue and blocked views, activity log | AI performance insights, reports export |
| Google | Sign-in, Calendar sync of due dates, Drive file picker | Gmail digest, Workspace directory sync |
| WhatsApp | Task notifications, reply with buttons or a note to update a task, owner daily digest | Task creation by chat message (AI), group support |
| Notifications | In-app, WhatsApp, SMS and email fallback | Push notifications |
| Commercial | 30-day free trial, plan flag per company | Billing with MTN MoMo and Airtel Money |

**Explicit non-goals for the MVP:** payroll, tax, recruitment, attendance, leave, performance review scores, a general-purpose AI chatbot, and native mobile apps.

## 3. Integration strategy: Google and WhatsApp

Google and WhatsApp are where Kampala teams already work, so Kazi Merge treats them as front doors, not extras: an employee should be able to join, receive work, update it and finish it without ever opening the Kazi Merge website. The web app remains the full workspace for owners and managers.

### 3.1 What each integration does

| Integration | MVP capability | Direction | User friction removed |
| --- | --- | --- | --- |
| Google Sign-In | Create account and sign in with a Google account (OpenID Connect) | Google to Kazi Merge | No new password |
| Google Calendar | Task due dates appear as calendar events for the assignee, updated when the task changes | Kazi Merge to Google | Deadlines show up in the calendar people already check |
| Google Drive | Attach existing Drive files to a task through the Google Picker; store the link, not a copy | Google to Kazi Merge | No re-uploading, one version of each file |
| Google Sheets / CSV | Import employees from a Google Sheet or CSV | Google to Kazi Merge | Moves off the spreadsheet in minutes |
| WhatsApp notifications | Employee gets a WhatsApp message when a task is assigned, due soon, overdue or commented on | Kazi Merge to WhatsApp | Updates arrive where people already look |
| WhatsApp replies | Employee taps a button (Done, In progress, Blocked) or replies with a note; the task and its thread update | WhatsApp to Kazi Merge | Update work in seconds without logging in |
| WhatsApp owner digest | Owner receives a short daily summary: overdue, due today, completed | Kazi Merge to WhatsApp | Visibility without opening a dashboard |
| Phone OTP and SMS | Sign in with a phone number; SMS fallback for people not on WhatsApp | Both | Works for users without Google or smartphones |

Stretch goal after the MVP is stable: a manager sends a WhatsApp message such as "Assign John the customer report by Friday", an LLM drafts the task, and the manager confirms with a button. This is not required for MVP.

### 3.2 Google rules

- Sign-in uses only the `openid`, `email` and `profile` scopes.
- Calendar sync is optional and requested later, only when the user turns it on (incremental authorisation), using the `calendar.events` scope.
- Drive uses the Google Picker with the narrow `drive.file` scope, so Kazi Merge can only touch files the user explicitly picks. Never request full Drive access.
- Store only the Drive file id, name, URL and MIME type.
- Calendar sync is one-way. Deleting an event in Google does not change the task; completing a task removes or marks its event.
- Plan for Google's OAuth app verification early. Sensitive scopes need it before public launch. While the app is in testing mode, up to 100 named test users can use it, which is enough for the first pilot companies.
- CSV import is the primary employee import. Google Sheets import is a convenience on top.

### 3.3 WhatsApp rules

Use the WhatsApp Business Platform (Cloud API from Meta). These constraints shape the design; confirm current details and pricing in Meta's documentation before building.

- Business-initiated messages need pre-approved message templates. Free-form replies are only allowed inside the 24-hour window after the user last messaged Kazi Merge.
- The user must opt in. Capture consent with an invite link that opens WhatsApp with a prefilled message (for example `JOIN <code>`). When the employee sends it, the phone number is verified, linked to their profile, and the 24-hour window opens.
- Start with one Kazi Merge business number shared by all companies. Every message names the company so the employee knows who is writing.
- The webhook must verify Meta's signature, acknowledge within a few seconds, deduplicate by WhatsApp message id, and push the real work onto a queue.
- Do not depend on WhatsApp group chats in the MVP.
- Always have a fallback: if a WhatsApp message fails or the user is not opted in, send SMS or email and show the status in the app.

**Templates to register**

| Template | Trigger | Buttons |
| --- | --- | --- |
| `task_assigned` | A task is assigned to the employee | Start, Open in Kazi Merge |
| `task_due_soon` | A set time before the due date | Done, Need more time |
| `task_overdue` | The due date has passed and the task is open | Done, Blocked |
| `task_comment` | Someone comments on the employee's task | Reply, Open in Kazi Merge |
| `owner_daily_digest` | Each morning at the owner's chosen time | Open dashboard |

**Reply handling**

1. A button tap maps to a status change on the task named in the message context.
2. A free-text reply to a task message becomes a comment on that task, marked as sent via WhatsApp.
3. Free text that is not a reply to a task message triggers a list of the sender's open tasks to choose from.
4. Blocked asks for a one-line reason, which is saved on the task.
5. Every WhatsApp-originated change appears in the task thread and activity log exactly like a change made in the app.

### 3.4 Integration code contract

Implement each service behind an interface so it can be swapped or disabled.

```ts
interface MessagingChannel {
  send(to: Recipient, message: OutboundMessage): Promise<DeliveryResult>;
}
interface InboundHandler {
  verify(req: Request): boolean;      // signature check
  parse(req: Request): InboundEvent[]; // button tap, text, status
}
interface CalendarSync {
  upsertTaskEvent(task: Task, user: User): Promise<void>;
  removeTaskEvent(taskId: string, user: User): Promise<void>;
}
interface FilePicker {
  linkFile(fileId: string, user: User): Promise<FileLink>;
}
```

Implementations: `WhatsAppChannel`, `SmsChannel`, `EmailChannel`, `InAppChannel`, `GoogleCalendarSync`, `GoogleDriveLinker`. A `NotificationRouter` chooses the channel per user preference and falls back down the list when delivery fails.

## 4. System architecture and components

Kazi Merge is a modular monolith: one web app, one API with clearly separated modules, one background worker, and a single PostgreSQL database, connected to Google, WhatsApp, SMS and email through adapters.

&#91;embedded content: architecture · 4 channels, 3 services, 2 data stores\]

The web app and Google talk to the API, WhatsApp events arrive at the webhook, and both hand slow work to the Redis queue; the worker sends messages through WhatsApp, SMS and email and runs calendar sync.

### 4.1 Components

| Component | Responsibility | Notes |
| --- | --- | --- |
| Web app (PWA) | All screens for owners, managers and employees; installable on phones | Mobile-first, works on slow connections, live updates on task threads |
| API | REST JSON under `/api/v1`; enforces authentication, roles and company scoping | Modules listed in 4.2 |
| Webhook endpoint | Receives WhatsApp events; verifies signature; acknowledges fast; enqueues | Separate route so it can be rate-limited and monitored on its own |
| Worker | Runs queued jobs: notification delivery, reminders, calendar sync, imports, digests | Redis plus BullMQ, with retries and a dead-letter list |
| Database | PostgreSQL via Prisma; every business table has `company_id` | Entities in Section 5 |
| File storage | Uploaded attachments up to a set size limit | Drive files are stored as links only |
| Realtime | Pushes new thread messages and status changes to open screens | Supabase Realtime or server-sent events |
| Adapters | Google (auth, Calendar, Drive), WhatsApp Cloud API, Africa's Talking, email provider | Defined in Section 3.4 |

### 4.2 API modules

| Module | Owns |
| --- | --- |
| `auth` | Google sign-in, phone OTP, email link, sessions, invite acceptance |
| `companies` | Company profile, settings, trial and plan flag |
| `people` | Employee profiles, CSV and Sheets import |
| `org` | Departments, teams, reporting lines |
| `access` | Roles and permission checks used by every other module |
| `tasks` | Tasks, assignment, status changes, due dates, priorities |
| `threads` | Task conversation, comments, attachments, @mentions |
| `notifications` | Preferences, router, delivery log, WhatsApp templates |
| `integrations` | Google connection state, WhatsApp number linking, webhook handlers |
| `dashboard` | Workload, overdue and blocked queries for managers and owners |
| `activity` | Append-only activity log written by all modules |

### 4.3 Conventions the whole codebase follows

- IDs are UUIDs. Timestamps are stored in UTC and shown in East Africa Time (Africa/Kampala, UTC+3).
- Phone numbers are stored in E.164 format (for example +256700000000).
- Currency is Uganda shillings (UGX) with no decimals.
- List endpoints use cursor pagination. Errors return `{ code, message, details? }` with a correct HTTP status.
- Every state-changing action writes one activity log row. Notification sending is always done by the worker, never inside a request.
- Secrets and tokens (Google refresh tokens, WhatsApp access token) are encrypted at rest and never logged.
- Soft-delete people and tasks (`deleted_at`) so work history stays intact.

## 5. Data model

The model has 14 entities. Every entity except `User` and `Company` carries `company_id`, `created_at` and `updated_at`. Use these names as Prisma models.

| Entity | Key fields | Relationships and rules |
| --- | --- | --- |
| `Company` | name, industry, size\_band, timezone, plan (`trial`/`paid`), trial\_ends\_at | Has many employees, teams, tasks |
| `User` | email?, phone\_e164?, google\_sub?, name, avatar\_url | A person's login identity. At least one of email, phone or google\_sub is required. One user can later belong to several companies |
| `Membership` | user\_id, company\_id, role (`owner`/`manager`/`employee`), status (`invited`/`active`/`suspended`) | Links a user to a company and holds the role |
| `Employee` | membership\_id, job\_title, department\_id, manager\_id, start\_date, phone\_e164, emergency\_contact?, status | The HR-style profile. `manager_id` points to another employee (reporting line) |
| `Department` | name, head\_employee\_id? | Contains teams |
| `Team` | name, department\_id, lead\_employee\_id | Employees belong to many teams through `TeamMember` |
| `TeamMember` | team\_id, employee\_id | Join table |
| `Task` | title, description, assignee\_employee\_id, created\_by, team\_id?, priority (`low`/`medium`/`high`), status (`todo`/`in_progress`/`blocked`/`done`), due\_at, completed\_at, blocked\_reason?, source (`app`/`whatsapp`) | One assignee in the MVP. Status changes append to the activity log |
| `TaskUpdate` | task\_id, author\_employee\_id, kind (`comment`/`status_change`/`system`), body, channel (`app`/`whatsapp`), created\_at | The task conversation and progress record. Append-only; edits are flagged, not overwritten |
| `Attachment` | task\_update\_id, kind (`upload`/`drive_link`), name, url or storage\_key, drive\_file\_id?, mime\_type | Drive files are links only |
| `Notification` | recipient\_user\_id, type, task\_id?, channel, template, status (`queued`/`sent`/`delivered`/`failed`), error?, sent\_at | Delivery log; powers fallback and the in-app bell |
| `NotificationPreference` | user\_id, whatsapp\_enabled, sms\_enabled, email\_enabled, digest\_time | Defaults: WhatsApp on if opted in, otherwise SMS or email |
| `IntegrationAccount` | user\_id, provider (`google`/`whatsapp`), external\_id, encrypted\_token?, scopes, status, whatsapp\_window\_expires\_at? | Stores Google connection and WhatsApp opt-in state |
| `ActivityLog` | actor\_user\_id, action, entity\_type, entity\_id, metadata (JSON), created\_at | Append-only. Everything that changes data writes one row |

**Rules the schema must enforce**

- A task's assignee must belong to the same company as the task.
- An employee's visible tasks are limited by role (Section 8).
- Completing a task sets `completed_at`; reopening clears it and logs the reopen.
- Index `(company_id, assignee_employee_id, status, due_at)` on `Task` for the workload dashboard.
- Index `IntegrationAccount(provider, external_id)` to match inbound WhatsApp numbers to users quickly.

The `TaskUpdate` plus `ActivityLog` history is also the foundation for the Phase 3 performance insights, so keep it complete and never delete rows from it.

## 6. MVP modules, requirements and acceptance criteria

Nine modules make up the MVP. Each lists what to build and the checks that must pass before it counts as done.

### M1. Accounts and company onboarding

**Build**

- Sign up and sign in with Google, phone number (OTP by WhatsApp or SMS) or email link.
- A new owner creates a company (name, industry, size band) and lands on a three-step setup: add people, create a first team, assign a first task.
- Owners and managers invite people by phone number or email. An invite creates a `Membership` with status `invited`.
- A 30-day trial starts automatically; a banner shows days left.

**Acceptance criteria**

- [ ] A new owner can go from the sign-up screen to a created company in under 2 minutes using Google only.
- [ ] A user with no Google account can sign up with a phone number and an OTP.
- [ ] An invited person who accepts the invite becomes `active` with the role they were invited as.
- [ ] A user from company A can never read or write company B's data (tested with two seeded companies).

### M2. People and organisation structure

**Build**

- Employee directory with search and filters (team, status).
- Employee profile: name, job title, department, teams, reporting manager, phone, email, start date, status.
- Departments and teams, with reporting lines shown as a simple tree.
- Bulk import from CSV and from a Google Sheet, with a preview and per-row errors before saving.

**Acceptance criteria**

- [ ] Owner can import 30 employees from a CSV in one step, and rows with errors are listed without blocking valid rows.
- [ ] Changing an employee's manager updates the org tree immediately.
- [ ] Deactivating an employee keeps their tasks and history but removes them from assignee pickers.

### M3. Access and restriction

**Build** role checks in one shared policy module, used by every API route (matrix in Section 8).

**Acceptance criteria**

- [ ] An Employee sees only their own tasks and their team's shared tasks.
- [ ] A Manager sees and manages only their teams and the people reporting into them.
- [ ] Only an Owner can change roles, invite managers or remove people.
- [ ] Every denied request returns 403 and is recorded in the activity log.

### M4. Task management

**Build**

- Create a task: title, description, assignee, due date and time, priority, optional team.
- Statuses: To do, In progress, Blocked (reason required), Done.
- Views: My tasks, Team tasks, All tasks (owner), with filters for status, assignee, priority and due date.
- A task can be created from the web app or, in the stretch goal, from WhatsApp.

**Acceptance criteria**

- [ ] A manager can create and assign a task in under 30 seconds.
- [ ] Moving a task to Blocked without a reason is rejected.
- [ ] Overdue tasks are visibly flagged in every list.
- [ ] Reassigning a task notifies both the old and the new assignee and writes an activity log row.

### M5. Task conversation (the differentiator)

**Build**

- One thread per task showing comments, status changes and system events in time order.
- @mentions of colleagues, file uploads and Google Drive links.
- Messages sent from WhatsApp appear in the same thread, labelled with a WhatsApp icon.

**Acceptance criteria**

- [ ] A comment posted in the app is delivered to the other party on their preferred channel.
- [ ] A reply sent from WhatsApp shows in the thread within 10 seconds.
- [ ] Status changes appear in the thread automatically, with who made them and through which channel.
- [ ] A Drive file attached to a task opens the original file in Drive.

### M6. Manager workload dashboard

**Build** a dashboard for owners and managers showing: open tasks per person, overdue count, due this week, blocked tasks with reasons, on-time completion rate over the last 30 days, and a recent activity feed. Clicking any number opens the filtered task list.

**Acceptance criteria**

- [ ] Dashboard loads in under 3 seconds for a company with 50 employees and 2,000 tasks.
- [ ] Numbers on the dashboard match the filtered lists they link to.
- [ ] A manager only sees their own scope.

### M7. Notifications and WhatsApp

**Build** the `NotificationRouter`, the five WhatsApp templates in Section 3.3, WhatsApp opt-in by invite link, reply handling, SMS and email fallback, an in-app notification bell, and per-user preferences.

**Acceptance criteria**

- [ ] An employee who sends the `JOIN` message is linked to their profile and receives a test message back.
- [ ] Assigning a task triggers a WhatsApp message to an opted-in employee within 30 seconds.
- [ ] Tapping Done on a WhatsApp message marks the task done and notifies the manager.
- [ ] If WhatsApp delivery fails, the system falls back to SMS or email and records the failure.
- [ ] The webhook rejects requests with an invalid signature and ignores duplicate message ids.

### M8. Google integration

**Build** Google sign-in, optional Calendar sync of due dates, Drive Picker for attachments, and Sheets import.

**Acceptance criteria**

- [ ] With Calendar sync on, a new task with a due date creates a calendar event for the assignee, and changing the due date moves the event.
- [ ] Disconnecting Google removes stored tokens and stops syncing, without breaking sign-in by phone.
- [ ] Only the narrow scopes listed in Section 3.2 are requested.

### M9. Activity log

**Build** an append-only log written by every module, a per-task history tab, and an owner-only company activity page with filters.

**Acceptance criteria**

- [ ] Every change to a task, person or role is recorded with actor, time and before and after values.
- [ ] Log rows cannot be edited or deleted through the API.

## 7. Look and feel

Kazi Merge should feel like a calm, plain-spoken to-do board for a business, not like heavy HR software. A first-time user should understand every screen without training.

### 7.1 Design principles

1. **One screen, one job.** Each screen answers one question: what needs attention, what is this task, who is this person.
2. **Conversation lives with the work.** The thread sits on the task screen, never in a separate inbox.
3. **Plain words.** Say "Assign", "Due", "Blocked", not "Provision" or "Escalate". Keep all text in a translation file so other languages can be added.
4. **Phone first.** Single column on small screens, thumb-reachable actions at the bottom, tap targets at least 44 px.
5. **Light on data.** Skeleton loaders, small images, no autoplay. Pages should be usable on a weak connection.
6. **Status is visible at a glance.** Colour plus an icon and a word, never colour alone.

### 7.2 Visual tokens (proposal)

These are placeholder values to build with. Replace them if the company has a brand palette.

| Token | Value | Used for |
| --- | --- | --- |
| Primary | `#2F5BEA` | Main buttons, links, selected items |
| Ink | `#14213D` | Headings and body text |
| Background | `#F7F8FA` | Page background |
| Surface | `#FFFFFF` | Cards and panels |
| Border | `#E3E6EB` | Dividers and card outlines |
| Success | `#1F9D63` | Done |
| Warning | `#E8A317` | Due soon, in progress |
| Danger | `#D64545` | Overdue, blocked |
| Font | Inter, system sans-serif fallback | Base size 16 px, headings 20 and 24 px |
| Shape | 8 px corner radius, 8 px spacing grid | Cards, buttons, inputs |

Status chips: To do (grey), In progress (amber), Blocked (red with a stop icon), Done (green with a tick). Overdue adds a red clock icon and the number of days late.

### 7.3 Navigation and screen specifications

**Navigation.** Desktop: a left sidebar with Dashboard, Tasks, People, Teams, Settings. Phone: a bottom bar with Today, Tasks, People and More. A floating **+ New task** button is always reachable for owners and managers.

**S1. Sign in and setup.** Centred card with three buttons: Continue with Google, Continue with phone, Continue with email. After the first sign-in, a three-step checklist: add people, create a team, assign a first task.

**S2. Dashboard (owner and manager).** Top row of four count cards: Open tasks, Overdue, Due this week, Blocked; each opens the filtered list. Below left, a workload list with one row per person showing a bar of open tasks and a red mark for overdue. Below right, a recent activity feed. A banner shows the trial days left.

**S3. Task list.** Search box and filter chips (status, assignee, priority, due). Each row shows a status chip, title, assignee avatar, due date and an unread comment dot. Tapping a row opens S4.

**S4. Task detail.** Header with title, status chip and a status menu. Left or top: description, assignee, due date, priority, team, attachments. Main area: the conversation thread with a composer at the bottom (text, attach file, add Drive link). Update events such as "Mary marked Blocked: waiting for supplier" appear inline in the thread. Messages from WhatsApp show a small WhatsApp icon.

**S5. People.** Searchable directory of cards or rows. A profile page has details, teams, manager, assigned tasks and recent activity. An org tree toggle shows reporting lines. The Import button opens the CSV and Google Sheets import flow with a preview.

**S6. My tasks (employee, mobile).** Grouped list: Overdue, Today, This week, Later. Each card has big Done and Blocked buttons so a task can be updated in one tap.

**S7. Settings, Integrations.** Cards for Google (Connect, Calendar sync toggle, Disconnect) and WhatsApp (shows the number to message, a copy-invite-link button, list of members opted in or not). Notification preferences per person.

**S8. WhatsApp conversation.** Not a screen we build, but a designed experience: a short templated message, then quick-reply buttons, then a confirmation. See the mock-up below.

### 7.4 Proposed wireframes

The pictures below are low-fidelity layouts for discussion and for any vision-capable coding tool. The text in 7.3 remains the authoritative specification.

&#91;embedded content: S2 dashboard wireframe · desktop\]

**S2 Dashboard.** Four counts open filtered lists, the workload panel shows who is overloaded, and the feed shows changes made in the app and on WhatsApp.

&#91;embedded content: S4 task detail wireframe · desktop\]

**S4 Task detail.** The thread, status changes, Drive files and WhatsApp replies share one timeline beside the task details.

&#91;embedded content: S6 and S8 wireframes · phone app and WhatsApp\]

**S6 and S8.** Each task has one-tap Done and Blocked buttons in the app, and the same task can be started, noted and tracked entirely in WhatsApp, with the note landing in the task thread.

## 8. Roles, permissions, security and privacy

Three roles cover the MVP, and one shared policy module decides every permission so rules live in one place.

### 8.1 Permission matrix

| Action | Owner | Manager | Employee |
| --- | --- | --- | --- |
| Edit company settings and trial or plan | Yes | No | No |
| Invite managers, change roles, remove people | Yes | No | No |
| Invite employees | Yes | Own teams | No |
| View all employee profiles | Yes | Own teams | Own profile and teammates' basic info |
| Edit employee profiles | Yes | Own teams, non-sensitive fields | Own contact details only |
| Create tasks | Yes | Yes | Own tasks only |
| Assign tasks to others | Yes | Own teams | No |
| View tasks | All | Own teams | Assigned to them or shared in their team |
| Update status and comment | Yes | Own teams | Own tasks |
| View dashboard | Company-wide | Own scope | No |
| View company activity log | Yes | Task history in own scope | Own task history only |
| Connect Google, link WhatsApp | Yes | Yes | Yes (own account) |

### 8.2 Security requirements

- Enforce HTTPS everywhere. Use secure, HTTP-only session cookies, CSRF protection and rate limiting on sign-in, OTP and webhook routes.
- OTP codes expire in 5 minutes, are single-use, and are limited to a small number of attempts per phone number.
- Validate all input on the server. Escape user content wherever it is rendered.
- Encrypt Google refresh tokens and the WhatsApp access token at rest, and keep them out of logs.
- Verify the WhatsApp webhook signature on every request and reject anything that fails.
- Run an automated test that tries cross-company access on every endpoint.
- Back up the database daily and test one restore before the first pilot.

### 8.3 Privacy requirements

Kazi Merge holds personal data about employees, so build for consent and minimal data from the start, in line with Uganda's Data Protection and Privacy Act, 2019. Confirm exact obligations with a qualified adviser before launch.

- Collect only the profile fields the MVP uses. Do not store national ID numbers, salary or medical information.
- Record WhatsApp opt-in with a timestamp and let people opt out at any time by replying STOP or in settings.
- Show every person what is stored about them and who in the company can see it.
- Let an owner export and delete a company's data on request.
- Keep the activity log for audit, but allow deletion of a person's personal details while keeping anonymised task history.
- Do not use customer data to train AI models without explicit consent.

## 9. Build order and LLM prompts

Build in eight milestones. Each one ends with something that runs and can be shown to a pilot company. The order puts the connected task conversation first and adds WhatsApp as soon as notifications exist, because WhatsApp is the main adoption path.

### 9.1 Milestones

| # | Milestone | Covers | Done when |
| --- | --- | --- | --- |
| 0 | Foundation | Repo, stack, CI, Prisma schema for Section 5, company-scoping middleware, policy module, seed data, app shell with design tokens | Two seeded companies exist and a test proves they cannot see each other's data |
| 1 | Accounts, people, access | M1, M2, M3 | An owner signs in with Google, imports a CSV of employees, creates teams and invites a manager |
| 2 | Tasks, conversation, activity | M4, M5, M9 | A manager assigns a task, the employee comments and updates it, and the history is complete |
| 3 | Dashboard | M6 | Workload, overdue and blocked numbers match the lists they open |
| 4 | Notification engine | M7 without WhatsApp: router, in-app bell, email, SMS, preferences, worker and retries | Assigning a task sends an in-app, email or SMS notification through the queue |
| 5 | WhatsApp | M7 WhatsApp parts: webhook, opt-in by invite link, five templates, button and text replies, fallback | An employee completes a task entirely from WhatsApp and the thread shows it |
| 6 | Google extras | M8: Calendar sync, Drive Picker, Sheets import | Due dates appear in Google Calendar and Drive files attach to tasks |
| 7 | Hardening and pilot | Cross-company tests, rate limits, performance, backups, error tracking, analytics events, deploy, onboarding polish | All acceptance criteria in Section 6 pass on the deployed system |

Stretch after milestone 7: task creation from a WhatsApp message with LLM parsing and button confirmation.

### 9.2 Master prompt for your coding LLM

Paste this once at the start of the project, with the whole document attached.

```text
You are the lead engineer building the Kazi Merge MVP. The attached
specification is the single source of truth.

Rules:
- Follow Section 1 exactly. Build only MVP scope.
- Work one milestone at a time (Section 9.1). Before writing code for a
  milestone, restate its scope and list the files you will create.
- Every business table is scoped by company_id. Every route uses the
  shared policy module from Section 8.
- External services go behind the adapter interfaces in Section 3.4.
  The product must work with Google and WhatsApp disabled.
- After each milestone, run tests, then walk through its acceptance
  criteria from Section 6 one by one and report pass or fail.
- If the spec is silent or ambiguous, stop and ask me. Do not invent
  requirements.
- Keep code readable: small modules, typed inputs and outputs, no
  unused dependencies.
```

### 9.3 Prompt template for each milestone

```text
Build Milestone <number>: <name>.

Read Sections 3 to 8 of the specification for the parts this milestone
touches. Then:
1. List the database changes, API routes, background jobs and screens
   you will add.
2. Implement them, with tests for permissions and company scoping.
3. Follow the screen specifications in Section 7.3 for the UI.
4. Check each acceptance criterion for the modules this milestone
   covers and show the result of each check.
5. List anything you could not finish or had to assume.
```

### 9.4 Tips for working with the LLM

- Start a fresh chat per milestone and attach only the sections that milestone needs, plus Sections 1, 4 and 5.
- Commit after every working step so you can roll back a bad generation.
- Ask the LLM to write the seed data and test scripts first; they double as your demo data.
- Review every migration and every permission rule yourself, because these are the costliest mistakes.

## 10. MVP definition of done, metrics and open questions

The MVP is done when three pilot companies can run a real week of work in it, with most employee updates arriving through WhatsApp or the phone.

### 10.1 Definition of done

- [ ] All acceptance criteria in Section 6 pass on the deployed system.
- [ ] A company with 30 employees can be set up from a CSV in under 30 minutes.
- [ ] An employee can receive, update and complete a task using only WhatsApp.
- [ ] Cross-company access tests pass on every endpoint.
- [ ] A database backup has been restored successfully once.
- [ ] The product is deployed with error tracking and a status check.
- [ ] At least one pilot company has used it for a full working week.

### 10.2 Metrics to record from day one

These come from the Lean Canvas key metrics. Log an event for each so they can be counted later.

| Metric | Event or query |
| --- | --- |
| Businesses registered | `company_created` |
| Active businesses | Companies with at least one task created or updated in the last 7 days |
| Monthly active users | Distinct users with any action in the last 30 days |
| Tasks and employees managed | Count of tasks and active employees per company |
| Channel mix | Share of status updates made via app and via WhatsApp |
| Customer retention | Companies still active 30 and 60 days after sign-up |
| Paid subscriptions and MRR | Added in the billing milestone after the MVP |

### 10.3 Open questions for the product owner

1. Who owns the Meta business account, and has the Kazi Merge WhatsApp number been verified? Template approval takes time, so start early.
2. Is the target 5 to 50 or 10 to 50 employees? The Lean Canvas and the competitive document differ.
3. Should a task have one assignee or several? This document assumes one for the MVP.
4. Is English enough for the MVP, or is Luganda needed at launch?
5. Is there a brand name style, logo and colour palette to replace the placeholder tokens in 7.2?
6. Will billing stay manual during the pilot? The plan assumes UGX 50,000 per company per month after the free trial, invoiced manually.
7. Where should data be hosted, and do any pilot customers have data-location requirements?
8. Can one person belong to more than one company? The schema allows it, but the MVP screens assume one.
