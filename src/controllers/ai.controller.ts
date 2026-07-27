import { Request, Response, NextFunction } from "express";
import OpenAI from "openai";
import { logger } from "../config/logger";
import { successResponse, errorResponse } from "../utils/response";
import { asyncHandler } from "../utils/asyncHandler";
import sql, { getPool } from "../config/db";
import {
  getAIModelForGenerationQuery,
  upsertCarbonAssessmentAICommentQuery,
  validateDraftDetailForHeaderQuery,
} from "../queries/temp.queries";

export const generateAIResponse = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { messages, modelName } = req.body;
    // const { modelId } = req.body; // Temporarily disabled: use modelName only.
    const companyID = req.user?.CompanyId;

    if (!companyID) {
      return res
        .status(401)
        .json(errorResponse("Valid JWT with CompanyId is required"));
    }

    if (!messages || !Array.isArray(messages)) {
      logger.warn("Missing or invalid messages in AI request");
      return res.status(400).json(errorResponse("messages array is required"));
    }

    const parsedModelId = null;

    const parsedModelName =
      modelName === undefined || modelName === null
        ? null
        : String(modelName).trim();

    // modelId validation intentionally disabled while modelName is the public selector.

    if (parsedModelName !== null && parsedModelName.length === 0) {
      return res.status(400).json(errorResponse("modelName cannot be empty"));
    }

    try {
      const pool = await getPool();
      const result = await pool
        .request()
        .input("CompanyID", sql.Int, companyID)
        .input("ModelName", sql.NVarChar(100), parsedModelName)
        .input("ModelID", sql.Int, parsedModelId)
        .query(getAIModelForGenerationQuery);

      const model = result.recordset[0];

      if (!model) {
        logger.error("No active LLM model found for this company");
        return res
          .status(404)
          .json(errorResponse("No active LLM model found for this company"));
      }

      const client = new OpenAI({
        apiKey: model.api_key.trim(),
      });

      logger.info(`AI request started using model: ${model.model_name}`);

      const response = await client.chat.completions.create({
        model: model.model_name,
        messages,
        max_tokens: 1000,
        temperature: 0.7,
      });

      const resultText = response.choices[0]?.message?.content || "";

      logger.info("AI response generated successfully");

      return res.json(
        successResponse(
          {
            content: resultText,
            model: model.model_name,
          },
          "AI response generated",
        ),
      );
    } catch (error: any) {
      logger.error(`AI request failed: ${error.message}`);
      return next(error);
    }
  },
);

export const saveBulkAIComments = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const companyID = req.user?.CompanyId;
    const userID = req.user?.UserId;
    const commonDraftHeaderId = Number(
      req.body?.draftHeaderId ?? req.body?.DraftHeaderID,
    );

    const comments = Array.isArray(req.body?.comments)
      ? req.body.comments
      : Array.isArray(req.body?.rows)
        ? req.body.rows
        : Array.isArray(req.body)
          ? req.body
          : req.body?.comment
            ? [req.body.comment]
            : [];

    if (!companyID || !userID) {
      return res
        .status(401)
        .json(errorResponse("Valid JWT with CompanyId and UserId is required"));
    }

    if (!Array.isArray(comments) || comments.length === 0) {
      return res
        .status(400)
        .json(
          errorResponse("comments array is required and cannot be empty", {
            expected: [
              { comments: [{ draftHeaderId: 1, draftDetailId: 10, commentText: "..." }] },
              { rows: [{ draftHeaderId: 1, draftDetailId: 10, commentText: "..." }] },
              { draftHeaderId: 1, rows: [{ draftDetailId: 10, commentText: "..." }] },
              [{ draftHeaderId: 1, draftDetailId: 10, commentText: "..." }],
            ],
            receivedKeys: req.body && typeof req.body === "object" ? Object.keys(req.body) : [],
          }),
        );
    }

    let transaction: sql.Transaction | null = null;
    let transactionBegun = false;

    try {
      const pool = await getPool();
      transaction = new sql.Transaction(pool);

      await transaction.begin();
      transactionBegun = true;

      let savedCount = 0;

      for (let index = 0; index < comments.length; index += 1) {
        const item = comments[index];
        const draftHeaderId = Number(
          item?.draftHeaderId ?? item?.DraftHeaderID ?? commonDraftHeaderId,
        );
        const rawDraftDetailId = item?.draftDetailId ?? item?.DraftDetailID;
        const hasDraftDetailId =
          rawDraftDetailId !== undefined &&
          rawDraftDetailId !== null &&
          rawDraftDetailId !== "";
        const draftDetailId = hasDraftDetailId ? Number(rawDraftDetailId) : null;
        const commentType = (item?.commentType ?? item?.CommentType ?? "GENERAL") as string;
        const commentText =
          (item?.commentText ?? item?.CommentText ?? item?.aiSummary ?? item?.summary ?? "") as string;
        const aiModelName = (item?.aiModelName ?? item?.AIModelName ?? "UI") as string;

        if (!Number.isInteger(draftHeaderId) || draftHeaderId <= 0 || !commentText) {
          await transaction.rollback();
          transactionBegun = false;
          return res.status(400).json(
            errorResponse(
              "Each comment requires draftHeaderId and commentText",
              { index, item },
            ),
          );
        }

        if (hasDraftDetailId && (!Number.isInteger(draftDetailId) || (draftDetailId as number) <= 0)) {
          await transaction.rollback();
          transactionBegun = false;
          return res.status(400).json(
            errorResponse("draftDetailId must be a positive integer when provided", {
              index,
              item,
            }),
          );
        }

        if (draftDetailId !== null) {
          const detailValidation = await new sql.Request(transaction)
            .input("DraftHeaderID", sql.Int, draftHeaderId)
            .input("DraftDetailID", sql.Int, draftDetailId)
            .query(validateDraftDetailForHeaderQuery);

          if (!detailValidation.recordset.length) {
            await transaction.rollback();
            transactionBegun = false;
            return res.status(400).json(
              errorResponse(
                "Invalid DraftDetailID for the provided DraftHeaderID",
                {
                  index,
                  draftHeaderId,
                  draftDetailId,
                },
              ),
            );
          }
        }

        await new sql.Request(transaction)
          .input("CompanyID", sql.Int, companyID)
          .input("UserID", sql.Int, userID)
          .input("DraftHeaderID", sql.Int, draftHeaderId)
          .input("DraftDetailID", sql.Int, draftDetailId)
          .input("CommentType", sql.NVarChar(100), commentType)
          .input("CommentText", sql.NVarChar(sql.MAX), commentText)
          .input("AIModelName", sql.NVarChar(255), aiModelName)
          .query(upsertCarbonAssessmentAICommentQuery);

        savedCount += 1;
      }

      await transaction.commit();
      transactionBegun = false;

      return res.json(
        successResponse(
          {
            savedCount,
          },
          "AI comments saved successfully",
        ),
      );
    } catch (error: any) {
      if (transaction && transactionBegun) {
        try {
          await transaction.rollback();
        } catch (rollbackError: any) {
          logger.error(`Bulk AI comment rollback failed: ${rollbackError.message}`);
        }
      }
      logger.error(`Bulk AI comment save failed: ${error.message}`);
      return next(error);
    }
  },
);



