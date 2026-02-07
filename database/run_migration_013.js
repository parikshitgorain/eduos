/**
 * Run Migration 013: Duplicate Review Queue
 * Task 3.2.4: Build duplicate review queue UI
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'eduos',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  });

  try {
    console.log('Running Migration 013: Duplicate Review Queue...\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '013_duplicate_review_queue.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await pool.query(migrationSQL);

    console.log('\n✓ Migration 013 completed successfully!');
    console.log('\nCreated:');
    console.log('  - duplicate_review_queue table');
    console.log('  - Indexes for performance');
    console.log('  - RLS policies for multi-tenancy');
    console.log('  - Trigger to prevent reverse duplicate pairs');
    console.log('  - pending_duplicate_reviews view');

  } catch (error) {
    console.error('\n✗ Migration 013 failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
