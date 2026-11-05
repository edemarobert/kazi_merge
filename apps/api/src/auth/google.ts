import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const tokenInfoEndpoint = "https://oauth2.googleapis.com/tokeninfo";
const googleScopes = ["openid", "email", "profile"] as const;
export const googleIdentityScopes = [...googleScopes];
export const googleCalendarScope = "https://www.googleapis.com/auth/calendar.events";
const stateLifetimeSeconds = 10 * 60;

export type GoogleAuthorizationPurpose = "sign_in" | "calendar";

export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  calendarRedirectUri?: string;
  stateSecret: string;
};

export type GoogleIdentity = {
  subject: string;
  email?: string;
  name: string;
  avatarUrl?: string;
  refreshToken?: string;
};

export type GoogleCalendarToken = {
  refreshToken?: string;
};

export function readGoogleConfig(
  environment: NodeJS.ProcessEnv = process.env,
): GoogleConfig | null {
  const clientId = environment.GOOGLE_CLIENT_ID;
  const clientSecret = environment.GOOGLE_CLIENT_SECRET;
  const redirectUri = environment.GOOGLE_REDIRECT_URI;
  const stateSecret = environment.SESSION_SECRET;
  if (!clientId || !clientSecret || !redirectUri || !stateSecret) {
    return null;
  }
  return {
    clientId,
    clientSecret,
    redirectUri,
    calendarRedirectUri: environment.GOOGLE_CALENDAR_REDIRECT_URI,
    stateSecret,
  };
}

function signState(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createGoogleState(
  secret: string,
  now = Date.now(),
  purpose: GoogleAuthorizationPurpose = "sign_in",
): string {
  const payload = JSON.stringify({
    nonce: randomBytes(16).toString("base64url"),
    expiresAt: now + stateLifetimeSeconds * 1000,
    purpose,
  });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  return encodedPayload + "." + signState(encodedPayload, secret);
}

export function readGoogleState(
  state: string,
  secret: string,
  now = Date.now(),
): { purpose: GoogleAuthorizationPurpose } | null {
  const parts = state.split(".");
  const encodedPayload = parts[0];
  const signature = parts[1];
  if (!encodedPayload || !signature) return null;
  const expected = signState(encodedPayload, secret);
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as {
      expiresAt?: number;
      nonce?: string;
      purpose?: GoogleAuthorizationPurpose;
    };
    if (
      !payload.nonce ||
      !payload.expiresAt ||
      payload.expiresAt <= now ||
      (payload.purpose !== "sign_in" && payload.purpose !== "calendar")
    ) {
      return null;
    }
    return { purpose: payload.purpose };
  } catch {
    return null;
  }
}

export function verifyGoogleState(
  state: string,
  secret: string,
  now = Date.now(),
): boolean {
  return readGoogleState(state, secret, now) !== null;
}

export function createGoogleOAuthClient(
  config: GoogleConfig,
  fetcher: typeof fetch = fetch,
) {
  return {
    authorizationUrl(
      state: string,
      scopes: readonly string[] = googleScopes,
      prompt = "select_account",
      includeGrantedScopes = false,
    ): string {
      const url = new URL(authorizationEndpoint);
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("redirect_uri", config.redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", scopes.join(" "));
      url.searchParams.set("state", state);
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", prompt);
      if (includeGrantedScopes) {
        url.searchParams.set("include_granted_scopes", "true");
      }
      return url.toString();
    },

    async exchangeCode(code: string): Promise<GoogleIdentity> {
      const tokenResponse = await fetcher(tokenEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
          grant_type: "authorization_code",
        }),
      });
      if (!tokenResponse.ok) {
        throw new Error("Google authorization code exchange failed.");
      }
      const tokenBody = (await tokenResponse.json()) as {
        id_token?: string;
        refresh_token?: string;
      };
      if (!tokenBody.id_token) {
        throw new Error("Google did not return an identity token.");
      }

      const identityResponse = await fetcher(
        tokenInfoEndpoint + "?id_token=" + encodeURIComponent(tokenBody.id_token),
      );
      if (!identityResponse.ok) {
        throw new Error("Google identity verification failed.");
      }
      const identity = (await identityResponse.json()) as {
        sub?: string;
        email?: string;
        email_verified?: string;
        name?: string;
        picture?: string;
        aud?: string;
      };
      if (
        !identity.sub ||
        identity.aud !== config.clientId ||
        identity.email_verified !== "true" ||
        !identity.name
      ) {
        throw new Error("Google returned an invalid identity.");
      }
      return {
        subject: identity.sub,
        email: identity.email,
        name: identity.name,
        avatarUrl: identity.picture,
        ...(tokenBody.refresh_token ? { refreshToken: tokenBody.refresh_token } : {}),
      };
    },

    async exchangeCalendarCode(code: string): Promise<GoogleCalendarToken> {
      const tokenResponse = await fetcher(tokenEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
          grant_type: "authorization_code",
        }),
      });
      if (!tokenResponse.ok) {
        throw new Error("Google Calendar authorization failed.");
      }
      const tokenBody = (await tokenResponse.json()) as {
        refresh_token?: string;
      };
      return { refreshToken: tokenBody.refresh_token };
    },
  };
}

export const googleScopesText = googleScopes.join(" ");

export async function revokeGoogleToken(
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
  if (!response.ok) throw new Error("Google token revocation failed.");
}
