import { Router } from "express";

import {
  generateDpp,
  getCompanyDppMeta,
  previewCompanyDppHtml,
  updateDppStatus,
} from "../controllers/dpp.controller";
import { verifyJWT } from "../middlewares/jwt.middleware";
import { authenticatedRateLimiter } from "../middlewares/rateLimit.middleware";

const router = Router();

router.post("/generate", verifyJWT, authenticatedRateLimiter, generateDpp);

router.get("/meta", verifyJWT, authenticatedRateLimiter, getCompanyDppMeta);
router.patch("/:companyDigitalPassportId/status", verifyJWT, authenticatedRateLimiter, updateDppStatus);
router.get("/preview/:publicToken", verifyJWT, authenticatedRateLimiter, previewCompanyDppHtml);

export default router;
