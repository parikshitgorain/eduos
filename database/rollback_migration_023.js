/**
 * Rollback Migration 023: Backup and Disaster Recovery System
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'eduos_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function rollbackMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Rolling back Migration 023: Backup and Disaster Recovery System...');
    
    // Read rollback file
    const rollbackSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '023_backup_system_rollback.sql'),
      'utf8'
    );
    
    // Execute rollback
    await client.query('BEGIN');
    await client.query(rollbackSQL);
    await client.query('COMMIT');
    
    console.log('✓ Migration 023 rolled back successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Rollback failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

rollbackMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
