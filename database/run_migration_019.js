/**
 * Run Migration 019: Bank Reconciliation System
 * 
 * This script applies the bank reconciliation migration to the database.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'eduos',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  let client;

  try {
    client = await pool.connect();
    console.log('✓ Connected to database');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '019_bank_reconciliation.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('\n📦 Running Migration 019: Bank Reconciliation System...\n');

    // Execute migration
    await client.query(migrationSQL);

    console.log('✓ Migration 019 completed successfully\n');

    // Verify tables were created
    const tables = [
      'bank_accounts',
      'bank_reconciliation_sessions',
      'bank_transactions',
      'reconciliation_matches',
      'reconciliation_discrepancies'
    ];

    console.log('Verifying tables...');
    for (const table of tables) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);

      if (result.rows[0].exists) {
        console.log(`  ✓ Table '${table}' created`);
      } else {
        console.log(`  ✗ Table '${table}' NOT created`);
      }
    }

    console.log('\n✅ Migration 019 verification complete\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run migration
runMigration();
