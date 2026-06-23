import Media, { IMedia } from "../models/mediaModel.js";
import { HydratedDocument, ClientSession } from "mongoose";
import crypto from "crypto";

export type MediaDocument = HydratedDocument<IMedia>;

export type CreateMediaData = Pick<
  IMedia,
  | "bucketName"
  | "originalName"
  | "mimeType"
  | "sizeBytes"
  | "sha1Checksum"
  | "uploadedBy"
>;

type CloudPurgePayload = Pick<IMedia, "storageKey" | "bucketName" | "_id">;
type ExpiredUploadPayload = Pick<
  IMedia,
  "storageKey" | "bucketName" | "multipartUploadId" | "_id"
>;

// The Upload Flow
export const createPendingRecord = async (
  data: CreateMediaData,
): Promise<MediaDocument> => {
  // Sanitize the filename to prevent URL/S3 injection issues
  let safeName = data.originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
  if (!safeName || safeName.replace(/_/g, "") === "") {
    safeName = "file";
  }

  // Generate a highly unique storage key to prevent collisions in B2
  const uniqueId = crypto.randomBytes(8).toString("hex");
  const storageKey = `uploads/${data.uploadedBy}/${uniqueId}-${safeName}`;

  // Set expiration timer (e.g., 24 hours from now) for orphaned uploads
  const uploadExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const media = new Media({
    uploadedBy: data.uploadedBy,
    originalName: data.originalName,
    mimeType: data.mimeType,
    sizeBytes: data.sizeBytes,
    sha1Checksum: data.sha1Checksum,
    bucketName: data.bucketName,
    storageKey: storageKey,
    status: "pending",
    uploadExpiresAt: uploadExpiresAt,
  });

  return media.save();
};

export const findActiveByChecksum = async (
  sha1Checksum: string,
): Promise<MediaDocument | null> => {
  return Media.findOne({
    sha1Checksum,
    deletedAt: null,
    status: "completed",
  }).exec();
};

export const createDuplicateRecord = async (
  uploadedBy: string,
  originalName: string,
  existingFile: MediaDocument,
  session?: ClientSession,
): Promise<MediaDocument> => {
  const duplicateMedia = new Media({
    uploadedBy,
    originalName,
    mimeType: existingFile.mimeType,
    sizeBytes: existingFile.sizeBytes,
    sha1Checksum: existingFile.sha1Checksum,
    bucketName: existingFile.bucketName,
    storageKey: existingFile.storageKey,
    status: "completed",
  });
  return duplicateMedia.save({ session });
};

export const attachMultipartId = async (
  mediaId: string,
  multipartUploadId: string,
): Promise<MediaDocument | null> => {
  return Media.findOneAndUpdate(
    { _id: mediaId, status: "pending" },
    {
      multipartUploadId,
      status: "uploading",
    },
    { new: true },
  ).exec();
};

export const finalizeUpload = async (
  mediaId: string,
  session?: ClientSession,
): Promise<MediaDocument | null> => {
  return Media.findOneAndUpdate(
    { _id: mediaId, status: "uploading" },
    {
      status: "completed",
      $unset: { uploadExpiresAt: 1 }, // Completely removes the expiration timer
    },
    {
      new: true,
      session,
    },
  ).exec();
};

export const finalizeUploadAsFailed = async (
  mediaId: string,
  session?: ClientSession,
): Promise<MediaDocument | null> => {
  return Media.findOneAndUpdate(
    { _id: mediaId, status: "uploading" },
    {
      status: "failed",
      $unset: { uploadExpiresAt: 1, multipartUploadId: 1 },
    },
    {
      new: true,
      session,
    },
  ).exec();
};

// The Read and Dashboard Flow (Consumed by MediaController)

export const getPaginatedUserMedia = async (
  userId: string,
  page: number = 1,
  limit: number = 10,
): Promise<{ files: MediaDocument[]; totalCount: number }> => {
  const query = { uploadedBy: userId, deletedAt: null };
  const skip = (page - 1) * limit;

  const [files, totalCount] = await Promise.all([
    Media.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
    Media.countDocuments(query).exec(),
  ]);

  return { files, totalCount };
};

export const getAccessibleFile = async (
  mediaId: string,
  userId: string,
): Promise<MediaDocument | null> => {
  return Media.findOne({
    _id: mediaId,
    uploadedBy: userId,
    deletedAt: null,
  }).exec();
};

export const findById = async (
  mediaId: string,
): Promise<MediaDocument | null> => {
  return Media.findById(mediaId).exec();
};

// The Deletion Flow

export const softDeleteMedia = async (
  mediaId: string,
  userId: string,
  session?: ClientSession,
): Promise<MediaDocument | null> => {
  return Media.findOneAndUpdate(
    { _id: mediaId, uploadedBy: userId, deletedAt: null },
    { deletedAt: new Date() },
    { new: true, session },
  ).exec();
};

// Consumed by BullMQ Jobs
export const fetchOrphanedStorageKeys = async (
  limit: number = 50,
): Promise<CloudPurgePayload[]> => {
  const pipeline = [
    // Find soft-deleted files not yet purged from B2
    { $match: { deletedAt: { $ne: null }, b2DeletedAt: null } },

    // Self-join to check if any active record still uses this storageKey
    {
      $lookup: {
        from: "media",
        let: { key: "$storageKey" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$storageKey", "$$key"] },
              deletedAt: null,
            },
          },
          { $limit: 1 }, // We only need to know if at least one exists
        ],
        as: "activeLinks",
      },
    },

    // Filter out any file that still has an active link
    { $match: { activeLinks: { $size: 0 } } },

    // Limit the final result and format the output
    { $limit: limit },
    { $project: { _id: 1, storageKey: 1, bucketName: 1 } },
  ];

  return Media.aggregate<CloudPurgePayload>(pipeline).exec();
};

export const confirmCloudPurge = async (
  mediaId: string,
): Promise<MediaDocument | null> => {
  return Media.findOneAndUpdate(
    { _id: mediaId, deletedAt: { $ne: null }, b2DeletedAt: null },
    { b2DeletedAt: new Date() },
    { new: true },
  ).exec();
};

export const fetchExpiredMultipartUploads = async (
  limit: number = 10,
): Promise<ExpiredUploadPayload[]> => {
  return Media.find({
    status: { $in: ["pending", "uploading"] },
    uploadExpiresAt: { $lt: new Date() },
  })
    .limit(limit)
    .lean()
    .select("_id storageKey bucketName multipartUploadId")
    .exec();
};

export const hardDelete = async (
  mediaId: string,
): Promise<MediaDocument | null> => {
  return Media.findOneAndDelete({
    _id: mediaId,
    status: { $in: ["pending", "uploading"] },
    uploadExpiresAt: { $lt: new Date() },
  }).exec();
};
