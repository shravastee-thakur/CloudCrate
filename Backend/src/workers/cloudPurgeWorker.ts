import { Worker } from "bullmq";
import { redis } from "../config/redis.js";
import { cloudPurgeQueue } from "../config/cloudPurge.js";
import * as mediaRepo from "../repositories/mediaRepo.js";
import * as b2StorageService from "../services/b2StorageService.js";

// 2. Worker that processes jobs
export const cloudPurgeWorker = new Worker(
  "cloud-purge",
  async (job) => {
    // Fetch up to 10 orphaned records
    const orphaned = await mediaRepo.fetchOrphanedStorageKeys(10);
    if (orphaned.length === 0) return;

    for (const file of orphaned) {
      try {
        // Attempt to delete from B2/Floci
        await b2StorageService.deleteFileFromCloud(
          file.bucketName,
          file.storageKey,
        );
        // If successful, mark as purged in DB
        await mediaRepo.confirmCloudPurge(file._id.toString());
        console.log(`Cloud file purged: ${file.storageKey}`);
      } catch (error) {
        console.error(`Failed to purge ${file.storageKey}:`, error);
      }
    }
  },
  {
    connection: redis,
  },
);

// 3. Scheduler (using BullMQ's repeatable jobs) to run every 5 minutes
export async function scheduleCloudPurge() {
  await cloudPurgeQueue.add(
    "purge-orphaned-files",
    {},
    {
      repeat: { every: 5 * 60 * 1000 }, // every 5 minutes
      removeOnComplete: true,
      removeOnFail: 100, // keep last 100 failures for inspection
    },
  );
}
