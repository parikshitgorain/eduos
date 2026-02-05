/**
 * Run Migration 008 - Hierarchy Entities
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'eduos_db',
  user: process.env.DB_USER || 'eduos_app',
  password: process.env.DB_PASSWORD,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Running migration 008_hierarchy_entities.sql...');
    
    // Check if already applied
    const checkResult = await client.query(
      'SELECT version FROM schema_migrations WHERE version = $1',
      ['008']
    );
    
    if (checkResult.rowCount > 0) {
      console.log('Migration 008 already applied, skipping...');
      return;
    }
    
    // Read and execute migration file
    const filePath = path.join(__dirname, 'migrations', '008_hierarchy_entities.sql');
    const sql = fs.readFileSync(filePath, 'utf8');
    
    await client.query(sql);
    
    console.log('✓ Migration 008 completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
