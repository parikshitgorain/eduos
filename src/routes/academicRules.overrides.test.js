/**
 * Academic Rules Override API Integration Tests
 */

const request = require('supertest');
const express = require('express');
const academicRulesRouter = require('./academicRules');
const ruleOverrideService = require('../services/ruleOverrideService');

// Mock the services
jest.mock('../services/academicRuleService');
jest.mock('../services/ruleOverrideService');

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
  req.user = {
    user_id: 'user-123',
    tenant_id: 'tenant-123',
    role: 'admin'
  };
  next();
});

app.use('/api/v1/policies', academicRulesRouter);

describe('Academic Rules Override API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/policies/overrides', () => {
    it('should create a new override request', async () => {
      const mockOverride = {
        override_id: 'override-123',
        rule_id: 'rule-123',
        student_id: 'student-123',
        reason: 'Medical emergency',
        status: 'pending',
        approval_chain: ['teacher', 'admin', 'dean'],
        current_approval_level: 0,
        approvals: []
      };

      ruleOverrideService.createOverrideRequest.mockResolvedValue(mockOverride);

      const response = await request(app)
        .post('/api/v1/policies/overrides')
        .send({
          rule_id: 'rule-123',
          student_id: 'student-123',
          reason: 'Medical emergency',
          supporting_documents: [
            { name: 'medical_cert.pdf', url: 'https://example.com/doc.pdf' }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.override_id).toBe('override-123');
      expect(ruleOverrideService.createOverrideRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          rule_id: 'rule-123',
          student_id: 'student-123',
          reason: 'Medical emergency',
          tenant_id: 'tenant-123',
          requested_by: 'user-123'
        })
      );
    });

    it('should return 400 if creation fails', async () => {
      ruleOverrideService.createOverrideRequest.mockRejectedValue(
        new Error('Rule not found')
      );

      const response = await request(app)
        .post('/api/v1/policies/overrides')
        .send({
          rule_id: 'nonexistent',
          student_id: 'student-123',
          reason: 'Test'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Rule not found');
    });
  });

  describe('GET /api/v1/policies/overrides', () => {
    it('should list all override requests', async () => {
      const mockOverrides = [
        {
          override_id: 'override-1',
          status: 'pending',
          approval_chain: ['teacher', 'admin'],
          approvals: []
        },
        {
          override_id: 'override-2',
          status: 'approved',
          approval_chain: ['teacher'],
          approvals: [{ level: 0, action: 'approve' }]
        }
      ];

      ruleOverrideService.listOverrides.mockResolvedValue(mockOverrides);

      const response = await request(app)
        .get('/api/v1/policies/overrides');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });

    it('should filter by status', async () => {
      ruleOverrideService.listOverrides.mockResolvedValue([]);

      await request(app)
        .get('/api/v1/policies/overrides?status=pending');

      expect(ruleOverrideService.listOverrides).toHaveBeenCalledWith(
        'tenant-123',
        expect.objectContaining({ status: 'pending' })
      );
    });

    it('should filter by rule_id', async () => {
      ruleOverrideService.listOverrides.mockResolvedValue([]);

      await request(app)
        .get('/api/v1/policies/overrides?rule_id=rule-123');

      expect(ruleOverrideService.listOverrides).toHaveBeenCalledWith(
        'tenant-123',
        expect.objectContaining({ rule_id: 'rule-123' })
      );
    });
  });

  describe('GET /api/v1/policies/overrides/pending/:role', () => {
    it('should get pending overrides for a specific role', async () => {
      const mockOverrides = [
        {
          override_id: 'override-1',
          approval_chain: ['teacher', 'admin'],
          current_approval_level: 0,
          approvals: []
        }
      ];

      ruleOverrideService.getPendingOverridesForRole.mockResolvedValue(mockOverrides);

      const response = await request(app)
        .get('/api/v1/policies/overrides/pending/teacher');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(ruleOverrideService.getPendingOverridesForRole).toHaveBeenCalledWith(
        'tenant-123',
        'teacher'
      );
    });
  });

  describe('GET /api/v1/policies/overrides/:overrideId', () => {
    it('should get a specific override request', async () => {
      const mockOverride = {
        override_id: 'override-123',
        rule_id: 'rule-123',
        status: 'pending',
        approval_chain: ['teacher', 'admin'],
        approvals: []
      };

      ruleOverrideService.getOverrideById.mockResolvedValue(mockOverride);

      const response = await request(app)
        .get('/api/v1/policies/overrides/override-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.override_id).toBe('override-123');
    });

    it('should return 404 if override not found', async () => {
      ruleOverrideService.getOverrideById.mockRejectedValue(
        new Error('Override request not found')
      );

      const response = await request(app)
        .get('/api/v1/policies/overrides/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/policies/overrides/:overrideId/approve', () => {
    it('should approve an override request', async () => {
      const mockOverride = {
        override_id: 'override-123',
        status: 'pending',
        current_approval_level: 1,
        approval_chain: ['teacher', 'admin'],
        approvals: [
          { level: 0, role: 'teacher', action: 'approve' }
        ]
      };

      ruleOverrideService.processApproval.mockResolvedValue(mockOverride);

      const response = await request(app)
        .post('/api/v1/policies/overrides/override-123/approve')
        .send({
          approver_role: 'teacher',
          reason: 'Valid documentation provided'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Override request approved successfully');
      expect(ruleOverrideService.processApproval).toHaveBeenCalledWith(
        'override-123',
        'tenant-123',
        expect.objectContaining({
          approver_id: 'user-123',
          approver_role: 'teacher',
          action: 'approve',
          reason: 'Valid documentation provided'
        })
      );
    });

    it('should return 400 if approver_role is missing', async () => {
      const response = await request(app)
        .post('/api/v1/policies/overrides/override-123/approve')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('approver_role is required');
    });

    it('should return 400 if approval fails', async () => {
      ruleOverrideService.processApproval.mockRejectedValue(
        new Error('Invalid approver role')
      );

      const response = await request(app)
        .post('/api/v1/policies/overrides/override-123/approve')
        .send({
          approver_role: 'admin'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/policies/overrides/:overrideId/reject', () => {
    it('should reject an override request', async () => {
      const mockOverride = {
        override_id: 'override-123',
        status: 'rejected',
        approval_chain: ['teacher', 'admin'],
        approvals: [
          { level: 0, role: 'teacher', action: 'reject', reason: 'Insufficient docs' }
        ]
      };

      ruleOverrideService.processApproval.mockResolvedValue(mockOverride);

      const response = await request(app)
        .post('/api/v1/policies/overrides/override-123/reject')
        .send({
          approver_role: 'teacher',
          reason: 'Insufficient documentation'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Override request rejected');
      expect(ruleOverrideService.processApproval).toHaveBeenCalledWith(
        'override-123',
        'tenant-123',
        expect.objectContaining({
          action: 'reject',
          reason: 'Insufficient documentation'
        })
      );
    });

    it('should return 400 if reason is missing', async () => {
      const response = await request(app)
        .post('/api/v1/policies/overrides/override-123/reject')
        .send({
          approver_role: 'teacher'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('reason is required for rejection');
    });
  });

  describe('GET /api/v1/policies/overrides/student/:studentId', () => {
    it('should get override history for a student', async () => {
      const mockHistory = [
        {
          override_id: 'override-1',
          student_id: 'student-123',
          status: 'approved',
          approval_chain: ['teacher'],
          approvals: []
        },
        {
          override_id: 'override-2',
          student_id: 'student-123',
          status: 'rejected',
          approval_chain: ['teacher', 'admin'],
          approvals: []
        }
      ];

      ruleOverrideService.getStudentOverrideHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/api/v1/policies/overrides/student/student-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });
  });

  describe('GET /api/v1/policies/overrides/statistics', () => {
    it('should get override statistics', async () => {
      const mockStats = {
        total: 20,
        pending: 5,
        approved: 12,
        rejected: 3
      };

      ruleOverrideService.getOverrideStatistics.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/v1/policies/overrides/statistics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(20);
      expect(response.body.data.pending).toBe(5);
      expect(response.body.data.approved).toBe(12);
      expect(response.body.data.rejected).toBe(3);
    });
  });
});
