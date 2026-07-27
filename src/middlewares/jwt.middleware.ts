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
    // logger.debug({
    //   message: "JWT verification started",
    //   path: req.originalUrl,
    //   method: req.method,
    //   correlationId: req.correlationId,
    // });
    // console.log("Authorization header received");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.warn({
        message: "JWT missing or malformed Authorization header",
        path: req.originalUrl,
        method: req.method,
        correlationId: req.correlationId,
      });
      // console.log("No Bearer token found");
      return res
        .status(401)
        .json(errorResponse("Authorization token is required"));
    }

    const token = authHeader.substring(7); // Remove 'Bearer '
    // console.log("Token extracted");

    const decodedHeader = jwt.decode(token, { complete: true }) as any;
    logger.debug({
      message: `JWT header parsed (alg=${decodedHeader?.header?.alg || "unknown"}, kid=${decodedHeader?.header?.kid || "none"})`,
      path: req.originalUrl,
      method: req.method,
      correlationId: req.correlationId,
    });

    if (!ENV.JWT_SECRET) {
      logger.error({
        message: "JWT verification failed: JWT secret is not configured",
        path: req.originalUrl,
        method: req.method,
        correlationId: req.correlationId,
      });
      return res.status(500).json(errorResponse("JWT secret is not configured"));
    }

    const signingKey = Buffer.from(ENV.JWT_SECRET, "base64");

    if (!signingKey.length) {
      logger.error({
        message: "JWT verification failed: JWT secret is not valid Base64",
        path: req.originalUrl,
        method: req.method,
        correlationId: req.correlationId,
      });
      return res.status(500).json(errorResponse("JWT secret format is invalid"));
    }

    const verifiedPayload = jwt.verify(token, signingKey, {
      algorithms: ["HS256"],
    }) as any;

    if (!verifiedPayload || typeof verifiedPayload !== "object") {
      logger.warn({
        message: "JWT verification failed: invalid token payload",
        path: req.originalUrl,
        method: req.method,
        correlationId: req.correlationId,
      });
      return res.status(401).json(errorResponse("Invalid token payload"));
    }

    if (!verifiedPayload.CompanyId || !verifiedPayload.UserId) {
      logger.warn({
        message: "JWT verification failed: missing required claims",
        path: req.originalUrl,
        method: req.method,
        correlationId: req.correlationId,
      });
      return res
        .status(401)
        .json(errorResponse("Token is missing required claims"));
    }

    // console.log("Decoded JWT payload:", {
    //   UserId: verifiedPayload.UserId,
    //   CompanyId: verifiedPayload.CompanyId,
    //   Role: verifiedPayload.Role,
    //   email: verifiedPayload.email,
    // });

    // Attach user data to request
    req.user = verifiedPayload;
    // logger.info({
    //   message: "JWT verification successful",
    //   path: req.originalUrl,
    //   method: req.method,
    //   correlationId: req.correlationId,
    //   companyId: verifiedPayload.CompanyId,
    //   userId: verifiedPayload.UserId,
    // });
    // console.log("JWT decoded and attached to request");
    next();
  } catch (error: any) {
    const reason = error?.name
      ? `${error.name}: ${error.message}`
      : (error?.message || "unknown verification error");

    logger.warn({
      message: `JWT verification failed: ${reason}`,
      path: req.originalUrl,
      method: req.method,
      correlationId: req.correlationId,
    });
    // console.log("JWT decode error:", error.message);
    return res.status(401).json(errorResponse("Invalid token"));
  }
};
