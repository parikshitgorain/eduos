/**
 * Migration Runner for 025_academic_rules
 * Run this script to apply the academic rules migration
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

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
    console.log('Starting migration 025: Academic Rules System...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '025_academic_rules.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');
    
    console.log('✅ Migration 025 completed successfully!');
    console.log('\nCreated tables:');
    console.log('  - academic_rules');
    console.log('  - rule_evaluations');
    console.log('  - rule_overrides');
    console.log('  - retroactive_policy_requests');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
