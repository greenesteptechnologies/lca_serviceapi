import { Request, Response } from "express";
import {
  sendLoginAlertEmail,
  sendOnboardingAlertEmail,
} from "../services/email.service";
import { logger } from "../config/logger";

export async function loginAlert(req: Request, res: Response) {
  try {
    logger.info({
      message: "Login alert data received from UI",
      path: req.originalUrl,
      method: req.method,
      correlationId: req.correlationId,
      payload: req.body,
    });

    const { email, userId, companyId, userName, companyName, hostName, correlationId } =
      req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    await sendLoginAlertEmail({
      email,
      userId,
      companyId,
      userName,
      companyName,
      hostName,
      correlationId,
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
    logger.info({
      message: "Onboarding alert data received from UI",
      path: req.originalUrl,
      method: req.method,
      correlationId: req.correlationId,
      payload: req.body,
    });

    const {
      email, userName, userId, companyName, companyId, role, phoneNumber,
      companyType, industry, registrationStatus, registeredAt, hostName, correlationId,
    } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    await sendOnboardingAlertEmail({
      email,
      userName,
      userId,
      companyName,
      companyId,
      role,
      phoneNumber,
      companyType,
      industry,
      registrationStatus,
      registeredAt,
      hostName,
      correlationId,
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

