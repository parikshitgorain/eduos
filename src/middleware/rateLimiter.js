/**
 * Rate Limiting Middleware with DDoS Protection
 * 
 * Task: 4.3.1 - Implement rate limiting and DDoS protection
 * 
 * Features:
 * - Redis-based rate limiting with sliding window algorithm
 * - 100 req/min per IP (public), 1000 req/min per user (authenticated)
 * - 429 Too Many Requests response with Retry-After header
 * - IP blacklist/whitelist management
 * - Integration-ready for CDN (Cloudflare/AWS CloudFront)
 */

const rateLimit = require('express-rate-limit');
const { getClient } = require('../config/redis');

/**
 * Redis Store for Rate Limiting
 * Implements sliding window algorithm using Redis sorted sets
 */
class RedisStore {
  constructor(options = {}) {
    this.client = getClient();
    this.prefix = options.prefix || 'rl:';
    this.windowMs = options.windowMs || 60000;
  }

  /**
   * Increment request count for a key
   * @param {string} key - Rate limit key (IP or user ID)
   * @returns {Promise<{totalHits: number, resetTime: Date}>}
   */
  async increment(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const redisKey = `${this.prefix}${key}`;

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.client.pipeline();
      
      // Remove old entries outside the window
      pipeline.zremrangebyscore(redisKey, 0, windowStart);
      
      // Add current request with timestamp as score
      pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
      
      // Count requests in current window
      pipeline.zcard(redisKey);
      
      // Set expiry to window duration + buffer
      pipeline.expire(redisKey, Math.ceil(this.windowMs / 1000) + 10);
      
      const results = await pipeline.exec();
      
      // Extract count from zcard result
      const totalHits = results[2][1];
      const resetTime = new Date(now + this.windowMs);
      
      return { totalHits, resetTime };
    } catch (error) {
      console.error('Redis rate limit error:', error);
      // Fallback: allow request on Redis error
      return { totalHits: 0, resetTime: new Date(now + this.windowMs) };
    }
  }

  /**
   * Decrement request count (for skipSuccessfulRequests)
   * @param {string} key - Rate limit key
   */
  async decrement(key) {
    const redisKey = `${this.prefix}${key}`;
    try {
      // Remove the most recent entry
      await this.client.zpopmax(redisKey);
    } catch (error) {
      console.error('Redis rate limit decrement error:', error);
    }
  }

  /**
   * Reset rate limit for a key
   * @param {string} key - Rate limit key
   */
  async resetKey(key) {
    const redisKey = `${this.prefix}${key}`;
    try {
      await this.client.del(redisKey);
    } catch (error) {
      console.error('Redis rate limit reset error:', error);
    }
  }
}

/**
 * IP Blacklist/Whitelist Management
 */
class IPAccessControl {
  constructor() {
    this.client = getClient();
    this.blacklistKey = 'ip:blacklist';
    this.whitelistKey = 'ip:whitelist';
  }

  /**
   * Check if IP is blacklisted
   * @param {string} ip - IP address
   * @returns {Promise<boolean>}
   */
  async isBlacklisted(ip) {
    try {
      return await this.client.sismember(this.blacklistKey, ip) === 1;
    } catch (error) {
      console.error('Blacklist check error:', error);
      return false;
    }
  }

  /**
   * Check if IP is whitelisted
   * @param {string} ip - IP address
   * @returns {Promise<boolean>}
   */
  async isWhitelisted(ip) {
    try {
      return await this.client.sismember(this.whitelistKey, ip) === 1;
    } catch (error) {
      console.error('Whitelist check error:', error);
      return false;
    }
  }

  /**
   * Add IP to blacklist
   * @param {string} ip - IP address
   * @param {number} ttl - Time to live in seconds (optional)
   */
  async addToBlacklist(ip, ttl = null) {
    try {
      await this.client.sadd(this.blacklistKey, ip);
      if (ttl) {
        // Set expiry for temporary blacklist
        await this.client.expire(`${this.blacklistKey}:${ip}`, ttl);
      }
    } catch (error) {
      console.error('Add to blacklist error:', error);
    }
  }

  /**
   * Remove IP from blacklist
   * @param {string} ip - IP address
   */
  async removeFromBlacklist(ip) {
    try {
      await this.client.srem(this.blacklistKey, ip);
    } catch (error) {
      console.error('Remove from blacklist error:', error);
    }
  }

  /**
   * Add IP to whitelist
   * @param {string} ip - IP address
   */
  async addToWhitelist(ip) {
    try {
      await this.client.sadd(this.whitelistKey, ip);
    } catch (error) {
      console.error('Add to whitelist error:', error);
    }
  }

  /**
   * Remove IP from whitelist
   * @param {string} ip - IP address
   */
  async removeFromWhitelist(ip) {
    try {
      await this.client.srem(this.whitelistKey, ip);
    } catch (error) {
      console.error('Remove from whitelist error:', error);
    }
  }

  /**
   * Get all blacklisted IPs
   * @returns {Promise<string[]>}
   */
  async getBlacklist() {
    try {
      return await this.client.smembers(this.blacklistKey);
    } catch (error) {
      console.error('Get blacklist error:', error);
      return [];
    }
  }

