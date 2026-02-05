/**
 * Field Permission Service
 * 
 * Task: 2.2.3 - Create field-level permission system
 * 
 * Features:
 * - Field-level permissions: visible_to_roles, editable_by_roles
 * - Permission inheritance hierarchy (Global → Institution → Center → Program → Class → Batch)
 * - Permission resolution algorithm
 * - Preview-as-role functionality
 */

const { query } = require('../config/database');

/**
 * Hierarchy levels for permission inheritance
 * Child levels can only restrict (never expand) parent permissions
 */
const HIERARCHY_LEVELS = {
  GLOBAL: 'global',
  INSTITUTION: 'institution',
  CENTER: 'center',
  PROGRAM: 'program',
  CLASS: 'class',
  BATCH: 'batch'
};

/**
 * Default permissions structure
 */
const DEFAULT_PERMISSIONS = {
  visible_to_roles: [],
  editable_by_roles: []
};

/**
 * Resolve field permissions based on hierarchy
 * Child levels can only restrict (never expand) parent permissions
 * 
 * @param {Object} globalPermissions - Global level permissions
 * @param {Array} hierarchyOverrides - Array of hierarchy-specific overrides
 * @returns {Object} Resolved permissions
 */
function resolveFieldPermissions(globalPermissions, hierarchyOverrides = []) {
  // Start with global permissions
  let visibleRoles = new Set(globalPermissions.visible_to_roles || []);
  let editableRoles = new Set(globalPermissions.editable_by_roles || []);
  
  // Apply hierarchy overrides in order (most restrictive wins)
  // Each level can only remove roles, not add them
  for (const override of hierarchyOverrides) {
    if (override.visible_to_roles) {
      // Intersection: keep only roles that are in both sets
      const overrideVisible = new Set(override.visible_to_roles);
      visibleRoles = new Set([...visibleRoles].filter(role => overrideVisible.has(role)));
    }
    
    if (override.editable_by_roles) {
      // Intersection: keep only roles that are in both sets
      const overrideEditable = new Set(override.editable_by_roles);
      editableRoles = new Set([...editableRoles].filter(role => overrideEditable.has(role)));
    }
  }
  
  // Ensure editable roles are a subset of visible roles
  editableRoles = new Set([...editableRoles].filter(role => visibleRoles.has(role)));
  
  return {
    visible_to_roles: Array.from(visibleRoles),
    editable_by_roles: Array.from(editableRoles)
  };
}

/**
 * Check if a user can view a field
 * 
 * @param {Object} fieldPermissions - Field permissions object
 * @param {Array} userRoles - Array of user role names
 * @returns {boolean} True if user can view the field
 */
function canViewField(fieldPermissions, userRoles) {
  if (!fieldPermissions || !fieldPermissions.visible_to_roles) {
    return false;
  }
  
  const visibleRoles = new Set(fieldPermissions.visible_to_roles);
  return userRoles.some(role => visibleRoles.has(role));
}

/**
 * Check if a user can edit a field
 * 
 * @param {Object} fieldPermissions - Field permissions object
 * @param {Array} userRoles - Array of user role names
 * @returns {boolean} True if user can edit the field
 */
function canEditField(fieldPermissions, userRoles) {
  if (!fieldPermissions || !fieldPermissions.editable_by_roles) {
    return false;
  }
  
  const editableRoles = new Set(fieldPermissions.editable_by_roles);
  return userRoles.some(role => editableRoles.has(role));
}

/**
 * Get user roles from database
 * 
 * @param {string} userId - User ID
 * @param {string} tenantId - Tenant ID
 * @returns {Array} Array of role names
 */
async function getUserRoleNames(userId, tenantId) {
  const sql = `
    SELECT r.role_name
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.role_id
    WHERE ur.user_id = $1 AND ur.tenant_id = $2
  `;
  
  const result = await query(sql, [userId, tenantId]);
  return result.rows.map(row => row.role_name);
}

/**
 * Filter fields based on user permissions
 * 
 * @param {Array} fields - Array of field definitions
 * @param {Array} userRoles - Array of user role names
 * @param {string} accessType - 'view' or 'edit'
 * @returns {Array} Filtered fields
 */
