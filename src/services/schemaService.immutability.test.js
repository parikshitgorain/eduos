/**
 * Schema Service Immutability Tests
 * 
 * Tests for immutable schema snapshots with SHA-256 hashing
 * Task: 2.2.2 - Implement immutable schema snapshots with SHA-256 hashing
 */

const { query, transaction } = require('../config/database');
const schemaService = require('./schemaService');

describe('Schema Immutability (Task 2.2.2)', () => {
  let testTenantId;
  let testUserId;
  let testSnapshotId;
  
  beforeAll(async () => {
    // Create test tenant with unique subdomain
    const uniqueId = Date.now();
    const tenantResult = await query(`
      INSERT INTO tenants (name, subdomain, tier)
      VALUES ('Test Immutability Tenant', 'test-immutability-${uniqueId}', 'Business')
      RETURNING tenant_id
    `);
    testTenantId = tenantResult.rows[0].tenant_id;
    
    // Create test user
    const userResult = await query(`
      INSERT INTO users (tenant_id, email, password_hash, first_name, last_name)
      VALUES ($1, 'immutability@test.com', 'hash', 'Test', 'User')
      RETURNING user_id
    `, [testTenantId]);
    testUserId = userResult.rows[0].user_id;
    
    // Create test schema snapshot
    const snapshot = await schemaService.createSchemaSnapshot({
      tenantId: testTenantId,
      formType: 'immutability_test',
      fields: [
        {
          field_name: 'test_field',
          field_type: 'text',
          label: 'Test Field',
          is_required: true
        }
      ],
      createdBy: testUserId,
      changeSummary: 'Initial test schema'
    });
    
    testSnapshotId = snapshot.snapshot.snapshot_id;
  });
  
  afterAll(async () => {
    // Clean up test data
    // Note: We can't delete schema_snapshots due to immutability constraints
    // So we'll delete the tenant which should cascade
    try {
      await query('DELETE FROM users WHERE tenant_id = $1', [testTenantId]);
      await query('DELETE FROM tenants WHERE tenant_id = $1', [testTenantId]);
    } catch (error) {
      // Expected to fail due to foreign key constraints from immutable snapshots
      console.log('Cleanup note: Some test data may remain due to immutability constraints');
    }
  });
  
  describe('Append-Only Constraints', () => {
    test('should prevent UPDATE on schema_snapshots', async () => {
      await expect(async () => {
        await query(`
          UPDATE schema_snapshots
          SET change_summary = 'Attempted update'
          WHERE snapshot_id = $1
        `, [testSnapshotId]);
      }).rejects.toThrow(/immutable/i);
    });
    
    test('should prevent DELETE on schema_snapshots', async () => {
      await expect(async () => {
        await query(`
          DELETE FROM schema_snapshots
          WHERE snapshot_id = $1
        `, [testSnapshotId]);
      }).rejects.toThrow(/immutable/i);
    });
    
    test('should prevent UPDATE on field_definitions', async () => {
      const fieldResult = await query(`
        SELECT field_id FROM field_definitions
        WHERE snapshot_id = $1
        LIMIT 1
      `, [testSnapshotId]);
      
      const fieldId = fieldResult.rows[0].field_id;
      
      await expect(async () => {
        await query(`
          UPDATE field_definitions
          SET label = 'Attempted update'
          WHERE field_id = $1
        `, [fieldId]);
      }).rejects.toThrow(/immutable/i);
    });
    
    test('should prevent DELETE on field_definitions', async () => {
      const fieldResult = await query(`
        SELECT field_id FROM field_definitions
        WHERE snapshot_id = $1
        LIMIT 1
      `, [testSnapshotId]);
      
      const fieldId = fieldResult.rows[0].field_id;
      
      await expect(async () => {
        await query(`
          DELETE FROM field_definitions
          WHERE field_id = $1
        `, [fieldId]);
      }).rejects.toThrow(/immutable/i);
    });
    
    test('should allow INSERT on schema_snapshots', async () => {
      const result = await schemaService.createSchemaSnapshot({
        tenantId: testTenantId,
        formType: 'immutability_test_2',
        fields: [
          {
            field_name: 'another_field',
            field_type: 'number',
            label: 'Another Field'
          }
        ],
        createdBy: testUserId,
        changeSummary: 'Testing INSERT is allowed'
      });
      
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot.snapshot_id).toBeDefined();
    });
  });
  
  describe('SHA-256 Hash Computation', () => {
    test('should compute SHA-256 hash on snapshot creation', async () => {
      const snapshot = await schemaService.getSchemaSnapshotById(testSnapshotId, testTenantId);
      
      expect(snapshot.schema_hash).toBeDefined();
      expect(snapshot.schema_hash).toHaveLength(64); // SHA-256 hex is 64 characters
      expect(snapshot.schema_hash).toMatch(/^[a-f0-9]{64}$/); // Hex format
    });
    
    test('should compute consistent hash for same schema', () => {
      const schema1 = { field: 'value', another: 'data' };
      const schema2 = { field: 'value', another: 'data' };
      
      const hash1 = schemaService.computeSchemaHash(schema1);
      const hash2 = schemaService.computeSchemaHash(schema2);
      
      expect(hash1).toBe(hash2);
    });
    
    test('should compute different hash for different schema', () => {
      const schema1 = { field: 'value1' };
      const schema2 = { field: 'value2' };
      
      const hash1 = schemaService.computeSchemaHash(schema1);
      const hash2 = schemaService.computeSchemaHash(schema2);
      
      expect(hash1).not.toBe(hash2);
    });
  });
  
  describe('Integrity Verification', () => {
    test('should verify valid snapshot integrity', async () => {
      const result = await schemaService.verifySchemaIntegrity(testSnapshotId, testTenantId);
      
      expect(result.is_valid).toBe(true);
      expect(result.stored_hash).toBeDefined();
      expect(result.computed_hash).toBeDefined();
      expect(result.stored_hash).toBe(result.computed_hash);
    });
    
    test('should detect integrity violation (simulated)', async () => {
      // This test simulates what would happen if data was tampered with
      // In reality, the immutability constraints prevent this
      
      const snapshot = await schemaService.getSchemaSnapshotById(testSnapshotId, testTenantId);
      const originalHash = snapshot.schema_hash;
      
      // Compute hash of modified schema
      const modifiedSchema = { ...snapshot.schema_definition, tampered: true };
      const tamperedHash = schemaService.computeSchemaHash(modifiedSchema);
      
      // Verify they don't match
      expect(originalHash).not.toBe(tamperedHash);
    });
    
    test('should verify all snapshots for tenant', async () => {
      const result = await schemaService.verifyAllSnapshotsForTenant(testTenantId);
      
      expect(result.total_checked).toBeGreaterThan(0);
      expect(result.failed_count).toBe(0);
      expect(result.success_rate).toBe(100);
      expect(result.results).toBeInstanceOf(Array);
      expect(result.results.length).toBe(result.total_checked);
    });
  });
  
  describe('Semantic Versioning', () => {
    test('should link snapshots to parent versions', async () => {
      // Create parent snapshot
      const parent = await schemaService.createSchemaSnapshot({
        tenantId: testTenantId,
        formType: 'versioning_test',
        fields: [
          {
            field_name: 'version_field',
            field_type: 'text',
            label: 'Version Field'
          }
        ],
        createdBy: testUserId,
        changeSummary: 'Parent version'
      });
      
      // Create child snapshot
      const child = await schemaService.createSchemaSnapshot({
        tenantId: testTenantId,
        formType: 'versioning_test',
        fields: [
          {
            field_name: 'version_field',
            field_type: 'text',
            label: 'Version Field'
          },
          {
            field_name: 'new_field',
            field_type: 'number',
            label: 'New Field'
          }
        ],
        createdBy: testUserId,
        changeSummary: 'Child version',
        parentSnapshotId: parent.snapshot.snapshot_id,
        changeType: 'minor'
      });
      
      expect(child.snapshot.parent_snapshot_id).toBe(parent.snapshot.snapshot_id);
      expect(child.snapshot.semantic_version).not.toBe(parent.snapshot.semantic_version);
    });
    
    test('should increment version correctly', () => {
      expect(schemaService.incrementSemVer('v1.0.0', 'patch')).toBe('v1.0.1');
      expect(schemaService.incrementSemVer('v1.0.0', 'minor')).toBe('v1.1.0');
      expect(schemaService.incrementSemVer('v1.0.0', 'major')).toBe('v2.0.0');
      expect(schemaService.incrementSemVer('v1.2.3', 'patch')).toBe('v1.2.4');
      expect(schemaService.incrementSemVer('v1.2.3', 'minor')).toBe('v1.3.0');
      expect(schemaService.incrementSemVer('v1.2.3', 'major')).toBe('v2.0.0');
    });
  });
  
  describe('Integrity Check Infrastructure', () => {
    test('should have schema_integrity_checks table', async () => {
      const result = await query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'schema_integrity_checks'
      `);
      
      expect(result.rows.length).toBe(1);
    });
    
    test('should have verify_all_schema_integrity function', async () => {
      const result = await query(`
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
          AND routine_name = 'verify_all_schema_integrity'
      `);
      
      expect(result.rows.length).toBe(1);
    });
    
    test('should have verify_schema_integrity function', async () => {
      const result = await query(`
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
          AND routine_name = 'verify_schema_integrity'
      `);
      
      expect(result.rows.length).toBe(1);
    });
    
    test('should have immutability trigger functions', async () => {
      const result = await query(`
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
          AND routine_name IN (
            'prevent_schema_snapshot_modification',
            'prevent_field_definition_modification'
          )
        ORDER BY routine_name
      `);
      
      expect(result.rows.length).toBe(2);
    });
  });
});

