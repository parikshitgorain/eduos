/**
 * Hierarchy Routes Tests
 * 
 * Tests for Institute → Center → Program → Batch hierarchy API endpoints.
 * 
 * Task: 2.1.1 - Implement Institute → Center → Program → Batch entity tree
 */

const request = require('supertest');
const app = require('../server');
const { query, transaction } = require('../config/database');

describe('Hierarchy API', () => {
  let testTenantId;
  let testInstituteId;
  let testCenterId;
  let testProgramId;
  let testBatchId;
  
  // Setup: Create a test tenant
  beforeAll(async () => {
    const result = await query(
      `INSERT INTO tenants (name, subdomain, tier)
       VALUES ($1, $2, $3)
       RETURNING tenant_id`,
      ['Test Hierarchy Tenant', 'test-hierarchy', 'Basic']
    );
    testTenantId = result.rows[0].tenant_id;
  });
  
  // Cleanup: Remove test data
  afterAll(async () => {
    await query('DELETE FROM tenants WHERE tenant_id = $1', [testTenantId]);
  });
  
  // ============================================================================
  // INSTITUTE TESTS
  // ============================================================================
  
  describe('POST /api/v1/hierarchy/institutes', () => {
    it('should create a new institute', async () => {
      const response = await request(app)
        .post('/api/v1/hierarchy/institutes')
        .set('x-tenant-id', testTenantId)
        .send({
          name: 'Main Institute',
          code: 'MAIN-001',
          metadata: { location: 'New York' }
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Main Institute');
      expect(response.body.data.code).toBe('MAIN-001');
      expect(response.body.data.institute_id).toBeDefined();
      
      testInstituteId = response.body.data.institute_id;
    });
    
    it('should reject institute creation without name', async () => {
      const response = await request(app)
        .post('/api/v1/hierarchy/institutes')
        .set('x-tenant-id', testTenantId)
        .send({
          code: 'NO-NAME'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    it('should reject duplicate institute code', async () => {
      const response = await request(app)
        .post('/api/v1/hierarchy/institutes')
        .set('x-tenant-id', testTenantId)
        .send({
          name: 'Duplicate Institute',
          code: 'MAIN-001'
        });
      
      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/v1/hierarchy/institutes', () => {
    it('should list all institutes for tenant', async () => {
      const response = await request(app)
        .get('/api/v1/hierarchy/institutes')
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.pagination).toBeDefined();
    });
    
    it('should filter institutes by status', async () => {
      const response = await request(app)
        .get('/api/v1/hierarchy/institutes?status=active')
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
  
  describe('GET /api/v1/hierarchy/institutes/:instituteId', () => {
    it('should get institute by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/hierarchy/institutes/${testInstituteId}`)
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.institute_id).toBe(testInstituteId);
      expect(response.body.data.name).toBe('Main Institute');
    });
    
    it('should return 404 for non-existent institute', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000000';
      const response = await request(app)
        .get(`/api/v1/hierarchy/institutes/${fakeId}`)
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('PATCH /api/v1/hierarchy/institutes/:instituteId', () => {
    it('should update institute', async () => {
      const response = await request(app)
        .patch(`/api/v1/hierarchy/institutes/${testInstituteId}`)
        .set('x-tenant-id', testTenantId)
        .send({
          name: 'Updated Institute Name',
          metadata: { location: 'Boston' }
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Institute Name');
    });
  });
  
  // ============================================================================
  // CENTER TESTS
  // ============================================================================
  
  describe('POST /api/v1/hierarchy/centers', () => {
    it('should create a new center', async () => {
      const response = await request(app)
        .post('/api/v1/hierarchy/centers')
        .set('x-tenant-id', testTenantId)
        .send({
          instituteId: testInstituteId,
          name: 'Downtown Center',
          code: 'DT-001',
          metadata: { address: '123 Main St' }
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Downtown Center');
      expect(response.body.data.institute_id).toBe(testInstituteId);
      
      testCenterId = response.body.data.center_id;
    });
    
    it('should reject center without institute_id', async () => {
      const response = await request(app)
        .post('/api/v1/hierarchy/centers')
        .set('x-tenant-id', testTenantId)
        .send({
          name: 'Orphan Center'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    it('should reject center with non-existent institute', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000000';
      const response = await request(app)
        .post('/api/v1/hierarchy/centers')
        .set('x-tenant-id', testTenantId)
        .send({
          instituteId: fakeId,
          name: 'Invalid Center'
        });
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/v1/hierarchy/centers', () => {
    it('should list all centers for tenant', async () => {
      const response = await request(app)
        .get('/api/v1/hierarchy/centers')
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
    
    it('should filter centers by institute', async () => {
      const response = await request(app)
        .get(`/api/v1/hierarchy/centers?instituteId=${testInstituteId}`)
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.every(c => c.institute_id === testInstituteId)).toBe(true);
    });
  });
  
  describe('GET /api/v1/hierarchy/centers/:centerId', () => {
    it('should get center by ID with institute name', async () => {
      const response = await request(app)
        .get(`/api/v1/hierarchy/centers/${testCenterId}`)
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.center_id).toBe(testCenterId);
      expect(response.body.data.institute_name).toBeDefined();
    });
  });
  
  // ============================================================================
  // PROGRAM TESTS
  // ============================================================================
  
  describe('POST /api/v1/hierarchy/programs', () => {
    it('should create a new program', async () => {
      const response = await request(app)
        .post('/api/v1/hierarchy/programs')
        .set('x-tenant-id', testTenantId)
        .send({
          centerId: testCenterId,
          name: 'Computer Science',
          code: 'CS-101',
          durationMonths: 48,
          metadata: { degree: 'Bachelor' }
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Computer Science');
      expect(response.body.data.center_id).toBe(testCenterId);
      expect(response.body.data.duration_months).toBe(48);
      
      testProgramId = response.body.data.program_id;
    });
    
    it('should reject program without center_id', async () => {
      const response = await request(app)
        .post('/api/v1/hierarchy/programs')
        .set('x-tenant-id', testTenantId)
        .send({
          name: 'Orphan Program'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/v1/hierarchy/programs', () => {
    it('should list all programs for tenant', async () => {
      const response = await request(app)
        .get('/api/v1/hierarchy/programs')
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('should filter programs by center', async () => {
      const response = await request(app)
        .get(`/api/v1/hierarchy/programs?centerId=${testCenterId}`)
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.every(p => p.center_id === testCenterId)).toBe(true);
    });
  });
  
  describe('GET /api/v1/hierarchy/programs/:programId', () => {
    it('should get program by ID with full hierarchy', async () => {
      const response = await request(app)
        .get(`/api/v1/hierarchy/programs/${testProgramId}`)
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.program_id).toBe(testProgramId);
      expect(response.body.data.center_name).toBeDefined();
      expect(response.body.data.institute_name).toBeDefined();
    });
  });
  
  // ============================================================================
  // BATCH TESTS
  // ============================================================================
  
  describe('POST /api/v1/hierarchy/batches', () => {
    it('should create a new batch', async () => {
      const response = await request(app)
        .post('/api/v1/hierarchy/batches')
        .set('x-tenant-id', testTenantId)
        .send({
          programId: testProgramId,
          name: 'Batch 2024',
          code: 'CS-2024-A',
          startDate: '2024-09-01',
          endDate: '2028-06-30',
          capacity: 50,
          metadata: { semester: 'Fall' }
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Batch 2024');
      expect(response.body.data.program_id).toBe(testProgramId);
      expect(response.body.data.capacity).toBe(50);
      
      testBatchId = response.body.data.batch_id;
    });
    
    it('should reject batch without program_id', async () => {
      const response = await request(app)
        .post('/api/v1/hierarchy/batches')
        .set('x-tenant-id', testTenantId)
        .send({
          name: 'Orphan Batch'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/v1/hierarchy/batches', () => {
    it('should list all batches for tenant', async () => {
      const response = await request(app)
        .get('/api/v1/hierarchy/batches')
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('should filter batches by program', async () => {
      const response = await request(app)
        .get(`/api/v1/hierarchy/batches?programId=${testProgramId}`)
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.every(b => b.program_id === testProgramId)).toBe(true);
    });
  });
  
  describe('GET /api/v1/hierarchy/batches/:batchId', () => {
    it('should get batch by ID with full hierarchy', async () => {
      const response = await request(app)
        .get(`/api/v1/hierarchy/batches/${testBatchId}`)
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.batch_id).toBe(testBatchId);
      expect(response.body.data.program_name).toBeDefined();
      expect(response.body.data.center_name).toBeDefined();
      expect(response.body.data.institute_name).toBeDefined();
    });
  });
  
  describe('PATCH /api/v1/hierarchy/batches/:batchId', () => {
    it('should update batch', async () => {
      const response = await request(app)
        .patch(`/api/v1/hierarchy/batches/${testBatchId}`)
        .set('x-tenant-id', testTenantId)
        .send({
          capacity: 60,
          status: 'active'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.capacity).toBe(60);
    });
  });
  
  // ============================================================================
  // CASCADE DELETE PROTECTION TESTS
  // ============================================================================
  
  describe('Cascade Delete Protection', () => {
    it('should prevent deleting institute with centers', async () => {
      const response = await request(app)
        .delete(`/api/v1/hierarchy/institutes/${testInstituteId}`)
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Cannot delete institute');
    });
    
    it('should prevent deleting center with programs', async () => {
      const response = await request(app)
        .delete(`/api/v1/hierarchy/centers/${testCenterId}`)
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Cannot delete center');
    });
    
    it('should prevent deleting program with batches', async () => {
      const response = await request(app)
        .delete(`/api/v1/hierarchy/programs/${testProgramId}`)
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Cannot delete program');
    });
    
    it('should allow deleting batch (leaf node)', async () => {
      const response = await request(app)
        .delete(`/api/v1/hierarchy/batches/${testBatchId}`)
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should allow deleting program after batches removed', async () => {
      const response = await request(app)
        .delete(`/api/v1/hierarchy/programs/${testProgramId}`)
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should allow deleting center after programs removed', async () => {
      const response = await request(app)
        .delete(`/api/v1/hierarchy/centers/${testCenterId}`)
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should allow deleting institute after centers removed', async () => {
      const response = await request(app)
        .delete(`/api/v1/hierarchy/institutes/${testInstituteId}`)
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
  
  // ============================================================================
  // VALIDATION TESTS
  // ============================================================================
  
  describe('Validation', () => {
    it('should reject requests without tenant_id', async () => {
      const response = await request(app)
        .get('/api/v1/hierarchy/institutes');
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Tenant ID is required');
    });
    
    it('should reject invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/v1/hierarchy/institutes/invalid-uuid')
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    it('should enforce pagination limits', async () => {
      const response = await request(app)
        .get('/api/v1/hierarchy/institutes?limit=200')
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Limit cannot exceed 100');
    });
  });
});
