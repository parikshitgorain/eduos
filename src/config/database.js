/**
 * Database Configuration
 * 
 * Manages PostgreSQL connection pool with tenant-aware configuration.
 * Supports connection pooling and automatic tenant context setting.
 */

const { Pool } = require('pg');
require('dotenv').config();

// Connection pool configuration
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'eduos_db',
  user: process.env.DB_USER || 'eduos_app',
  password: process.env.DB_PASSWORD,
  
  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
  
  // Statement timeout (30 seconds)
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
};

// Create connection pool
const pool = new Pool(poolConfig);

// Pool error handler
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Pool connection handler
pool.on('connect', (client) => {
  console.log('New database connection established');
});

/**
 * Get a database client from the pool
 * @returns {Promise<PoolClient>}
 */
async function getClient() {
  return await pool.connect();
}

/**
 * Execute a query with automatic connection management
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  
  // Log slow queries (> 100ms)
  if (duration > 100) {
    console.warn('Slow query detected:', {
      text,
      duration: `${duration}ms`,
      rows: result.rowCount
    });
  }
  
  return result;
}

/**
 * Execute a query within a transaction
 * @param {Function} callback - Async function that receives a client
 * @returns {Promise<any>}
 */
async function transaction(callback) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Health check - verify database connectivity
 * @returns {Promise<boolean>}
 */
async function healthCheck() {
  try {
    const result = await pool.query('SELECT 1 as health');
    return result.rows[0].health === 1;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Gracefully close all connections
 * @returns {Promise<void>}
 */
async function close() {
  await pool.end();
  console.log('Database connection pool closed');
}

module.exports = {
  pool,
  getClient,
  query,
  transaction,
  healthCheck,
  close
};
