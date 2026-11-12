import { Request, Response } from "express";
import sql, { getPool } from "../config/db";
import { getCompanyModulesQuery } from "../queries/temp.queries";
import { asyncHandler } from "../utils/asyncHandler";
import { errorResponse, successResponse } from "../utils/response";

export interface ModuleRow {
  CompanyID: string | number;
  CompanySubscriptionID: string | number;
  SubscriptionTypeID: number;
  SubscriptionName: string;
  ModuleID: number;
  ModuleCode: string;
  ModuleName: string;
  ParentModuleID: number | null;
  IsActive: boolean;
  RoutePath: string | null;
  DisplayOrder: number | null;
  Description: string | null;
  ModuleLevel: number;
}

interface ModuleFields {
  moduleID: number;
  moduleCode: string;
  moduleName: string;
  parentModuleID: number | null;
  isActive: boolean;
  routePath: string | null;
  displayOrder: number | null;
  description: string | null;
  moduleLevel: number;
}

export interface SubmenuNode extends ModuleFields {}

export interface MenuNode extends ModuleFields {
  submenus: SubmenuNode[];
}

export interface ModuleNode extends ModuleFields {
  menus: MenuNode[];
}

interface ModuleTreeNode extends ModuleFields {
  children: ModuleTreeNode[];
}

const compareModules = (a: ModuleTreeNode, b: ModuleTreeNode): number =>
  (a.displayOrder ?? Number.MIN_SAFE_INTEGER) -
    (b.displayOrder ?? Number.MIN_SAFE_INTEGER) ||
  a.moduleID - b.moduleID;

const sortModuleTree = (modules: ModuleTreeNode[]): void => {
  modules.sort(compareModules);
  modules.forEach((module) => sortModuleTree(module.children));
};

export const buildModuleTree = (rows: ModuleRow[]): ModuleNode[] => {
  const moduleMap = new Map<number, ModuleTreeNode>();
  const rootModules: ModuleTreeNode[] = [];

  // Step 1: Create all module objects
  rows.forEach((row) => {
    moduleMap.set(row.ModuleID, {
      moduleID: row.ModuleID,
      moduleCode: row.ModuleCode,
      moduleName: row.ModuleName,
      parentModuleID: row.ParentModuleID,
      isActive: row.IsActive,
      routePath: row.RoutePath,
      displayOrder: row.DisplayOrder,
      description: row.Description,
      moduleLevel: row.ModuleLevel,
      children: [],
    });
  });

  // Step 2: Connect child modules to their parents
  rows.forEach((row) => {
    const currentModule = moduleMap.get(row.ModuleID)!;

    if (row.ParentModuleID === null) {
      rootModules.push(currentModule);
    } else {
      const parentModule = moduleMap.get(row.ParentModuleID);

      if (parentModule) {
        parentModule.children.push(currentModule);
      }
    }
  });

  sortModuleTree(rootModules);

  return rootModules.map((module) => ({
    moduleID: module.moduleID,
    moduleCode: module.moduleCode,
    moduleName: module.moduleName,
    parentModuleID: module.parentModuleID,
    isActive: module.isActive,
    routePath: module.routePath,
    displayOrder: module.displayOrder,
    description: module.description,
    moduleLevel: module.moduleLevel,
    menus: module.children.map((menu) => ({
      moduleID: menu.moduleID,
      moduleCode: menu.moduleCode,
      moduleName: menu.moduleName,
      parentModuleID: menu.parentModuleID,
      isActive: menu.isActive,
      routePath: menu.routePath,
      displayOrder: menu.displayOrder,
      description: menu.description,
      moduleLevel: menu.moduleLevel,
      submenus: menu.children.map((submenu) => ({
        moduleID: submenu.moduleID,
        moduleCode: submenu.moduleCode,
        moduleName: submenu.moduleName,
        parentModuleID: submenu.parentModuleID,
        isActive: submenu.isActive,
        routePath: submenu.routePath,
        displayOrder: submenu.displayOrder,
        description: submenu.description,
        moduleLevel: submenu.moduleLevel,
      })),
    })),
  }));
};

export const getCompanyModules = asyncHandler(
  async (req: Request, res: Response) => {
    const companyId = Number(req.user?.CompanyId);

    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res
        .status(401)
        .json(errorResponse("Token is missing a valid company ID"));
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("CompanyID", sql.Int, companyId)
      .query(getCompanyModulesQuery);

    const rows = result.recordset as ModuleRow[];
    const modules = buildModuleTree(rows);

    const firstRow = rows[0];

    return res.json(
      successResponse(
        {
          companyID: companyId,
          subscriptionName: firstRow?.SubscriptionName ?? null,
          modules,
        },
        "Company modules retrieved",
      ),
    );
  },
);
