import mongoose, { ClientSession } from "mongoose";
import * as mediaRepo from "../repositories/mediaRepo.js";
import { CreateMediaData, MediaDocument } from "../repositories/mediaRepo.js";
import { ApiError } from "../utils/apiError.js";
import { B2StorageService } from "./b2StorageService.js";

// The storage service will use ENV vars to determine if it connects to Floci or B2
const storageService = new B2StorageService();

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

//STEP 1: Initialize the upload.
// Handles deduplication and requests a Multipart Upload ID from Floci/B2.
export const initializeUpload = async (
  mediaData: CreateMediaData,
): Promise<{ media: MediaDto; uploadId?: string; isDuplicate: boolean }> => {
  // Deduplication Check: Does this file already exist on our servers?
  const existingFile = await mediaRepo.findActiveByChecksum(
    mediaData.sha1Checksum,
  );

  if (existingFile) {
    // Create a new DB record for this user, but point it to the EXACT SAME storageKey.
    const saveDuplicate = await mediaRepo.createDuplicateRecord(
      mediaData.uploadedBy.toString(),
      existingFile,
    );

    return { media: mapToMediaDto(saveDuplicate), isDuplicate: true };
  }

  //  If no duplicate, create a pending record in MongoDB
  const pendingMedia = await mediaRepo.createPendingRecord(mediaData);

  //  Tell Floci/B2 we are starting a chunked upload
    const initResponse = await storageService.initializeMultipartUpload(
      pendingMedia.bucketName,
      pendingMedia.storageKey,
      pendingMedia.mimeType
    );

  // Save the Floci/B2 upload ID to our database so background workers can abort it if the user bails out
    const updatedMedia = await mediaRepo.attachMultipartId(
      pendingMedia._id.toString(),
      initResponse.uploadId,
    );

    if (!updatedMedia)
      throw new ApiError(404, "Failed to attach multipart ID to media record");

  return {
    media: mapToMediaDto(updatedMedia),
    uploadId: initResponse.uploadId,
    isDuplicate: false,
  };
};

//  STEP 2: Generate Presigned URLs for individual chunks
export const getChunkUploadUrls = async (
  mediaId: string,
  userId: string,
  totalChunks: number,
): Promise<{ urls: string }> => {
  const media = await mediaRepo.getAccessibleFile(mediaId, userId);

  if (!media) throw new ApiError(404, "Media not found");
  if (media.status !== "uploading" || !media.multipartUploadId) {
    throw new ApiError(
      401,
      "Invalid upload state. Must be in 'uploading' status with an active multipart ID.",
    );
  }

  // Generate secure, short-lived URLs for the frontend to upload chunks directly to Floci/B2
    const urls = await storageService.getPresignedUrlsForChunks(
      media.storageKey,
      media.multipartUploadId,
      totalChunks,
      media.bucketName
    );

  return urls;
};

// STEP 3: Finalize the upload.
// Tells Floci/B2 to stitch chunks together, then updates the DB state via a Transaction.

export const completeUpload = async (
  mediaId: string,
  userId: string,
    parts: { PartNumber: number; ETag: string }[],
): Promise<MediaDto> => {
  const media = await mediaRepo.getAccessibleFile(mediaId, userId);

  if (!media || !media.multipartUploadId)
    throw new ApiError(404, "Media not found or unauthorized");

  // Tell Floci/B2 to stitch the chunks together and verify ETags
    await storageService.completeMultipartUpload(media.storageKey, media.multipartUploadId, parts, media.bucketName);

  // Start a MongoDB Transaction to finalize DB state securely
  const session: ClientSession = await mongoose.startSession();
  let finalizedMedia: MediaDocument | null = null;

  try {
    session.startTransaction();

    //Mark media as "completed" and remove the expiration timer
    finalizedMedia = await mediaRepo.finalizeUpload(
      media._id.toString(),
      session,
    );

    // Here is where you will add your StorageTransaction logic to deduct user quota!
    // await storageTransactionRepo.createTransaction({ userId, sizeDeltaBytes: media.sizeBytes, type: 'upload' }, session);

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw new ApiError(
      401,
      `Database transaction failed during upload completion: ${error}`,
    );
  } finally {
    session.endSession();
  }

  if (!finalizedMedia)
    throw new ApiError(401, "Failed to finalize media document in database");

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
  const deletedMedia = await mediaRepo.softDeleteMedia(mediaId, userId);
  if (!deletedMedia)
    throw new ApiError(404, "Media not found or already deleted");

  // (Future Step) Dispatch a BullMQ job to actually delete from B2, or log to AuditLog

  return true;
};
