/**
 * Schema Service - Historic Rendering Tests
 * Task: 2.2.5 - Implement historic rendering with snapshot association
 * 
 * Tests for:
 * - Rendering records with their original schema snapshots
 * - Schema version badge display
 * - SHA-256 integrity verification on render
 * - Schema transformation exports
 * - Student record history across versions
 */

const schemaService = require('./schemaService');
const { query, transaction } = require('../config/database');

jest.mock('../config/database');

describe('SchemaService - Historic Rendering (Task 2.2.5)', () => {
  const mockTenantId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUserId = '123e4567-e89b-12d3-a456-426614174001';
  const mockStudentId = '123e4567-e89b-12d3-a456-426614174002';
  const mockRecordId = '123e4567-e89b-12d3-a456-426614174003';
  const mockSnapshotId = '123e4567-e89b-12d3-a456-426614174004';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('renderRecordWithSnapshot', () => {
    test('should render a student record with its original schema snapshot', async () => {
      const mockSchemaDefinition = {
        form_type: 'student_enrollment',
        version: 'v1.2.3',
        fields: [
          { field_name: 'first_name', field_type: 'text', label: 'First Name' },
          { field_name: 'last_name', field_type: 'text', label: 'Last Name' }
        ]
      };

      const mockRecordData = {
        first_name: 'John',
        last_name: 'Doe'
      };

      const schemaHash = schemaService.computeSchemaHash(mockSchemaDefinition);

      // Mock the record query
      query.mockResolvedValueOnce({
        rows: [{
          record_id: mockRecordId,
          student_id: mockStudentId,
          snapshot_id: mockSnapshotId,
          data: mockRecordData,
          created_at: new Date('2025-01-15'),
          updated_at: new Date('2025-01-15'),
          semantic_version: 'v1.2.3',
          schema_definition: mockSchemaDefinition,
          schema_hash: schemaHash,
          schema_created_at: new Date('2025-01-01'),
          form_type: 'student_enrollment'
        }]
      });

      // Mock the fields query
      query.mockResolvedValueOnce({
        rows: [
          {
            field_name: 'first_name',
            field_type: 'text',
            label: 'First Name',
            description: null,
            display_order: 0,
            is_required: true,
            field_options: {}
          },
          {
            field_name: 'last_name',
            field_type: 'text',
            label: 'Last Name',
            description: null,
            display_order: 1,
            is_required: true,
            field_options: {}
          }
        ]
      });

      const result = await schemaService.renderRecordWithSnapshot(mockRecordId, mockTenantId);

      expect(result).toBeDefined();
      expect(result.record_id).toBe(mockRecordId);
      expect(result.student_id).toBe(mockStudentId);
      expect(result.snapshot_id).toBe(mockSnapshotId);
      expect(result.schema_version).toBe('v1.2.3');
      expect(result.integrity_verified).toBe(true);
      expect(result.schema_version_badge).toContain('Schema v1.2.3');
      expect(result.fields).toHaveLength(2);
      expect(result.fields[0].value).toBe('John');
      expect(result.fields[1].value).toBe('Doe');
    });

    test('should throw error if schema integrity check fails', async () => {
      const mockSchemaDefinition = {
        form_type: 'student_enrollment',
        version: 'v1.2.3',
        fields: []
      };

      const correctHash = schemaService.computeSchemaHash(mockSchemaDefinition);
      const tamperedHash = 'tampered_hash_1234567890abcdef';

      query.mockResolvedValueOnce({
        rows: [{
          record_id: mockRecordId,
          student_id: mockStudentId,
          snapshot_id: mockSnapshotId,
          data: {},
          created_at: new Date(),
          updated_at: new Date(),
          semantic_version: 'v1.2.3',
          schema_definition: mockSchemaDefinition,
          schema_hash: tamperedHash, // Tampered hash
          schema_created_at: new Date(),
          form_type: 'student_enrollment'
        }]
      });

      await expect(
        schemaService.renderRecordWithSnapshot(mockRecordId, mockTenantId)
      ).rejects.toThrow('Schema integrity check failed');
    });

    test('should throw error if record not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await expect(
        schemaService.renderRecordWithSnapshot(mockRecordId, mockTenantId)
      ).rejects.toThrow('Student record not found');
    });

    test('should include verification timestamp', async () => {
      const mockSchemaDefinition = {
        form_type: 'student_enrollment',
        version: 'v1.0.0',
        fields: []
      };

      const schemaHash = schemaService.computeSchemaHash(mockSchemaDefinition);

      query.mockResolvedValueOnce({
        rows: [{
          record_id: mockRecordId,
          student_id: mockStudentId,
          snapshot_id: mockSnapshotId,
          data: {},
          created_at: new Date(),
          updated_at: new Date(),
          semantic_version: 'v1.0.0',
          schema_definition: mockSchemaDefinition,
          schema_hash: schemaHash,
          schema_created_at: new Date(),
          form_type: 'student_enrollment'
        }]
      });

      query.mockResolvedValueOnce({ rows: [] });

      const result = await schemaService.renderRecordWithSnapshot(mockRecordId, mockTenantId);

      expect(result.verification_timestamp).toBeDefined();
      expect(result.verification_timestamp).toBeInstanceOf(Date);
    });
  });

  describe('renderRecordsWithSnapshots', () => {
    test('should render multiple records in batch', async () => {
      const mockSchemaDefinition = {
        form_type: 'student_enrollment',
        version: 'v1.0.0',
        fields: []
      };

      const schemaHash = schemaService.computeSchemaHash(mockSchemaDefinition);

      const recordId1 = 'record-uuid-1';
      const recordId2 = 'record-uuid-2';

      // Mock first record
      query.mockResolvedValueOnce({
        rows: [{
          record_id: recordId1,
          student_id: mockStudentId,
          snapshot_id: mockSnapshotId,
          data: {},
          created_at: new Date(),
          updated_at: new Date(),
          semantic_version: 'v1.0.0',
          schema_definition: mockSchemaDefinition,
          schema_hash: schemaHash,
          schema_created_at: new Date(),
          form_type: 'student_enrollment'
        }]
      });
      query.mockResolvedValueOnce({ rows: [] });

      // Mock second record
      query.mockResolvedValueOnce({
        rows: [{
          record_id: recordId2,
          student_id: mockStudentId,
          snapshot_id: mockSnapshotId,
          data: {},
          created_at: new Date(),
          updated_at: new Date(),
          semantic_version: 'v1.0.0',
          schema_definition: mockSchemaDefinition,
          schema_hash: schemaHash,
          schema_created_at: new Date(),
          form_type: 'student_enrollment'
        }]
      });
      query.mockResolvedValueOnce({ rows: [] });

      const result = await schemaService.renderRecordsWithSnapshots([recordId1, recordId2], mockTenantId);

      expect(result).toHaveLength(2);
      expect(result[0].record_id).toBe(recordId1);
      expect(result[1].record_id).toBe(recordId2);
      expect(result[0].integrity_verified).toBe(true);
      expect(result[1].integrity_verified).toBe(true);
    });

    test('should handle errors gracefully in batch rendering', async () => {
      const recordId1 = 'record-uuid-1';
      const recordId2 = 'record-uuid-2';

      // First record succeeds
      const mockSchemaDefinition = {
        form_type: 'student_enrollment',
        version: 'v1.0.0',
        fields: []
      };
      const schemaHash = schemaService.computeSchemaHash(mockSchemaDefinition);

      query.mockResolvedValueOnce({
        rows: [{
          record_id: recordId1,
          student_id: mockStudentId,
          snapshot_id: mockSnapshotId,
          data: {},
          created_at: new Date(),
          updated_at: new Date(),
          semantic_version: 'v1.0.0',
          schema_definition: mockSchemaDefinition,
          schema_hash: schemaHash,
          schema_created_at: new Date(),
          form_type: 'student_enrollment'
        }]
      });
      query.mockResolvedValueOnce({ rows: [] });

      // Second record fails (not found)
      query.mockResolvedValueOnce({ rows: [] });

      const result = await schemaService.renderRecordsWithSnapshots([recordId1, recordId2], mockTenantId);

      expect(result).toHaveLength(2);
      expect(result[0].integrity_verified).toBe(true);
      expect(result[1].error).toBeDefined();
      expect(result[1].integrity_verified).toBe(false);
    });

    test('should throw error if recordIds is not an array', async () => {
      await expect(
        schemaService.renderRecordsWithSnapshots('not-an-array', mockTenantId)
      ).rejects.toThrow('recordIds must be a non-empty array');
    });

    test('should throw error if recordIds is empty', async () => {
      await expect(
        schemaService.renderRecordsWithSnapshots([], mockTenantId)
      ).rejects.toThrow('recordIds must be a non-empty array');
    });
  });

  describe('getStudentRecordHistory', () => {
    test('should return all records for a student across schema versions', async () => {
      query.mockResolvedValueOnce({
        rows: [
          {
            record_id: 'record-1',
            snapshot_id: 'snapshot-1',
            data: {},
            created_at: new Date('2025-03-01'),
            updated_at: new Date('2025-03-01'),
            semantic_version: 'v2.0.0',
            form_type: 'student_enrollment',
            schema_hash: 'hash1',
            schema_created_at: new Date('2025-02-01')
          },
          {
            record_id: 'record-2',
            snapshot_id: 'snapshot-2',
            data: {},
            created_at: new Date('2025-01-01'),
            updated_at: new Date('2025-01-01'),
            semantic_version: 'v1.0.0',
            form_type: 'student_enrollment',
            schema_hash: 'hash2',
            schema_created_at: new Date('2024-12-01')
          }
        ]
      });

      const result = await schemaService.getStudentRecordHistory(mockStudentId, mockTenantId);

      expect(result).toHaveLength(2);
      expect(result[0].schema_version).toBe('v2.0.0');
      expect(result[1].schema_version).toBe('v1.0.0');
      expect(result[0].schema_version_badge).toContain('Schema v2.0.0');
      expect(result[1].schema_version_badge).toContain('Schema v1.0.0');
    });

    test('should return empty array if no records found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await schemaService.getStudentRecordHistory(mockStudentId, mockTenantId);

      expect(result).toEqual([]);
    });
  });

  describe('transformRecordToNewSchema', () => {
    test('should transform a record to a new schema version', async () => {
      const mockClient = {
        query: jest.fn()
      };

      transaction.mockImplementation(async (callback) => {
        return await callback(mockClient);
      });

      const sourceSchemaDefinition = {
        form_type: 'student_enrollment',
        version: 'v1.0.0',
        fields: [
          { field_name: 'name', field_type: 'text' }
        ]
      };

      const targetSchemaDefinition = {
        form_type: 'student_enrollment',
        version: 'v2.0.0',
        fields: [
          { field_name: 'first_name', field_type: 'text' },
          { field_name: 'last_name', field_type: 'text' }
        ]
      };

      // Mock source record query
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          record_id: mockRecordId,
          student_id: mockStudentId,
          source_snapshot_id: 'snapshot-v1',
          source_data: { name: 'John Doe' },
          source_version: 'v1.0.0'
        }]
      });

      // Mock target snapshot query (getSchemaSnapshotById)
      query.mockResolvedValueOnce({
        rows: [{
          snapshot_id: 'snapshot-v2',
          semantic_version: 'v2.0.0',
          schema_definition: targetSchemaDefinition,
          schema_hash: schemaService.computeSchemaHash(targetSchemaDefinition),
          created_at: new Date(),
          form_type: 'student_enrollment'
        }]
      });

      // Mock fields query
      query.mockResolvedValueOnce({
        rows: [
          {
            field_id: 'field-1',
            field_name: 'first_name',
            field_type: 'text',
            label: 'First Name',
            is_required: false,
            default_value: null,
            display_order: 0
          },
          {
            field_id: 'field-2',
            field_name: 'last_name',
            field_type: 'text',
            label: 'Last Name',
            is_required: false,
            default_value: null,
            display_order: 1
          }
        ]
      });

      // Mock validation rules queries (2 fields)
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      // Mock transformation log insert
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          transformation_id: 'transform-uuid',
          created_at: new Date()
        }]
      });

      const fieldMappings = {
        first_name: 'name',
        last_name: 'name'
      };

      const result = await schemaService.transformRecordToNewSchema(
        mockRecordId,
        'snapshot-v2',
        mockTenantId,
        mockUserId,
        fieldMappings
      );

      expect(result).toBeDefined();
      expect(result.transformation_id).toBe('transform-uuid');
      expect(result.source_version).toBe('v1.0.0');
      expect(result.target_version).toBe('v2.0.0');
      expect(result.note).toContain('original record remains unchanged');
    });

    test('should throw error if target schema integrity check fails', async () => {
      const mockClient = {
        query: jest.fn()
      };

      transaction.mockImplementation(async (callback) => {
        return await callback(mockClient);
      });

      // Mock source record query
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          record_id: mockRecordId,
          student_id: mockStudentId,
          source_snapshot_id: 'snapshot-v1',
          source_data: {},
          source_version: 'v1.0.0'
        }]
      });

      const targetSchemaDefinition = {
        form_type: 'student_enrollment',
        version: 'v2.0.0',
        fields: []
      };

      // Mock target snapshot with tampered hash
      query.mockResolvedValueOnce({
        rows: [{
          snapshot_id: 'snapshot-v2',
          semantic_version: 'v2.0.0',
          schema_definition: targetSchemaDefinition,
          schema_hash: 'tampered_hash',
          created_at: new Date(),
          form_type: 'student_enrollment'
        }]
      });

      query.mockResolvedValueOnce({ rows: [] });

      await expect(
        schemaService.transformRecordToNewSchema(
          mockRecordId,
          'snapshot-v2',
          mockTenantId,
          mockUserId
        )
      ).rejects.toThrow('Target schema integrity check failed');
    });

    test('should throw error if required field has no mapping', async () => {
      const mockClient = {
        query: jest.fn()
      };

      transaction.mockImplementation(async (callback) => {
        return await callback(mockClient);
      });

      // Mock source record query
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          record_id: mockRecordId,
          student_id: mockStudentId,
          source_snapshot_id: 'snapshot-v1',
          source_data: {},
          source_version: 'v1.0.0'
        }]
      });

      const targetSchemaDefinition = {
        form_type: 'student_enrollment',
        version: 'v2.0.0',
        fields: []
      };

      // Mock target snapshot
      query.mockResolvedValueOnce({
        rows: [{
          snapshot_id: 'snapshot-v2',
          semantic_version: 'v2.0.0',
          schema_definition: targetSchemaDefinition,
          schema_hash: schemaService.computeSchemaHash(targetSchemaDefinition),
          created_at: new Date(),
          form_type: 'student_enrollment'
        }]
      });

      query.mockResolvedValueOnce({
        rows: [
          {
            field_id: 'field-1',
            field_name: 'required_field',
            field_type: 'text',
            label: 'Required Field',
            is_required: true,
            default_value: null
          }
        ]
      });

      // Mock validation rules query
      query.mockResolvedValueOnce({ rows: [] });

      await expect(
        schemaService.transformRecordToNewSchema(
          mockRecordId,
          'snapshot-v2',
          mockTenantId,
          mockUserId,
          {} // No mappings
        )
      ).rejects.toThrow('Required field');
    });
  });

  describe('createStudentRecord', () => {
    test('should create a student record with snapshot association', async () => {
      const mockSchemaDefinition = {
        form_type: 'student_enrollment',
        version: 'v1.0.0',
        fields: []
      };

      const schemaHash = schemaService.computeSchemaHash(mockSchemaDefinition);

      // Mock snapshot query (getSchemaSnapshotById)
      query.mockResolvedValueOnce({
        rows: [{
          snapshot_id: mockSnapshotId,
          semantic_version: 'v1.0.0',
          schema_definition: mockSchemaDefinition,
          schema_hash: schemaHash,
          created_at: new Date('2025-01-01'),
          form_type: 'student_enrollment'
        }]
      });

      // Mock fields query
      query.mockResolvedValueOnce({
        rows: [
          {
            field_id: 'field-1',
            field_name: 'first_name',
            is_required: true
          }
        ]
      });

      // Mock validation rules query
      query.mockResolvedValueOnce({ rows: [] });

      // Mock insert query
      query.mockResolvedValueOnce({
        rows: [{
          record_id: mockRecordId,
          tenant_id: mockTenantId,
          student_id: mockStudentId,
          snapshot_id: mockSnapshotId,
          data: { first_name: 'John' },
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      const result = await schemaService.createStudentRecord({
        tenantId: mockTenantId,
        studentId: mockStudentId,
        snapshotId: mockSnapshotId,
        data: { first_name: 'John' },
        createdBy: mockUserId
      });

      expect(result).toBeDefined();
      expect(result.record).toBeDefined();
      expect(result.schema_version).toBe('v1.0.0');
      expect(result.schema_version_badge).toContain('Schema v1.0.0');
    });

    test('should throw error if snapshot not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await expect(
        schemaService.createStudentRecord({
          tenantId: mockTenantId,
          studentId: mockStudentId,
          snapshotId: mockSnapshotId,
          data: {},
          createdBy: mockUserId
        })
      ).rejects.toThrow('Schema snapshot not found');
    });

    test('should throw error if schema integrity check fails', async () => {
      const mockSchemaDefinition = {
        form_type: 'student_enrollment',
        version: 'v1.0.0',
        fields: []
      };

      // Mock snapshot with tampered hash
      query.mockResolvedValueOnce({
        rows: [{
          snapshot_id: mockSnapshotId,
          semantic_version: 'v1.0.0',
          schema_definition: mockSchemaDefinition,
          schema_hash: 'tampered_hash',
          created_at: new Date(),
          form_type: 'student_enrollment'
        }]
      });

      query.mockResolvedValueOnce({ rows: [] });

      await expect(
        schemaService.createStudentRecord({
          tenantId: mockTenantId,
          studentId: mockStudentId,
          snapshotId: mockSnapshotId,
          data: {},
          createdBy: mockUserId
        })
      ).rejects.toThrow('Schema integrity check failed');
    });

    test('should throw error if required field is missing', async () => {
      const mockSchemaDefinition = {
        form_type: 'student_enrollment',
        version: 'v1.0.0',
        fields: []
      };

      const schemaHash = schemaService.computeSchemaHash(mockSchemaDefinition);

      query.mockResolvedValueOnce({
        rows: [{
          snapshot_id: mockSnapshotId,
          semantic_version: 'v1.0.0',
          schema_definition: mockSchemaDefinition,
          schema_hash: schemaHash,
          created_at: new Date(),
          form_type: 'student_enrollment'
        }]
      });

      query.mockResolvedValueOnce({
        rows: [
          {
            field_id: 'field-1',
            field_name: 'required_field',
            is_required: true
          }
        ]
      });

      // Mock validation rules query
      query.mockResolvedValueOnce({ rows: [] });

      await expect(
        schemaService.createStudentRecord({
          tenantId: mockTenantId,
          studentId: mockStudentId,
          snapshotId: mockSnapshotId,
          data: {}, // Missing required field
          createdBy: mockUserId
        })
      ).rejects.toThrow('Required field');
    });
  });
});
