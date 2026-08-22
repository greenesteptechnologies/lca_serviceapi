import { Router } from "express";
import { generateAIResponse, getAIComments, saveBulkAIComments } from "../controllers/ai.controller";
import { verifyJWT } from "../middlewares/jwt.middleware";
import { authenticatedRateLimiter } from "../middlewares/rateLimit.middleware";

const router = Router();

// POST /api/v1/ai/generate
router.post("/generate", verifyJWT, authenticatedRateLimiter, generateAIResponse);
// router.get("/comments", verifyJWT, authenticatedRateLimiter, getAIComments);
router.get("/comments", verifyJWT, authenticatedRateLimiter, getAIComments);

router.post("/comments/bulk", verifyJWT, authenticatedRateLimiter, saveBulkAIComments);

export default router;
