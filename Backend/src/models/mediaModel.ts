import mongoose, { Schema, Model } from "mongoose";

export interface IMedia {
  bucketName: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  sha1Checksum: string;
  multipartUploadId?: string;
  uploadExpiresAt?: Date;
  status: "pending" | "uploading" | "completed" | "failed";
  uploadedBy: mongoose.Types.ObjectId;
  deletedAt?: Date;
  b2DeletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const mediaSchema = new Schema<IMedia>(
  {
    bucketName: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    storageKey: {
      // The unique file path in B2/Floci (e.g., 'trailers/12345-movie.mp4')
      type: String,
      required: true,
      unique: true,
    },
    mimeType: {
      // e.g., 'video/mp4' or 'image/jpeg'
      type: String,
      required: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
    },
    sha1Checksum: {
      type: String,
      required: true,
      index: true,
    },
    multipartUploadId: {
      // The ID B2 gives us when starting a chunked upload
      type: String,
    },
    uploadExpiresAt: {
      // When should we delete this if the user abandons the upload?
      type: Date,
    },
    status: {
      type: String,
      enum: ["pending", "uploading", "completed", "failed"],
      default: "pending",
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    b2DeletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

mediaSchema.index({ uploadedBy: 1, deletedAt: 1 });
mediaSchema.index({ deletedAt: 1, b2DeletedAt: 1 });

const Media: Model<IMedia> = mongoose.model<IMedia>("Media", mediaSchema);
export default Media;
