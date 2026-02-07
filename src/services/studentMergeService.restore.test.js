/**
 * Student Merge Service - Restore Functionality Tests
 * Task: 3.3.3 Create merge audit trail and reversibility
 */

const { pool } = require('../config/database');
const studentMergeService = require('./studentMergeService');
const mergeSnapshotService = require('./mergeSnapshotService');

// Mock the database pool
jest.mock('../config/database', () => ({
  pool: {
    connect: jest.fn()
  }
}));

describe('Student Merge Service - Restore Functionality', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    pool.connect.mockResolvedValue(mockClient);
    jest.clearAllMocks();
  });

  describe('restoreMerge', () => {
    const validParams = {
      mergeId: 'merge-123',
      tenantId: 'tenant-123',
      reversedBy: 'user-123',
      reverseReason: 'Incorrect merge'
    };

    it('should restore merge successfully within SLA window', async () => {
      const mergedAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({ // Get merge details
          rows: [{
            merge_id: 'merge-123',
            merge_snapshot_id: 'snapshot-123',
            primary_student_id: 'student-1',
            secondary_student_ids: ['student-2'],
            merged_at: mergedAt,
            status: 'completed',
            tenant_id: 'tenant-123'
          }]
        })
        .mockResolvedValueOnce({ // Get snapshot
          rows: [{
            primary_record: {
              student_id: 'student-1',
              canonical_data: { name: 'John Doe' },
              created_at: '2026-01-01T00:00:00Z'
            },
            secondary_records: [{
              student_id: 'student-2',
              canonical_data: { name: 'Jon Doe' },
              created_at: '2026-01-02T00:00:00Z'
            }]
          }]
        })
        .mockResolvedValueOnce({}) // Restore secondary student
        .mockResolvedValueOnce({ rows: [] }) // Get enrollments
        .mockResolvedValueOnce({ rows: [] }) // Get attendance
        .mockResolvedValueOnce({}) // Update primary student
        .mockResolvedValueOnce({}) // Update audit log
        .mockResolvedValueOnce({}); // COMMIT

      const result = await studentMergeService.restoreMerge(validParams);

      expect(result.mergeId).toBe('merge-123');
      expect(result.status).toBe('reversed');
      expect(result.reversedBy).toBe('user-123');
      expect(result.reverseReason).toBe('Incorrect merge');
      expect(result.restoredRecords).toEqual({
        primary: 1,
        secondary: 1
      });
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should reject restore if SLA window expired', async () => {
      const mergedAt = new Date(Date.now() - 5 * 60 * 60 * 1000); // 5 hours ago
      
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({ // Get merge details
          rows: [{
            merge_id: 'merge-123',
            merge_snapshot_id: 'snapshot-123',
            primary_student_id: 'student-1',
            secondary_student_ids: ['student-2'],
            merged_at: mergedAt,
            status: 'completed',
            tenant_id: 'tenant-123'
          }]
        })
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(studentMergeService.restoreMerge(validParams))
        .rejects.toThrow('Restore window expired');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should reject restore if merge already reversed', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({ // Get merge details
          rows: [{
            merge_id: 'merge-123',
            merge_snapshot_id: 'snapshot-123',
            primary_student_id: 'student-1',
            secondary_student_ids: ['student-2'],
            merged_at: new Date(),
            status: 'reversed', // Already reversed
            tenant_id: 'tenant-123'
          }]
        })
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(studentMergeService.restoreMerge(validParams))
        .rejects.toThrow('Merge has already been reversed');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should reject restore if merge not found', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({ rows: [] }) // Get merge details - not found
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(studentMergeService.restoreMerge(validParams))
        .rejects.toThrow('Merge not found');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should validate required parameters', async () => {
      await expect(studentMergeService.restoreMerge({
        mergeId: 'merge-123',
        tenantId: 'tenant-123',
        reversedBy: 'user-123'
        // Missing reverseReason
      })).rejects.toThrow('Missing required parameters');

      await expect(studentMergeService.restoreMerge({
        mergeId: 'merge-123',
        tenantId: 'tenant-123',
        reversedBy: 'user-123',
        reverseReason: '   ' // Empty reason
      })).rejects.toThrow('Reverse reason cannot be empty');
    });

    it('should rollback on database error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockRejectedValueOnce(new Error('Database error')) // Get merge details fails
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(studentMergeService.restoreMerge(validParams))
        .rejects.toThrow('Failed to restore merge');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('getRestorePreview', () => {
    it('should generate restore preview with valid SLA window', async () => {
      const mergedAt = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago
      
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({ // Get merge details
          rows: [{
            merge_id: 'merge-123',
            merge_snapshot_id: 'snapshot-123',
            primary_student_id: 'student-1',
            secondary_student_ids: ['student-2'],
            merged_at: mergedAt,
            status: 'completed',
            affected_enrollments: 2,
            affected_attendance: 5,
            affected_payments: 1
          }]
        })
        .mockResolvedValueOnce({ // Get snapshot
          rows: [{
            primary_record: {
              student_id: 'student-1',
              canonical_data: { name: 'John Doe' }
            },
            secondary_records: [{
              student_id: 'student-2',
              canonical_data: { name: 'Jon Doe' }
            }]
          }]
        })
        .mockResolvedValueOnce({}); // COMMIT

      const preview = await studentMergeService.getRestorePreview('merge-123', 'tenant-123');

      expect(preview.mergeId).toBe('merge-123');
      expect(preview.canRestore).toBe(true);
      expect(preview.slaWindow.hours).toBe(4);
      expect(preview.slaWindow.timeRemaining).toContain('hours');
      expect(preview.restoreActions.willRestoreStudents).toBe(1);
      expect(preview.restoreActions.willRevertEnrollments).toBe(2);
      expect(preview.restoreActions.willRevertAttendance).toBe(5);
      expect(preview.restoreActions.willRevertPayments).toBe(1);
      expect(preview.primaryStudent.name).toBe('John Doe');
      expect(preview.secondaryStudents).toHaveLength(1);
      expect(preview.secondaryStudents[0].name).toBe('Jon Doe');
    });

    it('should show expired window in preview', async () => {
      const mergedAt = new Date(Date.now() - 5 * 60 * 60 * 1000); // 5 hours ago
      
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({ // Get merge details
          rows: [{
            merge_id: 'merge-123',
            merge_snapshot_id: 'snapshot-123',
            primary_student_id: 'student-1',
            secondary_student_ids: ['student-2'],
            merged_at: mergedAt,
            status: 'completed',
            affected_enrollments: 2,
            affected_attendance: 5,
            affected_payments: 1
          }]
        })
        .mockResolvedValueOnce({ // Get snapshot
          rows: [{
            primary_record: {
              student_id: 'student-1',
              canonical_data: { name: 'John Doe' }
            },
            secondary_records: [{
              student_id: 'student-2',
              canonical_data: { name: 'Jon Doe' }
            }]
          }]
        })
        .mockResolvedValueOnce({}); // COMMIT

      const preview = await studentMergeService.getRestorePreview('merge-123', 'tenant-123');

      expect(preview.canRestore).toBe(false);
      expect(preview.slaWindow.timeRemaining).toBe('Expired');
    });

    it('should reject preview for already reversed merge', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({ // Get merge details
          rows: [{
            merge_id: 'merge-123',
            merge_snapshot_id: 'snapshot-123',
            primary_student_id: 'student-1',
            secondary_student_ids: ['student-2'],
            merged_at: new Date(),
            status: 'reversed'
          }]
        })
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(studentMergeService.getRestorePreview('merge-123', 'tenant-123'))
        .rejects.toThrow('Merge has already been reversed');
    });

    it('should handle missing snapshot gracefully', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({ // Get merge details
          rows: [{
            merge_id: 'merge-123',
            merge_snapshot_id: 'snapshot-123',
            primary_student_id: 'student-1',
            secondary_student_ids: ['student-2'],
            merged_at: new Date(),
            status: 'completed',
            affected_enrollments: 2,
            affected_attendance: 5,
            affected_payments: 1
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Get snapshot - not found
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(studentMergeService.getRestorePreview('merge-123', 'tenant-123'))
        .rejects.toThrow('Merge snapshot not found');
    });
  });

  describe('getMergeHistory', () => {
    it('should include reversed merges in history', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({ // Get merge history
          rows: [
            {
              merge_id: 'merge-123',
              merge_snapshot_id: 'snapshot-123',
              primary_student_id: 'student-1',
              secondary_student_ids: ['student-2'],
              merge_reason: 'Duplicate entry',
              merged_by: 'user-123',
              merged_at: '2026-02-07T10:00:00Z',
              status: 'reversed',
              reversed_at: '2026-02-07T12:00:00Z',
              reversed_by: 'user-456',
              reverse_reason: 'Incorrect merge',
              affected_enrollments: 2,
              affected_attendance: 5,
              affected_payments: 1
            }
          ]
        })
        .mockResolvedValueOnce({}); // COMMIT

      const history = await studentMergeService.getMergeHistory({
        tenantId: 'tenant-123',
        studentId: 'student-1'
      });

      expect(history).toHaveLength(1);
      expect(history[0].status).toBe('reversed');
      expect(history[0].reversedAt).toBe('2026-02-07T12:00:00Z');
      expect(history[0].reversedBy).toBe('user-456');
      expect(history[0].reverseReason).toBe('Incorrect merge');
    });
  });

  describe('getMergeDetails', () => {
    it('should include reverse information in merge details', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET tenant context
        .mockResolvedValueOnce({ // Get merge details
          rows: [{
            merge_id: 'merge-123',
            merge_snapshot_id: 'snapshot-123',
            primary_student_id: 'student-1',
            secondary_student_ids: ['student-2'],
            merge_reason: 'Duplicate entry',
            merged_by: 'user-123',
            merged_at: '2026-02-07T10:00:00Z',
            status: 'reversed',
            reversed_at: '2026-02-07T12:00:00Z',
            reversed_by: 'user-456',
            reverse_reason: 'Incorrect merge',
            affected_enrollments: 2,
            affected_attendance: 5,
            affected_payments: 1,
            metadata: {}
          }]
        })
        .mockResolvedValueOnce({}); // COMMIT

      const details = await studentMergeService.getMergeDetails('merge-123', 'tenant-123');

      expect(details.status).toBe('reversed');
      expect(details.reversedAt).toBe('2026-02-07T12:00:00Z');
      expect(details.reversedBy).toBe('user-456');
      expect(details.reverseReason).toBe('Incorrect merge');
    });
  });
});
