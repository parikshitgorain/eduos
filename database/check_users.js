const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'eduos_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function checkUsers() {
  try {
    console.log('🔍 Checking database users...\n');
    
    // Check if eduos_app user exists
    const users = await pool.query(`
      SELECT usename, usesuper, usecreatedb 
      FROM pg_user 
      WHERE usename IN ('postgres', 'eduos_app')
    `);
    
    console.log('Users:', JSON.stringify(users.rows, null, 2));
    
    // Check current user
    const currentUser = await pool.query('SELECT current_user');
    console.log('\nCurrent user:', currentUser.rows[0].current_user);
    
    // Check if current user bypasses RLS
    const bypassRLS = await pool.query(`
      SELECT rolname, rolbypassrls 
      FROM pg_roles 
      WHERE rolname = current_user
    `);
    console.log('Bypasses RLS:', bypassRLS.rows[0]);
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkUsers();
