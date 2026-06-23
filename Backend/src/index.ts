import { env } from "./config/env.js";
import app from "./app.js";
import { connectDb } from "./config/db.js";
import logger from "./utils/logger.js";
import { scheduleCloudPurge } from "./workers/cloudPurgeWorker.js";
import { scheduleExpiredUploadCleanup } from "./workers/expiredUploadWorker.js";

import "./workers/mailWorker.js";

const port = env.PORT || 5000;
connectDb();
await scheduleCloudPurge();
await scheduleExpiredUploadCleanup(); 

app.listen(port, () => {
  logger.info(`Listening on port: http://localhost:${port}`);
});
