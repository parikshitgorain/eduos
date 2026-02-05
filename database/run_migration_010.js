/**
 * Run Migration 010: Schema Migration Engine
 * 
 * This script runs the schema migration engine migration.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'eduos',
  user: process.env.DB_USER || 'eduos_app',
  password: process.env.DB_PASSWORD || 'eduos_password'
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration 010: Schema Migration Engine...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '010_schema_migration_engine.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration 010 completed successfully!');
    console.log('Created tables:');
    console.log('  - schema_migration_dry_runs');
    console.log('  - schema_migrations_log');
    console.log('  - schema_migration_snapshots');
    console.log('  - student_records (if not exists)');
    
  } catch (error) {
    console.error('❌ Migration 010 failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('Migration process completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration process failed:', error);
    process.exit(1);
  });