function filterFieldsByPermission(fields, userRoles, accessType = 'view') {
  return fields.filter(field => {
    const permissions = field.permissions || DEFAULT_PERMISSIONS;
    
    if (accessType === 'view') {
      return canViewField(permissions, userRoles);
    } else if (accessType === 'edit') {
      return canEditField(permissions, userRoles);
    }
    
    return false;
  });
}

/**
 * Get field permissions for a specific field
 * 
 * @param {string} fieldId - Field ID
 * @param {string} tenantId - Tenant ID
 * @returns {Object} Field permissions
 */
async function getFieldPermissions(fieldId, tenantId) {
  const sql = `
    SELECT permissions
    FROM field_definitions
    WHERE field_id = $1 AND tenant_id = $2
  `;
  
  const result = await query(sql, [fieldId, tenantId]);
  
  if (result.rows.length === 0) {
    throw new Error(`Field not found: ${fieldId}`);
  }
  
  return result.rows[0].permissions || DEFAULT_PERMISSIONS;
}

/**
 * Update field permissions
 * 
 * @param {string} fieldId - Field ID
 * @param {string} tenantId - Tenant ID
 * @param {Object} permissions - New permissions object
 * @param {string} updatedBy - User ID of the person updating permissions
 * @returns {Object} Updated field
 */
