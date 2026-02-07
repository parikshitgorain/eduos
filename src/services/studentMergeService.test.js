/**
 * Student Merge Service Tests
 * Task: 3.3.2 Build merge workflow with impact assessment
 */

const studentMergeService = require('./studentMergeService');
const { pool } = require('../config/database');

describe('Student Merge Service', () => {
  let testTenantId;
  let testPrimaryStudentId;
  let testSecondaryStudentIds;
  let testUserId;
  let testBatchId;
  
  beforeAll(async () => {
    // Create unique test tenant
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const tenantSubdomain = `merge-test-${timestamp}-${randomStr}`;
    
    const tenantResult = await pool.query(
      `INSERT INTO tenants (tenant_id, name, subdomain, tier, status)
       VALUES (uuid_generate_v4(), $1, $2, 'Business', 'active')
       RETURNING tenant_id`,
      [`Merge Test Tenant ${timestamp}`, tenantSubdomain]
    );
    testTenantId = tenantResult.rows[0].tenant_id;
    
    // Create test user
    const userResult = await pool.query(
      `INSERT INTO users (user_id, tenant_id, email, password_hash, roles, status)
       VALUES (uuid_generate_v4(), $1, $2, 'hash', ARRAY['admin'], 'active')
       RETURNING user_id`,
      [testTenantId, `admin-${timestamp}@test.com`]
    );
    testUserId = userResult.rows[0].user_id;
    
    // Create tenant quota
    await pool.query(
      `INSERT INTO tenant_quotas (tenant_id, max_students, max_storage_gb, max_concurrent_users)
       VALUES ($1, 1000, 10, 100)`,
      [testTenantId]
    );
    
    // Create hierarchy: Institute → Center → Program → Batch
    const instituteResult = await pool.query(
      `INSERT INTO institutes (institute_id, tenant_id, name, status)
       VALUES (uuid_generate_v4(), $1, 'Test Institute', 'active')
       RETURNING institute_id`,
      [testTenantId]
    );
    const testInstituteId = instituteResult.rows[0].institute_id;
    
    const centerResult = await pool.query(
      `INSERT INTO centers (center_id, tenant_id, institute_id, name, status)
       VALUES (uuid_generate_v4(), $1, $2, 'Test Center', 'active')
       RETURNING center_id`,
      [testTenantId, testInstituteId]
    );
    const testCenterId = centerResult.rows[0].center_id;
    
    const programResult = await pool.query(
      `INSERT INTO programs (program_id, tenant_id, center_id, name, status)
       VALUES (uuid_generate_v4(), $1, $2, 'Test Program', 'active')
       RETURNING program_id`,
      [testTenantId, testCenterId]
    );
    const testProgramId = programResult.rows[0].program_id;
    
    // Create test batch
    const batchResult = await pool.query(
      `INSERT INTO batches (batch_id, tenant_id, program_id, name, status)
       VALUES (uuid_generate_v4(), $1, $2, 'Test Batch', 'active')
       RETURNING batch_id`,
      [testTenantId, testProgramId]
    );
    testBatchId = batchResult.rows[0].batch_id;
  });
  
  afterAll(async () => {
    // Cleanup: Delete test data
    // Note: merge_snapshots is append-only, and tenants can't be deleted if they have snapshots
    // We use unique tenant subdomains per test run, so this is acceptable
    if (testTenantId) {
      // Delete merge_audit_log first (references merge_snapshots)
      await pool.query('DELETE FROM merge_audit_log WHERE tenant_id = $1', [testTenantId]);
      // Delete other records
      await pool.query('DELETE FROM attendance WHERE tenant_id = $1', [testTenantId]);
      await pool.query('DELETE FROM enrollments WHERE tenant_id = $1', [testTenantId]);
      await pool.query('DELETE FROM students WHERE tenant_id = $1', [testTenantId]);
      await pool.query('DELETE FROM batches WHERE tenant_id = $1', [testTenantId]);
      await pool.query('DELETE FROM programs WHERE tenant_id = $1', [testTenantId]);
      await pool.query('DELETE FROM centers WHERE tenant_id = $1', [testTenantId]);
      await pool.query('DELETE FROM institutes WHERE tenant_id = $1', [testTenantId]);
      await pool.query('DELETE FROM users WHERE tenant_id = $1', [testTenantId]);
      await pool.query('DELETE FROM tenant_quotas WHERE tenant_id = $1', [testTenantId]);
      // Skip tenant deletion due to merge_snapshots foreign key constraint
      // await pool.query('DELETE FROM tenants WHERE tenant_id = $1', [testTenantId]);
    }
    // Close the pool to allow Jest to exit
    await pool.end();
  });
  
  beforeEach(async () => {
    // Create fresh test students for each test
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    
    // Create primary student
    const primaryResult = await pool.query(
      `INSERT INTO students (student_id, tenant_id, first_name, last_name, date_of_birth, status)
       VALUES (uuid_generate_v4(), $1, 'John', 'Doe', '2000-01-01', 'active')
       RETURNING student_id`,
      [testTenantId]
    );
    testPrimaryStudentId = primaryResult.rows[0].student_id;
    
    // Create secondary students
    const secondary1Result = await pool.query(
      `INSERT INTO students (student_id, tenant_id, first_name, last_name, date_of_birth, status)
       VALUES (uuid_generate_v4(), $1, 'Jon', 'Doe', '2000-01-01', 'active')
       RETURNING student_id`,
      [testTenantId]
    );
    
    const secondary2Result = await pool.query(
      `INSERT INTO students (student_id, tenant_id, first_name, last_name, date_of_birth, status)
       VALUES (uuid_generate_v4(), $1, 'Johnny', 'Doe', '2000-01-01', 'active')
       RETURNING student_id`,
      [testTenantId]
    );
    
    testSecondaryStudentIds = [
      secondary1Result.rows[0].student_id,
      secondary2Result.rows[0].student_id
    ];
    
    // Create some related records for impact assessment
    // Enrollments
    await pool.query(
      `INSERT INTO enrollments (enrollment_id, tenant_id, student_id, batch_id, start_date, status)
       VALUES (uuid_generate_v4(), $1, $2, $3, CURRENT_DATE, 'active')`,
      [testTenantId, testSecondaryStudentIds[0], testBatchId]
    );
    
    await pool.query(
      `INSERT INTO enrollments (enrollment_id, tenant_id, student_id, batch_id, start_date, status)
       VALUES (uuid_generate_v4(), $1, $2, $3, CURRENT_DATE, 'active')`,
      [testTenantId, testSecondaryStudentIds[1], testBatchId]
    );
    
    // Attendance records
    await pool.query(
      `INSERT INTO attendance (attendance_id, tenant_id, student_id, event_id, attendance_date, status)
       VALUES (uuid_generate_v4(), $1, $2, uuid_generate_v4(), CURRENT_DATE, 'present')`,
      [testTenantId, testSecondaryStudentIds[0]]
    );
  });
  
  describe('getImpactAssessment', () => {
    test('should calculate impact assessment correctly', async () => {
      const result = await studentMergeService.getImpactAssessment({
        tenantId: testTenantId,
        primaryStudentId: testPrimaryStudentId,
        secondaryStudentIds: testSecondaryStudentIds
      });
      
      expect(result).toHaveProperty('primaryStudentId', testPrimaryStudentId);
      expect(result).toHaveProperty('secondaryStudentIds', testSecondaryStudentIds);
      expect(result).toHaveProperty('affectedRecords');
      expect(result.affectedRecords).toHaveProperty('enrollments', 2);
      expect(result.affectedRecords).toHaveProperty('attendance', 1);
      expect(result.affectedRecords).toHaveProperty('payments', 0);
      expect(result.affectedRecords).toHaveProperty('total', 3);
      expect(result).toHaveProperty('confirmationMessage');
      expect(result.confirmationMessage).toContain('3 records');
      expect(result).toHaveProperty('requiresConfirmation', true);
    });
    
    test('should throw error for missing parameters', async () => {
      await expect(
        studentMergeService.getImpactAssessment({
          tenantId: testTenantId,
          primaryStudentId: testPrimaryStudentId
        })
      ).rejects.toThrow('Missing required parameters');
    });
    
    test('should throw error for empty secondary student array', async () => {
      await expect(
        studentMergeService.getImpactAssessment({
          tenantId: testTenantId,
          primaryStudentId: testPrimaryStudentId,
          secondaryStudentIds: []
        })
      ).rejects.toThrow('secondaryStudentIds must be a non-empty array');
    });
  });
  
  describe('executeMerge', () => {
    test('should execute merge successfully with all steps', async () => {
      const mergeReason = 'Duplicate entry from CSV import';
      
      const result = await studentMergeService.executeMerge({
        tenantId: testTenantId,
        primaryStudentId: testPrimaryStudentId,
        secondaryStudentIds: testSecondaryStudentIds,
        mergeReason,
        mergedBy: testUserId
      });
      
      // Verify merge result
      expect(result).toHaveProperty('mergeId');
      expect(result).toHaveProperty('snapshotId');
      expect(result).toHaveProperty('primaryStudentId', testPrimaryStudentId);
      expect(result).toHaveProperty('secondaryStudentIds', testSecondaryStudentIds);
      expect(result).toHaveProperty('mergedAt');
      expect(result).toHaveProperty('mergedBy', testUserId);
      expect(result).toHaveProperty('mergeReason', mergeReason);
      expect(result).toHaveProperty('status', 'completed');
      expect(result.impact).toHaveProperty('enrollments', 2);
      expect(result.impact).toHaveProperty('attendance', 1);
      
      // Verify enrollments were updated
      const enrollmentsResult = await pool.query(
        `SELECT student_id FROM enrollments WHERE tenant_id = $1 AND student_id = ANY($2)`,
        [testTenantId, [testPrimaryStudentId, ...testSecondaryStudentIds]]
      );
      
      // All enrollments should now point to primary student
      const primaryEnrollments = enrollmentsResult.rows.filter(row => row.student_id === testPrimaryStudentId);
      const secondaryEnrollments = enrollmentsResult.rows.filter(row => testSecondaryStudentIds.includes(row.student_id));
      
      expect(primaryEnrollments.length).toBeGreaterThan(0);
      expect(secondaryEnrollments.length).toBe(0);
      
      // Verify attendance was updated
      const attendanceResult = await pool.query(
        `SELECT student_id FROM attendance WHERE tenant_id = $1 AND student_id = ANY($2)`,
        [testTenantId, [testPrimaryStudentId, ...testSecondaryStudentIds]]
      );
      
      // All attendance should now point to primary student
      const primaryAttendance = attendanceResult.rows.filter(row => row.student_id === testPrimaryStudentId);
      const secondaryAttendance = attendanceResult.rows.filter(row => testSecondaryStudentIds.includes(row.student_id));
      
      expect(primaryAttendance.length).toBeGreaterThan(0);
      expect(secondaryAttendance.length).toBe(0);
      
      // Verify secondary students were soft-deleted
      const secondaryStudentsResult = await pool.query(
        `SELECT student_id, status, merged_into FROM students 
         WHERE tenant_id = $1 AND student_id = ANY($2)`,
        [testTenantId, testSecondaryStudentIds]
      );
      
      expect(secondaryStudentsResult.rows.length).toBe(2);
      expect(secondaryStudentsResult.rows.every(row => row.status === 'merged')).toBe(true);
      expect(secondaryStudentsResult.rows.every(row => row.merged_into === testPrimaryStudentId)).toBe(true);
      
      // Verify primary student has merged_from metadata
      const primaryStudentResult = await pool.query(
        `SELECT merged_from FROM students WHERE student_id = $1`,
        [testPrimaryStudentId]
      );
      
      expect(primaryStudentResult.rows[0].merged_from).toEqual(expect.arrayContaining(testSecondaryStudentIds));
      
      // Verify audit log was created
      const auditResult = await pool.query(
        `SELECT * FROM merge_audit_log WHERE merge_id = $1`,
        [result.mergeId]
      );
      
      expect(auditResult.rows.length).toBe(1);
      expect(auditResult.rows[0].primary_student_id).toBe(testPrimaryStudentId);
      expect(auditResult.rows[0].secondary_student_ids).toEqual(testSecondaryStudentIds);
      expect(auditResult.rows[0].merge_reason).toBe(mergeReason);
      expect(auditResult.rows[0].status).toBe('completed');
      expect(auditResult.rows[0].affected_enrollments).toBe(2);
      expect(auditResult.rows[0].affected_attendance).toBe(1);
    });
    
    test('should throw error for missing merge reason', async () => {
      await expect(
        studentMergeService.executeMerge({
          tenantId: testTenantId,
          primaryStudentId: testPrimaryStudentId,
          secondaryStudentIds: testSecondaryStudentIds,
          mergeReason: '',
          mergedBy: testUserId
        })
      ).rejects.toThrow('Missing required parameters');
    });
    
    test('should throw error for missing parameters', async () => {
      await expect(
        studentMergeService.executeMerge({
          tenantId: testTenantId,
          primaryStudentId: testPrimaryStudentId,
          secondaryStudentIds: testSecondaryStudentIds,
          mergeReason: 'Test'
        })
      ).rejects.toThrow('Missing required parameters');
    });
    
    test('should rollback on error', async () => {
      // Use invalid tenant ID to force error
      const invalidTenantId = '00000000-0000-0000-0000-000000000000';
      
      await expect(
        studentMergeService.executeMerge({
          tenantId: invalidTenantId,
          primaryStudentId: testPrimaryStudentId,
          secondaryStudentIds: testSecondaryStudentIds,
          mergeReason: 'Test merge',
          mergedBy: testUserId
        })
      ).rejects.toThrow();
      
      // Verify no changes were made to enrollments
      const enrollmentsResult = await pool.query(
        `SELECT student_id FROM enrollments WHERE tenant_id = $1 AND student_id = ANY($2)`,
        [testTenantId, testSecondaryStudentIds]
      );
      
      expect(enrollmentsResult.rows.length).toBe(2);
      expect(enrollmentsResult.rows.some(row => testSecondaryStudentIds.includes(row.student_id))).toBe(true);
    });
  });
  
  describe('getMergeHistory', () => {
    test('should retrieve merge history for primary student', async () => {
      // Execute a merge first
      const mergeResult = await studentMergeService.executeMerge({
        tenantId: testTenantId,
        primaryStudentId: testPrimaryStudentId,
        secondaryStudentIds: testSecondaryStudentIds,
        mergeReason: 'Test merge for history',
        mergedBy: testUserId
      });
      
      // Get history
      const history = await studentMergeService.getMergeHistory({
        tenantId: testTenantId,
        studentId: testPrimaryStudentId
      });
      
      expect(history).toBeInstanceOf(Array);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('mergeId', mergeResult.mergeId);
      expect(history[0]).toHaveProperty('primaryStudentId', testPrimaryStudentId);
      expect(history[0]).toHaveProperty('secondaryStudentIds', testSecondaryStudentIds);
      expect(history[0]).toHaveProperty('status', 'completed');
    });
    
    test('should retrieve merge history for secondary student', async () => {
      // Execute a merge first
      await studentMergeService.executeMerge({
        tenantId: testTenantId,
        primaryStudentId: testPrimaryStudentId,
        secondaryStudentIds: testSecondaryStudentIds,
        mergeReason: 'Test merge for history',
        mergedBy: testUserId
      });
      
      // Get history for secondary student
      const history = await studentMergeService.getMergeHistory({
        tenantId: testTenantId,
        studentId: testSecondaryStudentIds[0]
      });
      
      expect(history).toBeInstanceOf(Array);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('primaryStudentId', testPrimaryStudentId);
      expect(history[0].secondaryStudentIds).toContain(testSecondaryStudentIds[0]);
    });
    
    test('should return empty array for student with no merge history', async () => {
      // Create a new student with no merges
      const newStudentResult = await pool.query(
        `INSERT INTO students (student_id, tenant_id, first_name, last_name, date_of_birth, status)
         VALUES (uuid_generate_v4(), $1, 'Jane', 'Smith', '2001-01-01', 'active')
         RETURNING student_id`,
        [testTenantId]
      );
      
      const history = await studentMergeService.getMergeHistory({
        tenantId: testTenantId,
        studentId: newStudentResult.rows[0].student_id
      });
      
      expect(history).toBeInstanceOf(Array);
      expect(history.length).toBe(0);
    });
  });
  
  describe('getMergeDetails', () => {
    test('should retrieve detailed merge information', async () => {
      // Execute a merge first
      const mergeResult = await studentMergeService.executeMerge({
        tenantId: testTenantId,
        primaryStudentId: testPrimaryStudentId,
        secondaryStudentIds: testSecondaryStudentIds,
        mergeReason: 'Detailed test merge',
        mergedBy: testUserId
      });
      
      // Get details
      const details = await studentMergeService.getMergeDetails(
        mergeResult.mergeId,
        testTenantId
      );
      
      expect(details).toHaveProperty('mergeId', mergeResult.mergeId);
      expect(details).toHaveProperty('snapshotId', mergeResult.snapshotId);
      expect(details).toHaveProperty('primaryStudentId', testPrimaryStudentId);
      expect(details).toHaveProperty('secondaryStudentIds', testSecondaryStudentIds);
      expect(details).toHaveProperty('mergeReason', 'Detailed test merge');
      expect(details).toHaveProperty('mergedBy', testUserId);
      expect(details).toHaveProperty('status', 'completed');
      expect(details).toHaveProperty('affectedRecords');
      expect(details.affectedRecords).toHaveProperty('total', 3);
    });
    
    test('should throw error for non-existent merge', async () => {
      const fakeMergeId = '00000000-0000-0000-0000-000000000000';
      
      await expect(
        studentMergeService.getMergeDetails(fakeMergeId, testTenantId)
      ).rejects.toThrow('Merge not found');
    });
  });
  
  describe('Transaction integrity', () => {
    test('should maintain data consistency on successful merge', async () => {
      const mergeResult = await studentMergeService.executeMerge({
        tenantId: testTenantId,
        primaryStudentId: testPrimaryStudentId,
        secondaryStudentIds: testSecondaryStudentIds,
        mergeReason: 'Consistency test',
        mergedBy: testUserId
      });
      
      // Verify snapshot exists
      const snapshotResult = await pool.query(
        `SELECT merge_snapshot_id FROM merge_snapshots WHERE merge_snapshot_id = $1`,
        [mergeResult.snapshotId]
      );
      expect(snapshotResult.rows.length).toBe(1);
      
      // Verify audit log exists
      const auditResult = await pool.query(
        `SELECT merge_id FROM merge_audit_log WHERE merge_id = $1`,
        [mergeResult.mergeId]
      );
      expect(auditResult.rows.length).toBe(1);
      
      // Verify all foreign keys point to primary student
      const enrollmentCheck = await pool.query(
        `SELECT COUNT(*) as count FROM enrollments 
         WHERE tenant_id = $1 AND student_id = $2`,
        [testTenantId, testPrimaryStudentId]
      );
      expect(parseInt(enrollmentCheck.rows[0].count)).toBe(2);
    });
  });
});
