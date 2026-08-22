import { Router } from "express";
import {
  loginAlert,
  onboardingAlert,
} from "../controllers/alert.controller";
import { verifyJWT } from "../middlewares/jwt.middleware";
import { alertRateLimiter } from "../middlewares/rateLimit.middleware";

const router = Router();

router.post("/login", verifyJWT, alertRateLimiter, loginAlert);

router.post("/onboarding", verifyJWT, alertRateLimiter, onboardingAlert);

export default router;
