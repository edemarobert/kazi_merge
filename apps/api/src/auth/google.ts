import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const tokenInfoEndpoint = "https://oauth2.googleapis.com/tokeninfo";
const googleScopes = ["openid", "email", "profile"] as const;
const stateLifetimeSeconds = 10 * 60;

export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  stateSecret: string;
};

export type GoogleIdentity = {
  subject: string;
  email?: string;
  name: string;
  avatarUrl?: string;
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
  return { clientId, clientSecret, redirectUri, stateSecret };
}

function signState(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createGoogleState(secret: string, now = Date.now()): string {
  const payload = JSON.stringify({
    nonce: randomBytes(16).toString("base64url"),
    expiresAt: now + stateLifetimeSeconds * 1000,
  });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  return `${encodedPayload}.${signState(encodedPayload, secret)}`;
}

export function verifyGoogleState(
  state: string,
  secret: string,
  now = Date.now(),
): boolean {
  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) {
    return false;
  }
  const expected = signState(encodedPayload, secret);
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return false;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as { expiresAt?: number; nonce?: string };
    return Boolean(payload.nonce && payload.expiresAt && payload.expiresAt > now);
  } catch {
    return false;
  }
}

export function createGoogleOAuthClient(
  config: GoogleConfig,
  fetcher: typeof fetch = fetch,
) {
  return {
    authorizationUrl(state: string): string {
      const url = new URL(authorizationEndpoint);
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("redirect_uri", config.redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", googleScopes.join(" "));
      url.searchParams.set("state", state);
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "select_account");
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
        `${tokenInfoEndpoint}?id_token=${encodeURIComponent(tokenBody.id_token)}`,
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
  };
}

export const googleScopesText = googleScopes.join(" ");
