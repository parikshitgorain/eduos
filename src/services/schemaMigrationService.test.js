/**
 * Schema Migration Service Tests
 * 
 * Task: 2.2.4 - Build schema migration engine with dry-run mode
 */

const migrationService = require('./schemaMigrationService');
const schemaService = require('./schemaService');
const { query, transaction } = require('../config/database');

// Mock dependencies
jest.mock('../config/database');
jest.mock('./schemaService');

describe('Schema Migration Service', () => {
  const mockTenantId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUserId = '123e4567-e89b-12d3-a456-426614174001';
  const mockFromSnapshotId = '123e4567-e89b-12d3-a456-426614174002';
  const mockToSnapshotId = '123e4567-e89b-12d3-a456-426614174003';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('analyzeMigrationImpact', () => {
    it('should analyze impact when adding a new field', async () => {
      const fromSchema = {
        snapshot_id: mockFromSnapshotId,
        form_type: 'student_enrollment',
        semantic_version: 'v1.0.0',
        fields: [
          { field_name: 'first_name', field_type: 'text', is_required: true },
          { field_name: 'last_name', field_type: 'text', is_required: true }
        ]
      };
      
      const toSchema = {
        snapshot_id: mockToSnapshotId,
        form_type: 'student_enrollment',
        semantic_version: 'v1.1.0',
        fields: [
          { field_name: 'first_name', field_type: 'text', is_required: true },
          { field_name: 'last_name', field_type: 'text', is_required: true },
          { field_name: 'email', field_type: 'email', is_required: false }
        ]
      };
      
      schemaService.getSchemaSnapshotById
        .mockResolvedValueOnce(fromSchema)
        .mockResolvedValueOnce(toSchema);
      
      const impact = await migrationService.analyzeMigrationImpact(
        mockFromSnapshotId,
        mockToSnapshotId,
        mockTenantId
      );
      
      expect(impact.fields_added).toHaveLength(1);
      expect(impact.fields_added[0].field_name).toBe('email');
      expect(impact.fields_removed).toHaveLength(0);
      expect(impact.fields_modified).toHaveLength(0);
      expect(impact.breaking_changes).toHaveLength(0);
    });
    
    it('should detect breaking change when removing a field', async () => {
      const fromSchema = {
        snapshot_id: mockFromSnapshotId,
        form_type: 'student_enrollment',
        semantic_version: 'v1.0.0',
        fields: [
          { field_name: 'first_name', field_type: 'text', is_required: true },
          { field_name: 'middle_name', field_type: 'text', is_required: false },
          { field_name: 'last_name', field_type: 'text', is_required: true }
        ]
      };
      
      const toSchema = {
        snapshot_id: mockToSnapshotId,
        form_type: 'student_enrollment',
        semantic_version: 'v2.0.0',
        fields: [
          { field_name: 'first_name', field_type: 'text', is_required: true },
          { field_name: 'last_name', field_type: 'text', is_required: true }
        ]
      };
      
      schemaService.getSchemaSnapshotById
        .mockResolvedValueOnce(fromSchema)
        .mockResolvedValueOnce(toSchema);
      
      const impact = await migrationService.analyzeMigrationImpact(
        mockFromSnapshotId,
        mockToSnapshotId,
        mockTenantId
      );
      
      expect(impact.fields_removed).toHaveLength(1);
      expect(impact.fields_removed[0].field_name).toBe('middle_name');
      expect(impact.breaking_changes).toHaveLength(1);
      expect(impact.breaking_changes[0].type).toBe('field_removed');
    });
    
    it('should detect breaking change when changing field type', async () => {
      const fromSchema = {
        snapshot_id: mockFromSnapshotId,
        form_type: 'student_enrollment',
        semantic_version: 'v1.0.0',
        fields: [
          { field_name: 'age', field_type: 'text', is_required: false, validation_rules: {} }
        ]
      };
      
      const toSchema = {
        snapshot_id: mockToSnapshotId,
        form_type: 'student_enrollment',
        semantic_version: 'v2.0.0',
        fields: [
          { field_name: 'age', field_type: 'number', is_required: false, validation_rules: {} }
        ]
      };
      
      schemaService.getSchemaSnapshotById
        .mockResolvedValueOnce(fromSchema)
        .mockResolvedValueOnce(toSchema);
      
      const impact = await migrationService.analyzeMigrationImpact(
        mockFromSnapshotId,
        mockToSnapshotId,
        mockTenantId
      );
      
      expect(impact.fields_modified).toHaveLength(1);
      expect(impact.fields_modified[0].modifications).toContain('type_changed');
      expect(impact.breaking_changes).toHaveLength(1);
      expect(impact.breaking_changes[0].type).toBe('type_changed');
    });
    
    it('should warn when adding required field without default', async () => {
      const fromSchema = {
        snapshot_id: mockFromSnapshotId,
        form_type: 'student_enrollment',
        semantic_version: 'v1.0.0',
        fields: [
          { field_name: 'first_name', field_type: 'text', is_required: true }
        ]
      };
      
      const toSchema = {
        snapshot_id: mockToSnapshotId,
        form_type: 'student_enrollment',
        semantic_version: 'v1.1.0',
        fields: [
          { field_name: 'first_name', field_type: 'text', is_required: true },
          { field_name: 'email', field_type: 'email', is_required: true, default_value: null }
        ]
      };
      
      schemaService.getSchemaSnapshotById
        .mockResolvedValueOnce(fromSchema)
        .mockResolvedValueOnce(toSchema);
      
      const impact = await migrationService.analyzeMigrationImpact(
        mockFromSnapshotId,
        mockToSnapshotId,
        mockTenantId
      );
      
      expect(impact.warnings).toHaveLength(1);
      expect(impact.warnings[0].type).toBe('new_required_field');
      expect(impact.warnings[0].field_name).toBe('email');
    });
    
    it('should throw error for different form types', async () => {
      const fromSchema = {
        snapshot_id: mockFromSnapshotId,
        form_type: 'student_enrollment',
        semantic_version: 'v1.0.0',
        fields: []
      };
      
      const toSchema = {
        snapshot_id: mockToSnapshotId,
        form_type: 'attendance',
        semantic_version: 'v1.0.0',
        fields: []
      };
      
      schemaService.getSchemaSnapshotById
        .mockResolvedValueOnce(fromSchema)
        .mockResolvedValueOnce(toSchema);
      
      await expect(
        migrationService.analyzeMigrationImpact(
          mockFromSnapshotId,
          mockToSnapshotId,
          mockTenantId
        )
      ).rejects.toThrow('Cannot migrate between different form types');
    });
  });
  
  describe('runDryRunMigration', () => {
    it('should run dry-run simulation and return report', async () => {
      const fromSchema = {
        snapshot_id: mockFromSnapshotId,
        form_type: 'student_enrollment',
        semantic_version: 'v1.0.0',
        fields: [
          { field_name: 'first_name', field_type: 'text', is_required: true, validation_rules: {} }
        ]
      };
      
      const toSchema = {
        snapshot_id: mockToSnapshotId,
        form_type: 'student_enrollment',
        semantic_version: 'v1.1.0',
        fields: [
          { field_name: 'first_name', field_type: 'text', is_required: true, validation_rules: {} },
          { field_name: 'email', field_type: 'email', is_required: false, validation_rules: {} }
        ]
      };
      
      schemaService.getSchemaSnapshotById
        .mockResolvedValueOnce(fromSchema)
        .mockResolvedValueOnce(toSchema)
        .mockResolvedValueOnce(toSchema);
      
      // Mock sample records query
      query.mockResolvedValueOnce({
        rows: [
          { record_id: 'rec1', data: { first_name: 'John' }, created_at: new Date() },
          { record_id: 'rec2', data: { first_name: 'Jane' }, created_at: new Date() }
        ]
      });
      
      // Mock count query
      query.mockResolvedValueOnce({
        rows: [{ total: '100' }]
      });
      
      // Mock store dry-run report
      query.mockResolvedValueOnce({
        rows: [{ dry_run_id: 'dry-run-1' }]
      });
      
      const report = await migrationService.runDryRunMigration(
        mockFromSnapshotId,
        mockToSnapshotId,
        mockTenantId,
        { sampleSize: 1000 }
      );
      
      expect(report).toHaveProperty('dry_run_id');
      expect(report).toHaveProperty('impact_analysis');
      expect(report).toHaveProperty('validation_results');
      expect(report).toHaveProperty('estimated_impact');
      expect(report.validation_results.total_sampled).toBe(2);
      expect(report.estimated_impact.total_records).toBe(100);
    });
    
    it('should detect validation failures in dry-run', async () => {
      const fromSchema = {
        snapshot_id: mockFromSnapshotId,
        form_type: 'student_enrollment',
        semantic_version: 'v1.0.0',
        fields: [
          { field_name: 'age', field_type: 'text', is_required: false, validation_rules: {} }
        ]
      };
      
      const toSchema = {
        snapshot_id: mockToSnapshotId,
        form_type: 'student_enrollment',
        semantic_version: 'v2.0.0',
        fields: [
          { field_name: 'age', field_type: 'number', is_required: true, validation_rules: { min: 0, max: 120 } }
        ]
      };
      
      schemaService.getSchemaSnapshotById
        .mockResolvedValueOnce(fromSchema)
        .mockResolvedValueOnce(toSchema)
        .mockResolvedValueOnce(toSchema);
      
      // Mock sample records with invalid data
      query.mockResolvedValueOnce({
        rows: [
          { record_id: 'rec1', data: { age: 'twenty' }, created_at: new Date() },
          { record_id: 'rec2', data: { age: null }, created_at: new Date() }
        ]
      });
      
      // Mock count query
      query.mockResolvedValueOnce({
        rows: [{ total: '100' }]
      });
      
      // Mock store dry-run report
      query.mockResolvedValueOnce({
        rows: [{ dry_run_id: 'dry-run-1' }]
      });
      
      const report = await migrationService.runDryRunMigration(
        mockFromSnapshotId,
        mockToSnapshotId,
        mockTenantId
      );
      
      expect(report.validation_results.validation_failed).toBe(2);
      expect(report.validation_results.failures).toHaveLength(2);
      expect(report.recommendation.status).not.toBe('safe');
    });
    
    it('should limit sample size to max 10000', async () => {
      const fromSchema = {
        snapshot_id: mockFromSnapshotId,
        form_type: 'student_enrollment',
        semantic_version: 'v1.0.0',
        fields: []
      };
      
      const toSchema = {
        snapshot_id: mockToSnapshotId,
        form_type: 'student_enrollment',
        semantic_version: 'v1.1.0',
        fields: []
      };
      
      schemaService.getSchemaSnapshotById
        .mockResolvedValueOnce(fromSchema)
        .mockResolvedValueOnce(toSchema)
        .mockResolvedValueOnce(toSchema);
      
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      query.mockResolvedValueOnce({ rows: [{ dry_run_id: 'dry-run-1' }] });
      
      await migrationService.runDryRunMigration(
        mockFromSnapshotId,
        mockToSnapshotId,
        mockTenantId,
        { sampleSize: 50000 } // Request more than max
      );
      
      // Check that query was called with max 10000
      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockTenantId, mockFromSnapshotId, 10000])
      );
    });
  });
  
  describe('executeMigration', () => {
    beforeEach(() => {
      // Reset all mocks before each test in this suite
      jest.clearAllMocks();
    });
    
    it('should execute migration successfully', async () => {
      const mockDryRunReport = {
        dry_run_id: 'dry-run-1',
        recommendation: { status: 'safe' }
      };
      
      // Mock runDryRunMigration to avoid calling analyzeMigrationImpact
      const runDryRunSpy = jest.spyOn(migrationService, 'runDryRunMigration')
        .mockResolvedValue(mockDryRunReport);
      
      // Mock create migration record
      query
        .mockResolvedValueOnce({
          rows: [{ migration_id: 'migration-1' }]
        })
        // Mock update migration record
        .mockResolvedValueOnce({
          rows: [{ migration_id: 'migration-1', migration_status: 'completed' }]
        });
      
      // Mock transaction for migration execution
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ snapshot_id: 'snap-1' }] }) // before snapshot
          .mockResolvedValueOnce({ rows: [{ record_id: 'rec1' }, { record_id: 'rec2' }] }) // update records
          .mockResolvedValueOnce({ rows: [{ snapshot_id: 'snap-2' }] }) // after snapshot
      };
      
      transaction.mockImplementation(async (callback) => {
        return await callback(mockClient);
      });
      
      const result = await migrationService.executeMigration(
        mockFromSnapshotId,
        mockToSnapshotId,
        mockTenantId,
        mockUserId,
        { tier: 'enterprise' }
      );
      
      expect(result.status).toBe('completed');
      expect(result.records_migrated).toBe(2);
      expect(result).toHaveProperty('migration_id');
      expect(result).toHaveProperty('duration_ms');
      
      runDryRunSpy.mockRestore();
    });
    
    it('should block migration with breaking changes unless forced', async () => {
      const mockDryRunReport = {
        dry_run_id: 'dry-run-1',
        recommendation: { status: 'caution' }
      };
      
      const runDryRunSpy = jest.spyOn(migrationService, 'runDryRunMigration')
        .mockResolvedValue(mockDryRunReport);
      
      query
        .mockResolvedValueOnce({
          rows: [{ migration_id: 'migration-1' }]
        })
        // Mock update migration record for failure
        .mockResolvedValueOnce({
          rows: [{ migration_id: 'migration-1', migration_status: 'failed' }]
        });
      
      await expect(
        migrationService.executeMigration(
          mockFromSnapshotId,
          mockToSnapshotId,
          mockTenantId,
          mockUserId,
          { tier: 'basic' }
        )
      ).rejects.toThrow('breaking changes');
      
      runDryRunSpy.mockRestore();
    });
    
    it('should allow forced execution of breaking changes', async () => {
      const mockDryRunReport = {
        dry_run_id: 'dry-run-1',
        recommendation: { status: 'caution' }
      };
      
      const runDryRunSpy = jest.spyOn(migrationService, 'runDryRunMigration')
        .mockResolvedValue(mockDryRunReport);
      
      query
        .mockResolvedValueOnce({
          rows: [{ migration_id: 'migration-1' }]
        })
        .mockResolvedValueOnce({
          rows: [{ migration_id: 'migration-1', migration_status: 'completed' }]
        });
      
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ snapshot_id: 'snap-1' }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ snapshot_id: 'snap-2' }] })
      };
      
      transaction.mockImplementation(async (callback) => {
        return await callback(mockClient);
      });
      
      const result = await migrationService.executeMigration(
        mockFromSnapshotId,
        mockToSnapshotId,
        mockTenantId,
        mockUserId,
        { tier: 'enterprise', forceExecute: true }
      );
      
      expect(result.status).toBe('completed');
      
      runDryRunSpy.mockRestore();
    });
    
    it('should handle migration failure and update status', async () => {
      const runDryRunSpy = jest.spyOn(migrationService, 'runDryRunMigration')
        .mockResolvedValue({
          dry_run_id: 'dry-run-1',
          recommendation: { status: 'safe' }
        });
      
      query
        .mockResolvedValueOnce({
          rows: [{ migration_id: 'migration-1' }]
        })
        .mockResolvedValueOnce({
          rows: [{ migration_id: 'migration-1', migration_status: 'failed' }]
        });
      
      transaction.mockRejectedValue(new Error('Database error'));
      
      await expect(
        migrationService.executeMigration(
          mockFromSnapshotId,
          mockToSnapshotId,
          mockTenantId,
          mockUserId,
          { tier: 'enterprise' }
        )
      ).rejects.toThrow('Database error');
      
      runDryRunSpy.mockRestore();
    });
  });
  
  describe('getMigrationHistory', () => {
    it('should return paginated migration history', async () => {
      query
        .mockResolvedValueOnce({
          rows: [
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
          ]
        })
        .mockResolvedValueOnce({
          rows: [{ count: '10' }]
        });
      
      const result = await migrationService.getMigrationHistory(mockTenantId, {
        page: 1,
        limit: 20
      });
      
      expect(result.migrations).toHaveLength(2);
      expect(result.pagination.total).toBe(10);
      expect(result.pagination.page).toBe(1);
    });
    
    it('should filter by status', async () => {
      query
        .mockResolvedValueOnce({
          rows: [
            {
              migration_id: 'mig1',
              migration_status: 'failed'
            }
          ]
        })
        .mockResolvedValueOnce({
          rows: [{ count: '1' }]
        });
      
      const result = await migrationService.getMigrationHistory(mockTenantId, {
        status: 'failed'
      });
      
      expect(result.migrations).toHaveLength(1);
      expect(result.migrations[0].migration_status).toBe('failed');
    });
  });
  
  describe('getMigrationDetails', () => {
    it('should return migration details with dry-run report', async () => {
      const mockMigration = {
        migration_id: 'mig1',
        from_version: 'v1.0.0',
        to_version: 'v1.1.0',
        migration_status: 'completed',
        dry_run_report: { dry_run_id: 'dry-run-1' }
      };
      
      query.mockResolvedValueOnce({
        rows: [mockMigration]
      });
      
      const result = await migrationService.getMigrationDetails('mig1', mockTenantId);
      
      expect(result).toEqual(mockMigration);
      expect(result.dry_run_report).toBeDefined();
    });
    
    it('should return null for non-existent migration', async () => {
      query.mockResolvedValueOnce({
        rows: []
      });
      
      const result = await migrationService.getMigrationDetails('non-existent', mockTenantId);
      
      expect(result).toBeNull();
    });
  });
  
  describe('ROLLBACK_SLA', () => {
    it('should have correct SLA timeouts for each tier', () => {
      expect(migrationService.ROLLBACK_SLA.enterprise).toBe(30 * 1000);
      expect(migrationService.ROLLBACK_SLA.business).toBe(5 * 60 * 1000);
      expect(migrationService.ROLLBACK_SLA.basic).toBe(15 * 60 * 1000);
    });
  });
});
