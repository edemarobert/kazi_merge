# Work Merge Milestone 4–5 Compliance Audit

**Role:** Lead QA Engineer and Security Auditor  
**Scope:** Milestone 4 Notification Engine and Milestone 5 WhatsApp Business Platform Integration  
**Audit date:** 2026-11-05  
**Method:** Read-only source/specification review. No application files were modified.

## Executive finding

The implementation has useful foundations—tenant-scoped notification records, HMAC verification, inbound-message uniqueness, JOIN handling, task-status writes, and a BullMQ notification worker—but it does **not** satisfy the M4/M5 specifications as a production-compliant implementation.

The progress tracker’s claim that Milestone 5 is complete is overstated. The largest gaps are:

1. WhatsApp webhook work is acknowledged before processing but is not pushed to BullMQ; database work and outbound Graph API calls run in the API process.
2. The stored `whatsappWindowExpiresAt` value is not checked, so free-text replies are accepted outside the required 24-hour window.
3. A WhatsApp phone number is resolved with an unrestricted `LIMIT 1`; the same number linked across companies can be assigned to an arbitrary tenant.
4. Unlinked free text returns a generic message instead of the required open-task selection list.
5. SMS and email are generic configurable JSON webhooks, not verified Africa’s Talking/email-provider adapters, and live fallback delivery is untested.
6. The required `MessagingChannel` and `InboundHandler` interfaces are not declared or implemented by name; only a local outbound `ChannelAdapter` type exists.

## 1. Architectural adapter and queue isolation audit

### 1.1 Interface contracts

**Result: PARTIAL / NON-COMPLIANT**

The specification declares `MessagingChannel.send()` and `InboundHandler.verify()/parse()` in [docs/SPEC_FULL.md](docs/SPEC_FULL.md:123). The repository does not define those interfaces.

- [service.ts](apps/api/src/notifications/service.ts:31) defines only a local `ChannelAdapter` with `send(record)`. It does not expose the specified `Recipient`, `OutboundMessage`, or `DeliveryResult` contract.
- [channels.ts](apps/api/src/notifications/channels.ts:29) provides generic email/SMS sender wrappers.
- [channel.ts](apps/api/src/whatsapp/channel.ts:78) provides a WhatsApp adapter factory, but it is typed against `ChannelAdapter`, not a shared `MessagingChannel` contract.
- [webhook.ts](apps/api/src/whatsapp/webhook.ts:12,28-81) exposes standalone signature verification and parsing, but no `InboundHandler` interface exists and the Express route does not consume one.

The core application can start without provider credentials because [worker.ts](apps/api/src/notifications/worker.ts:38) installs failing/conditional adapters, but this is not proof of the specified swappable interface architecture.

### 1.2 Background isolation

**Result: FAIL — HIGH**

Outbound assignment delivery is queued when `REDIS_URL` exists in [tasks/routes.ts](apps/api/src/tasks/routes.ts:89,205-213), and the worker runs notification publishing under tenant context in [worker.ts](apps/api/src/notifications/worker.ts:13). BullMQ retries and a dead-letter queue are configured in [queue.ts](apps/api/src/notifications/queue.ts:7,39-65).

The WhatsApp webhook violates the isolation rule:

- [routes.ts](apps/api/src/whatsapp/routes.ts:477) validates the request, sends HTTP 200, then calls `void processEvent(event)` directly.
- `processEvent` performs Prisma writes and task operations in [routes.ts](apps/api/src/whatsapp/routes.ts:394).
- `sendText` performs direct Graph API `fetch` calls in [routes.ts](apps/api/src/whatsapp/routes.ts:26).
- JOIN, STOP, button, blocked-reason, and comment processing do not enter BullMQ.

Returning 200 before awaiting the promise reduces response latency, but it does not move work to a background worker. The API process still owns the database and external HTTP work; errors are swallowed at [routes.ts](apps/api/src/whatsapp/routes.ts:493), and there is no durable inbound retry/DLQ path.

## 2. Milestone 4 notification engine audit

### 2.1 Preference and routing fallback

**Result: PARTIAL**

The router reads per-company/user preferences using the scoped compound key in [service.ts](apps/api/src/notifications/service.ts:57). It orders enabled channels WhatsApp, SMS, then email in [service.ts](apps/api/src/notifications/service.ts:41), and stops after the first successful external channel in [service.ts](apps/api/src/notifications/service.ts:71,119-124). Adapter exceptions are recorded and fall through in [service.ts](apps/api/src/notifications/service.ts:125).

Gaps:

