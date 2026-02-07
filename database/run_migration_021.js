/**
 * Run Migration 021: Encryption at Rest
 * Task: 4.3.3 - Implement encryption at rest and in transit
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'eduos_db',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres_password'
  });

  const client = await pool.connect();

  try {
    console.log('Starting Migration 021: Encryption at Rest...\n');

    // Read migration SQL
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '021_encryption_at_rest.sql'),
      'utf8'
    );

    // Execute migration
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');

    console.log('\n✅ Migration 021 completed successfully!\n');

    // Verify tables were created
    const verifyResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('encryption_keys', 'encryption_audit_log')
      ORDER BY table_name
    `);

    console.log('Created tables:');
    verifyResult.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    // Verify columns were added
    const columnsResult = await client.query(`
      SELECT 
        table_name,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'students' AND column_name IN ('national_id_encrypted', 'medical_history_encrypted'))
          OR (table_name = 'payments' AND column_name = 'payment_info_encrypted')
        )
      ORDER BY table_name, column_name
    `);

    console.log('\nAdded encrypted columns:');
    columnsResult.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}.${row.column_name} (${row.data_type})`);
    });

    // Check encryption key status
    const keyStatusResult = await client.query(`
      SELECT * FROM encryption_key_status
    `);

    console.log('\nEncryption key status:');
    if (keyStatusResult.rows.length > 0) {
      const key = keyStatusResult.rows[0];
      console.log(`  Version: ${key.key_version}`);
      console.log(`  Active: ${key.is_active}`);
      console.log(`  Created: ${key.created_at}`);
      console.log(`  Days Active: ${Math.floor(key.days_active)}`);
      console.log(`  Rotation Needed: ${key.rotation_needed}`);
    }

    console.log('\n📋 Next Steps:');
    console.log('1. Set MASTER_ENCRYPTION_KEY in .env (minimum 32 characters)');
    console.log('2. Optional: Configure KMS provider (AWS KMS or HashiCorp Vault)');
    console.log('3. Enable TLS by setting TLS_ENABLED=true and providing certificates');
    console.log('4. Run encryption service initialization');
    console.log('5. Test encryption with sample data');

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

// Run migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
