import { NextFunction, Request, Response } from "express";
import sql, { getPool } from "../config/db";
import { logger } from "../config/logger";

const serviceName = "LCA.Service.Api";

async function persistApiUsage(
  req: Request,
  responseTimeMs: number,
  statusCode: number,
) {
  const pool = await getPool();

  await pool
    .request()
    .input("CompanyID", sql.BigInt, req.user?.CompanyId ?? null)
    .input("UserID", sql.BigInt, req.user?.UserId ?? null)
    .input("ServiceName", sql.NVarChar(100), serviceName)
    .input("Endpoint", sql.NVarChar(300), req.path)
    .input("HttpMethod", sql.NVarChar(10), req.method)
    .input("ResponseTimeMs", sql.BigInt, responseTimeMs)
    .input("StatusCode", sql.Int, statusCode)
    .input("CorrelationId", sql.NVarChar(100), req.correlationId ?? null)
    .execute("lca_audit.gs_AddAPIUsageLog");
}

export const apiUsageLogMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.path.startsWith("/api/")) {
    return next();
  }

  const startedAt = process.hrtime.bigint();
  let logged = false;

  const logUsage = () => {
    if (logged) {
      return;
    }
    logged = true;

    const responseTimeMs = Math.round(
      Number(process.hrtime.bigint() - startedAt) / 1_000_000,
    );

    void persistApiUsage(req, responseTimeMs, res.statusCode).catch((error) => {
      logger.error({
        message: "Failed to persist API usage log",
        error: error instanceof Error ? error.message : String(error),
        method: req.method,
        endpoint: req.path,
        statusCode: res.statusCode,
        correlationId: req.correlationId,
      });
    });
  };

  res.once("finish", logUsage);
  res.once("close", () => {
    if (!res.writableFinished) {
      logUsage();
    }
  });

  next();
};
