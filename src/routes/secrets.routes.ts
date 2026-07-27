import { Router } from "express";
import {
	getLLMModels,
	getSystemSecret,
} from "../controllers/secrets.controller";
import { verifyJWT } from "../middlewares/jwt.middleware";

const router = Router();

router.get("/system-secret/:secretName", getSystemSecret);
router.get("/llm-models", verifyJWT, getLLMModels);

export default router;
