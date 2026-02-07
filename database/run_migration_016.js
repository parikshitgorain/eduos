/**
 * Run Migration 016: Payment Gateway Integration
 * 
 * Creates tables for payment processing and webhook handling
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
    password: process.env.POSTGRES_PASSWORD || 'postgres_password',
  });

  try {
    console.log('Starting Migration 016: Payment Gateway Integration...\n');

    // Read migration SQL
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '016_payment_gateway.sql'),
      'utf8'
    );

    // Execute migration
    await pool.query(migrationSQL);

    console.log('\n✅ Migration 016 completed successfully!');
    console.log('\nCreated tables:');
    console.log('  - payments (with RLS)');
    console.log('  - webhook_logs (with RLS)');
    console.log('\nFeatures:');
    console.log('  - Stripe and Razorpay integration');
    console.log('  - Indian payment methods support (card, UPI, net banking)');
    console.log('  - Webhook idempotency (webhook_id + tenant_id)');
    console.log('  - 90-day webhook log retention');
    console.log('  - Currency: Indian Rupee (₹ INR)');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
runMigration();
