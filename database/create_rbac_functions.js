/**
 * Create RBAC PostgreSQL functions
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

async function createFunctions() {
  const client = await pool.connect();
  
  try {
    console.log('Creating RBAC functions...\n');

    // Function 1: get_user_permissions
    console.log('Creating get_user_permissions function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID, p_tenant_id UUID)
      RETURNS TABLE (
        permission_name VARCHAR,
        resource_type VARCHAR,
        action VARCHAR,
        role_name VARCHAR,
        hierarchy_level INTEGER
      ) AS $$
      DECLARE
        v_role_id UUID;
        v_parent_role_id UUID;
        v_hierarchy_level INTEGER;
      BEGIN
        CREATE TEMP TABLE IF NOT EXISTS temp_user_roles (
          role_id UUID,
          role_name VARCHAR,
          hierarchy_level INTEGER
        ) ON COMMIT DROP;

        FOR v_role_id, v_hierarchy_level IN
          SELECT r.role_id, r.hierarchy_level
          FROM user_roles ur
          JOIN roles r ON ur.role_id = r.role_id
          WHERE ur.user_id = p_user_id AND ur.tenant_id = p_tenant_id
        LOOP
          INSERT INTO temp_user_roles (role_id, role_name, hierarchy_level)
          SELECT r.role_id, r.role_name, r.hierarchy_level
          FROM roles r
          WHERE r.role_id = v_role_id;

          v_parent_role_id := v_role_id;
          WHILE v_parent_role_id IS NOT NULL LOOP
            SELECT r.parent_role_id INTO v_parent_role_id
            FROM roles r
            WHERE r.role_id = v_parent_role_id;

            IF v_parent_role_id IS NOT NULL THEN
              INSERT INTO temp_user_roles (role_id, role_name, hierarchy_level)
              SELECT r.role_id, r.role_name, r.hierarchy_level
              FROM roles r
              WHERE r.role_id = v_parent_role_id
              ON CONFLICT DO NOTHING;
            END IF;
          END LOOP;
        END LOOP;

        RETURN QUERY
        SELECT DISTINCT
          p.permission_name,
          p.resource_type,
          p.action,
          tur.role_name,
          tur.hierarchy_level
        FROM temp_user_roles tur
        JOIN role_permissions rp ON tur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.permission_id
        ORDER BY tur.hierarchy_level ASC, p.resource_type, p.action;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✓ get_user_permissions created');

    // Function 2: user_has_permission
    console.log('Creating user_has_permission function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION user_has_permission(
        p_user_id UUID,
        p_tenant_id UUID,
        p_permission_name VARCHAR
      )
      RETURNS BOOLEAN AS $$
      DECLARE
        v_has_permission BOOLEAN;
      BEGIN
        SELECT EXISTS (
          SELECT 1
          FROM get_user_permissions(p_user_id, p_tenant_id) up
          WHERE up.permission_name = p_permission_name
        ) INTO v_has_permission;

        RETURN v_has_permission;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✓ user_has_permission created');

    // Function 3: get_user_field_permissions
    console.log('Creating get_user_field_permissions function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION get_user_field_permissions(
        p_user_id UUID,
        p_tenant_id UUID,
        p_resource_type VARCHAR
      )
      RETURNS TABLE (
        field_name VARCHAR,
        can_read BOOLEAN,
        can_write BOOLEAN
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT DISTINCT ON (fp.field_name)
          fp.field_name,
          fp.can_read,
          fp.can_write
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.role_id
        JOIN field_permissions fp ON r.role_id = fp.role_id
        WHERE ur.user_id = p_user_id
          AND ur.tenant_id = p_tenant_id
          AND fp.tenant_id = p_tenant_id
          AND fp.resource_type = p_resource_type
        ORDER BY fp.field_name, r.hierarchy_level ASC;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✓ get_user_field_permissions created');

    // Function 4: create_default_roles
    console.log('Creating create_default_roles function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION create_default_roles(p_tenant_id UUID)
      RETURNS VOID AS $$
      DECLARE
        v_super_admin_role_id UUID;
        v_institute_admin_role_id UUID;
        v_center_admin_role_id UUID;
        v_teacher_role_id UUID;
        v_student_role_id UUID;
      BEGIN
        INSERT INTO roles (tenant_id, role_name, display_name, description, hierarchy_level)
        VALUES (
          p_tenant_id,
          'super_admin',
          'Super Administrator',
          'Full system access with all permissions',
          0
        )
        RETURNING role_id INTO v_super_admin_role_id;

        INSERT INTO role_permissions (role_id, permission_id)
        SELECT v_super_admin_role_id, permission_id
        FROM permissions;

        INSERT INTO roles (tenant_id, role_name, display_name, description, parent_role_id, hierarchy_level)
        VALUES (
          p_tenant_id,
          'institute_admin',
          'Institute Administrator',
          'Manage institution-level settings and users',
          v_super_admin_role_id,
          1
        )
        RETURNING role_id INTO v_institute_admin_role_id;

        INSERT INTO role_permissions (role_id, permission_id)
        SELECT v_institute_admin_role_id, permission_id
        FROM permissions
        WHERE permission_name IN (
          'student:read', 'student:write',
          'enrollment:read', 'enrollment:write',
          'attendance:read', 'attendance:write', 'attendance:approve',
          'payment:read', 'payment:write',
          'user:read', 'user:write',
          'role:read', 'role:assign',
          'report:read', 'report:export',
          'audit:read'
        );

        INSERT INTO roles (tenant_id, role_name, display_name, description, parent_role_id, hierarchy_level)
        VALUES (
          p_tenant_id,
          'center_admin',
          'Center Administrator',
          'Manage center-level operations',
          v_institute_admin_role_id,
          2
        )
        RETURNING role_id INTO v_center_admin_role_id;

        INSERT INTO role_permissions (role_id, permission_id)
        SELECT v_center_admin_role_id, permission_id
        FROM permissions
        WHERE permission_name IN (
          'student:read', 'student:write',
          'enrollment:read', 'enrollment:write',
          'attendance:read', 'attendance:write',
          'payment:read',
          'user:read',
          'report:read', 'report:export'
        );

        INSERT INTO roles (tenant_id, role_name, display_name, description, parent_role_id, hierarchy_level)
        VALUES (
          p_tenant_id,
          'teacher',
          'Teacher',
          'Manage classes and student attendance',
          v_center_admin_role_id,
          3
        )
        RETURNING role_id INTO v_teacher_role_id;

        INSERT INTO role_permissions (role_id, permission_id)
        SELECT v_teacher_role_id, permission_id
        FROM permissions
        WHERE permission_name IN (
          'student:read',
          'enrollment:read',
          'attendance:read', 'attendance:write',
          'report:read'
        );

        INSERT INTO roles (tenant_id, role_name, display_name, description, parent_role_id, hierarchy_level)
        VALUES (
          p_tenant_id,
          'student',
          'Student',
          'View own academic information',
          v_teacher_role_id,
          4
        )
        RETURNING role_id INTO v_student_role_id;

        INSERT INTO role_permissions (role_id, permission_id)
        SELECT v_student_role_id, permission_id
        FROM permissions
        WHERE permission_name IN (
          'student:read',
          'enrollment:read',
          'attendance:read'
        );

        RAISE NOTICE 'Created default roles for tenant %', p_tenant_id;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✓ create_default_roles created');

    // Create trigger for field_permissions
    console.log('Creating trigger for field_permissions...');
    await client.query(`
      CREATE OR REPLACE TRIGGER update_field_permissions_updated_at
        BEFORE UPDATE ON field_permissions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✓ Trigger created');

    // Grant permissions
    console.log('Granting permissions to eduos_app...');
    await client.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON permissions TO eduos_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON role_permissions TO eduos_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON user_roles TO eduos_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON field_permissions TO eduos_app;
    `);
    console.log('✓ Permissions granted');

    console.log('\n✓ All RBAC functions created successfully!');

  } catch (error) {
    console.error('\n✗ Function creation failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createFunctions()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
