import { env } from "../config/env.js";
import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError.js";

export const verifyCronSecret = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const secret = req.headers["x-cron-secret"];

  if (!secret || secret !== env.CRON_SECRET) {
    throw new ApiError(401, "Unauthorized cron execution");
  }

  next();
};
