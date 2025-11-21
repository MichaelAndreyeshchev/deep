import { redis } from './redis-client';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export class RedisRateLimiter {
  private prefix: string;
  private limit: number;
  private window: number; // in seconds

  constructor(options: {
    prefix?: string;
    limit?: number;
    window?: number;
  } = {}) {
    this.prefix = options.prefix || 'rate_limit';
    this.limit = options.limit || 100;
    this.window = options.window || 60;
  }

  async checkLimit(identifier: string): Promise<RateLimitResult> {
    const key = `${this.prefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.window * 1000;

    // Use Redis pipeline for atomic operations
    const pipeline = redis.pipeline();
    
    // Remove old entries outside the window
    pipeline.zremrangebyscore(key, '-inf', windowStart);
    
    // Count current entries in the window
    pipeline.zcard(key);
    
    // Add current request with timestamp as score
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiry on the key
    pipeline.expire(key, this.window);
    
    // Execute pipeline
    const results = await pipeline.exec();
    
    if (!results) {
      throw new Error('Redis pipeline execution failed');
    }

    // Extract the count from pipeline results
    const count = (results[1][1] as number) || 0;
    const success = count < this.limit;
    
    // If over limit, remove the request we just added
    if (!success && results[2][0] === null) {
      await redis.zrem(key, `${now}-${Math.random()}`);
    }

    return {
      success,
      limit: this.limit,
      remaining: Math.max(0, this.limit - count),
      reset: now + this.window * 1000,
    };
  }

  async reset(identifier: string): Promise<void> {
    const key = `${this.prefix}:${identifier}`;
    await redis.del(key);
  }
}

// Create a singleton instance
export const rateLimiter = new RedisRateLimiter({
  prefix: '@app/ratelimit',
  limit: 100,
  window: 60,
});
