// services/mediaService.ts
import mongoose, { ClientSession } from "mongoose";
import * as mediaRepo from "../repositories/mediaRepo.js";
import * as storageTransactionRepo from "../repositories/storageTransactionRepo.js";
import { CreateMediaData, MediaDocument } from "../repositories/mediaRepo.js";
import { ApiError } from "../utils/apiError.js";
import * as b2StorageService from "./b2StorageService.js";

// Data Transfer Object
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

// STEP 1: Initialize the upload.
export const initializeUpload = async (
  mediaData: CreateMediaData,
): Promise<{ media: MediaDto; uploadId?: string; isDuplicate: boolean }> => {
  const MAX_FILE_SIZE = 500 * 1024 * 1024;
  if (mediaData.sizeBytes <= 0 || mediaData.sizeBytes > MAX_FILE_SIZE) {
    throw new ApiError(400, "Invalid file size");
  }

  const existingFile = await mediaRepo.findActiveByChecksum(
    mediaData.sha1Checksum,
  );

  if (existingFile) {
    const session = await mongoose.startSession();
    let savedDuplicate: MediaDocument | null = null;

    try {
      session.startTransaction();

      savedDuplicate = await mediaRepo.createDuplicateRecord(
        mediaData.uploadedBy.toString(),
        existingFile,
        session,
      );

      // Deduct quota for the duplicate file mapping
      await storageTransactionRepo.createTransaction(
        {
          userId: mediaData.uploadedBy,
          mediaId: savedDuplicate._id,
          sizeDeltaBytes: existingFile.sizeBytes,
          type: "upload",
        },
        session,
      );

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw new ApiError(500, "Failed to process duplicate upload");
    } finally {
      session.endSession();
    }

    return { media: mapToMediaDto(savedDuplicate!), isDuplicate: true };
  }

  const pendingMedia = await mediaRepo.createPendingRecord(mediaData);

  const uploadId = await b2StorageService.initiateMultipartUpload(
    pendingMedia.bucketName,
    pendingMedia.storageKey,
    pendingMedia.mimeType,
  );

  const updatedMedia = await mediaRepo.attachMultipartId(
    pendingMedia._id.toString(),
    uploadId,
  );

  if (!updatedMedia)
    throw new ApiError(404, "Failed to attach multipart ID to media record");

  return {
    media: mapToMediaDto(updatedMedia),
    uploadId: uploadId,
    isDuplicate: false,
  };
};

// STEP 2: Generate Presigned URLs for individual chunks
export const getChunkUploadUrls = async (
  mediaId: string,
  userId: string,
  totalChunks: number,
): Promise<{ urls: string[] }> => {
  const media = await mediaRepo.getAccessibleFile(mediaId, userId);

  if (!media) throw new ApiError(404, "Media not found");
  if (media.status !== "uploading" || !media.multipartUploadId) {
    throw new ApiError(401, "Invalid upload state.");
  }

  const urls = await b2StorageService.generatePresignedUrlsForChunks(
    media.bucketName,
    media.storageKey,
    media.multipartUploadId,
    totalChunks,
  );

  return { urls };
};

// STEP 3: Finalize the upload.
export const completeUpload = async (
  mediaId: string,
  userId: string,
  parts: { PartNumber: number; ETag: string }[],
): Promise<MediaDto> => {
  const media = await mediaRepo.getAccessibleFile(mediaId, userId);

  if (!media || !media.multipartUploadId)
    throw new ApiError(404, "Media not found or unauthorized");

  await b2StorageService.completeMultipartUpload(
    media.bucketName,
    media.storageKey,
    media.multipartUploadId,
    parts,
  );

  const isValid = await b2StorageService.verifyFileIntegrity(
    media.bucketName,
    media.storageKey,
    media.sizeBytes,
  );

  if (!isValid) {
    await b2StorageService.deleteFileFromCloud(
      media.bucketName,
      media.storageKey,
    );
    await mediaRepo.finalizeUploadAsFailed(mediaId);
    throw new ApiError(422, "File integrity check failed");
  }

  const session: ClientSession = await mongoose.startSession();
  let finalizedMedia: MediaDocument | null = null;

  try {
    session.startTransaction();

    finalizedMedia = await mediaRepo.finalizeUpload(
      media._id.toString(),
      session,
    );

    // Deduct quota for the newly completed upload
    await storageTransactionRepo.createTransaction(
      {
        userId,
        mediaId: media._id,
        sizeDeltaBytes: media.sizeBytes,
        type: "upload",
      },
      session,
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw new ApiError(
      500,
      `Database transaction failed during upload completion`,
    );
  } finally {
    session.endSession();
  }

  if (!finalizedMedia)
    throw new ApiError(500, "Failed to finalize media document in database");

  return mapToMediaDto(finalizedMedia);
};

// Fetch files for the user's dashboard
export const getUserDashboardMedia = async (
  userId: string,
  page: number,
  limit: number,
): Promise<{ files: MediaDto[]; totalCount: number }> => {
  const { files, totalCount } = await mediaRepo.getPaginatedUserMedia(
    userId,
    page,
    limit,
  );
  return {
    files: files.map(mapToMediaDto),
    totalCount,
  };
};

// Soft delete a file
export const deleteUserMedia = async (
  mediaId: string,
  userId: string,
): Promise<boolean> => {
  const media = await mediaRepo.getAccessibleFile(mediaId, userId);
  if (!media) throw new ApiError(404, "Media not found");

  // Cloud operations happen outside the DB transaction.
  // If this fails, the background worker will catch the expired upload later.
  if (media.multipartUploadId && media.status !== "completed") {
    await b2StorageService.abortMultipartUpload(
      media.bucketName,
      media.storageKey,
      media.multipartUploadId,
    );
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    if (media.multipartUploadId && media.status !== "completed") {
      await mediaRepo.finalizeUploadAsFailed(mediaId, session);
    } else {
      // Only refund quota if the file was fully completed and taking up user space
      if (media.status === "completed") {
        await storageTransactionRepo.createTransaction(
          {
            userId,
            mediaId: media._id,
            sizeDeltaBytes: -Math.abs(media.sizeBytes), // Ensure negative value for refunds
            type: "deletion",
          },
          session,
        );
      }

      await mediaRepo.softDeleteMedia(mediaId, userId, session);
    }

    await session.commitTransaction();
    return true;
  } catch (error) {
    await session.abortTransaction();
    throw new ApiError(500, "Failed to process media deletion securely");
  } finally {
    session.endSession();
  }
};
