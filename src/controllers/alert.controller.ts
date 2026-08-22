import { Request, Response } from "express";
import {
  sendLoginAlertEmail,
  sendOnboardingAlertEmail,
} from "../services/email.service";
import { logger } from "../config/logger";

function getAlertIdentity(req: Request): {
  email: string;
  userId: number;
  companyId: number;
  userName?: string;
  companyName?: string;
} | null {
  const user = req.user || {};
  const userId = Number(user.UserId);
  const companyId = Number(user.CompanyId);
  const email = String(user.email || user.Email || "").trim();
  const isValidEmail = email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(companyId) || companyId <= 0 || !isValidEmail) {
    return null;
  }

  return {
    email,
    userId,
    companyId,
    userName: String(user.UserName || user.Username || user.userName || user.FullName || user.fullName || "").trim() || undefined,
    companyName: String(user.CompanyName || user.companyName || user.OrganizationName || user.organizationName || "").trim() || undefined,
  };
}

export async function loginAlert(req: Request, res: Response) {
  try {
    const identity = getAlertIdentity(req);

    if (!identity) {
      return res.status(401).json({
        success: false,
        message: "Token is missing required alert identity claims",
      });
    }

    logger.info({
      message: "Login alert requested by authenticated user",
      path: req.originalUrl,
      method: req.method,
      correlationId: req.correlationId,
      userId: identity.userId,
      companyId: identity.companyId,
    });

    await sendLoginAlertEmail({
      email: identity.email,
      userId: identity.userId,
      companyId: identity.companyId,
      userName: identity.userName,
      companyName: identity.companyName,
      hostName: req.hostname,
      correlationId: req.correlationId,
    });

    return res.status(200).json({
      success: true,
      message: "Login alert sent successfully",
    });
  } catch (error) {
    console.error("Login alert error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to send login alert",
    });
  }
}

export async function onboardingAlert(req: Request, res: Response) {
  try {
    const identity = getAlertIdentity(req);

    if (!identity) {
      return res.status(401).json({
        success: false,
        message: "Token is missing required alert identity claims",
      });
    }

    logger.info({
      message: "Onboarding alert requested by authenticated user",
      path: req.originalUrl,
      method: req.method,
      correlationId: req.correlationId,
      userId: identity.userId,
      companyId: identity.companyId,
    });

    const {
      role, phoneNumber, companyType, industry, registrationStatus, registeredAt,
    } = req.body;

    await sendOnboardingAlertEmail({
      email: identity.email,
      userName: identity.userName,
      userId: identity.userId,
      companyName: identity.companyName,
      companyId: identity.companyId,
      role,
      phoneNumber,
      companyType,
      industry,
      registrationStatus,
      registeredAt,
      hostName: req.hostname,
      correlationId: req.correlationId,
    });

    return res.status(200).json({
      success: true,
      message: "Registration alert sent successfully",
    });
  } catch (error) {
    console.error("Onboarding alert error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to send onboarding alert",
    });
  }
}

