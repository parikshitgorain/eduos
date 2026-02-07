/**
 * EduOS Platform - RBAC Service Tests
 * 
 * Tests for hierarchical role-based access control
 */

const rbacService = require('./rbacService');
const { query } = require('../config/database');

// Mock the database query function
jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

describe('RBACService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserPermissions', () => {
    it('should return user permissions including inherited permissions', async () => {
      const mockPermissions = [
        {
          permission_name: 'student:read',
          resource_type: 'student',
          action: 'read',
          role_name: 'teacher',
          hierarchy_level: 3,
        },
        {
          permission_name: 'attendance:write',
          resource_type: 'attendance',
          action: 'write',
          role_name: 'teacher',
          hierarchy_level: 3,
        },
      ];

      query.mockResolvedValue({ rows: mockPermissions });

      const userId = 'user-123';
      const tenantId = 'tenant-456';

      const result = await rbacService.getUserPermissions(userId, tenantId);

      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM get_user_permissions($1, $2)',
        [userId, tenantId]
      );

      expect(result).toEqual([
        {
          permissionName: 'student:read',
          resourceType: 'student',
          action: 'read',
          roleName: 'teacher',
          hierarchyLevel: 3,
        },
        {
          permissionName: 'attendance:write',
          resourceType: 'attendance',
          action: 'write',
          roleName: 'teacher',
          hierarchyLevel: 3,
        },
      ]);
    });

    it('should return empty array if user has no permissions', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await rbacService.getUserPermissions('user-123', 'tenant-456');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      query.mockRejectedValue(new Error('Database error'));

      await expect(
        rbacService.getUserPermissions('user-123', 'tenant-456')
      ).rejects.toThrow('Database error');

      expect(consoleSpy).toHaveBeenCalledWith('Error getting user permissions:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('userHasPermission', () => {
    it('should return true if user has permission', async () => {
      query.mockResolvedValue({ rows: [{ has_permission: true }] });

      const result = await rbacService.userHasPermission(
        'user-123',
        'tenant-456',
        'student:read'
      );

      expect(query).toHaveBeenCalledWith(
        'SELECT user_has_permission($1, $2, $3) as has_permission',
        ['user-123', 'tenant-456', 'student:read']
      );

      expect(result).toBe(true);
    });

    it('should return false if user does not have permission', async () => {
      query.mockResolvedValue({ rows: [{ has_permission: false }] });

      const result = await rbacService.userHasPermission(
        'user-123',
        'tenant-456',
        'student:delete'
      );

      expect(result).toBe(false);
    });

    it('should throw error on database failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      query.mockRejectedValue(new Error('Database error'));

      await expect(
        rbacService.userHasPermission('user-123', 'tenant-456', 'student:read')
      ).rejects.toThrow('Database error');

      expect(consoleSpy).toHaveBeenCalledWith('Error checking user permission:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('getUserFieldPermissions', () => {
    it('should return field-level permissions for a resource type', async () => {
      const mockFieldPermissions = [
        {
          field_name: 'first_name',
          can_read: true,
          can_write: true,
        },
        {
          field_name: 'email',
          can_read: true,
          can_write: false,
        },
      ];

      query.mockResolvedValue({ rows: mockFieldPermissions });

      const result = await rbacService.getUserFieldPermissions(
        'user-123',
        'tenant-456',
        'student'
      );

      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM get_user_field_permissions($1, $2, $3)',
        ['user-123', 'tenant-456', 'student']
      );

      expect(result).toEqual([
        {
          fieldName: 'first_name',
          canRead: true,
          canWrite: true,
        },
        {
          fieldName: 'email',
          canRead: true,
          canWrite: false,
        },
      ]);
    });

    it('should throw error on database failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      query.mockRejectedValue(new Error('Database error'));

      await expect(
        rbacService.getUserFieldPermissions('user-123', 'tenant-456', 'student')
      ).rejects.toThrow('Database error');

      expect(consoleSpy).toHaveBeenCalledWith('Error getting user field permissions:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('getUserRoles', () => {
    it('should return all roles for a user', async () => {
      const mockRoles = [
        {
          role_id: 'role-123',
          role_name: 'teacher',
          display_name: 'Teacher',
          description: 'Manage classes and student attendance',
          hierarchy_level: 3,
          parent_role_id: 'role-parent',
        },
      ];

      query.mockResolvedValue({ rows: mockRoles });

      const result = await rbacService.getUserRoles('user-123', 'tenant-456');

      expect(result).toEqual([
        {
          roleId: 'role-123',
          roleName: 'teacher',
          displayName: 'Teacher',
          description: 'Manage classes and student attendance',
          hierarchyLevel: 3,
          parentRoleId: 'role-parent',
        },
      ]);
    });

    it('should throw error on database failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      query.mockRejectedValue(new Error('Database error'));

      await expect(
        rbacService.getUserRoles('user-123', 'tenant-456')
      ).rejects.toThrow('Database error');

      expect(consoleSpy).toHaveBeenCalledWith('Error getting user roles:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('assignRoleToUser', () => {
    it('should assign a role to a user', async () => {
      // Mock role check
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ role_id: 'role-123', role_name: 'teacher' }],
      });

      // Mock existing role check
      query.mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      });

      // Mock role assignment
      query.mockResolvedValueOnce({
        rows: [
          {
            user_role_id: 'user-role-123',
            user_id: 'user-123',
            role_id: 'role-123',
            tenant_id: 'tenant-456',
            assigned_at: new Date(),
          },
        ],
      });

      // Mock audit log
      query.mockResolvedValueOnce({ rows: [] });

      const result = await rbacService.assignRoleToUser(
        'user-123',
        'role-123',
        'tenant-456',
        'admin-123'
      );

      expect(result).toHaveProperty('userRoleId');
      expect(result).toHaveProperty('userId', 'user-123');
      expect(result).toHaveProperty('roleId', 'role-123');
    });

    it('should throw error if role does not exist', async () => {
      query.mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      });

      await expect(
        rbacService.assignRoleToUser('user-123', 'invalid-role', 'tenant-456', 'admin-123')
      ).rejects.toThrow('Role not found or does not belong to tenant');
    });

    it('should throw error if user already has the role', async () => {
      // Mock role check
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ role_id: 'role-123', role_name: 'teacher' }],
      });

      // Mock existing role check (user already has role)
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ user_role_id: 'existing-123' }],
      });

      await expect(
        rbacService.assignRoleToUser('user-123', 'role-123', 'tenant-456', 'admin-123')
      ).rejects.toThrow('User already has this role');
    });

    it('should throw error on database failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      query.mockRejectedValue(new Error('Database error'));

      await expect(
        rbacService.assignRoleToUser('user-123', 'role-123', 'tenant-456', 'admin-123')
      ).rejects.toThrow('Database error');

      expect(consoleSpy).toHaveBeenCalledWith('Error assigning role to user:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('removeRoleFromUser', () => {
    it('should remove a role from a user', async () => {
      // Mock role name lookup
      query.mockResolvedValueOnce({
        rows: [{ role_name: 'teacher' }],
      });

      // Mock role removal
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ user_role_id: 'user-role-123' }],
      });

      // Mock audit log
      query.mockResolvedValueOnce({ rows: [] });

      const result = await rbacService.removeRoleFromUser(
        'user-123',
        'role-123',
        'tenant-456',
        'admin-123'
      );

      expect(result).toBe(true);
    });

    it('should throw error if user role not found', async () => {
      // Mock role name lookup
      query.mockResolvedValueOnce({
        rows: [{ role_name: 'teacher' }],
      });

      // Mock role removal (not found)
      query.mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      });

      await expect(
        rbacService.removeRoleFromUser('user-123', 'role-123', 'tenant-456', 'admin-123')
      ).rejects.toThrow('User role not found');
    });

    it('should throw error on database failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      query.mockRejectedValue(new Error('Database error'));

      await expect(
        rbacService.removeRoleFromUser('user-123', 'role-123', 'tenant-456', 'admin-123')
      ).rejects.toThrow('Database error');

      expect(consoleSpy).toHaveBeenCalledWith('Error removing role from user:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('getTenantRoles', () => {
    it('should return all roles for a tenant', async () => {
      const mockRoles = [
        {
          role_id: 'role-1',
          role_name: 'super_admin',
          display_name: 'Super Administrator',
          description: 'Full system access',
          parent_role_id: null,
          hierarchy_level: 0,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          role_id: 'role-2',
          role_name: 'teacher',
          display_name: 'Teacher',
          description: 'Manage classes',
          parent_role_id: 'role-1',
          hierarchy_level: 3,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      query.mockResolvedValue({ rows: mockRoles });

      const result = await rbacService.getTenantRoles('tenant-456');

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('roleName', 'super_admin');
      expect(result[1]).toHaveProperty('roleName', 'teacher');
    });

    it('should throw error on database failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      query.mockRejectedValue(new Error('Database error'));

      await expect(
        rbacService.getTenantRoles('tenant-456')
      ).rejects.toThrow('Database error');

      expect(consoleSpy).toHaveBeenCalledWith('Error getting tenant roles:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('getRoleById', () => {
    it('should return role details by ID', async () => {
      const mockRole = {
        role_id: 'role-123',
        role_name: 'teacher',
        display_name: 'Teacher',
        description: 'Manage classes',
        parent_role_id: 'role-parent',
        hierarchy_level: 3,
        created_at: new Date(),
        updated_at: new Date(),
      };

      query.mockResolvedValue({ rowCount: 1, rows: [mockRole] });

      const result = await rbacService.getRoleById('role-123', 'tenant-456');

      expect(result).toHaveProperty('roleId', 'role-123');
      expect(result).toHaveProperty('roleName', 'teacher');
    });

    it('should return null if role not found', async () => {
      query.mockResolvedValue({ rowCount: 0, rows: [] });

      const result = await rbacService.getRoleById('invalid-role', 'tenant-456');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      query.mockRejectedValue(new Error('Database error'));

      await expect(
        rbacService.getRoleById('role-123', 'tenant-456')
      ).rejects.toThrow('Database error');

      expect(consoleSpy).toHaveBeenCalledWith('Error getting role by ID:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('getRolePermissions', () => {
    it('should return permissions for a role', async () => {
      const mockPermissions = [
        {
          permission_id: 'perm-1',
          permission_name: 'student:read',
          resource_type: 'student',
          action: 'read',
          description: 'View student information',
        },
      ];

      query.mockResolvedValue({ rows: mockPermissions });

      const result = await rbacService.getRolePermissions('role-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('permissionName', 'student:read');
    });

    it('should throw error on database failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      query.mockRejectedValue(new Error('Database error'));

      await expect(
        rbacService.getRolePermissions('role-123')
      ).rejects.toThrow('Database error');

      expect(consoleSpy).toHaveBeenCalledWith('Error getting role permissions:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('createDefaultRoles', () => {
    it('should create default roles for a tenant', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await rbacService.createDefaultRoles('tenant-456');

      expect(query).toHaveBeenCalledWith('SELECT create_default_roles($1)', ['tenant-456']);
      expect(result).toBe(true);
    });

    it('should throw error on database failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      query.mockRejectedValue(new Error('Database error'));

      await expect(
        rbacService.createDefaultRoles('tenant-456')
      ).rejects.toThrow('Database error');

      expect(consoleSpy).toHaveBeenCalledWith('Error creating default roles:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('setFieldPermission', () => {
    it('should set field-level permission for a role', async () => {
      const mockFieldPermission = {
        field_permission_id: 'fp-123',
        field_name: 'email',
        resource_type: 'student',
        can_read: true,
        can_write: false,
      };

      query.mockResolvedValue({ rows: [mockFieldPermission] });

      const result = await rbacService.setFieldPermission(
        'role-123',
        'tenant-456',
        'email',
        'student',
        true,
        false
      );

      expect(result).toHaveProperty('fieldName', 'email');
      expect(result).toHaveProperty('canRead', true);
      expect(result).toHaveProperty('canWrite', false);
    });

    it('should throw error on database failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      query.mockRejectedValue(new Error('Database error'));

      await expect(
        rbacService.setFieldPermission('role-123', 'tenant-456', 'email', 'student', true, false)
      ).rejects.toThrow('Database error');

      expect(consoleSpy).toHaveBeenCalledWith('Error setting field permission:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('getAllPermissions', () => {
    it('should return all available permissions', async () => {
      const mockPermissions = [
        {
          permission_id: 'perm-1',
          permission_name: 'student:read',
          resource_type: 'student',
          action: 'read',
          description: 'View student information',
        },
        {
          permission_id: 'perm-2',
          permission_name: 'student:write',
          resource_type: 'student',
          action: 'write',
          description: 'Create and update student information',
        },
      ];

      query.mockResolvedValue({ rows: mockPermissions });

      const result = await rbacService.getAllPermissions();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('permissionName', 'student:read');
      expect(result[1]).toHaveProperty('permissionName', 'student:write');
    });

    it('should throw error on database failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      query.mockRejectedValue(new Error('Database error'));

      await expect(
        rbacService.getAllPermissions()
      ).rejects.toThrow('Database error');

      expect(consoleSpy).toHaveBeenCalledWith('Error getting all permissions:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
