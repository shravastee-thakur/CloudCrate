import { Request, Response, NextFunction } from "express";
import * as userService from "../services/userService.js";
import * as queueService from "../services/queueService.js";
import logger from "../utils/logger.js";
import { ApiError } from "../utils/apiError.js";
import {
  forgetPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from "../validators/authValidator.js";
import { sendAuthResponse } from "../helper/sendAuthResponse.js";
import { env } from "../config/env.js";

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const validatedData = registerSchema.parse(req.body);

    const user = await userService.register(validatedData);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// POST /otp-requests
export const createOtpRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const validatedData = loginSchema.parse(req.body);

    const user = await userService.loginVerifyCredentials(validatedData);

    const otp = await userService.processLoginOtp(user.email);

    await queueService.sendLoginOtpEmail(user.email, otp);

    logger.info(`OTP sent to ${user.email}`);

    return res.status(201).json({
      success: true,
      message: "Otp sent successfully to your registered email",
      user: user._id,
    });
  } catch (error) {
    next(error);
  }
};

// POST /sessions
export const createSession = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const validatedData = verifyOtpSchema.parse(req.body);
    const { userId, otp } = validatedData;

    const user = await userService.verifyUserOtp(userId, otp);

    const token = await userService.createTokensAndSave(user);
    logger.info(`OTP verified. Login success for ${user.email}`);

    return sendAuthResponse(res, token, user, "Logged in successfully");
  } catch (error) {
    next(error);
  }
};

// POST /tokens
export const createToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const oldToken = req.cookies?.refreshToken;
    if (!oldToken) throw new ApiError(401, "Refresh token missing");

    const { accessToken, refreshToken, user } =
      await userService.rotateRefreshToken(oldToken);

    return sendAuthResponse(
      res,
      { accessToken, refreshToken },
      user,
      "Token refreshed",
    );
  } catch (error) {
    next(error);
  }
};

// POST /password-resets
export const createPasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const validatedData = forgetPasswordSchema.parse(req.body);
    const { email } = validatedData;

    await userService.forgetPassword(email);

    logger.info(`Password reset link sent to ${email}`);

    return res.status(201).json({
      success: true,
      message: "Password reset link sent to your email",
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /password-resets
export const updatePassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const validatedData = resetPasswordSchema.parse(req.body);
    const { userId, token, newPassword } = validatedData;
    await userService.resetPassword(userId, token, newPassword);

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /sessions
export const destroySession = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }

    await userService.logout(userId);

    return res
      .clearCookie("refreshToken", {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
      })
      .status(200)
      .json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};
