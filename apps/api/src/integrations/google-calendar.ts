import type { GoogleConfig } from "../auth/google.js";

export type CalendarTask = {
  id: string;
  title: string;
  description: string | null;
  dueAt: Date;
  googleCalendarEventId: string | null;
};

export type CalendarUser = { id: string };

export interface CalendarSync {
  upsertTaskEvent(task: CalendarTask, user: CalendarUser): Promise<void>;
  removeTaskEvent(taskId: string, user: CalendarUser): Promise<void>;
}

type GoogleCalendarEvent = {
  id?: string;
};

export class GoogleCalendarSync implements CalendarSync {
  public lastEventId: string | undefined;

  public constructor(
    private readonly refreshToken: string,
    private readonly config: GoogleConfig,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async accessToken(): Promise<string> {
    const response = await this.fetcher("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!response.ok) throw new Error("Google Calendar token refresh failed.");
    const body = (await response.json()) as { access_token?: string };
    if (!body.access_token)
      throw new Error("Google did not return a Calendar access token.");
    return body.access_token;
  }

  public async upsertTaskEvent(task: CalendarTask, _user: CalendarUser): Promise<void> {
    const accessToken = await this.accessToken();
    const endAt = new Date(task.dueAt.getTime() + 60 * 60 * 1000);
    const event = {
      summary: task.title,
      description: task.description ?? undefined,
      start: { dateTime: task.dueAt.toISOString(), timeZone: "UTC" },
      end: { dateTime: endAt.toISOString(), timeZone: "UTC" },
    };
    const url = task.googleCalendarEventId
      ? "https://www.googleapis.com/calendar/v3/calendars/primary/events/" +
        encodeURIComponent(task.googleCalendarEventId)
      : "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    const response = await this.fetcher(url, {
      method: task.googleCalendarEventId ? "PATCH" : "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });
    if (!response.ok) throw new Error("Google Calendar event synchronization failed.");
    const body = (await response.json()) as GoogleCalendarEvent;
    if (!body.id) throw new Error("Google Calendar did not return an event id.");
    this.lastEventId = body.id;
  }

  public async removeTaskEvent(taskId: string, _user: CalendarUser): Promise<void> {
    const accessToken = await this.accessToken();
    const response = await this.fetcher(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events/" +
        encodeURIComponent(taskId),
      {
        method: "DELETE",
        headers: { Authorization: "Bearer " + accessToken },
      },
    );
    if (!response.ok && response.status !== 404) {
      throw new Error("Google Calendar event removal failed.");
    }
  }
}