- The default is `whatsappEnabled: false`, `smsEnabled: true`, `emailEnabled: true` in [service.ts](apps/api/src/notifications/service.ts:64). The router does not itself check WhatsApp opt-in; that check occurs later in [worker.ts](apps/api/src/notifications/worker.ts:45).
- SMS/email are generic JSON webhooks configured by `SMS_PROVIDER_URL` and `EMAIL_PROVIDER_URL` in [worker.ts](apps/api/src/notifications/worker.ts:72), not explicit Africa’s Talking/email-provider adapters.
- If an adapter is absent, [service.ts](apps/api/src/notifications/service.ts:101) leaves the row queued rather than marking failure and advancing fallback.

### 2.2 In-app integration

**Result: PARTIAL / PASS FOR RECORD CREATION**

The router always includes `in_app` first in [service.ts](apps/api/src/notifications/service.ts:71), creates a `Notification` row in [service.ts](apps/api/src/notifications/service.ts:90), and updates status/error/sent time in [service.ts](apps/api/src/notifications/service.ts:106). The bell reads rows in [notifications/routes.ts](apps/api/src/notifications/routes.ts:14), and the shell counts undelivered notifications in [apps/web/app/shell.tsx](apps/web/app/shell.tsx:53).

The in-app adapter itself is a no-op success response in [channels.ts](apps/api/src/notifications/channels.ts:22). The database row is the effective bell integration, but there is no richer message/localization contract.

### 2.3 Job coverage

**Result: PARTIAL**

Factories exist for assignment, due-soon, overdue, comment, and daily digest in [jobs.ts](apps/api/src/notifications/jobs.ts:16). A concrete assignment enqueue exists in [tasks/routes.ts](apps/api/src/tasks/routes.ts:205), and completion notification enqueue exists in [whatsapp/routes.ts](apps/api/src/whatsapp/routes.ts:266).

No producer/scheduler was found for due-soon, overdue, or owner daily digest events. Event factories alone do not satisfy the notification-job requirement.

## 3. Milestone 5 WhatsApp platform audit

### 3.1 Webhook signature and safety

**Result: PARTIAL / HIGH**

Positive evidence:

- Raw request bytes are captured by `express.json({ verify })` in [app.ts](apps/api/src/app.ts:42).
- HMAC-SHA256 verification uses `timingSafeEqual` in [webhook.ts](apps/api/src/whatsapp/webhook.ts:12).
- Invalid signatures receive 401 in [routes.ts](apps/api/src/whatsapp/routes.ts:477).
- Inbound IDs are uniquely stored per company in [schema.prisma](prisma/schema.prisma:372), with duplicate handling in [routes.ts](apps/api/src/whatsapp/routes.ts:405).
- The route returns 200 before processing in [routes.ts](apps/api/src/whatsapp/routes.ts:492).

Deficiencies:

- The implementation exposes `/api/v1/integrations/whatsapp/webhook` from [app.ts](apps/api/src/app.ts:53), not the audit brief’s `/api/v1/webhooks/whatsapp` path. This is a contract mismatch unless an external rewrite exists.
- The acknowledged payload is not enqueued to BullMQ.
- `findIdentity` uses provider, phone, and `LIMIT 1` without a company discriminator in [routes.ts](apps/api/src/whatsapp/routes.ts:56). Because [schema.prisma](prisma/schema.prisma:420) permits the same external ID in different companies, an inbound command can be attributed to an arbitrary tenant. **HIGH security finding.**
- Rate limiting exists at [routes.ts](apps/api/src/whatsapp/routes.ts:453), but there is no durable inbound queue backpressure/retry policy.

### 3.2 Interactive button parsing

**Result: PARTIAL**

- Interactive button IDs and context IDs are parsed in [webhook.ts](apps/api/src/whatsapp/webhook.ts:42).
- `done` and `in_progress` update task status in [routes.ts](apps/api/src/whatsapp/routes.ts:213).
- Completion writes an activity row and attempts a creator/manager notification only when Redis is configured in [routes.ts](apps/api/src/whatsapp/routes.ts:251). Without Redis, the task changes but no manager message is queued.
- `blocked` stores a pending task ID in a process-local map and asks for text in [routes.ts](apps/api/src/whatsapp/routes.ts:200,284-291).
- The blocked reason is written in [routes.ts](apps/api/src/whatsapp/routes.ts:301), but bypasses central validation in [tasks/service.ts](apps/api/src/tasks/service.ts:155). Empty, whitespace-only, and overlong reasons are not rejected on this path.
- The in-memory state is lost on restart and concurrent prompts for the same user overwrite each other.

