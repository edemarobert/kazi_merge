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

