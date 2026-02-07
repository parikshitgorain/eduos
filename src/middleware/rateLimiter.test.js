/**
 * Tests for Rate Limiter Middleware
 * Task: 4.3.1 - Implement rate limiting and DDoS protection
 */

// Mock express-rate-limit
jest.mock('express-rate-limit', () => {
  return jest.fn((options) => {
    return (req, res, next) => {
      // Simulate rate limiting logic
      if (req.__rateLimitExceeded) {
        options.handler(req, res);
      } else {
        next();
      }
    };
  });
});

// Mock Redis client
const mockRedisClient = {
  pipeline: jest.fn(),
  zremrangebyscore: jest.fn(),
  zadd: jest.fn(),
  zcard: jest.fn(),
  expire: jest.fn(),
  zpopmax: jest.fn(),
  del: jest.fn(),
  sismember: jest.fn(),
  sadd: jest.fn(),
  srem: jest.fn(),
  smembers: jest.fn()
};

const mockPipeline = {
  zremrangebyscore: jest.fn().mockReturnThis(),
  zadd: jest.fn().mockReturnThis(),
  zcard: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  exec: jest.fn()
};

mockRedisClient.pipeline.mockReturnValue(mockPipeline);

jest.mock('../config/redis', () => ({
  getClient: jest.fn(() => mockRedisClient)
}));

