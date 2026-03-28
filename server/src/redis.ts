import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;

const redis: Redis | null = REDIS_URL
  ? new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
    })
  : null;

if (redis) {
  redis.on('error', (err) => {
    console.error('Redis error:', err);
  });

  redis.on('connect', () => {
    console.log('Redis connected');
  });
}

export default redis;
