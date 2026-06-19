import express from "express";
import * as userController from "../controllers/userController.js";
import { authenticate } from "../middlewares/authMiddleware.js";
import { sanitizeMiddleware } from "../middlewares/sanitize.js";
import { securityMiddleware } from "../middlewares/securityMiddleware.js";
import { rateLimiterMiddleware } from "../middlewares/rateLimiter.js";

const router = express.Router();

// Register
router.post("/", sanitizeMiddleware, userController.createUser);

// Login step one
router.post(
  "/otp-requests",
  securityMiddleware,
  sanitizeMiddleware,
  userController.createOtpRequest,
);

// Verify otp
router.post(
  "/sessions",
  securityMiddleware,
  sanitizeMiddleware,
  rateLimiterMiddleware(5, 60),
  userController.createSession,
);

// Logout
router.delete("/sessions", authenticate, userController.destroySession);

// Refresh
router.post("/tokens", userController.createToken);

// Forget password
router.post(
  "/password-resets",
  sanitizeMiddleware,
  rateLimiterMiddleware(3, 60),
  userController.createPasswordReset,
);

// Reset password
router.patch(
  "/password-resets",
  sanitizeMiddleware,
  userController.updatePassword,
);

export default router;
