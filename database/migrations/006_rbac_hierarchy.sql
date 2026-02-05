-- ============================================================================
-- Migration 006: Hierarchical Role-Based Access Control (RBAC)
-- ============================================================================
-- Description: Implement hierarchical RBAC with permission inheritance
-- Author: EduOS Team
-- Date: 2026-02-05
-- Task: 1.3.2 - Implement hierarchical role-based access control (RBAC)
-- ============================================================================

-- ============================================================================
-- PERMISSIONS TABLE
-- ============================================================================
-- Stores individual permissions that can be assigned to roles
-- ============================================================================

CREATE TABLE IF NOT EXISTS permissions (
  permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_name VARCHAR(100) NOT NULL UNIQUE,
  resource_type VARCHAR(100) NOT NULL, -- 'student', 'enrollment', 'attendance', etc.
  action VARCHAR(50) NOT NULL, -- 'read', 'write', 'delete', 'approve'
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT permissions_name_unique UNIQUE (permission_name)
);

-- Create indexes for permissions table
CREATE INDEX idx_permissions_resource_type ON permissions(resource_type);
CREATE INDEX idx_permissions_action ON permissions(action);

-- ============================================================================
-- ROLE_PERMISSIONS TABLE
-- ============================================================================
-- Junction table linking roles to permissions
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_permissions (
  role_permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT role_permissions_unique UNIQUE (role_id, permission_id)
);

-- Create indexes for role_permissions table
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

-- ============================================================================
-- USER_ROLES TABLE
-- ============================================================================
-- Junction table linking users to roles
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
  user_role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT user_roles_unique UNIQUE (user_id, role_id, tenant_id)
);

-- Create indexes for user_roles table
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_user_roles_tenant_id ON user_roles(tenant_id);

-- Enable Row-Level Security on user_roles table
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: User roles can only be accessed by users in the same tenant
CREATE POLICY tenant_isolation_user_roles ON user_roles
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- FIELD_PERMISSIONS TABLE
-- ============================================================================
-- Stores field-level permissions for dynamic forms
-- ============================================================================

CREATE TABLE IF NOT EXISTS field_permissions (
  field_permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
  field_name VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100) NOT NULL, -- 'student', 'enrollment', etc.
  can_read BOOLEAN DEFAULT FALSE,
  can_write BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT field_permissions_unique UNIQUE (tenant_id, role_id, field_name, resource_type)
);

-- Create indexes for field_permissions table
CREATE INDEX idx_field_permissions_tenant_id ON field_permissions(tenant_id);
CREATE INDEX idx_field_permissions_role_id ON field_permissions(role_id);
CREATE INDEX idx_field_permissions_resource_type ON field_permissions(resource_type);

-- Enable Row-Level Security on field_permissions table
ALTER TABLE field_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Field permissions can only be accessed by users in the same tenant
CREATE POLICY tenant_isolation_field_permissions ON field_permissions
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get all permissions for a user (including inherited permissions)
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID, p_tenant_id UUID)
RETURNS TABLE (
  permission_name VARCHAR,
  resource_type VARCHAR,
  action VARCHAR,
  role_name VARCHAR,
  hierarchy_level INTEGER
) AS $
DECLARE
  v_role_id UUID;
  v_parent_role_id UUID;
  v_hierarchy_level INTEGER;
BEGIN
  -- Create temporary table to store all roles (including inherited)
  CREATE TEMP TABLE IF NOT EXISTS temp_user_roles (
    role_id UUID,
    role_name VARCHAR,
    hierarchy_level INTEGER
  ) ON COMMIT DROP;

  -- Get direct roles for the user
  FOR v_role_id, v_hierarchy_level IN
    SELECT r.role_id, r.hierarchy_level
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.role_id
    WHERE ur.user_id = p_user_id AND ur.tenant_id = p_tenant_id
  LOOP
    -- Insert the role
    INSERT INTO temp_user_roles (role_id, role_name, hierarchy_level)
    SELECT r.role_id, r.role_name, r.hierarchy_level
    FROM roles r
    WHERE r.role_id = v_role_id;

    -- Get parent roles (permission inheritance)
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

  -- Return all permissions from all roles (direct + inherited)
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
$ LANGUAGE plpgsql;

-- Function to check if a user has a specific permission
CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id UUID,
  p_tenant_id UUID,
  p_permission_name VARCHAR
)
RETURNS BOOLEAN AS $
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
$ LANGUAGE plpgsql;

-- Function to get field-level permissions for a user
CREATE OR REPLACE FUNCTION get_user_field_permissions(
  p_user_id UUID,
  p_tenant_id UUID,
  p_resource_type VARCHAR
)
RETURNS TABLE (
  field_name VARCHAR,
  can_read BOOLEAN,
  can_write BOOLEAN
) AS $
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
$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on field_permissions table
CREATE TRIGGER update_field_permissions_updated_at
  BEFORE UPDATE ON field_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA - Default Permissions
-- ============================================================================

