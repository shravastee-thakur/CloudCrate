import ShareLink, { IShareLink } from "../models/shareLink.js";
import mongoose, { HydratedDocument } from "mongoose";

export type ShareLinkDocument = HydratedDocument<IShareLink>;

export interface CreateShareLinkData {
  mediaId: string;
  sharedBy: string;
  token: string;
  expiresAt: Date;
  maxDownloads: number;
  passwordHash?: string;
}

export const createShareLink = async (
  data: CreateShareLinkData,
): Promise<ShareLinkDocument> => {
  return ShareLink.create({
    mediaId: new mongoose.Types.ObjectId(data.mediaId),
    sharedBy: new mongoose.Types.ObjectId(data.sharedBy),
    token: data.token,
    expiresAt: data.expiresAt,
    maxDownloads: data.maxDownloads,
    passwordHash: data.passwordHash,
  });
};

export const findActiveByToken = async (
  token: string,
): Promise<ShareLinkDocument | null> => {
  return ShareLink.findOne({
    token,
    isActive: true,
    expiresAt: { $gt: new Date() },
  })
    .select("+passwordHash")
    .exec();
};

export const getUserShareLinks = async (
  userId: string,
  page: number = 1,
  limit: number = 10,
): Promise<{ links: ShareLinkDocument[]; totalCount: number }> => {
  const query = { sharedBy: new mongoose.Types.ObjectId(userId) };
  const skip = (page - 1) * limit;

  const [links, totalCount] = await Promise.all([
    ShareLink.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec(),
    ShareLink.countDocuments(query).exec(),
  ]);

  return { links, totalCount };
};

export const incrementDownloadCount = async (
  shareLinkId: string,
): Promise<ShareLinkDocument | null> => {
  // Step 1: Atomically increment ONLY if the current count is strictly less than the max
  const updatedLink = await ShareLink.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(shareLinkId),
      isActive: true,
      $or: [
        { maxDownloads: 0 },
        { $expr: { $lt: ["$currentDownloads", "$maxDownloads"] } },
      ],
    },
    { $inc: { currentDownloads: 1 } },
    { new: true },
  ).exec();

  // If the query didn't match, the link is inactive or the limit is reached
  if (!updatedLink) {
    return null;
  }

  // Step 2: If it just hit the limit, deactivate it for the UI and future fast rejections
  if (
    updatedLink.maxDownloads > 0 &&
    updatedLink.currentDownloads >= updatedLink.maxDownloads &&
    updatedLink.isActive === true
  ) {
    updatedLink.isActive = false;
    await updatedLink.save();
  }

  return updatedLink;
};

export const deactivateLink = async (
  shareLinkId: string,
  userId: string,
): Promise<ShareLinkDocument | null> => {
  return ShareLink.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(shareLinkId),
      sharedBy: new mongoose.Types.ObjectId(userId),
    },
    { isActive: false },
    { returnDocument: "after" },
  ).exec();
};
