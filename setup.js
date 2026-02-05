/**
 * EduOS Platform - Automated Setup Script
 * 
 * This script:
 * 1. Checks if PostgreSQL is running
 * 2. Creates the database if it doesn't exist
 * 3. Runs all migrations
 * 4. Verifies the setup
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkPostgres() {
  log('\n📊 Checking PostgreSQL connection...', 'cyan');
  
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres' // Connect to default database first
  });
  
  try {
    await client.connect();
    log('✓ PostgreSQL is running', 'green');
    await client.end();
    return true;
  } catch (error) {
    log('✗ PostgreSQL connection failed', 'red');
    log(`  Error: ${error.message}`, 'red');
    log('\n💡 To fix this:', 'yellow');
    log('  1. Install PostgreSQL 14+ if not installed', 'yellow');
    log('  2. Or run: docker-compose up -d postgres', 'yellow');
    log('  3. Update .env file with correct credentials', 'yellow');
    return false;
  }
}

async function createDatabase() {
  log('\n🗄️  Creating database...', 'cyan');
  
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres'
  });
  
  try {
    await client.connect();
    
    // Check if database exists
    const dbName = process.env.DB_NAME || 'eduos_db';
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );
    
    if (result.rowCount > 0) {
      log(`✓ Database '${dbName}' already exists`, 'green');
    } else {
      await client.query(`CREATE DATABASE ${dbName}`);
      log(`✓ Database '${dbName}' created successfully`, 'green');
    }
    
    await client.end();
    return true;
  } catch (error) {
    log('✗ Database creation failed', 'red');
    log(`  Error: ${error.message}`, 'red');
    return false;
  }
}

async function runMigrations() {
  log('\n🔄 Running database migrations...', 'cyan');
  
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'eduos_db'
  });
  
  try {
    await client.connect();
    
    // Get list of migration files
    const migrationsDir = path.join(__dirname, 'database', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql') && !f.includes('rollback'))
      .sort();
    
    for (const file of files) {
      const version = file.split('_')[0];
      
      // Check if migration already applied
      const checkResult = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      ).catch(() => ({ rowCount: 0 }));
      
      if (checkResult.rowCount > 0) {
        log(`  ✓ Migration ${file} already applied`, 'green');
        continue;
      }
      
      log(`  → Running migration: ${file}...`, 'blue');
      
      // Read and execute migration file
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      await client.query(sql);
      
      log(`  ✓ Migration ${file} completed`, 'green');
    }
    
    await client.end();
    log('\n✓ All migrations completed successfully', 'green');
    return true;
  } catch (error) {
    log('✗ Migration failed', 'red');
    log(`  Error: ${error.message}`, 'red');
    return false;
  }
}

async function verifySetup() {
  log('\n🔍 Verifying setup...', 'cyan');
  
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'eduos_db'
  });
  
  try {
    await client.connect();
    
    // Check required tables
    const tables = ['tenants', 'tenant_quotas', 'audit_logs', 'students'];
    
    for (const table of tables) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [table]
      );
      
      if (result.rows[0].exists) {
        log(`  ✓ Table '${table}' exists`, 'green');
      } else {
        log(`  ✗ Table '${table}' missing`, 'red');
      }
    }
    
    await client.end();
    log('\n✓ Setup verification complete', 'green');
    return true;
  } catch (error) {
    log('✗ Verification failed', 'red');
    log(`  Error: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  log('═══════════════════════════════════════════════════', 'cyan');
  log('   EduOS Platform - Automated Setup', 'cyan');
  log('═══════════════════════════════════════════════════', 'cyan');
  
  // Step 1: Check PostgreSQL
  const postgresOk = await checkPostgres();
  if (!postgresOk) {
    log('\n❌ Setup failed: PostgreSQL not available', 'red');
    process.exit(1);
  }
  
  // Step 2: Create database
  const dbOk = await createDatabase();
  if (!dbOk) {
    log('\n❌ Setup failed: Could not create database', 'red');
    process.exit(1);
  }
  
  // Step 3: Run migrations
  const migrationsOk = await runMigrations();
  if (!migrationsOk) {
    log('\n❌ Setup failed: Migrations failed', 'red');
    process.exit(1);
  }
  
  // Step 4: Verify setup
  const verifyOk = await verifySetup();
  if (!verifyOk) {
    log('\n⚠️  Setup completed with warnings', 'yellow');
  }
  
  log('\n═══════════════════════════════════════════════════', 'green');
  log('   ✅ Setup Complete!', 'green');
  log('═══════════════════════════════════════════════════', 'green');
  
  log('\n📝 Next steps:', 'cyan');
  log('  1. Start the server: npm run dev', 'cyan');
  log('  2. Run tests: npm test', 'cyan');
  log('  3. Create a tenant: curl -X POST http://localhost:3000/api/v1/tenants \\', 'cyan');
  log('     -H "Content-Type: application/json" \\', 'cyan');
  log('     -d \'{"name":"Test School","subdomain":"test-school","tier":"Basic"}\'', 'cyan');
  
  log('\n📚 Documentation:', 'cyan');
  log('  - API Docs: docs/TENANT_PROVISIONING_API.md', 'cyan');
  log('  - Setup Guide: docs/SETUP_GUIDE.md', 'cyan');
  log('  - Quick Start: QUICK_START_TENANT_API.md', 'cyan');
}

main().catch(error => {
  log('\n❌ Setup failed with error:', 'red');
  log(error.stack, 'red');
  process.exit(1);
});
