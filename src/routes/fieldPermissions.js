/**
 * Field Permissions Routes
 * 
 * Task: 2.2.3 - Create field-level permission system
 * 
 * Endpoints:
 * - POST /api/v1/schemas/:id/preview - Preview schema as specific role
 * - GET /api/v1/fields/:id/permissions - Get field permissions
 * - PUT /api/v1/fields/:id/permissions - Update field permissions
 * - POST /api/v1/fields/permissions/bulk - Bulk update field permissions
 * - GET /api/v1/fields/:id/permissions/user/:userId - Get user's effective permissions for a field
 */

const express = require('express');
const router = express.Router();
const fieldPermissionService = require('../services/fieldPermissionService');

/**
 * POST /api/v1/schemas/:id/preview
 * Preview schema as a specific role
 * 
 * Body:
 * {
 *   "role_name": "teacher",
 *   "access_type": "view" | "edit"
 * }
 */
router.post('/schemas/:id/preview', async (req, res) => {
  try {
    const { id: snapshotId } = req.params;
    const { role_name, access_type = 'view' } = req.body;
    const tenantId = req.tenantId; // From tenant context middleware
    
    if (!role_name) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'role_name is required'
      });
    }
    
    if (!['view', 'edit'].includes(access_type)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'access_type must be "view" or "edit"'
      });
    }
    
    const preview = await fieldPermissionService.previewSchemaAsRole(
      snapshotId,
      tenantId,
      role_name,
      access_type
    );
    
    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    console.error('Error previewing schema:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/fields/:id/permissions
 * Get field permissions
 */
router.get('/fields/:id/permissions', async (req, res) => {
  try {
    const { id: fieldId } = req.params;
    const tenantId = req.tenantId;
    
    const permissions = await fieldPermissionService.getFieldPermissions(fieldId, tenantId);
    
    res.json({
      success: true,
      data: {
        field_id: fieldId,
        permissions
      }
    });
  } catch (error) {
    console.error('Error getting field permissions:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * PUT /api/v1/fields/:id/permissions
 * Update field permissions
 * 
 * Body:
 * {
 *   "visible_to_roles": ["admin", "teacher"],
 *   "editable_by_roles": ["admin"]
 * }
 */
router.put('/fields/:id/permissions', async (req, res) => {
  try {
    const { id: fieldId } = req.params;
    const { visible_to_roles, editable_by_roles } = req.body;
    const tenantId = req.tenantId;
    const userId = req.userId; // From auth middleware
    
    if (!visible_to_roles || !editable_by_roles) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'visible_to_roles and editable_by_roles are required'
      });
    }
    
    const permissions = {
      visible_to_roles,
      editable_by_roles
    };
    
    const updated = await fieldPermissionService.updateFieldPermissions(
      fieldId,
      tenantId,
      permissions,
      userId
    );
    
    res.json({
      success: true,
      data: {
        field_id: updated.field_id,
        field_name: updated.field_name,
        permissions: updated.permissions
      }
    });
  } catch (error) {
    console.error('Error updating field permissions:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }
    
    if (error.message.includes('Validation failed')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/fields/permissions/bulk
 * Bulk update field permissions
 * 
 * Body:
 * {
 *   "snapshot_id": "uuid",
 *   "field_permissions": [
 *     {
 *       "field_id": "uuid",
 *       "permissions": {
 *         "visible_to_roles": ["admin", "teacher"],
 *         "editable_by_roles": ["admin"]
 *       }
 *     }
 *   ]
 * }
 */
router.post('/fields/permissions/bulk', async (req, res) => {
  try {
    const { snapshot_id, field_permissions } = req.body;
    const tenantId = req.tenantId;
    const userId = req.userId;
    
    if (!snapshot_id || !field_permissions || !Array.isArray(field_permissions)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'snapshot_id and field_permissions array are required'
      });
    }
    
    const results = await fieldPermissionService.bulkUpdateFieldPermissions(
      snapshot_id,
      tenantId,
      field_permissions,
      userId
    );
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error bulk updating field permissions:', error);
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/fields/:id/permissions/user/:userId
 * Get user's effective permissions for a field
 */
router.get('/fields/:id/permissions/user/:userId', async (req, res) => {
  try {
    const { id: fieldId, userId } = req.params;
    const tenantId = req.tenantId;
    
    const permissions = await fieldPermissionService.getUserFieldPermissions(
      userId,
      tenantId,
      fieldId
    );
    
    res.json({
      success: true,
      data: permissions
    });
  } catch (error) {
    console.error('Error getting user field permissions:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/fields/permissions/validate-hierarchy
 * Validate permission hierarchy
 * 
 * Body:
 * {
 *   "parent_permissions": {
 *     "visible_to_roles": ["admin", "teacher", "student"],
 *     "editable_by_roles": ["admin", "teacher"]
 *   },
 *   "child_permissions": {
 *     "visible_to_roles": ["admin", "teacher"],
 *     "editable_by_roles": ["admin"]
 *   }
 * }
 */
router.post('/fields/permissions/validate-hierarchy', async (req, res) => {
  try {
    const { parent_permissions, child_permissions } = req.body;
    
    if (!parent_permissions || !child_permissions) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'parent_permissions and child_permissions are required'
      });
    }
    
    const validation = fieldPermissionService.validatePermissionHierarchy(
      parent_permissions,
      child_permissions
    );
    
    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    console.error('Error validating permission hierarchy:', error);
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;
