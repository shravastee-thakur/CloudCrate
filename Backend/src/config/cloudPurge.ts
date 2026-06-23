import { Queue } from "bullmq";
import { redis } from "./redis.js";

export const cloudPurgeQueue = new Queue("cloud-purge", {
  connection: redis,
});
