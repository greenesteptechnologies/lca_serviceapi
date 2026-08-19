import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const candidateEnvPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../.env"),
].filter((envPath, index, arr) => arr.indexOf(envPath) === index);

const resolvedEnvPath = candidateEnvPaths.find((envPath) => fs.existsSync(envPath)) || candidateEnvPaths[0];

dotenv.config({ path: resolvedEnvPath });

export const ENV = {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV || "development",
  DB_User: process.env.DB_USER as string,
  DB_PASSWORD: process.env.DB_PASSWORD as string,
  DB_SERVER: process.env.DB_SERVER as string,
  DB_NAME: process.env.DB_NAME as string,
  DB_PORT: parseInt(process.env.DB_PORT || "1433", 10),
  // Secondary DB configuration is disabled for now.
  // DB2_User: process.env.DB2_USER || process.env.DB_USER,
  // DB2_PASSWORD: process.env.DB2_PASSWORD || process.env.DB_PASSWORD,
  // DB2_SERVER: process.env.DB2_SERVER || process.env.DB_SERVER,
  // DB2_NAME: process.env.DB2_NAME || "Scenario_Analysis",
  // DB2_PORT: parseInt(process.env.DB2_PORT || process.env.DB_PORT || "1433", 10),
  API_KEY: process.env.API_KEY as string,
  JWT_SECRET: process.env.JWT_SECRET as string,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "",
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_SECURE: process.env.SMTP_SECURE === "true",
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "587", 10),
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || "",
  SMTP_ALERT_FROM: process.env.SMTP_ALERT_FROM || "",
  SMTP_ALERT_TO: process.env.SMTP_ALERT_TO || "",
  LOG_LEVEL: process.env.LOG_LEVEL || "debug",
  LOG_DIR: process.env.LOG_DIR || "",
  LOG_MAX_DAYS: process.env.LOG_MAX_DAYS || "",
  LOG_TO_CONSOLE: process.env.LOG_TO_CONSOLE || "",
  DPP_STORAGE_ROOT: process.env.DPP_STORAGE_ROOT || "",
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || "",
  DPP_TEMPLATE_ROOT: process.env.DPP_TEMPLATE_ROOT || "",
};
