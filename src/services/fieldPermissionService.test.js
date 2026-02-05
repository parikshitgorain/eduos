/**
 * Field Permission Service Tests
 * 
 * Task: 2.2.3 - Create field-level permission system
 */

const fieldPermissionService = require('./fieldPermissionService');
const { query } = require('../config/database');

// Mock the database module
jest.mock('../config/database');

describe('Field Permission Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveFieldPermissions', () => {
    it('should return global permissions when no overrides', () => {
      const globalPermissions = {
        visible_to_roles: ['admin', 'teacher', 'student'],
        editable_by_roles: ['admin', 'teacher']
      };

      const result = fieldPermissionService.resolveFieldPermissions(globalPermissions, []);

      expect(result.visible_to_roles).toEqual(['admin', 'teacher', 'student']);
      expect(result.editable_by_roles).toEqual(['admin', 'teacher']);
    });

    it('should restrict permissions with hierarchy overrides', () => {
      const globalPermissions = {
        visible_to_roles: ['admin', 'teacher', 'student'],
        editable_by_roles: ['admin', 'teacher']
      };

      const overrides = [
        {
          visible_to_roles: ['admin', 'teacher'],
          editable_by_roles: ['admin']
        }
      ];

      const result = fieldPermissionService.resolveFieldPermissions(globalPermissions, overrides);

      expect(result.visible_to_roles).toEqual(['admin', 'teacher']);
      expect(result.editable_by_roles).toEqual(['admin']);
    });

    it('should apply multiple hierarchy levels correctly', () => {
      const globalPermissions = {
        visible_to_roles: ['admin', 'teacher', 'student'],
        editable_by_roles: ['admin', 'teacher']
      };

      const overrides = [
        {
          visible_to_roles: ['admin', 'teacher'],
          editable_by_roles: ['admin']
        },
        {
          visible_to_roles: ['admin'],
          editable_by_roles: ['admin']
        }
      ];

      const result = fieldPermissionService.resolveFieldPermissions(globalPermissions, overrides);

      expect(result.visible_to_roles).toEqual(['admin']);
      expect(result.editable_by_roles).toEqual(['admin']);
    });

    it('should ensure editable roles are subset of visible roles', () => {
      const globalPermissions = {
        visible_to_roles: ['admin', 'teacher'],
        editable_by_roles: ['admin', 'teacher', 'student']
      };

      const result = fieldPermissionService.resolveFieldPermissions(globalPermissions, []);

      // Student should be removed from editable since not in visible
      expect(result.visible_to_roles).toEqual(['admin', 'teacher']);
      expect(result.editable_by_roles).toEqual(['admin', 'teacher']);
    });

    it('should handle empty permissions', () => {
      const globalPermissions = {
        visible_to_roles: [],
        editable_by_roles: []
      };

      const result = fieldPermissionService.resolveFieldPermissions(globalPermissions, []);

      expect(result.visible_to_roles).toEqual([]);
      expect(result.editable_by_roles).toEqual([]);
    });
  });

  describe('canViewField', () => {
    it('should return true when user has visible role', () => {
      const permissions = {
        visible_to_roles: ['admin', 'teacher'],
        editable_by_roles: ['admin']
      };

      const result = fieldPermissionService.canViewField(permissions, ['teacher']);

      expect(result).toBe(true);
    });

    it('should return false when user does not have visible role', () => {
      const permissions = {
        visible_to_roles: ['admin', 'teacher'],
        editable_by_roles: ['admin']
      };

      const result = fieldPermissionService.canViewField(permissions, ['student']);

      expect(result).toBe(false);
    });

    it('should return true when user has multiple roles and one matches', () => {
      const permissions = {
        visible_to_roles: ['admin', 'teacher'],
        editable_by_roles: ['admin']
      };

      const result = fieldPermissionService.canViewField(permissions, ['student', 'teacher']);

      expect(result).toBe(true);
    });

    it('should return false for null permissions', () => {
      const result = fieldPermissionService.canViewField(null, ['admin']);

      expect(result).toBe(false);
    });
  });

  describe('canEditField', () => {
    it('should return true when user has editable role', () => {
      const permissions = {
        visible_to_roles: ['admin', 'teacher'],
        editable_by_roles: ['admin']
      };

      const result = fieldPermissionService.canEditField(permissions, ['admin']);

      expect(result).toBe(true);
    });

    it('should return false when user does not have editable role', () => {
      const permissions = {
        visible_to_roles: ['admin', 'teacher'],
        editable_by_roles: ['admin']
      };

      const result = fieldPermissionService.canEditField(permissions, ['teacher']);

      expect(result).toBe(false);
    });

    it('should return true when user has multiple roles and one matches', () => {
      const permissions = {
        visible_to_roles: ['admin', 'teacher'],
        editable_by_roles: ['admin', 'teacher']
      };

      const result = fieldPermissionService.canEditField(permissions, ['student', 'teacher']);

      expect(result).toBe(true);
    });

    it('should return false for null permissions', () => {
      const result = fieldPermissionService.canEditField(null, ['admin']);

      expect(result).toBe(false);
    });
  });

  describe('filterFieldsByPermission', () => {
    const fields = [
      {
        field_id: '1',
        field_name: 'name',
        permissions: {
          visible_to_roles: ['admin', 'teacher', 'student'],
          editable_by_roles: ['admin', 'teacher']
        }
      },
      {
        field_id: '2',
        field_name: 'medical_history',
        permissions: {
          visible_to_roles: ['admin', 'nurse'],
          editable_by_roles: ['admin', 'nurse']
        }
      },
      {
        field_id: '3',
        field_name: 'email',
        permissions: {
          visible_to_roles: ['admin', 'teacher'],
          editable_by_roles: ['admin']
        }
      }
    ];

    it('should filter fields for view access', () => {
      const result = fieldPermissionService.filterFieldsByPermission(fields, ['teacher'], 'view');

      expect(result).toHaveLength(2);
      expect(result.map(f => f.field_name)).toEqual(['name', 'email']);
    });

    it('should filter fields for edit access', () => {
      const result = fieldPermissionService.filterFieldsByPermission(fields, ['teacher'], 'edit');

      expect(result).toHaveLength(1);
      expect(result[0].field_name).toBe('name');
    });

    it('should return all fields for admin', () => {
      const result = fieldPermissionService.filterFieldsByPermission(fields, ['admin'], 'view');

      expect(result).toHaveLength(3);
    });

    it('should return empty array when no permissions match', () => {
      const result = fieldPermissionService.filterFieldsByPermission(fields, ['student'], 'edit');

      expect(result).toHaveLength(0);
    });

    it('should handle fields without permissions', () => {
      const fieldsWithoutPerms = [
        {
          field_id: '1',
          field_name: 'name'
        }
      ];

      const result = fieldPermissionService.filterFieldsByPermission(fieldsWithoutPerms, ['admin'], 'view');

      expect(result).toHaveLength(0);
    });
  });

  describe('getUserRoleNames', () => {
    it('should return user role names', async () => {
      query.mockResolvedValue({
        rows: [
          { role_name: 'admin' },
          { role_name: 'teacher' }
        ]
      });

      const result = await fieldPermissionService.getUserRoleNames('user-1', 'tenant-1');

      expect(result).toEqual(['admin', 'teacher']);
      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        ['user-1', 'tenant-1']
      );
    });

    it('should return empty array when user has no roles', async () => {
      query.mockResolvedValue({
        rows: []
      });

      const result = await fieldPermissionService.getUserRoleNames('user-1', 'tenant-1');

      expect(result).toEqual([]);
    });
  });

  describe('getFieldPermissions', () => {
    it('should return field permissions', async () => {
      const mockPermissions = {
        visible_to_roles: ['admin', 'teacher'],
        editable_by_roles: ['admin']
      };

      query.mockResolvedValue({
        rows: [{ permissions: mockPermissions }]
      });

      const result = await fieldPermissionService.getFieldPermissions('field-1', 'tenant-1');

      expect(result).toEqual(mockPermissions);
      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        ['field-1', 'tenant-1']
      );
    });

    it('should throw error when field not found', async () => {
      query.mockResolvedValue({
        rows: []
      });

      await expect(
        fieldPermissionService.getFieldPermissions('field-1', 'tenant-1')
      ).rejects.toThrow('Field not found: field-1');
    });

    it('should return default permissions when field has no permissions', async () => {
      query.mockResolvedValue({
        rows: [{ permissions: null }]
      });

      const result = await fieldPermissionService.getFieldPermissions('field-1', 'tenant-1');

      expect(result).toEqual(fieldPermissionService.DEFAULT_PERMISSIONS);
    });
  });

  describe('updateFieldPermissions', () => {
    it('should update field permissions successfully', async () => {
      const newPermissions = {
        visible_to_roles: ['admin', 'teacher'],
        editable_by_roles: ['admin']
      };

      query.mockResolvedValueOnce({
        rows: [{
          field_id: 'field-1',
          field_name: 'test_field',
          permissions: newPermissions
        }]
      }).mockResolvedValueOnce({
        rows: []
      });

      const result = await fieldPermissionService.updateFieldPermissions(
        'field-1',
        'tenant-1',
        newPermissions,
        'user-1'
      );

      expect(result.field_id).toBe('field-1');
      expect(result.permissions).toEqual(newPermissions);
      expect(query).toHaveBeenCalledTimes(2); // Update + audit log
    });

    it('should throw error when visible_to_roles is not an array', async () => {
      const invalidPermissions = {
        visible_to_roles: 'admin',
        editable_by_roles: ['admin']
      };

      await expect(
        fieldPermissionService.updateFieldPermissions(
          'field-1',
          'tenant-1',
          invalidPermissions,
          'user-1'
        )
      ).rejects.toThrow('visible_to_roles must be an array');
    });

    it('should throw error when editable_by_roles is not an array', async () => {
      const invalidPermissions = {
        visible_to_roles: ['admin'],
        editable_by_roles: 'admin'
      };

      await expect(
        fieldPermissionService.updateFieldPermissions(
          'field-1',
          'tenant-1',
          invalidPermissions,
          'user-1'
        )
      ).rejects.toThrow('editable_by_roles must be an array');
    });

    it('should throw error when editable roles are not subset of visible roles', async () => {
      const invalidPermissions = {
        visible_to_roles: ['admin'],
        editable_by_roles: ['admin', 'teacher']
      };

      await expect(
        fieldPermissionService.updateFieldPermissions(
          'field-1',
          'tenant-1',
          invalidPermissions,
          'user-1'
        )
      ).rejects.toThrow('editable_by_roles must be a subset of visible_to_roles');
    });

    it('should throw error when field not found', async () => {
      const newPermissions = {
        visible_to_roles: ['admin'],
        editable_by_roles: ['admin']
      };

      query.mockResolvedValue({
        rows: []
      });

      await expect(
        fieldPermissionService.updateFieldPermissions(
          'field-1',
          'tenant-1',
          newPermissions,
          'user-1'
        )
      ).rejects.toThrow('Field not found: field-1');
    });
  });

  describe('previewSchemaAsRole', () => {
    it('should return filtered schema for role', async () => {
      const mockSnapshot = {
        snapshot_id: 'snapshot-1',
        form_type: 'student',
        semantic_version: 'v1.0.0',
        status: 'active'
      };

      const mockFields = [
        {
          field_id: '1',
          field_name: 'name',
          field_type: 'text',
          label: 'Name',
          is_required: true,
          display_order: 0,
          permissions: {
            visible_to_roles: ['admin', 'teacher', 'student'],
            editable_by_roles: ['admin', 'teacher']
          }
        },
        {
          field_id: '2',
          field_name: 'medical_history',
          field_type: 'textarea',
          label: 'Medical History',
          is_required: false,
          display_order: 1,
          permissions: {
            visible_to_roles: ['admin', 'nurse'],
            editable_by_roles: ['admin', 'nurse']
          }
        }
      ];

      query.mockResolvedValueOnce({
        rows: [mockSnapshot]
      }).mockResolvedValueOnce({
        rows: mockFields
      });

      const result = await fieldPermissionService.previewSchemaAsRole(
        'snapshot-1',
        'tenant-1',
        'teacher',
        'view'
      );

      expect(result.snapshot_id).toBe('snapshot-1');
      expect(result.preview_role).toBe('teacher');
      expect(result.access_type).toBe('view');
      expect(result.total_fields).toBe(2);
      expect(result.visible_fields).toBe(1);
      expect(result.fields).toHaveLength(1);
      expect(result.fields[0].field_name).toBe('name');
    });

    it('should filter for edit access', async () => {
      const mockSnapshot = {
        snapshot_id: 'snapshot-1',
        form_type: 'student',
        semantic_version: 'v1.0.0',
        status: 'active'
      };

      const mockFields = [
        {
          field_id: '1',
          field_name: 'name',
          field_type: 'text',
          label: 'Name',
          is_required: true,
          display_order: 0,
          permissions: {
            visible_to_roles: ['admin', 'teacher', 'student'],
            editable_by_roles: ['admin', 'teacher']
          }
        },
        {
          field_id: '2',
          field_name: 'email',
          field_type: 'email',
          label: 'Email',
          is_required: false,
          display_order: 1,
          permissions: {
            visible_to_roles: ['admin', 'teacher'],
            editable_by_roles: ['admin']
          }
        }
      ];

      query.mockResolvedValueOnce({
        rows: [mockSnapshot]
      }).mockResolvedValueOnce({
        rows: mockFields
      });

      const result = await fieldPermissionService.previewSchemaAsRole(
        'snapshot-1',
        'tenant-1',
        'teacher',
        'edit'
      );

      expect(result.visible_fields).toBe(1);
      expect(result.fields[0].field_name).toBe('name');
      expect(result.fields[0].can_edit).toBe(true);
    });

    it('should throw error when snapshot not found', async () => {
      query.mockResolvedValue({
        rows: []
      });

      await expect(
        fieldPermissionService.previewSchemaAsRole(
          'snapshot-1',
          'tenant-1',
          'teacher',
          'view'
        )
      ).rejects.toThrow('Schema snapshot not found: snapshot-1');
    });
  });

  describe('validatePermissionHierarchy', () => {
    it('should validate correct hierarchy', () => {
      const parentPermissions = {
        visible_to_roles: ['admin', 'teacher', 'student'],
        editable_by_roles: ['admin', 'teacher']
      };

      const childPermissions = {
        visible_to_roles: ['admin', 'teacher'],
        editable_by_roles: ['admin']
      };

      const result = fieldPermissionService.validatePermissionHierarchy(
        parentPermissions,
        childPermissions
      );

      expect(result.is_valid).toBe(true);
      expect(result.invalid_visible_roles).toEqual([]);
      expect(result.invalid_editable_roles).toEqual([]);
    });

    it('should detect invalid visible roles expansion', () => {
      const parentPermissions = {
        visible_to_roles: ['admin', 'teacher'],
        editable_by_roles: ['admin']
      };

      const childPermissions = {
        visible_to_roles: ['admin', 'teacher', 'student'],
        editable_by_roles: ['admin']
      };

      const result = fieldPermissionService.validatePermissionHierarchy(
        parentPermissions,
        childPermissions
      );

      expect(result.is_valid).toBe(false);
      expect(result.invalid_visible_roles).toEqual(['student']);
    });

    it('should detect invalid editable roles expansion', () => {
      const parentPermissions = {
        visible_to_roles: ['admin', 'teacher'],
        editable_by_roles: ['admin']
      };

      const childPermissions = {
        visible_to_roles: ['admin', 'teacher'],
        editable_by_roles: ['admin', 'teacher']
      };

      const result = fieldPermissionService.validatePermissionHierarchy(
        parentPermissions,
        childPermissions
      );

      expect(result.is_valid).toBe(false);
      expect(result.invalid_editable_roles).toEqual(['teacher']);
    });

    it('should handle empty permissions', () => {
      const parentPermissions = {
        visible_to_roles: [],
        editable_by_roles: []
      };

      const childPermissions = {
        visible_to_roles: [],
        editable_by_roles: []
      };

      const result = fieldPermissionService.validatePermissionHierarchy(
        parentPermissions,
        childPermissions
      );

      expect(result.is_valid).toBe(true);
    });
  });
});