  /**
   * Get all whitelisted IPs
   * @returns {Promise<string[]>}
   */
  async getWhitelist() {
    try {
      return await this.client.smembers(this.whitelistKey);
    } catch (error) {
      console.error('Get whitelist error:', error);
      return [];
    }
  }
}

// Initialize IP access control
const ipAccessControl = new IPAccessControl();

/**
 * Extract client IP address
 * Supports CDN headers (Cloudflare, AWS CloudFront)
 * @param {Request} req - Express request object
 * @returns {string} - Client IP address
 */
function getClientIP(req) {
  // Check CDN headers first
  const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
  const xForwardedFor = req.headers['x-forwarded-for']; // AWS CloudFront, proxies
  const xRealIP = req.headers['x-real-ip']; // NGINX
  
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return xForwardedFor.split(',')[0].trim();
  }
  
  if (xRealIP) {
    return xRealIP;
  }
  
  // Fallback to socket IP
  return req.ip || req.connection.remoteAddress || 'unknown';
}

/**
 * Create rate limiter with Redis store
 * @param {Object} options - Rate limiter options
 * @returns {Function} - Express middleware
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 60000, // 1 minute default
    max = 100,
    message = 'Too many requests',
    keyGenerator = null,
    skip = null,
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  const store = new RedisStore({ windowMs, prefix: options.prefix || 'rl:' });

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    
    // Custom key generator
    keyGenerator: keyGenerator || ((req) => {
      // Use user ID for authenticated requests, IP for public
      if (req.user && req.user.id) {
        return `user:${req.user.id}`;
      }
      return `ip:${getClientIP(req)}`;
    }),
    
    // Skip function with blacklist/whitelist check
    skip: async (req) => {
      const ip = getClientIP(req);
      
      // Check whitelist first
      if (await ipAccessControl.isWhitelisted(ip)) {
        return true;
      }
      
      // Check blacklist
      if (await ipAccessControl.isBlacklisted(ip)) {
        // Don't skip, but will be blocked by rate limit
        return false;
      }
      
      // Custom skip logic
      if (skip && typeof skip === 'function') {
        return skip(req);
      }
      
      return false;
    },
    
    // Custom handler for rate limit exceeded
    handler: (req, res) => {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.status(429).json({
        error: 'Too Many Requests',
        message,
        retryAfter: `${retryAfter} seconds`,
        retryAfterSeconds: retryAfter
      });
    },
    
    // Store implementation
    store: {
      async increment(key) {
        return store.increment(key);
      },
      async decrement(key) {
        if (skipSuccessfulRequests || skipFailedRequests) {
          return store.decrement(key);
        }
      },
      async resetKey(key) {
        return store.resetKey(key);
      }
    },
    
    skipSuccessfulRequests,
    skipFailedRequests
  });
}

/**
 * Public API rate limiter
 * 100 requests per minute per IP
 */
const publicApiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.PUBLIC_RATE_LIMIT || '100', 10),
  message: 'Too many requests from this IP. Please try again later.',
  prefix: 'rl:public:',
  skip: (req) => req.path === '/health' || req.path === '/'
});

/**
 * Authenticated user rate limiter
 * 1000 requests per minute per user
 */
const authenticatedApiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.AUTHENTICATED_RATE_LIMIT || '1000', 10),
  message: 'Too many requests. Please try again later.',
  prefix: 'rl:auth:',
  keyGenerator: (req) => {
    // Use user ID if authenticated
    if (req.user && req.user.id) {
      return `user:${req.user.id}`;
    }
    // Fallback to IP
    return `ip:${getClientIP(req)}`;
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks
 */
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT || '5', 10),
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
  prefix: 'rl:auth-endpoint:',
  skipSuccessfulRequests: true
});

/**
 * Strict rate limiter for password reset endpoints
 */
const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.PASSWORD_RESET_RATE_LIMIT || '3', 10),
  message: 'Too many password reset requests. Please try again after 1 hour.',
  prefix: 'rl:password-reset:'
});

/**
 * Rate limiter for MFA endpoints
 */
const mfaLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.MFA_RATE_LIMIT || '10', 10),
  message: 'Too many MFA verification attempts. Please try again after 15 minutes.',
  prefix: 'rl:mfa:'
});

/**
 * Rate limiter for domain verification endpoints
 */
const domainVerificationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.DOMAIN_VERIFICATION_RATE_LIMIT || '10', 10),
  message: 'Too many domain verification requests. Please try again after 1 hour.',
  prefix: 'rl:domain-verify:'
});

/**
 * Middleware to check IP blacklist
 */
async function checkBlacklist(req, res, next) {
  const ip = getClientIP(req);
  
  if (await ipAccessControl.isBlacklisted(ip)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Your IP address has been blocked due to suspicious activity.'
    });
  }
  
  next();
}

// Legacy exports for backward compatibility
const apiLimiter = publicApiLimiter;

module.exports = {
  // New exports
  publicApiLimiter,
  authenticatedApiLimiter,
  checkBlacklist,
  ipAccessControl,
  getClientIP,
  createRateLimiter,
  
  // Legacy exports
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  mfaLimiter,
  domainVerificationLimiter
};
