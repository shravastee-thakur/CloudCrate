import { Request, Response, NextFunction } from "express";
import * as systemService from "../services/systemService.js";

export const purgeOrphanedCloudFiles = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const successCount = await systemService.purgeOrphanedCloudFiles();
    return res
      .status(200)
      .json({ message: "Purge complete", data: successCount });
  } catch (error) {
    next(error);
  }
};

export const abortExpiredMultipartUploads = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const successCount = await systemService.abortExpiredMultipartUploads();
    return res
      .status(200)
      .json({ message: "Abort complete", data: successCount });
  } catch (error) {
    next(error);
  }
};

export const reconcileStorageQuotas = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const reconciledCount = await systemService.reconcileStorageQuotas();
    return res
      .status(200)
      .json({ message: "Reconciliation complete", data: reconciledCount });
  } catch (error) {
    next(error);
  }
};
