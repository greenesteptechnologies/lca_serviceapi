import { Request, Response, NextFunction } from "express";
import { errorResponse } from "../utils/response";

export const validateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const apiKey = req.headers["x-api-key"];
  // console.log("Validating API Key:", apiKey);

  if (!apiKey) {
    // console.log("API Key missing");
    return res.status(401).json(errorResponse("API key is required"));
  }

  if (apiKey !== process.env.API_KEY) {
    // console.log("Invalid API Key");
    return res.status(401).json(errorResponse("Invalid API key"));
  }

  // console.log("API Key validated");
  next();
};
