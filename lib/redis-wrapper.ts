import { Redis } from '@upstash/redis';

// Mock Redis client that handles local Redis connections
class LocalRedisWrapper {
  private connected = false;
  private zsets: Map<string, Map<string, number>> = new Map();

  constructor(config: { url?: string; token?: string }) {
    // For local development, we don't need to actually connect
    this.connected = true;
  }

  async get(key: string) {
    // Return null for local development
    return null;
  }

  async set(key: string, value: any, options?: { ex?: number }) {
    // No-op for local development
    return 'OK';
  }

  async incr(key: string) {
    // Return a mock increment
    return 1;
  }

  async expire(key: string, seconds: number) {
    // No-op for local development
    return 1;
  }

  async del(key: string) {
    // No-op for local development
    return 1;
  }

  async evalsha(sha: string, keys: string[], args: string[]) {
    // Mock evalsha for rate limiting with actual enforcement
    return this.executeRateLimitScript(keys, args);
  }

  async eval(script: string, keys: string[], args: string[]) {
    // Mock eval for rate limiting with actual enforcement
    return this.executeRateLimitScript(keys, args);
  }

  private rateLimitData = new Map<string, { count: number; resetAt: number }>();

  private executeRateLimitScript(keys: string[], args: string[]) {
    const key = keys[0];
    const limit = parseInt(args[0]);
    const window = parseInt(args[1]);
    const now = Date.now();

    let data = this.rateLimitData.get(key);
    
    if (!data || data.resetAt < now) {
      // Reset window
      data = { count: 1, resetAt: now + window };
      this.rateLimitData.set(key, data);
      return ['allowed', 1, limit - 1, -1, data.resetAt];
    }

    if (data.count >= limit) {
      // Rate limit exceeded
      return ['denied', data.count, 0, -1, data.resetAt];
    }

    // Increment and allow
    data.count++;
    this.rateLimitData.set(key, data);
    return ['allowed', data.count, limit - data.count, -1, data.resetAt];
  }

  async scriptLoad(script: string) {
    // Mock script load - return a fake SHA
    return 'mock_sha_123456789';
  }

  async zincrby(key: string, increment: number, member: string) {
    const set = this.zsets.get(key) || new Map();
    const currentScore = set.get(member) || 0;
    const newScore = currentScore + increment;
    set.set(member, newScore);
    this.zsets.set(key, set);
    return newScore;
  }

  async zscore(key: string, member: string) {
    const set = this.zsets.get(key);
    if (!set) return null;
    const score = set.get(member);
    return score !== undefined ? score : null;
  }

  async zadd(key: string, score: number, member: string) {
    const set = this.zsets.get(key) || new Map();
    set.set(member, score);
    this.zsets.set(key, set);
    return 1;
  }

  async zrange(key: string, start: number, stop: number, options?: { withScores?: boolean }) {
    const set = this.zsets.get(key);
    if (!set) return [];
    
    const entries = Array.from(set.entries()).sort((a, b) => a[1] - b[1]);
    const slice = entries.slice(start, stop === -1 ? undefined : stop + 1);
    
    if (options?.withScores) {
      return slice.flatMap(([member, score]) => [member, score]);
    }
    return slice.map(([member]) => member);
  }

  async zrevrange(key: string, start: number, stop: number, options?: { withScores?: boolean }) {
    const set = this.zsets.get(key);
    if (!set) return [];
    
    const entries = Array.from(set.entries()).sort((a, b) => b[1] - a[1]);
    const slice = entries.slice(start, stop === -1 ? undefined : stop + 1);
    
    if (options?.withScores) {
      return slice.flatMap(([member, score]) => [member, score]);
    }
    return slice.map(([member]) => member);
  }

  async zcard(key: string) {
    const set = this.zsets.get(key);
    return set ? set.size : 0;
  }

  async zrem(key: string, member: string) {
    const set = this.zsets.get(key);
    if (!set) return 0;
    const deleted = set.delete(member);
    return deleted ? 1 : 0;
  }
}

// Check if we have Upstash credentials configured
function isUpstashConfigured() {
  const url = process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  
  // Check if we have valid Upstash credentials
  return url.length > 0 && token.length > 0;
}

// Create the appropriate Redis client
export const createRedisClient = () => {
  if (isUpstashConfigured()) {
    // Use Upstash Redis (either real Upstash or local Redis via Upstash HTTP proxy)
    console.log('Using Upstash Redis client');
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  } else {
    // Use mock Redis for local development
    console.log('Using mock Redis client for local development');
    return new LocalRedisWrapper({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }) as any as Redis;
  }
};
