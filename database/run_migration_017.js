/**
 * Migration Runner for 017_invoice_generation
 * 
 * Creates invoice generation system with sequential numbering
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'eduos',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  });

  let client;

  try {
    client = await pool.connect();
    console.log('✓ Connected to database');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '017_invoice_generation.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('\n📦 Running Migration 017: Invoice Generation System...\n');

    // Execute migration
    await client.query(migrationSQL);

    console.log('\n✅ Migration 017 completed successfully!\n');

    // Verify tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('invoices', 'invoice_sequences')
      ORDER BY table_name;
    `);

    console.log('📋 Created Tables:');
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // Verify functions exist
    const functionsResult = await client.query(`
      SELECT proname 
      FROM pg_proc 
      WHERE proname IN ('generate_invoice_number', 'detect_invoice_gaps')
      ORDER BY proname;
    `);

    console.log('\n🔧 Created Functions:');
    functionsResult.rows.forEach(row => {
      console.log(`   - ${row.proname}`);
    });

    // Test invoice number generation
    console.log('\n🧪 Testing invoice number generation...');
    
    // Create a test tenant if needed
    const tenantResult = await client.query(`
      INSERT INTO tenants (name, subdomain, tier)
      VALUES ('Test School', 'test-invoice', 'Basic')
      ON CONFLICT (subdomain) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `);
    const testTenantId = tenantResult.rows[0].id;

    // Generate test invoice number
    const invoiceResult = await client.query(`
      SELECT * FROM generate_invoice_number($1);
    `, [testTenantId]);

    console.log('   Generated invoice number:', invoiceResult.rows[0].invoice_number);
    console.log('   Year:', invoiceResult.rows[0].invoice_year);
    console.log('   Month:', invoiceResult.rows[0].invoice_month);
    console.log('   Sequence:', invoiceResult.rows[0].invoice_sequence);

    console.log('\n✅ All tests passed!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
