## 3. Integration strategy: Google and WhatsApp

Google and WhatsApp are where Kampala teams already work, so Work Merge treats them as front doors, not extras: an employee should be able to join, receive work, update it and finish it without ever opening the Work Merge website. The web app remains the full workspace for owners and managers.

### 3.1 What each integration does

| Integration | MVP capability | Direction | User friction removed |
| --- | --- | --- | --- |
| Google Sign-In | Create account and sign in with a Google account (OpenID Connect) | Google to Work Merge | No new password |
| Google Calendar | Task due dates appear as calendar events for the assignee, updated when the task changes | Work Merge to Google | Deadlines show up in the calendar people already check |
| Google Drive | Attach existing Drive files to a task through the Google Picker; store the link, not a copy | Google to Work Merge | No re-uploading, one version of each file |
| Google Sheets / CSV | Import employees from a Google Sheet or CSV | Google to Work Merge | Moves off the spreadsheet in minutes |
| WhatsApp notifications | Employee gets a WhatsApp message when a task is assigned, due soon, overdue or commented on | Work Merge to WhatsApp | Updates arrive where people already look |
| WhatsApp replies | Employee taps a button (Done, In progress, Blocked) or replies with a note; the task and its thread update | WhatsApp to Work Merge | Update work in seconds without logging in |
| WhatsApp owner digest | Owner receives a short daily summary: overdue, due today, completed | Work Merge to WhatsApp | Visibility without opening a dashboard |
| Phone OTP and SMS | Sign in with a phone number; SMS fallback for people not on WhatsApp | Both | Works for users without Google or smartphones |

Stretch goal after the MVP is stable: a manager sends a WhatsApp message such as "Assign John the customer report by Friday", an LLM drafts the task, and the manager confirms with a button. This is not required for MVP.

### 3.2 Google rules

- Sign-in uses only the `openid`, `email` and `profile` scopes.
- Calendar sync is optional and requested later, only when the user turns it on (incremental authorisation), using the `calendar.events` scope.
- Drive uses the Google Picker with the narrow `drive.file` scope, so Work Merge can only touch files the user explicitly picks. Never request full Drive access.
- Store only the Drive file id, name, URL and MIME type.
- Calendar sync is one-way. Deleting an event in Google does not change the task; completing a task removes or marks its event.
- Plan for Google's OAuth app verification early. Sensitive scopes need it before public launch. While the app is in testing mode, up to 100 named test users can use it, which is enough for the first pilot companies.
- CSV import is the primary employee import. Google Sheets import is a convenience on top.

### 3.3 WhatsApp rules

Use the WhatsApp Business Platform (Cloud API from Meta). These constraints shape the design; confirm current details and pricing in Meta's documentation before building.

- Business-initiated messages need pre-approved message templates. Free-form replies are only allowed inside the 24-hour window after the user last messaged Work Merge.
- The user must opt in. Capture consent with an invite link that opens WhatsApp with a prefilled message (for example `JOIN <code>`). When the employee sends it, the phone number is verified, linked to their profile, and the 24-hour window opens.
- Start with one Work Merge business number shared by all companies. Every message names the company so the employee knows who is writing.
- The webhook must verify Meta's signature, acknowledge within a few seconds, deduplicate by WhatsApp message id, and push the real work onto a queue.
- Do not depend on WhatsApp group chats in the MVP.
- Always have a fallback: if a WhatsApp message fails or the user is not opted in, send SMS or email and show the status in the app.

**Templates to register**

| Template | Trigger | Buttons |
| --- | --- | --- |
| `task_assigned` | A task is assigned to the employee | Start, Open in Work Merge |
| `task_due_soon` | A set time before the due date | Done, Need more time |
| `task_overdue` | The due date has passed and the task is open | Done, Blocked |
| `task_comment` | Someone comments on the employee's task | Reply, Open in Work Merge |
| `owner_daily_digest` | Each morning at the owner's chosen time | Open dashboard |

**Reply handling**

1. A button tap maps to a status change on the task named in the message context.
2. A free-text reply to a task message becomes a comment on that task, marked as sent via WhatsApp.
3. Free text that is not a reply to a task message triggers a list of the sender's open tasks to choose from.
4. Blocked asks for a one-line reason, which is saved on the task.
5. Every WhatsApp-originated change appears in the task thread and activity log exactly like a change made in the app.

### 3.4 Integration code contract

Implement each service behind an interface so it can be swapped or disabled.

```ts
interface MessagingChannel {
  send(to: Recipient, message: OutboundMessage): Promise<DeliveryResult>;
}
interface InboundHandler {
  verify(req: Request): boolean;      // signature check
  parse(req: Request): InboundEvent[]; // button tap, text, status
}
interface CalendarSync {
  upsertTaskEvent(task: Task, user: User): Promise<void>;
  removeTaskEvent(taskId: string, user: User): Promise<void>;
}
interface FilePicker {
  linkFile(fileId: string, user: User): Promise<FileLink>;
}
```

Implementations: `WhatsAppChannel`, `SmsChannel`, `EmailChannel`, `InAppChannel`, `GoogleCalendarSync`, `GoogleDriveLinker`. A `NotificationRouter` chooses the channel per user preference and falls back down the list when delivery fails.


