import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { errorResponse } from "../utils/response";
import { ENV } from "../config/env";
import { logger } from "../config/logger";

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const verifyJWT = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : undefined;
    const cookieToken = req.cookies?.lca_access_token;
    const token = bearerToken || cookieToken;

    if (!token) {
      return res
        .status(401)
        .json(errorResponse("Authorization token is required"));
    }

    if (!ENV.JWT_SECRET) {
      return res.status(500).json(errorResponse("JWT secret is not configured"));
    }

    const signingKey = Buffer.from(ENV.JWT_SECRET, "base64");

    const verifiedPayload = jwt.verify(token, signingKey, {
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;

    if (!verifiedPayload.CompanyId || !verifiedPayload.UserId) {
      return res
        .status(401)
        .json(errorResponse("Token is missing required claims"));
    }

    req.user = verifiedPayload;
    next();
  } catch (error: any) {
    logger.warn({
      message: `JWT verification failed: ${error?.message || "unknown error"}`,
      path: req.originalUrl,
      method: req.method,
      correlationId: req.correlationId,
    });
    // console.log("JWT decode error:", error.message);
    return res.status(401).json(errorResponse("Invalid token"));
  }
};
