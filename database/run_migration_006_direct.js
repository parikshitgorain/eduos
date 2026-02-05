/**
 * Run migration 006 - RBAC Hierarchy (Direct execution)
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load environment variables
require('dotenv').config();

// Create a direct pool connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'eduos_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Running migration 006: RBAC Hierarchy...');
    console.log('Database:', process.env.DB_NAME || 'eduos_db');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '006_rbac_hierarchy.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the entire migration as one transaction
    await client.query('BEGIN');
    
    try {
      await client.query(migrationSQL);
      
      // Record the migration
      await client.query(
        `INSERT INTO schema_migrations (migration_name, applied_at)
         VALUES ($1, NOW())
         ON CONFLICT (migration_name) DO NOTHING`,
        ['006_rbac_hierarchy.sql']
      );
      
      await client.query('COMMIT');
      console.log('✓ Migration 006 completed successfully');
      console.log('✓ Migration recorded in schema_migrations table');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Migration failed:', error.message);
    console.error('Error code:', error.code);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
