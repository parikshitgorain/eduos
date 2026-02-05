/**
 * Check audit_logs table schema
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'eduos_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkSchema() {
  const client = await pool.connect();
  
  try {
    console.log('Checking audit_logs table schema...\n');

    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'audit_logs'
      ORDER BY ordinal_position;
    `);

    console.log('Columns in audit_logs table:');
    console.log('----------------------------');
    result.rows.forEach(row => {
      console.log(`${row.column_name.padEnd(20)} ${row.data_type.padEnd(30)} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema();
