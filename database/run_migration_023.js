/**
 * Run Migration 023: Backup and Disaster Recovery System
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

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Starting Migration 023: Backup and Disaster Recovery System...');
    
    // Read migration file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '023_backup_system.sql'),
      'utf8'
    );
    
    // Execute migration
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');
    
    console.log('✓ Migration 023 completed successfully');
    
    // Verify tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('backups', 'backup_components', 'dr_drills')
      ORDER BY table_name
    `);
    
    console.log('\nCreated tables:');
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Test backup statistics function
    const stats = await client.query('SELECT * FROM get_backup_statistics()');
    console.log('\nBackup statistics function working:', stats.rows.length >= 0);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
