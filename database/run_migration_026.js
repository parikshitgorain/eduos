/**
 * Run Migration 026: Password Reset Tokens
 * 
 * This script runs the password reset tokens migration
 */

const { getClient } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = await getClient();
  
  try {
    console.log('Starting Migration 026: Password Reset Tokens...');
    
    // Read migration file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '026_password_reset_tokens.sql'),
      'utf8'
    );
    
    // Execute migration
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');
    
    console.log('✓ Migration 026 completed successfully');
    console.log('✓ Created password_reset_tokens table');
    console.log('✓ Added password authentication columns to users table');
    console.log('✓ Added search columns to tenants table');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Migration 026 failed:', error.message);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
