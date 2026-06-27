import StorageTransaction, {
  IStorageTransaction,
} from "../models/storageTransactionModel.js";
import { HydratedDocument } from "mongoose";
import mongoose from "mongoose";

export type StorageTransactionDocument = HydratedDocument<IStorageTransaction>;

export interface CreateStorageTransactionData {
  userId: string;
  mediaId?: string;
  type: "upload" | "deletion" | "adjustment";
  sizeDeltaBytes: number;
  idempotencyKey: string;
}

export const recordTransaction = async (
  data: CreateStorageTransactionData,
): Promise<StorageTransactionDocument> => {
  try {
    return await StorageTransaction.create({
      userId: new mongoose.Types.ObjectId(data.userId),
      mediaId: data.mediaId
        ? new mongoose.Types.ObjectId(data.mediaId)
        : undefined,
      type: data.type,
      sizeDeltaBytes: data.sizeDeltaBytes,
      idempotencyKey: data.idempotencyKey,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return null as any;
    }
    throw error;
  }
};

export const calculateTotalStorage = async (
  userId: string,
): Promise<number> => {
  const result = await StorageTransaction.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $group: {
        _id: null,
        totalStorage: { $sum: "$sizeDeltaBytes" },
      },
    },
  ]);

  if (result.length === 0) return 0;

  const total = result[0].totalStorage;
  return total > 0 ? total : 0;
};
