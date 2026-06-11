const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

redis.on('error', (err) => console.error('Redis error:', err));
redis.on('connect', () => console.log('Redis connected'));

module.exports = {
  set: (key, value, ttl) => redis.setex(key, ttl, JSON.stringify(value)),
  get: async (key) => {
    const v = await redis.get(key);
    return v ? JSON.parse(v) : null;
  },
  del: (key) => redis.del(key),
  publish: (channel, msg) => redis.publish(channel, JSON.stringify(msg)),
  redis,
};
