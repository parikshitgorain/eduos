/**
 * Migration Runner for 028_schedule_proposals
 * Task 5.2.2: Implement AI-assisted schedule optimization
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'eduos',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration 028: Schedule Proposals...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '028_schedule_proposals.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');
    
    console.log('✅ Migration 028 completed successfully');
    console.log('   - Created schedule_proposals table');
    console.log('   - Added RLS policies');
    console.log('   - Created indexes');
    console.log('   - Added proposal_id to schedule_slots');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 028 failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
