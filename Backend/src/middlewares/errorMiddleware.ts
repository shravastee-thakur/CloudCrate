import { env } from "../config/env.js";
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import logger from "../utils/logger.js";
import { ApiError } from "../utils/apiError.js";
import { ZodError } from "zod";

interface CustomError extends Error {
  statusCode?: number;
  code?: number;
  keyValue?: Record<string, unknown>;
  path?: string;
  value?: unknown;
  errors?: Record<string, { message: string }>;
  meta?: Record<string, unknown> | null;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let meta: Record<string, unknown> | null = null;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    meta = err.meta || null;
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if ("code" in err && err.code === 11000 && err.keyValue) {
    statusCode = 400;
    message = `Duplicate field value entered: ${Object.keys(err.keyValue).join(", ")}`;
  } else if (err instanceof mongoose.Error.ValidationError && err.errors) {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = err.issues.map((issue) => issue.message).join(", ");
  }

  // Smart Logging
  if (statusCode >= 500) {
    logger.error("Server Error:", {
      message: err.message,
      stack: err.stack,
      path: req.originalUrl, // Better than req.path if you use nested routers
      method: req.method,
    });
  } else {
    logger.warn("Client Error:", {
      message,
      statusCode,
      path: req.originalUrl,
      method: req.method,
    });
  }

  return res.status(statusCode).json({
    success: false,
    message,
    statusCode,
    ...(meta && { meta }),
    stack: env.NODE_ENV === "development" ? err.stack : undefined,
  });
};
