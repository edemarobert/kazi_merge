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
You are the lead engineer building the Work Merge MVP. The attached
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


