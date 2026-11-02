# Milestone 1 Code Review

Review scope:

- M1 Accounts and company onboarding
- M2 People and organisation structure
- M3 Access and restriction
- Permission matrix and security rules in `docs/spec/07-security-and-permissions.md`

This report was initially created before remediation commit `93dfc03`. It has
been updated to reflect that remediation; no additional application code was
changed while updating this report.

## Validation results

| Check | Result | Evidence |
|---|---|---|
| API tests | PASS: 29 passed, 0 failed, 1 skipped | `npm test --workspace @kazi-merge/api` after remediation |
| API typecheck | PASS | `npm run typecheck --workspace @kazi-merge/api` |
| Web typecheck | PASS | `npm run typecheck --workspace @kazi-merge/web` |
| ESLint | PASS | `npm run lint` |
| Web production build | PASS with warning | `npm run build --workspace @kazi-merge/web`; Next.js reported that its ESLint plugin was not detected |
| Real PostgreSQL isolation test | UNTESTED | The test remains skipped because `DATABASE_URL` is not configured |

## 1. Company scoping

### 1.1 Business-table queries without an explicit `companyId`

The Prisma extension in [prisma.ts](apps/api/src/db/prisma.ts#L36-L91) automatically adds the active company to every model in `companyModels`, and rejects queries without an active company context. Therefore, the following production queries are effectively scoped by the extension, but do not contain an explicit company predicate at the call site:

| File and line | Query | Assessment |
|---|---|---|
| [policy.ts](apps/api/src/policy/policy.ts#L80-L83) | `teamMember.findMany({ where: { employeeId: targetEmployeeId } })` | Relies on automatic `TeamMember` scoping |
| [policy.ts](apps/api/src/policy/policy.ts#L85-L89) | `task.findFirst({ where: { id: targetTaskId } })` | Relies on automatic `Task` scoping |
| [policy.ts](apps/api/src/policy/policy.ts#L94-L97) | `teamMember.findFirst({ where: { teamId, employeeId } })` | Relies on automatic `TeamMember` scoping |
| [policy.ts](apps/api/src/policy/policy.ts#L100-L105) | `teamMember.findFirst({ where: { employeeId, teamId: { in: ... } } })` | Relies on automatic `TeamMember` scoping |
| [directory.ts](apps/api/src/people/directory.ts#L55-L60) | `employee.findMany({ where, include, orderBy })` | Relies on automatic `Employee` scoping |
| [directory.ts](apps/api/src/people/directory.ts#L73-L76) | `employee.findFirst({ where: { id, deletedAt }, ... })` | Relies on automatic `Employee` scoping |
| [organization.ts](apps/api/src/people/organization.ts#L45-L52) | `department.findMany(...)` | Relies on automatic `Department` scoping |
| [organization.ts](apps/api/src/people/organization.ts#L56-L64) | `employee.findFirst(...)` for the target | Relies on automatic `Employee` scoping |
| [organization.ts](apps/api/src/people/organization.ts#L67-L71) | `employee.findFirst(...)` for the manager | Relies on automatic `Employee` scoping |
| [organization.ts](apps/api/src/people/organization.ts#L75-L78) | `employee.update(...)` | Relies on automatic `Employee` scoping |
| [invites.ts](apps/api/src/people/invites.ts#L138-L141) | `invite.findUnique({ where: { tokenHash } })` | Relies on automatic `Invite` scoping |
| [dashboard/routes.ts](apps/api/src/dashboard/routes.ts#L16-L18) | `company.findFirst({ select: ... })` | `Company` is excluded from automatic business-model scoping; this lookup must use the active company ID explicitly |

The following queries are not business-table queries and are intentional exceptions or pre-membership operations:

- `User` lookups in [invites.ts](apps/api/src/people/invites.ts#L104-L113) and [csv-import.ts](apps/api/src/people/csv-import.ts#L116-L129) are not company-scoped because a user can exist before or across memberships.
- `Company.create` in [onboarding.ts](apps/api/src/companies/onboarding.ts#L95-L104) must occur before a company context exists.
- `Membership`, `Employee`, and `ActivityLog` writes in [onboarding.ts](apps/api/src/companies/onboarding.ts#L108-L132) include the newly created company explicitly.

**Finding M1-01 - HIGH:** Real PostgreSQL company-isolation evidence is missing. The two-company test in [seed-isolation.test.ts](apps/api/test/seed-isolation.test.ts#L1-L100) passes its test-double assertions, but the live PostgreSQL test is skipped when `DATABASE_URL` is absent. The specification requires cross-company access tests, including every endpoint. No live database test proves that production queries cannot read or write another company's data.

**Finding M1-10 - HIGH:** The dynamic dashboard route performs
`company.findFirst()` without the active company predicate at
[dashboard/routes.ts](apps/api/src/dashboard/routes.ts#L16-L18). `Company` is
not included in the automatic Prisma business-model scope list, so a
multi-company database can return the wrong company name or trial dates.

### 1.2 Routes that do not establish the company from authenticated membership

| Route | File and line | Assessment |
|---|---|---|
| `GET /api/v1/auth/google` | [google-routes.ts](apps/api/src/auth/google-routes.ts#L21-L37) | Public authentication-start route; no company should exist yet |
| `GET /api/v1/auth/google/callback` | [google-routes.ts](apps/api/src/auth/google-routes.ts#L40-L92) | Public authentication-completion route; company context is not established by this route |
| `POST /api/v1/auth/phone/request` | [passwordless-routes.ts](apps/api/src/auth/passwordless-routes.ts#L26-L45) | Public authentication route |
| `POST /api/v1/auth/phone/verify` | [passwordless-routes.ts](apps/api/src/auth/passwordless-routes.ts#L47-L78) | Public authentication route |
| `POST /api/v1/auth/email/request` | [passwordless-routes.ts](apps/api/src/auth/passwordless-routes.ts#L81-L99) | Public authentication route |
| `POST /api/v1/auth/email/verify` | [passwordless-routes.ts](apps/api/src/auth/passwordless-routes.ts#L102-L130) | Public authentication route |
| `POST /api/v1/companies` | [companies/routes.ts](apps/api/src/companies/routes.ts#L13-L51) | Uses the authenticated actor but creates the first company before membership exists; this is a necessary pre-membership exception |
| Any business route in test mode using `x-company-id` | [auth-context.ts](apps/api/src/middleware/auth-context.ts#L43-L70) | The company is caller-supplied by a test header, although production rejects that path |

Business people routes are placed after [auth-context.ts](apps/api/src/app.ts#L15-L18), and session resolution binds the company from the persisted session and active membership in [auth-context.ts](apps/api/src/middleware/auth-context.ts#L20-L41). This is the intended production path.

## 2. Permissions

### 2.1 Routes without a direct shared-policy call

| Route | File and line | Assessment |
|---|---|---|
| `POST /api/v1/companies` | [companies/routes.ts](apps/api/src/companies/routes.ts#L13-L51) | Authenticated but no policy action; pre-membership company creation is not represented in the policy module |
| `GET /api/v1/people` | [people/routes.ts](apps/api/src/people/routes.ts#L114-L132) | Does not call `requirePolicy`; `listVisibleEmployees` calls `can("people.profile.view")` indirectly at [directory.ts](apps/api/src/people/directory.ts#L62-L64) |
| `GET /api/v1/people/:employeeId` | [people/routes.ts](apps/api/src/people/routes.ts#L135-L151) | Does not call `requirePolicy`; `getVisibleEmployee` calls `can("people.profile.view")` indirectly at [directory.ts](apps/api/src/people/directory.ts#L78-L81) |
| `POST /api/v1/people/invites/accept` | [people/routes.ts](apps/api/src/people/routes.ts#L190-L216) | Token and identity checks are used instead of a role policy; this is a separate invite-token authorization boundary |
| All Google and passwordless authentication routes | [google-routes.ts](apps/api/src/auth/google-routes.ts#L21-L92), [passwordless-routes.ts](apps/api/src/auth/passwordless-routes.ts#L26-L130) | Public authentication routes do not require company roles |

The organization, import, and manager routes do call `requirePolicy` at [people/routes.ts](apps/api/src/people/routes.ts#L47-L88). Invite creation calls the policy module at [people/routes.ts](apps/api/src/people/routes.ts#L154-L187).

### 2.2 Permission matrix comparison

| Matrix row | Result | Evidence |
|---|---|---|
| Owner: edit company settings and trial/plan | FAIL / unimplemented | Action type exists at [policy.ts](apps/api/src/policy/policy.ts#L6-L7), but there is no settings or trial-management route |
| Owner: invite managers, change roles, remove people | PARTIAL | Owner passes all actions at [policy.ts](apps/api/src/policy/policy.ts#L116-L118), but role-change and removal routes do not exist |
| Manager: no manager invites, role changes, removals | PASS in policy | No manager branch grants `people.invite.manager`, `people.role.change`, or `people.profile.remove` for managers; note manager removal is incorrectly granted below |
| Owner/manager/employee: invite employees | PARTIAL | Owner passes; managers can invite within `isOwnTeam` at [policy.ts](apps/api/src/policy/policy.ts#L122-L123); employee is denied |
| Owner/manager/employee: view employee profiles | PARTIAL / REMEDIATED | Employee access remains policy-gated at [policy.ts](apps/api/src/policy/policy.ts#L129-L130); employee-role teammate responses now remove email, phone, and manager data in [directory.ts](apps/api/src/people/directory.ts#L25-L43), but route-level and browser coverage is absent |
| Owner/manager/employee: edit employee profiles | PARTIAL | Managers receive broad `people.profile.edit` for own teams at [policy.ts](apps/api/src/policy/policy.ts#L133-L133), with no non-sensitive-field distinction; employee own-profile editing is granted but no profile-edit route exists |
| Owner/manager/employee: create tasks | PARTIAL | Manager and owner policy grants exist at [policy.ts](apps/api/src/policy/policy.ts#L118-L118) and [policy.ts](apps/api/src/policy/policy.ts#L139-L139); no task route exists; employee creation requires `isOwnResource`, which is false without a target resource |
| Owner/manager/employee: assign tasks | PARTIAL | Owner implicit; manager own-team branch exists at [policy.ts](apps/api/src/policy/policy.ts#L136-L136); employee denied; no task route exists |
| Owner/manager/employee: view tasks | PARTIAL | Employee and manager branches exist at [policy.ts](apps/api/src/policy/policy.ts#L131-L131) and [policy.ts](apps/api/src/policy/policy.ts#L137-L137); no task routes exist |
| Owner/manager/employee: update status and comment | PARTIAL | `tasks.update` policy branches exist at [policy.ts](apps/api/src/policy/policy.ts#L132-L132) and [policy.ts](apps/api/src/policy/policy.ts#L138-L138); no task/comment routes exist |
| Owner/manager/employee: view dashboard | PARTIAL | Manager dashboard is granted at [policy.ts](apps/api/src/policy/policy.ts#L140-L140); owner implicit; employee denied; the API route exists at [dashboard/routes.ts](apps/api/src/dashboard/routes.ts#L8-L68), but employee/manager filtering and live end-to-end coverage are incomplete |
| Owner/manager/employee: view activity | PARTIAL | Owner implicit, manager own-team, employee own-resource branches exist at [policy.ts](apps/api/src/policy/policy.ts#L141-L141); no activity route exists |
| Owner/manager/employee: connect Google/link WhatsApp | FAIL / incomplete | `integrations.connect` only checks `isOwnAccount` before the owner branch at [policy.ts](apps/api/src/policy/policy.ts#L111-L113); no integration route exists |

The former manager-removal finding is resolved. The manager branch no longer
grants `people.profile.remove`; only the owner branch's unconditional allow
can authorize that action at [policy.ts](apps/api/src/policy/policy.ts#L116-L144).

The former teammate-profile exposure finding is resolved for employee actors.
Employee directory/profile results are sanitized by
[directory.ts](apps/api/src/people/directory.ts#L25-L43), removing email,
phone, and manager data before returning teammate profiles.

**Finding M1-04 - MEDIUM:** Manager organization access is owner-only in practice. `people.organization.view` is granted to owners through the unconditional owner branch but has no manager branch at [policy.ts](apps/api/src/policy/policy.ts#L116-L144). The organization route therefore cannot provide a manager's own-team view despite the matrix requiring managers to manage their own teams and reports.

### 2.3 Caller-supplied permission facts

No caller-supplied boolean such as `isOwnTeam` is accepted. `isOwnTeam`, `isOwnResource`, and `isOwnAccount` are computed in [policy.ts](apps/api/src/policy/policy.ts#L58-L108).

**Finding M1-05 - MEDIUM:** `loadFacts` accepts `context.actorUserId` and prefers it over the actor in request context at [policy.ts](apps/api/src/policy/policy.ts#L61-L62). Current HTTP routes do not pass this field, but the exported policy API allows a caller to select another actor identity. The policy should derive the actor exclusively from authenticated context for authorization decisions.

### 2.4 Denial response and activity logging

`PolicyDeniedError` is converted to HTTP 403 and an `authorization.denied` activity row by [error-handler.ts](apps/api/src/middleware/error-handler.ts#L12-L35). The API tests only cover missing-context rejection in [policy.test.ts](apps/api/test/policy.test.ts#L5-L19); there is no route test asserting both the 403 response and persisted audit row.

**Finding M1-06 - MEDIUM:** The error handler still awaits the activity-log
insert before sending the 403 at [error-handler.ts](apps/api/src/middleware/error-handler.ts#L19-L29).
If the audit write fails, the denied request does not reliably produce the
specified clean 403 response. No failure-path test covers this behavior.

## 3. M1-M3 acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| M1: New owner completes Google-only sign-up and company creation in under two minutes | UNTESTED | Google state and identity verification are tested in [google.test.ts](apps/api/test/google.test.ts#L1-L100), and company creation is tested in [company-onboarding.test.ts](apps/api/test/company-onboarding.test.ts#L1-L100), but no sign-up screen, identity-completion wiring, session-cookie completion, browser flow, timing measurement, or live provider test exists |
| M1: User without Google signs up with phone and OTP | PARTIAL | OTP mechanics pass in [passwordless.test.ts](apps/api/test/passwordless.test.ts#L5-L35); the route now completes identities and sets a session cookie through [passwordless-routes.ts](apps/api/src/auth/passwordless-routes.ts#L47-L82), but no browser/provider flow is tested |
| M1: Invited person accepts and becomes active with invited role | PASS for service behavior, UNTESTED live | [invites.test.ts](apps/api/test/invites.test.ts#L55-L120) verifies expiry and activation; live database and browser evidence are absent |
| M1: Company A cannot read/write company B data | PASS for test doubles, UNTESTED real PostgreSQL | [company-scope.test.ts](apps/api/test/company-scope.test.ts#L1-L120) and seed assertions pass; the PostgreSQL isolation test is skipped because `DATABASE_URL` is missing |
| M2: Owner imports 30 employees; invalid rows do not block valid rows | PASS for API/web wiring, UNTESTED live | CSV parser/import tests pass in [csv-import.test.ts](apps/api/test/csv-import.test.ts#L1-L150); multipart preview/import routes are wired at [people/routes.ts](apps/api/src/people/routes.ts#L56-L115), and the web page submits both operations at [people/import/page.tsx](apps/web/app/people/import/page.tsx#L47-L123). A 30-row live database/browser run is not recorded |
| M2: Manager change updates org tree immediately | PASS for service retrieval, UNTESTED end-to-end | [organization.test.ts](apps/api/test/organization.test.ts#L4-L69) covers organization queries and manager validation; no UI/API integration test proves an immediate rendered update |
| M2: Deactivation preserves tasks/history and removes employee from assignee pickers | FAIL | No deactivation route/service, task module, or assignee-picker implementation exists; the only status update visible is static placeholder data at [people/page.tsx](apps/web/app/people/page.tsx#L7-L42) |
| M3: Employee sees only own and team-shared tasks | UNTESTED | Policy branches exist at [policy.ts](apps/api/src/policy/policy.ts#L128-L132), but no task routes or route-level tests exist |
| M3: Manager sees/manages only own teams and reporting people | PARTIAL | Team membership facts are relationally loaded at [policy.ts](apps/api/src/policy/policy.ts#L80-L105), but manager organization filtering is absent and manager access to organization view is not granted |
| M3: Only Owner changes roles, invites managers, or removes people | PARTIAL | The policy now denies manager `people.profile.remove` and owners retain the allow at [policy.ts](apps/api/src/policy/policy.ts#L116-L144), but role-change and removal routes are still not implemented |
| M3: Every denied request returns 403 and is activity-logged | PARTIAL | Middleware implementation exists at [error-handler.ts](apps/api/src/middleware/error-handler.ts#L12-L35), but no route-level denial/audit test and no live database evidence exist |

## 4. Security review

| Area | Status | Evidence and finding |
|---|---|---|
| OTP expiry | PASS | Five-minute lifetime at [phone-otp.ts](apps/api/src/auth/phone-otp.ts#L3-L4); expiry checked at [phone-otp.ts](apps/api/src/auth/phone-otp.ts#L57-L63); covered by [passwordless.test.ts](apps/api/test/passwordless.test.ts#L5-L35) |
| OTP single use | PASS | `used` state and deletion at [phone-otp.ts](apps/api/src/auth/phone-otp.ts#L64-L70); covered by the same test |
| OTP attempt limit per phone | PASS for in-memory service | Five attempts at [phone-otp.ts](apps/api/src/auth/phone-otp.ts#L4-L4) and [phone-otp.ts](apps/api/src/auth/phone-otp.ts#L57-L63); no distributed/persistent implementation |
| Session cookie secure and HTTP-only | PASS for issuance | Google and passwordless verification set `kazi_session` using `HttpOnly`, `Secure`, `SameSite=Lax`, and `Max-Age` at [cookie.ts](apps/api/src/auth/cookie.ts#L3-L13), [google-routes.ts](apps/api/src/auth/google-routes.ts#L94-L99), and [passwordless-routes.ts](apps/api/src/auth/passwordless-routes.ts#L76-L82) |
| CSRF protection | PASS for middleware wiring | Signed double-submit CSRF protection and a token endpoint are mounted in [app.ts](apps/api/src/app.ts#L22-L47); protected methods are enforced by `doubleCsrfProtection` |
| Sign-in and OTP rate limiting | PASS for route-level middleware | `express-rate-limit` is mounted on `/api/v1/auth` with a 50-request/15-minute bound at [app.ts](apps/api/src/app.ts#L16-L21); distributed-store production validation remains untested |
| Server-side input validation | PARTIAL / FAIL | Some fields are validated, but invite role is an unchecked type assertion at [people/routes.ts](apps/api/src/people/routes.ts#L166-L166), invite acceptance coerces any token with `String(...)` at [people/routes.ts](apps/api/src/people/routes.ts#L202-L202), and company input only validates required name text at [onboarding.ts](apps/api/src/companies/onboarding.ts#L78-L84) |
| Escaping user content | PASS for observed React rendering | No `dangerouslySetInnerHTML` or equivalent raw HTML rendering was found; React renders values as text. Browser/API coverage is still limited |
| Google scopes | PASS | Scopes are exactly `openid`, `email`, and `profile` at [google.ts](apps/api/src/auth/google.ts#L7-L7); tested in [google.test.ts](apps/api/test/google.test.ts#L1-L30) |
| Secrets and tokens in logs | PASS for reviewed logging paths | Session and OTP values are hashed before persistence at [session.ts](apps/api/src/auth/session.ts#L45-L50) and [phone-otp.ts](apps/api/src/auth/phone-otp.ts#L17-L19); invite tokens are returned for delivery but are not logged |
| Google/WhatsApp token encryption at rest | PARTIAL | AES-256-GCM encryption and Google refresh-token persistence are implemented at [token-crypto.ts](apps/api/src/auth/token-crypto.ts#L1-L39) and [auth/index.ts](apps/api/src/auth/index.ts#L23-L50). WhatsApp token storage and a configured production key are not verified |
| Invite single use | PARTIAL | `acceptedAt` is checked and then set at [invites.ts](apps/api/src/people/invites.ts#L138-L158), but the check is outside the transaction and the update is not conditional on `acceptedAt: null`; concurrent acceptance could race |
| Invite wrong-person rejection | PASS | Invitee identity is compared at [invites.ts](apps/api/src/people/invites.ts#L145-L147); covered by invite tests |
| Invite role preservation | PASS for existing membership update | Acceptance writes `invite.role` at [invites.ts](apps/api/src/people/invites.ts#L151-L155); covered by invite tests |
| Invite creates invited membership | FAIL | Invite creation creates an `Invite` but no `Membership` with `status: invited` at [invites.ts](apps/api/src/people/invites.ts#L113-L121); acceptance assumes an existing membership and updates it at [invites.ts](apps/api/src/people/invites.ts#L148-L155) |

**Finding M1-09 - MEDIUM:** Invite acceptance is not atomic against replay. The `acceptedAt` check occurs before the transaction and the update does not include a conditional `acceptedAt: null` predicate at [invites.ts](apps/api/src/people/invites.ts#L138-L158).

## 5. Functionality gaps

### Employee deactivation

**FAIL.** No API route or service deactivates an employee. The UI only contains a static inactive example in [people/page.tsx](apps/web/app/people/page.tsx#L31-L42). There is no implementation that preserves tasks/history while excluding inactive employees from assignee pickers.

### CSV import

**PASS for API/web wiring, UNTESTED live.** The API preview validates headers,
email, phone, dates, and per-row errors in
[csv-import.ts](apps/api/src/people/csv-import.ts#L38-L101). The multipart
preview/import routes are implemented at
[people/routes.ts](apps/api/src/people/routes.ts#L56-L115), and the page submits
the file for preview and import at
[people/import/page.tsx](apps/web/app/people/import/page.tsx#L47-L123). A live
30-employee import has not been executed.

### Organisation tree updates

**PASS for API service, UNTESTED in browser.** `changeManager` validates the target and manager and updates `managerId` in [organization.ts](apps/api/src/people/organization.ts#L56-L78); `listOrganization` retrieves the tree in [organization.ts](apps/api/src/people/organization.ts#L39-L53). The web teams page remains static, so immediate browser refresh evidence is still missing.

### Trial starts automatically with 30 days

**PASS for service logic.** `trialLengthMs` and `trialDurationDays` define 30 days at [onboarding.ts](apps/api/src/companies/onboarding.ts#L4-L5) and [onboarding.ts](apps/api/src/companies/onboarding.ts#L137-L137); creation calculates `trialEndsAt` at [onboarding.ts](apps/api/src/companies/onboarding.ts#L89-L90). The service test verifies the trial date. No trial banner or live onboarding screen is implemented.

## 6. Scope check

### Code present that is not yet represented as a Milestone 1 requirement

- The test-only `x-company-id` and `x-user-id` tenant-header mechanism in [auth-context.ts](apps/api/src/middleware/auth-context.ts#L43-L70).
- OAuth state signing and verification details in [google.ts](apps/api/src/auth/google.ts#L31-L75).
- Email-link authentication, although the specification names email-link sign-in.
- A `people.organization.view` policy action and dedicated `people.manager.change` action in [policy.ts](apps/api/src/policy/policy.ts#L6-L22), beyond the matrix's action labels.
- `generateOpaqueChallengeId` in [phone-otp.ts](apps/api/src/auth/phone-otp.ts#L83-L85), which is not used by the OTP route.
- Static demo employee and organization data in the web application.

### M1-M3 specification items missing from the code

- Google-only browser sign-up flow that completes identity, session creation, and company onboarding.
- Browser-level phone OTP identity completion and session verification.
- Three-step onboarding: add people, create first team, assign first task.
- Trial-days-left banner.
- Persistent invited membership creation.
- Employee deactivation and assignee-picker exclusion.
- Google Sheet import.
- Complete role-change and employee-removal routes.
- Company settings/trial/plan route.
- Task routes needed to prove task visibility, assignment, update, and comments.
- Dashboard browser flow and live database evidence for scoped dashboard behavior.
- Activity-log viewing routes.
- Google and WhatsApp integration routes.
- Production HTTPS enforcement.
- WhatsApp token encryption and configured key-management evidence.
- Cross-company automated tests against every endpoint using a real PostgreSQL database.
- Consent, opt-out, export, delete, and anonymized-history workflows required by the privacy section.

### Hardcoded placeholder data and dead/future routes

| Item | File and line | Finding |
|---|---|---|
| Static people directory | [people/page.tsx](apps/web/app/people/page.tsx#L7-L42) | Employee list is hardcoded and not loaded from the API |
| Static organization tree | [teams/page.tsx](apps/web/app/teams/page.tsx#L7-L25) | Departments, teams, leads, and members are hardcoded |
| Static shell identity | [shell.tsx](apps/web/app/shell.tsx#L7-L16), [shell.tsx](apps/web/app/shell.tsx#L52-L60) | Navigation and current user are placeholders |
| Sample CSV initial state | [people/import/page.tsx](apps/web/app/people/import/page.tsx#L8-L20) | The page starts with sample text, but preview and import now call the API |
| Future navigation links | [shell.tsx](apps/web/app/shell.tsx#L7-L16), [shell.tsx](apps/web/app/shell.tsx#L84-L86) | `/tasks`, `/settings`, `/tasks/new`, and `/people/invite` are linked but no corresponding Milestone 1 implementation was found |

## Summary

| Area | Result | High | Medium | Low |
|---|---|---:|---:|---:|
| Company scoping | FAIL | 1 | 0 | 0 |
| Permissions | FAIL | 0 | 3 | 0 |
| M1-M3 acceptance criteria | FAIL | 0 | 0 | 0 |
| Security | FAIL | 0 | 1 | 0 |
| Functionality | FAIL | 0 | 0 | 0 |
| Scope and placeholders | FAIL | 0 | 0 | 1 |
| **Total** | **FAIL** | **2** | **4** | **1** |

The high-severity findings are:

1. No real PostgreSQL cross-company isolation evidence.
2. The dashboard company lookup is not explicitly scoped and can select the wrong company.
