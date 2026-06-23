// workers/expiredUploadWorker.ts
import { Worker, Queue, Job } from "bullmq";
import { redis } from "../config/redis.js";
import * as mediaRepo from "../repositories/mediaRepo.js";
import * as b2StorageService from "../services/b2StorageService.js";

// Define the payload structure for the job
interface ExpiredUploadJobData {
  batchSize: number;
}

export const expiredUploadQueue = new Queue<ExpiredUploadJobData>(
  "expired-upload-cleanup",
  { connection: redis },
);

export const expiredUploadWorker = new Worker<ExpiredUploadJobData>(
  "expired-upload-cleanup",
  async (job: Job<ExpiredUploadJobData>) => {
    // Extract the batch size from the job payload, falling back to 50
    const limit = job.data.batchSize || 50;

    const expired = await mediaRepo.fetchExpiredMultipartUploads(limit);
    if (expired.length === 0) return;

    for (const file of expired) {
      try {
        if (file.multipartUploadId) {
          await b2StorageService.abortMultipartUpload(
            file.bucketName,
            file.storageKey,
            file.multipartUploadId,
          );
        }
        await mediaRepo.hardDelete(file._id.toString());
        console.log(
          `Aborted and cleaned up expired upload: ${file.storageKey}`,
        );
      } catch (error) {
        console.error(
          `Failed to cleanup expired upload ${file.storageKey}:`,
          error,
        );
      }
    }
  },
  { connection: redis },
);

export async function scheduleExpiredUploadCleanup() {
  await expiredUploadQueue.add(
    "cleanup-expired-uploads",
    { batchSize: 50 }, // Pass the configuration dynamically
    {
      repeat: { every: 60 * 60 * 1000 },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
}
