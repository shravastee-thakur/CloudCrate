import { Request, Response, NextFunction } from "express";
import aj from "../utils/arcjet.js";
import logger from "../utils/logger.js";

export const securityMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const decision = await aj.protect(req);

    if (decision.isDenied()) {
      if (decision.reason.isBot()) {
        return res.status(403).json({ message: "No automated access allowed" });
      }

      if (decision.reason.isShield()) {
        return res.status(400).json({ message: "Invalid request parameters" });
      }

      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  } catch (error) {
    logger.error(`Arcjet Error: ${(error as Error).message}`);
    next(error);
  }
};
