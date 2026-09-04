import { Request, Response } from "express";
import fs from "fs/promises";

import {
  generateCompanyDpp,
  CompanyDppGenerationRequest,
  CompanyDppTemplateData,
  generateUserDpp,
  resolveCompanyDppPhysicalFilePath,
  resolveUserDppPhysicalFilePath,
  UserDppTemplateData,
  DelegateDppGenerationRequest,
  generateDelegateDpp,
  DelegateDppTemplateData,
  resolveDelegateDppPhysicalFilePath,
} from "../services/dpp.service";
import sql, { getPool } from "../config/db";
import { errorResponse } from "../utils/response";
import {
  getActiveCompanyDppListQuery,
  getCompanyDppByTokenQuery,
  getPublicCompanyDppByTokenQuery,
  updateCompanyDppStatusQuery,
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

interface UserDppGenerateBody {
  designation?: string;
  department?: string | null;
  workModel?: string;
  location?: string | null;
  reportingYear?: string;
  businessTravelEmissions?: number;
  dailyCommuteEmissions?: number;
  accommodationEmissions?: number;
  remoteWorkEmissions?: number;
  homeElectricityEmissions?: number;
  deviceEnergyEmissions?: number;
  totalUserEmissions?: number;
  activityCount?: number;
  sustainabilityScore?: number | null;
  lastCalculationDate?: string;
  verificationStatus?: string;
}

type DelegateDppGenerateBody = Partial<DelegateDppTemplateData>;

type PassportType = "COMPANY" | "PRODUCT" | "USER" | "DELEGATE";
type DppStatus = "DRAFT" | "REVIEWED" | "APPROVED" | "PUBLISHED";

const ALLOWED_PASSPORT_TYPES: PassportType[] = ["COMPANY", "PRODUCT", "USER", "DELEGATE"];
const ALLOWED_DPP_STATUSES: DppStatus[] = ["DRAFT", "REVIEWED", "APPROVED", "PUBLISHED"];

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function validationError(
  message: string,
  field?: string,
): Error & { status?: number; field?: string | null } {
  const err = new Error(message) as Error & {
    status?: number;
    field?: string | null;
  };
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
    throw validationError(
      "decarbonization section is required",
      "decarbonization",
    );
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
    throw validationError(
      "sustainabilityMetrics section is required",
      "sustainabilityMetrics",
    );
  }

  if (!body.greenPractices) {
    throw validationError(
      "greenPractices section is required",
      "greenPractices",
    );
  }

  if (!body.dataVerification) {
    throw validationError(
      "dataVerification section is required",
      "dataVerification",
    );
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

function getRequiredString(body: UserDppGenerateBody, field: keyof UserDppGenerateBody): string {
  const value = body[field];

  if (isMissing(value)) {
    throw validationError(`${field} is required`, field);
  }

  return String(value).trim();
}

function getRequiredNumber(body: UserDppGenerateBody, field: keyof UserDppGenerateBody): number {
  const value = Number(body[field]);

  if (!Number.isFinite(value) || value < 0) {
    throw validationError(`${field} must be a non-negative number`, field);
  }

  return value;
}

function resolveUserDisplayName(user: any, userId: number): string {
  const displayName = user?.UserName || user?.Username || user?.userName || user?.name || user?.FullName || user?.fullName || user?.email;

  return String(displayName || `Employee ${userId}`).trim();
}

function resolveOrganizationLabel(user: any, companyId: number): string {
  const companyName = user?.CompanyName || user?.companyName || user?.OrganizationName || user?.organizationName;

  return String(companyName || `Organization ${companyId}`).trim();
}

function buildUserGenerationRequest(
  body: UserDppGenerateBody,
  user: any,
): { companyId: number; userId: number; template: UserDppTemplateData } {
  const companyId = Number(user?.CompanyId);
  const userId = Number(user?.UserId);

  if (!Number.isInteger(companyId) || companyId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    const error = validationError("Invalid or missing CompanyId or UserId in token");
    error.status = 401;
    throw error;
  }

  return {
    companyId,
    userId,
    template: {
      organizationLabel: resolveOrganizationLabel(user, companyId),
      user: {
        displayName: resolveUserDisplayName(user, userId),
        designation: getRequiredString(body, "designation"),
        department: body.department?.trim() || null,
        workModel: getRequiredString(body, "workModel"),
        location: body.location?.trim() || null,
      },
      emissions: {
        reportingYear: getRequiredString(body, "reportingYear"),
        businessTravel: getRequiredNumber(body, "businessTravelEmissions"),
        dailyCommute: getRequiredNumber(body, "dailyCommuteEmissions"),
        accommodation: getRequiredNumber(body, "accommodationEmissions"),
        remoteWork: getRequiredNumber(body, "remoteWorkEmissions"),
        homeElectricity: getRequiredNumber(body, "homeElectricityEmissions"),
        deviceEnergy: getRequiredNumber(body, "deviceEnergyEmissions"),
        total: getRequiredNumber(body, "totalUserEmissions"),
      },
      activityCount: getRequiredNumber(body, "activityCount"),
      sustainabilityScore: body.sustainabilityScore == null ? null : getRequiredNumber(body, "sustainabilityScore"),
      lastCalculationDate: getRequiredString(body, "lastCalculationDate"),
      verificationStatus: getRequiredString(body, "verificationStatus"),
    },
  };
}

function buildDelegateGenerationRequest(
  body: DelegateDppGenerateBody,
  user: any,
): Omit<DelegateDppGenerationRequest, "publicBaseUrl"> {
  const companyId = Number(user?.CompanyId);
  const delegateId = Number(user?.DelegateId ?? user?.DelegateID ?? user?.UserId);

  if (!Number.isInteger(companyId) || companyId <= 0 || !Number.isInteger(delegateId) || delegateId <= 0) {
    const error = validationError("Invalid or missing CompanyId or delegate identity in token");
    error.status = 401;
    throw error;
  }

  if (!body.event) throw validationError("event section is required", "event");
  if (!body.delegate) throw validationError("delegate section is required", "delegate");
  if (!body.footprint) throw validationError("footprint section is required", "footprint");

  if (isMissing(body.event.name)) throw validationError("event.name is required", "event.name");
  if (isMissing(body.event.year)) throw validationError("event.year is required", "event.year");
  if (isMissing(body.delegate.jobTitle)) throw validationError("delegate.jobTitle is required", "delegate.jobTitle");
  if (!Number.isFinite(Number(body.footprint.total)) || Number(body.footprint.total) < 0) {
    throw validationError("footprint.total must be a non-negative number", "footprint.total");
  }

  return {
    companyId,
    delegateId,

    template: {
      event: body.event,
      delegate: {
        ...body.delegate,
        fullName: String(body.delegate.fullName || resolveUserDisplayName(user, delegateId)).trim(),
        company: String(body.delegate.company || resolveOrganizationLabel(user, companyId)).trim(),
      },
      qr: body.qr || {},
      agenda: body.agenda || [],
      footprint: {
        ...body.footprint,
        total: Number(body.footprint.total),
        segments: body.footprint.segments || [],
      },
      credentials: body.credentials || [],
      verification: body.verification || {},
      eventStats: body.eventStats,
      eventBreakdown: body.eventBreakdown || [],
      eventTravelByMode: body.eventTravelByMode || [],
      eventSustainabilityActions: body.eventSustainabilityActions || [],
      eventOffset: body.eventOffset,
      eventCertifications: body.eventCertifications || [],
      branding: body.branding,
      flags: body.flags,
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
  const normalized = String(value || "").trim().toUpperCase();

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
    const passportType = resolvePassportType(req.query.passportType);

    if (!passportType) {
      throw validationError("passportType must be one of COMPANY, PRODUCT, USER, DELEGATE", "passportType");
    }

    if (passportType === "COMPANY") {
      const companyId = Number(req.user?.CompanyId);

      if (!Number.isInteger(companyId) || companyId <= 0) {
        return res.status(401).json({
          success: false,
          message: "Invalid or missing CompanyId in token",
        });
      }

      const payload = {
        ...buildGenerationRequest(req.body as CompanyDppGenerateBody, companyId),
        publicBaseUrl: resolveRequestBaseUrl(req),
        createdByUserId: Number(req.user?.UserId),
      };

      if (isMissing(payload.meta.companyName)) {
        throw validationError("meta.companyName is required", "meta.companyName");
      }

      const result = await generateCompanyDpp(payload);

      return res.status(201).json({
        success: true,
        message: "Company Digital Passport generated successfully",
        data: result,
      });
    }

    if (passportType === "USER") {
      const payload = buildUserGenerationRequest(req.body as UserDppGenerateBody, req.user);
      const result = await generateUserDpp({
        ...payload,
        publicBaseUrl: resolveRequestBaseUrl(req),
      });

      return res.status(201).json({
        success: true,
        message: "User Digital Passport generated successfully",
        data: result,
      });
    }

    if (passportType === "PRODUCT") {
      const error = new Error("PRODUCT DPP generation is not implemented yet") as Error & { status?: number };
      error.status = 501;
      throw error;
    }

    if (passportType === "DELEGATE") {
      const payload = buildDelegateGenerationRequest(req.body as DelegateDppGenerateBody, req.user);

      const result = await generateDelegateDpp({
        ...payload,
        publicBaseUrl: resolveRequestBaseUrl(req),
      });

      return res.status(201).json({
        success: true,
        message: "Delegate Digital Passport generated successfully",
        data: result,
      });
    }

    throw validationError("Unsupported passportType", "passportType");

  } catch (error: any) {
    const status = Number(error?.status) || 500;
    const message = error?.message || "Failed to generate Digital Passport";

    console.error("DPP generation error:", error);

    return res.status(status).json(
      errorResponse(
        status >= 500 && status !== 501 ? "Failed to generate Digital Passport" : message,
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
        message: "passportType must be one of COMPANY, PRODUCT, USER, DELEGATE",
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
        status: row.status,
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
        status: row.status,
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

export async function updateDppStatus(
  req: Request,
  res: Response,
): Promise<Response> {
  const companyId = Number(req.user?.CompanyId);
  const passportId = Number(req.params.companyDigitalPassportId);
  const status = String(req.body?.status || "").trim().toUpperCase() as DppStatus;
  const modifiedBy = Number(req.user?.UserId);

  if (!Number.isInteger(companyId) || companyId <= 0 || !Number.isInteger(passportId) || passportId <= 0) {
    return res.status(400).json({ success: false, message: "Valid company and DPP IDs are required" });
  }

  if (!ALLOWED_DPP_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "status must be one of DRAFT, REVIEWED, APPROVED, PUBLISHED",
    });
  }

  if (!Number.isInteger(modifiedBy) || modifiedBy <= 0) {
    return res.status(401).json({ success: false, message: "Invalid or missing UserId in token" });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("CompanyDigitalPassportID", sql.Int, passportId)
      .input("CompanyID", sql.Int, companyId)
      .input("Status", sql.VarChar(20), status)
      .input("ModifiedBy", sql.Int, modifiedBy)
      .query(updateCompanyDppStatusQuery);

    if (!result.rowsAffected[0]) {
      return res.status(404).json({ success: false, message: "DPP not found" });
    }

    return res.status(200).json({
      success: true,
      message: `DPP status updated to ${status}`,
      data: {
        companyDigitalPassportId: passportId,
        status,
        isPublished: status === "PUBLISHED",
      },
    });
  } catch (error) {
    console.error("Update DPP status error:", error);
    return res.status(500).json({ success: false, message: "Failed to update DPP status" });
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
      return res
        .status(400)
        .send("passportType must be one of COMPANY, PRODUCT, USER, DELEGATE");
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
    const pathArguments: [number, string, string] = [
      Number(row.companyId),
      String(row.publicToken),
      String(row.htmlFileName || "index.html"),
    ];
    const physicalFilePath = passportType === "USER"
      ? resolveUserDppPhysicalFilePath(...pathArguments)
      : passportType === "DELEGATE"
        ? resolveDelegateDppPhysicalFilePath(...pathArguments)
        : resolveCompanyDppPhysicalFilePath(...pathArguments);

    const html = await fs.readFile(physicalFilePath, "utf8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (error) {
    console.error("Serve company DPP HTML error:", error);

    return res.status(500).send("Failed to load company DPP");
  }
}

export async function previewCompanyDppHtml(
  req: Request,
  res: Response,
): Promise<Response | void> {
  try {
    const companyId = Number(req.user?.CompanyId);
    const publicToken = req.params.publicToken;
    const passportType = resolvePassportType(req.query.passportType);

    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(401).send("Invalid or missing CompanyId in token");
    }
    if (!publicToken) return res.status(400).send("publicToken is required");
    if (!passportType) {
      return res.status(400).send("passportType must be one of COMPANY, PRODUCT, USER, DELEGATE");
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("CompanyID", sql.Int, companyId)
      .input("PublicToken", sql.NVarChar(100), publicToken)
      .input("PassportType", sql.NVarChar(20), passportType)
      .query(getCompanyDppByTokenQuery);

    if (!result.recordset.length) return res.status(404).send("Company DPP not found");

    const row = result.recordset[0];
    const pathArguments: [number, string, string] = [
      Number(row.companyId),
      String(row.publicToken),
      String(row.htmlFileName || "index.html"),
    ];
    const physicalFilePath = passportType === "USER"
      ? resolveUserDppPhysicalFilePath(...pathArguments)
      : passportType === "DELEGATE"
        ? resolveDelegateDppPhysicalFilePath(...pathArguments)
        : resolveCompanyDppPhysicalFilePath(...pathArguments);

    const html = await fs.readFile(physicalFilePath, "utf8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (error) {
    console.error("Preview company DPP HTML error:", error);
    return res.status(500).send("Failed to load DPP preview");
  }
}
