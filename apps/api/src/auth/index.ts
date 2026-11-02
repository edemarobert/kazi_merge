import { prisma } from "../db/prisma.js";
import { companyId, runWithCompanyContextAsync } from "../context/company-context.js";
import { createSessionService } from "./session.js";
import type { GoogleIdentity } from "./google.js";
import { encryptIntegrationToken } from "./token-crypto.js";

export const sessionService = createSessionService(prisma);

export async function completeGoogleIdentity(identity: GoogleIdentity) {
  const user =
    (await prisma.user.findFirst({
      where: { OR: [{ googleSub: identity.subject }, { email: identity.email }] },
    })) ??
    (await prisma.user.create({
      data: {
        googleSub: identity.subject,
        email: identity.email,
        name: identity.name,
        avatarUrl: identity.avatarUrl,
      },
    }));
  const result = await completeUserIdentity(user.id);
  if (identity.refreshToken && result.sessionToken && result.companyId) {
    const refreshToken = identity.refreshToken;
    const activeCompanyId = result.companyId;
    await runWithCompanyContextAsync(
      companyId(activeCompanyId),
      () =>
        prisma.integrationAccount.upsert({
          where: {
            companyId_provider_externalId: {
              companyId: activeCompanyId,
              provider: "google",
              externalId: identity.subject,
            },
          },
          create: {
            companyId: activeCompanyId,
            userId: user.id,
            provider: "google",
            externalId: identity.subject,
            encryptedToken: encryptIntegrationToken(refreshToken),
            scopes: ["openid", "email", "profile"],
            status: "active",
          },
          update: {
            encryptedToken: encryptIntegrationToken(refreshToken),
            status: "active",
          },
        }),
      user.id,
    );
  }
  return result;
}

export async function completePasswordlessIdentity(identity: {
  email?: string;
  phoneE164?: string;
}) {
  const user =
    (await prisma.user.findFirst({
      where: { OR: [{ email: identity.email }, { phoneE164: identity.phoneE164 }] },
    })) ??
    (await prisma.user.create({
      data: {
        email: identity.email,
        phoneE164: identity.phoneE164,
        name: identity.email ?? identity.phoneE164 ?? "Kazi Merge user",
      },
    }));
  return completeUserIdentity(user.id);
}

async function completeUserIdentity(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        where: { status: "active" },
        select: { companyId: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
  const membership = user?.memberships[0];
  if (!membership) {
    return { userId };
  }
  return {
    userId,
    companyId: membership.companyId,
    sessionToken: await sessionService.create(userId, membership.companyId),
  };
}
