/**
 * EduOS Platform - Role-Based Access Control (RBAC) Service
 * 
 * Hierarchical RBAC with permission inheritance
 * Role hierarchy: SuperAdmin → InstituteAdmin → CenterAdmin → Teacher → Student
 */

const { query } = require('../config/database');

class RBACService {
  /**
   * Get all permissions for a user (including inherited permissions)
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @returns {Array} Array of permissions
   */
  async getUserPermissions(userId, tenantId) {
    try {
      const result = await query(
        'SELECT * FROM get_user_permissions($1, $2)',
        [userId, tenantId]
      );

      return result.rows.map(row => ({
        permissionName: row.permission_name,
        resourceType: row.resource_type,
        action: row.action,
        roleName: row.role_name,
        hierarchyLevel: row.hierarchy_level,
      }));
    } catch (error) {
      console.error('Error getting user permissions:', error);
      throw error;
    }
  }

  /**
   * Check if a user has a specific permission
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @param {string} permissionName - Permission name (e.g., 'student:read')
   * @returns {boolean} True if user has permission
   */
  async userHasPermission(userId, tenantId, permissionName) {
    try {
      const result = await query(
        'SELECT user_has_permission($1, $2, $3) as has_permission',
        [userId, tenantId, permissionName]
      );

      return result.rows[0].has_permission;
    } catch (error) {
      console.error('Error checking user permission:', error);
      throw error;
    }
  }

  /**
   * Get field-level permissions for a user
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @param {string} resourceType - Resource type (e.g., 'student')
   * @returns {Array} Array of field permissions
   */
  async getUserFieldPermissions(userId, tenantId, resourceType) {
    try {
      const result = await query(
        'SELECT * FROM get_user_field_permissions($1, $2, $3)',
        [userId, tenantId, resourceType]
      );

      return result.rows.map(row => ({
        fieldName: row.field_name,
        canRead: row.can_read,
        canWrite: row.can_write,
      }));
    } catch (error) {
      console.error('Error getting user field permissions:', error);
      throw error;
    }
  }

  /**
   * Get all roles for a user
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @returns {Array} Array of roles
   */
  async getUserRoles(userId, tenantId) {
    try {
      const result = await query(
        `SELECT r.role_id, r.role_name, r.display_name, r.description, 
                r.hierarchy_level, r.parent_role_id
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.role_id
         WHERE ur.user_id = $1 AND ur.tenant_id = $2
         ORDER BY r.hierarchy_level ASC`,
        [userId, tenantId]
      );

      return result.rows.map(row => ({
        roleId: row.role_id,
        roleName: row.role_name,
        displayName: row.display_name,
        description: row.description,
        hierarchyLevel: row.hierarchy_level,
        parentRoleId: row.parent_role_id,
      }));
    } catch (error) {
      console.error('Error getting user roles:', error);
      throw error;
    }
  }

  /**
   * Assign a role to a user
   * @param {string} userId - User ID
   * @param {string} roleId - Role ID
   * @param {string} tenantId - Tenant ID
   * @param {string} assignedBy - User ID of the person assigning the role
   * @returns {Object} Created user role
   */
  async assignRoleToUser(userId, roleId, tenantId, assignedBy) {
    try {
      // Check if role exists and belongs to tenant
      const roleResult = await query(
        'SELECT role_id, role_name FROM roles WHERE role_id = $1 AND tenant_id = $2',
        [roleId, tenantId]
      );

      if (roleResult.rowCount === 0) {
        throw new Error('Role not found or does not belong to tenant');
      }

      // Check if user already has this role
      const existingResult = await query(
        'SELECT user_role_id FROM user_roles WHERE user_id = $1 AND role_id = $2 AND tenant_id = $3',
        [userId, roleId, tenantId]
      );

      if (existingResult.rowCount > 0) {
        throw new Error('User already has this role');
      }

      // Assign role to user
      const result = await query(
        `INSERT INTO user_roles (user_id, role_id, tenant_id, assigned_by)
         VALUES ($1, $2, $3, $4)
         RETURNING user_role_id, user_id, role_id, tenant_id, assigned_at`,
        [userId, roleId, tenantId, assignedBy]
      );

      // Log the role assignment
      await query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          tenantId,
          assignedBy,
          'role_assigned',
          'user_role',
          result.rows[0].user_role_id,
          JSON.stringify({
            target_user_id: userId,
            role_id: roleId,
            role_name: roleResult.rows[0].role_name,
          }),
        ]
      );

