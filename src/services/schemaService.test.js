/**
 * Schema Service Tests
 * 
 * Tests for schema definition and storage system
 * Task: 2.2.1 - Build schema definition and storage system
 */

const schemaService = require('./schemaService');
const { query, transaction } = require('../config/database');

// Mock database
jest.mock('../config/database');

describe('SchemaService', () => {
  const mockTenantId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUserId = '123e4567-e89b-12d3-a456-426614174001';
  const mockSnapshotId = '123e4567-e89b-12d3-a456-426614174002';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Field Type Validation', () => {
    test('should support all required field types', () => {
      const requiredTypes = ['text', 'number', 'date', 'dropdown', 'checkbox', 'file_upload'];
      requiredTypes.forEach(type => {
        expect(schemaService.FIELD_TYPES).toContain(type);
      });
    });
    
    test('should include additional field types', () => {
      expect(schemaService.FIELD_TYPES).toContain('email');
      expect(schemaService.FIELD_TYPES).toContain('phone');
      expect(schemaService.FIELD_TYPES).toContain('textarea');
      expect(schemaService.FIELD_TYPES).toContain('radio');
    });
  });
  
  describe('Validation Rule Types', () => {
    test('should support all required validation rule types', () => {
      const requiredRules = ['required', 'min', 'max', 'regex'];
      requiredRules.forEach(rule => {
        expect(schemaService.VALIDATION_RULE_TYPES).toContain(rule);
      });
    });
    
    test('should include additional validation rules', () => {
      expect(schemaService.VALIDATION_RULE_TYPES).toContain('min_length');
      expect(schemaService.VALIDATION_RULE_TYPES).toContain('max_length');
      expect(schemaService.VALIDATION_RULE_TYPES).toContain('email');
      expect(schemaService.VALIDATION_RULE_TYPES).toContain('phone');
      expect(schemaService.VALIDATION_RULE_TYPES).toContain('custom');
    });
  });
  
  describe('computeSchemaHash', () => {
    test('should compute SHA-256 hash of schema definition', () => {
      const schema = {
        form_type: 'student_enrollment',
        version: 'v1.0.0',
        fields: []
      };
      
      const hash = schemaService.computeSchemaHash(schema);
      
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64); // SHA-256 produces 64 hex characters
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
    
    test('should produce same hash for identical schemas', () => {
      const schema1 = { form_type: 'test', fields: [] };
      const schema2 = { form_type: 'test', fields: [] };
      
      const hash1 = schemaService.computeSchemaHash(schema1);
      const hash2 = schemaService.computeSchemaHash(schema2);
      
      expect(hash1).toBe(hash2);
    });
    
    test('should produce different hash for different schemas', () => {
      const schema1 = { form_type: 'test1', fields: [] };
      const schema2 = { form_type: 'test2', fields: [] };
      
      const hash1 = schemaService.computeSchemaHash(schema1);
      const hash2 = schemaService.computeSchemaHash(schema2);
      
      expect(hash1).not.toBe(hash2);
    });
  });
  
  describe('Semantic Versioning', () => {
    test('should parse valid semantic version', () => {
      const version = schemaService.parseSemVer('v1.2.3');
      
      expect(version).toEqual({
        major: 1,
        minor: 2,
        patch: 3
      });
    });
    
    test('should parse version without v prefix', () => {
      const version = schemaService.parseSemVer('1.2.3');
      
      expect(version).toEqual({
        major: 1,
        minor: 2,
        patch: 3
      });
    });
    
    test('should throw error for invalid version format', () => {
      expect(() => schemaService.parseSemVer('1.2')).toThrow('Invalid semantic version format');
      expect(() => schemaService.parseSemVer('invalid')).toThrow('Invalid semantic version format');
    });
    
    test('should increment major version', () => {
      const newVersion = schemaService.incrementSemVer('v1.2.3', 'major');
      expect(newVersion).toBe('v2.0.0');
    });
    
    test('should increment minor version', () => {
      const newVersion = schemaService.incrementSemVer('v1.2.3', 'minor');
      expect(newVersion).toBe('v1.3.0');
    });
    
    test('should increment patch version', () => {
      const newVersion = schemaService.incrementSemVer('v1.2.3', 'patch');
      expect(newVersion).toBe('v1.2.4');
    });
    
    test('should default to patch increment', () => {
      const newVersion = schemaService.incrementSemVer('v1.2.3');
      expect(newVersion).toBe('v1.2.4');
    });
  });
  
  describe('createSchemaSnapshot', () => {
    test('should create schema snapshot with valid data', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // Check for existing schema
          .mockResolvedValueOnce({ // Create snapshot
            rows: [{
              snapshot_id: mockSnapshotId,
              tenant_id: mockTenantId,
              form_type: 'student_enrollment',
              semantic_version: 'v1.0.0',
              schema_hash: 'abc123',
              status: 'active'
            }]
          })
          .mockResolvedValue({ rows: [{ field_id: 'field-1' }] }) // Create fields
      };
      
      transaction.mockImplementation(async (callback) => {
        return await callback(mockClient);
      });
      
      const fields = [
        {
          field_name: 'first_name',
          field_type: 'text',
          label: 'First Name',
          is_required: true
        },
        {
          field_name: 'email',
          field_type: 'email',
          label: 'Email Address'
        }
      ];
      
      const result = await schemaService.createSchemaSnapshot({
        tenantId: mockTenantId,
        formType: 'student_enrollment',
        fields,
        createdBy: mockUserId,
        changeSummary: 'Initial schema'
      });
      
      expect(result).toBeDefined();
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot.form_type).toBe('student_enrollment');
      expect(result.snapshot.semantic_version).toBe('v1.0.0');
    });
    
    test('should throw error if form_type is missing', async () => {
      await expect(
        schemaService.createSchemaSnapshot({
          tenantId: mockTenantId,
          fields: [],
          createdBy: mockUserId
        })
      ).rejects.toThrow('form_type is required');
    });
    
    test('should throw error if fields array is empty', async () => {
      await expect(
        schemaService.createSchemaSnapshot({
          tenantId: mockTenantId,
          formType: 'test',
          fields: [],
          createdBy: mockUserId
        })
      ).rejects.toThrow('fields must be a non-empty array');
    });
    
    test('should throw error if created_by is missing', async () => {
      await expect(
        schemaService.createSchemaSnapshot({
          tenantId: mockTenantId,
          formType: 'test',
          fields: [{ field_name: 'test', field_type: 'text', label: 'Test' }]
        })
      ).rejects.toThrow('created_by is required');
    });
    
    test('should validate field definitions', async () => {
      const invalidField = {
        field_name: 'test',
        field_type: 'invalid_type',
        label: 'Test'
      };
      
      await expect(
        schemaService.createSchemaSnapshot({
          tenantId: mockTenantId,
          formType: 'test',
          fields: [invalidField],
          createdBy: mockUserId
        })
      ).rejects.toThrow('field_type must be one of');
    });
    
    test('should require options for dropdown fields', async () => {
      const dropdownField = {
        field_name: 'status',
        field_type: 'dropdown',
        label: 'Status'
      };
      
      await expect(
        schemaService.createSchemaSnapshot({
          tenantId: mockTenantId,
          formType: 'test',
          fields: [dropdownField],
          createdBy: mockUserId
        })
      ).rejects.toThrow('field_options.options array is required for dropdown fields');
    });
  });
  
  describe('getSchemaSnapshotById', () => {
    test('should retrieve schema snapshot with fields', async () => {
      query
        .mockResolvedValueOnce({ // Get snapshot
          rows: [{
            snapshot_id: mockSnapshotId,
            tenant_id: mockTenantId,
            form_type: 'student_enrollment',
            semantic_version: 'v1.0.0'
          }]
        })
        .mockResolvedValueOnce({ // Get fields
          rows: [
            { field_id: 'field-1', field_name: 'first_name', field_type: 'text' },
            { field_id: 'field-2', field_name: 'email', field_type: 'email' }
          ]
        })
        .mockResolvedValue({ rows: [] }); // Get validation rules
      
      const result = await schemaService.getSchemaSnapshotById(mockSnapshotId, mockTenantId);
      
      expect(result).toBeDefined();
      expect(result.snapshot_id).toBe(mockSnapshotId);
      expect(result.fields).toHaveLength(2);
      expect(result.fields[0].field_name).toBe('first_name');
    });
    
    test('should return null if snapshot not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      
      const result = await schemaService.getSchemaSnapshotById(mockSnapshotId, mockTenantId);
      
      expect(result).toBeNull();
    });
  });
  
  describe('getLatestSchema', () => {
    test('should retrieve latest active schema for form type', async () => {
      query
        .mockResolvedValueOnce({ // Get latest snapshot
          rows: [{
            snapshot_id: mockSnapshotId,
            tenant_id: mockTenantId,
            form_type: 'student_enrollment',
            semantic_version: 'v1.2.0',
            status: 'active'
          }]
        })
        .mockResolvedValueOnce({ // Get snapshot details
          rows: [{
            snapshot_id: mockSnapshotId,
            tenant_id: mockTenantId,
            form_type: 'student_enrollment',
            semantic_version: 'v1.2.0'
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Get fields
        .mockResolvedValue({ rows: [] }); // Get validation rules
      
      const result = await schemaService.getLatestSchema(mockTenantId, 'student_enrollment');
      
      expect(result).toBeDefined();
      expect(result.form_type).toBe('student_enrollment');
      expect(result.semantic_version).toBe('v1.2.0');
    });
    
    test('should return null if no active schema exists', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      
      const result = await schemaService.getLatestSchema(mockTenantId, 'nonexistent');
      
      expect(result).toBeNull();
    });
  });
  
  describe('verifySchemaIntegrity', () => {
    test('should verify schema integrity successfully', async () => {
      const schemaDefinition = { form_type: 'test', fields: [] };
      const hash = schemaService.computeSchemaHash(schemaDefinition);
      
      query.mockResolvedValueOnce({
        rows: [{
          schema_hash: hash,
          schema_definition: schemaDefinition
        }]
      });
      
      const result = await schemaService.verifySchemaIntegrity(mockSnapshotId, mockTenantId);
      
      expect(result.is_valid).toBe(true);
      expect(result.stored_hash).toBe(hash);
      expect(result.computed_hash).toBe(hash);
    });
    
    test('should detect tampered schema', async () => {
      const schemaDefinition = { form_type: 'test', fields: [] };
      const correctHash = schemaService.computeSchemaHash(schemaDefinition);
      const tamperedHash = 'tampered_hash_value_1234567890abcdef1234567890abcdef12345678';
      
      query.mockResolvedValueOnce({
        rows: [{
          schema_hash: tamperedHash,
          schema_definition: schemaDefinition
        }]
      });
      
      const result = await schemaService.verifySchemaIntegrity(mockSnapshotId, mockTenantId);
      
      expect(result.is_valid).toBe(false);
      expect(result.stored_hash).toBe(tamperedHash);
      expect(result.computed_hash).toBe(correctHash);
    });
    
    test('should throw error if snapshot not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      
      await expect(
        schemaService.verifySchemaIntegrity(mockSnapshotId, mockTenantId)
      ).rejects.toThrow('Schema snapshot not found');
    });
  });
  
  describe('exportSchema', () => {
    test('should export schema in correct format', async () => {
      query
        .mockResolvedValueOnce({ // Get snapshot
          rows: [{
            snapshot_id: mockSnapshotId,
            tenant_id: mockTenantId,
            form_type: 'student_enrollment',
            semantic_version: 'v1.0.0',
            schema_definition: { form_type: 'student_enrollment', fields: [] }
          }]
        })
        .mockResolvedValueOnce({ // Get fields
          rows: [
            {
              field_id: 'field-1',
              field_name: 'first_name',
              field_type: 'text',
              label: 'First Name',
              is_required: true
            }
          ]
        })
        .mockResolvedValueOnce({ rows: [] }) // Get validation rules
        .mockResolvedValueOnce({ // Insert export record
          rows: [{ export_id: 'export-1' }]
        });
      
      const result = await schemaService.exportSchema(mockSnapshotId, mockTenantId, mockUserId);
      
      expect(result).toBeDefined();
      expect(result.export_id).toBe('export-1');
      expect(result.export_data.export_format).toBe('eduos-schema-v1');
      expect(result.export_data.form_type).toBe('student_enrollment');
      expect(result.export_data.fields).toHaveLength(1);
    });
  });
  
  describe('importSchema', () => {
    test('should import schema successfully', async () => {
      const importData = {
        export_format: 'eduos-schema-v1',
        form_type: 'student_enrollment',
        fields: [
          {
            field_name: 'first_name',
            field_type: 'text',
            label: 'First Name',
            is_required: true
          }
        ]
      };
      
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ // Insert import record
            rows: [{ import_id: 'import-1' }]
          })
          .mockResolvedValueOnce({ rows: [] }) // Check existing schema
          .mockResolvedValueOnce({ rows: [] }) // Check for existing schema (in createSchemaSnapshot)
          .mockResolvedValueOnce({ // Create snapshot
            rows: [{
              snapshot_id: mockSnapshotId,
              tenant_id: mockTenantId,
              form_type: 'student_enrollment',
              semantic_version: 'v1.0.0'
            }]
          })
          .mockResolvedValueOnce({ rows: [{ field_id: 'field-1' }] }) // Create field
          .mockResolvedValueOnce({ rows: [] }) // Update import record
      };
      
      transaction.mockImplementation(async (callback) => {
        return await callback(mockClient);
      });
      
      const result = await schemaService.importSchema(mockTenantId, importData, mockUserId);
      
      expect(result).toBeDefined();
      expect(result.status).toBe('success');
      expect(result.snapshot_id).toBe(mockSnapshotId);
      expect(result.imported_fields).toBe(1);
    });
    
    test('should throw error for invalid import format', async () => {
      const invalidData = {
        export_format: 'invalid-format',
        form_type: 'test',
        fields: []
      };
      
      await expect(
        schemaService.importSchema(mockTenantId, invalidData, mockUserId)
      ).rejects.toThrow('Invalid import format');
    });
  });
  
  describe('listSchemaSnapshots', () => {
    test('should list schemas with pagination', async () => {
      query
        .mockResolvedValueOnce({ // Get snapshots
          rows: [
            { snapshot_id: 'snap-1', form_type: 'test1', semantic_version: 'v1.0.0' },
            { snapshot_id: 'snap-2', form_type: 'test2', semantic_version: 'v1.0.0' }
          ]
        })
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }); // Get count
      
      const result = await schemaService.listSchemaSnapshots(mockTenantId, {
        page: 1,
        limit: 20
      });
      
      expect(result.snapshots).toHaveLength(2);
      expect(result.pagination.total).toBe(10);
      expect(result.pagination.totalPages).toBe(1);
    });
  });
  
  describe('updateSchemaStatus', () => {
    test('should update schema status', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          snapshot_id: mockSnapshotId,
          status: 'archived'
        }]
      });
      
      const result = await schemaService.updateSchemaStatus(mockSnapshotId, mockTenantId, 'archived');
      
      expect(result.status).toBe('archived');
    });
    
    test('should throw error for invalid status', async () => {
      await expect(
        schemaService.updateSchemaStatus(mockSnapshotId, mockTenantId, 'invalid')
      ).rejects.toThrow('status must be one of');
    });
  });
});
