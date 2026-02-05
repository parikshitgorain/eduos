/**
 * Schema Migration Routes Tests
 * 
 * Task: 2.2.4 - Build schema migration engine with dry-run mode
 */

const request = require('supertest');
const express = require('express');
const migrationRoutes = require('./schemaMigration');
const migrationService = require('../services/schemaMigrationService');

// Mock the service
jest.mock('../services/schemaMigrationService');

// Create test app
const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
  req.user = {
    user_id: '123e4567-e89b-12d3-a456-426614174001',
    tenant_id: '123e4567-e89b-12d3-a456-426614174000',
    roles: ['admin']
  };
  next();
});

app.use('/api/v1/schemas/migrations', migrationRoutes);

describe('Schema Migration Routes', () => {
  const mockTenantId = '123e4567-e89b-12d3-a456-426614174000';
  const mockFromSnapshotId = '123e4567-e89b-12d3-a456-426614174002';
  const mockToSnapshotId = '123e4567-e89b-12d3-a456-426614174003';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('POST /api/v1/schemas/migrations/analyze', () => {
    it('should analyze migration impact successfully', async () => {
      const mockImpact = {
        form_type: 'student_enrollment',
        from_version: 'v1.0.0',
        to_version: 'v1.1.0',
        fields_added: [{ field_name: 'email', field_type: 'email' }],
        fields_removed: [],
        fields_modified: [],
        breaking_changes: [],
        warnings: []
      };
      
      migrationService.analyzeMigrationImpact.mockResolvedValue(mockImpact);
      
      const response = await request(app)
        .post('/api/v1/schemas/migrations/analyze')
        .send({
          from_snapshot_id: mockFromSnapshotId,
          to_snapshot_id: mockToSnapshotId
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.impact).toEqual(mockImpact);
      expect(migrationService.analyzeMigrationImpact).toHaveBeenCalledWith(
        mockFromSnapshotId,
        mockToSnapshotId,
        mockTenantId
      );
    });
    
    it('should return 400 if snapshot IDs are missing', async () => {
      const response = await request(app)
        .post('/api/v1/schemas/migrations/analyze')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
    
    it('should handle service errors', async () => {
      migrationService.analyzeMigrationImpact.mockRejectedValue(
        new Error('Schema not found')
      );
      
      const response = await request(app)
        .post('/api/v1/schemas/migrations/analyze')
        .send({
          from_snapshot_id: mockFromSnapshotId,
          to_snapshot_id: mockToSnapshotId
        });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });
  
  describe('POST /api/v1/schemas/migrations/dry-run', () => {
    it('should run dry-run migration successfully', async () => {
      const mockReport = {
        dry_run_id: 'dry-run-123',
        impact_analysis: {},
        validation_results: {
          total_sampled: 1000,
          validation_passed: 950,
          validation_failed: 50
        },
        estimated_impact: {
          total_records: 10000,
          estimated_failures: 500
        },
        recommendation: {
          status: 'proceed_with_caution',
          message: 'Review failures before proceeding'
        }
      };
      
      migrationService.runDryRunMigration.mockResolvedValue(mockReport);
      
      const response = await request(app)
        .post('/api/v1/schemas/migrations/dry-run')
        .send({
          from_snapshot_id: mockFromSnapshotId,
          to_snapshot_id: mockToSnapshotId,
          sample_size: 1000
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.dry_run_report).toEqual(mockReport);
    });
    
    it('should validate sample size range', async () => {
      const response = await request(app)
        .post('/api/v1/schemas/migrations/dry-run')
        .send({
          from_snapshot_id: mockFromSnapshotId,
          to_snapshot_id: mockToSnapshotId,
          sample_size: 50 // Too small
        });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('between 100 and 10000');
    });
    
    it('should validate sample size maximum', async () => {
      const response = await request(app)
        .post('/api/v1/schemas/migrations/dry-run')
        .send({
          from_snapshot_id: mockFromSnapshotId,
          to_snapshot_id: mockToSnapshotId,
          sample_size: 20000 // Too large
        });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('between 100 and 10000');
    });
    
    it('should return 400 if snapshot IDs are missing', async () => {
      const response = await request(app)
        .post('/api/v1/schemas/migrations/dry-run')
        .send({ sample_size: 1000 });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });
  
  describe('POST /api/v1/schemas/migrations/execute', () => {
    it('should execute migration successfully', async () => {
      const mockResult = {
        migration_id: 'mig-123',
        status: 'completed',
        records_migrated: 1000,
        duration_ms: 5000
      };
      
      migrationService.executeMigration.mockResolvedValue(mockResult);
      
      const response = await request(app)
        .post('/api/v1/schemas/migrations/execute')
        .send({
          from_snapshot_id: mockFromSnapshotId,
          to_snapshot_id: mockToSnapshotId,
          tier: 'enterprise'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.migration).toEqual(mockResult);
    });
    
    it('should require admin role', async () => {
      // Create app with non-admin user
      const nonAdminApp = express();
      nonAdminApp.use(express.json());
      nonAdminApp.use((req, res, next) => {
        req.user = {
          user_id: '123e4567-e89b-12d3-a456-426614174001',
          tenant_id: mockTenantId,
          roles: ['teacher'] // Not admin
        };
        next();
      });
      nonAdminApp.use('/api/v1/schemas/migrations', migrationRoutes);
      
      const response = await request(nonAdminApp)
        .post('/api/v1/schemas/migrations/execute')
        .send({
          from_snapshot_id: mockFromSnapshotId,
          to_snapshot_id: mockToSnapshotId
        });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });
    
    it('should return 400 for breaking changes without force', async () => {
      migrationService.executeMigration.mockRejectedValue(
        new Error('Migration contains breaking changes. Use forceExecute option to proceed.')
      );
      
      const response = await request(app)
        .post('/api/v1/schemas/migrations/execute')
        .send({
          from_snapshot_id: mockFromSnapshotId,
          to_snapshot_id: mockToSnapshotId
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Migration blocked');
    });
    
    it('should handle migration failures', async () => {
      migrationService.executeMigration.mockRejectedValue(
        new Error('Database connection failed')
      );
      
      const response = await request(app)
        .post('/api/v1/schemas/migrations/execute')
        .send({
          from_snapshot_id: mockFromSnapshotId,
          to_snapshot_id: mockToSnapshotId
        });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Migration failed');
    });
    
    it('should pass options to service', async () => {
      migrationService.executeMigration.mockResolvedValue({
        migration_id: 'mig-123',
        status: 'completed'
      });
      
      await request(app)
        .post('/api/v1/schemas/migrations/execute')
        .send({
          from_snapshot_id: mockFromSnapshotId,
          to_snapshot_id: mockToSnapshotId,
          skip_dry_run: true,
          force_execute: true,
          tier: 'enterprise'
        });
      
      expect(migrationService.executeMigration).toHaveBeenCalledWith(
        mockFromSnapshotId,
        mockToSnapshotId,
        mockTenantId,
        expect.any(String),
        {
          skipDryRun: true,
          forceExecute: true,
          tier: 'enterprise'
        }
      );
    });
  });
  
  describe('GET /api/v1/schemas/migrations', () => {
    it('should return migration history with pagination', async () => {
      const mockHistory = {
        migrations: [
          {
            migration_id: 'mig1',
            from_version: 'v1.0.0',
            to_version: 'v1.1.0',
            migration_status: 'completed'
          },
          {
            migration_id: 'mig2',
            from_version: 'v1.1.0',
            to_version: 'v1.2.0',
            migration_status: 'completed'
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1
        }
      };
      
      migrationService.getMigrationHistory.mockResolvedValue(mockHistory);
      
      const response = await request(app)
        .get('/api/v1/schemas/migrations')
        .query({ page: 1, limit: 20 });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.migrations).toHaveLength(2);
      expect(response.body.pagination).toEqual(mockHistory.pagination);
    });
    
    it('should filter by status', async () => {
      migrationService.getMigrationHistory.mockResolvedValue({
        migrations: [
          {
            migration_id: 'mig1',
            migration_status: 'failed'
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1
        }
      });
      
      const response = await request(app)
        .get('/api/v1/schemas/migrations')
        .query({ status: 'failed' });
      
      expect(response.status).toBe(200);
      expect(migrationService.getMigrationHistory).toHaveBeenCalledWith(
        mockTenantId,
        expect.objectContaining({ status: 'failed' })
      );
    });
    
    it('should use default pagination values', async () => {
      migrationService.getMigrationHistory.mockResolvedValue({
        migrations: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
      });
      
      await request(app)
        .get('/api/v1/schemas/migrations');
      
      expect(migrationService.getMigrationHistory).toHaveBeenCalledWith(
        mockTenantId,
        expect.objectContaining({ page: 1, limit: 20 })
      );
    });
  });
  
  describe('GET /api/v1/schemas/migrations/:migrationId', () => {
    it('should return migration details', async () => {
      const mockMigration = {
        migration_id: 'mig1',
        from_version: 'v1.0.0',
        to_version: 'v1.1.0',
        migration_status: 'completed',
        dry_run_report: {
          dry_run_id: 'dry-run-1'
        }
      };
      
      migrationService.getMigrationDetails.mockResolvedValue(mockMigration);
      
      const response = await request(app)
        .get('/api/v1/schemas/migrations/mig1');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.migration).toEqual(mockMigration);
    });
    
    it('should return 404 for non-existent migration', async () => {
      migrationService.getMigrationDetails.mockResolvedValue(null);
      
      const response = await request(app)
        .get('/api/v1/schemas/migrations/non-existent');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not found');
    });
    
    it('should handle service errors', async () => {
      migrationService.getMigrationDetails.mockRejectedValue(
        new Error('Database error')
      );
      
      const response = await request(app)
        .get('/api/v1/schemas/migrations/mig1');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });
});
