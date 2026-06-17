import { Redis } from "ioredis";
import { ApiError } from "../utils/apiError.js";
import { env } from "./env.js";

if (!env.IOREDIS_URL) {
  throw new ApiError(401, "IOREDIS_URL environment variable is not defined");
}

export const redis = new Redis(env.IOREDIS_URL, {
  maxRetriesPerRequest: null,
});
