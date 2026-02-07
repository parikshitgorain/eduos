/**
 * Secure Query Helper
 * 
 * Enforces parameterized queries and provides additional security checks
 * Task: 4.3.2 - Setup SQL injection and XSS protection
 */

const { validateParameterizedQueries } = require('../middleware/securityProtection');

/**
 * Secure query wrapper that validates parameterized queries
 * 
 * @param {Object} client - Database client
 * @param {string} queryText - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function secureQuery(client, queryText, params = []) {
  // Validate that query uses parameterized statements
  if (process.env.NODE_ENV !== 'production') {
    if (!validateParameterizedQueries(queryText)) {
      throw new Error('Non-parameterized query detected. Use $1, $2, etc. for parameters.');
    }
  }

  // Validate parameter count matches placeholders
  const placeholderCount = (queryText.match(/\$\d+/g) || []).length;
  if (placeholderCount !== params.length) {
    throw new Error(
      `Parameter count mismatch: query has ${placeholderCount} placeholders but ${params.length} parameters provided`
    );
  }

  // Execute query
  try {
    return await client.query(queryText, params);
  } catch (error) {
    // Log error without exposing sensitive query details
    console.error('[SECURE_QUERY] Query execution failed:', {
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Secure transaction wrapper
 * 
 * @param {Object} pool - Database pool
 * @param {Function} callback - Transaction callback
 * @returns {Promise<any>} Transaction result
 */
async function secureTransaction(pool, callback) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[SECURE_TRANSACTION] Transaction rolled back:', {
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Validate SQL identifier (table name, column name, etc.)
 * Prevents SQL injection in dynamic identifiers
 * 
 * @param {string} identifier - SQL identifier
 * @returns {boolean} True if valid
 */
function validateIdentifier(identifier) {
  // Allow only alphanumeric characters, underscores, and dots
  const identifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/;
  
  if (!identifierRegex.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }

  // Prevent SQL keywords as identifiers
  const sqlKeywords = [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
    'EXEC', 'EXECUTE', 'UNION', 'WHERE', 'FROM', 'JOIN', 'TABLE'
  ];

  if (sqlKeywords.includes(identifier.toUpperCase())) {
    throw new Error(`SQL keyword cannot be used as identifier: ${identifier}`);
  }

  return true;
}

/**
 * Build safe WHERE clause with parameterized conditions
 * 
 * @param {Object} conditions - Key-value pairs for WHERE conditions
 * @param {number} startIndex - Starting parameter index (default: 1)
 * @returns {Object} { whereClause, params }
 */
function buildWhereClause(conditions, startIndex = 1) {
  const whereParts = [];
  const params = [];
  let paramIndex = startIndex;

  for (const [key, value] of Object.entries(conditions)) {
    // Validate column name
    validateIdentifier(key);

    if (value === null) {
      whereParts.push(`${key} IS NULL`);
    } else if (Array.isArray(value)) {
      // IN clause
      const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
      whereParts.push(`${key} IN (${placeholders})`);
      params.push(...value);
    } else {
      whereParts.push(`${key} = $${paramIndex++}`);
      params.push(value);
    }
  }

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

  return { whereClause, params };
}

/**
 * Build safe ORDER BY clause
 * 
 * @param {string} column - Column name
 * @param {string} direction - 'ASC' or 'DESC'
 * @returns {string} ORDER BY clause
 */
function buildOrderByClause(column, direction = 'ASC') {
  // Validate column name
  validateIdentifier(column);

  // Validate direction
  const validDirections = ['ASC', 'DESC'];
  const upperDirection = direction.toUpperCase();
  
  if (!validDirections.includes(upperDirection)) {
    throw new Error(`Invalid ORDER BY direction: ${direction}`);
  }

  return `ORDER BY ${column} ${upperDirection}`;
}

/**
 * Build safe LIMIT and OFFSET clause
 * 
 * @param {number} limit - Limit value
 * @param {number} offset - Offset value
 * @param {number} paramIndex - Starting parameter index
 * @returns {Object} { clause, params }
 */
function buildLimitOffsetClause(limit, offset = 0, paramIndex = 1) {
  // Validate limit and offset are positive integers
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error('Limit must be a positive integer');
  }

  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('Offset must be a positive integer');
  }

  const clause = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  const params = [limit, offset];

  return { clause, params };
}

module.exports = {
  secureQuery,
  secureTransaction,
  validateIdentifier,
  buildWhereClause,
  buildOrderByClause,
  buildLimitOffsetClause
};
