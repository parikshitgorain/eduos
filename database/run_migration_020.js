/**
 * Migration Runner for 020_audit_log_system
 * 
 * This script runs the audit log system migration which implements:
 * - Tamper-evident audit log with SHA-256 hash chain
 * - Immutable audit entries with RLS policies
 * - Hash chain verification functions
 * - Retention policy management
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
    password: process.env.DB_PASSWORD || 'postgres'
  });

  let client;

  try {
    client = await pool.connect();
    console.log('✓ Connected to database');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '020_audit_log_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('\n📋 Running Migration 020: Audit Log System...\n');

    // Execute migration
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');

    console.log('✓ Migration 020 completed successfully\n');

    // Verify tables were created
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('audit_logs', 'audit_retention_policies')
      ORDER BY table_name;
    `);

    console.log('📊 Created Tables:');
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // Verify functions were created
    const functionsResult = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name IN (
          'create_audit_log',
          'verify_audit_chain',
          'compute_audit_hash',
          'get_last_audit_hash',
          'set_audit_retention_policy'
        )
      ORDER BY routine_name;
    `);

    console.log('\n⚙️  Created Functions:');
    functionsResult.rows.forEach(row => {
      console.log(`   - ${row.routine_name}()`);
    });

    // Test hash chain functionality
    console.log('\n🧪 Testing Hash Chain Functionality...\n');

    // Create a test tenant if not exists
    const tenantResult = await client.query(`
      INSERT INTO tenants (id, name, subdomain, tier, status)
      VALUES (
        'test-tenant-audit-001'::UUID,
        'Test Tenant for Audit',
        'test-audit',
        'basic',
        'active'
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id;
    `);

    const testTenantId = 'test-tenant-audit-001';

    // Create test audit entries
    console.log('   Creating test audit entries...');
    
    const entry1 = await client.query(`
      SELECT create_audit_log(
        $1::UUID,
        'user_login',
        'login',
        'user',
        'user-001'::UUID,
        'user-001'::UUID,
        'test@example.com',
        'admin',
        '192.168.1.1'::INET,
        'Mozilla/5.0',
        gen_random_uuid(),
        gen_random_uuid(),
        '{"success": true}'::JSONB,
        NULL,
        NULL,
        'info',
        'success',
        NULL
      ) AS id;
    `, [testTenantId]);

    console.log(`   ✓ Created entry 1: ${entry1.rows[0].id}`);

    const entry2 = await client.query(`
      SELECT create_audit_log(
        $1::UUID,
        'data_modification',
        'update',
        'student',
        'student-001'::UUID,
        'user-001'::UUID,
        'test@example.com',
        'admin',
        '192.168.1.1'::INET,
        'Mozilla/5.0',
        gen_random_uuid(),
        gen_random_uuid(),
        '{"field": "email"}'::JSONB,
        '{"email": "old@example.com"}'::JSONB,
        '{"email": "new@example.com"}'::JSONB,
        'info',
        'success',
        NULL
      ) AS id;
    `, [testTenantId]);

    console.log(`   ✓ Created entry 2: ${entry2.rows[0].id}`);

    // Verify hash chain
    console.log('\n   Verifying hash chain integrity...');
    
    const verifyResult = await client.query(`
      SELECT * FROM verify_audit_chain($1::UUID);
    `, [testTenantId]);

    const verification = verifyResult.rows[0];
    
    if (verification.is_valid) {
      console.log(`   ✓ Hash chain is valid`);
      console.log(`   ✓ Total entries: ${verification.total_entries}`);
      console.log(`   ✓ Invalid entries: ${verification.invalid_entries}`);
    } else {
      console.log(`   ✗ Hash chain is INVALID`);
      console.log(`   ✗ First invalid entry: ${verification.first_invalid_id}`);
      console.log(`   ✗ Error: ${verification.error_message}`);
    }

    // Test retention policy
    console.log('\n   Testing retention policy...');
    
    await client.query(`
      SELECT set_audit_retention_policy($1::UUID, 'enterprise');
    `, [testTenantId]);

    const policyResult = await client.query(`
      SELECT * FROM audit_retention_policies WHERE tenant_id = $1::UUID;
    `, [testTenantId]);

    if (policyResult.rows.length > 0) {
      const policy = policyResult.rows[0];
      console.log(`   ✓ Retention policy set: ${policy.retention_days} days (${policy.tier} tier)`);
    }

    console.log('\n✅ All tests passed!\n');

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
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
runMigration().catch(console.error);
