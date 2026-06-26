import mongoose from "mongoose";
import * as mediaRepo from "../repositories/mediaRepo.js";
import * as userRepo from "../repositories/userRepo.js";
import * as storageTransactionRepo from "../repositories/storageTransactionRepo.js";
import { CreateMediaData, MediaDocument } from "../repositories/mediaRepo.js";
import { ApiError } from "../utils/apiError.js";
import * as b2StorageService from "./b2StorageService.js";
import { redis } from "../config/redis.js";
import { initializeUploadInput } from "../validators/mediaValidator.js";

export interface MediaDto {
  _id: string;
  bucketName: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  sha1Checksum: string;
  multipartUploadId?: string;
  uploadExpiresAt?: Date;
  status: "pending" | "uploading" | "completed" | "failed";
  uploadedBy: string;
  deletedAt?: Date;
  b2DeletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface InitializeUploadDuplicateResponse {
  isDuplicate: true;
  media: MediaDto;
  message: string;
}

interface InitializeUploadNewResponse {
  isDuplicate: false;
  media: MediaDto;
  uploadId: string;
  chunkSize: number;
  chunkUrls: { partNumber: number; url: string }[];
}

type InitializeUploadResponse =
  | InitializeUploadDuplicateResponse
  | InitializeUploadNewResponse;

interface DashboardResponse {
  files: MediaDto[];
  totalCount: number;
  page: number;
  limit: number;
}

interface DownloadUrlResponse {
  downloadUrl: string;
  originalName: string;
  mimeType: string;
}

const mapToMediaDto = (media: MediaDocument): MediaDto => {
  const obj = media.toObject();

  return {
    _id: obj._id.toString(),
    bucketName: obj.bucketName,
    originalName: obj.originalName,
    storageKey: obj.storageKey,
    mimeType: obj.mimeType,
    sizeBytes: obj.sizeBytes,
    sha1Checksum: obj.sha1Checksum,
    multipartUploadId: obj.multipartUploadId,
    uploadExpiresAt: obj.uploadExpiresAt,
    status: obj.status,
    uploadedBy: obj.uploadedBy.toString(),
    deletedAt: obj.deletedAt,
    b2DeletedAt: obj.b2DeletedAt,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

const CHECK_QUOTA_LUA = `
  local currentUsed = tonumber(redis.call('GET', KEYS[1]) or "0")
  local limit = tonumber(ARGV[1])
  local fileSize = tonumber(ARGV[2])

  if (currentUsed + fileSize) > limit then
      return 0
  end

  redis.call('INCRBY', KEYS[1], fileSize)
  return 1
`;

export const initializeUpload = async (
  userId: string,
  payload: initializeUploadInput,
): Promise<InitializeUploadResponse> => {
  const user = await userRepo.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const redisKey = `user:storage:used:${userId}`;

   // Lazy Hydration: If Redis was flushed, rebuild the key from the MongoDB ledger
  const keyExists = await redis.exists(redisKey);
  if (!keyExists) {
    const trueStorage = await storageTransactionRepo.calculateTotalStorage(userId);
    await redis.set(redisKey, trueStorage.toString());
  }

  const quotaResult = await redis.eval(
    CHECK_QUOTA_LUA,
    1,
    redisKey,
    user.storageLimit.toString(),
    payload.sizeBytes.toString(),
  );

  if (quotaResult === 0) {
    throw new ApiError(402, "Storage limit exceeded");
  }

  try {
    const existingFile = await mediaRepo.findActiveByChecksum(
      payload.sha1Checksum,
    );

    if (existingFile) {
      const duplicateRecord = await mediaRepo.createDuplicateRecord(
        userId,
        payload.originalName,
        existingFile,
      );

      await storageTransactionRepo.recordTransaction({
        userId: userId,
        mediaId: duplicateRecord._id.toString(),
        type: "upload",
        sizeDeltaBytes: payload.sizeBytes,
        idempotencyKey: `upload_${duplicateRecord._id.toString()}`,
      });

      return {
        isDuplicate: true,
        media: mapToMediaDto(duplicateRecord),
        message: "File already exists. Upload skipped.",
      };
    }

    const mediaData: CreateMediaData = {
      ...payload,
      uploadedBy: new mongoose.Types.ObjectId(userId),
    };

    const pendingRecord = await mediaRepo.createPendingRecord(mediaData);

    const uploadId = await b2StorageService.initiateMultipartUpload(
      payload.bucketName,
      pendingRecord.storageKey,
      payload.mimeType,
    );

    const updatedRecord = await mediaRepo.attachMultipartId(
      pendingRecord._id.toString(),
      uploadId,
    );

    if (!updatedRecord) {
      throw new ApiError(500, "Failed to attach multipart ID");
    }

    const chunkSize = 10 * 1024 * 1024;
    const numberOfChunks = Math.ceil(payload.sizeBytes / chunkSize);

    const chunkUrls = await b2StorageService.generatePresignedChunkUrls(
      payload.bucketName,
      pendingRecord.storageKey,
      uploadId,
      numberOfChunks,
    );

    return {
      isDuplicate: false,
      media: mapToMediaDto(updatedRecord),
      uploadId,
      chunkSize,
      chunkUrls,
    };
  } catch (error) {
    await redis.decrby(redisKey, payload.sizeBytes);
    throw error;
  }
};

export const finalizeUpload = async (
  mediaId: string,
  bucketName: string,
  storageKey: string,
  uploadId: string,
  parts: { ETag: string; PartNumber: number }[],
): Promise<MediaDto> => {
  await b2StorageService.completeMultipartUpload(
    bucketName,
    storageKey,
    uploadId,
    parts,
  );

  const finalizedRecord = await mediaRepo.finalizeUpload(mediaId);

  if (!finalizedRecord) {
    throw new ApiError(404, "Upload record not found or already finalized");
  }

  await storageTransactionRepo.recordTransaction({
    userId: finalizedRecord.uploadedBy.toString(),
    mediaId: finalizedRecord._id.toString(),
    type: "upload",
    sizeDeltaBytes: finalizedRecord.sizeBytes,
    idempotencyKey: `upload_${finalizedRecord._id.toString()}`,
  });

  return mapToMediaDto(finalizedRecord);
};

export const getUserDashboardMedia = async (
  userId: string,
  page: number,
  limit: number,
): Promise<DashboardResponse> => {
  const { files, totalCount } = await mediaRepo.getPaginatedUserMedia(
    userId,
    page,
    limit,
  );

  return {
    files: files.map(mapToMediaDto),
    totalCount,
    page,
    limit,
  };
};

export const getSecureDownloadUrl = async (
  userId: string,
  mediaId: string,
): Promise<DownloadUrlResponse> => {
  const file = await mediaRepo.getAccessibleFile(mediaId, userId);

  if (!file) {
    throw new ApiError(404, "File not found or access denied");
  }

  const downloadUrl = await b2StorageService.generateDownloadPresignedUrl(
    file.bucketName,
    file.storageKey,
    900,
  );

  return {
    downloadUrl,
    originalName: file.originalName,
    mimeType: file.mimeType,
  };
};

export const softDeleteMedia = async (
  mediaId: string,
  userId: string,
): Promise<MediaDto> => {
  const deletedRecord = await mediaRepo.softDeleteMedia(mediaId, userId);

  if (!deletedRecord) {
    throw new ApiError(404, "File not found or already deleted");
  }

  const redisKey = `user:storage:used:${userId}`;
  
  // Refund the storage quota in Redis immediately
  await redis.decrby(redisKey, deletedRecord.sizeBytes);

  // Record the negative transaction in the ledger
  await storageTransactionRepo.recordTransaction({
    userId: userId,
    mediaId: deletedRecord._id.toString(),
    type: "deletion",
    sizeDeltaBytes: -deletedRecord.sizeBytes, 
    idempotencyKey: `deletion_${deletedRecord._id.toString()}`,
  });

  return mapToMediaDto(deletedRecord);
};
