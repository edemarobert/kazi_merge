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

