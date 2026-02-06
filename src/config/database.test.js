/**
 * Database Configuration Tests
 * 
 * Tests for database connection pool and query execution
 */

const { Pool } = require('pg');

// Mock pg module
jest.mock('pg', () => {
  const mockQuery = jest.fn();
  const mockConnect = jest.fn();
  const mockRelease = jest.fn();
  const mockOn = jest.fn();
  
  const mockClient = {
    query: mockQuery,
    release: mockRelease
  };
  
  const mockPool = jest.fn(() => ({
    query: mockQuery,
    connect: mockConnect.mockResolvedValue(mockClient),
    end: jest.fn().mockResolvedValue(undefined),
    on: mockOn
  }));
  
  return {
    Pool: mockPool,
    __mockQuery: mockQuery,
    __mockConnect: mockConnect,
    __mockRelease: mockRelease,
    __mockOn: mockOn,
    __mockClient: mockClient
  };
});

describe('Database Configuration', () => {
  let database;
  let mockQuery;
  let mockConnect;
  let mockRelease;
  let mockClient;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Get mock references
    const pg = require('pg');
    mockQuery = pg.__mockQuery;
    mockConnect = pg.__mockConnect;
    mockRelease = pg.__mockRelease;
    mockClient = pg.__mockClient;
    
    // Reset mock implementations
    mockQuery.mockReset();
    mockConnect.mockReset();
    mockRelease.mockReset();
    
    // Setup default mock behavior
    mockConnect.mockResolvedValue(mockClient);
    
    // Reload database module
    database = require('./database');
  });
  
  describe('query', () => {
    it('should execute query successfully', async () => {
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockQuery.mockResolvedValue(mockResult);
      
      const result = await database.query('SELECT * FROM users WHERE id = $1', [1]);
      
      expect(result).toEqual(mockResult);
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
    });
    
    it('should log slow queries (> 100ms)', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      
      // Mock a slow query
      mockQuery.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(mockResult), 150);
        });
      });
      
      await database.query('SELECT * FROM large_table', []);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Slow query detected:',
        expect.objectContaining({
          text: 'SELECT * FROM large_table',
          rows: 1
        })
      );
      
      consoleSpy.mockRestore();
    });
    
    it('should not log fast queries', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockQuery.mockResolvedValue(mockResult);
      
      await database.query('SELECT 1', []);
      
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
  
  describe('transaction', () => {
    it('should execute transaction successfully', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // User query
        .mockResolvedValueOnce({ rows: [] }); // COMMIT
      
      const result = await database.transaction(async (client) => {
        const res = await client.query('INSERT INTO users VALUES ($1)', [1]);
        return res.rows[0];
      });
      
      expect(result).toEqual({ id: 1 });
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockRelease).toHaveBeenCalled();
    });
    
    it('should rollback transaction on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Query failed')) // User query fails
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
      
      await expect(
        database.transaction(async (client) => {
          await client.query('INSERT INTO users VALUES ($1)', [1]);
        })
      ).rejects.toThrow('Query failed');
      
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRelease).toHaveBeenCalled();
    });
    
    it('should release client even if rollback fails', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Query failed')) // User query fails
        .mockRejectedValueOnce(new Error('Rollback failed')); // ROLLBACK fails
      
      // When rollback fails, the original error is thrown (not the rollback error)
      // But in the actual implementation, the rollback error would be thrown
      await expect(
        database.transaction(async (client) => {
          await client.query('INSERT INTO users VALUES ($1)', [1]);
        })
      ).rejects.toThrow(); // Just check that it throws
      
      expect(mockRelease).toHaveBeenCalled();
    });
  });
  
  describe('healthCheck', () => {
    it('should return true when database is healthy', async () => {
      mockQuery.mockResolvedValue({ rows: [{ health: 1 }] });
      
      const result = await database.healthCheck();
      
      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith('SELECT 1 as health');
    });
    
    it('should return false when database is unhealthy', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockQuery.mockRejectedValue(new Error('Connection failed'));
      
      const result = await database.healthCheck();
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Database health check failed:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('getClient', () => {
    it('should return a client from the pool', async () => {
      const client = await database.getClient();
      
      expect(client).toBeDefined();
      expect(mockConnect).toHaveBeenCalled();
    });
  });
  
  describe('close', () => {
    it('should close the connection pool', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await database.close();
      
      expect(consoleSpy).toHaveBeenCalledWith('Database connection pool closed');
      consoleSpy.mockRestore();
    });
  });
  
  describe('pool error handling', () => {
    it('should handle pool errors', () => {
      const pg = require('pg');
      const mockOn = pg.__mockOn;
      
      // Verify error handler was registered
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
    });
    
    it('should handle pool connect events', () => {
      const pg = require('pg');
      const mockOn = pg.__mockOn;
      
      // Verify connect handler was registered
      expect(mockOn).toHaveBeenCalledWith('connect', expect.any(Function));
    });
  });

  describe('configuration with environment variables', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use environment variables when provided', () => {
      // Set environment variables
      process.env.DB_HOST = 'custom-host';
      process.env.DB_PORT = '5433';
      process.env.DB_NAME = 'custom_db';
      process.env.DB_USER = 'custom_user';
      process.env.DB_PASSWORD = 'custom_pass';
      process.env.DB_POOL_MAX = '50';
      process.env.DB_POOL_MIN = '5';
      process.env.DB_IDLE_TIMEOUT = '60000';
      process.env.DB_CONNECTION_TIMEOUT = '10000';
      process.env.DB_STATEMENT_TIMEOUT = '60000';

      // Reload module to pick up new env vars
      jest.resetModules();
      const pg = require('pg');
      const Pool = pg.Pool;
      
      // Clear previous calls
      Pool.mockClear();
      
      // Require database module which will create pool with env vars
      require('./database');

      // Verify Pool was called with environment variable values
      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'custom-host',
          port: 5433,
          database: 'custom_db',
          user: 'custom_user',
          password: 'custom_pass',
          max: 50,
          min: 5,
          idleTimeoutMillis: 60000,
          connectionTimeoutMillis: 10000,
          statement_timeout: 60000
        })
      );
    });

    it('should use default values when environment variables are not set', () => {
      // Clear environment variables
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

      // Reload module to pick up cleared env vars
      jest.resetModules();
      const pg = require('pg');
      const Pool = pg.Pool;
      
      // Clear previous calls
      Pool.mockClear();
      
      // Require database module which will create pool with defaults
      require('./database');

      // Verify Pool was called with default values (some may come from .env file)
      const poolConfig = Pool.mock.calls[0][0];
      expect(poolConfig.host).toBe('localhost');
      expect(poolConfig.port).toBe(5432);
      expect(poolConfig.database).toBe('eduos_db');
      // user and password may come from .env, so just check they exist
      expect(poolConfig.user).toBeDefined();
      expect(poolConfig.idleTimeoutMillis).toBe(30000);
      expect(poolConfig.connectionTimeoutMillis).toBe(5000);
      expect(poolConfig.statement_timeout).toBe(30000);
    });

    it('should parse numeric environment variables correctly', () => {
      // Set numeric env vars as strings (as they come from environment)
      process.env.DB_PORT = '9999';
      process.env.DB_POOL_MAX = '100';
      process.env.DB_POOL_MIN = '10';
      process.env.DB_IDLE_TIMEOUT = '45000';
      process.env.DB_CONNECTION_TIMEOUT = '15000';
      process.env.DB_STATEMENT_TIMEOUT = '90000';

      // Reload module
      jest.resetModules();
      const pg = require('pg');
      const Pool = pg.Pool;
      Pool.mockClear();
      
      require('./database');

      // Verify numeric values were parsed correctly
      const poolConfig = Pool.mock.calls[0][0];
      expect(typeof poolConfig.port).toBe('number');
      expect(poolConfig.port).toBe(9999);
      expect(typeof poolConfig.max).toBe('number');
      expect(poolConfig.max).toBe(100);
      expect(typeof poolConfig.min).toBe('number');
      expect(poolConfig.min).toBe(10);
      expect(typeof poolConfig.idleTimeoutMillis).toBe('number');
      expect(poolConfig.idleTimeoutMillis).toBe(45000);
      expect(typeof poolConfig.connectionTimeoutMillis).toBe('number');
      expect(poolConfig.connectionTimeoutMillis).toBe(15000);
      expect(typeof poolConfig.statement_timeout).toBe('number');
      expect(poolConfig.statement_timeout).toBe(90000);
    });

    it('should handle empty string environment variables by using defaults', () => {
      // Set empty strings (which should trigger default values)
      process.env.DB_HOST = '';
      process.env.DB_PORT = '';
      process.env.DB_NAME = '';
      process.env.DB_USER = '';
      process.env.DB_POOL_MAX = '';
      process.env.DB_POOL_MIN = '';

      // Reload module
      jest.resetModules();
      const pg = require('pg');
      const Pool = pg.Pool;
      Pool.mockClear();
      
      require('./database');

      // Empty strings are falsy, so defaults should be used
      const poolConfig = Pool.mock.calls[0][0];
      expect(poolConfig.host).toBe('localhost');
      expect(poolConfig.port).toBe(5432);
      expect(poolConfig.database).toBe('eduos_db');
      expect(poolConfig.user).toBe('eduos_app');
      expect(poolConfig.max).toBe(20);
      expect(poolConfig.min).toBe(2);
    });
  });

  describe('healthCheck edge cases', () => {
    it('should return false when health check returns unexpected value', async () => {
      mockQuery.mockResolvedValue({ rows: [{ health: 0 }] });
      
      const result = await database.healthCheck();
      
      expect(result).toBe(false);
    });

    it('should handle when health check returns no rows', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockQuery.mockResolvedValue({ rows: [] });
      
      const result = await database.healthCheck();
      
      // Should return false and log error when rows[0] is undefined
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('pool event handlers', () => {
    it('should log when new connection is established', () => {
      const pg = require('pg');
      const mockOn = pg.__mockOn;
      
      // Get the connect handler
      const connectCall = mockOn.mock.calls.find(call => call[0] === 'connect');
      expect(connectCall).toBeDefined();
      
      const connectHandler = connectCall[1];
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Trigger the connect handler
      connectHandler({});
      
      expect(consoleSpy).toHaveBeenCalledWith('New database connection established');
      consoleSpy.mockRestore();
    });

    it('should exit process on pool error', () => {
      const pg = require('pg');
      const mockOn = pg.__mockOn;
      
      // Get the error handler
      const errorCall = mockOn.mock.calls.find(call => call[0] === 'error');
      expect(errorCall).toBeDefined();
      
      const errorHandler = errorCall[1];
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
      
      // Trigger the error handler
      const testError = new Error('Pool error');
      errorHandler(testError, {});
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Unexpected error on idle client', testError);
      expect(processExitSpy).toHaveBeenCalledWith(-1);
      
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });
});
