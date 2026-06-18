import { env } from "../config/env.js";
import * as userRepo from "../repositories/userRepo.js";
import * as otpService from "./otpService.js";
import * as queueService from "./queueService.js";
import { CreateUserData, UserDocument } from "../repositories/userRepo.js";
import { ApiError } from "../utils/apiError.js";
import crypto from "crypto";
import {
  generateAccessToken,
  generateRefreshToken,
  TokenPayload,
  verifyRefreshToken,
} from "../utils/jwt.js";
import { LoginInput, RegisterInput } from "../validators/authValidator.js";

export interface UserDto {
  _id: string;
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
  refreshToken: string;
  isVerified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const mapToUserDto = (user: UserDocument): UserDto => {
  const obj = user.toObject();

  return {
    _id: obj._id.toString(),
    name: obj.name,
    email: obj.email,
    password: obj.password,
    role: obj.role,
    refreshToken: obj.refreshToken,
    isVerified: obj.isVerified,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

// Register
export const register = async (userData: RegisterInput): Promise<UserDto> => {
  const existingUser = await userRepo.findByEmail(userData.email);
  if (existingUser) {
    throw new ApiError(409, "User already exists");
  }

  const newUser = await userRepo.createUser(userData);
  return mapToUserDto(newUser);
};

// -----x-----(login)------

// Login verify
export const loginVerifyCredentials = async (
  data: LoginInput,
): Promise<UserDto> => {
  const user = await userRepo.findByEmail(data.email);
  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  const match = await user.comparePassword(data.password);
  if (!match) throw new ApiError(401, "Invalid credentials");

  return mapToUserDto(user);
};

// hmac hashing
export const hashedOtp = (otp: string): string => {
  return crypto.createHmac("sha256", env.HMAC_SECRET).update(otp).digest("hex");
};

// Otp save
export const processLoginOtp = async (userEmail: string) => {
  const otp = String(crypto.randomInt(100000, 999999));
  await otpService.saveOtp(userEmail, otp);
  return otp;
};

// Verify Otp
export const verifyUserOtp = async (userId: string, otp: string) => {
  let user = await userRepo.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const inputHash = hashedOtp(otp);

  const isValid = await otpService.consumeOtp(user.email, inputHash);

  if (!isValid) {
    throw new ApiError(401, "Invalid or expired OTP");
  }

  if (!user.isVerified) {
    const updatedUser = await userRepo.updateUser(userId, { isVerified: true });
    if (!updatedUser)
      throw new ApiError(500, "Failed to update user verification status");
    user = updatedUser;
  }

  return mapToUserDto(user);
};

// -----x-----(token rotate)--------

// Access Refresh
export const createTokensAndSave = async (user: UserDto) => {
  const tokenPayload = {
    id: user._id.toString(),
    role: user.role,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  const hashedRefresh = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  await userRepo.updateUser(user._id.toString(), {
    refreshToken: hashedRefresh,
  });

  return { accessToken, refreshToken };
};

export const rotateRefreshToken = async (oldToken: string) => {
  let decoded: TokenPayload;
  try {
    decoded = verifyRefreshToken(oldToken);
  } catch (error) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const user = await userRepo.findById(decoded.id);
  if (!user) throw new ApiError(404, "User not found");

  const hashedRefreshToken = crypto
    .createHash("sha256")
    .update(oldToken)
    .digest("hex");

  const storedBuffer = Buffer.from(user.refreshToken, "hex");
  const hashBuffer = Buffer.from(hashedRefreshToken, "hex");

  const isMatch =
    storedBuffer.length === hashBuffer.length &&
    crypto.timingSafeEqual(storedBuffer, hashBuffer);

  if (!isMatch) {
    throw new ApiError(401, "Refresh token mismatch");
  }

  const safeUser = mapToUserDto(user);

  const { accessToken, refreshToken } = await createTokensAndSave(safeUser);

  return { accessToken, refreshToken, user: safeUser };
};

// ------x------(forget password)-------

export const forgetPassword = async (email: string) => {
  const user = await userRepo.findByEmail(email);
  if (!user) throw new ApiError(404, "User not found");

  const resetToken = crypto.randomBytes(10).toString("hex");

  const hashedToken = crypto
    .createHmac("sha256", env.HMAC_SECRET)
    .update(resetToken)
    .digest("hex");

  await otpService.saveResetToken(user._id.toString(), hashedToken);

  const resetLink = `${env.FRONTEND_URL}/reset-password?token=${resetToken}&userId=${user._id}`;

  await queueService.sendPasswordResetEmail(user.email, resetLink);
};

export const resetPassword = async (
  userId: string,
  token: string,
  newPassword: string,
) => {
  const hashedToken = crypto
    .createHmac("sha256", env.HMAC_SECRET)
    .update(token)
    .digest("hex");

  const isValid = await otpService.consumeResetToken(userId, hashedToken);
  if (!isValid) {
    throw new ApiError(401, "Invalid or expired reset token");
  }

  const user = await userRepo.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  user.password = newPassword;
  await user.save();
};

// ------x------(logout)-----

export const logout = async (userId: string) => {
  if (!userId) return;

  await userRepo.updateUser(userId, { refreshToken: "" });
};
