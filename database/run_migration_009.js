/**
 * Run migration 009 - Schema Snapshots
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'eduos_dev',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration 009_schema_snapshots.sql...');
    
    // Check if already applied
    const checkResult = await client.query(
      "SELECT version FROM schema_migrations WHERE version = '009'"
    );
    
    if (checkResult.rows.length > 0) {
      console.log('✓ Migration 009 already applied, skipping...');
      return;
    }
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '009_schema_snapshots.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');
    
    console.log('✓ Migration 009_schema_snapshots.sql completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('\nMigration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration failed:', error.message);
    process.exit(1);
  });
