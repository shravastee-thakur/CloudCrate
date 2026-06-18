import { Request, Response, NextFunction } from "express";
import rateLimit from "../services/rateLimitService.js";

export const rateLimiterMiddleware = (limit: number, windowSec: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key: string = req.ip || "unknown_ip";

    const blocked: boolean = await rateLimit(key, limit, windowSec);

    if (blocked) {
      return res.status(429).json({ message: "Too many requests" });
    }

    next();
  };
};
