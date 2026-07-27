import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import sql, { getPool } from "../config/db";
import { successResponse, errorResponse } from "../utils/response";
import {
  getActiveAIModelsQuery,
  getActiveSystemSecretByNameQuery,
} from "../queries/temp.queries";

async function getSystemSecretValue(secretName: string) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("SecretName", sql.NVarChar(200), secretName)
    .query(getActiveSystemSecretByNameQuery);

  if (!result.recordset.length) {
    return null;
  }

  return result.recordset[0].SecretValue as string;
}

export const getSystemSecret = asyncHandler(async (req: Request, res: Response) => {
  const secretName = (req.params.secretName || req.query.secretName) as string;

  if (!secretName) {
    return res
      .status(400)
      .json(errorResponse("secretName is required in route param or query string"));
  }

  const secretValue = await getSystemSecretValue(secretName);

  if (!secretValue) {
    return res.status(404).json(errorResponse("Secret not found"));
  }

  return res.json(
    successResponse(
      {
        [secretName]: secretValue,
      },
      "System secret retrieved",
    ),
  );
});

export const getLLMModels = asyncHandler(
  async (req: Request, res: Response) => {

    const companyID = (req as any).user?.CompanyId;
    // console.log("getLLMModels - CompanyID from JWT:", companyID);
    
    const pool = await getPool();
    const result = await pool
      .request()
      .input("CompanyID", sql.Int, companyID)
      .query(getActiveAIModelsQuery);

    // console.log("Database result recordset:", result.recordset);
    // console.log("Result recordset length:", result.recordset.length);

    const mappedModels = result.recordset.map((row) => ({
      id: row.id,
      name: row.model_name,
    }));

    // console.log("Mapped LLM_MODELS:", mappedModels);

    res.json(
      successResponse(
        {
          LLM_MODELS: mappedModels,
        },
        "LLM models retrieved",
      ),
    );
  },
);
