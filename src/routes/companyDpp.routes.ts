import { Router } from "express";

import {
  generateDpp,
  getCompanyDppMeta,
} from "../controllers/companyDpp.controller";
import { verifyJWT } from "../middlewares/jwt.middleware";
import { authenticatedRateLimiter } from "../middlewares/rateLimit.middleware";

const router = Router();

router.post("/generate", verifyJWT, authenticatedRateLimiter, generateDpp);

router.get("/meta", verifyJWT, authenticatedRateLimiter, getCompanyDppMeta);

export default router;
