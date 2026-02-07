/**
 * Secure Query Helper Tests
 * 
 * Tests for secure database query utilities
 * Task: 4.3.2 - Setup SQL injection and XSS protection
 */

const {
  secureQuery,
  secureTransaction,
  validateIdentifier,
  buildWhereClause,
  buildOrderByClause,
  buildLimitOffsetClause
} = require('./secureQuery');

describe('Secure Query Helper', () => {
  describe('validateIdentifier', () => {
    it('should accept valid identifiers', () => {
      expect(() => validateIdentifier('users')).not.toThrow();
      expect(() => validateIdentifier('user_id')).not.toThrow();
      expect(() => validateIdentifier('first_name')).not.toThrow();
      expect(() => validateIdentifier('table1')).not.toThrow();
      expect(() => validateIdentifier('users.id')).not.toThrow();
    });

    it('should reject identifiers with special characters', () => {
      expect(() => validateIdentifier('users; DROP TABLE')).toThrow();
      expect(() => validateIdentifier('user-name')).toThrow();
      expect(() => validateIdentifier('user name')).toThrow();
      expect(() => validateIdentifier('user@name')).toThrow();
    });

    it('should reject SQL keywords', () => {
      expect(() => validateIdentifier('SELECT')).toThrow();
      expect(() => validateIdentifier('INSERT')).toThrow();
      expect(() => validateIdentifier('DELETE')).toThrow();
      expect(() => validateIdentifier('DROP')).toThrow();
    });

    it('should reject identifiers starting with numbers', () => {
      expect(() => validateIdentifier('1user')).toThrow();
      expect(() => validateIdentifier('123')).toThrow();
    });
  });

  describe('buildWhereClause', () => {
    it('should build simple WHERE clause', () => {
      const conditions = {
        user_id: '123',
        status: 'active'
      };

      const { whereClause, params } = buildWhereClause(conditions);

      expect(whereClause).toBe('WHERE user_id = $1 AND status = $2');
      expect(params).toEqual(['123', 'active']);
    });

    it('should handle NULL values', () => {
      const conditions = {
        deleted_at: null
      };

      const { whereClause, params } = buildWhereClause(conditions);

      expect(whereClause).toBe('WHERE deleted_at IS NULL');
      expect(params).toEqual([]);
    });

    it('should handle IN clauses with arrays', () => {
      const conditions = {
        status: ['active', 'pending', 'completed']
      };

      const { whereClause, params } = buildWhereClause(conditions);

      expect(whereClause).toBe('WHERE status IN ($1, $2, $3)');
      expect(params).toEqual(['active', 'pending', 'completed']);
    });

    it('should handle mixed conditions', () => {
      const conditions = {
        tenant_id: '456',
        status: ['active', 'pending'],
        deleted_at: null
      };

      const { whereClause, params } = buildWhereClause(conditions);

      expect(whereClause).toContain('tenant_id = $1');
      expect(whereClause).toContain('status IN ($2, $3)');
      expect(whereClause).toContain('deleted_at IS NULL');
      expect(params).toEqual(['456', 'active', 'pending']);
    });

    it('should return empty WHERE clause for empty conditions', () => {
      const conditions = {};

      const { whereClause, params } = buildWhereClause(conditions);

      expect(whereClause).toBe('');
      expect(params).toEqual([]);
    });

    it('should support custom start index', () => {
      const conditions = {
        user_id: '123'
      };

      const { whereClause, params } = buildWhereClause(conditions, 5);

      expect(whereClause).toBe('WHERE user_id = $5');
      expect(params).toEqual(['123']);
    });

    it('should reject invalid column names', () => {
      const conditions = {
        'user; DROP TABLE': '123'
      };

      expect(() => buildWhereClause(conditions)).toThrow();
    });
  });

  describe('buildOrderByClause', () => {
    it('should build ORDER BY ASC', () => {
      const clause = buildOrderByClause('created_at', 'ASC');

      expect(clause).toBe('ORDER BY created_at ASC');
    });

    it('should build ORDER BY DESC', () => {
      const clause = buildOrderByClause('created_at', 'DESC');

      expect(clause).toBe('ORDER BY created_at DESC');
    });

    it('should default to ASC', () => {
      const clause = buildOrderByClause('created_at');

      expect(clause).toBe('ORDER BY created_at ASC');
    });

    it('should handle lowercase direction', () => {
      const clause = buildOrderByClause('created_at', 'desc');

      expect(clause).toBe('ORDER BY created_at DESC');
    });

    it('should reject invalid column names', () => {
      expect(() => buildOrderByClause('created_at; DROP TABLE')).toThrow();
    });

    it('should reject invalid directions', () => {
      expect(() => buildOrderByClause('created_at', 'INVALID')).toThrow();
      expect(() => buildOrderByClause('created_at', 'SELECT')).toThrow();
    });
  });

  describe('buildLimitOffsetClause', () => {
    it('should build LIMIT and OFFSET clause', () => {
      const { clause, params } = buildLimitOffsetClause(10, 20);

      expect(clause).toBe('LIMIT $1 OFFSET $2');
      expect(params).toEqual([10, 20]);
    });

    it('should default offset to 0', () => {
      const { clause, params } = buildLimitOffsetClause(10);

      expect(clause).toBe('LIMIT $1 OFFSET $2');
      expect(params).toEqual([10, 0]);
    });

    it('should support custom parameter index', () => {
      const { clause, params } = buildLimitOffsetClause(10, 20, 5);

      expect(clause).toBe('LIMIT $5 OFFSET $6');
      expect(params).toEqual([10, 20]);
    });

    it('should reject negative limit', () => {
      expect(() => buildLimitOffsetClause(-10, 0)).toThrow('Limit must be a positive integer');
    });

    it('should reject negative offset', () => {
      expect(() => buildLimitOffsetClause(10, -5)).toThrow('Offset must be a positive integer');
    });

    it('should reject non-integer limit', () => {
      expect(() => buildLimitOffsetClause(10.5, 0)).toThrow('Limit must be a positive integer');
      expect(() => buildLimitOffsetClause('10', 0)).toThrow('Limit must be a positive integer');
    });

    it('should reject non-integer offset', () => {
      expect(() => buildLimitOffsetClause(10, 5.5)).toThrow('Offset must be a positive integer');
      expect(() => buildLimitOffsetClause(10, '5')).toThrow('Offset must be a positive integer');
    });
  });

  describe('secureQuery', () => {
    let mockClient;

    beforeEach(() => {
      mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
      };
    });

    it('should execute parameterized query', async () => {
      const query = 'SELECT * FROM users WHERE id = $1';
      const params = ['123'];

      await secureQuery(mockClient, query, params);

      expect(mockClient.query).toHaveBeenCalledWith(query, params);
    });

    it('should throw error for parameter count mismatch', async () => {
      const query = 'SELECT * FROM users WHERE id = $1 AND status = $2';
      const params = ['123']; // Missing second parameter

      await expect(secureQuery(mockClient, query, params)).rejects.toThrow('Parameter count mismatch');
    });

    it('should handle query with no parameters', async () => {
      const query = 'SELECT * FROM users';
      const params = [];

      await secureQuery(mockClient, query, params);

      expect(mockClient.query).toHaveBeenCalledWith(query, params);
    });

    it('should handle query errors gracefully', async () => {
      const query = 'SELECT * FROM users WHERE id = $1';
      const params = ['123'];
      const error = new Error('Database error');
      error.code = '23505';

      mockClient.query.mockRejectedValue(error);

      await expect(secureQuery(mockClient, query, params)).rejects.toThrow('Database error');
    });
  });

  describe('secureTransaction', () => {
    let mockPool, mockClient;

    beforeEach(() => {
      mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        release: jest.fn()
      };

      mockPool = {
        connect: jest.fn().mockResolvedValue(mockClient)
      };
    });

    it('should execute transaction and commit', async () => {
      const callback = jest.fn().mockResolvedValue('result');

      const result = await secureTransaction(mockPool, callback);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(callback).toHaveBeenCalledWith(mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    it('should rollback on error', async () => {
      const error = new Error('Transaction error');
      const callback = jest.fn().mockRejectedValue(error);

      await expect(secureTransaction(mockPool, callback)).rejects.toThrow('Transaction error');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release client even if rollback fails', async () => {
      const error = new Error('Transaction error');
      const callback = jest.fn().mockRejectedValue(error);
      
      mockClient.query.mockImplementation((query) => {
        if (query === 'ROLLBACK') {
          throw new Error('Rollback failed');
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      await expect(secureTransaction(mockPool, callback)).rejects.toThrow();

      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
