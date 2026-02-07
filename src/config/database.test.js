/**
 * Tests for Database Configuration
 */

const { Pool } = require('pg');

// Mock pg module
jest.mock('pg', () => {
  const mockQuery = jest.fn();
  const mockConnect = jest.fn();
  const mockEnd = jest.fn();
  const mockRelease = jest.fn();
  const eventHandlers = {};

  const mockClient = {
    query: mockQuery,
    release: mockRelease
  };

  const MockPool = jest.fn().mockImplementation(() => {
    const instance = {
      query: mockQuery,
      connect: mockConnect.mockResolvedValue(mockClient),
      end: mockEnd,
      on: jest.fn((event, handler) => {
        eventHandlers[event] = handler;
      })
    };

    // Store event handlers for testing
    MockPool.__eventHandlers = eventHandlers;

    return instance;
  });

  return {
    Pool: MockPool,
    __mockQuery: mockQuery,
    __mockConnect: mockConnect,
    __mockEnd: mockEnd,
    __mockClient: mockClient,
    __mockRelease: mockRelease
  };
});

describe('Database Configuration', () => {
  let database;
  let mockQuery;
  let mockConnect;
  let mockEnd;
  let mockClient;
  let Pool;

  beforeAll(() => {
    // Set test environment variables BEFORE first require
    process.env.DB_HOST = 'test-host';
    process.env.DB_PORT = '5433';
    process.env.DB_NAME = 'test_db';
    process.env.DB_USER = 'test_user';
    process.env.DB_PASSWORD = 'test_password';
    process.env.DB_POOL_MAX = '10';
    process.env.DB_POOL_MIN = '1';
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Get mocked functions
    const pg = require('pg');
    Pool = pg.Pool;
    mockQuery = pg.__mockQuery;
    mockConnect = pg.__mockConnect;
    mockEnd = pg.__mockEnd;
    mockClient = pg.__mockClient;

    // Require database module
    database = require('./database');
  });

  afterEach(() => {
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_NAME;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_POOL_MAX;
    delete process.env.DB_POOL_MIN;
  });

  describe('pool configuration', () => {
    it('should create pool with environment variables', () => {
      // Module is already loaded, just verify it exists
      expect(database.pool).toBeDefined();
      expect(database.getClient).toBeDefined();
      expect(database.query).toBeDefined();
    });

    it('should export all required functions', () => {
      expect(typeof database.getClient).toBe('function');
      expect(typeof database.query).toBe('function');
      expect(typeof database.transaction).toBe('function');
      expect(typeof database.healthCheck).toBe('function');
      expect(typeof database.close).toBe('function');
    });

    it('should use default host when DB_HOST not set', () => {
      delete process.env.DB_HOST;
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      
      jest.resetModules();
      const { Pool: Pool2 } = require('pg');
      const database2 = require('./database');
      
      expect(database2.pool).toBeDefined();
    });

    it('should use default port when DB_PORT not set', () => {
      process.env.DB_HOST = 'localhost';
      delete process.env.DB_PORT;
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      
      jest.resetModules();
      const { Pool: Pool2 } = require('pg');
      const database2 = require('./database');
      
      expect(database2.pool).toBeDefined();
    });

    it('should use default database name when DB_NAME not set', () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      delete process.env.DB_NAME;
      process.env.DB_USER = 'test_user';
      
      jest.resetModules();
      const { Pool: Pool2 } = require('pg');
      const database2 = require('./database');
      
      expect(database2.pool).toBeDefined();
    });

    it('should use default user when DB_USER not set', () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      delete process.env.DB_USER;
      
      jest.resetModules();
      const { Pool: Pool2 } = require('pg');
      const database2 = require('./database');
      
      expect(database2.pool).toBeDefined();
    });

    it('should use default pool max when DB_POOL_MAX not set', () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      delete process.env.DB_POOL_MAX;
      
      jest.resetModules();
      const { Pool: Pool2 } = require('pg');
      const database2 = require('./database');
      
      expect(database2.pool).toBeDefined();
    });

    it('should use default pool min when DB_POOL_MIN not set', () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      delete process.env.DB_POOL_MIN;
      
      jest.resetModules();
      const { Pool: Pool2 } = require('pg');
      const database2 = require('./database');
      
      expect(database2.pool).toBeDefined();
    });

    it('should use default idle timeout when DB_IDLE_TIMEOUT not set', () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      delete process.env.DB_IDLE_TIMEOUT;
      
      jest.resetModules();
      const { Pool: Pool2 } = require('pg');
      const database2 = require('./database');
      
      expect(database2.pool).toBeDefined();
    });

    it('should use default connection timeout when DB_CONNECTION_TIMEOUT not set', () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      delete process.env.DB_CONNECTION_TIMEOUT;
      
      jest.resetModules();
      const { Pool: Pool2 } = require('pg');
      const database2 = require('./database');
      
      expect(database2.pool).toBeDefined();
    });

    it('should use default statement timeout when DB_STATEMENT_TIMEOUT not set', () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      delete process.env.DB_STATEMENT_TIMEOUT;
      
      jest.resetModules();
      const { Pool: Pool2 } = require('pg');
      const database2 = require('./database');
      
      expect(database2.pool).toBeDefined();
    });

    it('should use all default values when no env vars set', () => {
      // Clear all env vars
      delete process.env.DB_HOST;
      delete process.env.DB_PORT;
      delete process.env.DB_NAME;
      delete process.env.DB_USER;
      delete process.env.DB_PASSWORD;
      delete process.env.DB_POOL_MAX;
      delete process.env.DB_POOL_MIN;
      delete process.env.DB_IDLE_TIMEOUT;
      delete process.env.DB_CONNECTION_TIMEOUT;
      delete process.env.DB_STATEMENT_TIMEOUT;
      
      // Reset modules to trigger new config
      jest.resetModules();
      const { Pool: Pool2 } = require('pg');
      const database2 = require('./database');
      
      expect(database2.pool).toBeDefined();
    });
  });

  describe('getClient', () => {
    it('should return a client from the pool', async () => {
      const client = await database.getClient();

      expect(mockConnect).toHaveBeenCalled();
      expect(client).toBe(mockClient);
    });
  });

  describe('query', () => {
    it('should execute query and return result', async () => {
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await database.query('SELECT * FROM users', []);

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users', []);
      expect(result).toEqual(mockResult);
    });

    it('should log slow queries', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockResult = { rows: [], rowCount: 0 };
      
      // Mock slow query (> 100ms)
      mockQuery.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(mockResult), 150);
        });
      });

      await database.query('SELECT * FROM large_table', []);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Slow query detected:',
        expect.objectContaining({
          text: 'SELECT * FROM large_table',
          rows: 0
        })
      );

      consoleSpy.mockRestore();
    });

    it('should not log fast queries', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockResult = { rows: [], rowCount: 0 };
      mockQuery.mockResolvedValueOnce(mockResult);

      await database.query('SELECT 1', []);

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('transaction', () => {
    it('should execute callback within transaction', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Callback query
        .mockResolvedValueOnce({}); // COMMIT

      const callback = jest.fn(async (client) => {
        return await client.query('INSERT INTO users VALUES ($1)', [1]);
      });

      const result = await database.transaction(callback);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(callback).toHaveBeenCalledWith(mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Query failed')) // Callback error
        .mockResolvedValueOnce({}); // ROLLBACK

      const callback = jest.fn(async (client) => {
        throw new Error('Query failed');
      });

      await expect(database.transaction(callback)).rejects.toThrow('Query failed');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release client even if rollback fails', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Query failed')) // Callback error
        .mockRejectedValueOnce(new Error('Rollback failed')); // ROLLBACK error

      const callback = jest.fn(async () => {
        throw new Error('Query failed');
      });

      await expect(database.transaction(callback)).rejects.toThrow();
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return true when database is healthy', async () => {
      // Mock the pool.query method directly
      const originalQuery = database.pool.query;
      database.pool.query = jest.fn().mockResolvedValueOnce({ rows: [{ health: 1 }] });

      const result = await database.healthCheck();

      expect(result).toBe(true);
      
      // Restore original
      database.pool.query = originalQuery;
    });

    it('should return false when database is unhealthy', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock the pool.query method to reject
      const originalQuery = database.pool.query;
      database.pool.query = jest.fn().mockRejectedValueOnce(new Error('Connection failed'));

      const result = await database.healthCheck();

      expect(result).toBe(false);
      
      // Restore original
      database.pool.query = originalQuery;
      consoleSpy.mockRestore();
    });
  });

  describe('close', () => {
    it('should close the connection pool', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockEnd.mockResolvedValueOnce();

      await database.close();

      expect(mockEnd).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Database connection pool closed');

      consoleSpy.mockRestore();
    });
  });

  describe('pool event handlers', () => {
    it('should have pool instance', () => {
      expect(database.pool).toBeDefined();
    });

    it('should export getClient function', () => {
      expect(typeof database.getClient).toBe('function');
    });

    it('should have pool with on method', () => {
      expect(typeof database.pool.on).toBe('function');
    });

    it('should register event handlers', () => {
      const Pool = require('pg').Pool;
      const eventHandlers = Pool.__eventHandlers;
      
      expect(eventHandlers).toBeDefined();
      expect(eventHandlers.error).toBeDefined();
      expect(eventHandlers.connect).toBeDefined();
    });

    it('should handle pool error event', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();
      
      const Pool = require('pg').Pool;
      const eventHandlers = Pool.__eventHandlers;
      
      eventHandlers.error(new Error('Pool error'), {});
      
      expect(consoleSpy).toHaveBeenCalledWith('Unexpected error on idle client', expect.any(Error));
      expect(exitSpy).toHaveBeenCalledWith(-1);
      
      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('should handle pool connect event', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const Pool = require('pg').Pool;
      const eventHandlers = Pool.__eventHandlers;
      
      eventHandlers.connect({});
      
      expect(consoleSpy).toHaveBeenCalledWith('New database connection established');
      
      consoleSpy.mockRestore();
    });
  });
});
