/**
 * Run migration 006 - RBAC Hierarchy (Split into parts)
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Create a direct pool connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'eduos_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Running migration 006: RBAC Hierarchy...');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '006_rbac_hierarchy.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolons but keep function bodies together
    const statements = [];
    let currentStatement = '';
    let inFunction = false;
    let dollarQuoteCount = 0;

    const lines = migrationSQL.split('\n');
    
    for (const line of lines) {
      currentStatement += line + '\n';
      
      // Track if we're inside a function (between $$ markers)
      const dollarMatches = line.match(/\$\$/g);
      if (dollarMatches) {
        dollarQuoteCount += dollarMatches.length;
      }
      
      inFunction = (dollarQuoteCount % 2) !== 0;
      
      // If we hit a semicolon and we're not in a function, it's the end of a statement
      if (line.trim().endsWith(';') && !inFunction) {
        if (currentStatement.trim() && !currentStatement.trim().startsWith('--')) {
          statements.push(currentStatement.trim());
        }
        currentStatement = '';
      }
    }

    // Add any remaining statement
    if (currentStatement.trim() && !currentStatement.trim().startsWith('--')) {
      statements.push(currentStatement.trim());
    }

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      
      // Skip comments and empty statements
      if (!stmt || stmt.startsWith('--') || stmt.trim() === '') {
        continue;
      }

      try {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        await client.query(stmt);
      } catch (error) {
        // Some statements might fail if objects already exist, that's okay
        if (error.code === '42P07' || error.code === '42710') {
          console.log(`  ⚠ Skipping (already exists): ${error.message}`);
        } else {
          console.error(`  ✗ Failed: ${error.message}`);
          throw error;
        }
      }
    }

    console.log('✓ Migration 006 completed successfully');

    // Record the migration
    await client.query(
      `INSERT INTO schema_migrations (migration_name, applied_at)
       VALUES ($1, NOW())
       ON CONFLICT (migration_name) DO NOTHING`,
      ['006_rbac_hierarchy.sql']
    );

    console.log('✓ Migration recorded in schema_migrations table');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
