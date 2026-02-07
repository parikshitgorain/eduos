/**
 * Rollback Migration 024: Performance Optimization Indexes
 * 
 * Task: 4.4.4 - Setup performance optimization and caching
 * 
 * This script rolls back the performance optimization migration by
 * removing all created indexes and functions.
 * 
 * Usage:
 *   node database/rollback_migration_024.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'eduos_db',
  user: process.env.DB_USER || 'eduos_app',
  password: process.env.DB_PASSWORD,
});

/**
 * Rollback migration
 */
async function rollbackMigration() {
  const client = await pool.connect();
  
  try {
    console.log('='.repeat(80));
    console.log('ROLLBACK MIGRATION 024: Performance Optimization Indexes');
    console.log('='.repeat(80));
    console.log('');
    console.log('⚠️  WARNING: This will remove all performance indexes!');
    console.log('');
    
    // Confirm rollback
    console.log('Are you sure you want to proceed? (This script will continue in 5 seconds)');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Read rollback file
    const rollbackPath = path.join(__dirname, 'migrations', '024_performance_indexes_rollback.sql');
    const rollbackSQL = fs.readFileSync(rollbackPath, 'utf8');
    
    console.log('Starting rollback...');
    console.log('');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Run rollback
    const startTime = Date.now();
    await client.query(rollbackSQL);
    const duration = Date.now() - startTime;
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('');
    console.log('✅ Rollback completed successfully');
    console.log(`Duration: ${duration}ms`);
    console.log('');
    
    // Verify indexes were removed
    console.log('Verifying indexes removed...');
    const indexCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
    `);
    
    console.log(`Remaining performance indexes: ${indexCheck.rows[0].count}`);
    console.log('');
    
    // Check functions were removed
    console.log('Verifying functions removed...');
    const functionCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_proc
      WHERE proname IN ('analyze_query_performance', 'check_index_usage')
    `);
    
    console.log(`Remaining monitoring functions: ${functionCheck.rows[0].count}`);
    console.log('');
    
    console.log('='.repeat(80));
    console.log('ROLLBACK COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('To re-apply the migration, run:');
    console.log('  node database/run_migration_024.js');
    console.log('');
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    
    console.error('');
    console.error('❌ Rollback failed:', error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('');
    
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run rollback
rollbackMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
