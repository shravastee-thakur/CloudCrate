import * as userRepo from "../repositories/userRepo.js";
import * as mediaRepo from "../repositories/mediaRepo.js";
import * as storageTransactionRepo from "../repositories/storageTransactionRepo.js";
import * as b2StorageService from "./b2StorageService.js";
import { redis } from "../config/redis.js";
import logger from "../utils/logger.js";

export const purgeOrphanedCloudFiles = async (): Promise<number> => {
  const orphanedFiles = await mediaRepo.fetchOrphanedStorageKeys(50);
  let successCount = 0;

  for (const file of orphanedFiles) {
    try {
      await b2StorageService.deleteFileFromCloud(
        file.bucketName,
        file.storageKey,
      );
      await mediaRepo.confirmCloudPurge(file._id.toString());
      successCount++;
    } catch (error) {
      logger.error(`Failed to purge cloud file ${file.storageKey}:`, error);
    }
  }

  logger.info(
    `Cloud purge completed. Successfully deleted ${successCount} files.`,
  );
  return successCount;
};

export const abortExpiredMultipartUploads = async (): Promise<number> => {
  const expiredUploads = await mediaRepo.fetchExpiredMultipartUploads(50);
  let successCount = 0;

  for (const upload of expiredUploads) {
    try {
      if (upload.multipartUploadId) {
        await b2StorageService.abortMultipartUpload(
          upload.bucketName,
          upload.storageKey,
          upload.multipartUploadId,
        );
      }
      await mediaRepo.hardDelete(upload._id.toString());
      successCount++;
    } catch (error) {
      logger.error(`Failed to abort upload ${upload.storageKey}:`, error);
    }
  }

  logger.info(
    `Multipart abort completed. Cleaned up ${successCount} expired uploads.`,
  );
  return successCount;
};

export const reconcileStorageQuotas = async (): Promise<number> => {
  const userIds = await userRepo.getAllUserIds();
  let reconciledCount = 0;

  for (const userId of userIds) {
    const trueStorage =
      await storageTransactionRepo.calculateTotalStorage(userId);
    const redisKey = `user:storage:used:${userId}`;
    await redis.set(redisKey, trueStorage.toString());
    reconciledCount++;
  }

  logger.info(`Storage reconciliation completed for ${reconciledCount} users.`);
  return reconciledCount;
};
