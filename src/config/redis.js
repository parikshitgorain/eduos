/**
 * Redis Configuration
 * 
 * Manages Redis connection for caching and session management.
 * 
 * Task: 1.2.3 - Create tenant routing cache layer
 * 
 * Features:
 * - Connection management with automatic reconnection
 * - Health checks
 * - Graceful shutdown
 * - Error handling
 */

const Redis = require('ioredis');
require('dotenv').config();

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  
  // Connection settings
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  
  // Reconnection settings
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  
  // Timeouts
  connectTimeout: 10000,
  commandTimeout: 5000,
  
  // Logging
  lazyConnect: false,
  showFriendlyErrorStack: process.env.NODE_ENV !== 'production'
};

// Create Redis client
const redis = new Redis(redisConfig);

// Connection event handlers
redis.on('connect', () => {
  console.log('Redis client connecting...');
});

redis.on('ready', () => {
  console.log('Redis client ready');
});

redis.on('error', (err) => {
  console.error('Redis client error:', err);
});

redis.on('close', () => {
  console.log('Redis connection closed');
});

redis.on('reconnecting', () => {
  console.log('Redis client reconnecting...');
});

redis.on('end', () => {
  console.log('Redis connection ended');
});

/**
 * Health check - verify Redis connectivity
 * @returns {Promise<boolean>}
 */
async function healthCheck() {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}

/**
 * Gracefully close Redis connection
 * @returns {Promise<void>}
 */
async function close() {
  await redis.quit();
  console.log('Redis connection closed gracefully');
}

/**
 * Get Redis client instance
 * @returns {Redis}
 */
function getClient() {
  return redis;
}

module.exports = {
  redis,
  getClient,
  healthCheck,
  close
};
