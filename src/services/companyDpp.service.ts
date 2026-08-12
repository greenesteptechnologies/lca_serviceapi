import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";
import ejs from "ejs";
import sql, { getPool } from "../config/db";
import { ENV } from "../config/env";

export interface CompanyDppRequest {
  companyID: number;
  companyName: string;
  countryName?: string;
  website?: string;
  description?: string;
}

export interface CompanyDppResult {
  passportGUID: string;
  publicToken: string;
  passportVersion: number;
  htmlFileName: string;
  htmlFilePath: string;
  publishedHTMLURL: string;
  physicalFilePath: string;
}

export interface CompanyDppTemplateData {
  company: {
    name: string;
    legalName: string;
    brand: string;
    displayName: string;
    tagline: string;
    tags: string[];
    logoUrl: string | null;
    logoIcon: string;
    industry: string;
    companyType: string;
    registeredDate: string | null;
    currency: string;
    email: string | null;
    phone: string | null;
    websiteUrl: string;
    addressLines: string[];
    timezoneLabel: string;
  };
  emissions: {
    reportingYear: string;
    total: number;
    energy: number;
    water: number;
    scope1: number;
    scope2: number;
    scope3: number;
  };
  activities: Array<{
    name: string;
    barLabel: string;
    scope: string;
    category: string;
    emissionFactor: string;
    value: number;
    icon: string;
    iconColor: string;
    iconBg: string;
    barColor: string;
  }>;
  decarbonization: {
    impact: number;
    netZeroYear: number | null;
  };
  lcaConfig: {
    reportingYear: string;
    baseYear: number | null;
    netZeroTarget: number | null;
    lcaGoal: string | null;
    efRegion: string | null;
    commitment: string | null;
  };
  assurance: {
    verifierOrg: string | null;
    qcOrg: string | null;
  };
  certificates: Array<{
    name: string;
    issuer: string;
    status: string;
  }>;
  about: {
    description: string;
    productsServices: string;
  };
  sustainabilityMetrics: {
    waterFootprint: number;
    wasteFootprint: number;
    employeeOps: number;
    renewableEnergyPct: number | null;
  };
  greenPractices: Array<{
    title: string;
    description: string;
    gradientFrom: string;
    gradientTo: string;
    icon: string;
  }>;
  dataVerification: {
    dataSource: string;
    verified: boolean;
    reportingPeriodLabel: string;
  };
  privacyPolicyUrl: string;
  poweredByLabel: string;
}

export interface CompanyDppGenerationRequest {
  meta: CompanyDppRequest;
  template: CompanyDppTemplateData;
  publicBaseUrl?: string;
}

const COMPANY_DPP_TYPE = "COMPANY";

function normalizeBaseUrl(rawUrl: string): string {
  return rawUrl.replace(/\/+$/, "");
}

function resolveTemplatePath(): string {
  const templateRoots = [
    ENV.DPP_TEMPLATE_ROOT?.trim() ? path.resolve(ENV.DPP_TEMPLATE_ROOT.trim()) : "",
  ].filter(Boolean);

  const candidates = [
    ...templateRoots.map((root) =>
      path.join(root, "company-dpp", "company-dpp-template.ejs"),
    ),
    ...templateRoots.map((root) =>
      path.join(root, "company-dpp-template.ejs"),
    ),
    path.join(
      process.cwd(),
      "src",
      "templates",
      "company-dpp",
      "company-dpp-template.ejs",
    ),
    path.join(
      process.cwd(),
      "templates",
      "company-dpp",
      "company-dpp-template.ejs",
    ),
    path.resolve(
      __dirname,
      "../templates/company-dpp/company-dpp-template.ejs",
    ),
    path.resolve(
      __dirname,
      "../../templates/company-dpp/company-dpp-template.ejs",
    ),
    path.resolve(
      __dirname,
      "../../src/templates/company-dpp/company-dpp-template.ejs",
    ),
  ].filter(Boolean);

  const foundPath = candidates.find(existsSync);

  if (!foundPath) {
    throw new Error(
      `Company DPP template not found. Checked: ${candidates.join(" | ")}`,
    );
  }

  return foundPath;
}

let templatePathCache: string | null = null;

function getTemplatePath(): string {
  if (templatePathCache && existsSync(templatePathCache)) {
    return templatePathCache;
  }

  templatePathCache = resolveTemplatePath();
  return templatePathCache;
}

function resolveStorageRoot(): string {
  if (ENV.DPP_STORAGE_ROOT?.trim()) {
    return path.resolve(ENV.DPP_STORAGE_ROOT.trim());
  }

  return path.resolve(process.cwd(), "..", "dpp-storage", "company");
}

function getStorageRootCandidates(): string[] {
  const roots = [
    STORAGE_ROOT,
    path.join(process.cwd(), "src", "templates", "storage", "dpp", "company"),
    path.join(process.cwd(), "storage", "dpp", "company"),
  ];

  return Array.from(new Set(roots));
}

const STORAGE_ROOT = resolveStorageRoot();