      return {
        userRoleId: result.rows[0].user_role_id,
        userId: result.rows[0].user_id,
        roleId: result.rows[0].role_id,
        tenantId: result.rows[0].tenant_id,
        assignedAt: result.rows[0].assigned_at,
      };
    } catch (error) {
      console.error('Error assigning role to user:', error);
      throw error;
    }
  }

  /**
   * Remove a role from a user
   * @param {string} userId - User ID
   * @param {string} roleId - Role ID
   * @param {string} tenantId - Tenant ID
   * @param {string} removedBy - User ID of the person removing the role
   * @returns {boolean} True if role was removed
   */
  async removeRoleFromUser(userId, roleId, tenantId, removedBy) {
    try {
      // Get role name for audit log
      const roleResult = await query(
        'SELECT role_name FROM roles WHERE role_id = $1',
        [roleId]
      );

      // Remove role from user
      const result = await query(
        'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2 AND tenant_id = $3 RETURNING user_role_id',
        [userId, roleId, tenantId]
      );

      if (result.rowCount === 0) {
        throw new Error('User role not found');
      }

      // Log the role removal
      await query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          tenantId,
          removedBy,
          'role_removed',
          'user_role',
          result.rows[0].user_role_id,
          JSON.stringify({
            target_user_id: userId,
            role_id: roleId,
            role_name: roleResult.rows[0]?.role_name,
          }),
        ]
      );

      return true;
    } catch (error) {
      console.error('Error removing role from user:', error);
      throw error;
    }
  }

  /**
   * Get all roles for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Array} Array of roles
   */
  async getTenantRoles(tenantId) {
    try {
      const result = await query(
        `SELECT role_id, role_name, display_name, description, 
                parent_role_id, hierarchy_level, created_at, updated_at
         FROM roles
         WHERE tenant_id = $1
         ORDER BY hierarchy_level ASC, role_name ASC`,
        [tenantId]
      );

      return result.rows.map(row => ({
        roleId: row.role_id,
        roleName: row.role_name,
        displayName: row.display_name,
        description: row.description,
        parentRoleId: row.parent_role_id,
        hierarchyLevel: row.hierarchy_level,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      console.error('Error getting tenant roles:', error);
      throw error;
    }
  }

  /**
   * Get role by ID
   * @param {string} roleId - Role ID
   * @param {string} tenantId - Tenant ID
   * @returns {Object} Role details
   */
  async getRoleById(roleId, tenantId) {
    try {
      const result = await query(
        `SELECT role_id, role_name, display_name, description, 
                parent_role_id, hierarchy_level, created_at, updated_at
         FROM roles
         WHERE role_id = $1 AND tenant_id = $2`,
        [roleId, tenantId]
      );

      if (result.rowCount === 0) {
        return null;
      }

      return {
        roleId: result.rows[0].role_id,
        roleName: result.rows[0].role_name,
        displayName: result.rows[0].display_name,
        description: result.rows[0].description,
        parentRoleId: result.rows[0].parent_role_id,
        hierarchyLevel: result.rows[0].hierarchy_level,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      };
    } catch (error) {
      console.error('Error getting role by ID:', error);
      throw error;
    }
  }

  /**
   * Get permissions for a role
   * @param {string} roleId - Role ID
   * @returns {Array} Array of permissions
   */
  async getRolePermissions(roleId) {
    try {
      const result = await query(
        `SELECT p.permission_id, p.permission_name, p.resource_type, 
                p.action, p.description
         FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.permission_id
         WHERE rp.role_id = $1
         ORDER BY p.resource_type, p.action`,
        [roleId]
      );

      return result.rows.map(row => ({
        permissionId: row.permission_id,
        permissionName: row.permission_name,
        resourceType: row.resource_type,
        action: row.action,
        description: row.description,
      }));
    } catch (error) {
      console.error('Error getting role permissions:', error);
      throw error;
    }
  }

  /**
   * Create default roles for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {boolean} True if roles were created
   */
  async createDefaultRoles(tenantId) {
    try {
      await query('SELECT create_default_roles($1)', [tenantId]);
      return true;
    } catch (error) {
      console.error('Error creating default roles:', error);
      throw error;
    }
  }

  /**
   * Set field-level permissions for a role
   * @param {string} roleId - Role ID
   * @param {string} tenantId - Tenant ID
   * @param {string} fieldName - Field name
   * @param {string} resourceType - Resource type
   * @param {boolean} canRead - Can read permission
   * @param {boolean} canWrite - Can write permission
   * @returns {Object} Created field permission
   */
  async setFieldPermission(roleId, tenantId, fieldName, resourceType, canRead, canWrite) {
    try {
      const result = await query(
        `INSERT INTO field_permissions (tenant_id, role_id, field_name, resource_type, can_read, can_write)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tenant_id, role_id, field_name, resource_type)
         DO UPDATE SET can_read = $5, can_write = $6, updated_at = NOW()
         RETURNING field_permission_id, field_name, resource_type, can_read, can_write`,
        [tenantId, roleId, fieldName, resourceType, canRead, canWrite]
      );

      return {
        fieldPermissionId: result.rows[0].field_permission_id,
        fieldName: result.rows[0].field_name,
        resourceType: result.rows[0].resource_type,
        canRead: result.rows[0].can_read,
        canWrite: result.rows[0].can_write,
      };
    } catch (error) {
      console.error('Error setting field permission:', error);
      throw error;
    }
  }

  /**
   * Get all available permissions
   * @returns {Array} Array of all permissions
   */
  async getAllPermissions() {
    try {
      const result = await query(
        `SELECT permission_id, permission_name, resource_type, action, description
         FROM permissions
         ORDER BY resource_type, action`
      );

      return result.rows.map(row => ({
        permissionId: row.permission_id,
        permissionName: row.permission_name,
        resourceType: row.resource_type,
        action: row.action,
        description: row.description,
      }));
    } catch (error) {
      console.error('Error getting all permissions:', error);
      throw error;
    }
  }
}

// Export singleton instance
const rbacService = new RBACService();

module.exports = rbacService;
