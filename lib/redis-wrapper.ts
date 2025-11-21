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
    // Mock evalsha for rate limiting - return success
    return ['allowed', 1, -1, -1, -1];
  }

  async eval(script: string, keys: string[], args: string[]) {
    // Mock eval for rate limiting - return success
    return ['allowed', 1, -1, -1, -1];
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

// Check if we're using real Upstash Redis or local development
function isUpstashConfigured() {
  const url = process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  
  // Check if it's a real Upstash URL (contains upstash.io)
  return url.includes('upstash.io') && token.length > 20;
}

// Create the appropriate Redis client
export const createRedisClient = () => {
  if (isUpstashConfigured()) {
    // Use real Upstash Redis
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
