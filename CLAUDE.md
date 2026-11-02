# Kazi Merge engineering guide

## What Kazi Merge is

Kazi Merge is a mobile-first work operating system for growing Kampala businesses.
It connects employees, teams, tasks, conversations, progress, and completion in one
record of work. Owners and managers use the web workspace while employees can
receive and update work through WhatsApp or a lightweight phone experience.

## Stack and conventions

- Next.js (React, TypeScript), Tailwind CSS, installable PWA
- Node.js, Express, and TypeScript API organized as a modular monolith
- PostgreSQL (Supabase) with Prisma
- Redis and BullMQ for background jobs
- Africa's Talking for SMS and OTP fallback; Railway for hosting
- UUIDs; UTC storage with Africa/Kampala display; E.164 phone numbers
- Cursor pagination; errors shaped as `{ code, message, details? }`
- Every state change writes an activity-log row; notifications run in the worker
- Encrypt secrets at rest, never log tokens, and soft-delete people and tasks

## Hard rules

- Every business-owned table carries `company_id`, and every query is scoped by it.
- Every route uses the shared policy module for permissions.
- Google, WhatsApp, SMS, and email integrations use adapter interfaces.
- The core product must work with Google and WhatsApp disabled.
- Design mobile-first and for low bandwidth before optimizing desktop.
- Build only MVP scope; ask the product owner when the specification is silent.
- The text specification is authoritative over wireframes.

## Working method

Work on one small task at a time and finish its tests before calling it done.
Read `PROGRESS.md` at the start of every session and update it at the end.
Work milestone by milestone; do not begin the next milestone until the current
acceptance criteria pass. Review migrations and permission rules carefully.

## Specification map

| Task | Read |
| --- | --- |
| Product scope and stack | `docs/spec/01-overview.md` |
| Google, WhatsApp, and adapters | `docs/spec/02-integrations.md` |
| Services, modules, and conventions | `docs/spec/03-architecture.md` |
| Prisma entities and data rules | `docs/spec/04-data-model.md` |
| Feature requirements and acceptance | `docs/spec/05-modules-and-acceptance.md` |
| UI principles and screens | `docs/spec/06-ui-and-screens.md` |
| Roles, security, and privacy | `docs/spec/07-security-and-permissions.md` |
| Build order and milestone prompts | `docs/spec/08-milestones.md` |
| Product decisions requiring confirmation | `docs/spec/09-open-questions.md` |
