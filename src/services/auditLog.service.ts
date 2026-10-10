import sql from "../config/db";

export interface ApiAuditEntry {
  companyId: number;
  userId: number;
  serviceName: string;
  action: string;
  actionStatus: string;
  entityName: string;
  entityKey: string | null;
  details: string;
  correlationId: string;
}

export async function persistApiAuditLog(
  pool: sql.ConnectionPool,
  entry: ApiAuditEntry,
): Promise<void> {
  await pool
    .request()
    .input("CompanyID", sql.Int, entry.companyId)
    .input("UserID", sql.Int, entry.userId)
    .input("ServiceName", sql.NVarChar(100), entry.serviceName)
    .input("Action", sql.NVarChar(50), entry.action)
    .input("ActionStatus", sql.NVarChar(50), entry.actionStatus)
    .input("EntityName", sql.NVarChar(100), entry.entityName)
    .input("EntityKey", sql.NVarChar(100), entry.entityKey)
    .input("Details", sql.NVarChar(sql.MAX), entry.details)
    .input("CorrelationId", sql.NVarChar(100), entry.correlationId)
    .execute("lca_audit.gs_AddAuditLog");
}
