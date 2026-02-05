/**
 * Database Migration Runner
 * 
 * Runs SQL migration files in order
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'eduos_db',
  user: process.env.DB_USER || 'eduos_app',
  password: process.env.DB_PASSWORD,
});

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database migrations...');
    
    // Get list of migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql') && !f.includes('rollback'))
      .sort();
    
    for (const file of files) {
      const version = file.split('_')[0];
      
      // Check if migration already applied
      const checkResult = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      );
      
      if (checkResult.rowCount > 0) {
        console.log(`✓ Migration ${file} already applied, skipping...`);
        continue;
      }
      
      console.log(`Running migration: ${file}...`);
      
      // Read and execute migration file
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      await client.query(sql);
      
      console.log(`✓ Migration ${file} completed successfully`);
    }
    
    console.log('\nAll migrations completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
