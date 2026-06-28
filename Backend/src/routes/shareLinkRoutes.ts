import express from "express";
import * as shareLinkController from "../controllers/shareLinkController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Private routes
router.post("/", authenticate, shareLinkController.createShareLink);
router.get("/my-links", authenticate, shareLinkController.getUserShareLinks);
router.delete(
  "/:shareLinkId",
  authenticate,
  shareLinkController.revokeShareLink,
);

// Public route
router.post("/:token/download", shareLinkController.getPublicDownloadUrl);

export default router;
