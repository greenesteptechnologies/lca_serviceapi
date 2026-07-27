import { Router } from "express";
import { generateAIResponse, saveBulkAIComments } from "../controllers/ai.controller";
import { verifyJWT } from "../middlewares/jwt.middleware";

const router = Router();

// POST /api/v1/ai/generate
router.post("/generate", verifyJWT, generateAIResponse);
router.post("/comments/bulk", verifyJWT, saveBulkAIComments);

export default router;
