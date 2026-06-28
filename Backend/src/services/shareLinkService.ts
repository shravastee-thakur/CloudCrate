import * as shareLinkRepo from "../repositories/shareLinkRepo.js";
import * as mediaRepo from "../repositories/mediaRepo.js";
import * as b2StorageService from "./b2StorageService.js";
import {
  ShareLinkDocument,
  CreateShareLinkData,
} from "../repositories/shareLinkRepo.js";
import { ApiError } from "../utils/apiError.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

// Data Transfer Object is the exact object your controller sends back to the frontend in the JSON response.
export interface ShareLinkDto {
  _id: string;
  mediaId: string;
  sharedBy: string;
  token: string;
  expiresAt: Date;
  maxDownloads: number;
  currentDownloads: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateShareLinkInput {
  mediaId: string;
  expiresAt: Date;
  maxDownloads: number;
  password?: string;
}

const mapToShareLinkDto = (link: ShareLinkDocument): ShareLinkDto => {
  const obj = link.toObject();

  return {
    _id: obj._id.toString(),
    mediaId: obj.mediaId.toString(),
    sharedBy: obj.sharedBy.toString(),
    token: obj.token,
    expiresAt: obj.expiresAt,
    maxDownloads: obj.maxDownloads,
    currentDownloads: obj.currentDownloads,
    isActive: obj.isActive,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

export const createShareLink = async (
  userId: string,
  payload: CreateShareLinkInput,
): Promise<ShareLinkDto> => {
  // 1. Verify the user actually owns the file and it is not deleted
  const mediaFile = await mediaRepo.getAccessibleFile(payload.mediaId, userId);
  if (!mediaFile) {
    throw new ApiError(404, "Media file not found or access denied");
  }

  // 2. Hash the password if provided
  let passwordHash: string | undefined;
  if (payload.password) {
    passwordHash = await bcrypt.hash(payload.password, 10);
  }

  // 3. Generate a cryptographically secure public token
  const token = crypto.randomBytes(32).toString("hex");

  // 4. Save to the database
  const newLink = await shareLinkRepo.createShareLink({
    mediaId: payload.mediaId,
    sharedBy: userId,
    token,
    expiresAt: payload.expiresAt,
    maxDownloads: payload.maxDownloads,
    passwordHash,
  });

  return mapToShareLinkDto(newLink);
};

export const getPublicDownloadUrl = async (
  token: string,
  providedPassword?: string,
): Promise<{ downloadUrl: string; originalName: string }> => {
  // 1. Fetch the link and explicitly include the hidden password hash
  const link = await shareLinkRepo.findActiveByToken(token);

  if (!link) {
    throw new ApiError(
      404,
      "Share link is invalid, expired, or no longer active",
    );
  }

  // 2. Verify password if the link is protected
  if (link.passwordHash) {
    if (!providedPassword) {
      throw new ApiError(401, "Password required for this share link");
    }
    const isPasswordValid = await bcrypt.compare(
      providedPassword,
      link.passwordHash,
    );
    if (!isPasswordValid) {
      throw new ApiError(403, "Incorrect password");
    }
  }

  // 3. Fetch the underlying media file to ensure it has not been deleted since the link was created
  const mediaFile = await mediaRepo.findById(link.mediaId.toString());
  if (!mediaFile || mediaFile.deletedAt) {
    throw new ApiError(
      404,
      "The underlying file has been removed by the owner",
    );
  }

  // 4. Atomically increment the download count and enforce limits
  const updatedLink = await shareLinkRepo.incrementDownloadCount(
    link._id.toString(),
  );
  if (!updatedLink) {
    throw new ApiError(429, "Download limit reached for this share link");
  }

  // If the link just hit its maximum downloads, deactivate it for the dashboard UI
  if (
    updatedLink.maxDownloads > 0 &&
    updatedLink.currentDownloads >= updatedLink.maxDownloads
  ) {
    await shareLinkRepo.deactivateLink(
      updatedLink._id.toString(),
      updatedLink.sharedBy.toString(),
    );
  }

  const downloadUrl = await b2StorageService.generateDownloadPresignedUrl(
    mediaFile.bucketName,
    mediaFile.storageKey,
    900,
  );

  return {
    downloadUrl,
    originalName: mediaFile.originalName,
  };
};

export const getUserShareLinks = async (
  userId: string,
  page: number,
  limit: number,
): Promise<{
  links: ShareLinkDto[];
  totalCount: number;
  page: number;
  limit: number;
}> => {
  const result = await shareLinkRepo.getUserShareLinks(userId, page, limit);

  return {
    links: result.links.map(mapToShareLinkDto),
    totalCount: result.totalCount,
    page,
    limit,
  };
};

export const revokeShareLink = async (
  userId: string,
  shareLinkId: string,
): Promise<ShareLinkDto> => {
  const deactivatedLink = await shareLinkRepo.deactivateLink(
    shareLinkId,
    userId,
  );

  if (!deactivatedLink) {
    throw new ApiError(
      404,
      "Share link not found or you do not have permission to revoke it",
    );
  }

  return mapToShareLinkDto(deactivatedLink);
};
