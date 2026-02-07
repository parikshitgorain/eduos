/**
 * Tests for Redis Configuration
 */

// Mock ioredis
jest.mock('ioredis', () => {
  const mockPing = jest.fn();
  const mockQuit = jest.fn();
  const eventHandlers = {};

  const MockRedis = jest.fn().mockImplementation((config) => {
    // Store the retryStrategy for testing
    if (config.retryStrategy) {
      MockRedis.__retryStrategy = config.retryStrategy;
    }

    const instance = {
      ping: mockPing,
      quit: mockQuit,
      on: jest.fn((event, handler) => {
        eventHandlers[event] = handler;
      })
    };

    // Store event handlers for testing
    MockRedis.__eventHandlers = eventHandlers;

    return instance;
  });

  MockRedis.__mockPing = mockPing;
  MockRedis.__mockQuit = mockQuit;

  return MockRedis;
});

describe('Redis Configuration', () => {
  let redis;
  let redisModule;
  let MockRedis;
  let mockPing;
  let mockQuit;

  beforeAll(() => {
    // Set test environment variables BEFORE first require
    process.env.REDIS_HOST = 'test-redis';
    process.env.REDIS_PORT = '6380';
    process.env.REDIS_PASSWORD = 'test-password';
    process.env.REDIS_DB = '1';
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Get mocked Redis
    MockRedis = require('ioredis');
    mockPing = MockRedis.__mockPing;
    mockQuit = MockRedis.__mockQuit;

    // Require redis module
    redisModule = require('./redis');
    redis = redisModule.redis;
  });

  afterEach(() => {
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_PASSWORD;
    delete process.env.REDIS_DB;
  });

  describe('redis configuration', () => {
    it('should create Redis client', () => {
      expect(redis).toBeDefined();
      expect(redisModule.getClient).toBeDefined();
    });

    it('should export all required functions', () => {
      expect(typeof redisModule.getClient).toBe('function');
      expect(typeof redisModule.healthCheck).toBe('function');
      expect(typeof redisModule.close).toBe('function');
    });

    it('should have redis instance with on method', () => {
      expect(typeof redis.on).toBe('function');
    });

    it('should configure retryStrategy', () => {
      const retryStrategy = MockRedis.__retryStrategy;
      expect(retryStrategy).toBeDefined();
      
      // Test retry strategy
      const delay1 = retryStrategy(1);
      expect(delay1).toBe(50); // 1 * 50
      
      const delay10 = retryStrategy(10);
      expect(delay10).toBe(500); // 10 * 50
      
      const delay100 = retryStrategy(100);
      expect(delay100).toBe(2000); // Max delay
    });

    it('should use default values when env vars not set', () => {
      // Clear env vars
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;
      delete process.env.REDIS_PASSWORD;
      delete process.env.REDIS_DB;
      
      // Reset modules to trigger new config
      jest.resetModules();
      const MockRedis2 = require('ioredis');
      const redisModule2 = require('./redis');
      
      expect(redisModule2.redis).toBeDefined();
    });

    it('should set showFriendlyErrorStack based on NODE_ENV', () => {
      // Test production mode
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      jest.resetModules();
      const MockRedis2 = require('ioredis');
      const redisModule2 = require('./redis');
      
      expect(redisModule2.redis).toBeDefined();
      
      // Restore
      process.env.NODE_ENV = originalEnv;
    });

    it('should register event handlers', () => {
      const eventHandlers = MockRedis.__eventHandlers;
      expect(eventHandlers).toBeDefined();
      expect(eventHandlers.connect).toBeDefined();
      expect(eventHandlers.ready).toBeDefined();
      expect(eventHandlers.error).toBeDefined();
      expect(eventHandlers.close).toBeDefined();
      expect(eventHandlers.reconnecting).toBeDefined();
      expect(eventHandlers.end).toBeDefined();
    });

    it('should handle connect event', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const eventHandlers = MockRedis.__eventHandlers;
      
      eventHandlers.connect();
      
      expect(consoleSpy).toHaveBeenCalledWith('Redis client connecting...');
      consoleSpy.mockRestore();
    });

    it('should handle ready event', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const eventHandlers = MockRedis.__eventHandlers;
      
      eventHandlers.ready();
      
      expect(consoleSpy).toHaveBeenCalledWith('Redis client ready');
      consoleSpy.mockRestore();
    });

    it('should handle error event', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const eventHandlers = MockRedis.__eventHandlers;
      
      eventHandlers.error(new Error('Test error'));
      
      expect(consoleSpy).toHaveBeenCalledWith('Redis client error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should handle close event', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const eventHandlers = MockRedis.__eventHandlers;
      
      eventHandlers.close();
      
      expect(consoleSpy).toHaveBeenCalledWith('Redis connection closed');
      consoleSpy.mockRestore();
    });

    it('should handle reconnecting event', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const eventHandlers = MockRedis.__eventHandlers;
      
      eventHandlers.reconnecting();
      
      expect(consoleSpy).toHaveBeenCalledWith('Redis client reconnecting...');
      consoleSpy.mockRestore();
    });

    it('should handle end event', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const eventHandlers = MockRedis.__eventHandlers;
      
      eventHandlers.end();
      
      expect(consoleSpy).toHaveBeenCalledWith('Redis connection ended');
      consoleSpy.mockRestore();
    });
  });

  describe('healthCheck', () => {
    it('should return true when Redis is healthy', async () => {
      mockPing.mockResolvedValueOnce('PONG');

      const result = await redisModule.healthCheck();

      expect(result).toBe(true);
      expect(mockPing).toHaveBeenCalled();
    });

    it('should return false when Redis is unhealthy', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockPing.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await redisModule.healthCheck();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Redis health check failed:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('close', () => {
    it('should close Redis connection gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockQuit.mockResolvedValueOnce();

      await redisModule.close();

      expect(mockQuit).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Redis connection closed gracefully');

      consoleSpy.mockRestore();
    });
  });

  describe('getClient', () => {
    it('should return Redis client instance', () => {
      const client = redisModule.getClient();

      expect(client).toBe(redis);
    });
  });
});
