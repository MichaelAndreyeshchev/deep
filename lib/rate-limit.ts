// Import the Redis-based rate limiter
import { rateLimiter as redisRateLimiter } from './redis-rate-limit';

// Create a wrapper that matches the Upstash interface
export const rateLimiter = {
  limit: async (identifier: string) => {
    const result = await redisRateLimiter.checkLimit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  },
};

// Export the Redis client
export { redis } from './redis-client';
