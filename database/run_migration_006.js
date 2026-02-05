/**
 * Run migration 006 - RBAC Hierarchy
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/database');

async function runMigration() {
  try {
    console.log('Running migration 006: RBAC Hierarchy...');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '006_rbac_hierarchy.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await query(migrationSQL);

    console.log('✓ Migration 006 completed successfully');

    // Record the migration
    await query(
      `INSERT INTO schema_migrations (migration_name, applied_at)
       VALUES ($1, NOW())
       ON CONFLICT (migration_name) DO NOTHING`,
      ['006_rbac_hierarchy.sql']
    );

    console.log('✓ Migration recorded in schema_migrations table');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
