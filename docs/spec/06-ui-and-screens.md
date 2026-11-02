## 7. Look and feel

Work Merge should feel like a calm, plain-spoken to-do board for a business, not like heavy HR software. A first-time user should understand every screen without training.

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

