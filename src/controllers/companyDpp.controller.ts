import { Request, Response } from "express";
import fs from "fs/promises";

import {
  generateCompanyDpp,
  CompanyDppGenerationRequest,
  CompanyDppTemplateData,
  resolveCompanyDppPhysicalFilePath,
} from "../services/companyDpp.service";
import sql, { getPool } from "../config/db";
import { errorResponse } from "../utils/response";
import {
  getActiveCompanyDppListQuery,
  getCompanyDppByTokenQuery,
  getPublicCompanyDppByTokenQuery,
} from "../queries/temp.queries";

interface CompanyDppGenerateBody {
  meta?: {
    companyName?: string;
    countryName?: string;
    website?: string;
    description?: string;
  };
  company?: CompanyDppTemplateData["company"];
  emissions?: CompanyDppTemplateData["emissions"];
  activities?: CompanyDppTemplateData["activities"];
  decarbonization?: CompanyDppTemplateData["decarbonization"];
  lcaConfig?: CompanyDppTemplateData["lcaConfig"];
  assurance?: CompanyDppTemplateData["assurance"];
  certificates?: CompanyDppTemplateData["certificates"];
  about?: CompanyDppTemplateData["about"];
  sustainabilityMetrics?: CompanyDppTemplateData["sustainabilityMetrics"];
  greenPractices?: CompanyDppTemplateData["greenPractices"];
  dataVerification?: CompanyDppTemplateData["dataVerification"];
  privacyPolicyUrl?: string;
  poweredByLabel?: string;
}

type PassportType = "COMPANY" | "PRODUCT" | "USER";

const ALLOWED_PASSPORT_TYPES: PassportType[] = ["COMPANY", "PRODUCT", "USER"];

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function validationError(message: string, field?: string): Error & { status?: number; field?: string | null } {
  const err = new Error(message) as Error & { status?: number; field?: string | null };
  err.status = 400;
  err.field = field ?? null;
  return err;
}

function buildGenerationRequest(
  body: CompanyDppGenerateBody,
  companyIdFromToken: number,
): CompanyDppGenerationRequest {
  if (!body.meta) {
    throw validationError("meta section is required", "meta");
  }

  if (!body.company) {
    throw validationError("company section is required", "company");
  }

  if (!body.emissions) {
    throw validationError("emissions section is required", "emissions");
  }

  if (!body.activities) {
    throw validationError("activities section is required", "activities");
  }

  if (!body.decarbonization) {
    throw validationError("decarbonization section is required", "decarbonization");
  }

  if (!body.lcaConfig) {
    throw validationError("lcaConfig section is required", "lcaConfig");
  }

  if (!body.assurance) {
    throw validationError("assurance section is required", "assurance");
  }

  if (!body.certificates) {
    throw validationError("certificates section is required", "certificates");
  }

  if (!body.about) {
    throw validationError("about section is required", "about");
  }

  if (!body.sustainabilityMetrics) {
    throw validationError("sustainabilityMetrics section is required", "sustainabilityMetrics");
  }

  if (!body.greenPractices) {
    throw validationError("greenPractices section is required", "greenPractices");
  }

  if (!body.dataVerification) {
    throw validationError("dataVerification section is required", "dataVerification");
  }

  if (isMissing(body.privacyPolicyUrl)) {
    throw validationError("privacyPolicyUrl is required", "privacyPolicyUrl");
  }

  if (isMissing(body.poweredByLabel)) {
    throw validationError("poweredByLabel is required", "poweredByLabel");
  }

  return {
    meta: {
      companyID: companyIdFromToken,
      companyName: String(body.meta.companyName || "").trim(),
      countryName: body.meta.countryName,
      website: body.meta.website,
      description: body.meta.description,
    },
    template: {
      company: body.company,
      emissions: body.emissions,
      activities: body.activities,
      decarbonization: body.decarbonization,
      lcaConfig: body.lcaConfig,
      assurance: body.assurance,
      certificates: body.certificates,
      about: body.about,
      sustainabilityMetrics: body.sustainabilityMetrics,
      greenPractices: body.greenPractices,
      dataVerification: body.dataVerification,
      privacyPolicyUrl: body.privacyPolicyUrl as string,
      poweredByLabel: body.poweredByLabel as string,
    },
  };
}

function resolveRequestBaseUrl(req: Request): string {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();

  const forwardedHost = String(req.headers["x-forwarded-host"] || "")
    .split(",")[0]
    .trim();

  const protocol = forwardedProto || req.protocol || "http";
  const host = forwardedHost || req.get("host") || "";

  if (!host) {
    return "";
  }

  return `${protocol}://${host}`;
}

function resolvePassportType(value: unknown): PassportType | null {
  const normalized = String(value || "COMPANY").trim().toUpperCase();

  if (!ALLOWED_PASSPORT_TYPES.includes(normalized as PassportType)) {
    return null;
  }

  return normalized as PassportType;
}

