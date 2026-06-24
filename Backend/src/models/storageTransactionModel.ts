import mongoose, { Schema, Model } from "mongoose";

export interface IStorageTransaction {
  userId: mongoose.Types.ObjectId;
  mediaId?: mongoose.Types.ObjectId;
  type: "upload" | "deletion" | "adjustment";
  sizeDeltaBytes: number; // Positive for upload, negative for deletion
  idempotencyKey: string; // Prevents double-charging if a network request retries
  createdAt?: Date;
}

const storageTransactionSchema = new Schema<IStorageTransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mediaId: {
      type: Schema.Types.ObjectId,
      ref: "Media",
    },
    type: {
      type: String,
      enum: ["upload", "deletion", "adjustment"],
      required: true,
    },
    //sizeDeltaBytes records the exact number of bytes added to or subtracted from a user's storage quota during a single event.
    sizeDeltaBytes: {
      type: Number,
      required: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
  },
  // Ledgers are immutable. They should be created, never updated
  { timestamps: { createdAt: true, updatedAt: false } },
);

storageTransactionSchema.index({ userId: 1, sizeDeltaBytes: 1 });
storageTransactionSchema.index({ userId: 1, createdAt: -1 });

const StorageTransaction: Model<IStorageTransaction> =
  mongoose.model<IStorageTransaction>(
    "StorageTransaction",
    storageTransactionSchema,
  );

export default StorageTransaction;
