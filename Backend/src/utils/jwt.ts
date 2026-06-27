import { env } from "../config/env.js";
import jwt, { JwtPayload } from "jsonwebtoken";
import { ApiError } from "./apiError.js";

export interface TokenPayload extends JwtPayload {
  id: string;
  role: string;
}

const accessSecret = env.ACCESS_SECRET;
if (!accessSecret) {
  throw new ApiError(401, "accessSecret environment variable is not defined");
}

const refreshSecret = env.REFRESH_SECRET;
if (!refreshSecret) {
  throw new ApiError(401, "refreshSecret environment variable is not defined");
}

export const generateAccessToken = (payload: TokenPayload) => {
  return jwt.sign(payload, accessSecret, { expiresIn: "7d" });
};

export const generateRefreshToken = (payload: TokenPayload) => {
  return jwt.sign(payload, refreshSecret, { expiresIn: "7d" });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, accessSecret) as TokenPayload;
  } catch (error) {
    throw new ApiError(401, "Invalid or expired access token");
  }
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, refreshSecret) as TokenPayload;
  } catch (error) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }
};
