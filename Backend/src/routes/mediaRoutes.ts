import express from "express";
import * as mediaController from "../controllers/mediaController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/initialize", authenticate, mediaController.initializeUpload);
router.post("/finalize", authenticate, mediaController.finalizeUpload);
router.get("/dashboard", authenticate, mediaController.getUserDashboardMedia);
router.get(
  "/:mediaId/download",
  authenticate,
  mediaController.getSecureDownloadUrl,
);
router.delete("/:mediaId", authenticate, mediaController.softDeleteMedia);

export default router;
