/**
 * Rule Override Service Tests
 */

const ruleOverrideService = require('./ruleOverrideService');
const { OVERRIDE_STATUS, DEFAULT_APPROVAL_CHAIN } = require('./ruleOverrideService');

// Mock database
const mockDb = {
  insert: jest.fn().mockResolvedValue([]),
  where: jest.fn().mockReturnThis(),
  first: jest.fn(),
  update: jest.fn().mockResolvedValue(1),
  orderBy: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis()
};

const db = jest.fn(() => mockDb);

describe('RuleOverrideService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mock implementations
    mockDb.insert.mockResolvedValue([]);
    mockDb.where.mockReturnThis();
    mockDb.first.mockResolvedValue(null);
    mockDb.update.mockResolvedValue(1);
    mockDb.orderBy.mockReturnThis();
    mockDb.select.mockReturnThis();
    mockDb.count.mockReturnThis();
    mockDb.groupBy.mockResolvedValue([]);
    
    ruleOverrideService.initialize(db);
  });

  describe('createOverrideRequest', () => {
    it('should create a new override request with default approval chain', async () => {
      const mockRule = {
        rule_id: 'rule-123',
        tenant_id: 'tenant-123',
        rule_name: 'Attendance Threshold'
      };

      mockDb.first
        .mockResolvedValueOnce(mockRule) // Rule exists check
        .mockResolvedValueOnce(null); // No existing override

      const overrideData = {
        tenant_id: 'tenant-123',
        rule_id: 'rule-123',
        student_id: 'student-123',
        reason: 'Medical emergency',
        requested_by: 'user-123'
      };

      const result = await ruleOverrideService.createOverrideRequest(overrideData);

      expect(result).toHaveProperty('override_id');
      expect(result.status).toBe(OVERRIDE_STATUS.PENDING);
      expect(result.approval_chain).toEqual(DEFAULT_APPROVAL_CHAIN);
      expect(result.current_approval_level).toBe(0);
      expect(mockDb.insert).toHaveBeenCalledTimes(2); // Override + audit log
    });

    it('should create override request with custom approval chain', async () => {
      const mockRule = {
        rule_id: 'rule-123',
        tenant_id: 'tenant-123',
        rule_name: 'Grade Eligibility'
      };

      mockDb.first
        .mockResolvedValueOnce(mockRule)
        .mockResolvedValueOnce(null);

      const customChain = ['teacher', 'dean'];
      const overrideData = {
        tenant_id: 'tenant-123',
        rule_id: 'rule-123',
        student_id: 'student-123',
        reason: 'Special circumstances',
        requested_by: 'user-123',
        approval_chain: customChain
      };

      const result = await ruleOverrideService.createOverrideRequest(overrideData);

      expect(result.approval_chain).toEqual(customChain);
    });

    it('should include supporting documents if provided', async () => {
      const mockRule = {
        rule_id: 'rule-123',
        tenant_id: 'tenant-123'
      };

      mockDb.first
        .mockResolvedValueOnce(mockRule)
        .mockResolvedValueOnce(null);

      const documents = [
        { name: 'medical_cert.pdf', url: 'https://example.com/doc1.pdf' }
      ];

      const overrideData = {
        tenant_id: 'tenant-123',
        rule_id: 'rule-123',
        student_id: 'student-123',
        reason: 'Medical condition',
        requested_by: 'user-123',
        supporting_documents: documents
      };

      const result = await ruleOverrideService.createOverrideRequest(overrideData);

      expect(result.supporting_documents).toEqual(documents);
    });

    it('should throw error if required fields are missing', async () => {
      const overrideData = {
        tenant_id: 'tenant-123',
        rule_id: 'rule-123'
        // Missing student_id, reason, requested_by
      };

      await expect(
        ruleOverrideService.createOverrideRequest(overrideData)
      ).rejects.toThrow('Missing required fields');
    });

    it('should throw error if rule does not exist', async () => {
      mockDb.first.mockResolvedValueOnce(null); // Rule not found

      const overrideData = {
        tenant_id: 'tenant-123',
        rule_id: 'nonexistent-rule',
        student_id: 'student-123',
        reason: 'Test',
        requested_by: 'user-123'
      };

      await expect(
        ruleOverrideService.createOverrideRequest(overrideData)
      ).rejects.toThrow('Rule not found');
    });

    it('should throw error if pending override already exists', async () => {
      const mockRule = { rule_id: 'rule-123', tenant_id: 'tenant-123' };
      const existingOverride = {
        override_id: 'existing-123',
        status: OVERRIDE_STATUS.PENDING
      };

      mockDb.first
        .mockResolvedValueOnce(mockRule)
        .mockResolvedValueOnce(existingOverride);

      const overrideData = {
        tenant_id: 'tenant-123',
        rule_id: 'rule-123',
        student_id: 'student-123',
        reason: 'Test',
        requested_by: 'user-123'
      };

      await expect(
        ruleOverrideService.createOverrideRequest(overrideData)
      ).rejects.toThrow('A pending override request already exists');
    });
  });

  describe('processApproval', () => {
    it('should approve at first level and advance to next level', async () => {
      const mockOverride = {
        override_id: 'override-123',
        tenant_id: 'tenant-123',
        rule_id: 'rule-123',
        student_id: 'student-123',
        status: OVERRIDE_STATUS.PENDING,
        approval_chain: JSON.stringify(['teacher', 'admin', 'dean']),
        current_approval_level: 0,
        approvals: JSON.stringify([]),
        requested_by: 'user-123'
      };

      const updatedOverride = {
        ...mockOverride,
        current_approval_level: 1,
        approvals: JSON.stringify([
          { level: 0, role: 'teacher', approver_id: 'approver-123', action: 'approve' }
        ])
      };

      mockDb.first
        .mockResolvedValueOnce(mockOverride) // Get override
        .mockResolvedValueOnce(updatedOverride) // Get override again for return
        .mockResolvedValueOnce({ rule_name: 'Test Rule' }); // Get rule for notification

      const decision = {
        approver_id: 'approver-123',
        approver_role: 'teacher',
        action: 'approve',
        reason: 'Approved'
      };

      const result = await ruleOverrideService.processApproval(
        'override-123',
        'tenant-123',
        decision
      );

      expect(mockDb.update).toHaveBeenCalled();
      const updateCall = mockDb.update.mock.calls[0][0];
      expect(updateCall.current_approval_level).toBe(1);
      expect(updateCall.status).toBe(OVERRIDE_STATUS.PENDING); // Still pending, not final level
    });

    it('should fully approve when last level approves', async () => {
      // Clear any previous mocks
      mockDb.first.mockReset();
      mockDb.update.mockReset();
      mockDb.insert.mockReset();
      
      const mockOverride = {
        override_id: 'override-123',
        tenant_id: 'tenant-123',
        rule_id: 'rule-123',
        student_id: 'student-123',
        status: OVERRIDE_STATUS.PENDING,
        approval_chain: JSON.stringify(['teacher', 'admin']),
        current_approval_level: 1, // Last level
        approvals: JSON.stringify([
          { level: 0, role: 'teacher', approver_id: 'teacher-123', action: 'approve' }
        ]),
        requested_by: 'user-123'
      };

      const updatedOverride = {
        ...mockOverride,
        status: OVERRIDE_STATUS.APPROVED,
        approved_by: 'admin-123',
        approval_chain: JSON.stringify(['teacher', 'admin']),
        approvals: JSON.stringify([
          { level: 0, role: 'teacher', approver_id: 'teacher-123', action: 'approve' }
        ])
      };

      mockDb.first
        .mockResolvedValueOnce(mockOverride)
        .mockResolvedValueOnce(updatedOverride)
        .mockResolvedValueOnce({ rule_name: 'Test Rule' });
      
      mockDb.update.mockResolvedValue(1);
      mockDb.insert.mockResolvedValue([]);

      const decision = {
        approver_id: 'admin-123',
        approver_role: 'admin',
        action: 'approve'
      };

      await ruleOverrideService.processApproval(
        'override-123',
        'tenant-123',
        decision
      );

      const updateCall = mockDb.update.mock.calls[0][0];
      expect(updateCall.status).toBe(OVERRIDE_STATUS.APPROVED);
      expect(updateCall.approved_by).toBe('admin-123');
      expect(updateCall.approved_at).toBeDefined();
    });

    it('should reject immediately at any level', async () => {
      // Clear any previous mocks
      mockDb.first.mockReset();
      mockDb.update.mockReset();
      mockDb.insert.mockReset();
      
      const mockOverride = {
        override_id: 'override-123',
        tenant_id: 'tenant-123',
        rule_id: 'rule-123',
        student_id: 'student-123',
        status: OVERRIDE_STATUS.PENDING,
        approval_chain: JSON.stringify(['teacher', 'admin', 'dean']),
        current_approval_level: 0,
        approvals: JSON.stringify([]),
        requested_by: 'user-123'
      };

      const updatedOverride = {
        ...mockOverride,
        status: OVERRIDE_STATUS.REJECTED,
        approved_by: 'teacher-123',
        approval_chain: JSON.stringify(['teacher', 'admin', 'dean']),
        approvals: JSON.stringify([])
      };

      mockDb.first
        .mockResolvedValueOnce(mockOverride)
        .mockResolvedValueOnce(updatedOverride)
        .mockResolvedValueOnce({ rule_name: 'Test Rule' });
      
      mockDb.update.mockResolvedValue(1);
      mockDb.insert.mockResolvedValue([]);

      const decision = {
        approver_id: 'teacher-123',
        approver_role: 'teacher',
        action: 'reject',
        reason: 'Insufficient documentation'
      };

      await ruleOverrideService.processApproval(
        'override-123',
        'tenant-123',
        decision
      );

      const updateCall = mockDb.update.mock.calls[0][0];
      expect(updateCall.status).toBe(OVERRIDE_STATUS.REJECTED);
      expect(updateCall.approved_by).toBe('teacher-123');
    });

    it('should throw error if approver role does not match expected level', async () => {
      // Clear any previous mocks
      mockDb.first.mockReset();
      
      const mockOverride = {
        override_id: 'override-123',
        tenant_id: 'tenant-123',
        status: OVERRIDE_STATUS.PENDING,
        approval_chain: JSON.stringify(['teacher', 'admin', 'dean']),
        current_approval_level: 0,
        approvals: JSON.stringify([])
      };

      mockDb.first.mockResolvedValueOnce(mockOverride);

      const decision = {
        approver_id: 'admin-123',
        approver_role: 'admin', // Wrong role, should be 'teacher'
        action: 'approve'
      };

      await expect(
        ruleOverrideService.processApproval('override-123', 'tenant-123', decision)
      ).rejects.toThrow('Invalid approver role');
    });

    it('should throw error if override is already processed', async () => {
      // Clear any previous mocks
      mockDb.first.mockReset();
      
      const mockOverride = {
        override_id: 'override-123',
        tenant_id: 'tenant-123',
        status: OVERRIDE_STATUS.APPROVED // Already approved
      };

      mockDb.first.mockResolvedValueOnce(mockOverride);

      const decision = {
        approver_id: 'admin-123',
        approver_role: 'admin',
        action: 'approve'
      };

      await expect(
        ruleOverrideService.processApproval('override-123', 'tenant-123', decision)
      ).rejects.toThrow('Override request is already approved');
    });

    it('should throw error if required fields are missing', async () => {
      const decision = {
        approver_id: 'admin-123'
        // Missing approver_role and action
      };

      await expect(
        ruleOverrideService.processApproval('override-123', 'tenant-123', decision)
      ).rejects.toThrow('Missing required fields');
    });

    it('should throw error if action is invalid', async () => {
      const decision = {
        approver_id: 'admin-123',
        approver_role: 'admin',
        action: 'invalid_action'
      };

      await expect(
        ruleOverrideService.processApproval('override-123', 'tenant-123', decision)
      ).rejects.toThrow('Action must be either "approve" or "reject"');
    });
  });

  describe('getOverrideById', () => {
    it('should return override with parsed JSON fields', async () => {
      // Clear any previous mocks
      mockDb.first.mockReset();
      
      const mockOverride = {
        override_id: 'override-123',
        tenant_id: 'tenant-123',
        supporting_documents: JSON.stringify([{ name: 'doc.pdf' }]),
        approval_chain: JSON.stringify(['teacher', 'admin']),
        approvals: JSON.stringify([])
      };

      mockDb.first.mockResolvedValueOnce(mockOverride);

      const result = await ruleOverrideService.getOverrideById('override-123', 'tenant-123');

      expect(result.supporting_documents).toEqual([{ name: 'doc.pdf' }]);
      expect(result.approval_chain).toEqual(['teacher', 'admin']);
      expect(result.approvals).toEqual([]);
    });

    it('should throw error if override not found', async () => {
      // Clear any previous mocks
      mockDb.first.mockReset();
      
      mockDb.first.mockResolvedValueOnce(null);

      await expect(
        ruleOverrideService.getOverrideById('nonexistent', 'tenant-123')
      ).rejects.toThrow('Override request not found');
    });
  });

  describe('listOverrides', () => {
    it('should list all overrides for tenant', async () => {
      const mockOverrides = [
        {
          override_id: 'override-1',
          status: OVERRIDE_STATUS.PENDING,
          approval_chain: JSON.stringify(['teacher']),
          approvals: JSON.stringify([]),
          supporting_documents: null
        },
        {
          override_id: 'override-2',
          status: OVERRIDE_STATUS.APPROVED,
          approval_chain: JSON.stringify(['teacher', 'admin']),
          approvals: JSON.stringify([]),
          supporting_documents: null
        }
      ];

      mockDb.orderBy.mockResolvedValueOnce(mockOverrides);

      const result = await ruleOverrideService.listOverrides('tenant-123');

      expect(result).toHaveLength(2);
      expect(result[0].approval_chain).toEqual(['teacher']);
    });

    it('should filter by status', async () => {
      mockDb.orderBy.mockResolvedValueOnce([]);

      await ruleOverrideService.listOverrides('tenant-123', { status: 'pending' });

      expect(mockDb.where).toHaveBeenCalledWith({ status: 'pending' });
    });

    it('should filter by rule_id', async () => {
      mockDb.orderBy.mockResolvedValueOnce([]);

      await ruleOverrideService.listOverrides('tenant-123', { rule_id: 'rule-123' });

      expect(mockDb.where).toHaveBeenCalledWith({ rule_id: 'rule-123' });
    });
  });

  describe('getPendingOverridesForRole', () => {
    it('should return only overrides at the correct approval level', async () => {
      const mockOverrides = [
        {
          override_id: 'override-1',
          approval_chain: JSON.stringify(['teacher', 'admin', 'dean']),
          current_approval_level: 0, // Needs teacher
          approvals: JSON.stringify([]),
          supporting_documents: null
        },
        {
          override_id: 'override-2',
          approval_chain: JSON.stringify(['teacher', 'admin', 'dean']),
          current_approval_level: 1, // Needs admin
          approvals: JSON.stringify([]),
          supporting_documents: null
        },
        {
          override_id: 'override-3',
          approval_chain: JSON.stringify(['teacher', 'admin', 'dean']),
          current_approval_level: 0, // Needs teacher
          approvals: JSON.stringify([]),
          supporting_documents: null
        }
      ];

      mockDb.orderBy.mockResolvedValueOnce(mockOverrides);

      const result = await ruleOverrideService.getPendingOverridesForRole('tenant-123', 'teacher');

      expect(result).toHaveLength(2);
      expect(result[0].override_id).toBe('override-1');
      expect(result[1].override_id).toBe('override-3');
    });
  });

  describe('getStudentOverrideHistory', () => {
    it('should return all overrides for a student', async () => {
      const mockOverrides = [
        {
          override_id: 'override-1',
          student_id: 'student-123',
          approval_chain: JSON.stringify(['teacher']),
          approvals: JSON.stringify([]),
          supporting_documents: null
        }
      ];

      mockDb.orderBy.mockResolvedValueOnce(mockOverrides);

      const result = await ruleOverrideService.getStudentOverrideHistory(
        'student-123',
        'tenant-123'
      );

      expect(result).toHaveLength(1);
      expect(result[0].student_id).toBe('student-123');
    });
  });

  describe('getOverrideStatistics', () => {
    it('should return statistics grouped by status', async () => {
      const mockStats = [
        { status: 'pending', count: '5' },
        { status: 'approved', count: '10' },
        { status: 'rejected', count: '3' }
      ];

      mockDb.groupBy.mockResolvedValueOnce(mockStats);

      const result = await ruleOverrideService.getOverrideStatistics('tenant-123');

      expect(result.total).toBe(18);
      expect(result.pending).toBe(5);
      expect(result.approved).toBe(10);
      expect(result.rejected).toBe(3);
    });

    it('should handle missing statuses', async () => {
      const mockStats = [
        { status: 'pending', count: '2' }
      ];

      mockDb.groupBy.mockResolvedValueOnce(mockStats);

      const result = await ruleOverrideService.getOverrideStatistics('tenant-123');

      expect(result.total).toBe(2);
      expect(result.pending).toBe(2);
      expect(result.approved).toBe(0);
      expect(result.rejected).toBe(0);
    });
  });
});
