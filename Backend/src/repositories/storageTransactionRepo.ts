// repositories/storageTransactionRepo.ts
import StorageTransaction, {
  IStorageTransaction,
} from "../models/storageTransactionModel.js";
import { ClientSession, Types } from "mongoose";

export interface CreateTransactionData {
  userId: string | Types.ObjectId;
  mediaId: string | Types.ObjectId;
  type: "upload" | "deletion" | "adjustment";
  sizeDeltaBytes: number;
}

export const createTransaction = async (
  data: CreateTransactionData,
  session?: ClientSession,
): Promise<IStorageTransaction> => {
  // Deterministic key prevents duplicate ledger entries if the client retries the request
  const idempotencyKey = `${data.type}:${data.mediaId.toString()}`;

  const transaction = new StorageTransaction({
    userId: new Types.ObjectId(data.userId.toString()),
    mediaId: new Types.ObjectId(data.mediaId.toString()),
    type: data.type,
    sizeDeltaBytes: data.sizeDeltaBytes,
    idempotencyKey,
  });

  return transaction.save({ session });
};
