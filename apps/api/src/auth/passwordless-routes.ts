import { Router } from "express";
import { sessionCookie } from "./cookie.js";
import { sessionLifetimeSeconds } from "./session.js";
import {
  createEmailLinkService,
  normalizeEmail,
  type EmailLinkSender,
} from "./email-link.js";
import { createOtpService, normalizePhone, type OtpSender } from "./phone-otp.js";

type PasswordlessRouteOptions = {
  otpSender?: OtpSender;
  emailSender?: EmailLinkSender;
  emailLinkBaseUrl?: string;
  onVerified?: (identity: { email?: string; phoneE164?: string }) => Promise<{
    userId?: string;
    sessionToken?: string;
  }>;
};

export function createPasswordlessAuthRouter(options: PasswordlessRouteOptions = {}) {
  const router = Router();
  const otp = options.otpSender ? createOtpService(options.otpSender) : undefined;
  const emailLinks =
    options.emailSender && options.emailLinkBaseUrl
      ? createEmailLinkService(options.emailSender, options.emailLinkBaseUrl)
      : undefined;

  router.post("/phone/request", async (request, response) => {
    if (!otp) {
      response.status(503).json({
        code: "phone_sign_in_disabled",
        message: "Phone sign-in is not configured.",
      });
      return;
    }
    try {
      await otp.request(String(request.body?.phone ?? ""));
      response.status(202).json({
        message: "If the number can receive codes, a verification code was sent.",
      });
    } catch (error) {
      response.status(400).json({
        code: "otp_request_failed",
        message: error instanceof Error ? error.message : "OTP request failed.",
      });
    }
  });

  router.post("/phone/verify", async (request, response) => {
    if (!otp) {
      response.status(503).json({
        code: "phone_sign_in_disabled",
        message: "Phone sign-in is not configured.",
      });
      return;
    }
    if (!options.onVerified) {
      response.status(501).json({
        code: "identity_completion_unavailable",
        message: "Phone identity completion is not configured.",
      });
      return;
    }
    try {
      const phoneE164 = normalizePhone(String(request.body?.phone ?? ""));
      if (!otp.verify(phoneE164, String(request.body?.code ?? ""))) {
        response.status(401).json({
          code: "invalid_otp",
          message: "The verification code is invalid or expired.",
        });
        return;
      }
      const result = await options.onVerified({ phoneE164 });
      if (result?.sessionToken) {
        response.setHeader(
          "Set-Cookie",
          sessionCookie(result.sessionToken, sessionLifetimeSeconds),
        );
      }
      response.json({ verified: true, userId: result?.userId });
    } catch (error) {
      response.status(400).json({
        code: "otp_verification_failed",
        message: error instanceof Error ? error.message : "OTP verification failed.",
      });
    }
  });

  router.post("/email/request", async (request, response) => {
    if (!emailLinks) {
      response.status(503).json({
        code: "email_sign_in_disabled",
        message: "Email sign-in is not configured.",
      });
      return;
    }
    try {
      await emailLinks.request(String(request.body?.email ?? ""));
      response.status(202).json({
        message: "If the address is eligible, a sign-in link was sent.",
      });
    } catch (error) {
      response.status(400).json({
        code: "email_link_request_failed",
        message: error instanceof Error ? error.message : "Email link request failed.",
      });
    }
  });

  router.post("/email/verify", async (request, response) => {
    if (!emailLinks) {
      response.status(503).json({
        code: "email_sign_in_disabled",
        message: "Email sign-in is not configured.",
      });
      return;
    }
    if (!options.onVerified) {
      response.status(501).json({
        code: "identity_completion_unavailable",
        message: "Email identity completion is not configured.",
      });
      return;
    }
    try {
      const email = normalizeEmail(String(request.body?.email ?? ""));
      if (!emailLinks.consume(email, String(request.body?.token ?? ""))) {
        response.status(401).json({
          code: "invalid_email_link",
          message: "The sign-in link is invalid or expired.",
        });
        return;
      }
      const result = await options.onVerified({ email });
      if (result?.sessionToken) {
        response.setHeader(
          "Set-Cookie",
          sessionCookie(result.sessionToken, sessionLifetimeSeconds),
        );
      }
      response.json({ verified: true, userId: result?.userId });
    } catch (error) {
      response.status(400).json({
        code: "email_link_verification_failed",
        message:
          error instanceof Error ? error.message : "Email link verification failed.",
      });
    }
  });

  return router;
}
