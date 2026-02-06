/**
 * Tenant Service Tests
 */

const tenantService = require('./tenantService');
const { transaction } = require('../config/database');

jest.mock('../config/database');

describe('TenantService', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      query: jest.fn(),
    };
  });

  describe('validateTenantInput', () => {
    it('should validate correct tenant data', () => {
      const result = tenantService.validateTenantInput({
        name: 'Test School',
        subdomain: 'test-school',
        tier: 'Basic',
      });
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing name', () => {
      const result = tenantService.validateTenantInput({
        subdomain: 'test',
        tier: 'Basic',
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('name is required and must be a string');
    });

    it('should reject short name', () => {
      const result = tenantService.validateTenantInput({
        name: 'A',
        subdomain: 'test',
        tier: 'Basic',
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('between 2 and 255'))).toBe(true);
    });

    it('should reject invalid subdomain format', () => {
      const result = tenantService.validateTenantInput({
        name: 'Test',
        subdomain: 'Test_School!',
        tier: 'Basic',
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('lowercase alphanumeric'))).toBe(true);
    });

    it('should reject reserved subdomains', () => {
      const result = tenantService.validateTenantInput({
        name: 'Test',
        subdomain: 'admin',
        tier: 'Basic',
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('reserved'))).toBe(true);
    });

    it('should reject invalid tier', () => {
      const result = tenantService.validateTenantInput({
        name: 'Test',
        subdomain: 'test',
        tier: 'Invalid',
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Basic, Business, Enterprise'))).toBe(true);
    });
  });

  describe('createTenant', () => {
    it('should create tenant with quotas', async () => {
      const mockTenant = {
        tenant_id: 'tenant-123',
        name: 'Test School',
        subdomain: 'test-school',
        tier: 'Basic',
        status: 'active',
      };

      transaction.mockImplementation(async (callback) => {
        const client = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockTenant] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] }),
        };
        return await callback(client);
      });

      const result = await tenantService.createTenant({
        name: 'Test School',
        subdomain: 'test-school',
        tier: 'Basic',
      });

      expect(result.tenant).toEqual(mockTenant);
      expect(result.quotas).toBeDefined();
    });

    it('should throw validation error', async () => {
      await expect(
        tenantService.createTenant({
          name: 'A',
          subdomain: 'test',
          tier: 'Basic',
        })
      ).rejects.toThrow('Validation failed');
    });
  });

  describe('getTenantById', () => {
    it('should get tenant by ID', async () => {
      const mockTenant = {
        tenant_id: 'tenant-123',
        name: 'Test School',
      };
      mockClient.query.mockResolvedValue({
        rows: [mockTenant],
        rowCount: 1,
      });

      const result = await tenantService.getTenantById('tenant-123', mockClient);

      expect(result).toEqual(mockTenant);
    });

    it('should return null if not found', async () => {
      mockClient.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const result = await tenantService.getTenantById('tenant-999', mockClient);

      expect(result).toBeNull();
    });
  });

  describe('getTenantBySubdomain', () => {
    it('should get tenant by subdomain', async () => {
      const mockTenant = {
        tenant_id: 'tenant-123',
        subdomain: 'test-school',
      };
      mockClient.query.mockResolvedValue({
        rows: [mockTenant],
        rowCount: 1,
      });

      const result = await tenantService.getTenantBySubdomain('test-school', mockClient);

      expect(result).toEqual(mockTenant);
    });

    it('should return null if not found', async () => {
      mockClient.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const result = await tenantService.getTenantBySubdomain('nonexistent', mockClient);

      expect(result).toBeNull();
    });
  });

  describe('listTenants', () => {
    it('should list tenants with pagination', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ total: '10' }] })
        .mockResolvedValueOnce({
          rows: [
            { tenant_id: 'tenant-1', name: 'School 1' },
            { tenant_id: 'tenant-2', name: 'School 2' },
          ],
        });

      const result = await tenantService.listTenants({ page: 1, limit: 20 }, mockClient);

      expect(result.tenants).toHaveLength(2);
      expect(result.pagination.total).toBe(10);
    });

    it('should filter by status', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ total: '5' }] })
        .mockResolvedValueOnce({ rows: [] });

      await tenantService.listTenants({ status: 'active' }, mockClient);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        expect.arrayContaining(['active'])
      );
    });

    it('should filter by tier', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ total: '3' }] })
        .mockResolvedValueOnce({ rows: [] });

      await tenantService.listTenants({ tier: 'Enterprise' }, mockClient);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        expect.arrayContaining(['Enterprise'])
      );
    });
  });

  describe('updateTenant', () => {
    it('should update tenant', async () => {
      const mockTenant = {
        tenant_id: 'tenant-123',
        name: 'Updated School',
      };

      transaction.mockImplementation(async (callback) => {
        const client = {
          query: jest.fn().mockResolvedValue({
            rows: [mockTenant],
            rowCount: 1,
          }),
        };
        return await callback(client);
      });

      const result = await tenantService.updateTenant('tenant-123', {
        name: 'Updated School',
      });

      expect(result.name).toBe('Updated School');
    });

    it('should throw error if no valid fields', async () => {
      await expect(
        tenantService.updateTenant('tenant-123', {})
      ).rejects.toThrow('No valid fields to update');
    });

    it('should throw error if tenant not found', async () => {
      transaction.mockImplementation(async (callback) => {
        const client = {
          query: jest.fn().mockResolvedValue({
            rows: [],
            rowCount: 0,
          }),
        };
        return await callback(client);
      });

      await expect(
        tenantService.updateTenant('tenant-999', { name: 'Test' })
      ).rejects.toThrow('Tenant not found');
    });

    it('should update quotas when tier changes', async () => {
      transaction.mockImplementation(async (callback) => {
        const client = {
          query: jest.fn()
            .mockResolvedValueOnce({
              rows: [{ tenant_id: 'tenant-123', tier: 'Business' }],
              rowCount: 1,
            })
            .mockResolvedValueOnce({ rows: [] }),
        };
        return await callback(client);
      });

      await tenantService.updateTenant('tenant-123', { tier: 'Business' });

      expect(transaction).toHaveBeenCalled();
    });
  });

  describe('TIER_QUOTAS', () => {
    it('should have quotas for all tiers', () => {
      expect(tenantService.TIER_QUOTAS.Basic).toBeDefined();
      expect(tenantService.TIER_QUOTAS.Business).toBeDefined();
      expect(tenantService.TIER_QUOTAS.Enterprise).toBeDefined();
    });

    it('should have unlimited resources for Enterprise', () => {
      const enterprise = tenantService.TIER_QUOTAS.Enterprise;
      expect(enterprise.max_students).toBe(-1);
      expect(enterprise.max_storage_gb).toBe(-1);
    });
  });
});
