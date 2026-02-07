const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'eduos_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function checkRLSPolicy() {
  try {
    console.log('🔍 Checking RLS policies for merge_snapshots table...\n');
    
    // Check if RLS is enabled
    const rlsCheck = await pool.query(`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname = 'merge_snapshots'
    `);
    
    console.log('RLS Enabled:', rlsCheck.rows[0]);
    
    // Check policies
    const policies = await pool.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
      FROM pg_policies 
      WHERE tablename = 'merge_snapshots'
    `);
    
    console.log('\nPolicies:', JSON.stringify(policies.rows, null, 2));
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkRLSPolicy();
