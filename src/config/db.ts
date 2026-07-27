import sql from "mssql";
import { ENV } from "./env";

const clean = (val?: string) => val?.trim();

export const dbConfig: sql.config = {
  user: clean(ENV.DB_User),
  password: clean(ENV.DB_PASSWORD),
  server: clean(ENV.DB_SERVER) || "localhost",
  database: clean(ENV.DB_NAME),
  options: { encrypt: true, trustServerCertificate: true },
  port: parseInt(clean(String(ENV.DB_PORT)) || "1433"),
};

// Second database connection is disabled for now; only the primary DB is used.
/*
export const dbConfig2: sql.config = {
  user: clean(ENV.DB2_User),
  password: clean(ENV.DB2_PASSWORD),
  server: clean(ENV.DB2_SERVER) || "localhost",
  database: clean(ENV.DB2_NAME) || "Scenario_Analysis",
  options: { encrypt: true, trustServerCertificate: true },
  port: parseInt(clean(String(ENV.DB2_PORT)) || "1433"),
};
*/

let poolPromise: Promise<sql.ConnectionPool> | null = null;
// let poolPromise2: Promise<sql.ConnectionPool> | null = null;

export const getPool = () => {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(dbConfig)
      .connect()
      .catch((error) => {
        poolPromise = null;
        throw error;
      });
  }
  return poolPromise;
};

/*
export const getPool2 = () => {
  if (!poolPromise2) {
    poolPromise2 = new sql.ConnectionPool(dbConfig2).connect();
  }
  return poolPromise2;
};
*/

export const connectDB = async () => {
  if (!dbConfig.user || !dbConfig.password || !dbConfig.database) {
    console.warn("Database configuration missing; skipping DB connection.");
    return;
  }
  await getPool();
  console.log("SQL Connected");
};

export default sql;
