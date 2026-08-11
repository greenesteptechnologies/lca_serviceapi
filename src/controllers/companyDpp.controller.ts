import { Request, Response } from "express";
import fs from "fs/promises";

import {
  generateCompanyDpp,
  CompanyDppGenerationRequest,
  CompanyDppTemplateData,
  resolveCompanyDppPhysicalFilePath,
} from "../services/companyDpp.service";
import sql, { getPool } from "../config/db";
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

function buildGenerationRequest(
  body: CompanyDppGenerateBody,
  companyIdFromToken: number,
): CompanyDppGenerationRequest {
  if (!body.meta) {
    throw new Error("meta section is required");
  }

  if (!body.company) {
    throw new Error("company section is required");
  }

  if (!body.emissions) {
    throw new Error("emissions section is required");
  }

  if (!body.activities) {
    throw new Error("activities section is required");
  }

  if (!body.decarbonization) {
    throw new Error("decarbonization section is required");
  }

  if (!body.lcaConfig) {
    throw new Error("lcaConfig section is required");
  }

  if (!body.assurance) {
    throw new Error("assurance section is required");
  }

  if (!body.certificates) {
    throw new Error("certificates section is required");
  }

  if (!body.about) {
    throw new Error("about section is required");
  }

  if (!body.sustainabilityMetrics) {
    throw new Error("sustainabilityMetrics section is required");
  }

  if (!body.greenPractices) {
    throw new Error("greenPractices section is required");
  }

  if (!body.dataVerification) {
    throw new Error("dataVerification section is required");
  }

  if (isMissing(body.privacyPolicyUrl)) {
    throw new Error("privacyPolicyUrl is required");
  }

  if (isMissing(body.poweredByLabel)) {
    throw new Error("poweredByLabel is required");
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
  } catch (error) {
    console.error("Company DPP generation error:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to generate Company Digital Passport",
    });
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
