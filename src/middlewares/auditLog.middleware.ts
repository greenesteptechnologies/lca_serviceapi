import { NextFunction, Request, Response } from "express";
import { getPool } from "../config/db";
import { logger } from "../config/logger";
import { persistApiAuditLog } from "../services/auditLog.service";

const actionByMethod: Record<string, string> = {
  GET: "FETCH",
  POST: "INSERT",
  PUT: "UPDATE",
  PATCH: "UPDATE",
  DELETE: "DELETE",
};

const sensitiveFieldPattern =
  /password|passwd|pwd|secret|token|credential|authorization|api.?key|client.?key|private.?key|salt/i;

function sanitizeAuditData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeAuditData);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, nestedValue]) =>
        sensitiveFieldPattern.test(key)
          ? []
          : [[key, sanitizeAuditData(nestedValue)]],
      ),
    );
  }

  return value;
}

function getEndpoint(req: Request): string {
  if (typeof req.route?.path === "string") {
    const apiPrefix = req.originalUrl.match(/^\/api\/v\d+\/[^/?]+/i)?.[0];
    if (apiPrefix) {
      return `${apiPrefix}${req.route.path}`.replace(/\/+/g, "/");
    }
  }

  let endpoint = req.originalUrl.split("?")[0];

  for (const [name, rawValue] of Object.entries(req.params)) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (value) {
        endpoint = endpoint.replace(
          encodeURIComponent(value),
          `:${name}`,
        );
      }
    }
  }

  return endpoint.replace(/\/+/g, "/");
}

function pascalCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function getEntityName(endpoint: string): string {
  const segments = endpoint
    .replace(/^\/api\/v\d+\/?/i, "")
    .split("/")
    .filter(Boolean);
  const root = (segments[0] || "ApiRequest").toLowerCase();
  const child = (segments[1] || "").toLowerCase();

  if (root === "dpp") {
    return "CompanyDigitalPassport";
  }
  if (root === "ai" && child === "comments") {
    return "CarbonAssessmentAIComment";
  }
  if (root === "ai" && child === "generate") {
    return "AIResponse";
  }
  if (root === "secrets" && child === "llm-models") {
    return "AIModelConfiguration";
  }
  if (root === "secrets" && child === "system-secret") {
    return "SystemSecret";
  }
  if (root === "alerts" && child === "login") {
    return "LoginAlert";
  }
  if (root === "alerts" && child === "onboarding") {
    return "OnboardingAlert";
  }

  const ignoredSegments = new Set([
    "api", "v1", "generate", "meta", "preview", "status", "bulk",
    "login", "onboarding", "comments",
  ]);
  const resourceSegment = segments.find(
    (segment) => !ignoredSegments.has(segment.toLowerCase()) && !segment.startsWith(":"),
  );

  return resourceSegment
    ? pascalCase(resourceSegment.replace(/s$/, ""))
    : `${pascalCase(root)}Request`;
}

function findEntityKey(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const key = findEntityKey(item);
      if (key) return key;
    }
    return null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const entries = Object.entries(value);
  const match = entries.find(
    ([name, item]) =>
      /(?:^id$|id$|guid$|uuid$)/i.test(name) &&
      !/^(company|user|correlation|request)id$/i.test(name) &&
      !sensitiveFieldPattern.test(name) &&
      (typeof item === "string" || typeof item === "number") &&
      String(item).trim().length > 0,
  );

  if (match) {
    return String(match[1]);
  }

  for (const [, nestedValue] of entries) {
    const key = findEntityKey(nestedValue);
    if (key) {
      return key;
    }
  }

  return null;
}

function getEntityKey(req: Request, responsePayload: unknown): string | null {
  return (
    findEntityKey(responsePayload) ??
    findEntityKey(req.params) ??
    findEntityKey(req.body) ??
    findEntityKey(req.query)
  );
}

export const auditLogMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const action = actionByMethod[req.method];
  if (!req.path.startsWith("/api/") || !action) {
    return next();
  }

  let responsePayload: unknown;
  const originalJson = res.json;
  res.json = function (
    this: Response,
    body?: Parameters<Response["json"]>[0],
  ) {
    responsePayload = body;
    return originalJson.call(this, body);
  };

  res.once("finish", () => {
    const companyId = Number(req.user?.CompanyId);
    const userId = Number(req.user?.UserId);
    const correlationId = req.correlationId ?? "";

    if (
      !Number.isInteger(companyId) ||
      companyId <= 0 ||
      !Number.isInteger(userId) ||
      userId <= 0 ||
      !correlationId
    ) {
      logger.warn({
        message: "Skipping API audit log because authenticated identity is unavailable",
        method: req.method,
        endpoint: req.path,
        statusCode: res.statusCode,
        correlationId,
      });
      return;
    }

    const endpoint = getEndpoint(req);
    const isSecretEndpoint =
      /^\/api\/v\d+\/secrets\/system-secret(?:\/|$)/i.test(endpoint);
    const serializedResponse = responsePayload === undefined
      ? "null"
      : JSON.stringify(responsePayload);
    const responseData = isSecretEndpoint
      ? "[REDACTED]"
      : serializedResponse === undefined
        ? "null"
        : JSON.stringify(
            sanitizeAuditData(JSON.parse(serializedResponse)),
          );
    const details = JSON.stringify({
      Old: null,
      New: responseData,
    });

    const normalizedEndpoint = endpoint.toLowerCase();
    const actionName =
      req.method === "POST" && normalizedEndpoint.endsWith("/comments/bulk")
        ? "UPSERT"
        : action;

    void getPool()
      .then((pool) =>
        persistApiAuditLog(pool, {
          companyId,
          userId,
          serviceName: "LCA.Tenant.Api",
          action: actionName,
          actionStatus: res.statusCode < 400 ? "SUCCESS" : "FAILED",
          entityName: getEntityName(endpoint),
          entityKey: getEntityKey(req, responsePayload),
          details,
          correlationId,
        }),
      )
      .catch((error) => {
        logger.error({
          message: "Failed to persist API audit log",
          error: error instanceof Error ? error.message : String(error),
          method: req.method,
          endpoint,
          statusCode: res.statusCode,
          correlationId,
        });
      });
  });

  next();
};
