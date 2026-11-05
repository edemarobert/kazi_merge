# Work Merge Milestone 2-3 Compliance Audit

Date: 2026-11-05  
Role: Lead QA Engineer and Security Auditor  
Scope: Milestone 2 (Tasks, Conversation, Activity Log) and Milestone 3 (Manager Workload Dashboard)  
Audit mode: Initial read-only source/specification review followed by a remediation verification pass.

## Executive result

The initial audit identified a HIGH-severity cross-tenant activity-feed exposure and several incomplete functional loops. The remediation pass confirms that the tenant leak, blocked-link mismatch, and static People/Teams/profile views have been fixed.

The dashboard activity feed is now explicitly filtered by `companyId`, and the Prisma extension now scopes collection operations with missing `where` blocks while rejecting empty unique selectors.

Remaining material gaps include the missing WhatsApp channel path, missing notification delivery, incomplete activity-log coverage, and the absence of an authenticated manager route-level isolation test.

## 1. Multi-Tenancy and Data Isolation Audit

### 1.1 Scoping mechanism reviewed

The project uses an extended Prisma client for company models in [prisma.ts](apps/api/src/db/prisma.ts:4). `Task`, `TaskUpdate`, and `ActivityLog` are included in the automatic company-model set. The extension requires an active company context and now scopes collection operations even when `where` is missing ([prisma.ts](apps/api/src/db/prisma.ts:84)). Missing unique selectors are rejected before Prisma executes ([prisma.ts](apps/api/src/db/prisma.ts:70)).

Regression coverage in [seed-isolation.test.ts](apps/api/test/seed-isolation.test.ts:30) proves both the default tenant predicate and empty unique-query rejection behaviors.

### 1.2 Task, TaskUpdate, and ActivityLog call-site inventory

| Call site | Operation | Boundary evidence | Audit result |
| --- | --- | --- | --- |
| [tasks/routes.ts](apps/api/src/tasks/routes.ts:103) | `Task.findMany` | Has `deletedAt`, status, and filter predicates, but no explicit `companyId` | Relies on automatic scoping; safe only while the extension is correct. Prefer an explicit company predicate or a tenant-scoped repository. |
| [tasks/routes.ts](apps/api/src/tasks/routes.ts:187) | `Task.create` | `companyId: requireCompanyId()` is explicit | PASS for tenant write boundary. |
| [tasks/routes.ts](apps/api/src/tasks/routes.ts:219) | `Task.findFirst` | Filters by task id and `deletedAt`, no explicit company id | Relies on automatic scoping. The extension currently adds the company because `where` exists. Composite `id_companyId` lookup would be safer. |
| [tasks/routes.ts](apps/api/src/tasks/routes.ts:282) | `Task.findFirst` | Filters by task id and `deletedAt`, no explicit company id | Same reliance on automatic scoping. |
| [tasks/routes.ts](apps/api/src/tasks/routes.ts:332) | `Task.findFirst` | Filters by task id and `deletedAt`, no explicit company id | Same reliance on automatic scoping. |
| [tasks/routes.ts](apps/api/src/tasks/routes.ts:378) | `Task.findFirst` | Filters by task id and `deletedAt`, no explicit company id | Same reliance on automatic scoping before status mutation. The following update does use the composite key. |
| [tasks/routes.ts](apps/api/src/tasks/routes.ts:403) | `Task.update` | Uses `id_companyId` with `requireCompanyId()` | PASS; this is the safest current task write lookup. |
| [tasks/routes.ts](apps/api/src/tasks/routes.ts:235) | `TaskUpdate.create` | `companyId: requireCompanyId()` and task id | PASS for current API write. |
| [tasks/routes.ts](apps/api/src/tasks/routes.ts:299) | `TaskUpdate.create` | `companyId: requireCompanyId()` and task id | PASS for current API write. |
| [tasks/routes.ts](apps/api/src/tasks/routes.ts:412) | `TaskUpdate.create` | `companyId: requireCompanyId()` and task id | PASS for current API write. |
| [tasks/routes.ts](apps/api/src/tasks/routes.ts:462) | `TaskUpdate.create` | `companyId: requireCompanyId()` and task id | PASS for current API write. |
| [tasks/routes.ts](apps/api/src/tasks/routes.ts:74) | `ActivityLog.create` | `companyId: requireCompanyId()` | PASS for current task activity writes. |
| [error-handler.ts](apps/api/src/middleware/error-handler.ts:20) | `ActivityLog.create` | Explicit company id from required context | PASS for authorization-denial activity writes. |
| [dashboard/routes.ts](apps/api/src/dashboard/routes.ts:64) | `Task.count` | No explicit company id; has a `where` object | Relies on automatic scoping. The extension adds the company today. |
| [dashboard/routes.ts](apps/api/src/dashboard/routes.ts:71) | `Task.count` | No explicit company id; has a `where` object | Relies on automatic scoping. |
| [dashboard/routes.ts](apps/api/src/dashboard/routes.ts:79) | `Task.count` | No explicit company id; has a `where` object | Relies on automatic scoping. |
| [dashboard/routes.ts](apps/api/src/dashboard/routes.ts:87) | `Task.count` | No explicit company id; has a `where` object | Relies on automatic scoping. |
| [dashboard/routes.ts](apps/api/src/dashboard/routes.ts:94) | `Task.findMany` | No explicit company id; has a `where` object | Relies on automatic scoping. |
| [dashboard/routes.ts](apps/api/src/dashboard/routes.ts:104) | `Employee.findMany` | No explicit company id; has a `where` object | Relies on automatic scoping. |
| [dashboard/routes.ts](apps/api/src/dashboard/routes.ts:123) | `ActivityLog.findMany` | Explicit `where: { companyId }` plus automatic tenant context | PASS after remediation. The query is directly bounded to the active company. |
| [policy.ts](apps/api/src/policy/policy.ts:86) | `Task.findFirst` | Task id only; active context is present | Relies on automatic scoping. It is currently bounded because a `where` exists, but a composite lookup is safer. |

