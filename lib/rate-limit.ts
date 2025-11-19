import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { createRedisClient } from './redis-wrapper';

// Create a new Redis instance with wrapper for local development
export const redis = createRedisClient();

// Create a new rate limiter that allows 5 requests per 60 seconds
export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '60 s'),
  analytics: true,
  prefix: '@upstash/ratelimit',
});
