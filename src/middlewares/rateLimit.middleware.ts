import { NextFunction, Request, Response } from "express";

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Process-local rate limiter. For a multi-instance deployment, enforce the
 * same limits at the gateway or replace this store with Redis.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const requests = new Map<string, RateLimitEntry>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = options.keyGenerator?.(req) || req.ip || "unknown";
    const existing = requests.get(key);
    const entry = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : existing;

    entry.count += 1;
    requests.set(key, entry);

    const remaining = Math.max(0, options.max - entry.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

    res.setHeader("RateLimit-Limit", options.max);
    res.setHeader("RateLimit-Remaining", remaining);
    res.setHeader("RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count > options.max) {
      res.setHeader("Retry-After", retryAfterSeconds);
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
        correlationId: req.correlationId,
      });
    }

    // Periodically discard expired entries so long-running instances do not
    // retain old client keys indefinitely.
    if (requests.size > 10_000) {
      for (const [storedKey, storedEntry] of requests) {
        if (storedEntry.resetAt <= now) requests.delete(storedKey);
      }
    }

    next();
  };
}

export const globalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
});

const authenticatedUserKey = (req: Request) =>
  `${req.ip || "unknown"}:${req.user?.CompanyId || "unknown"}:${req.user?.UserId || "unknown"}`;

// Applied only after verifyJWT. This prevents one authenticated account from
// exhausting a shared IP's quota while still limiting a stolen token by IP.
export const authenticatedRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  keyGenerator: authenticatedUserKey,
});

export const alertRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: authenticatedUserKey,
});
