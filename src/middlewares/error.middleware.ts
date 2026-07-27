import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";
import { errorResponse } from "../utils/response";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.status || 500;
  const safeMessage = statusCode >= 500
    ? "Internal Server Error"
    : err.message || "Request failed";

  logger.error({
    message: err.message,
    stack: err.stack,
    code: err.code,
    field: err.field,
    correlationId: req.correlationId,
    method: req.method,
    url: req.originalUrl,
  });

  res.status(statusCode).json(
    errorResponse(
      safeMessage,
      {
        correlationId: req.correlationId,
        originalUrl: req.originalUrl,
      },
      err.code,
      err.field ?? null,
    ),
  );
};