export function getCompanyDppPhysicalFilePath(
  companyID: number,
  publicToken: string,
  htmlFileName: string,
): string {
  return path.join(STORAGE_ROOT, String(companyID), publicToken, htmlFileName);
}

export function resolveCompanyDppPhysicalFilePath(
  companyID: number,
  publicToken: string,
  htmlFileName: string,
): string {
  const candidates = getStorageRootCandidates().map((root) =>
    path.join(root, String(companyID), publicToken, htmlFileName)
  );

  const existingPath = candidates.find(existsSync);

  return existingPath || candidates[0];
}

function generatePublicToken(length: number = 8): string {
  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

  let token = "";

  for (let i = 0; i < length; i++) {
    const index = crypto.randomInt(0, characters.length);

    token += characters[index];
  }

  return token;
}

async function getNextPassportVersion(
  transaction: sql.Transaction,
  companyID: number,
): Promise<number> {
  const versionResult = await new sql.Request(transaction).input(
    "CompanyID",
    sql.Int,
    companyID,
  ).query(`
                SELECT
                    ISNULL(MAX(PassportVersion), 0) + 1 AS nextVersion
                FROM lca_master.gs_CompanyDigitalPassport
                WHERE CompanyID = @CompanyID
            `);

  const rawVersion = versionResult.recordset[0]?.nextVersion;

  const nextVersion = Number(rawVersion);

  return Number.isFinite(nextVersion) && nextVersion > 0 ? nextVersion : 1;
}

export async function generateCompanyDpp(
  data: CompanyDppGenerationRequest,
): Promise<CompanyDppResult> {
  const { meta, template, publicBaseUrl } = data;

  const { companyID, companyName } = meta;

  const pool = await getPool();

  const transaction = new sql.Transaction(pool);

  let transactionBegun = false;

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionBegun = true;

    // Generate GUID
    const passportGUID = crypto.randomUUID();

    // Generate 8-character token
    const publicToken = generatePublicToken(8);

    const passportVersion = await getNextPassportVersion(
      transaction,
      companyID,
    );

    const baseUrlSource =
      ENV.PUBLIC_BASE_URL?.trim() ||
      publicBaseUrl?.trim() ||
      "http://localhost:5000";

    const publishedHTMLURL = `${normalizeBaseUrl(baseUrlSource)}/companydpp/${publicToken}`;

    const templateData = template;

    // Render EJS
    const html = await ejs.renderFile(getTemplatePath(), templateData);

    // Directory
    const dppDirectory = path.join(
      STORAGE_ROOT,
      String(companyID),
      publicToken,
    );

    await fs.mkdir(dppDirectory, {
      recursive: true,
    });

    // File
    const htmlFileName = `company_${companyID}_${publicToken}.html`;

    const physicalFilePath = getCompanyDppPhysicalFilePath(
      companyID,
      publicToken,
      htmlFileName,
    );

    // Write HTML
    await fs.writeFile(physicalFilePath, html, "utf8");

    // Database path
    const htmlFilePath = `/dpp/company/${companyID}/${publicToken}/${htmlFileName}`;

    const payloadJson = JSON.stringify({
      meta,
      template,
    });

    await new sql.Request(transaction)
      .input("CompanyID", sql.Int, companyID)
      .input("PassportGUID", sql.NVarChar(100), passportGUID)
      .input("PassportVersion", sql.Int, passportVersion)
      .input("PassportType", sql.NVarChar(20), COMPANY_DPP_TYPE)
      .input("HTMLFileName", sql.NVarChar(200), htmlFileName)
      .input("HTMLFilePath", sql.NVarChar(500), htmlFilePath)
      .input("PublishedHTMLURL", sql.NVarChar(500), publishedHTMLURL)
      .input("PublicToken", sql.NVarChar(100), publicToken)
      .input("ExtNote1", sql.NVarChar(sql.MAX), JSON.stringify(meta))
      .input("ExtNote2", sql.NVarChar(sql.MAX), payloadJson).query(`
                INSERT INTO lca_master.gs_CompanyDigitalPassport
                (
                    CompanyID,
                    PassportGUID,
                    PassportVersion,
            PassportType,
                    HTMLFileName,
                    HTMLFilePath,
                    PublishedHTMLURL,
                    IsPublished,
                    PublishedOn,
                    CreatedOn,
                    ModifiedOn,
                    IsActive,
                    PublicToken,
                    ExtNote1,
                    ExtNote2
                )
                VALUES
                (
                    @CompanyID,
                    @PassportGUID,
                    @PassportVersion,
            @PassportType,
                    @HTMLFileName,
                    @HTMLFilePath,
                    @PublishedHTMLURL,
                    1,
                    GETDATE(),
                    GETDATE(),
                    GETDATE(),
                    1,
                    @PublicToken,
                    @ExtNote1,
                    @ExtNote2
                )
            `);

    await transaction.commit();
    transactionBegun = false;

    return {
      passportGUID,

      publicToken,

      passportVersion,

      htmlFileName,

      htmlFilePath,

      publishedHTMLURL,

      physicalFilePath,
    };
  } catch (error) {
    if (transactionBegun) {
      await transaction.rollback();
    }

    throw error;
  }
}
