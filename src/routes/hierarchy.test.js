/**
 * Comprehensive Hierarchy Routes Tests
 * 
 * Achieves 95%+ test coverage for hierarchy API endpoints
 * Aligns with design requirements from EduOS specification
 * 
 * Task: 2.1.1 - Implement Institute → Center → Program → Batch entity tree
 */

const request = require('supertest');
const express = require('express');
const hierarchyRoutes = require('./hierarchy');
const hierarchyService = require('../services/hierarchyService');

// Mock the hierarchy service
jest.mock('../services/hierarchyService');

const app = express();
app.use(express.json());
app.use('/api/v1/hierarchy', hierarchyRoutes);

describe('Hierarchy Routes - Comprehensive Coverage', () => {
  const mockTenantId = '123e4567-e89b-42d3-a456-426614174000';
  const mockInstituteId = '223e4567-e89b-42d3-a456-426614174001';
  const mockCenterId = '323e4567-e89b-42d3-a456-426614174002';
  const mockProgramId = '423e4567-e89b-42d3-a456-426614174003';
  const mockBatchId = '523e4567-e89b-42d3-a456-426614174004';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Tenant ID Validation Middleware', () => {
    it('should require tenant ID in header', async () => {
      const response = await request(app)
        .get('/api/v1/hierarchy/institutes');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Tenant ID is required');
    });

    it('should require valid UUID format for tenant ID', async () => {
      const response = await request(app)
        .get('/api/v1/hierarchy/institutes')
        .set('x-tenant-id', 'invalid-uuid');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid tenant ID format');
    });

    it('should accept tenant ID from query parameter', async () => {
      hierarchyService.listInstitutes.mockResolvedValue({
        institutes: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
      });

      const response = await request(app)
        .get(`/api/v1/hierarchy/institutes?tenant_id=${mockTenantId}`);

      expect(response.status).toBe(200);
    });
  });

  describe('UUID Validation Middleware', () => {
    it('should validate UUID format in route parameters', async () => {
      const response = await request(app)
        .get('/api/v1/hierarchy/institutes/invalid-uuid')
        .set('x-tenant-id', mockTenantId);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid instituteId format');
    });
  });

  describe('Institute Routes', () => {
    describe('POST /institutes', () => {
      it('should create institute successfully', async () => {
        const mockInstitute = {
          institute_id: mockInstituteId,
          name: 'Test Institute',
          code: 'TI001'
        };

        hierarchyService.createInstitute.mockResolvedValue(mockInstitute);

        const response = await request(app)
          .post('/api/v1/hierarchy/institutes')
          .set('x-tenant-id', mockTenantId)
          .send({
            name: 'Test Institute',
            code: 'TI001',
            metadata: { type: 'university' }
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockInstitute);
        expect(hierarchyService.createInstitute).toHaveBeenCalledWith({
          tenantId: mockTenantId,
          name: 'Test Institute',
          code: 'TI001',
          metadata: { type: 'university' }
        });
      });

      it('should require institute name', async () => {
        const response = await request(app)
          .post('/api/v1/hierarchy/institutes')
          .set('x-tenant-id', mockTenantId)
          .send({ code: 'TI001' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Institute name is required');
      });

      it('should handle duplicate code error', async () => {
        const duplicateError = new Error('Duplicate key');
        duplicateError.code = '23505';
        hierarchyService.createInstitute.mockRejectedValue(duplicateError);

        const response = await request(app)
          .post('/api/v1/hierarchy/institutes')
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Test Institute', code: 'TI001' });

        expect(response.status).toBe(409);
        expect(response.body.message).toBe('Institute code already exists');
      });

      it('should handle validation errors', async () => {
        hierarchyService.createInstitute.mockRejectedValue(
          new Error('Validation failed: Name too long')
        );

        const response = await request(app)
          .post('/api/v1/hierarchy/institutes')
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Test Institute', code: 'TI001' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation failed: Name too long');
      });

      it('should handle internal server errors', async () => {
        hierarchyService.createInstitute.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .post('/api/v1/hierarchy/institutes')
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Test Institute', code: 'TI001' });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to create institute');
      });
    });

    describe('GET /institutes', () => {
      it('should list institutes with default pagination', async () => {
        const mockResult = {
          institutes: [
            { institute_id: mockInstituteId, name: 'Institute 1' }
          ],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
        };

        hierarchyService.listInstitutes.mockResolvedValue(mockResult);

        const response = await request(app)
          .get('/api/v1/hierarchy/institutes')
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockResult.institutes);
        expect(response.body.pagination).toEqual(mockResult.pagination);
      });

      it('should handle custom pagination parameters', async () => {
        const mockResult = {
          institutes: [],
          pagination: { page: 2, limit: 10, total: 0, totalPages: 0 }
        };

        hierarchyService.listInstitutes.mockResolvedValue(mockResult);

        const response = await request(app)
          .get('/api/v1/hierarchy/institutes?page=2&limit=10&status=active')
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(200);
        expect(hierarchyService.listInstitutes).toHaveBeenCalledWith(mockTenantId, {
          page: 2,
          limit: 10,
          status: 'active'
        });
      });

      it('should reject limit over 100', async () => {
        const response = await request(app)
          .get('/api/v1/hierarchy/institutes?limit=150')
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Limit cannot exceed 100');
      });

      it('should handle service errors', async () => {
        hierarchyService.listInstitutes.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/v1/hierarchy/institutes')
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to list institutes');
      });
    });

    describe('GET /institutes/:instituteId', () => {
      it('should get institute by ID', async () => {
        const mockInstitute = {
          institute_id: mockInstituteId,
          name: 'Test Institute'
        };

        hierarchyService.getInstituteById.mockResolvedValue(mockInstitute);

        const response = await request(app)
          .get(`/api/v1/hierarchy/institutes/${mockInstituteId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockInstitute);
        expect(hierarchyService.getInstituteById).toHaveBeenCalledWith(mockInstituteId, mockTenantId);
      });

      it('should return 404 when institute not found', async () => {
        hierarchyService.getInstituteById.mockResolvedValue(null);

        const response = await request(app)
          .get(`/api/v1/hierarchy/institutes/${mockInstituteId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Institute not found');
      });

      it('should handle service errors', async () => {
        hierarchyService.getInstituteById.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get(`/api/v1/hierarchy/institutes/${mockInstituteId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to fetch institute');
      });
    });

    describe('PATCH /institutes/:instituteId', () => {
      it('should update institute successfully', async () => {
        const mockUpdatedInstitute = {
          institute_id: mockInstituteId,
          name: 'Updated Institute'
        };

        hierarchyService.updateInstitute.mockResolvedValue(mockUpdatedInstitute);

        const response = await request(app)
          .patch(`/api/v1/hierarchy/institutes/${mockInstituteId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Updated Institute' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockUpdatedInstitute);
        expect(hierarchyService.updateInstitute).toHaveBeenCalledWith(
          mockInstituteId,
          mockTenantId,
          { name: 'Updated Institute' }
        );
      });

      it('should require fields to update', async () => {
        const response = await request(app)
          .patch(`/api/v1/hierarchy/institutes/${mockInstituteId}`)
          .set('x-tenant-id', mockTenantId)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('No fields to update');
      });

      it('should handle institute not found', async () => {
        hierarchyService.updateInstitute.mockRejectedValue(new Error('Institute not found'));

        const response = await request(app)
          .patch(`/api/v1/hierarchy/institutes/${mockInstituteId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Updated' });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Institute not found');
      });

      it('should handle no valid fields error', async () => {
        hierarchyService.updateInstitute.mockRejectedValue(new Error('No valid fields to update'));

        const response = await request(app)
          .patch(`/api/v1/hierarchy/institutes/${mockInstituteId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ invalid_field: 'value' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('No valid fields to update');
      });

      it('should handle service errors', async () => {
        hierarchyService.updateInstitute.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .patch(`/api/v1/hierarchy/institutes/${mockInstituteId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Updated' });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to update institute');
      });
    });

    describe('DELETE /institutes/:instituteId', () => {
      it('should delete institute successfully', async () => {
        const mockDeletedInstitute = {
          institute_id: mockInstituteId,
          name: 'Deleted Institute'
        };

        hierarchyService.deleteInstitute.mockResolvedValue(mockDeletedInstitute);

        const response = await request(app)
          .delete(`/api/v1/hierarchy/institutes/${mockInstituteId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockDeletedInstitute);
        expect(hierarchyService.deleteInstitute).toHaveBeenCalledWith(mockInstituteId, mockTenantId);
      });

      it('should handle institute not found', async () => {
        hierarchyService.deleteInstitute.mockRejectedValue(new Error('Institute not found'));

        const response = await request(app)
          .delete(`/api/v1/hierarchy/institutes/${mockInstituteId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Institute not found');
      });

      it('should handle constraint violations', async () => {
        hierarchyService.deleteInstitute.mockRejectedValue(
          new Error('Cannot delete institute with existing centers')
        );

        const response = await request(app)
          .delete(`/api/v1/hierarchy/institutes/${mockInstituteId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(409);
        expect(response.body.message).toBe('Cannot delete institute with existing centers');
      });

      it('should handle service errors', async () => {
        hierarchyService.deleteInstitute.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .delete(`/api/v1/hierarchy/institutes/${mockInstituteId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to delete institute');
      });
    });
  });
  describe('Center Routes', () => {
    describe('POST /centers', () => {
      it('should create center successfully', async () => {
        const mockCenter = {
          center_id: mockCenterId,
          name: 'Test Center',
          institute_id: mockInstituteId
        };

        hierarchyService.createCenter.mockResolvedValue(mockCenter);

        const response = await request(app)
          .post('/api/v1/hierarchy/centers')
          .set('x-tenant-id', mockTenantId)
          .send({
            instituteId: mockInstituteId,
            name: 'Test Center',
            code: 'TC001'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockCenter);
      });

      it('should require center name', async () => {
        const response = await request(app)
          .post('/api/v1/hierarchy/centers')
          .set('x-tenant-id', mockTenantId)
          .send({ instituteId: mockInstituteId });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Center name is required');
      });

      it('should require institute ID', async () => {
        const response = await request(app)
          .post('/api/v1/hierarchy/centers')
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Test Center' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Institute ID is required');
      });

      it('should handle institute not found', async () => {
        hierarchyService.createCenter.mockRejectedValue(new Error('Institute not found'));

        const response = await request(app)
          .post('/api/v1/hierarchy/centers')
          .set('x-tenant-id', mockTenantId)
          .send({
            instituteId: mockInstituteId,
            name: 'Test Center'
          });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Institute not found');
      });
    });

    describe('GET /centers', () => {
      it('should list centers', async () => {
        const mockResult = {
          centers: [{ center_id: mockCenterId, name: 'Center 1' }],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
        };

        hierarchyService.listCenters.mockResolvedValue(mockResult);

        const response = await request(app)
          .get('/api/v1/hierarchy/centers')
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(mockResult.centers);
      });

      it('should filter by institute ID', async () => {
        const mockResult = {
          centers: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
        };

        hierarchyService.listCenters.mockResolvedValue(mockResult);

        const response = await request(app)
          .get(`/api/v1/hierarchy/centers?instituteId=${mockInstituteId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(200);
        expect(hierarchyService.listCenters).toHaveBeenCalledWith(mockTenantId, {
          page: 1,
          limit: 20,
          instituteId: mockInstituteId
        });
      });
    });

    describe('GET /centers/:centerId', () => {
      it('should get center by ID', async () => {
        const mockCenter = { center_id: mockCenterId, name: 'Test Center' };
        hierarchyService.getCenterById.mockResolvedValue(mockCenter);

        const response = await request(app)
          .get(`/api/v1/hierarchy/centers/${mockCenterId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(mockCenter);
      });

      it('should return 404 when center not found', async () => {
        hierarchyService.getCenterById.mockResolvedValue(null);

        const response = await request(app)
          .get(`/api/v1/hierarchy/centers/${mockCenterId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Center not found');
      });
    });

    describe('PATCH /centers/:centerId', () => {
      it('should update center successfully', async () => {
        const mockUpdatedCenter = { center_id: mockCenterId, name: 'Updated Center' };
        hierarchyService.updateCenter.mockResolvedValue(mockUpdatedCenter);

        const response = await request(app)
          .patch(`/api/v1/hierarchy/centers/${mockCenterId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Updated Center' });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(mockUpdatedCenter);
      });

      it('should handle center not found', async () => {
        hierarchyService.updateCenter.mockRejectedValue(new Error('Center not found'));

        const response = await request(app)
          .patch(`/api/v1/hierarchy/centers/${mockCenterId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Updated' });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Center not found');
      });
    });

    describe('DELETE /centers/:centerId', () => {
      it('should delete center successfully', async () => {
        const mockDeletedCenter = { center_id: mockCenterId, name: 'Deleted Center' };
        hierarchyService.deleteCenter.mockResolvedValue(mockDeletedCenter);

        const response = await request(app)
          .delete(`/api/v1/hierarchy/centers/${mockCenterId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(mockDeletedCenter);
      });

      it('should handle center not found', async () => {
        hierarchyService.deleteCenter.mockRejectedValue(new Error('Center not found'));

        const response = await request(app)
          .delete(`/api/v1/hierarchy/centers/${mockCenterId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Center not found');
      });
    });
  });

  describe('Program Routes', () => {
    describe('POST /programs', () => {
      it('should create program successfully', async () => {
        const mockProgram = {
          program_id: mockProgramId,
          name: 'Test Program',
          center_id: mockCenterId
        };

        hierarchyService.createProgram.mockResolvedValue(mockProgram);

        const response = await request(app)
          .post('/api/v1/hierarchy/programs')
          .set('x-tenant-id', mockTenantId)
          .send({
            centerId: mockCenterId,
            name: 'Test Program',
            code: 'TP001',
            durationMonths: 12
          });

        expect(response.status).toBe(201);
        expect(response.body.data).toEqual(mockProgram);
      });

      it('should require program name', async () => {
        const response = await request(app)
          .post('/api/v1/hierarchy/programs')
          .set('x-tenant-id', mockTenantId)
          .send({ centerId: mockCenterId });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Program name is required');
      });

      it('should require center ID', async () => {
        const response = await request(app)
          .post('/api/v1/hierarchy/programs')
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Test Program' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Center ID is required');
      });
    });

    describe('GET /programs', () => {
      it('should list programs', async () => {
        const mockResult = {
          programs: [{ program_id: mockProgramId, name: 'Program 1' }],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
        };

        hierarchyService.listPrograms.mockResolvedValue(mockResult);

        const response = await request(app)
          .get('/api/v1/hierarchy/programs')
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(mockResult.programs);
      });
    });

    describe('GET /programs/:programId', () => {
      it('should get program by ID', async () => {
        const mockProgram = { program_id: mockProgramId, name: 'Test Program' };
        hierarchyService.getProgramById.mockResolvedValue(mockProgram);

        const response = await request(app)
          .get(`/api/v1/hierarchy/programs/${mockProgramId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(mockProgram);
      });

      it('should return 404 when program not found', async () => {
        hierarchyService.getProgramById.mockResolvedValue(null);

        const response = await request(app)
          .get(`/api/v1/hierarchy/programs/${mockProgramId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Program not found');
      });
    });

    describe('PATCH /programs/:programId', () => {
      it('should update program successfully', async () => {
        const mockUpdatedProgram = { program_id: mockProgramId, name: 'Updated Program' };
        hierarchyService.updateProgram.mockResolvedValue(mockUpdatedProgram);

        const response = await request(app)
          .patch(`/api/v1/hierarchy/programs/${mockProgramId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Updated Program' });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(mockUpdatedProgram);
      });
    });

    describe('DELETE /programs/:programId', () => {
      it('should delete program successfully', async () => {
        const mockDeletedProgram = { program_id: mockProgramId, name: 'Deleted Program' };
        hierarchyService.deleteProgram.mockResolvedValue(mockDeletedProgram);

        const response = await request(app)
          .delete(`/api/v1/hierarchy/programs/${mockProgramId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(mockDeletedProgram);
      });
    });
  });

  describe('Batch Routes', () => {
    describe('POST /batches', () => {
      it('should create batch successfully', async () => {
        const mockBatch = {
          batch_id: mockBatchId,
          name: 'Test Batch',
          program_id: mockProgramId
        };

        hierarchyService.createBatch.mockResolvedValue(mockBatch);

        const response = await request(app)
          .post('/api/v1/hierarchy/batches')
          .set('x-tenant-id', mockTenantId)
          .send({
            programId: mockProgramId,
            name: 'Test Batch',
            code: 'TB001',
            startDate: '2024-01-01',
            endDate: '2024-12-31',
            capacity: 30
          });

        expect(response.status).toBe(201);
        expect(response.body.data).toEqual(mockBatch);
      });

      it('should require batch name', async () => {
        const response = await request(app)
          .post('/api/v1/hierarchy/batches')
          .set('x-tenant-id', mockTenantId)
          .send({ programId: mockProgramId });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Batch name is required');
      });

      it('should require program ID', async () => {
        const response = await request(app)
          .post('/api/v1/hierarchy/batches')
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Test Batch' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Program ID is required');
      });
    });

    describe('GET /batches', () => {
      it('should list batches', async () => {
        const mockResult = {
          batches: [{ batch_id: mockBatchId, name: 'Batch 1' }],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
        };

        hierarchyService.listBatches.mockResolvedValue(mockResult);

        const response = await request(app)
          .get('/api/v1/hierarchy/batches')
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(mockResult.batches);
      });
    });

    describe('GET /batches/:batchId', () => {
      it('should get batch by ID', async () => {
        const mockBatch = { batch_id: mockBatchId, name: 'Test Batch' };
        hierarchyService.getBatchById.mockResolvedValue(mockBatch);

        const response = await request(app)
          .get(`/api/v1/hierarchy/batches/${mockBatchId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(mockBatch);
      });

      it('should return 404 when batch not found', async () => {
        hierarchyService.getBatchById.mockResolvedValue(null);

        const response = await request(app)
          .get(`/api/v1/hierarchy/batches/${mockBatchId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Batch not found');
      });
    });

    describe('PATCH /batches/:batchId', () => {
      it('should update batch successfully', async () => {
        const mockUpdatedBatch = { batch_id: mockBatchId, name: 'Updated Batch' };
        hierarchyService.updateBatch.mockResolvedValue(mockUpdatedBatch);

        const response = await request(app)
          .patch(`/api/v1/hierarchy/batches/${mockBatchId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Updated Batch' });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(mockUpdatedBatch);
      });
    });

    describe('DELETE /batches/:batchId', () => {
      it('should delete batch successfully', async () => {
        const mockDeletedBatch = { batch_id: mockBatchId, name: 'Deleted Batch' };
        hierarchyService.deleteBatch.mockResolvedValue(mockDeletedBatch);

        const response = await request(app)
          .delete(`/api/v1/hierarchy/batches/${mockBatchId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(mockDeletedBatch);
      });
    });
  });

  describe('Hierarchy Navigation Routes', () => {
    describe('GET /:nodeId/children', () => {
      it('should get node children', async () => {
        const mockChildren = [
          { center_id: mockCenterId, name: 'Center 1' },
          { center_id: '333e4567-e89b-12d3-a456-426614174002', name: 'Center 2' }
        ];

        hierarchyService.getNodeChildren.mockResolvedValue(mockChildren);

        const response = await request(app)
          .get(`/api/v1/hierarchy/${mockInstituteId}/children?entityType=institute`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.children).toEqual(mockChildren);
        expect(response.body.data.children_count).toBe(2);
        expect(hierarchyService.getNodeChildren).toHaveBeenCalledWith(
          mockInstituteId,
          'institute',
          mockTenantId
        );
      });

      it('should require entityType parameter', async () => {
        const response = await request(app)
          .get(`/api/v1/hierarchy/${mockInstituteId}/children`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('entityType query parameter is required (institute, center, program, or batch)');
      });

      it('should validate entityType parameter', async () => {
        const response = await request(app)
          .get(`/api/v1/hierarchy/${mockInstituteId}/children?entityType=invalid`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Invalid entityType. Must be one of: institute, center, program, batch');
      });

      it('should handle service errors', async () => {
        hierarchyService.getNodeChildren.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get(`/api/v1/hierarchy/${mockInstituteId}/children?entityType=institute`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to fetch node children');
      });
    });

    describe('GET /:nodeId/ancestors', () => {
      it('should get node ancestors', async () => {
        const mockAncestors = [
          { entity_id: mockInstituteId, entity_type: 'institute', name: 'Test Institute' }
        ];

        hierarchyService.getNodeAncestors.mockResolvedValue(mockAncestors);

        const response = await request(app)
          .get(`/api/v1/hierarchy/${mockCenterId}/ancestors?entityType=center`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.ancestors).toEqual(mockAncestors);
        expect(response.body.data.ancestors_count).toBe(1);
        expect(hierarchyService.getNodeAncestors).toHaveBeenCalledWith(
          mockCenterId,
          'center',
          mockTenantId
        );
      });

      it('should require entityType parameter', async () => {
        const response = await request(app)
          .get(`/api/v1/hierarchy/${mockCenterId}/ancestors`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('entityType query parameter is required (institute, center, program, or batch)');
      });

      it('should handle not found errors', async () => {
        hierarchyService.getNodeAncestors.mockRejectedValue(new Error('Center not found'));

        const response = await request(app)
          .get(`/api/v1/hierarchy/${mockCenterId}/ancestors?entityType=center`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Center not found');
      });
    });

    describe('GET /tree', () => {
      it('should get hierarchy tree', async () => {
        const mockTree = {
          institutes: [
            {
              institute_id: mockInstituteId,
              name: 'Test Institute',
              centers: [
                {
                  center_id: mockCenterId,
                  name: 'Test Center',
                  programs: []
                }
              ]
            }
          ]
        };

        hierarchyService.getHierarchyTree.mockResolvedValue(mockTree);

        const response = await request(app)
          .get('/api/v1/hierarchy/tree')
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.tree).toEqual(mockTree);
        expect(hierarchyService.getHierarchyTree).toHaveBeenCalledWith(mockTenantId, {
          includeInactive: false
        });
      });

      it('should handle includeInactive parameter', async () => {
        hierarchyService.getHierarchyTree.mockResolvedValue({});

        const response = await request(app)
          .get('/api/v1/hierarchy/tree?includeInactive=true')
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(200);
        expect(hierarchyService.getHierarchyTree).toHaveBeenCalledWith(mockTenantId, {
          includeInactive: true
        });
      });

      it('should handle service errors', async () => {
        hierarchyService.getHierarchyTree.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/v1/hierarchy/tree')
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to fetch hierarchy tree');
      });
    });

    describe('POST /permissions/resolve', () => {
      it('should resolve field permissions', async () => {
        const mockResolvedPermissions = {
          canRead: true,
          canWrite: false,
          canDelete: false
        };

        hierarchyService.resolveFieldPermissions.mockReturnValue(mockResolvedPermissions);

        const response = await request(app)
          .post('/api/v1/hierarchy/permissions/resolve')
          .set('x-tenant-id', mockTenantId)
          .send({
            fieldConfig: { field: 'name', permissions: ['read'] },
            userContext: { role: 'viewer', level: 'institute' }
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockResolvedPermissions);
        expect(hierarchyService.resolveFieldPermissions).toHaveBeenCalledWith(
          { field: 'name', permissions: ['read'] },
          { role: 'viewer', level: 'institute' }
        );
      });

      it('should require fieldConfig and userContext', async () => {
        const response = await request(app)
          .post('/api/v1/hierarchy/permissions/resolve')
          .set('x-tenant-id', mockTenantId)
          .send({ fieldConfig: {} });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('fieldConfig and userContext are required');
      });

      it('should handle service errors', async () => {
        hierarchyService.resolveFieldPermissions.mockImplementation(() => {
          throw new Error('Permission resolution failed');
        });

        const response = await request(app)
          .post('/api/v1/hierarchy/permissions/resolve')
          .set('x-tenant-id', mockTenantId)
          .send({
            fieldConfig: { field: 'name' },
            userContext: { role: 'viewer' }
          });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to resolve permissions');
      });
    });
  });

  // ============================================================================
  // ADDITIONAL ERROR SCENARIO TESTS FOR BRANCH COVERAGE
  // ============================================================================



  // ============================================================================
  // ADDITIONAL ERROR SCENARIO TESTS FOR BRANCH COVERAGE
  // ============================================================================

  describe('Center Routes - Additional Error Scenarios', () => {
    describe('POST /centers - Error Handling', () => {
      it('should handle missing center name', async () => {
        const response = await request(app)
          .post('/api/v1/hierarchy/centers')
          .set('x-tenant-id', mockTenantId)
          .send({ instituteId: mockInstituteId, code: 'C001' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Center name is required');
      });

      it('should handle missing institute_id', async () => {
        const response = await request(app)
          .post('/api/v1/hierarchy/centers')
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Test Center', code: 'C001' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Institute ID is required');
      });

      it('should handle institute not found', async () => {
        hierarchyService.createCenter.mockRejectedValue(new Error('Institute not found'));

        const response = await request(app)
          .post('/api/v1/hierarchy/centers')
          .set('x-tenant-id', mockTenantId)
          .send({ 
            name: 'Test Center', 
            code: 'C001',
            instituteId: mockInstituteId 
          });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Institute not found');
      });
    });

    describe('GET /centers - Error Handling', () => {
      it('should handle database errors when listing centers', async () => {
        hierarchyService.listCenters.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/v1/hierarchy/centers')
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to list centers');
      });

      it('should handle limit over 100 for centers', async () => {
        const response = await request(app)
          .get('/api/v1/hierarchy/centers?limit=150')
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Limit cannot exceed 100');
      });
    });

    describe('PATCH /centers/:centerId - Error Handling', () => {
      it('should handle empty updates', async () => {
        const response = await request(app)
          .patch(`/api/v1/hierarchy/centers/${mockCenterId}`)
          .set('x-tenant-id', mockTenantId)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('No fields to update');
      });

      it('should handle center not found on update', async () => {
        hierarchyService.updateCenter.mockRejectedValue(new Error('Center not found'));

        const response = await request(app)
          .patch(`/api/v1/hierarchy/centers/${mockCenterId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Updated Center' });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Center not found');
      });
    });

    describe('DELETE /centers/:centerId - Error Handling', () => {
      it('should handle center not found on delete', async () => {
        hierarchyService.deleteCenter.mockRejectedValue(new Error('Center not found'));

        const response = await request(app)
          .delete(`/api/v1/hierarchy/centers/${mockCenterId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Center not found');
      });

      it('should handle constraint violations on center delete', async () => {
        hierarchyService.deleteCenter.mockRejectedValue(
          new Error('Cannot delete center with existing programs')
        );

        const response = await request(app)
          .delete(`/api/v1/hierarchy/centers/${mockCenterId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(409);
      });
    });
  });

  describe('Program Routes - Additional Error Scenarios', () => {
    describe('POST /programs - Error Handling', () => {
      it('should handle missing program name', async () => {
        const response = await request(app)
          .post('/api/v1/hierarchy/programs')
          .set('x-tenant-id', mockTenantId)
          .send({ centerId: mockCenterId, code: 'P001' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Program name is required');
      });

      it('should handle missing center_id', async () => {
        const response = await request(app)
          .post('/api/v1/hierarchy/programs')
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Test Program', code: 'P001' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Center ID is required');
      });

      it('should handle center not found', async () => {
        hierarchyService.createProgram.mockRejectedValue(new Error('Center not found'));

        const response = await request(app)
          .post('/api/v1/hierarchy/programs')
          .set('x-tenant-id', mockTenantId)
          .send({ 
            name: 'Test Program',
            centerId: mockCenterId 
          });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Center not found');
      });
    });

    describe('GET /programs - Error Handling', () => {
      it('should handle database errors when listing programs', async () => {
        hierarchyService.listPrograms.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/v1/hierarchy/programs')
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to list programs');
      });

      it('should handle limit over 100 for programs', async () => {
        const response = await request(app)
          .get('/api/v1/hierarchy/programs?limit=150')
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Limit cannot exceed 100');
      });
    });

    describe('PATCH /programs/:programId - Error Handling', () => {
      it('should handle empty updates', async () => {
        const response = await request(app)
          .patch(`/api/v1/hierarchy/programs/${mockProgramId}`)
          .set('x-tenant-id', mockTenantId)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('No fields to update');
      });

      it('should handle program not found on update', async () => {
        hierarchyService.updateProgram.mockRejectedValue(new Error('Program not found'));

        const response = await request(app)
          .patch(`/api/v1/hierarchy/programs/${mockProgramId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Updated Program' });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Program not found');
      });
    });

    describe('DELETE /programs/:programId - Error Handling', () => {
      it('should handle program not found on delete', async () => {
        hierarchyService.deleteProgram.mockRejectedValue(new Error('Program not found'));

        const response = await request(app)
          .delete(`/api/v1/hierarchy/programs/${mockProgramId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Program not found');
      });

      it('should handle constraint violations on program delete', async () => {
        hierarchyService.deleteProgram.mockRejectedValue(
          new Error('Cannot delete program with existing batches')
        );

        const response = await request(app)
          .delete(`/api/v1/hierarchy/programs/${mockProgramId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(409);
      });
    });
  });

  describe('Batch Routes - Additional Error Scenarios', () => {
    describe('POST /batches - Error Handling', () => {
      it('should handle missing batch name', async () => {
        const response = await request(app)
          .post('/api/v1/hierarchy/batches')
          .set('x-tenant-id', mockTenantId)
          .send({ programId: mockProgramId, code: 'B001' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Batch name is required');
      });

      it('should handle missing program_id', async () => {
        const response = await request(app)
          .post('/api/v1/hierarchy/batches')
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Test Batch', code: 'B001' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Program ID is required');
      });

      it('should handle program not found', async () => {
        hierarchyService.createBatch.mockRejectedValue(new Error('Program not found'));

        const response = await request(app)
          .post('/api/v1/hierarchy/batches')
          .set('x-tenant-id', mockTenantId)
          .send({ 
            name: 'Test Batch',
            programId: mockProgramId 
          });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Program not found');
      });
    });

    describe('GET /batches - Error Handling', () => {
      it('should handle database errors when listing batches', async () => {
        hierarchyService.listBatches.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/v1/hierarchy/batches')
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to list batches');
      });

      it('should handle limit over 100 for batches', async () => {
        const response = await request(app)
          .get('/api/v1/hierarchy/batches?limit=150')
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Limit cannot exceed 100');
      });
    });

    describe('PATCH /batches/:batchId - Error Handling', () => {
      it('should handle empty updates', async () => {
        const response = await request(app)
          .patch(`/api/v1/hierarchy/batches/${mockBatchId}`)
          .set('x-tenant-id', mockTenantId)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('No fields to update');
      });

      it('should handle batch not found on update', async () => {
        hierarchyService.updateBatch.mockRejectedValue(new Error('Batch not found'));

        const response = await request(app)
          .patch(`/api/v1/hierarchy/batches/${mockBatchId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Updated Batch' });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Batch not found');
      });
    });

    describe('DELETE /batches/:batchId - Error Handling', () => {
      it('should handle batch not found on delete', async () => {
        hierarchyService.deleteBatch.mockRejectedValue(new Error('Batch not found'));

        const response = await request(app)
          .delete(`/api/v1/hierarchy/batches/${mockBatchId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Batch not found');
      });

      it('should handle constraint violations on batch delete', async () => {
        hierarchyService.deleteBatch.mockRejectedValue(
          new Error('Cannot delete batch with existing enrollments')
        );

        const response = await request(app)
          .delete(`/api/v1/hierarchy/batches/${mockBatchId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(409);
      });
    });
  });

  describe('Institute Routes - Additional Error Scenarios', () => {
    describe('POST /institutes - Additional Error Handling', () => {
      it('should handle duplicate code error (23505)', async () => {
        const duplicateError = new Error('Duplicate key');
        duplicateError.code = '23505';
        hierarchyService.createInstitute.mockRejectedValue(duplicateError);

        const response = await request(app)
          .post('/api/v1/hierarchy/institutes')
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Test Institute', code: 'DUP001' });

        expect(response.status).toBe(409);
        expect(response.body.message).toBe('Institute code already exists');
      });

      it('should handle validation failed errors', async () => {
        hierarchyService.createInstitute.mockRejectedValue(
          new Error('Validation failed: Code must be alphanumeric')
        );

        const response = await request(app)
          .post('/api/v1/hierarchy/institutes')
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Test Institute', code: 'INVALID@CODE' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation failed: Code must be alphanumeric');
      });
    });

    describe('PATCH /institutes/:instituteId - Error Handling', () => {
      it('should handle empty updates', async () => {
        const response = await request(app)
          .patch(`/api/v1/hierarchy/institutes/${mockInstituteId}`)
          .set('x-tenant-id', mockTenantId)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('No fields to update');
      });

      it('should handle institute not found on update', async () => {
        hierarchyService.updateInstitute.mockRejectedValue(new Error('Institute not found'));

        const response = await request(app)
          .patch(`/api/v1/hierarchy/institutes/${mockInstituteId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Updated Institute' });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Institute not found');
      });
    });

    describe('GET /institutes - Additional Error Handling', () => {
      it('should handle database errors when listing institutes', async () => {
        hierarchyService.listInstitutes.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/v1/hierarchy/institutes')
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to list institutes');
      });
    });

    describe('GET /institutes/:instituteId - Additional Error Handling', () => {
      it('should handle database errors when fetching institute', async () => {
        hierarchyService.getInstituteById.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get(`/api/v1/hierarchy/institutes/${mockInstituteId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to fetch institute');
      });
    });

    describe('DELETE /institutes/:instituteId - Additional Error Handling', () => {
      it('should handle database errors when deleting institute', async () => {
        hierarchyService.deleteInstitute.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .delete(`/api/v1/hierarchy/institutes/${mockInstituteId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to delete institute');
      });
    });
  });

  describe('Center Routes - Additional Duplicate and Validation Errors', () => {
    describe('POST /centers - Duplicate and Validation Errors', () => {
      it('should handle duplicate code error (23505)', async () => {
        const duplicateError = new Error('Duplicate key');
        duplicateError.code = '23505';
        hierarchyService.createCenter.mockRejectedValue(duplicateError);

        const response = await request(app)
          .post('/api/v1/hierarchy/centers')
          .set('x-tenant-id', mockTenantId)
          .send({ 
            name: 'Test Center',
            code: 'DUP001',
            instituteId: mockInstituteId 
          });

        expect(response.status).toBe(409);
        expect(response.body.message).toBe('Center code already exists');
      });

      it('should handle validation failed errors', async () => {
        hierarchyService.createCenter.mockRejectedValue(
          new Error('Validation failed: Name is too long')
        );

        const response = await request(app)
          .post('/api/v1/hierarchy/centers')
          .set('x-tenant-id', mockTenantId)
          .send({ 
            name: 'A'.repeat(300),
            instituteId: mockInstituteId 
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation failed: Name is too long');
      });

      it('should handle database errors when creating center', async () => {
        hierarchyService.createCenter.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .post('/api/v1/hierarchy/centers')
          .set('x-tenant-id', mockTenantId)
          .send({ 
            name: 'Test Center',
            instituteId: mockInstituteId 
          });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to create center');
      });
    });

    describe('GET /centers/:centerId - Additional Error Handling', () => {
      it('should handle database errors when fetching center', async () => {
        hierarchyService.getCenterById.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get(`/api/v1/hierarchy/centers/${mockCenterId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to fetch center');
      });
    });

    describe('PATCH /centers/:centerId - Additional Error Handling', () => {
      it('should handle institute not found on center update', async () => {
        hierarchyService.updateCenter.mockRejectedValue(new Error('Institute not found'));

        const response = await request(app)
          .patch(`/api/v1/hierarchy/centers/${mockCenterId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ instituteId: mockInstituteId });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Institute not found');
      });

      it('should handle no valid fields to update', async () => {
        hierarchyService.updateCenter.mockRejectedValue(new Error('No valid fields to update'));

        const response = await request(app)
          .patch(`/api/v1/hierarchy/centers/${mockCenterId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ invalid_field: 'value' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('No valid fields to update');
      });

      it('should handle database errors when updating center', async () => {
        hierarchyService.updateCenter.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .patch(`/api/v1/hierarchy/centers/${mockCenterId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Updated Center' });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to update center');
      });
    });

    describe('DELETE /centers/:centerId - Additional Error Handling', () => {
      it('should handle database errors when deleting center', async () => {
        hierarchyService.deleteCenter.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .delete(`/api/v1/hierarchy/centers/${mockCenterId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to delete center');
      });
    });
  });

  describe('Program Routes - Additional Duplicate and Validation Errors', () => {
    describe('POST /programs - Duplicate and Validation Errors', () => {
      it('should handle duplicate code error (23505)', async () => {
        const duplicateError = new Error('Duplicate key');
        duplicateError.code = '23505';
        hierarchyService.createProgram.mockRejectedValue(duplicateError);

        const response = await request(app)
          .post('/api/v1/hierarchy/programs')
          .set('x-tenant-id', mockTenantId)
          .send({ 
            name: 'Test Program',
            code: 'DUP001',
            centerId: mockCenterId 
          });

        expect(response.status).toBe(409);
        expect(response.body.message).toBe('Program code already exists');
      });

      it('should handle validation failed errors', async () => {
        hierarchyService.createProgram.mockRejectedValue(
          new Error('Validation failed: Duration must be positive')
        );

        const response = await request(app)
          .post('/api/v1/hierarchy/programs')
          .set('x-tenant-id', mockTenantId)
          .send({ 
            name: 'Test Program',
            centerId: mockCenterId,
            durationMonths: -5
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation failed: Duration must be positive');
      });

      it('should handle database errors when creating program', async () => {
        hierarchyService.createProgram.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .post('/api/v1/hierarchy/programs')
          .set('x-tenant-id', mockTenantId)
          .send({ 
            name: 'Test Program',
            centerId: mockCenterId 
          });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to create program');
      });
    });

    describe('GET /programs/:programId - Additional Error Handling', () => {
      it('should handle database errors when fetching program', async () => {
        hierarchyService.getProgramById.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get(`/api/v1/hierarchy/programs/${mockProgramId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to fetch program');
      });
    });

    describe('PATCH /programs/:programId - Additional Error Handling', () => {
      it('should handle center not found on program update', async () => {
        hierarchyService.updateProgram.mockRejectedValue(new Error('Center not found'));

        const response = await request(app)
          .patch(`/api/v1/hierarchy/programs/${mockProgramId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ centerId: mockCenterId });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Center not found');
      });

      it('should handle no valid fields to update', async () => {
        hierarchyService.updateProgram.mockRejectedValue(new Error('No valid fields to update'));

        const response = await request(app)
          .patch(`/api/v1/hierarchy/programs/${mockProgramId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ invalid_field: 'value' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('No valid fields to update');
      });

      it('should handle database errors when updating program', async () => {
        hierarchyService.updateProgram.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .patch(`/api/v1/hierarchy/programs/${mockProgramId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Updated Program' });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to update program');
      });
    });

    describe('DELETE /programs/:programId - Additional Error Handling', () => {
      it('should handle database errors when deleting program', async () => {
        hierarchyService.deleteProgram.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .delete(`/api/v1/hierarchy/programs/${mockProgramId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to delete program');
      });
    });
  });

  describe('Batch Routes - Additional Duplicate and Validation Errors', () => {
    describe('POST /batches - Duplicate and Validation Errors', () => {
      it('should handle duplicate code error (23505)', async () => {
        const duplicateError = new Error('Duplicate key');
        duplicateError.code = '23505';
        hierarchyService.createBatch.mockRejectedValue(duplicateError);

        const response = await request(app)
          .post('/api/v1/hierarchy/batches')
          .set('x-tenant-id', mockTenantId)
          .send({ 
            name: 'Test Batch',
            code: 'DUP001',
            programId: mockProgramId 
          });

        expect(response.status).toBe(409);
        expect(response.body.message).toBe('Batch code already exists');
      });

      it('should handle validation failed errors', async () => {
        hierarchyService.createBatch.mockRejectedValue(
          new Error('Validation failed: Capacity must be positive')
        );

        const response = await request(app)
          .post('/api/v1/hierarchy/batches')
          .set('x-tenant-id', mockTenantId)
          .send({ 
            name: 'Test Batch',
            programId: mockProgramId,
            capacity: -10
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation failed: Capacity must be positive');
      });

      it('should handle database errors when creating batch', async () => {
        hierarchyService.createBatch.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .post('/api/v1/hierarchy/batches')
          .set('x-tenant-id', mockTenantId)
          .send({ 
            name: 'Test Batch',
            programId: mockProgramId 
          });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to create batch');
      });
    });

    describe('GET /batches/:batchId - Additional Error Handling', () => {
      it('should handle database errors when fetching batch', async () => {
        hierarchyService.getBatchById.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get(`/api/v1/hierarchy/batches/${mockBatchId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to fetch batch');
      });
    });

    describe('PATCH /batches/:batchId - Additional Error Handling', () => {
      it('should handle program not found on batch update', async () => {
        hierarchyService.updateBatch.mockRejectedValue(new Error('Program not found'));

        const response = await request(app)
          .patch(`/api/v1/hierarchy/batches/${mockBatchId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ programId: mockProgramId });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Program not found');
      });

      it('should handle no valid fields to update', async () => {
        hierarchyService.updateBatch.mockRejectedValue(new Error('No valid fields to update'));

        const response = await request(app)
          .patch(`/api/v1/hierarchy/batches/${mockBatchId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ invalid_field: 'value' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('No valid fields to update');
      });

      it('should handle database errors when updating batch', async () => {
        hierarchyService.updateBatch.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .patch(`/api/v1/hierarchy/batches/${mockBatchId}`)
          .set('x-tenant-id', mockTenantId)
          .send({ name: 'Updated Batch' });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to update batch');
      });
    });

    describe('DELETE /batches/:batchId - Additional Error Handling', () => {
      it('should handle database errors when deleting batch', async () => {
        hierarchyService.deleteBatch.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .delete(`/api/v1/hierarchy/batches/${mockBatchId}`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to delete batch');
      });
    });
  });

  describe('Hierarchy Navigation Routes - Additional Error Scenarios', () => {
    describe('GET /:nodeId/children - Additional Error Handling', () => {
      it('should handle invalid entity type errors', async () => {
        hierarchyService.getNodeChildren.mockRejectedValue(
          new Error('Invalid entity type: unknown')
        );

        const response = await request(app)
          .get(`/api/v1/hierarchy/${mockInstituteId}/children?entityType=institute`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Invalid entity type: unknown');
      });
    });

    describe('GET /:nodeId/ancestors - Additional Error Handling', () => {
      it('should validate entityType parameter', async () => {
        const response = await request(app)
          .get(`/api/v1/hierarchy/${mockCenterId}/ancestors?entityType=invalid`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Invalid entityType. Must be one of: institute, center, program, batch');
      });

      it('should handle invalid entity type errors from service', async () => {
        hierarchyService.getNodeAncestors.mockRejectedValue(
          new Error('Invalid entity type: unknown')
        );

        const response = await request(app)
          .get(`/api/v1/hierarchy/${mockCenterId}/ancestors?entityType=center`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Invalid entity type: unknown');
      });

      it('should handle database errors', async () => {
        hierarchyService.getNodeAncestors.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get(`/api/v1/hierarchy/${mockCenterId}/ancestors?entityType=center`)
          .set('x-tenant-id', mockTenantId);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to fetch node ancestors');
      });
    });
  });
});