The dashboard's company lookup is against the `Company` model, which is intentionally excluded from the company-model extension, but it does carry an explicit id predicate ([dashboard/routes.ts](apps/api/src/dashboard/routes.ts:60)). That individual query is appropriately bounded.

### 1.3 Finding H-01: dashboard activity feed can cross tenant boundaries — RESOLVED

The dashboard activity query now selects the latest five rows with `where: { companyId }` ([dashboard/routes.ts](apps/api/src/dashboard/routes.ts:123)). The Prisma extension also injects the active company for collection operations with missing `where` and rejects empty unique selectors ([prisma.ts](apps/api/src/db/prisma.ts:70)).

Regression coverage in [seed-isolation.test.ts](apps/api/test/seed-isolation.test.ts:30) proves both behaviors. The original HIGH finding is closed.

## 2. Milestone 2 Matrix Audit: Tasks, Conversation, Activity

### 2.1 Task status and blocked reason

Status transitions validate the requested status and blocked reason before any task update ([tasks/routes.ts](apps/api/src/tasks/routes.ts:357)). `validateStatusChange` trims the reason and rejects an empty value for `blocked` ([tasks/service.ts](apps/api/src/tasks/service.ts:153)). The route returns HTTP 400 before the write when validation fails ([tasks/routes.ts](apps/api/src/tasks/routes.ts:367)). Focused tests cover whitespace, non-text, valid text, and length limits ([task-service.test.ts](apps/api/test/task-service.test.ts:94)).

Status: **PASS for the API validation path.** A full route-level database test for the rejected write was not found, so the test evidence is utility-level rather than end-to-end.

### 2.2 Append-only TaskUpdate and ActivityLog behavior

The current application exposes create operations for task updates and activity rows, but no route exposes `TaskUpdate` or `ActivityLog` edit/delete operations. The task router contains `TaskUpdate.create` calls for comments, uploads, Drive links, and status changes ([tasks/routes.ts](apps/api/src/tasks/routes.ts:235)), but no update/delete route. The activity helper only creates rows ([tasks/routes.ts](apps/api/src/tasks/routes.ts:69)).

