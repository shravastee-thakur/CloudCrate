import { Queue, QueueOptions } from "bullmq";
import { redis } from "./redis.js";

export interface EmailJobData {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface BookingJobData {
  bookingId: string;
}

const queueOptions: QueueOptions = {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 1000,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
};

export const mailQueue = new Queue<EmailJobData>("mailQueue", queueOptions);
