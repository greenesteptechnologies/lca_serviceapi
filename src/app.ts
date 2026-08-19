import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { ENV } from "./config/env";
import { logger } from "./config/logger";

import { requestMiddleware } from "./middlewares/request.middleware";
import { errorHandler } from "./middlewares/error.middleware";

import aiRoutes from "./routes/ai.routes";
import secretsRoutes from "./routes/secrets.routes";
import companyDppRoutes from "./routes/companyDpp.routes";
import { serveCompanyDppHtml } from "./controllers/companyDpp.controller";
import alertRoutes from "./routes/alert.routes";

import { swaggerServe, swaggerSetup } from "./config/swagger";

const app = express();

// SECURITY HEADERS
app.use(helmet());

// REQUEST PARSER
app.use(express.json());
app.use(cookieParser());

// REQUEST CONTEXT / CORRELATION ID
app.use(requestMiddleware);

// CORS CONFIGURATION
const normalizeOrigin = (value: string) =>
  value.trim().toLowerCase().replace(/\/+$/, "");

const allowedOrigins = (ENV.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

const allowAllOrigins = allowedOrigins.includes("*");

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow mobile apps / Postman / server-to-server
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = normalizeOrigin(origin);

      if (allowAllOrigins || allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      logger.warn({
        message: "Blocked by CORS",
        origin,
      });

      return callback(new Error("Not allowed by CORS"));
    },

    credentials: true,

    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-api-key",
      "x-correlation-id",
    ],

    optionsSuccessStatus: 200,
  }),
);

// REQUEST LOGGING
morgan.token("correlation-id", (req: any) => req.correlationId);

app.use(
  morgan(
    ":method :url :status :response-time ms - :res[content-length] [cid::correlation-id]",
    {
      stream: {
        write: (message) => {
          logger.info(message.trim());
        },
      },
    },
  ),
);

// GLOBAL API KEY MIDDLEWARE

app.use((req, res, next) => {
  // Public routes
  if (
    req.method === "OPTIONS" ||
    req.path === "/" ||
    req.path === "/health" ||
    req.path.startsWith("/swagger") ||
    req.path.startsWith("/dpp")
  ) {
    return next();
  }

  const apiKey = req.headers["x-api-key"];

  if (apiKey !== ENV.API_KEY) {
    logger.warn({
      message: "API key mismatch",
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
      correlationId: req.correlationId,
    });

    return res.status(403).json({
      success: false,
      message: "Forbidden",
      correlationId: req.correlationId,
    });
  }

  next();
});

// SWAGGER
app.use("/swagger", swaggerServe, swaggerSetup);

// Base Route
app.get("/", (_req, res) => {
  res.send("Server is running!");
});


// Public DPP HTML route
app.get("/dpp/:publicToken", serveCompanyDppHtml);

// Health Route
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// API ROUTES

app.use("/api/v1/ai", aiRoutes);
app.use("/api/v1/secrets", secretsRoutes);
app.use("/api/v1/dpp", companyDppRoutes);
app.use("/api/v1/alerts", alertRoutes);

// GLOBAL ERROR HANDLER
app.use(errorHandler);

export default app;
