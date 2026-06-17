import { Request, Response, NextFunction } from "express";
import sanitize from "mongo-sanitize";

export const sanitizeMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Sanitize req.body (overwrite allowed)
    if (req.body && typeof req.body === "object") {
      req.body = sanitize(req.body) as typeof req.body;
    }

    // Sanitize req.query (must mutate, NOT reassign)
    if (req.query && typeof req.query === "object") {
      Object.keys(req.query).forEach((key) => {
        const value = req.query[key];
        if (value !== undefined) {
          req.query[key] = sanitize(value);
        }
      });
    }

    // Sanitize req.params (must mutate)
    if (req.params && typeof req.params === "object") {
      Object.keys(req.params).forEach((key) => {
        const value = req.params[key];
        if (value !== undefined) {
          req.params[key] = sanitize(value);
        }
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};
