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

export const attachMultipartId = async (
  mediaId: string,
  multipartUploadId: string,
): Promise<MediaDocument | null> => {
  return Media.findByIdAndUpdate(
    mediaId,
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
  return Media.findByIdAndUpdate(
    mediaId,
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

export const getPaginatedUserMedia = async (
  userId: string,
  page: number = 1,
  limit: number = 10,
): Promise<{ files: MediaDocument[]; totalCount: number }> => {
  const query = { uploadedBy: userId, deletedAt: null };
  const skip = (page - 1) * limit;

  const [files, totalCount] = await Promise.all([
    Media.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
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

export const softDeleteMedia = async (
  mediaId: string,
  userId: string,
): Promise<MediaDocument | null> => {
  return Media.findOneAndUpdate(
    { _id: mediaId, uploadedBy: userId, deletedAt: null },
    { deletedAt: new Date() },
    { new: true },
  ).exec();
};

export const fetchFilesForCloudPurge = async (
  limit: number = 10,
): Promise<CloudPurgePayload[]> => {
  return Media.find({ deletedAt: { $ne: null }, b2DeletedAt: null })
    .limit(limit)
    .lean()
    .select("storageKey bucketName")
    .exec();
};

export const confirmCloudPurge = async (
  mediaId: string,
): Promise<MediaDocument | null> => {
  return Media.findByIdAndUpdate(
    mediaId,
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
    .select("storageKey bucketName multipartUploadId")
    .exec();
};

export const hardDelete = async (
  mediaId: string,
): Promise<MediaDocument | null> => {
  return Media.findByIdAndDelete(mediaId);
};
