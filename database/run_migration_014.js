/**
 * Migration Runner for 014_merge_snapshots
 * Task: 3.3.1 Implement pre-merge cryptographic snapshots
 */

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
    console.log('🚀 Starting Migration 014: Pre-Merge Cryptographic Snapshots...\n');
    
    // Enable pgcrypto extension if not already enabled
    console.log('📦 Ensuring pgcrypto extension is enabled...');
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    console.log('✅ pgcrypto extension ready\n');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '014_merge_snapshots.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Executing migration SQL...');
    await client.query(migrationSQL);
    console.log('✅ Migration executed successfully\n');
    
    // Verify tables were created
    console.log('🔍 Verifying table creation...');
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('merge_snapshots', 'merge_audit_log')
      ORDER BY table_name;
    `);
    
    console.log('Created tables:');
    tableCheck.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    console.log('');
    
    // Verify functions were created
    console.log('🔍 Verifying function creation...');
    const functionCheck = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name IN (
          'compute_snapshot_hash',
          'create_merge_snapshot',
          'verify_snapshot_integrity',
          'prevent_merge_snapshot_modification'
        )
      ORDER BY routine_name;
    `);
    
    console.log('Created functions:');
    functionCheck.rows.forEach(row => {
      console.log(`  ✓ ${row.routine_name}`);
    });
    console.log('');
    
    // Verify students table columns
    console.log('🔍 Verifying students table updates...');
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'students' 
        AND column_name IN ('merged_into', 'merged_at', 'merged_from')
      ORDER BY column_name;
    `);
    
    console.log('Added columns to students table:');
    columnCheck.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name}`);
    });
    console.log('');
    
    // Test snapshot hash function
    console.log('🧪 Testing snapshot hash function...');
    const hashTest = await client.query(`
      SELECT compute_snapshot_hash(
        '{"student_id": "test-1", "name": "John Doe"}'::JSONB,
        '[{"student_id": "test-2", "name": "Jane Doe"}]'::JSONB
      ) AS hash;
    `);
    console.log(`  ✓ Hash function working: ${hashTest.rows[0].hash.substring(0, 16)}...`);
    console.log('');
    
    console.log('✅ Migration 014 completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  • Created merge_snapshots table (append-only)');
    console.log('  • Created merge_audit_log table');
    console.log('  • Added merge tracking columns to students table');
    console.log('  • Created helper functions for snapshot management');
    console.log('  • Enabled Row-Level Security policies');
    console.log('  • Added cryptographic integrity verification');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nError details:', error);
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