### 3.3 Free-text context routing and 24-hour policy

**Result: FAIL — HIGH compliance gap**

`whatsappWindowExpiresAt` exists in [schema.prisma](prisma/schema.prisma:404), and JOIN sets it in [routes.ts](apps/api/src/whatsapp/routes.ts:120). No inbound query or comparison checks the value.

- [handleComment](apps/api/src/whatsapp/routes.ts:338) only checks whether the inbound context ID matches a stored notification with a task ID.
- A contextual free-text reply is accepted outside the required 24-hour window.
- Text without task context receives a generic “Reply to a task message...” response at [routes.ts](apps/api/src/whatsapp/routes.ts:354), not a structured list of the sender’s open tasks as required by [docs/SPEC_FULL.md](docs/SPEC_FULL.md:115).
- The implementation does not record/update the last inbound message time used to validate the window.

### 3.4 Outbound templates

**Result: PARTIAL**

All five template names and buttons are represented in [channel.ts](apps/api/src/whatsapp/channel.ts:20), and the Graph transport sends a template payload in [channel.ts](apps/api/src/whatsapp/channel.ts:98).

- Template language is hardcoded to `en_US` at [channel.ts](apps/api/src/whatsapp/channel.ts:105).
- The body is sent as one generic body parameter; there is no template-specific parameter contract or evidence that Meta-approved templates use that shape.
- Company identification required by [docs/SPEC_FULL.md](docs/SPEC_FULL.md:99) is absent from rendered messages.
- `sendText` sends free-form text without checking the 24-hour window. It is used for JOIN, STOP, prompts, confirmations, and errors at [routes.ts](apps/api/src/whatsapp/routes.ts:26).

## 4. Acceptance criteria verification

### Milestone 4 / M7-without-WhatsApp

| Criterion | Status | Evidence |
|---|---|---|
| Router chooses channels by preference | [PARTIAL] | Preference/order logic exists in [service.ts](apps/api/src/notifications/service.ts:41), but opt-in is not part of routing and providers are generic webhooks in [worker.ts](apps/api/src/notifications/worker.ts:72). |
| Failed delivery falls back to SMS/email | [PARTIAL] | Exception recording/fallthrough exists in [service.ts](apps/api/src/notifications/service.ts:125); live provider delivery is absent. |
| In-app notification bell synchronized | [PASS] for persistence | Row creation, API query, and shell count exist in [service.ts](apps/api/src/notifications/service.ts:71), [notifications/routes.ts](apps/api/src/notifications/routes.ts:14), and [shell.tsx](apps/web/app/shell.tsx:53). |
| Delivery status/error recorded | [PASS] for adapter outcomes | Schema fields are in [schema.prisma](prisma/schema.prisma:347); updates are in [service.ts](apps/api/src/notifications/service.ts:106). Job-level failures can bypass this and only reach the DLQ. |
| Redis/BullMQ owns delivery | [PARTIAL] | Assignment uses BullMQ, but no due/overdue/digest producers were found and WhatsApp inbound work bypasses it. |

### Milestone 5 / M7

| Criterion | Status | Evidence |
|---|---|---|
| JOIN links employee and sends test message | [PASS] in code, UNTESTED live | Invite lookup, membership activation, integration upsert, preferences, activity log, and confirmation exist in [routes.ts](apps/api/src/whatsapp/routes.ts:63). No live Meta test was performed. |
| Assignment sends WhatsApp within 30 seconds | [PARTIAL] | Assignment enqueue exists in [tasks/routes.ts](apps/api/src/tasks/routes.ts:205), but actual delivery depends on Redis, credentials, opt-in, template approval, and unverified live setup. |
| Done marks task done and notifies manager | [PARTIAL] | Status/activity writes exist in [routes.ts](apps/api/src/whatsapp/routes.ts:213); notification is Redis-dependent and targets the task creator rather than an explicit manager rule. |
| WhatsApp failure falls back and records failure | [PARTIAL] | Router failure persistence exists in [service.ts](apps/api/src/notifications/service.ts:125); provider adapters are generic and not live-tested. |
| Invalid signature rejected; duplicates ignored | [PASS] in unit-level code evidence | Verification, 401 rejection, unique index, and duplicate handling exist in [webhook.ts](apps/api/src/whatsapp/webhook.ts:12), [routes.ts](apps/api/src/whatsapp/routes.ts:482,405-425), and [schema.prisma](prisma/schema.prisma:381). Route/database integration tests are missing. |
| Employee can complete task entirely through WhatsApp and thread | [FAIL / UNTESTED] | Mutation paths exist, but 24-hour enforcement, open-task selection, queue isolation, and end-to-end flow coverage are missing. |
| WhatsApp-originated messages appear with WhatsApp label | [PARTIAL] | `TaskUpdate.channel` is set to `whatsapp` in [routes.ts](apps/api/src/whatsapp/routes.ts:241,370-377); task-detail icon rendering was not evidenced. |

