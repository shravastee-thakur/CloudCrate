import { env } from "../config/env.js";
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import logger from "../utils/logger.js";
import { ApiError } from "../utils/apiError.js";
import { ZodError } from "zod";

interface CustomError extends Error {
  statusCode?: number;
  code?: number;
  keyValue?: Record<string, any>;
  path?: string;
  value?: any;
  errors?: Record<string, { message: string }>;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  logger.error("Error:", err);

  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let meta = err instanceof ApiError ? err.meta : null;

  // 1. Check if it's our custom ApiError using instanceof
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    meta = err.meta;
  }

  // 2. Handle Mongoose invalid ID
  else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Duplicate key error
  else if ("code" in err && err.code === 11000 && err.keyValue) {
    statusCode = 400;
    message = `Duplicate field value entered: ${Object.keys(err.keyValue).join(", ")}`;
  }

  // Mongoose validation error
  else if (err instanceof mongoose.Error.ValidationError && err.errors) {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = err.issues.map((issue) => issue.message).join(", ");
  }

  // 5. Fallback for generic errors (already defaulted at the top)
  else {
    message = err.message || message;
  }

  return res.status(statusCode).json({
    success: false,
    message,
    statusCode,
    meta,
    stack: env.NODE_ENV === "development" ? err.stack : undefined,
  });
};
