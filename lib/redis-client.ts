import Redis from 'ioredis';

// Create Redis client for actual Redis container
export const createRedisConnection = () => {
  const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
  
  console.log('Connecting to Redis at:', redisUrl);
  
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    reconnectOnError: (err) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        // Only reconnect when the error contains "READONLY"
        return true;
      }
      return false;
    },
  });

  redis.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redis.on('connect', () => {
    console.log('Successfully connected to Redis');
  });

  return redis;
};

// Export a singleton instance
export const redis = createRedisConnection();
