/**
 * Redis Configuration Tests
 * 
 * Task: 1.2.3 - Create tenant routing cache layer
 * 
 * Comprehensive test coverage for Redis configuration and connection management
 */

// Mock ioredis before requiring the module
const mockRedis = {
  on: jest.fn(),
  ping: jest.fn(),
  quit: jest.fn(),
  disconnect: jest.fn()
};

jest.mock('ioredis', () => {
  return jest.fn(() => mockRedis);
});

describe('Redis Configuration', () => {
  let redisModule;
  let Redis;

  beforeEach(() => {
    // Clear module cache
    jest.resetModules();
    jest.clearAllMocks();
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    
    // Get the mocked Redis constructor
    Redis = require('ioredis');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Module Loading and Configuration', () => {
    it('should load redis configuration module with all exports', () => {
      redisModule = require('./redis');
      
      expect(redisModule).toHaveProperty('redis');
      expect(redisModule).toHaveProperty('getClient');
      expect(redisModule).toHaveProperty('healthCheck');
      expect(redisModule).toHaveProperty('close');
      
      expect(typeof redisModule.getClient).toBe('function');
      expect(typeof redisModule.healthCheck).toBe('function');
      expect(typeof redisModule.close).toBe('function');
    });

    it('should create Redis instance with default configuration', () => {
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;
      delete process.env.REDIS_PASSWORD;
      delete process.env.REDIS_DB;
      
      redisModule = require('./redis');
      
      expect(Redis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: undefined,
        db: 0,
        retryStrategy: expect.any(Function),
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        enableOfflineQueue: true,
        connectTimeout: 10000,
        commandTimeout: 5000,
        lazyConnect: false,
        showFriendlyErrorStack: true
      });
    });

    it('should create Redis instance with custom environment variables', () => {
      process.env.REDIS_HOST = 'custom-host';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_PASSWORD = 'custom-password';
      process.env.REDIS_DB = '2';
      
      redisModule = require('./redis');
      
      expect(Redis).toHaveBeenCalledWith({
        host: 'custom-host',
        port: 6380,
        password: 'custom-password',
        db: 2,
        retryStrategy: expect.any(Function),
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        enableOfflineQueue: true,
        connectTimeout: 10000,
        commandTimeout: 5000,
        lazyConnect: false,
        showFriendlyErrorStack: true
      });
      
      // Clean up
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;
      delete process.env.REDIS_PASSWORD;
      delete process.env.REDIS_DB;
    });

    it('should handle invalid port numbers gracefully', () => {
      process.env.REDIS_PORT = 'invalid-port';
      
      redisModule = require('./redis');
      
      expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
        port: NaN // parseInt('invalid-port') returns NaN
      }));
      
      delete process.env.REDIS_PORT;
    });

    it('should handle invalid database numbers gracefully', () => {
      process.env.REDIS_DB = 'invalid-db';
      
      redisModule = require('./redis');
      
      expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
        db: NaN // parseInt('invalid-db') returns NaN
      }));
      
      delete process.env.REDIS_DB;
    });

    it('should disable friendly error stack in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      redisModule = require('./redis');
      
      expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
        showFriendlyErrorStack: false
      }));
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Retry Strategy', () => {
    it('should implement exponential backoff with maximum delay', () => {
      redisModule = require('./redis');
      
      // Get the retry strategy function from the Redis constructor call
      const redisConfig = Redis.mock.calls[0][0];
      const retryStrategy = redisConfig.retryStrategy;
      
      // Test exponential backoff
      expect(retryStrategy(1)).toBe(50);   // 1 * 50 = 50
      expect(retryStrategy(5)).toBe(250);  // 5 * 50 = 250
      expect(retryStrategy(10)).toBe(500); // 10 * 50 = 500
      expect(retryStrategy(20)).toBe(1000); // 20 * 50 = 1000
      expect(retryStrategy(40)).toBe(2000); // 40 * 50 = 2000 (max)
      expect(retryStrategy(50)).toBe(2000); // Still max
      expect(retryStrategy(100)).toBe(2000); // Still max
    });

    it('should handle edge cases in retry strategy', () => {
      redisModule = require('./redis');
      
      const redisConfig = Redis.mock.calls[0][0];
      const retryStrategy = redisConfig.retryStrategy;
      
      // Test edge cases
      expect(retryStrategy(0)).toBe(0);
      expect(retryStrategy(-1)).toBe(-50); // Negative input
      expect(retryStrategy(39)).toBe(1950); // Just under max
      expect(retryStrategy(41)).toBe(2000); // Just over max threshold
    });
  });

  describe('Connection Event Handlers', () => {
    it('should register all required event handlers', () => {
      redisModule = require('./redis');
      
      expect(mockRedis.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('end', expect.any(Function));
      
      expect(mockRedis.on).toHaveBeenCalledTimes(6);
    });

    it('should handle connect event', () => {
      redisModule = require('./redis');
      
      // Find and call the connect event handler
      const connectHandler = mockRedis.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();
      
      expect(console.log).toHaveBeenCalledWith('Redis client connecting...');
    });

    it('should handle ready event', () => {
      redisModule = require('./redis');
      
      // Find and call the ready event handler
      const readyHandler = mockRedis.on.mock.calls.find(call => call[0] === 'ready')[1];
      readyHandler();
      
      expect(console.log).toHaveBeenCalledWith('Redis client ready');
    });

    it('should handle error event', () => {
      redisModule = require('./redis');
      
      // Find and call the error event handler
      const errorHandler = mockRedis.on.mock.calls.find(call => call[0] === 'error')[1];
      const testError = new Error('Test error');
      errorHandler(testError);
      
      expect(console.error).toHaveBeenCalledWith('Redis client error:', testError);
    });

    it('should handle close event', () => {
      redisModule = require('./redis');
      
      // Find and call the close event handler
      const closeHandler = mockRedis.on.mock.calls.find(call => call[0] === 'close')[1];
      closeHandler();
      
      expect(console.log).toHaveBeenCalledWith('Redis connection closed');
    });

    it('should handle reconnecting event', () => {
      redisModule = require('./redis');
      
      // Find and call the reconnecting event handler
      const reconnectingHandler = mockRedis.on.mock.calls.find(call => call[0] === 'reconnecting')[1];
      reconnectingHandler();
      
      expect(console.log).toHaveBeenCalledWith('Redis client reconnecting...');
    });

    it('should handle end event', () => {
      redisModule = require('./redis');
      
      // Find and call the end event handler
      const endHandler = mockRedis.on.mock.calls.find(call => call[0] === 'end')[1];
      endHandler();
      
      expect(console.log).toHaveBeenCalledWith('Redis connection ended');
    });
  });

  describe('getClient', () => {
    it('should return the redis client instance', () => {
      redisModule = require('./redis');
      
      const client = redisModule.getClient();
      expect(client).toBe(redisModule.redis);
      expect(client).toBe(mockRedis);
    });

    it('should return the same instance on multiple calls', () => {
      redisModule = require('./redis');
      
      const client1 = redisModule.getClient();
      const client2 = redisModule.getClient();
      
      expect(client1).toBe(client2);
      expect(client1).toBe(mockRedis);
    });
  });

  describe('healthCheck', () => {
    beforeEach(() => {
      redisModule = require('./redis');
    });

    it('should return true for successful ping with PONG response', async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      
      const result = await redisModule.healthCheck();
      
      expect(result).toBe(true);
      expect(mockRedis.ping).toHaveBeenCalledTimes(1);
    });

    it('should return false for unexpected ping response', async () => {
      mockRedis.ping.mockResolvedValue('UNEXPECTED');
      
      const result = await redisModule.healthCheck();
      
      expect(result).toBe(false);
    });

    it('should return false and log error for connection failures', async () => {
      const connectionError = new Error('ECONNREFUSED');
      mockRedis.ping.mockRejectedValue(connectionError);
      
      const result = await redisModule.healthCheck();
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('Redis health check failed:', connectionError);
    });

    it('should return false for authentication errors', async () => {
      const authError = new Error('NOAUTH Authentication required');
      mockRedis.ping.mockRejectedValue(authError);
      
      const result = await redisModule.healthCheck();
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('Redis health check failed:', authError);
    });

    it('should return false for timeout errors', async () => {
      const timeoutError = new Error('Connection timeout');
      mockRedis.ping.mockRejectedValue(timeoutError);
      
      const result = await redisModule.healthCheck();
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('Redis health check failed:', timeoutError);
    });

    it('should handle concurrent health check calls', async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      
      // Make multiple concurrent calls
      const promises = Array(5).fill().map(() => redisModule.healthCheck());
      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach(result => expect(result).toBe(true));
      expect(mockRedis.ping).toHaveBeenCalledTimes(5);
    });

    it('should handle mixed success/failure in concurrent calls', async () => {
      let callCount = 0;
      mockRedis.ping.mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.reject(new Error('Connection failed'));
        }
        return Promise.resolve('PONG');
      });
      
      const promises = Array(4).fill().map(() => redisModule.healthCheck());
      const results = await Promise.all(promises);
      
      expect(results).toEqual([true, false, true, false]);
    });
  });

  describe('close', () => {
    beforeEach(() => {
      redisModule = require('./redis');
    });

    it('should close connection gracefully with successful quit', async () => {
      mockRedis.quit.mockResolvedValue('OK');
      
      await redisModule.close();
      
      expect(mockRedis.quit).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith('Redis connection closed gracefully');
    });

    it('should handle quit errors by throwing', async () => {
      const quitError = new Error('Quit failed');
      mockRedis.quit.mockRejectedValue(quitError);
      
      await expect(redisModule.close()).rejects.toThrow('Quit failed');
      expect(mockRedis.quit).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent close calls', async () => {
      mockRedis.quit.mockResolvedValue('OK');
      
      // Make multiple concurrent calls
      const promises = Array(3).fill().map(() => redisModule.close());
      await Promise.all(promises);
      
      expect(mockRedis.quit).toHaveBeenCalledTimes(3);
    });

    it('should handle quit with different response values', async () => {
      mockRedis.quit.mockResolvedValue(1); // Redis can return 1 for quit
      
      await redisModule.close();
      
      expect(mockRedis.quit).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith('Redis connection closed gracefully');
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    beforeEach(() => {
      redisModule = require('./redis');
    });

    it('should handle null/undefined responses in healthCheck', async () => {
      mockRedis.ping.mockResolvedValue(null);
      
      const result = await redisModule.healthCheck();
      expect(result).toBe(false);
    });

    it('should handle empty string response in healthCheck', async () => {
      mockRedis.ping.mockResolvedValue('');
      
      const result = await redisModule.healthCheck();
      expect(result).toBe(false);
    });

    it('should handle numeric response in healthCheck', async () => {
      mockRedis.ping.mockResolvedValue(1);
      
      const result = await redisModule.healthCheck();
      expect(result).toBe(false);
    });

    it('should handle case-sensitive PONG response', async () => {
      mockRedis.ping.mockResolvedValue('pong'); // lowercase
      
      const result = await redisModule.healthCheck();
      expect(result).toBe(false);
    });

    it('should handle PONG with extra whitespace', async () => {
      mockRedis.ping.mockResolvedValue(' PONG ');
      
      const result = await redisModule.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(() => {
      redisModule = require('./redis');
    });

    it('should handle healthCheck after close', async () => {
      mockRedis.quit.mockResolvedValue('OK');
      mockRedis.ping.mockRejectedValue(new Error('Connection closed'));
      
      await redisModule.close();
      const result = await redisModule.healthCheck();
      
      expect(result).toBe(false);
    });

    it('should handle multiple close calls without errors', async () => {
      mockRedis.quit.mockResolvedValue('OK');
      
      await redisModule.close();
      await redisModule.close();
      await redisModule.close();
      
      expect(mockRedis.quit).toHaveBeenCalledTimes(3);
    });

    it('should maintain client reference after operations', async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      mockRedis.quit.mockResolvedValue('OK');
      
      const client1 = redisModule.getClient();
      await redisModule.healthCheck();
      const client2 = redisModule.getClient();
      await redisModule.close();
      const client3 = redisModule.getClient();
      
      expect(client1).toBe(client2);
      expect(client2).toBe(client3);
      expect(client1).toBe(mockRedis);
    });
  });
});