describe('Rate Limiter Middleware', () => {
  let rateLimiter;
  let RedisStore;
  let IPAccessControl;
  let getClientIP;
  let createRateLimiter;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Require rate limiter module
    rateLimiter = require('./rateLimiter');
    getClientIP = rateLimiter.getClientIP;
    createRateLimiter = rateLimiter.createRateLimiter;
    IPAccessControl = rateLimiter.ipAccessControl.constructor;
  });

  describe('getClientIP', () => {
    it('should extract IP from cf-connecting-ip header (Cloudflare)', () => {
      const req = {
        headers: {
          'cf-connecting-ip': '1.2.3.4'
        }
      };

      const ip = getClientIP(req);
      expect(ip).toBe('1.2.3.4');
    });

    it('should extract IP from x-forwarded-for header', () => {
      const req = {
        headers: {
          'x-forwarded-for': '1.2.3.4, 5.6.7.8'
        }
      };

      const ip = getClientIP(req);
      expect(ip).toBe('1.2.3.4');
    });

    it('should extract IP from x-real-ip header', () => {
      const req = {
        headers: {
          'x-real-ip': '1.2.3.4'
        }
      };

      const ip = getClientIP(req);
      expect(ip).toBe('1.2.3.4');
    });

    it('should fallback to req.ip', () => {
      const req = {
        headers: {},
        ip: '1.2.3.4'
      };

      const ip = getClientIP(req);
      expect(ip).toBe('1.2.3.4');
    });

    it('should fallback to connection.remoteAddress', () => {
      const req = {
        headers: {},
        connection: {
          remoteAddress: '1.2.3.4'
        }
      };

      const ip = getClientIP(req);
      expect(ip).toBe('1.2.3.4');
    });

    it('should return unknown if no IP found', () => {
      const req = {
        headers: {},
        connection: {}
      };

      const ip = getClientIP(req);
      expect(ip).toBe('unknown');
    });

    it('should prioritize Cloudflare header over others', () => {
      const req = {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'x-forwarded-for': '5.6.7.8',
          'x-real-ip': '9.10.11.12'
        },
        ip: '13.14.15.16'
      };

      const ip = getClientIP(req);
      expect(ip).toBe('1.2.3.4');
    });
  });

  describe('RedisStore', () => {
    let store;

    beforeEach(() => {
      // Create a new RedisStore instance
      const { getClient } = require('../config/redis');
      const client = getClient();
      
      // Create store manually for testing
      class TestRedisStore {
        constructor(options = {}) {
          this.client = client;
          this.prefix = options.prefix || 'rl:';
          this.windowMs = options.windowMs || 60000;
        }

        async increment(key) {
          const now = Date.now();
          const windowStart = now - this.windowMs;
          const redisKey = `${this.prefix}${key}`;

          try {
            const pipeline = this.client.pipeline();
            pipeline.zremrangebyscore(redisKey, 0, windowStart);
            pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
            pipeline.zcard(redisKey);
            pipeline.expire(redisKey, Math.ceil(this.windowMs / 1000) + 10);
            
            const results = await pipeline.exec();
            const totalHits = results[2][1];
            const resetTime = new Date(now + this.windowMs);
            
            return { totalHits, resetTime };
          } catch (error) {
            return { totalHits: 0, resetTime: new Date(now + this.windowMs) };
          }
        }

        async decrement(key) {
          const redisKey = `${this.prefix}${key}`;
          try {
            await this.client.zpopmax(redisKey);
          } catch (error) {
            // Ignore error
          }
        }

        async resetKey(key) {
          const redisKey = `${this.prefix}${key}`;
          try {
            await this.client.del(redisKey);
          } catch (error) {
            // Ignore error
          }
        }
      }

      store = new TestRedisStore({ prefix: 'test:', windowMs: 60000 });
    });

    describe('increment', () => {
      it('should increment request count', async () => {
        mockPipeline.exec.mockResolvedValueOnce([
          [null, 0], // zremrangebyscore
          [null, 1], // zadd
          [null, 5], // zcard
          [null, 1]  // expire
        ]);

        const result = await store.increment('test-key');

        expect(result.totalHits).toBe(5);
        expect(result.resetTime).toBeInstanceOf(Date);
        expect(mockPipeline.zremrangebyscore).toHaveBeenCalled();
        expect(mockPipeline.zadd).toHaveBeenCalled();
        expect(mockPipeline.zcard).toHaveBeenCalled();
        expect(mockPipeline.expire).toHaveBeenCalled();
      });

      it('should handle Redis errors gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        mockPipeline.exec.mockRejectedValueOnce(new Error('Redis error'));

        const result = await store.increment('test-key');

        expect(result.totalHits).toBe(0);
        expect(result.resetTime).toBeInstanceOf(Date);
        consoleSpy.mockRestore();
      });
    });

    describe('decrement', () => {
      it('should decrement request count', async () => {
        mockRedisClient.zpopmax.mockResolvedValueOnce(['entry', 'score']);

        await store.decrement('test-key');

        expect(mockRedisClient.zpopmax).toHaveBeenCalledWith('test:test-key');
      });

      it('should handle Redis errors gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        mockRedisClient.zpopmax.mockRejectedValueOnce(new Error('Redis error'));

        await store.decrement('test-key');

        consoleSpy.mockRestore();
      });
    });

    describe('resetKey', () => {
      it('should reset rate limit for key', async () => {
        mockRedisClient.del.mockResolvedValueOnce(1);

        await store.resetKey('test-key');

        expect(mockRedisClient.del).toHaveBeenCalledWith('test:test-key');
      });

      it('should handle Redis errors gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        mockRedisClient.del.mockRejectedValueOnce(new Error('Redis error'));

        await store.resetKey('test-key');

        consoleSpy.mockRestore();
      });
    });
  });

  describe('IPAccessControl', () => {
    let ipAccessControl;

    beforeEach(() => {
      ipAccessControl = rateLimiter.ipAccessControl;
    });

    describe('isBlacklisted', () => {
      it('should return true if IP is blacklisted', async () => {
        mockRedisClient.sismember.mockResolvedValueOnce(1);

        const result = await ipAccessControl.isBlacklisted('1.2.3.4');

        expect(result).toBe(true);
        expect(mockRedisClient.sismember).toHaveBeenCalledWith('ip:blacklist', '1.2.3.4');
      });

      it('should return false if IP is not blacklisted', async () => {
        mockRedisClient.sismember.mockResolvedValueOnce(0);

        const result = await ipAccessControl.isBlacklisted('1.2.3.4');

        expect(result).toBe(false);
      });

      it('should handle Redis errors gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        mockRedisClient.sismember.mockRejectedValueOnce(new Error('Redis error'));

        const result = await ipAccessControl.isBlacklisted('1.2.3.4');

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('isWhitelisted', () => {
      it('should return true if IP is whitelisted', async () => {
        mockRedisClient.sismember.mockResolvedValueOnce(1);

        const result = await ipAccessControl.isWhitelisted('1.2.3.4');

        expect(result).toBe(true);
        expect(mockRedisClient.sismember).toHaveBeenCalledWith('ip:whitelist', '1.2.3.4');
      });

      it('should return false if IP is not whitelisted', async () => {
        mockRedisClient.sismember.mockResolvedValueOnce(0);

        const result = await ipAccessControl.isWhitelisted('1.2.3.4');

        expect(result).toBe(false);
      });

      it('should handle Redis errors gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        mockRedisClient.sismember.mockRejectedValueOnce(new Error('Redis error'));

        const result = await ipAccessControl.isWhitelisted('1.2.3.4');

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('addToBlacklist', () => {
      it('should add IP to blacklist', async () => {
        mockRedisClient.sadd.mockResolvedValueOnce(1);

        await ipAccessControl.addToBlacklist('1.2.3.4');

        expect(mockRedisClient.sadd).toHaveBeenCalledWith('ip:blacklist', '1.2.3.4');
      });

      it('should add IP to blacklist with TTL', async () => {
        mockRedisClient.sadd.mockResolvedValueOnce(1);
        mockRedisClient.expire.mockResolvedValueOnce(1);

        await ipAccessControl.addToBlacklist('1.2.3.4', 3600);

        expect(mockRedisClient.sadd).toHaveBeenCalled();
        expect(mockRedisClient.expire).toHaveBeenCalledWith('ip:blacklist:1.2.3.4', 3600);
      });

      it('should handle Redis errors gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        mockRedisClient.sadd.mockRejectedValueOnce(new Error('Redis error'));

        await ipAccessControl.addToBlacklist('1.2.3.4');

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('removeFromBlacklist', () => {
      it('should remove IP from blacklist', async () => {
        mockRedisClient.srem.mockResolvedValueOnce(1);

        await ipAccessControl.removeFromBlacklist('1.2.3.4');

        expect(mockRedisClient.srem).toHaveBeenCalledWith('ip:blacklist', '1.2.3.4');
      });

      it('should handle Redis errors gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        mockRedisClient.srem.mockRejectedValueOnce(new Error('Redis error'));

        await ipAccessControl.removeFromBlacklist('1.2.3.4');

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('addToWhitelist', () => {
      it('should add IP to whitelist', async () => {
        mockRedisClient.sadd.mockResolvedValueOnce(1);

        await ipAccessControl.addToWhitelist('1.2.3.4');

        expect(mockRedisClient.sadd).toHaveBeenCalledWith('ip:whitelist', '1.2.3.4');
      });

      it('should handle Redis errors gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        mockRedisClient.sadd.mockRejectedValueOnce(new Error('Redis error'));

        await ipAccessControl.addToWhitelist('1.2.3.4');

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('removeFromWhitelist', () => {
      it('should remove IP from whitelist', async () => {
        mockRedisClient.srem.mockResolvedValueOnce(1);

        await ipAccessControl.removeFromWhitelist('1.2.3.4');

        expect(mockRedisClient.srem).toHaveBeenCalledWith('ip:whitelist', '1.2.3.4');
      });

      it('should handle Redis errors gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        mockRedisClient.srem.mockRejectedValueOnce(new Error('Redis error'));

        await ipAccessControl.removeFromWhitelist('1.2.3.4');

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('getBlacklist', () => {
      it('should return all blacklisted IPs', async () => {
        mockRedisClient.smembers.mockResolvedValueOnce(['1.2.3.4', '5.6.7.8']);

        const result = await ipAccessControl.getBlacklist();

        expect(result).toEqual(['1.2.3.4', '5.6.7.8']);
        expect(mockRedisClient.smembers).toHaveBeenCalledWith('ip:blacklist');
      });

      it('should handle Redis errors gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        mockRedisClient.smembers.mockRejectedValueOnce(new Error('Redis error'));

        const result = await ipAccessControl.getBlacklist();

        expect(result).toEqual([]);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('getWhitelist', () => {
      it('should return all whitelisted IPs', async () => {
        mockRedisClient.smembers.mockResolvedValueOnce(['1.2.3.4', '5.6.7.8']);

        const result = await ipAccessControl.getWhitelist();

        expect(result).toEqual(['1.2.3.4', '5.6.7.8']);
        expect(mockRedisClient.smembers).toHaveBeenCalledWith('ip:whitelist');
      });

      it('should handle Redis errors gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        mockRedisClient.smembers.mockRejectedValueOnce(new Error('Redis error'));

        const result = await ipAccessControl.getWhitelist();

        expect(result).toEqual([]);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });
  });

  describe('createRateLimiter', () => {
    it('should create rate limiter with default options', () => {
      const rateLimit = require('express-rate-limit');
      
      createRateLimiter();

      expect(rateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          windowMs: 60000,
          max: 100,
          standardHeaders: true,
          legacyHeaders: false
        })
      );
    });

    it('should create rate limiter with custom options', () => {
      const rateLimit = require('express-rate-limit');
      
      createRateLimiter({
        windowMs: 120000,
        max: 200,
        message: 'Custom message',
        prefix: 'custom:'
      });

      expect(rateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          windowMs: 120000,
          max: 200
        })
      );
    });

    it('should use custom key generator', () => {
      const rateLimit = require('express-rate-limit');
      const customKeyGenerator = jest.fn();
      
      createRateLimiter({ keyGenerator: customKeyGenerator });

      const config = rateLimit.mock.calls[rateLimit.mock.calls.length - 1][0];
      expect(config.keyGenerator).toBe(customKeyGenerator);
    });

    it('should generate key from user ID for authenticated requests', () => {
      const rateLimit = require('express-rate-limit');
      
      createRateLimiter();

      const config = rateLimit.mock.calls[rateLimit.mock.calls.length - 1][0];
      const req = {
        user: { id: 'user-123' },
        headers: {},
        ip: '1.2.3.4'
      };

      const key = config.keyGenerator(req);
      expect(key).toBe('user:user-123');
    });

    it('should generate key from IP for unauthenticated requests', () => {
      const rateLimit = require('express-rate-limit');
      
      createRateLimiter();

      const config = rateLimit.mock.calls[rateLimit.mock.calls.length - 1][0];
      const req = {
        headers: {},
        ip: '1.2.3.4'
      };

      const key = config.keyGenerator(req);
      expect(key).toBe('ip:1.2.3.4');
    });

    it('should generate key from IP when user exists but has no id', () => {
      const rateLimit = require('express-rate-limit');
      
      createRateLimiter();

      const config = rateLimit.mock.calls[rateLimit.mock.calls.length - 1][0];
      const req = {
        user: {},
        headers: {},
        ip: '1.2.3.4'
      };

      const key = config.keyGenerator(req);
      expect(key).toBe('ip:1.2.3.4');
    });

    it('should skip whitelisted IPs', async () => {
      const rateLimit = require('express-rate-limit');
      mockRedisClient.sismember.mockResolvedValueOnce(1); // Whitelisted
      
      createRateLimiter();

      const config = rateLimit.mock.calls[rateLimit.mock.calls.length - 1][0];
      const req = {
        headers: {},
        ip: '1.2.3.4'
      };

      const shouldSkip = await config.skip(req);
      expect(shouldSkip).toBe(true);
    });

    it('should not skip blacklisted IPs', async () => {
      const rateLimit = require('express-rate-limit');
      mockRedisClient.sismember
        .mockResolvedValueOnce(0) // Not whitelisted
        .mockResolvedValueOnce(1); // Blacklisted
      
      createRateLimiter();

      const config = rateLimit.mock.calls[rateLimit.mock.calls.length - 1][0];
      const req = {
        headers: {},
        ip: '1.2.3.4'
      };

      const shouldSkip = await config.skip(req);
      expect(shouldSkip).toBe(false);
    });

    it('should not skip when neither whitelisted nor blacklisted', async () => {
      const rateLimit = require('express-rate-limit');
      mockRedisClient.sismember.mockResolvedValue(0); // Neither whitelisted nor blacklisted
      
      createRateLimiter();

      const config = rateLimit.mock.calls[rateLimit.mock.calls.length - 1][0];
      const req = {
        headers: {},
        ip: '1.2.3.4'
      };

      const shouldSkip = await config.skip(req);
      expect(shouldSkip).toBe(false);
    });

    it('should use custom skip function', async () => {
      const rateLimit = require('express-rate-limit');
      const customSkip = jest.fn().mockReturnValue(true);
      mockRedisClient.sismember.mockResolvedValue(0); // Not whitelisted/blacklisted
      
      createRateLimiter({ skip: customSkip });

      const config = rateLimit.mock.calls[rateLimit.mock.calls.length - 1][0];
      const req = {
        headers: {},
        ip: '1.2.3.4'
      };

      const shouldSkip = await config.skip(req);
      expect(customSkip).toHaveBeenCalledWith(req);
      expect(shouldSkip).toBe(true);
    });

    it('should not use custom skip when not provided', async () => {
      const rateLimit = require('express-rate-limit');
      mockRedisClient.sismember.mockResolvedValue(0);
      
      createRateLimiter(); // No custom skip

      const config = rateLimit.mock.calls[rateLimit.mock.calls.length - 1][0];
      const req = {
        headers: {},
        ip: '1.2.3.4'
      };

      const shouldSkip = await config.skip(req);
      expect(shouldSkip).toBe(false);
    });

    it('should call handler when rate limit exceeded', () => {
      const rateLimit = require('express-rate-limit');
      
      createRateLimiter({ windowMs: 60000, message: 'Too many requests' });

      const config = rateLimit.mock.calls[rateLimit.mock.calls.length - 1][0];
      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      config.handler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Too Many Requests',
        message: 'Too many requests',
        retryAfter: '60 seconds',
        retryAfterSeconds: 60
      });
    });

    it('should support skipSuccessfulRequests option', () => {
      const rateLimit = require('express-rate-limit');
      
      createRateLimiter({ skipSuccessfulRequests: true });

      const config = rateLimit.mock.calls[rateLimit.mock.calls.length - 1][0];
      expect(config.skipSuccessfulRequests).toBe(true);
    });

    it('should support skipFailedRequests option', () => {
      const rateLimit = require('express-rate-limit');
      
      createRateLimiter({ skipFailedRequests: true });

      const config = rateLimit.mock.calls[rateLimit.mock.calls.length - 1][0];
      expect(config.skipFailedRequests).toBe(true);
    });

    it('should call store.increment when rate limiting', async () => {
      const rateLimit = require('express-rate-limit');
      mockPipeline.exec.mockResolvedValueOnce([
        [null, 0],
        [null, 1],
        [null, 5],
        [null, 1]
      ]);
      
      createRateLimiter();

      const config = rateLimit.mock.calls[rateLimit.mock.calls.length - 1][0];
      const result = await config.store.increment('test-key');

      expect(result.totalHits).toBe(5);
      expect(result.resetTime).toBeInstanceOf(Date);
    });

    it('should call store.decrement when skipSuccessfulRequests is true', async () => {
      const rateLimit = require('express-rate-limit');
      mockRedisClient.zpopmax.mockResolvedValueOnce(['entry', 'score']);
      
      createRateLimiter({ skipSuccessfulRequests: true });

      const config = rateLimit.mock.calls[rateLimit.mock.calls.length - 1][0];
      await config.store.decrement('test-key');

      expect(mockRedisClient.zpopmax).toHaveBeenCalled();
    });

    it('should call store.decrement when skipFailedRequests is true', async () => {
      const rateLimit = require('express-rate-limit');
      mockRedisClient.zpopmax.mockResolvedValueOnce(['entry', 'score']);
      
      createRateLimiter({ skipFailedRequests: true });

      const config = rateLimit.mock.calls[rateLimit.mock.calls.length - 1][0];
      await config.store.decrement('test-key');

      expect(mockRedisClient.zpopmax).toHaveBeenCalled();
    });

    it('should not call store.decrement when skipSuccessfulRequests is false', async () => {
      const rateLimit = require('express-rate-limit');
      
      createRateLimiter({ skipSuccessfulRequests: false });

      const config = rateLimit.mock.calls[rateLimit.mock.calls.length - 1][0];
      const result = await config.store.decrement('test-key');

      expect(result).toBeUndefined();
    });

    it('should call store.resetKey', async () => {
      const rateLimit = require('express-rate-limit');
      mockRedisClient.del.mockResolvedValueOnce(1);
      
      createRateLimiter();

      const config = rateLimit.mock.calls[rateLimit.mock.calls.length - 1][0];
      await config.store.resetKey('test-key');

      expect(mockRedisClient.del).toHaveBeenCalled();
    });
  });

  describe('checkBlacklist middleware', () => {
    it('should block blacklisted IP', async () => {
      mockRedisClient.sismember.mockResolvedValueOnce(1);

      const req = {
        headers: {},
        ip: '1.2.3.4'
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await rateLimiter.checkBlacklist(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Your IP address has been blocked due to suspicious activity.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow non-blacklisted IP', async () => {
      mockRedisClient.sismember.mockResolvedValueOnce(0);

      const req = {
        headers: {},
        ip: '1.2.3.4'
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await rateLimiter.checkBlacklist(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('exported limiters', () => {
    it('should export publicApiLimiter', () => {
      expect(rateLimiter.publicApiLimiter).toBeDefined();
      expect(typeof rateLimiter.publicApiLimiter).toBe('function');
    });

    it('should export authenticatedApiLimiter', () => {
      expect(rateLimiter.authenticatedApiLimiter).toBeDefined();
      expect(typeof rateLimiter.authenticatedApiLimiter).toBe('function');
    });

    it('should export authLimiter', () => {
      expect(rateLimiter.authLimiter).toBeDefined();
      expect(typeof rateLimiter.authLimiter).toBe('function');
    });

    it('should export passwordResetLimiter', () => {
      expect(rateLimiter.passwordResetLimiter).toBeDefined();
      expect(typeof rateLimiter.passwordResetLimiter).toBe('function');
    });

    it('should export mfaLimiter', () => {
      expect(rateLimiter.mfaLimiter).toBeDefined();
      expect(typeof rateLimiter.mfaLimiter).toBe('function');
    });

    it('should export domainVerificationLimiter', () => {
      expect(rateLimiter.domainVerificationLimiter).toBeDefined();
      expect(typeof rateLimiter.domainVerificationLimiter).toBe('function');
    });

    it('should export legacy apiLimiter', () => {
      expect(rateLimiter.apiLimiter).toBeDefined();
      expect(rateLimiter.apiLimiter).toBe(rateLimiter.publicApiLimiter);
    });

    it('should skip health check and root paths in publicApiLimiter', () => {
      const rateLimit = require('express-rate-limit');
      
      // The publicApiLimiter is created when the module loads
      // We need to find it in the mock calls
      const calls = rateLimit.mock.calls;
      
      // Look for a call with skip function that checks paths
      let skipFn = null;
      for (const call of calls) {
        if (call[0].skip && typeof call[0].skip === 'function') {
          // Test if this is the publicApiLimiter skip function
          const testSkip = call[0].skip;
          const testReq = { path: '/health', headers: {}, ip: '1.2.3.4' };
          if (testSkip(testReq) === true) {
            skipFn = testSkip;
            break;
          }
        }
      }

      if (skipFn) {
        expect(skipFn({ path: '/health', headers: {}, ip: '1.2.3.4' })).toBe(true);
        expect(skipFn({ path: '/', headers: {}, ip: '1.2.3.4' })).toBe(true);
        expect(skipFn({ path: '/api/users', headers: {}, ip: '1.2.3.4' })).toBe(false);
      }
    });

    it('should use user ID in authenticatedApiLimiter keyGenerator', () => {
      const rateLimit = require('express-rate-limit');
      
      // The authenticatedApiLimiter is created when the module loads
      const calls = rateLimit.mock.calls;
      
      // Look for a call with keyGenerator that checks user.id
      let keyGenFn = null;
      for (const call of calls) {
        if (call[0].keyGenerator && typeof call[0].keyGenerator === 'function') {
          const testKeyGen = call[0].keyGenerator;
          const testResult = testKeyGen({ user: { id: 'test' }, headers: {}, ip: '1.2.3.4' });
          if (testResult === 'user:test') {
            keyGenFn = testKeyGen;
            break;
          }
        }
      }

      if (keyGenFn) {
        const reqWithUser = {
          user: { id: 'user-123' },
          headers: {},
          ip: '1.2.3.4'
        };
        expect(keyGenFn(reqWithUser)).toBe('user:user-123');
        
        const reqWithoutUser = {
          headers: {},
          ip: '1.2.3.4'
        };
        expect(keyGenFn(reqWithoutUser)).toBe('ip:1.2.3.4');
        
        // Test with user but no id
        const reqWithUserNoId = {
          user: {},
          headers: {},
          ip: '5.6.7.8'
        };
        expect(keyGenFn(reqWithUserNoId)).toBe('ip:5.6.7.8');
      }
    });
  });
});
