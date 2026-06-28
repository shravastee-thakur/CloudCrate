import { Request, Response, NextFunction } from "express";
import * as shareLinkService from "../services/shareLinkService.js";
import {
  createShareLinkSchema,
  publicDownloadSchema,
  shareLinkIdParamSchema,
  tokenParamSchema,
  paginationSchema,
} from "../validators/shareLinkValidator.js";
import logger from "../utils/logger.js";

export const createShareLink = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userdId = req.user?.id as string;

    const payload = createShareLinkSchema.parse(req.body);
    const result = await shareLinkService.createShareLink(userdId, payload);

    logger.info("Share link created", {
      userId: userdId,
      mediaId: payload.mediaId,
      linkId: result._id,
    });

    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const getPublicDownloadUrl = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const params = tokenParamSchema.parse(req.params);
    const body = publicDownloadSchema.parse(req.body);

    const result = await shareLinkService.getPublicDownloadUrl(
      params.token,
      body.password,
    );

    logger.info("Public download URL generated", { token: params.token });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getUserShareLinks = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userdId = req.user?.id as string;

    const query = paginationSchema.parse(req.query);
    const result = await shareLinkService.getUserShareLinks(
      userdId,
      query.page,
      query.limit,
    );

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const revokeShareLink = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userdId = req.user?.id as string;

    const params = shareLinkIdParamSchema.parse(req.params);
    const result = await shareLinkService.revokeShareLink(
      userdId,
      params.shareLinkId,
    );

    logger.info("Share link revoked", {
      userId: userdId,
      linkId: params.shareLinkId,
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
