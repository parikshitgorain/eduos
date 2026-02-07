/**
 * Run Migration 018: Refund Workflow with Approval Chain
 * 
 * This script runs the refund workflow migration which creates:
 * - refund_requests table with approval chain workflow
 * - refund_approval_history table for audit trail
 * - credit_notes table for refund documentation
 * - Functions for credit note number generation and refund validation
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
  password: process.env.DB_PASSWORD || 'postgres',
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Starting Migration 018: Refund Workflow with Approval Chain...\n');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '018_refund_workflow.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    console.log('Executing migration SQL...');
    await client.query(migrationSQL);
    
    console.log('\n✅ Migration 018 completed successfully!\n');
    
    // Verify tables were created
    console.log('Verifying migration...');
    
    const tables = ['refund_requests', 'refund_approval_history', 'credit_notes'];
    for (const table of tables) {
      const result = await client.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_name = $1
      `, [table]);
      
      if (result.rows[0].count === '1') {
        console.log(`✓ Table '${table}' created successfully`);
      } else {
        throw new Error(`Table '${table}' was not created`);
      }
    }
    
    // Verify RLS is enabled
    console.log('\nVerifying Row-Level Security...');
    for (const table of tables) {
      const result = await client.query(`
        SELECT rowsecurity 
        FROM pg_tables 
        WHERE tablename = $1
      `, [table]);
      
      if (result.rows[0]?.rowsecurity) {
        console.log(`✓ RLS enabled on '${table}'`);
      } else {
        throw new Error(`RLS not enabled on '${table}'`);
      }
    }
    
    // Verify functions were created
    console.log('\nVerifying functions...');
    const functions = [
      'generate_credit_note_number',
      'validate_refund_amount',
      'update_refund_requests_updated_at',
      'update_credit_notes_updated_at'
    ];
    
    for (const func of functions) {
      const result = await client.query(`
        SELECT COUNT(*) as count 
        FROM pg_proc 
        WHERE proname = $1
      `, [func]);
      
      if (parseInt(result.rows[0].count) > 0) {
        console.log(`✓ Function '${func}' created successfully`);
      } else {
        throw new Error(`Function '${func}' was not created`);
      }
    }
    
    console.log('\n✅ All verification checks passed!\n');
    console.log('Migration 018 Summary:');
    console.log('- Created refund_requests table with approval chain workflow');
    console.log('- Created refund_approval_history table for audit trail');
    console.log('- Created credit_notes table for refund documentation');
    console.log('- Implemented approval chain: Teacher → Admin → Finance Manager');
    console.log('- Added refund amount validation');
    console.log('- Enabled Row-Level Security on all tables');
    console.log('- Created credit note number generation function');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
