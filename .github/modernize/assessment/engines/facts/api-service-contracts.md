# API & Service Communication Contracts

The application exposes a versioned Express REST API for the web client. The Google Drive attachment flow is synchronous: the client submits validated Drive metadata to the API, which authorizes the task update and stores only the link metadata in the task thread.

## Service Catalog

| Service | Port | Category | Purpose |
|---|---:|---|---|
| Web | 3000 | API client | Next.js task and company screens |
| API | 4000 | API Layer | Authenticated, company-scoped REST API |
| PostgreSQL | 5432 | Infrastructure | Prisma persistence |
| Google Drive | HTTPS | External Service | Source of linked files; files are not copied |

## API Endpoints Inventory

| Service | Method | Path | Request Type | Response Type |
|---|---|---|---|---|
| API | GET | `/api/v1/tasks/:taskId` | Task path parameter | Task detail with updates |
| API | POST | `/api/v1/tasks/:taskId/comments` | JSON comment | Task update |
| API | POST | `/api/v1/tasks/:taskId/comments/attachments` | Multipart comment and file | Task update and attachment |
| API | POST | `/api/v1/tasks/:taskId/comments/drive-links` | JSON DriveLinkInput | Task update and attachment |
| API | PATCH | `/api/v1/tasks/:taskId/status` | JSON status change | Task and status update |
| API | GET | `/api/v1/health` | None | Health status |

## Management & Observability Endpoints

| Service | Endpoint | Custom Metrics |
|---|---|---|
| API | `/api/v1/health` | None |

## DTOs & Contracts

`DriveLinkInput` is an immutable-at-boundary request contract containing a display name, an HTTPS Drive URL, and an optional Drive file ID. The API returns the created task update and attachment metadata. It stores the original Drive URL and file ID only; OAuth tokens and file contents remain outside this contract.

`TaskUpdate` and `Attachment` are service-level persistence entities returned as response data. Invalid URLs, missing names, unsupported hosts, and unauthorized task access produce 400 or 403 responses.

## Communication Patterns

The web client communicates synchronously with the API over REST using authenticated session credentials. The API performs a company-scoped policy check, creates the task update, creates the Drive-link attachment, and records an activity row. No asynchronous broker, retry policy, circuit breaker, or service discovery is configured for this flow.

## Service Technology Matrix

| Service | Web | Data Access | Discovery | Gateway | Actuator | Cache | Metrics |
|---|---|---|---|---|---|---|---|
| Web | Next.js | REST client | None | None | None | None | None |
| API | Express | Prisma | None | None | Health route | None | None |

## Service Communication Sequence

<!-- mermaid-checked: every participant uses `participant Id as "Label"`, no \n in aliases/messages/notes, every alt/opt/loop closed by end, no `:` inside any alias -->
~~~mermaid
sequenceDiagram
    participant Client as "Web Client"
    participant Api as "Kazi Merge API"
    participant Policy as "Task Policy"
    participant DB as "PostgreSQL"
    participant Drive as "Google Drive"

    Client->>Api: POST drive link metadata
    Api->>Policy: authorize task update
    alt Authorized
        Policy-->>Api: allow
        Api->>DB: create TaskUpdate and Attachment
        DB-->>Api: persisted metadata
        Api->>DB: create activity row
        DB-->>Api: activity recorded
        Api-->>Client: 201 update and attachment
        Client->>Drive: open stored HTTPS link
        Drive-->>Client: Drive file
    else Denied
        Policy-->>Api: deny
        Api-->>Client: 403 forbidden
    end
~~~