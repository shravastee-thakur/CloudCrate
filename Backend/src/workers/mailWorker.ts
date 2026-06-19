import { Worker } from "bullmq";
import { redis } from "../config/redis.js";
import { EmailJobData } from "../config/bullmq.js";
import sendMail from "../config/sendMail.js";
import logger from "../utils/logger.js";

const mailWorker = new Worker<EmailJobData, void, string>(
  "mailQueue",
  async (job) => {
    const { to, subject, htmlContent } = job.data;
    if (!to || !subject) {
      throw new Error(
        `Invalid job data: missing recipient or subject for job ${job.id}`,
      );
    }

    await sendMail(to, subject, htmlContent);
  },
  {
    connection: redis,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
    settings: {
      // Injecting the Full Jitter backoff strategy
      backoffStrategy: (attemptsMade: number, type?: string) => {
        if (type === "full-jitter") {
          const cap = 60000;
          const base = 2000;
          const temp = Math.min(cap, base * Math.pow(2, attemptsMade));
          return Math.floor(Math.random() * temp);
        }
        return 1000;
      },
    },
  },
);

mailWorker.on("completed", (job) => {
  logger.info(`Email job ${job.id} completed successfully for ${job.data.to}`);
});

mailWorker.on("failed", (job, err) => {
  if (job) {
    const maxAttempts = job.opts.attempts || 1;
    const isPermanentFailure = job.attemptsMade >= maxAttempts;

    if (isPermanentFailure) {
      logger.error(
        `[DLQ] Email job ${job.id} permanently failed for ${job.data.to} after ${job.attemptsMade} attempts. Error: ${err.message}`,
      );
    } else {
      logger.warn(
        `Email job ${job.id} failed attempt ${job.attemptsMade}/${maxAttempts} for ${job.data.to}. Retrying... Error: ${err.message}`,
      );
    }
  }
});

mailWorker.on("error", (err) => {
  logger.error(`MailWorker critical error: ${err.message}`);
});

export default mailWorker;
