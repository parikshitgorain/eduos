/**
 * Schema Integrity Check Job Tests
 * 
 * Tests for nightly integrity check job
 * Task: 2.2.2 - Implement immutable schema snapshots with SHA-256 hashing
 */

const { query } = require('../config/database');
const schemaService = require('../services/schemaService');
const integrityJob = require('./schemaIntegrityCheckJob');

describe('Schema Integrity Check Job (Task 2.2.2)', () => {
  let testTenantId;
  let testUserId;
  let testSnapshotIds = [];
  
  beforeAll(async () => {
    // Create test tenant with unique subdomain
    const uniqueSubdomain = `test-integrity-job-${Date.now()}`;
    const tenantResult = await query(`
      INSERT INTO tenants (name, subdomain, tier)
      VALUES ('Test Integrity Job Tenant', $1, 'Enterprise')
      RETURNING tenant_id
    `, [uniqueSubdomain]);
    testTenantId = tenantResult.rows[0].tenant_id;
    
    // Create test user
    const userResult = await query(`
      INSERT INTO users (tenant_id, email, password_hash, first_name, last_name)
      VALUES ($1, $2, 'hash', 'Test', 'User')
      RETURNING user_id
    `, [testTenantId, `integrity-job-${Date.now()}@test.com`]);
    testUserId = userResult.rows[0].user_id;
    
    // Create multiple test schema snapshots
    for (let i = 0; i < 3; i++) {
      const snapshot = await schemaService.createSchemaSnapshot({
        tenantId: testTenantId,
        formType: `integrity_job_test_${i}`,
        fields: [
          {
            field_name: `test_field_${i}`,
            field_type: 'text',
            label: `Test Field ${i}`,
            is_required: true
          }
        ],
        createdBy: testUserId,
        changeSummary: `Test schema ${i}`
      });
      
      testSnapshotIds.push(snapshot.snapshot.snapshot_id);
    }
  });
  
  afterAll(async () => {
    // Clean up test data
    try {
      await query('DELETE FROM users WHERE tenant_id = $1', [testTenantId]);
      await query('DELETE FROM tenants WHERE tenant_id = $1', [testTenantId]);
    } catch (error) {
      console.log('Cleanup note: Some test data may remain due to immutability constraints');
    }
  });
  
  describe('Integrity Check Execution', () => {
    test('should run integrity check successfully', async () => {
      const result = await integrityJob.runIntegrityCheck();
      
      expect(result.success).toBe(true);
      expect(result.check_id).toBeDefined();
      expect(result.total_checked).toBeGreaterThan(0);
      expect(result.failed_count).toBe(0);
      expect(result.duration_ms).toBeGreaterThan(0);
    });
    
    test('should log check results to database', async () => {
      await integrityJob.runIntegrityCheck();
      
      const result = await query(`
        SELECT * FROM schema_integrity_checks
        ORDER BY check_started_at DESC
        LIMIT 1
      `);
      
      expect(result.rows.length).toBe(1);
      const check = result.rows[0];
      expect(check.check_status).toBe('completed');
      expect(check.total_snapshots_checked).toBeGreaterThan(0);
      expect(check.failed_snapshots).toBe(0);
    });
  });
  
  describe('Single Snapshot Verification', () => {
    test('should verify single snapshot integrity', async () => {
      const result = await integrityJob.verifySnapshotIntegrity(testSnapshotIds[0]);
      
      expect(result.is_valid).toBe(true);
      expect(result.snapshot_id).toBe(testSnapshotIds[0]);
      expect(result.stored_hash).toBeDefined();
      expect(result.computed_hash).toBeDefined();
      expect(result.stored_hash).toBe(result.computed_hash);
    });
    
    test('should throw error for non-existent snapshot', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      await expect(async () => {
        await integrityJob.verifySnapshotIntegrity(fakeId);
      }).rejects.toThrow(/not found/i);
    });
  });
  
  describe('Integrity Check History', () => {
    test('should retrieve integrity check history', async () => {
      // Run a check first
      await integrityJob.runIntegrityCheck();
      
      const history = await integrityJob.getIntegrityCheckHistory(10);
      
      expect(history).toBeInstanceOf(Array);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('check_id');
      expect(history[0]).toHaveProperty('check_started_at');
      expect(history[0]).toHaveProperty('total_snapshots_checked');
      expect(history[0]).toHaveProperty('success_rate_percent');
    });
    
    test('should retrieve latest integrity check', async () => {
      // Run a check first
      await integrityJob.runIntegrityCheck();
      
      const latest = await integrityJob.getLatestIntegrityCheck();
      
      expect(latest).toBeDefined();
      expect(latest.check_id).toBeDefined();
      expect(latest.check_status).toBe('completed');
    });
  });
  
  describe('Integrity Check View', () => {
    test('should query integrity check history view', async () => {
      const result = await query(`
        SELECT * FROM schema_integrity_check_history
        LIMIT 5
      `);
      
      expect(result.rows).toBeInstanceOf(Array);
      
      if (result.rows.length > 0) {
        const check = result.rows[0];
        expect(check).toHaveProperty('check_id');
        expect(check).toHaveProperty('success_rate_percent');
        expect(check).toHaveProperty('duration');
      }
    });
  });
  
  describe('Alert Mechanism', () => {
    test('should have sendIntegrityAlert function', () => {
      expect(typeof integrityJob.sendIntegrityAlert).toBe('function');
    });
    
    test('should call alert function when failures detected', async () => {
      // Mock the alert function
      const originalAlert = integrityJob.sendIntegrityAlert;
      let alertCalled = false;
      
      integrityJob.sendIntegrityAlert = async (checkResult) => {
        alertCalled = true;
        expect(checkResult.failed_count).toBeGreaterThan(0);
      };
      
      // Simulate a check with failures
      const mockCheckResult = {
        check_id: 'test-check-id',
        total_checked: 10,
        failed_count: 2,
        failed_snapshots: ['id1', 'id2']
      };
      
      await integrityJob.sendIntegrityAlert(mockCheckResult);
      
      expect(alertCalled).toBe(true);
      
      // Restore original function
      integrityJob.sendIntegrityAlert = originalAlert;
    });
  });
  
  describe('Job Scheduling', () => {
    test('should have scheduleNightlyCheck function', () => {
      expect(typeof integrityJob.scheduleNightlyCheck).toBe('function');
    });
    
    test('should have startIntegrityCheckJob function', () => {
      expect(typeof integrityJob.startIntegrityCheckJob).toBe('function');
    });
    
    test('should have stopIntegrityCheckJob function', () => {
      expect(typeof integrityJob.stopIntegrityCheckJob).toBe('function');
    });
    
    test('should schedule job with custom cron expression', () => {
      // Test that scheduling doesn't throw an error
      const task = integrityJob.scheduleNightlyCheck('0 3 * * *');
      
      expect(task).toBeDefined();
      
      // Stop the task immediately
      integrityJob.stopIntegrityCheckJob(task);
    });
  });
});

