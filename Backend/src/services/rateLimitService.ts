import { redis } from "../config/redis.js";

const rateLimitService = async (
  key: string,
  limit: number,
  windowSec: number,
) => {
  const fullKey = `ratelimit:${key}`;
  const count = await redis.incr(fullKey);

  if (count === 1) {
    await redis.expire(fullKey, windowSec);
  }

  return count > limit;
};

export default rateLimitService;
