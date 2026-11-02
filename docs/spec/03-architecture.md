## 4. System architecture and components

Work Merge is a modular monolith: one web app, one API with clearly separated modules, one background worker, and a single PostgreSQL database, connected to Google, WhatsApp, SMS and email through adapters.

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

