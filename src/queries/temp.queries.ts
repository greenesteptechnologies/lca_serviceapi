export const getActiveAIModelsQuery = `
  SELECT 
    AIModelConfigurationID AS id,
    AIModelName AS model_name,
    APIKey AS api_key,
    CompanyID,
    UserID,
    IsActive,
    CreatedOn,
    ModifiedOn
  FROM lca_master.gs_AIModelConfiguration
  WHERE IsActive = 1 AND CompanyID = @CompanyID
`;

export const getAIModelForGenerationQuery = `
  SELECT TOP (1)
    AIModelConfigurationID AS id,
    AIModelName AS model_name,
    APIKey AS api_key
  FROM lca_master.gs_AIModelConfiguration
  WHERE IsActive = 1
    AND CompanyID = @CompanyID
    AND (@ModelName IS NULL OR AIModelName = @ModelName)
    AND (@ModelID IS NULL OR AIModelConfigurationID = @ModelID)
  ORDER BY AIModelConfigurationID
`;

export const getActiveSystemSecretByNameQuery = `
  SELECT TOP (1)
    SecretName,
    SecretValue
  FROM lca_common.gs_SystemSecret
  WHERE SecretName = @SecretName
    AND IsActive = 1
    AND IsExposedToApi = 1
`;

export const getCarbonAssessmentAICommentsQuery = `
  SELECT
    CompanyID AS companyId,
    UserID AS userId,
    DraftHeaderID AS draftHeaderId,
    DraftDetailID AS draftDetailId,
    CommentType AS commentType,
    CommentText AS commentText,
    AIModelName AS aiModelName,
    CreatedOn AS createdOn,
    IsActive AS isActive
  FROM lca_master.gs_CarbonAssessmentAIComment
  WHERE CompanyID = @CompanyID
    AND UserID = @UserID
    AND IsActive = 1
    AND (@DraftHeaderID IS NULL OR DraftHeaderID = @DraftHeaderID)
    AND (@DraftDetailID IS NULL OR DraftDetailID = @DraftDetailID)
    AND (@CommentType IS NULL OR CommentType = @CommentType)
  ORDER BY CreatedOn DESC, DraftDetailID
`;

export const upsertCarbonAssessmentAICommentQuery = `
  UPDATE target WITH (UPDLOCK, HOLDLOCK)
  SET
    CommentText = @CommentText,
    AIModelName = @AIModelName,
    CreatedOn = GETDATE(),
    IsActive = 1
  FROM lca_master.gs_CarbonAssessmentAIComment AS target
  WHERE target.CompanyID = @CompanyID
    AND target.UserID = @UserID
    AND ISNULL(target.DraftHeaderID, 0) = ISNULL(@DraftHeaderID, 0)
    AND ISNULL(target.DraftDetailID, 0) = ISNULL(@DraftDetailID, 0)
    AND target.CommentType = @CommentType
    AND target.IsActive = 1;

  IF @@ROWCOUNT = 0
  BEGIN
    INSERT INTO lca_master.gs_CarbonAssessmentAIComment
    (
      CompanyID,
      UserID,
      DraftHeaderID,
      DraftDetailID,
      CommentType,
      CommentText,
      AIModelName,
      CreatedOn,
      IsActive
    )
    SELECT
      @CompanyID,
      @UserID,
      @DraftHeaderID,
      @DraftDetailID,
      @CommentType,
      @CommentText,
      @AIModelName,
      GETDATE(),
      1
    WHERE NOT EXISTS (
      SELECT 1
      FROM lca_master.gs_CarbonAssessmentAIComment WITH (UPDLOCK, HOLDLOCK)
      WHERE CompanyID = @CompanyID
        AND UserID = @UserID
        AND ISNULL(DraftHeaderID, 0) = ISNULL(@DraftHeaderID, 0)
        AND ISNULL(DraftDetailID, 0) = ISNULL(@DraftDetailID, 0)
        AND CommentType = @CommentType
        AND IsActive = 1
    );
  END
`;

export const validateDraftDetailForHeaderQuery = `
  SELECT TOP (1) DraftDetailID
  FROM lca_master.gs_CarbonAssessmentDraftDetail
  WHERE DraftDetailID = @DraftDetailID
    AND DraftHeaderID = @DraftHeaderID
`;
