## 8. Roles, permissions, security and privacy

Three roles cover the MVP, and one shared policy module decides every permission so rules live in one place.

### 8.1 Permission matrix

| Action | Owner | Manager | Employee |
| --- | --- | --- | --- |
| Edit company settings and trial or plan | Yes | No | No |
| Invite managers, change roles, remove people | Yes | No | No |
| Invite employees | Yes | Own teams | No |
| View all employee profiles | Yes | Own teams | Own profile and teammates' basic info |
| Edit employee profiles | Yes | Own teams, non-sensitive fields | Own contact details only |
| Create tasks | Yes | Yes | Own tasks only |
| Assign tasks to others | Yes | Own teams | No |
| View tasks | All | Own teams | Assigned to them or shared in their team |
| Update status and comment | Yes | Own teams | Own tasks |
| View dashboard | Company-wide | Own scope | No |
| View company activity log | Yes | Task history in own scope | Own task history only |
| Connect Google, link WhatsApp | Yes | Yes | Yes (own account) |

### 8.2 Security requirements

- Enforce HTTPS everywhere. Use secure, HTTP-only session cookies, CSRF protection and rate limiting on sign-in, OTP and webhook routes.
- OTP codes expire in 5 minutes, are single-use, and are limited to a small number of attempts per phone number.
- Validate all input on the server. Escape user content wherever it is rendered.
- Encrypt Google refresh tokens and the WhatsApp access token at rest, and keep them out of logs.
- Verify the WhatsApp webhook signature on every request and reject anything that fails.
- Run an automated test that tries cross-company access on every endpoint.
- Back up the database daily and test one restore before the first pilot.

### 8.3 Privacy requirements

Work Merge holds personal data about employees, so build for consent and minimal data from the start, in line with Uganda's Data Protection and Privacy Act, 2019. Confirm exact obligations with a qualified adviser before launch.

- Collect only the profile fields the MVP uses. Do not store national ID numbers, salary or medical information.
- Record WhatsApp opt-in with a timestamp and let people opt out at any time by replying STOP or in settings.
- Show every person what is stored about them and who in the company can see it.
- Let an owner export and delete a company's data on request.
- Keep the activity log for audit, but allow deletion of a person's personal details while keeping anonymised task history.
- Do not use customer data to train AI models without explicit consent.