Status: **PASS at the current API call-site level, with a structural caveat.** The schema includes `editedAt` and `updatedAt` on `TaskUpdate` ([schema.prisma](prisma/schema.prisma:303)), and there is no database trigger or database privilege control enforcing immutability. A future direct Prisma routine or database writer could mutate rows. The audit requirement is met by current application routes, not by a hard database append-only guarantee.

### 2.3 WhatsApp channel tagging

The schema has `MessageChannel` and a `TaskUpdate.channel` field defaulting to `app` ([schema.prisma](prisma/schema.prisma:303)). However, all current task-update creation paths omit `channel` and therefore use the default app value ([tasks/routes.ts](apps/api/src/tasks/routes.ts:235), [tasks/routes.ts](apps/api/src/tasks/routes.ts:412), [tasks/routes.ts](apps/api/src/tasks/routes.ts:462)). There is no WhatsApp webhook or inbound-message route in [app.ts](apps/api/src/app.ts:55), and `ActivityLog` has no channel field in the schema.

Status: **FAIL.** The data model anticipates a channel, but WhatsApp-originated comments and state changes are not implemented or explicitly tagged. The M5 requirement that WhatsApp messages appear in the thread with a WhatsApp label cannot pass.

### 2.4 Employee task visibility and role truncation

The employee policy allows `tasks.view` only when the task is the employee's own resource or belongs to the employee's team ([policy.ts](apps/api/src/policy/policy.ts:129)). Task list results are passed through `canViewTask` per task ([tasks/routes.ts](apps/api/src/tasks/routes.ts:120)); task detail also checks policy before returning the task ([tasks/routes.ts](apps/api/src/tasks/routes.ts:330)). Team membership is used to calculate `isOwnTeam` ([policy.ts](apps/api/src/policy/policy.ts:91)).

Status: **PASS for the intended employee assigned-or-team rule, subject to integration-test coverage.** The list initially queries company tasks and filters them through policy rather than encoding the employee scope directly in the SQL predicate. That is fail-closed in the current implementation, but it is less efficient and less robust than a database-level visibility predicate.

A separate manager limitation exists: manager task visibility is based on `isOwnTeam` ([policy.ts](apps/api/src/policy/policy.ts:139)), not the dashboard's recursive reporting-line calculation. A direct report with no shared team can be omitted from manager task views even though the specification describes the manager scope as teams plus reporting lines.

## 3. Milestone 3 Matrix Audit: Manager Workload Dashboard

### 3.1 Scope boundary

