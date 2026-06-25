import { Request, Response, NextFunction } from "express";
import * as mediaService from "../services/mediaService.js";
import {
  initializeUploadSchema,
  finalizeUploadSchema,
  mediaIdParamSchema,
  paginationSchema,
} from "../validators/mediaValidator.js";
import logger from "../utils/logger.js";

export const initializeUpload = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id as string;

    const payload = initializeUploadSchema.parse(req.body);

    const result = await mediaService.initializeUpload(userId, payload);

    logger.info("Upload initialized", {
      userId,
      mediaId: result.media._id,
      isDuplicate: result.isDuplicate,
      sizeBytes: payload.sizeBytes,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    next(error);
  }
};

export const finalizeUpload = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload = finalizeUploadSchema.parse(req.body);

    const result = await mediaService.finalizeUpload(
      payload.mediaId,
      payload.bucketName,
      payload.storageKey,
      payload.uploadId,
      payload.parts,
    );

    logger.info("Upload finalized", {
      userId: req.user?.id,
      mediaId: result._id,
      storageKey: result.storageKey,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    next(error);
  }
};

export const getUserDashboardMedia = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id as string;
    const query = paginationSchema.parse(req.query);

    const result = await mediaService.getUserDashboardMedia(
      userId,
      query.page,
      query.limit,
    );

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getSecureDownloadUrl = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id as string;
    const params = mediaIdParamSchema.parse(req.params);

    const result = await mediaService.getSecureDownloadUrl(
      userId,
      params.mediaId,
    );

    logger.info("Secure download URL generated", {
      userId,
      mediaId: params.mediaId,
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const softDeleteMedia = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id as string;
    const params = mediaIdParamSchema.parse(req.params);

    const result = await mediaService.softDeleteMedia(params.mediaId, userId);

    logger.info("Media soft deleted", {
      userId,
      mediaId: params.mediaId,
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
