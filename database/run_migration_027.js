const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'eduos',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration 027: Scheduling System...');
    
    // Read the migration file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '027_scheduling_system.sql'),
      'utf8'
    );
    
    // Execute the migration
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');
    
    console.log('✅ Migration 027 completed successfully!');
    console.log('\nCreated tables:');
    console.log('  - rooms');
    console.log('  - teachers');
    console.log('  - subjects');
    console.log('  - batches');
    console.log('  - schedule_slots');
    console.log('  - schedule_overrides');
    console.log('  - schedule_conflicts');
    console.log('\nCreated function:');
    console.log('  - detect_schedule_conflicts()');
    console.log('\nEnabled Row-Level Security on all tables');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