async function updateFieldPermissions(fieldId, tenantId, permissions, updatedBy) {
  // Validate permissions structure
  if (!permissions.visible_to_roles || !Array.isArray(permissions.visible_to_roles)) {
    throw new Error('Validation failed: visible_to_roles must be an array');
  }
  
  if (!permissions.editable_by_roles || !Array.isArray(permissions.editable_by_roles)) {
    throw new Error('Validation failed: editable_by_roles must be an array');
  }
  
  // Ensure editable roles are a subset of visible roles
  const visibleSet = new Set(permissions.visible_to_roles);
  const invalidEditableRoles = permissions.editable_by_roles.filter(role => !visibleSet.has(role));
  
  if (invalidEditableRoles.length > 0) {
    throw new Error(`Validation failed: editable_by_roles must be a subset of visible_to_roles. Invalid roles: ${invalidEditableRoles.join(', ')}`);
  }
  
  const sql = `
    UPDATE field_definitions
    SET permissions = $1
    WHERE field_id = $2 AND tenant_id = $3
    RETURNING *
  `;
  
  const result = await query(sql, [permissions, fieldId, tenantId]);
  
  if (result.rows.length === 0) {
    throw new Error(`Field not found: ${fieldId}`);
  }
  
  // Log the permission change
  await query(
    `INSERT INTO audit_logs (
      tenant_id, user_id, action, event_type, event_action,
      actor_type, actor_id, resource_type, resource_id, details
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      tenantId,
      updatedBy,
      'field_permissions_updated',
      'schema',
      'update',
      'user',
      updatedBy,
      'field_definition',
      fieldId,
      JSON.stringify({
        field_id: fieldId,
        new_permissions: permissions
      })
    ]
  );
  
  return result.rows[0];
}

/**
 * Preview schema as a specific role
 * Returns a filtered view of the schema showing only fields visible to that role
 * 
 * @param {string} snapshotId - Schema snapshot ID
 * @param {string} tenantId - Tenant ID
 * @param {string} roleName - Role name to preview as
 * @param {string} accessType - 'view' or 'edit'
 * @returns {Object} Filtered schema snapshot
 */
async function previewSchemaAsRole(snapshotId, tenantId, roleName, accessType = 'view') {
  // Get the schema snapshot
  const snapshotSql = `
    SELECT * FROM schema_snapshots
    WHERE snapshot_id = $1 AND tenant_id = $2
  `;
  
  const snapshotResult = await query(snapshotSql, [snapshotId, tenantId]);
  
  if (snapshotResult.rows.length === 0) {
    throw new Error(`Schema snapshot not found: ${snapshotId}`);
  }
  
  const snapshot = snapshotResult.rows[0];
  
  // Get all fields for this snapshot
  const fieldsSql = `
    SELECT * FROM field_definitions
    WHERE snapshot_id = $1
    ORDER BY display_order ASC, field_name ASC
  `;
  
  const fieldsResult = await query(fieldsSql, [snapshotId]);
  const allFields = fieldsResult.rows;
  
  // Filter fields based on role permissions
  const filteredFields = filterFieldsByPermission(allFields, [roleName], accessType);
  
  // Build the preview response
  return {
    snapshot_id: snapshot.snapshot_id,
    form_type: snapshot.form_type,
    semantic_version: snapshot.semantic_version,
    status: snapshot.status,
    preview_role: roleName,
    access_type: accessType,
    total_fields: allFields.length,
    visible_fields: filteredFields.length,
    fields: filteredFields.map(field => ({
      field_id: field.field_id,
      field_name: field.field_name,
      field_type: field.field_type,
      label: field.label,
      description: field.description,
      is_required: field.is_required,
      display_order: field.display_order,
      can_view: canViewField(field.permissions, [roleName]),
      can_edit: canEditField(field.permissions, [roleName]),
      permissions: field.permissions
    }))
  };
}

/**
 * Get effective permissions for a user on a specific field
 * 
 * @param {string} userId - User ID
 * @param {string} tenantId - Tenant ID
 * @param {string} fieldId - Field ID
 * @returns {Object} Effective permissions
 */
async function getUserFieldPermissions(userId, tenantId, fieldId) {
  // Get user roles
  const userRoles = await getUserRoleNames(userId, tenantId);
  
  // Get field permissions
  const fieldPermissions = await getFieldPermissions(fieldId, tenantId);
  
  return {
    field_id: fieldId,
    user_id: userId,
    user_roles: userRoles,
    can_view: canViewField(fieldPermissions, userRoles),
    can_edit: canEditField(fieldPermissions, userRoles),
    field_permissions: fieldPermissions
  };
}

/**
 * Bulk update permissions for multiple fields
 * 
 * @param {string} snapshotId - Schema snapshot ID
 * @param {string} tenantId - Tenant ID
 * @param {Array} fieldPermissions - Array of {field_id, permissions}
 * @param {string} updatedBy - User ID of the person updating permissions
 * @returns {Object} Update results
 */
async function bulkUpdateFieldPermissions(snapshotId, tenantId, fieldPermissions, updatedBy) {
  const results = {
    success: [],
    failed: []
  };
  
  for (const item of fieldPermissions) {
    try {
      const updated = await updateFieldPermissions(item.field_id, tenantId, item.permissions, updatedBy);
      results.success.push({
        field_id: item.field_id,
        field_name: updated.field_name
      });
    } catch (error) {
      results.failed.push({
        field_id: item.field_id,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Validate permission hierarchy
 * Ensures child level permissions are more restrictive than parent
 * 
 * @param {Object} parentPermissions - Parent level permissions
 * @param {Object} childPermissions - Child level permissions
 * @returns {Object} Validation result
 */
function validatePermissionHierarchy(parentPermissions, childPermissions) {
  const parentVisible = new Set(parentPermissions.visible_to_roles || []);
  const parentEditable = new Set(parentPermissions.editable_by_roles || []);
  
  const childVisible = new Set(childPermissions.visible_to_roles || []);
  const childEditable = new Set(childPermissions.editable_by_roles || []);
  
  // Check if child visible roles are a subset of parent visible roles
  const invalidVisible = [...childVisible].filter(role => !parentVisible.has(role));
  
  // Check if child editable roles are a subset of parent editable roles
  const invalidEditable = [...childEditable].filter(role => !parentEditable.has(role));
  
  const isValid = invalidVisible.length === 0 && invalidEditable.length === 0;
  
  return {
    is_valid: isValid,
    invalid_visible_roles: invalidVisible,
    invalid_editable_roles: invalidEditable,
    message: isValid 
      ? 'Permission hierarchy is valid' 
      : 'Child permissions cannot expand parent permissions'
  };
}

module.exports = {
  HIERARCHY_LEVELS,
  DEFAULT_PERMISSIONS,
  resolveFieldPermissions,
  canViewField,
  canEditField,
  getUserRoleNames,
  filterFieldsByPermission,
  getFieldPermissions,
  updateFieldPermissions,
  previewSchemaAsRole,
  getUserFieldPermissions,
  bulkUpdateFieldPermissions,
  validatePermissionHierarchy
};
