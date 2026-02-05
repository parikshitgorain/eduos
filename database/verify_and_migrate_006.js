/**
 * Verify database state and run migration 006
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

async function verifyAndMigrate() {
  const client = await pool.connect();
  
  try {
    console.log('Verifying database state...\n');

    // Check if roles table exists
    const rolesCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'roles'
      );
    `);
    console.log('✓ Roles table exists:', rolesCheck.rows[0].exists);

    // Check if permissions table exists
    const permissionsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'permissions'
      );
    `);
    console.log('✓ Permissions table exists:', permissionsCheck.rows[0].exists);

    if (permissionsCheck.rows[0].exists) {
      console.log('\n⚠ Migration 006 appears to be already applied.');
      console.log('Checking functions...\n');
      
      // Check if functions exist
      const functionsCheck = await client.query(`
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name IN ('get_user_permissions', 'user_has_permission', 'get_user_field_permissions', 'create_default_roles')
        ORDER BY routine_name;
      `);
      
      console.log('Functions found:', functionsCheck.rows.map(r => r.routine_name));
      
      if (functionsCheck.rows.length === 4) {
        console.log('\n✓ All RBAC functions exist. Migration 006 is complete.');
      } else {
        console.log('\n⚠ Some functions are missing. Need to create them.');
      }
      
      return;
    }

    console.log('\nStarting migration 006...\n');

    // Create tables
    console.log('Creating permissions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        permission_name VARCHAR(100) NOT NULL UNIQUE,
        resource_type VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT permissions_name_unique UNIQUE (permission_name)
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_permissions_resource_type ON permissions(resource_type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);`);
    console.log('✓ Permissions table created');

    console.log('Creating role_permissions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
        permission_id UUID NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
        granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        granted_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
        CONSTRAINT role_permissions_unique UNIQUE (role_id, permission_id)
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);`);
    console.log('✓ Role_permissions table created');

    console.log('Creating user_roles table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        assigned_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
        CONSTRAINT user_roles_unique UNIQUE (user_id, role_id, tenant_id)
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_id ON user_roles(tenant_id);`);
    
    await client.query(`ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DROP POLICY IF EXISTS tenant_isolation_user_roles ON user_roles;
      CREATE POLICY tenant_isolation_user_roles ON user_roles
        USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    `);
    console.log('✓ User_roles table created');

    console.log('Creating field_permissions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS field_permissions (
        field_permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
        field_name VARCHAR(255) NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        can_read BOOLEAN DEFAULT FALSE,
        can_write BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT field_permissions_unique UNIQUE (tenant_id, role_id, field_name, resource_type)
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_field_permissions_tenant_id ON field_permissions(tenant_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_field_permissions_role_id ON field_permissions(role_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_field_permissions_resource_type ON field_permissions(resource_type);`);
    
    await client.query(`ALTER TABLE field_permissions ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DROP POLICY IF EXISTS tenant_isolation_field_permissions ON field_permissions;
      CREATE POLICY tenant_isolation_field_permissions ON field_permissions
        USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    `);
    console.log('✓ Field_permissions table created');

    // Insert default permissions
    console.log('Inserting default permissions...');
    await client.query(`
      INSERT INTO permissions (permission_name, resource_type, action, description) VALUES
        ('student:read', 'student', 'read', 'View student information'),
        ('student:write', 'student', 'write', 'Create and update student information'),
        ('student:delete', 'student', 'delete', 'Delete student records'),
        ('enrollment:read', 'enrollment', 'read', 'View enrollment information'),
        ('enrollment:write', 'enrollment', 'write', 'Create and update enrollments'),
        ('enrollment:delete', 'enrollment', 'delete', 'Delete enrollments'),
        ('attendance:read', 'attendance', 'read', 'View attendance records'),
        ('attendance:write', 'attendance', 'write', 'Mark attendance'),
        ('attendance:approve', 'attendance', 'approve', 'Approve attendance records'),
        ('payment:read', 'payment', 'read', 'View payment information'),
        ('payment:write', 'payment', 'write', 'Process payments'),
        ('payment:refund', 'payment', 'refund', 'Process refunds'),
        ('user:read', 'user', 'read', 'View user information'),
        ('user:write', 'user', 'write', 'Create and update users'),
        ('user:delete', 'user', 'delete', 'Delete users'),
        ('role:read', 'role', 'read', 'View roles'),
        ('role:write', 'role', 'write', 'Create and update roles'),
        ('role:assign', 'role', 'assign', 'Assign roles to users'),
        ('tenant:read', 'tenant', 'read', 'View tenant information'),
        ('tenant:write', 'tenant', 'write', 'Update tenant settings'),
        ('tenant:delete', 'tenant', 'delete', 'Delete tenants'),
        ('report:read', 'report', 'read', 'View reports'),
        ('report:export', 'report', 'export', 'Export reports'),
        ('audit:read', 'audit', 'read', 'View audit logs')
      ON CONFLICT (permission_name) DO NOTHING;
    `);
    console.log('✓ Default permissions inserted');

    // Record migration
    await client.query(`
      INSERT INTO schema_migrations (migration_name, applied_at)
      VALUES ('006_rbac_hierarchy.sql', NOW())
      ON CONFLICT (migration_name) DO NOTHING;
    `);

    console.log('\n✓ Migration 006 completed successfully!');
    console.log('\nNote: PostgreSQL functions need to be created separately.');
    console.log('Run: node database/create_rbac_functions.js');

  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

verifyAndMigrate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
