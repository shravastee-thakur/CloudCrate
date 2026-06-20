import mongoose, { Schema, Model } from "mongoose";

export interface IShareLink {
  mediaId: mongoose.Types.ObjectId;
  sharedBy: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
  maxDownloads: number;
  currentDownloads: number;
  isActive: boolean;
  passwordHash: string; // bcrypt hash if they password-protect the link
  createdAt?: Date;
  updatedAt?: Date;
}

const shareLinkSchema = new Schema<IShareLink>(
  {
    mediaId: {
      type: Schema.Types.ObjectId,
      ref: "Media",
      required: true,
      index: true
    },
    sharedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    maxDownloads: {
      type: Number,
      default: 0,
    },
    currentDownloads: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    passwordHash: {
      type: String,
      select: false
    },
  },
  { timestamps: true },
  
);

// Auto-expire index: MongoDB will automatically delete documents where expiresAt is in the past
shareLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ShareLink: Model<IShareLink> = mongoose.model<IShareLink>(
  "ShareLink",
  shareLinkSchema,
);
export default ShareLink;