## 5. Hidden deficiencies and scope violations

### Security and reliability

- **HIGH — Cross-tenant identity ambiguity:** [routes.ts](apps/api/src/whatsapp/routes.ts:56) uses `LIMIT 1` for a number that can exist in multiple companies.
- **HIGH — WhatsApp window bypass:** [routes.ts](apps/api/src/whatsapp/routes.ts:338) never checks `whatsappWindowExpiresAt`.
- **HIGH — Queue isolation bypass:** [routes.ts](apps/api/src/whatsapp/routes.ts:492) invokes processing directly, while [routes.ts](apps/api/src/whatsapp/routes.ts:26) performs provider HTTP in the API process.
- **MEDIUM — Volatile blocked state:** process-local state and bypassed central validation in [routes.ts](apps/api/src/whatsapp/routes.ts:21,284-318).
- **MEDIUM — Provider integration gap:** generic JSON webhook providers in [worker.ts](apps/api/src/notifications/worker.ts:72) lack provider-specific contracts, timeout policy, circuit breaking, and live tests.
- **MEDIUM — DLQ correlation gap:** BullMQ failures go to [queue.ts](apps/api/src/notifications/queue.ts:62), but no code correlates a pre-publish worker failure back to a `Notification` row.
- **LOW — Hardcoded/localized message content:** English text, `en_US`, and fallback “your task” are embedded in [channel.ts](apps/api/src/whatsapp/channel.ts:13,27-75) and [routes.ts](apps/api/src/whatsapp/routes.ts:77,194-197,207-210,234-235,278-281,336,355-359,431-434).
- **LOW — Company name omitted:** shared-number outbound messages do not name the company as required by [docs/SPEC_FULL.md](docs/SPEC_FULL.md:99).

### Scope review

No WhatsApp group-chat support or AI-generated task creation was found. Their absence is correct because they are marked later/stretch capabilities in [docs/SPEC_FULL.md](docs/SPEC_FULL.md:82).

Supported buttons `open`, `reply`, and `need_more_time` are rendered in [channel.ts](apps/api/src/whatsapp/channel.ts:27), but [routes.ts](apps/api/src/whatsapp/routes.ts:213) handles only `done`, `in_progress`, and `blocked`. The ignored actions produce no response or structured follow-up.

## 6. Post-remediation verification update

**Remediation date:** 2026-11-05  
**Implementation status:** The original audit findings were used to drive a remediation pass. The findings below supersede the affected baseline observations.

### HIGH findings

| Original finding | Current status | Engineering evidence |
|---|---|---|
| WhatsApp inbound processing bypassed BullMQ | **REMEDIATED** | The POST handler in [routes.ts](apps/api/src/whatsapp/routes.ts:572) validates the raw signature, enqueues the raw body through [queue.ts](apps/api/src/whatsapp/queue.ts:17), and returns 200. [queue.ts](apps/api/src/whatsapp/queue.ts:33) owns worker-side parsing, Prisma mutation, task state changes, and outbound provider work. |
| Cross-tenant identity resolution used unrestricted LIMIT 1 | **REMEDIATED** | findIdentity in [routes.ts](apps/api/src/whatsapp/routes.ts:59) requires an opted-in account joined to an active membership, supports tenant filtering, has no LIMIT 1, and rejects ambiguous active-tenant matches. |
| WhatsApp 24-hour reply window was not enforced | **REMEDIATED** | handleComment in [routes.ts](apps/api/src/whatsapp/routes.ts:423) checks whatsappWindowExpiresAt, requires a contextual task or selected task, and routes expired/unlinked text to sendOpenTaskList in [routes.ts](apps/api/src/whatsapp/routes.ts:361). The window is refreshed after deduplicated inbound messages at [routes.ts](apps/api/src/whatsapp/routes.ts:518). |

### Architectural contract and scheduler update