export async function generateDpp(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const companyId = Number(req.user?.CompanyId);

    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid or missing CompanyId in token",
      });
    }

    const payload = {
      ...buildGenerationRequest(
        req.body as CompanyDppGenerateBody,
        companyId,
      ),
      publicBaseUrl: resolveRequestBaseUrl(req),
      createdByUserId: Number(req.user?.UserId),
    };

    if (isMissing(payload.meta.companyName)) {
      return res.status(400).json({
        success: false,

        message: "meta.companyName is required",
      });
    }

    const result = await generateCompanyDpp(payload);

    return res.status(201).json({
      success: true,

      message: "Company Digital Passport generated successfully",

      data: result,
    });
  } catch (error: any) {
    const status = Number(error?.status) || 500;
    const message =
      error?.message || "Failed to generate Company Digital Passport";

    console.error("Company DPP generation error:", error);

    return res.status(status).json(
      errorResponse(
        status >= 500
          ? "Failed to generate Company Digital Passport"
          : message,
        {
          correlationId: req.correlationId,
          originalUrl: req.originalUrl,
        },
        error?.code,
        error?.field ?? null,
      ),
    );
  }
}

export async function getCompanyDppMeta(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const companyId = Number(req.user?.CompanyId);

    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid or missing CompanyId in token",
      });
    }

    const publicToken = String(req.query.publicToken || "").trim();
    const passportType = resolvePassportType(req.query.passportType);

    if (!passportType) {
      return res.status(400).json({
        success: false,
        message: "passportType must be one of COMPANY, PRODUCT, USER",
      });
    }

    const pool = await getPool();

    if (!publicToken) {
      const result = await pool
        .request()
        .input("CompanyID", sql.Int, companyId)
        .input("PassportType", sql.NVarChar(20), passportType)
        .query(getActiveCompanyDppListQuery);

      const items = result.recordset.map((row) => ({
        companyDigitalPassportId: row.companyDigitalPassportId,
        companyId: row.companyId,
        passportGuid: row.passportGuid,
        passportType: row.passportType,
        passportVersion: row.passportVersion,
        htmlFileName: row.htmlFileName,
        htmlFilePath: row.htmlFilePath,
        publishedHtmlUrl: row.publishedHtmlUrl,
        isPublished: row.isPublished,
        publishedOn: row.publishedOn,
        publicToken: row.publicToken,
      }));

      return res.status(200).json({
        success: true,
        count: items.length,
        data: items,
      });
    }

    const result = await pool
      .request()
      .input("CompanyID", sql.Int, companyId)
      .input("PublicToken", sql.NVarChar(100), publicToken)
      .input("PassportType", sql.NVarChar(20), passportType)
      .query(getCompanyDppByTokenQuery);

    if (!result.recordset.length) {
      return res.status(404).json({
        success: false,
        message: "Company DPP not found",
      });
    }

    const row = result.recordset[0];

    return res.status(200).json({
      success: true,
      data: {
        companyDigitalPassportId: row.companyDigitalPassportId,
        companyId: row.companyId,
        passportGuid: row.passportGuid,
        passportType: row.passportType,
        passportVersion: row.passportVersion,
        htmlFileName: row.htmlFileName,
        htmlFilePath: row.htmlFilePath,
        publishedHtmlUrl: row.publishedHtmlUrl,
        isPublished: row.isPublished,
        publishedOn: row.publishedOn,
        publicToken: row.publicToken,
      },
    });
  } catch (error) {
    console.error("Get company DPP meta error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load company DPP metadata",
    });
  }
}

export async function serveCompanyDppHtml(
  req: Request,
  res: Response,
): Promise<Response | void> {
  try {
    const publicToken = req.params.publicToken;
    const passportType = resolvePassportType(req.query.passportType);

    if (!publicToken) {
      return res.status(400).send("publicToken is required");
    }

    if (!passportType) {
      return res.status(400).send(
        "passportType must be one of COMPANY, PRODUCT, USER",
      );
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("PublicToken", sql.NVarChar(100), publicToken)
      .input("PassportType", sql.NVarChar(20), passportType)
      .query(getPublicCompanyDppByTokenQuery);

    if (!result.recordset.length) {
      return res.status(404).send("Company DPP not found");
    }

    const row = result.recordset[0];
    const physicalFilePath = resolveCompanyDppPhysicalFilePath(
      Number(row.companyId),
      String(row.publicToken),
      String(row.htmlFileName || "index.html"),
    );

    const html = await fs.readFile(physicalFilePath, "utf8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (error) {
    console.error("Serve company DPP HTML error:", error);

    return res.status(500).send("Failed to load company DPP");
  }
}
