/**
 * Field Permissions Routes Integration Tests
 * 
 * Task: 2.2.3 - Create field-level permission system
 */

const request = require('supertest');
const express = require('express');
const fieldPermissionsRouter = require('./fieldPermissions');
const fieldPermissionService = require('../services/fieldPermissionService');

// Mock the service
jest.mock('../services/fieldPermissionService');

// Create test app
const app = express();
app.use(express.json());

// Mock middleware to add tenantId and userId
app.use((req, res, next) => {
  req.tenantId = 'test-tenant-id';
  req.userId = 'test-user-id';
  next();
});

app.use('/api/v1', fieldPermissionsRouter);

describe('Field Permissions Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/schemas/:id/preview', () => {
    it('should preview schema as role successfully', async () => {
      const mockPreview = {
        snapshot_id: 'snapshot-1',
        form_type: 'student',
        semantic_version: 'v1.0.0',
        status: 'active',
        preview_role: 'teacher',
        access_type: 'view',
        total_fields: 5,
        visible_fields: 3,
        fields: [
          {
            field_id: '1',
            field_name: 'name',
            can_view: true,
            can_edit: true
          }
        ]
      };

      fieldPermissionService.previewSchemaAsRole.mockResolvedValue(mockPreview);

      const response = await request(app)
        .post('/api/v1/schemas/snapshot-1/preview')
        .send({
          role_name: 'teacher',
          access_type: 'view'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPreview);
      expect(fieldPermissionService.previewSchemaAsRole).toHaveBeenCalledWith(
        'snapshot-1',
        'test-tenant-id',
        'teacher',
        'view'
      );
    });

    it('should return 400 when role_name is missing', async () => {
      const response = await request(app)
        .post('/api/v1/schemas/snapshot-1/preview')
        .send({
          access_type: 'view'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('role_name is required');
    });

    it('should return 400 when access_type is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/schemas/snapshot-1/preview')
        .send({
          role_name: 'teacher',
          access_type: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('access_type must be "view" or "edit"');
    });

    it('should return 404 when snapshot not found', async () => {
      fieldPermissionService.previewSchemaAsRole.mockRejectedValue(
        new Error('Schema snapshot not found: snapshot-1')
      );

      const response = await request(app)
        .post('/api/v1/schemas/snapshot-1/preview')
        .send({
          role_name: 'teacher',
          access_type: 'view'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
    });

    it('should default to view access type', async () => {
      const mockPreview = {
        snapshot_id: 'snapshot-1',
        preview_role: 'teacher',
        access_type: 'view',
        fields: []
      };

      fieldPermissionService.previewSchemaAsRole.mockResolvedValue(mockPreview);

      const response = await request(app)
        .post('/api/v1/schemas/snapshot-1/preview')
        .send({
          role_name: 'teacher'
        });

      expect(response.status).toBe(200);
      expect(fieldPermissionService.previewSchemaAsRole).toHaveBeenCalledWith(
        'snapshot-1',
        'test-tenant-id',
        'teacher',
        'view'
      );
    });
  });

  describe('GET /api/v1/fields/:id/permissions', () => {
    it('should get field permissions successfully', async () => {
      const mockPermissions = {
        visible_to_roles: ['admin', 'teacher'],
        editable_by_roles: ['admin']
      };

      fieldPermissionService.getFieldPermissions.mockResolvedValue(mockPermissions);

      const response = await request(app)
        .get('/api/v1/fields/field-1/permissions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.field_id).toBe('field-1');
      expect(response.body.data.permissions).toEqual(mockPermissions);
    });

    it('should return 404 when field not found', async () => {
      fieldPermissionService.getFieldPermissions.mockRejectedValue(
        new Error('Field not found: field-1')
      );

      const response = await request(app)
        .get('/api/v1/fields/field-1/permissions');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('PUT /api/v1/fields/:id/permissions', () => {
    it('should update field permissions successfully', async () => {
      const newPermissions = {
        visible_to_roles: ['admin', 'teacher'],
        editable_by_roles: ['admin']
      };

      const mockUpdated = {
        field_id: 'field-1',
        field_name: 'test_field',
        permissions: newPermissions
      };

      fieldPermissionService.updateFieldPermissions.mockResolvedValue(mockUpdated);

      const response = await request(app)
        .put('/api/v1/fields/field-1/permissions')
        .send(newPermissions);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.field_id).toBe('field-1');
      expect(response.body.data.permissions).toEqual(newPermissions);
      expect(fieldPermissionService.updateFieldPermissions).toHaveBeenCalledWith(
        'field-1',
        'test-tenant-id',
        newPermissions,
        'test-user-id'
      );
    });

    it('should return 400 when visible_to_roles is missing', async () => {
      const response = await request(app)
        .put('/api/v1/fields/field-1/permissions')
        .send({
          editable_by_roles: ['admin']
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('visible_to_roles and editable_by_roles are required');
    });

    it('should return 400 when editable_by_roles is missing', async () => {
      const response = await request(app)
        .put('/api/v1/fields/field-1/permissions')
        .send({
          visible_to_roles: ['admin']
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });

    it('should return 400 for validation errors', async () => {
      fieldPermissionService.updateFieldPermissions.mockRejectedValue(
        new Error('Validation failed: editable_by_roles must be a subset of visible_to_roles')
      );

      const response = await request(app)
        .put('/api/v1/fields/field-1/permissions')
        .send({
          visible_to_roles: ['admin'],
          editable_by_roles: ['admin', 'teacher']
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });

    it('should return 404 when field not found', async () => {
      fieldPermissionService.updateFieldPermissions.mockRejectedValue(
        new Error('Field not found: field-1')
      );

      const response = await request(app)
        .put('/api/v1/fields/field-1/permissions')
        .send({
          visible_to_roles: ['admin'],
          editable_by_roles: ['admin']
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('POST /api/v1/fields/permissions/bulk', () => {
    it('should bulk update permissions successfully', async () => {
      const mockResults = {
        success: [
          { field_id: 'field-1', field_name: 'name' },
          { field_id: 'field-2', field_name: 'email' }
        ],
        failed: []
      };

      fieldPermissionService.bulkUpdateFieldPermissions.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/api/v1/fields/permissions/bulk')
        .send({
          snapshot_id: 'snapshot-1',
          field_permissions: [
            {
              field_id: 'field-1',
              permissions: {
                visible_to_roles: ['admin', 'teacher'],
                editable_by_roles: ['admin']
              }
            },
            {
              field_id: 'field-2',
              permissions: {
                visible_to_roles: ['admin'],
                editable_by_roles: ['admin']
              }
            }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResults);
    });

    it('should return 400 when snapshot_id is missing', async () => {
      const response = await request(app)
        .post('/api/v1/fields/permissions/bulk')
        .send({
          field_permissions: []
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('snapshot_id and field_permissions array are required');
    });

    it('should return 400 when field_permissions is not an array', async () => {
      const response = await request(app)
        .post('/api/v1/fields/permissions/bulk')
        .send({
          snapshot_id: 'snapshot-1',
          field_permissions: 'not-an-array'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });
  });

  describe('GET /api/v1/fields/:id/permissions/user/:userId', () => {
    it('should get user field permissions successfully', async () => {
      const mockPermissions = {
        field_id: 'field-1',
        user_id: 'user-1',
        user_roles: ['teacher'],
        can_view: true,
        can_edit: false,
        field_permissions: {
          visible_to_roles: ['admin', 'teacher'],
          editable_by_roles: ['admin']
        }
      };

      fieldPermissionService.getUserFieldPermissions.mockResolvedValue(mockPermissions);

      const response = await request(app)
        .get('/api/v1/fields/field-1/permissions/user/user-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPermissions);
      expect(fieldPermissionService.getUserFieldPermissions).toHaveBeenCalledWith(
        'user-1',
        'test-tenant-id',
        'field-1'
      );
    });

    it('should return 404 when field not found', async () => {
      fieldPermissionService.getUserFieldPermissions.mockRejectedValue(
        new Error('Field not found: field-1')
      );

      const response = await request(app)
        .get('/api/v1/fields/field-1/permissions/user/user-1');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('POST /api/v1/fields/permissions/validate-hierarchy', () => {
    it('should validate hierarchy successfully', async () => {
      const mockValidation = {
        is_valid: true,
        invalid_visible_roles: [],
        invalid_editable_roles: [],
        message: 'Permission hierarchy is valid'
      };

      fieldPermissionService.validatePermissionHierarchy.mockReturnValue(mockValidation);

      const response = await request(app)
        .post('/api/v1/fields/permissions/validate-hierarchy')
        .send({
          parent_permissions: {
            visible_to_roles: ['admin', 'teacher', 'student'],
            editable_by_roles: ['admin', 'teacher']
          },
          child_permissions: {
            visible_to_roles: ['admin', 'teacher'],
            editable_by_roles: ['admin']
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockValidation);
    });

    it('should detect invalid hierarchy', async () => {
      const mockValidation = {
        is_valid: false,
        invalid_visible_roles: ['student'],
        invalid_editable_roles: [],
        message: 'Child permissions cannot expand parent permissions'
      };

      fieldPermissionService.validatePermissionHierarchy.mockReturnValue(mockValidation);

      const response = await request(app)
        .post('/api/v1/fields/permissions/validate-hierarchy')
        .send({
          parent_permissions: {
            visible_to_roles: ['admin', 'teacher'],
            editable_by_roles: ['admin']
          },
          child_permissions: {
            visible_to_roles: ['admin', 'teacher', 'student'],
            editable_by_roles: ['admin']
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.is_valid).toBe(false);
      expect(response.body.data.invalid_visible_roles).toEqual(['student']);
    });

    it('should return 400 when parent_permissions is missing', async () => {
      const response = await request(app)
        .post('/api/v1/fields/permissions/validate-hierarchy')
        .send({
          child_permissions: {
            visible_to_roles: ['admin'],
            editable_by_roles: ['admin']
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('parent_permissions and child_permissions are required');
    });

    it('should return 400 when child_permissions is missing', async () => {
      const response = await request(app)
        .post('/api/v1/fields/permissions/validate-hierarchy')
        .send({
          parent_permissions: {
            visible_to_roles: ['admin'],
            editable_by_roles: ['admin']
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });
  });
});
