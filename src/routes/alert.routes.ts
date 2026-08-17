import { Router } from "express";
import {
  loginAlert,
  onboardingAlert,
} from "../controllers/alert.controller";

const router = Router();

router.post("/login", loginAlert);

router.post("/onboarding", onboardingAlert);

export default router;
