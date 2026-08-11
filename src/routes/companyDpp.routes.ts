import { Router } from "express";

import {
  generateDpp,
  getCompanyDppMeta,
} from "../controllers/companyDpp.controller";
import { verifyJWT } from "../middlewares/jwt.middleware";

const router = Router();

router.post("/generate", verifyJWT, generateDpp);

router.get("/meta", verifyJWT, getCompanyDppMeta);

export default router;