- The exact MessagingChannel and InboundHandler contracts now exist in [service.ts](apps/api/src/notifications/service.ts:39).
- WhatsAppChannel implements MessagingChannel in [channel.ts](apps/api/src/whatsapp/channel.ts:87).
- SmsChannel, EmailChannel, and InAppChannel implement MessagingChannel in [channels.ts](apps/api/src/notifications/channels.ts:11).
- WhatsAppInboundHandler implements InboundHandler in [webhook.ts](apps/api/src/whatsapp/webhook.ts:101).
- Recurring scheduler registration for due-soon, overdue, and owner daily digest was scaffolded in [scheduler.ts](apps/api/src/notifications/scheduler.ts:3) and wired at startup in [server.ts](apps/api/src/server.ts:12).

The scheduler is **PARTIAL**, not a complete job producer: the recurring BullMQ scheduler entries exist, but a dedicated scheduler worker that turns each tick into tenant-scoped notification events has not yet been implemented.

### Updated acceptance status

| Criterion | Updated status | Evidence / remaining limitation |
|---|---|---|
| Queue-isolated inbound webhook | **PASS in source and unit validation** | Signature validation, raw payload enqueue, worker processing, retry configuration, and fast acknowledgement are implemented in [routes.ts](apps/api/src/whatsapp/routes.ts:572) and [queue.ts](apps/api/src/whatsapp/queue.ts:17). |
| Tenant-safe sender resolution | **PASS in source** | Active membership join, ambiguity rejection, and optional tenant predicate are implemented in [routes.ts](apps/api/src/whatsapp/routes.ts:59). |
| 24-hour contextual comment rule | **PASS in source** | Window comparison and open-task list fallback are implemented in [routes.ts](apps/api/src/whatsapp/routes.ts:423). |
| Interactive list/button parsing | **PASS in parser source** | Button replies and list replies are parsed in [webhook.ts](apps/api/src/whatsapp/webhook.ts:54). |
| Named adapter contracts | **PASS** | Contracts and named channel implementations are present in [service.ts](apps/api/src/notifications/service.ts:39), [channel.ts](apps/api/src/whatsapp/channel.ts:87), and [channels.ts](apps/api/src/notifications/channels.ts:11). |
| Due-soon/overdue/daily digest scheduling | **PARTIAL** | Recurring schedules are registered in [scheduler.ts](apps/api/src/notifications/scheduler.ts:24); tenant-scoped event generation and a scheduler consumer remain outstanding. |
| Live Meta/SMS/email acceptance | **UNTESTED** | No live provider credentials or external delivery test was performed. Generic SMS/email webhook adapters remain in [worker.ts](apps/api/src/notifications/worker.ts:72). |

### Validation evidence

- API TypeScript typecheck passed.
- Full API test suite passed: **57 passed, 0 failed**.
- git diff --check passed.
- No live Meta Cloud API, Africa's Talking, or email-provider test was executed.

### Remaining deficiencies

- The route is still mounted at the existing application path /api/v1/integrations/whatsapp/webhook; the brief’s literal /api/v1/webhooks/whatsapp path requires an explicit routing decision or alias.
- Blocked-reason conversation state remains process-local and should be persisted or encoded in durable inbound context for multi-instance reliability.
- Blocked-reason handling still needs direct reuse of the central task-input validator.
- Scheduler registration is not equivalent to due/overdue/digest event production.
- Provider-specific credentials, Meta template approval, timeout/circuit-breaker behavior, and live fallback delivery remain unverified.
- Notification failure correlation from worker/DLQ failures back to delivery rows remains incomplete.
## 7. Audit summary

| Severity | Residual count | Findings |
|---|---:|---|
| HIGH | 0 | The three original high-severity implementation findings are remediated in source. Live provider testing remains unperformed. |
| MEDIUM | 6 | Scheduler event consumer/producer completion; generic provider adapters and live fallback testing; volatile blocked state; blocked-reason validator reuse; manager notification rule completeness; DLQ-to-delivery correlation and route-path contract mismatch. |
| LOW | 3 | Hardcoded/localized message content; company name omitted from shared-number messages; silently ignored supported button actions/provider-version drift. |

### Final disposition

**Milestone 4: PARTIAL — core implementation validated, production hardening remains.** Routing, fallback bookkeeping, contracts, and in-app persistence are present. Provider-specific adapters, scheduler event production, and DLQ-to-delivery correlation remain incomplete.

**Milestone 5: CONDITIONALLY ACCEPTED FOR THE REMEDIATED CODE PATHS.** Queue isolation, tenant ambiguity protection, 24-hour enforcement, and structured task selection are implemented and validated by typecheck/tests. Live provider acceptance and the remaining reliability items listed above are still outstanding.

The progress entry at [PROGRESS.md](PROGRESS.md:139) should be read together with this remediation update. The remaining work is limited to the deficiencies listed above and live/provider-level acceptance evidence.



