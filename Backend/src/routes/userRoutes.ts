import express from "express";
import * as userController from "../controllers/userController.js";
import { authenticate } from "../middlewares/authMiddleware.js";
import { sanitizeMiddleware } from "../middlewares/sanitize.js";
import { securityMiddleware } from "../middlewares/securityMiddleware.js";
import { rateLimiterMiddleware } from "../middlewares/rateLimiter.js";

const router = express.Router();

router.post("/users", sanitizeMiddleware, userController.createUser);

router.post(
  "/otp-requests",
  securityMiddleware,
  sanitizeMiddleware,
  userController.createOtpRequest,
);

router.post(
  "/sessions",
  securityMiddleware,
  sanitizeMiddleware,
  rateLimiterMiddleware(5, 60),
  userController.createSession,
);

router.delete("/sessions", authenticate, userController.destroySession);

router.post("/tokens", userController.createToken);

router.post(
  "/password-resets",
  sanitizeMiddleware,
  rateLimiterMiddleware(3, 60),
  userController.createPasswordReset,
);

router.patch(
  "/password-resets",
  sanitizeMiddleware,
  userController.updatePassword,
);

export default router;
