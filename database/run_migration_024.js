/**
 * Run Migration 024: Performance Optimization Indexes
 * 
 * Task: 4.4.4 - Setup performance optimization and caching
 * 
 * This script runs the performance optimization migration that creates
 * indexes on frequently queried columns.
 * 
 * Usage:
 *   node database/run_migration_024.js
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
 * Run migration
 */
async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('='.repeat(80));
    console.log('MIGRATION 024: Performance Optimization Indexes');
    console.log('='.repeat(80));
    console.log('');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '024_performance_indexes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Starting migration...');
    console.log('');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Run migration
    const startTime = Date.now();
    await client.query(migrationSQL);
    const duration = Date.now() - startTime;
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('');
    console.log('✅ Migration completed successfully');
    console.log(`Duration: ${duration}ms`);
    console.log('');
    
    // Verify indexes were created
    console.log('Verifying indexes...');
    const indexCheck = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `);
    
    console.log(`✅ ${indexCheck.rows.length} indexes created`);
    console.log('');
    
    // Show sample of created indexes
    console.log('Sample of created indexes:');
    console.log('-'.repeat(80));
    indexCheck.rows.slice(0, 10).forEach(row => {
      console.log(`  ${row.tablename}.${row.indexname}`);
    });
    if (indexCheck.rows.length > 10) {
      console.log(`  ... and ${indexCheck.rows.length - 10} more`);
    }
    console.log('');
    
    // Check index usage functions
    console.log('Verifying performance monitoring functions...');
    const functionCheck = await client.query(`
      SELECT 
        proname as function_name
      FROM pg_proc
      WHERE proname IN ('analyze_query_performance', 'check_index_usage')
    `);
    
    console.log(`✅ ${functionCheck.rows.length} monitoring functions created`);
    functionCheck.rows.forEach(row => {
      console.log(`  - ${row.function_name}()`);
    });
    console.log('');
    
    // Run ANALYZE to update statistics
    console.log('Updating table statistics...');
    await client.query('ANALYZE');
    console.log('✅ Statistics updated');
    console.log('');
    
    console.log('='.repeat(80));
    console.log('MIGRATION COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('Next steps:');
    console.log('1. Monitor query performance: SELECT * FROM analyze_query_performance();');
    console.log('2. Check index usage: SELECT * FROM check_index_usage();');
    console.log('3. Run load tests: node scripts/load-test.js --scenario=load');
    console.log('4. Monitor cache hit rate: cacheService.getCacheStats()');
    console.log('');
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    
    console.error('');
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('');
    console.error('To rollback, run:');
    console.error('  node database/rollback_migration_024.js');
    console.error('');
    
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