-- Insert default permissions
INSERT INTO permissions (permission_name, resource_type, action, description) VALUES
  -- Student permissions
  ('student:read', 'student', 'read', 'View student information'),
  ('student:write', 'student', 'write', 'Create and update student information'),
  ('student:delete', 'student', 'delete', 'Delete student records'),
  
  -- Enrollment permissions
  ('enrollment:read', 'enrollment', 'read', 'View enrollment information'),
  ('enrollment:write', 'enrollment', 'write', 'Create and update enrollments'),
  ('enrollment:delete', 'enrollment', 'delete', 'Delete enrollments'),
  
  -- Attendance permissions
  ('attendance:read', 'attendance', 'read', 'View attendance records'),
  ('attendance:write', 'attendance', 'write', 'Mark attendance'),
  ('attendance:approve', 'attendance', 'approve', 'Approve attendance records'),
  
  -- Payment permissions
  ('payment:read', 'payment', 'read', 'View payment information'),
  ('payment:write', 'payment', 'write', 'Process payments'),
  ('payment:refund', 'payment', 'refund', 'Process refunds'),
  
  -- User management permissions
  ('user:read', 'user', 'read', 'View user information'),
  ('user:write', 'user', 'write', 'Create and update users'),
  ('user:delete', 'user', 'delete', 'Delete users'),
  
  -- Role management permissions
  ('role:read', 'role', 'read', 'View roles'),
  ('role:write', 'role', 'write', 'Create and update roles'),
  ('role:assign', 'role', 'assign', 'Assign roles to users'),
  
  -- Tenant management permissions
  ('tenant:read', 'tenant', 'read', 'View tenant information'),
  ('tenant:write', 'tenant', 'write', 'Update tenant settings'),
  ('tenant:delete', 'tenant', 'delete', 'Delete tenants'),
  
  -- Report permissions
  ('report:read', 'report', 'read', 'View reports'),
  ('report:export', 'report', 'export', 'Export reports'),
  
  -- Audit permissions
  ('audit:read', 'audit', 'read', 'View audit logs')
ON CONFLICT (permission_name) DO NOTHING;

-- ============================================================================
-- SEED DATA - Default Role Hierarchy
-- ============================================================================
-- Note: These are template roles. Actual roles should be created per tenant
-- during tenant provisioning.
-- ============================================================================

-- Function to create default roles for a tenant
CREATE OR REPLACE FUNCTION create_default_roles(p_tenant_id UUID)
RETURNS VOID AS $
DECLARE
  v_super_admin_role_id UUID;
  v_institute_admin_role_id UUID;
  v_center_admin_role_id UUID;
  v_teacher_role_id UUID;
  v_student_role_id UUID;
BEGIN
  -- Create SuperAdmin role (hierarchy level 0)
  INSERT INTO roles (tenant_id, role_name, display_name, description, hierarchy_level)
  VALUES (
    p_tenant_id,
    'super_admin',
    'Super Administrator',
    'Full system access with all permissions',
    0
  )
  RETURNING role_id INTO v_super_admin_role_id;

  -- Assign all permissions to SuperAdmin
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_super_admin_role_id, permission_id
  FROM permissions;

  -- Create InstituteAdmin role (hierarchy level 1)
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

  -- Assign permissions to InstituteAdmin
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

  -- Create CenterAdmin role (hierarchy level 2)
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

  -- Assign permissions to CenterAdmin
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

  -- Create Teacher role (hierarchy level 3)
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

  -- Assign permissions to Teacher
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_teacher_role_id, permission_id
  FROM permissions
  WHERE permission_name IN (
    'student:read',
    'enrollment:read',
    'attendance:read', 'attendance:write',
    'report:read'
  );

  -- Create Student role (hierarchy level 4)
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

  -- Assign permissions to Student
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
$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant permissions to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON permissions TO eduos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON role_permissions TO eduos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_roles TO eduos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON field_permissions TO eduos_app;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE permissions IS 'Individual permissions that can be assigned to roles';
COMMENT ON TABLE role_permissions IS 'Junction table linking roles to permissions';
COMMENT ON TABLE user_roles IS 'Junction table linking users to roles';
COMMENT ON TABLE field_permissions IS 'Field-level permissions for dynamic forms';
COMMENT ON FUNCTION get_user_permissions IS 'Get all permissions for a user including inherited permissions';
COMMENT ON FUNCTION user_has_permission IS 'Check if a user has a specific permission';
COMMENT ON FUNCTION get_user_field_permissions IS 'Get field-level permissions for a user';
COMMENT ON FUNCTION create_default_roles IS 'Create default role hierarchy for a tenant';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $
BEGIN
  RAISE NOTICE 'Migration 006: Hierarchical RBAC - COMPLETED';
  RAISE NOTICE 'Created tables: permissions, role_permissions, user_roles, field_permissions';
  RAISE NOTICE 'Created functions: get_user_permissions, user_has_permission, get_user_field_permissions, create_default_roles';
  RAISE NOTICE 'Role hierarchy: SuperAdmin → InstituteAdmin → CenterAdmin → Teacher → Student';
END $;
