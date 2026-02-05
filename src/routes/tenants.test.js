/**
 * Integration Tests for Tenant Provisioning API
 * 
 * Task: 1.1.3 - Create tenant provisioning API
 * 
 * Tests validate:
 * - POST /api/v1/tenants endpoint creates new tenant with UUID
 * - Tenant creation includes: name, subdomain, tier
 * - Database schema automatically initialized for new tenant
 * - Resource quotas configured based on tier
 * - End-to-end tenant creation flow
 */

const request = require('supertest');
const app = require('../server');
const { query, getClient, close } = require('../config/database');

describe('Tenant Provisioning API - Integration Tests', () => {
  let createdTenantIds = [];
  
  // Cleanup after all tests
  afterAll(async () => {
    // Clean up created tenants
    for (const tenantId of createdTenantIds) {
      try {
        await query('DELETE FROM tenants WHERE tenant_id = $1', [tenantId]);
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
    
    // Close database connections
    await close();
  });
  
  describe('POST /api/v1/tenants', () => {
    test('should create a new Basic tier tenant with UUID', async () => {
      const tenantData = {
        name: 'Test School Basic',
        subdomain: 'test-school-basic',
        tier: 'Basic'
      };
      
      const response = await request(app)
        .post('/api/v1/tenants')
        .send(tenantData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Tenant created successfully');
      
      // Validate tenant data
      const tenant = response.body.data.tenant;
      expect(tenant.tenant_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(tenant.name).toBe(tenantData.name);
      expect(tenant.subdomain).toBe(tenantData.subdomain);
      expect(tenant.tier).toBe(tenantData.tier);
      expect(tenant.status).toBe('active');
      expect(tenant.created_at).toBeDefined();
      
      // Validate quotas
      const quotas = response.body.data.quotas;
      expect(quotas.max_students).toBe(500);
      expect(quotas.max_storage_gb).toBe(10);
      expect(quotas.max_api_calls_per_day).toBe(10000);
      expect(quotas.max_concurrent_users).toBe(50);
      expect(quotas.backup_retention_days).toBe(30);
      expect(quotas.support_level).toBe('email');
      
      createdTenantIds.push(tenant.tenant_id);
    });
    
    test('should create a new Business tier tenant with correct quotas', async () => {
      const tenantData = {
        name: 'Test School Business',
        subdomain: 'test-school-business',
        tier: 'Business'
      };
      
      const response = await request(app)
        .post('/api/v1/tenants')
        .send(tenantData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      
      const tenant = response.body.data.tenant;
      expect(tenant.tier).toBe('Business');
      
      // Validate Business tier quotas
      const quotas = response.body.data.quotas;
      expect(quotas.max_students).toBe(5000);
      expect(quotas.max_storage_gb).toBe(100);
      expect(quotas.max_api_calls_per_day).toBe(100000);
      expect(quotas.max_concurrent_users).toBe(500);
      expect(quotas.backup_retention_days).toBe(90);
      expect(quotas.support_level).toBe('priority');
      
      createdTenantIds.push(tenant.tenant_id);
    });
    
    test('should create a new Enterprise tier tenant with unlimited quotas', async () => {
      const tenantData = {
        name: 'Test School Enterprise',
        subdomain: 'test-school-enterprise',
        tier: 'Enterprise'
      };
      
      const response = await request(app)
        .post('/api/v1/tenants')
        .send(tenantData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      
      const tenant = response.body.data.tenant;
      expect(tenant.tier).toBe('Enterprise');
      
      // Validate Enterprise tier quotas (unlimited = -1)
      const quotas = response.body.data.quotas;
      expect(quotas.max_students).toBe(-1);
      expect(quotas.max_storage_gb).toBe(-1);
      expect(quotas.max_api_calls_per_day).toBe(-1);
      expect(quotas.max_concurrent_users).toBe(-1);
      expect(quotas.backup_retention_days).toBe(365);
      expect(quotas.support_level).toBe('24/7');
      
      createdTenantIds.push(tenant.tenant_id);
    });
    
    test('should create tenant with optional metadata', async () => {
      const tenantData = {
        name: 'Test School with Metadata',
        subdomain: 'test-school-metadata',
        tier: 'Basic',
        metadata: {
          contact_email: 'admin@testschool.com',
          phone: '+1234567890',
          address: '123 Test St'
        }
      };
      
      const response = await request(app)
        .post('/api/v1/tenants')
        .send(tenantData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      
      const tenant = response.body.data.tenant;
      expect(tenant.metadata).toEqual(tenantData.metadata);
      
      createdTenantIds.push(tenant.tenant_id);
    });
    
    test('should reject duplicate subdomain', async () => {
      const tenantData = {
        name: 'Test School Duplicate',
        subdomain: 'test-duplicate-subdomain',
        tier: 'Basic'
      };
      
      // Create first tenant
      const firstResponse = await request(app)
        .post('/api/v1/tenants')
        .send(tenantData)
        .expect(201);
      
      createdTenantIds.push(firstResponse.body.data.tenant.tenant_id);
      
      // Try to create duplicate
      const response = await request(app)
        .post('/api/v1/tenants')
        .send(tenantData)
        .expect(409);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Conflict');
      expect(response.body.message).toBe('Subdomain already exists');
    });
    
    test('should reject invalid tier', async () => {
      const tenantData = {
        name: 'Test School Invalid Tier',
        subdomain: 'test-invalid-tier',
        tier: 'Premium' // Invalid tier
      };
      
      const response = await request(app)
        .post('/api/v1/tenants')
        .send(tenantData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('tier must be one of');
    });
    
    test('should reject missing required fields', async () => {
      const tenantData = {
        name: 'Test School Missing Fields'
        // Missing subdomain and tier
      };
      
      const response = await request(app)
        .post('/api/v1/tenants')
        .send(tenantData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Bad Request');
    });
    
    test('should reject invalid subdomain format', async () => {
      const tenantData = {
        name: 'Test School Invalid Subdomain',
        subdomain: 'Test_School!', // Invalid characters
        tier: 'Basic'
      };
      
      const response = await request(app)
        .post('/api/v1/tenants')
        .send(tenantData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('subdomain must be lowercase');
    });
    
    test('should reject reserved subdomain', async () => {
      const tenantData = {
        name: 'Test School Reserved',
        subdomain: 'admin', // Reserved subdomain
        tier: 'Basic'
      };
      
      const response = await request(app)
        .post('/api/v1/tenants')
        .send(tenantData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('reserved');
    });
  });
  
  describe('Database Schema Initialization', () => {
    test('should automatically create tenant_quotas record', async () => {
      const tenantData = {
        name: 'Test School Quotas',
        subdomain: 'test-school-quotas',
        tier: 'Basic'
      };
      
      const response = await request(app)
        .post('/api/v1/tenants')
        .send(tenantData)
        .expect(201);
      
      const tenantId = response.body.data.tenant.tenant_id;
      createdTenantIds.push(tenantId);
      
      // Verify quotas record exists in database
      const client = await getClient();
      try {
        const result = await client.query(
          'SELECT * FROM tenant_quotas WHERE tenant_id = $1',
          [tenantId]
        );
        
        expect(result.rowCount).toBe(1);
        expect(result.rows[0].tenant_id).toBe(tenantId);
        expect(result.rows[0].current_students).toBe(0);
        expect(result.rows[0].current_storage_gb).toBe('0.00');
        expect(result.rows[0].current_api_calls_today).toBe(0);
      } finally {
        client.release();
      }
    });
    
    test('should create audit log entry for tenant creation', async () => {
      const tenantData = {
        name: 'Test School Audit',
        subdomain: 'test-school-audit',
        tier: 'Basic'
      };
      
      const response = await request(app)
        .post('/api/v1/tenants')
        .send(tenantData)
        .expect(201);
      
      const tenantId = response.body.data.tenant.tenant_id;
      createdTenantIds.push(tenantId);
      
      // Verify audit log entry exists
      const client = await getClient();
      try {
        const result = await client.query(
          `SELECT * FROM audit_logs 
           WHERE tenant_id = $1 
           AND event_type = 'tenant' 
           AND event_action = 'created'`,
          [tenantId]
        );
        
        expect(result.rowCount).toBe(1);
        expect(result.rows[0].resource_type).toBe('tenant');
        expect(result.rows[0].resource_id).toBe(tenantId);
        expect(result.rows[0].actor_type).toBe('system');
      } finally {
        client.release();
      }
    });
  });
  
  describe('GET /api/v1/tenants/:tenantId', () => {
    test('should retrieve tenant by ID', async () => {
      // Create a tenant first
      const createResponse = await request(app)
        .post('/api/v1/tenants')
        .send({
          name: 'Test School Get',
          subdomain: 'test-school-get',
          tier: 'Basic'
        })
        .expect(201);
      
      const tenantId = createResponse.body.data.tenant.tenant_id;
      createdTenantIds.push(tenantId);
      
      // Retrieve the tenant
      const response = await request(app)
        .get(`/api/v1/tenants/${tenantId}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.tenant_id).toBe(tenantId);
      expect(response.body.data.name).toBe('Test School Get');
    });
    
    test('should return 404 for non-existent tenant', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000000';
      
      const response = await request(app)
        .get(`/api/v1/tenants/${fakeId}`)
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Tenant not found');
    });
    
    test('should return 400 for invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/v1/tenants/invalid-uuid')
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid tenant ID format');
    });
  });
  
  describe('GET /api/v1/tenants', () => {
    test('should list all tenants with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/tenants')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(20);
      expect(response.body.pagination.total).toBeGreaterThan(0);
    });
    
    test('should filter tenants by tier', async () => {
      const response = await request(app)
        .get('/api/v1/tenants?tier=Enterprise')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      response.body.data.forEach(tenant => {
        expect(tenant.tier).toBe('Enterprise');
      });
    });
    
    test('should respect pagination limits', async () => {
      const response = await request(app)
        .get('/api/v1/tenants?limit=5')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
      expect(response.body.pagination.limit).toBe(5);
    });
  });
  
  describe('End-to-End Tenant Creation Flow', () => {
    test('should complete full tenant provisioning workflow', async () => {
      // Step 1: Create tenant
      const createResponse = await request(app)
        .post('/api/v1/tenants')
        .send({
          name: 'Complete Flow School',
          subdomain: 'complete-flow-school',
          tier: 'Business',
          metadata: {
            contact: 'admin@completeflow.com'
          }
        })
        .expect(201);
      
      const tenantId = createResponse.body.data.tenant.tenant_id;
      createdTenantIds.push(tenantId);
      
      // Step 2: Verify tenant exists
      const getResponse = await request(app)
        .get(`/api/v1/tenants/${tenantId}`)
        .expect(200);
      
      expect(getResponse.body.data.tenant_id).toBe(tenantId);
      
      // Step 3: Verify quotas are configured
      expect(getResponse.body.data.max_students).toBe(5000);
      expect(getResponse.body.data.support_level).toBe('priority');
      
      // Step 4: Verify tenant appears in list
      const listResponse = await request(app)
        .get('/api/v1/tenants')
        .expect(200);
      
      const foundTenant = listResponse.body.data.find(t => t.tenant_id === tenantId);
      expect(foundTenant).toBeDefined();
      expect(foundTenant.name).toBe('Complete Flow School');
    });
  });
});
