import { Router } from "express";
import {
	getLLMModels,
	getSystemSecret,
} from "../controllers/secrets.controller";
import { verifyJWT } from "../middlewares/jwt.middleware";
import { authenticatedRateLimiter } from "../middlewares/rateLimit.middleware";

const router = Router();

router.get("/system-secret/:secretName",verifyJWT,authenticatedRateLimiter, getSystemSecret);
router.get("/llm-models", verifyJWT, authenticatedRateLimiter, getLLMModels);

export default router;
