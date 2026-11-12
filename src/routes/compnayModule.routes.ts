import { Router } from "express";
import { getCompanyModules } from "../controllers/compnayModule.controller";
import { verifyJWT } from "../middlewares/jwt.middleware";
import { authenticatedRateLimiter } from "../middlewares/rateLimit.middleware";

const router = Router();

router.get(
  "/company-modules",
  verifyJWT,
  authenticatedRateLimiter,
  getCompanyModules,
);

export default router;
