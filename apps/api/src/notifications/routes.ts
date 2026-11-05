import { Router } from "express";
import { getActorUserId, requireCompanyId } from "../context/company-context.js";
import { prisma } from "../db/prisma.js";

function actorUserId(): string {
  const userId = getActorUserId();
  if (!userId) throw new Error("An authenticated actor is required.");
  return userId;
}

export function createNotificationsRouter() {
  const router = Router();

  router.get("/", async (_request, response, next) => {
    try {
      const notifications = await prisma.notification.findMany({
        where: { recipientUserId: actorUserId() },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      response.json({ notifications });
    } catch (error) {
      next(error);
    }
  });

  router.get("/preferences", async (_request, response, next) => {
    try {
      const preferences = await prisma.notificationPreference.findUnique({
        where: {
          companyId_userId: {
            companyId: requireCompanyId(),
            userId: actorUserId(),
          },
        },
      });
      response.json({
        preferences: preferences ?? {
          whatsappEnabled: false,
          smsEnabled: true,
          emailEnabled: true,
          digestTime: null,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/preferences", async (request, response, next) => {
    try {
      const body = request.body ?? {};
      const values = ["whatsappEnabled", "smsEnabled", "emailEnabled"] as const;
      const data: {
        whatsappEnabled?: boolean;
        smsEnabled?: boolean;
        emailEnabled?: boolean;
        digestTime?: string | null;
      } = {};
      for (const key of values) {
        if (body[key] !== undefined && typeof body[key] !== "boolean") {
          response.status(400).json({
            code: "invalid_notification_preferences",
            message: `${key} must be a boolean.`,
          });
          return;
        }
        if (body[key] !== undefined) data[key] = body[key];
      }
      if (body.digestTime !== undefined && body.digestTime !== null) {
        if (
          typeof body.digestTime !== "string" ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.digestTime)
        ) {
          response.status(400).json({
            code: "invalid_notification_preferences",
            message: "digestTime must use HH:mm format.",
          });
          return;
        }
        data.digestTime = body.digestTime;
      } else if (body.digestTime === null) {
        data.digestTime = null;
      }
      const preferences = await prisma.notificationPreference.upsert({
        where: {
          companyId_userId: {
            companyId: requireCompanyId(),
            userId: actorUserId(),
          },
        },
        create: {
          companyId: requireCompanyId(),
          userId: actorUserId(),
          whatsappEnabled: data.whatsappEnabled ?? false,
          smsEnabled: data.smsEnabled ?? true,
          emailEnabled: data.emailEnabled ?? true,
          digestTime: data.digestTime ?? null,
        },
        update: data,
      });
      response.json({ preferences });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
