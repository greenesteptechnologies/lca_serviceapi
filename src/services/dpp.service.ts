import fs from "fs/promises";
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
  createdByUserId?: number;
}

export interface UserDppTemplateData {
  organizationLabel: string;
  user: {
    displayName: string;
    designation: string;
    department: string | null;
    workModel: string;
    location: string | null;
  };
  emissions: {
    reportingYear: string;
    businessTravel: number;
    dailyCommute: number;
    accommodation: number;
    remoteWork: number;
    homeElectricity: number;
    deviceEnergy: number;
    total: number;
  };
  activityCount: number;
  sustainabilityScore: number | null;
  lastCalculationDate: string;
  verificationStatus: string;
}

export interface UserDppGenerationRequest {
  companyId: number;
  userId: number;
  template: UserDppTemplateData;
  publicBaseUrl?: string;
}

const COMPANY_DPP_TYPE = "COMPANY";
const USER_DPP_TYPE = "USER";
const TEMPLATE_ROOT = path.resolve(__dirname, "../templates");
const DPP_TEMPLATE_FILES = {
  COMPANY: path.join(TEMPLATE_ROOT, "company-dpp", "company-dpp-template.ejs"),
  USER: path.join(TEMPLATE_ROOT, "user-dpp", "user-dpp-template.ejs"),
  PRODUCT: path.join(TEMPLATE_ROOT, "product-dpp", "product-dpp-template.ejs"),
} as const;

function normalizeBaseUrl(rawUrl: string): string {
  return rawUrl.replace(/\/+$/, "");
}

function getTemplatePath(passportType: keyof typeof DPP_TEMPLATE_FILES): string {
  return DPP_TEMPLATE_FILES[passportType];
}

function resolveStorageRoot(): string {
  const storageRoot = ENV.DPP_STORAGE_ROOT?.trim();

  if (!storageRoot) {
    throw new Error(
      "DPP_STORAGE_ROOT environment variable is required but not configured.",
    );
  }

  return path.resolve(storageRoot);
}

const DPP_STORAGE_ROOT = resolveStorageRoot();
const DPP_STORAGE_FOLDERS = {
  COMPANY: path.join(DPP_STORAGE_ROOT, "company"),
  USER: path.join(DPP_STORAGE_ROOT, "user"),
} as const;

function getDppPhysicalFilePath(
  passportType: keyof typeof DPP_STORAGE_FOLDERS,
  companyID: number,
  publicToken: string,
  htmlFileName: string,
): string {
  return path.join(
    DPP_STORAGE_FOLDERS[passportType],
    String(companyID),
    publicToken,
    htmlFileName,
  );
}

export function getCompanyDppPhysicalFilePath(
  companyID: number,
  publicToken: string,
  htmlFileName: string,
): string {
  return getDppPhysicalFilePath("COMPANY", companyID, publicToken, htmlFileName);
}

export function resolveCompanyDppPhysicalFilePath(
  companyID: number,
  publicToken: string,
  htmlFileName: string,
): string {
  return getCompanyDppPhysicalFilePath(companyID, publicToken, htmlFileName);
}

export function resolveUserDppPhysicalFilePath(
  companyID: number,
  publicToken: string,
  htmlFileName: string,
): string {
  return getDppPhysicalFilePath("USER", companyID, publicToken, htmlFileName);
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
  const { meta, template, publicBaseUrl, createdByUserId } = data;

  const { companyID, companyName } = meta;
  const actorUserId = Number.isInteger(createdByUserId) && createdByUserId! > 0
    ? createdByUserId
    : companyID;

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

    const publishedHTMLURL = `${normalizeBaseUrl(baseUrlSource)}/dpp/${publicToken}?passportType=${COMPANY_DPP_TYPE}`;

    const templateData = template;

    // Render EJS
    const html = await ejs.renderFile(getTemplatePath(COMPANY_DPP_TYPE), templateData);

    // Directory
    const dppDirectory = path.join(
      DPP_STORAGE_FOLDERS.COMPANY,
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
      .input("CreatedBy", sql.Int, actorUserId)
      .input("ModifiedBy", sql.Int, actorUserId)
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
                    CreatedBy,
                    ModifiedBy,
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
                    @CreatedBy,
                    @ModifiedBy,
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

export async function generateUserDpp(
  data: UserDppGenerationRequest,
): Promise<CompanyDppResult> {
  const { companyId, userId, template, publicBaseUrl } = data;
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let transactionBegun = false;

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionBegun = true;

    const passportGUID = crypto.randomUUID();
    const publicToken = generatePublicToken(8);
    const passportVersion = await getNextPassportVersion(transaction, companyId);
    const baseUrlSource = ENV.PUBLIC_BASE_URL?.trim() || publicBaseUrl?.trim() || "" ;
    const publishedHTMLURL = `${normalizeBaseUrl(baseUrlSource)}/dpp/${publicToken}?passportType=${USER_DPP_TYPE}`;
    const html = await ejs.renderFile(getTemplatePath(USER_DPP_TYPE), template);
    const dppDirectory = path.join(
      DPP_STORAGE_FOLDERS.USER,
      String(companyId),
      publicToken,
    );
    const htmlFileName = `user_${companyId}_${publicToken}.html`;
    const physicalFilePath = path.join(dppDirectory, htmlFileName);
    const htmlFilePath = `/dpp/user/${companyId}/${publicToken}/${htmlFileName}`;

    await fs.mkdir(dppDirectory, { recursive: true });
    await fs.writeFile(physicalFilePath, html, "utf8");

    await new sql.Request(transaction)
      .input("CompanyID", sql.Int, companyId)
      .input("PassportGUID", sql.NVarChar(100), passportGUID)
      .input("PassportVersion", sql.Int, passportVersion)
      .input("PassportType", sql.NVarChar(20), USER_DPP_TYPE)
      .input("HTMLFileName", sql.NVarChar(200), htmlFileName)
      .input("HTMLFilePath", sql.NVarChar(500), htmlFilePath)
      .input("PublishedHTMLURL", sql.NVarChar(500), publishedHTMLURL)
      .input("PublicToken", sql.NVarChar(100), publicToken)
      .input("CreatedBy", sql.Int, userId)
      .input("ModifiedBy", sql.Int, userId)
      .input("ExtNote1", sql.NVarChar(sql.MAX), JSON.stringify({ userId }))
      .input("ExtNote2", sql.NVarChar(sql.MAX), JSON.stringify({ template }))
      .query(`
        INSERT INTO lca_master.gs_CompanyDigitalPassport
        (CompanyID, PassportGUID, PassportVersion, PassportType, HTMLFileName, HTMLFilePath, PublishedHTMLURL, IsPublished, PublishedOn, CreatedOn, ModifiedOn, CreatedBy, ModifiedBy, IsActive, PublicToken, ExtNote1, ExtNote2)
        VALUES
        (@CompanyID, @PassportGUID, @PassportVersion, @PassportType, @HTMLFileName, @HTMLFilePath, @PublishedHTMLURL, 1, GETDATE(), GETDATE(), GETDATE(), @CreatedBy, @ModifiedBy, 1, @PublicToken, @ExtNote1, @ExtNote2)
      `);

    await transaction.commit();
    transactionBegun = false;

    return { passportGUID, publicToken, passportVersion, htmlFileName, htmlFilePath, publishedHTMLURL, physicalFilePath };
  } catch (error) {
    if (transactionBegun) {
      await transaction.rollback();
    }

    throw error;
  }
}
