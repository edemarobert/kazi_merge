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

