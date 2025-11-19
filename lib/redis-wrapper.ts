import { Redis } from '@upstash/redis';

// Mock Redis client that handles local Redis connections
class LocalRedisWrapper {
  private connected = false;

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
