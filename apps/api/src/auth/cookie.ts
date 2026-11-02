export const sessionCookieName = "kazi_session";

export function readSessionCookie(
  cookieHeader: string | undefined,
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  const sessionCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`));
  return sessionCookie?.slice(sessionCookieName.length + 1);
}