The dashboard loads active employees in the active company context, then computes scope from the actor role, team ids, and recursive manager ids ([dashboard/routes.ts](apps/api/src/dashboard/routes.ts:29), [scope.ts](apps/api/src/dashboard/scope.ts:9)). Owners receive `null`, which intentionally means company-wide metrics ([scope.ts](apps/api/src/dashboard/scope.ts:14)). Managers receive their own employee id, same-team employees, and recursive reports ([scope.ts](apps/api/src/dashboard/scope.ts:23). The task metrics and workload queries apply the resulting assignee filter ([dashboard/routes.ts](apps/api/src/dashboard/routes.ts:46).

Status: **PARTIAL.** The metric, workload, and activity queries are now tenant-bounded, and unit tests cover the manager selector ([dashboard-scope.test.ts](apps/api/test/dashboard-scope.test.ts:20)). However:

- There is no authenticated manager route-level or browser integration test proving the response excludes an out-of-scope employee/task.
- The task router's manager policy uses team membership and does not reuse the recursive reporting-line scope ([policy.ts](apps/api/src/policy/policy.ts:139)).

### 3.2 Counter-to-task-list precision

The dashboard links counters as follows ([page.tsx](apps/web/app/page.tsx:80):

| Dashboard counter | Link | API/list filter |
| --- | --- | --- |
| Open tasks | `/tasks?open=true` | `open=true`, non-done tasks ([tasks/page.tsx](apps/web/app/tasks/page.tsx:39), [tasks/routes.ts](apps/api/src/tasks/routes.ts:111)) |
| Overdue | `/tasks?overdue=true` | `overdue=true`, non-done and `dueAt < now` ([tasks/routes.ts](apps/api/src/tasks/routes.ts:111)) |
| Due this week | `/tasks?dueThisWeek=true` | `dueThisWeek=true`, non-done and current-week window ([tasks/routes.ts](apps/api/src/tasks/routes.ts:111)) |
| Blocked | `/tasks?status=blocked` | `status=blocked` initializes the status select and task API filter ([tasks/page.tsx](apps/web/app/tasks/page.tsx:25)) |

The benchmark script now compares dashboard metric values with the four linked task-list responses ([dashboard-benchmark.ts](scripts/dashboard-benchmark.ts:188)). That proves the API query definitions match for the generated fixture. The task page now initializes the status select from the Blocked card URL.

The dashboard blocked count includes `deletedAt: null` ([dashboard/routes.ts](apps/api/src/dashboard/routes.ts:88)), matching the task-list exclusion.

Status: **PARTIAL.** Open, overdue, due-this-week, and blocked mappings are now structurally aligned. The remaining gap is the absence of an authenticated manager route/browser proof of scope-consistent rendered results.

## 4. Acceptance Criteria Verification

The authoritative criteria are in [05-modules-and-acceptance.md](docs/spec/05-modules-and-acceptance.md). Section 10 is [09-open-questions.md](docs/spec/09-open-questions.md) in the split specification and contains definition-of-done criteria rather than additional M4-M6-M9-specific acceptance criteria.

### 4.1 Section 6: M4 Task management

| Criterion | Status | Evidence and finding |
| --- | --- | --- |
| A manager can create and assign a task in under 30 seconds. | [PARTIAL] | Creation and assignment paths exist in [tasks/routes.ts](apps/api/src/tasks/routes.ts:135) and the web form, but there is no timed browser test or measured acceptance run. |
| Moving a task to Blocked without a reason is rejected. | [PASS] | Server validation and early rejection are present in [tasks/routes.ts](apps/api/src/tasks/routes.ts:357) and [tasks/service.ts](apps/api/src/tasks/service.ts:153); focused tests are in [task-service.test.ts](apps/api/test/task-service.test.ts:94). End-to-end rejected-write coverage is still absent. |
| Overdue tasks are visibly flagged in every list. | [PARTIAL] | The task list renders an overdue marker ([tasks/page.tsx](apps/web/app/tasks/page.tsx:138)) and task detail renders an overdue callout ([tasks/[taskId]/page.tsx](apps/web/app/tasks/[taskId]/page.tsx:197)); no browser test covers every required list, and the dashboard uses a separate late label. |
| Reassigning a task notifies both old and new assignees and writes an activity row. | [FAIL] | No task reassignment route, notification router, or old/new assignee notification implementation was found. Current activity writes cover creation, status, comments, uploads, and Drive links ([tasks/routes.ts](apps/api/src/tasks/routes.ts:200)). |

### 4.2 Section 6: M5 Task conversation

| Criterion | Status | Evidence and finding |
| --- | --- | --- |
| An app comment is delivered to the other party on their preferred channel. | [FAIL] | Comments are stored as `TaskUpdate` and an activity row ([tasks/routes.ts](apps/api/src/tasks/routes.ts:436)), but no delivery service, channel preference lookup, or notification dispatch exists. |
| A WhatsApp reply appears in the thread within 10 seconds. | [FAIL / UNTESTED] | No WhatsApp webhook or inbound message route is wired in [app.ts](apps/api/src/app.ts:55); no latency test exists. |
| Status changes appear with who made them and through which channel. | [PARTIAL] | Status updates include the author relation and are rendered with author name ([tasks/routes.ts](apps/api/src/tasks/routes.ts:412), [tasks/[taskId]/page.tsx](apps/web/app/tasks/[taskId]/page.tsx:244)). Channel is not selected into the web type/render and all current writes default to `app`. |
| A Drive file attached to a task opens the original file in Drive. | [FAIL] | Drive-link creation stores URL metadata ([tasks/routes.ts](apps/api/src/tasks/routes.ts:210)); the task detail UI does not render attachment URLs or open links, and no Drive Picker/integration flow exists. |

### 4.3 Section 6: M6 Manager workload dashboard

| Criterion | Status | Evidence and finding |
| --- | --- | --- |
| Dashboard loads in under 3 seconds for 50 employees and 2,000 tasks. | [PASS with scope] | The repeatable benchmark creates 50 employees and 2,000 tasks, exercises the real endpoint, and reports latency ([dashboard-benchmark.ts](scripts/dashboard-benchmark.ts:14)); the recorded local p95 was 126.03 ms. This is an API benchmark, not a production-network/browser benchmark. |
| Dashboard numbers match the filtered lists they link to. | [PASS for implemented filters] | The benchmark compares endpoint counts with linked task-list responses ([dashboard-benchmark.ts](scripts/dashboard-benchmark.ts:188)); browser tests check hrefs ([dashboard.spec.ts](apps/web/test/dashboard.spec.ts:28)); the Blocked link now initializes the status filter and both queries exclude soft-deleted tasks. |
| A manager only sees their own scope. | [PARTIAL] | Recursive scope selection, assignee filtering, and tenant-bounded activity are implemented ([scope.ts](apps/api/src/dashboard/scope.ts:9), [routes.ts](apps/api/src/dashboard/routes.ts:123)) and unit-tested ([dashboard-scope.test.ts](apps/api/test/dashboard-scope.test.ts:20)). No authenticated manager route/browser isolation test exists, and task policy still uses team membership rather than the recursive dashboard scope. |

### 4.4 Section 6: M9 Activity log

| Criterion | Status | Evidence and finding |
| --- | --- | --- |
| Every task, person, and role change is recorded with actor, time, before, and after values. | [PARTIAL] | Task creation/status/comment/attachment/Drive actions write activity rows with actor and timestamps ([tasks/routes.ts](apps/api/src/tasks/routes.ts:69)). Status metadata includes from/to ([tasks/routes.ts](apps/api/src/tasks/routes.ts:425)). Person and role change coverage is incomplete; reassignment and owner activity views are absent; many metadata payloads do not contain before/after values. |
| Log rows cannot be edited or deleted through the API. | [PASS at current API surface] | No ActivityLog update/delete route or application Prisma routine was found. The schema does not add a hard database immutability trigger, so this is not a database-enforced guarantee. |

### 4.5 Section 10.1: Definition of done

| Criterion | Status | Evidence and finding |
| --- | --- | --- |
| All Section 6 acceptance criteria pass on the deployed system. | [FAIL] | Multiple M4/M5/M6/M9 criteria above are failed, partial, or untested, and no deployed-system walkthrough evidence exists. |
| A company with 30 employees can be set up from CSV in under 30 minutes. | [PARTIAL / UNTESTED] | CSV preview/import API contracts exist, but the UI includes a sample CSV and no timed 30-employee browser acceptance test was found. |
| An employee can receive, update, and complete a task using only WhatsApp. | [FAIL] | No WhatsApp webhook, inbound message handling, or task update path exists. |
| Cross-company access tests pass on every endpoint. | [FAIL / PARTIAL] | The seed isolation test covers task reads ([seed-isolation.test.ts](apps/api/test/seed-isolation.test.ts:45)), but every endpoint is not covered; the dashboard activity leak identified in the initial audit is now remediated; endpoint-by-endpoint coverage is still incomplete. |
| A database backup has been restored successfully once. | [UNTESTED] | No backup/restore script, artifact, or test evidence was found in the repository. |
| The product is deployed with error tracking and a status check. | [PARTIAL] | A health endpoint exists ([app.ts](apps/api/src/app.ts:61)); deployment and error-tracking configuration/evidence are absent. |
| At least one pilot company has used it for a full working week. | [UNTESTED] | No pilot telemetry or operational evidence is present in the repository. |

## 5. Hidden Placeholders and Stray Code

### 5.1 Static data bypassing business APIs

- The People directory now loads from `/api/v1/people` with backend search/status filters ([people/page.tsx](apps/web/app/people/page.tsx:33)).
- Employee profiles now load from `/api/v1/people/:employeeId` and reflect backend policy scope ([people/[employeeId]/page.tsx](apps/web/app/people/[employeeId]/page.tsx:32)).
- The Teams organization tree now loads from `/api/v1/people/organization` ([teams/page.tsx](apps/web/app/teams/page.tsx:32)).
- The app shell hardcodes `Amina Nakato` and `Owner` ([shell.tsx](apps/web/app/shell.tsx:66)) rather than the authenticated actor.
- The CSV import screen starts with a sample row ([people/import/page.tsx](apps/web/app/people/import/page.tsx:8)). It does call preview/import APIs, so this is a placeholder default rather than a total API bypass.

### 5.2 Translation-dictionary violations

The translation dictionary is defined in [translations.ts](apps/web/app/translations.ts:1), but several M2/M3 UI strings are embedded directly in components:

- Task list labels, statuses, filters, loading/error text, and overdue text are hardcoded ([tasks/page.tsx](apps/web/app/tasks/page.tsx:64)).
- Task detail labels, status options, comments, Drive-link labels, and error text are hardcoded ([tasks/[taskId]/page.tsx](apps/web/app/tasks/[taskId]/page.tsx:153)).
- Navigation labels and profile labels are hardcoded ([shell.tsx](apps/web/app/shell.tsx:6)).
- Dashboard empty-state text is hardcoded ([page.tsx](apps/web/app/page.tsx:125)).

### 5.3 Unimplemented or unmapped links

- Dashboard `View all` points to `/activity`, but no `apps/web/app/activity` route exists ([page.tsx](apps/web/app/page.tsx:136)).
- The shell points to `/settings`, but no settings page exists ([shell.tsx](apps/web/app/shell.tsx:11)).
- People points to `/people/invite`, but no invite page exists ([people/page.tsx](apps/web/app/people/page.tsx:66)).

### 5.4 Data-model and implementation deviations

- The M5 specification requires WhatsApp-originated thread messages with a visible WhatsApp label. The current `TaskUpdate.channel` field is present but never set by a WhatsApp path, and the UI type does not expose it ([schema.prisma](prisma/schema.prisma:303), [tasks/[taskId]/page.tsx](apps/web/app/tasks/[taskId]/page.tsx:7)).
- The dashboard currently adds a fifth on-time completion card in addition to the four S2 count cards ([page.tsx](apps/web/app/page.tsx:95)). This is not inherently non-compliant because M6 requires the rate, but it is a divergence from the S2 four-card wireframe.
- The dashboard activity feed uses actor/action text but no activity detail route or owner-only company activity page exists, despite the M9 build requirement.

## 6. Audit Summary Table

Severity counts below count distinct implementation/security findings, not every failed acceptance row.

| Severity | Count | Findings |
| --- | ---: | --- |
| HIGH | 0 | H-01 is resolved: the dashboard activity query is explicitly tenant-filtered and the Prisma extension rejects/repairs missing filters. |
| MEDIUM | 5 | M-01: manager task policy does not reuse recursive reporting-line scope; M-02: WhatsApp channel path/tagging is absent; M-03: preferred-channel notification delivery is absent; M-04: Drive attachments are stored but not rendered/opened; M-05: activity-log coverage and owner activity view are incomplete. |
| LOW | 3 | L-01: current application relies heavily on implicit automatic scoping instead of explicit composite tenant keys; L-02: translation dictionary is bypassed by embedded UI strings; L-03: several navigation links target unimplemented routes. |
| **Total** | **8** | **0 HIGH, 5 MEDIUM, 3 LOW; the prior HIGH finding is closed.** |

## Recommended remediation order

1. Add authenticated manager route/browser tests covering in-scope and out-of-scope employees/tasks, including dashboard activity.
2. Align manager task policy with the dashboard's recursive reporting-line scope.
3. Implement the missing M5/M9 surfaces: WhatsApp ingestion/channel tagging, notification delivery, Drive-link rendering, owner activity page, and complete before/after activity metadata.
4. Move remaining user-visible embedded strings into the translation dictionary and resolve unmapped navigation links.
