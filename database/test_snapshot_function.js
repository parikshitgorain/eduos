const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'eduos',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function test() {
  const client = await pool.connect();
  
  try {
    // Create test tenant
    const tenant = await client.query(
      `INSERT INTO tenants (name, subdomain, tier) VALUES ('Test', 'test', 'Basic') RETURNING tenant_id`
    );
    const tenantId = tenant.rows[0].tenant_id;
    
    // Create quota
    await client.query(
      `INSERT INTO tenant_quotas (tenant_id, max_students) VALUES ($1, 1000)`,
      [tenantId]
    );
    
    // Create students
    const student1 = await client.query(
      `INSERT INTO students (tenant_id, first_name, last_name) VALUES ($1, 'John', 'Doe') RETURNING student_id`,
      [tenantId]
    );
    const student2 = await client.query(
      `INSERT INTO students (tenant_id, first_name, last_name) VALUES ($1, 'Jane', 'Doe') RETURNING student_id`,
      [tenantId]
    );
    
    const primaryId = student1.rows[0].student_id;
    const secondaryId = student2.rows[0].student_id;
    
    console.log('Primary ID:', primaryId);
    console.log('Secondary ID:', secondaryId);
    
    // Test function call
    console.log('\nTesting function call...');
    const result = await client.query(
      `SELECT create_merge_snapshot($1::UUID, $2::UUID, $3::UUID[], $4::UUID) AS snapshot_id`,
      [tenantId, primaryId, [secondaryId], tenantId]
    );
    
    console.log('✅ Success! Snapshot ID:', result.rows[0].snapshot_id);
    
    // Clean up
    await client.query('DELETE FROM merge_snapshots WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM students WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM tenant_quotas WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM tenants WHERE tenant_id = $1', [tenantId]);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Detail:', error.detail);
  } finally {
    client.release();
    await pool.end();
  }
}

test();
