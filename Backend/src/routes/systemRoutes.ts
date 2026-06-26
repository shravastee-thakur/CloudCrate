import express from "express";
import * as systemController from "../controllers/systemController.js";
import { verifyCronSecret } from "../middlewares/cronMiddleware.js";

const router = express.Router();

// It applies the verification middleware to every single route defined inside that specific router file
router.use(verifyCronSecret);

router.post("/cron/purge-cloud", systemController.purgeOrphanedCloudFiles);
router.post(
  "/cron/abort-orphans",
  systemController.abortExpiredMultipartUploads,
);
router.post("/cron/reconcile-storage", systemController.reconcileStorageQuotas);

export default router;
