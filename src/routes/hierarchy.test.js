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
  
  // ============================================================================
  // HIERARCHY NAVIGATION TESTS (Task 2.1.2)
  // ============================================================================
  
  describe('Hierarchy Navigation', () => {
    // Recreate test entities for navigation tests (they were deleted in cascade tests)
    beforeAll(async () => {
      // Create institute
      const instituteRes = await request(app)
        .post('/api/v1/hierarchy/institutes')
        .set('x-tenant-id', testTenantId)
        .send({
          name: 'Navigation Test Institute',
          code: 'NAV-INST-001'
        });
      testInstituteId = instituteRes.body.data.institute_id;
      
      // Create center
      const centerRes = await request(app)
        .post('/api/v1/hierarchy/centers')
        .set('x-tenant-id', testTenantId)
        .send({
          instituteId: testInstituteId,
          name: 'Navigation Test Center',
          code: 'NAV-CTR-001'
        });
      testCenterId = centerRes.body.data.center_id;
      
      // Create program
      const programRes = await request(app)
        .post('/api/v1/hierarchy/programs')
        .set('x-tenant-id', testTenantId)
        .send({
          centerId: testCenterId,
          name: 'Navigation Test Program',
          code: 'NAV-PRG-001',
          durationMonths: 12
        });
      testProgramId = programRes.body.data.program_id;
      
      // Create batch
      const batchRes = await request(app)
        .post('/api/v1/hierarchy/batches')
        .set('x-tenant-id', testTenantId)
        .send({
          programId: testProgramId,
          name: 'Navigation Test Batch',
          code: 'NAV-BCH-001',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          capacity: 30
        });
      testBatchId = batchRes.body.data.batch_id;
    });
  
  describe('GET /api/v1/hierarchy/:nodeId/children', () => {
    it('should get children of an institute (centers)', async () => {
      const response = await request(app)
        .get(`/api/v1/hierarchy/${testInstituteId}/children`)
        .set('x-tenant-id', testTenantId)
        .query({ entityType: 'institute' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.node_id).toBe(testInstituteId);
      expect(response.body.data.entity_type).toBe('institute');
      expect(Array.isArray(response.body.data.children)).toBe(true);
      expect(response.body.data.children_count).toBeGreaterThanOrEqual(0);
    });
    
    it('should get children of a center (programs)', async () => {
      const response = await request(app)
        .get(`/api/v1/hierarchy/${testCenterId}/children`)
        .set('x-tenant-id', testTenantId)
        .query({ entityType: 'center' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.entity_type).toBe('center');
      expect(Array.isArray(response.body.data.children)).toBe(true);
    });
    
    it('should get children of a program (batches)', async () => {
      const response = await request(app)
        .get(`/api/v1/hierarchy/${testProgramId}/children`)
        .set('x-tenant-id', testTenantId)
        .query({ entityType: 'program' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.entity_type).toBe('program');
      expect(Array.isArray(response.body.data.children)).toBe(true);
    });
    
    it('should return empty array for batch children', async () => {
      const response = await request(app)
        .get(`/api/v1/hierarchy/${testBatchId}/children`)
        .set('x-tenant-id', testTenantId)
        .query({ entityType: 'batch' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.children).toEqual([]);
      expect(response.body.data.children_count).toBe(0);
    });
    
    it('should reject request without entityType', async () => {
      const response = await request(app)
        .get(`/api/v1/hierarchy/${testInstituteId}/children`)
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('entityType');
    });
    
    it('should reject invalid entityType', async () => {
      const response = await request(app)
        .get(`/api/v1/hierarchy/${testInstituteId}/children`)
        .set('x-tenant-id', testTenantId)
        .query({ entityType: 'invalid' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    it('should reject invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/v1/hierarchy/not-a-uuid/children')
        .set('x-tenant-id', testTenantId)
        .query({ entityType: 'institute' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/v1/hierarchy/:nodeId/ancestors', () => {
    it('should return empty array for institute ancestors', async () => {
      const response = await request(app)
        .get(`/api/v1/hierarchy/${testInstituteId}/ancestors`)
        .set('x-tenant-id', testTenantId)
        .query({ entityType: 'institute' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.ancestors).toEqual([]);
      expect(response.body.data.ancestors_count).toBe(0);
    });
    
    it('should get ancestors of a center (institute)', async () => {
      const response = await request(app)
        .get(`/api/v1/hierarchy/${testCenterId}/ancestors`)
        .set('x-tenant-id', testTenantId)
        .query({ entityType: 'center' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.entity_type).toBe('center');
      expect(Array.isArray(response.body.data.ancestors)).toBe(true);
      expect(response.body.data.ancestors_count).toBe(1);
      expect(response.body.data.ancestors[0].entity_type).toBe('institute');
    });
    
    it('should get ancestors of a program (center, institute)', async () => {
      const response = await request(app)
        .get(`/api/v1/hierarchy/${testProgramId}/ancestors`)
        .set('x-tenant-id', testTenantId)
        .query({ entityType: 'program' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.ancestors_count).toBe(2);
      expect(response.body.data.ancestors[0].entity_type).toBe('institute');
      expect(response.body.data.ancestors[1].entity_type).toBe('center');
    });
    
    it('should get ancestors of a batch (program, center, institute)', async () => {
      const response = await request(app)
        .get(`/api/v1/hierarchy/${testBatchId}/ancestors`)
        .set('x-tenant-id', testTenantId)
        .query({ entityType: 'batch' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.ancestors_count).toBe(3);
      expect(response.body.data.ancestors[0].entity_type).toBe('institute');
      expect(response.body.data.ancestors[1].entity_type).toBe('center');
      expect(response.body.data.ancestors[2].entity_type).toBe('program');
    });
    
    it('should reject request without entityType', async () => {
      const response = await request(app)
        .get(`/api/v1/hierarchy/${testBatchId}/ancestors`)
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    it('should return 404 for non-existent node', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000000';
      const response = await request(app)
        .get(`/api/v1/hierarchy/${fakeId}/ancestors`)
        .set('x-tenant-id', testTenantId)
        .query({ entityType: 'batch' });
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/v1/hierarchy/tree', () => {
    it('should get full hierarchy tree for tenant', async () => {
      const response = await request(app)
        .get('/api/v1/hierarchy/tree')
        .set('x-tenant-id', testTenantId);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tenant_id).toBe(testTenantId);
      expect(Array.isArray(response.body.data.tree)).toBe(true);
      
      // Verify tree structure
      if (response.body.data.tree.length > 0) {
        const institute = response.body.data.tree[0];
        expect(institute.entity_type).toBe('institute');
        expect(institute.entity_id).toBeDefined();
        expect(Array.isArray(institute.children)).toBe(true);
        
        if (institute.children.length > 0) {
          const center = institute.children[0];
          expect(center.entity_type).toBe('center');
          expect(Array.isArray(center.children)).toBe(true);
        }
      }
    });
    
    it('should include inactive entities when requested', async () => {
      const response = await request(app)
        .get('/api/v1/hierarchy/tree')
        .set('x-tenant-id', testTenantId)
        .query({ includeInactive: 'true' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
  
  describe('POST /api/v1/hierarchy/permissions/resolve', () => {
    it('should resolve field permissions with global only', async () => {
      const fieldConfig = {
        global_permissions: {
          visible_to_roles: ['admin', 'teacher', 'student'],
          editable_by_roles: ['admin']
        }
      };
      
      const userContext = {
        institute_id: testInstituteId
      };
      
      const response = await request(app)
        .post('/api/v1/hierarchy/permissions/resolve')
        .set('x-tenant-id', testTenantId)
        .send({ fieldConfig, userContext });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.visible_to_roles).toEqual(['admin', 'teacher', 'student']);
      expect(response.body.data.editable_by_roles).toEqual(['admin']);
    });
    
    it('should restrict permissions at institute level', async () => {
      const fieldConfig = {
        global_permissions: {
          visible_to_roles: ['admin', 'teacher', 'student'],
          editable_by_roles: ['admin', 'teacher']
        },
        institute_overrides: {
          [testInstituteId]: {
            visible_to_roles: ['admin', 'teacher'],
            editable_by_roles: ['admin']
          }
        }
      };
      
      const userContext = {
        institute_id: testInstituteId
      };
      
      const response = await request(app)
        .post('/api/v1/hierarchy/permissions/resolve')
        .set('x-tenant-id', testTenantId)
        .send({ fieldConfig, userContext });
      
      expect(response.status).toBe(200);
      expect(response.body.data.visible_to_roles).toEqual(['admin', 'teacher']);
      expect(response.body.data.editable_by_roles).toEqual(['admin']);
    });
    
    it('should apply cascading restrictions through hierarchy', async () => {
      const fieldConfig = {
        global_permissions: {
          visible_to_roles: ['admin', 'teacher', 'student'],
          editable_by_roles: ['admin', 'teacher']
        },
        institute_overrides: {
          [testInstituteId]: {
            visible_to_roles: ['admin', 'teacher'],
            editable_by_roles: ['admin']
          }
        },
        center_overrides: {
          [testCenterId]: {
            visible_to_roles: ['admin'],
            editable_by_roles: ['admin']
          }
        }
      };
      
      const userContext = {
        institute_id: testInstituteId,
        center_id: testCenterId
      };
      
      const response = await request(app)
        .post('/api/v1/hierarchy/permissions/resolve')
        .set('x-tenant-id', testTenantId)
        .send({ fieldConfig, userContext });
      
      expect(response.status).toBe(200);
      expect(response.body.data.visible_to_roles).toEqual(['admin']);
      expect(response.body.data.editable_by_roles).toEqual(['admin']);
    });
    
    it('should reject request without required fields', async () => {
      const response = await request(app)
        .post('/api/v1/hierarchy/permissions/resolve')
        .set('x-tenant-id', testTenantId)
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
  
  // ============================================================================
  // PERFORMANCE TESTS (Task 2.1.2 - < 50ms for 10,000 nodes)
  // ============================================================================
  
  describe('Performance Tests', () => {
    it('should fetch children in under 50ms', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get(`/api/v1/hierarchy/${testInstituteId}/children`)
        .set('x-tenant-id', testTenantId)
        .query({ entityType: 'institute' });
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50);
    });
    
    it('should fetch ancestors in under 50ms', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get(`/api/v1/hierarchy/${testBatchId}/ancestors`)
        .set('x-tenant-id', testTenantId)
        .query({ entityType: 'batch' });
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50);
    });
  });
  }); // End of Hierarchy Navigation describe block
});
