/**
 * Migration Runner: 009b - Schema Snapshots Immutability
 * 
 * This script runs the immutability constraints migration for schema snapshots.
 * 
 * Task: 2.2.2 - Implement immutable schema snapshots with SHA-256 hashing
 * 
 * Features:
 * - Adds append-only constraints to schema_snapshots table
 * - Adds append-only constraints to field_definitions table
 * - Creates integrity check logging table
 * - Creates batch integrity verification function
 * - Creates nightly integrity check infrastructure
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'eduos',
  user: process.env.DB_USER || 'eduos_admin',
  password: process.env.DB_PASSWORD,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration 009b: Schema Snapshots Immutability...\n');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '009_schema_snapshots_immutability.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');
    
    console.log('✓ Migration 009b completed successfully!\n');
    
    // Verify the migration
    console.log('Verifying migration...\n');
    
    // Check if triggers exist
    const triggerCheck = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table
      FROM information_schema.triggers
      WHERE trigger_name IN (
        'prevent_schema_snapshot_update',
        'prevent_schema_snapshot_delete',
        'prevent_field_definition_update',
        'prevent_field_definition_delete'
      )
      ORDER BY event_object_table, trigger_name
    `);
    
    console.log('Triggers created:');
    triggerCheck.rows.forEach(row => {
      console.log(`  - ${row.trigger_name} (${row.event_manipulation} on ${row.event_object_table})`);
    });
    console.log('');
    
    // Check if integrity check table exists
    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'schema_integrity_checks'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✓ schema_integrity_checks table created');
    }
    
    // Check if functions exist
    const functionCheck = await client.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name IN (
          'prevent_schema_snapshot_modification',
          'prevent_field_definition_modification',
          'verify_all_schema_integrity',
          'verify_schema_integrity'
        )
      ORDER BY routine_name
    `);
    
    console.log('\nFunctions created:');
    functionCheck.rows.forEach(row => {
      console.log(`  - ${row.routine_name} (${row.routine_type})`);
    });
    console.log('');
    
    // Test immutability constraint
    console.log('Testing immutability constraints...\n');
    
    // Try to update a schema snapshot (should fail)
    try {
      await client.query(`
        UPDATE schema_snapshots 
        SET change_summary = 'Test update' 
        WHERE snapshot_id = (SELECT snapshot_id FROM schema_snapshots LIMIT 1)
      `);
      console.log('⚠ WARNING: Update was allowed (constraint not working)');
    } catch (error) {
      if (error.message.includes('immutable')) {
        console.log('✓ Update constraint working: Updates are blocked');
      } else {
        console.log('⚠ Unexpected error:', error.message);
      }
    }
    
    // Try to delete a schema snapshot (should fail)
    try {
      await client.query(`
        DELETE FROM schema_snapshots 
        WHERE snapshot_id = (SELECT snapshot_id FROM schema_snapshots LIMIT 1)
      `);
      console.log('⚠ WARNING: Delete was allowed (constraint not working)');
    } catch (error) {
      if (error.message.includes('immutable')) {
        console.log('✓ Delete constraint working: Deletes are blocked');
      } else {
        console.log('⚠ Unexpected error:', error.message);
      }
    }
    
    console.log('\n✓ Migration verification complete!');
    console.log('\nNext steps:');
    console.log('1. Set up nightly integrity check job (see src/jobs/schemaIntegrityCheckJob.js)');
    console.log('2. Configure cron schedule for nightly execution');
    console.log('3. Monitor integrity check logs in schema_integrity_checks table');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

