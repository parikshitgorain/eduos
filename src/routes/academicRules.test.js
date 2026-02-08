/**
 * Tests for Academic Rules API Routes
 */

const request = require('supertest');
const express = require('express');
const academicRulesRouter = require('./academicRules');
const academicRuleService = require('../services/academicRuleService');
const { RULE_TYPES, ACTION_TYPES } = require('../services/academicRuleService');

// Mock the service
jest.mock('../services/academicRuleService');

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
  req.user = {
    user_id: 'user-123',
    tenant_id: 'tenant-456'
  };
  next();
});

app.use('/api/v1/policies', academicRulesRouter);

describe('Academic Rules API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/policies/rules', () => {
    it('should create a new rule successfully', async () => {
      const mockRule = {
        rule_id: 'rule-789',
        tenant_id: 'tenant-456',
        rule_name: 'Test Rule',
        rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: [{ field: 'attendance_percentage', operator: '<', value: 75 }],
        actions: [{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }],
        status: 'active'
      };

      academicRuleService.createRule.mockResolvedValue(mockRule);

      const response = await request(app)
        .post('/api/v1/policies/rules')
        .send({
          name: 'Test Rule',
          type: RULE_TYPES.ATTENDANCE_THRESHOLD,
          conditions: [{ field: 'attendance_percentage', operator: '<', value: 75 }],
          actions: [{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }]
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rule_id).toBe('rule-789');
      expect(academicRuleService.createRule).toHaveBeenCalled();
    });

    it('should return 400 for invalid rule configuration', async () => {
      academicRuleService.createRule.mockRejectedValue(new Error('Invalid rule type'));

      const response = await request(app)
        .post('/api/v1/policies/rules')
        .send({
          name: 'Invalid Rule',
          type: 'invalid_type',
          conditions: [],
          actions: []
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid rule type');
    });
  });

  describe('GET /api/v1/policies/rules', () => {
    it('should list all rules for a tenant', async () => {
      const mockRules = [
        {
          rule_id: 'rule-1',
          rule_name: 'Rule 1',
          rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
          conditions: [{ field: 'attendance', operator: '<', value: 75 }],
          actions: [{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }]
        },
        {
          rule_id: 'rule-2',
          rule_name: 'Rule 2',
          rule_type: RULE_TYPES.GRACE_MARKS,
          conditions: [{ field: 'score', operator: '>=', value: 35 }],
          actions: [{ type: ACTION_TYPES.APPLY_GRACE_MARKS, marks: 5 }]
        }
      ];

      academicRuleService.listRules.mockResolvedValue(mockRules);

      const response = await request(app)
        .get('/api/v1/policies/rules');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });

    it('should filter rules by type', async () => {
      academicRuleService.listRules.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/policies/rules')
        .query({ type: RULE_TYPES.ATTENDANCE_THRESHOLD });

      expect(response.status).toBe(200);
      expect(academicRuleService.listRules).toHaveBeenCalledWith(
        'tenant-456',
        expect.objectContaining({ type: RULE_TYPES.ATTENDANCE_THRESHOLD })
      );
    });

    it('should filter active rules only', async () => {
      academicRuleService.listRules.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/policies/rules')
        .query({ active_only: 'true' });

      expect(response.status).toBe(200);
      expect(academicRuleService.listRules).toHaveBeenCalledWith(
        'tenant-456',
        expect.objectContaining({ active_only: true })
      );
    });
  });

  describe('GET /api/v1/policies/rules/:ruleId', () => {
    it('should get a specific rule by ID', async () => {
      const mockRule = {
        rule_id: 'rule-789',
        rule_name: 'Test Rule',
        rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: [{ field: 'attendance', operator: '<', value: 75 }],
        actions: [{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }]
      };

      academicRuleService.getRuleById.mockResolvedValue(mockRule);

      const response = await request(app)
        .get('/api/v1/policies/rules/rule-789');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rule_id).toBe('rule-789');
    });

    it('should return 404 for non-existent rule', async () => {
      academicRuleService.getRuleById.mockRejectedValue(new Error('Rule not found'));

      const response = await request(app)
        .get('/api/v1/policies/rules/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/policies/rules/:ruleId', () => {
    it('should update a rule successfully', async () => {
      const mockUpdatedRule = {
        rule_id: 'rule-789',
        rule_name: 'Updated Rule',
        rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: [{ field: 'attendance', operator: '<', value: 80 }],
        actions: [{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }]
      };

      academicRuleService.updateRule.mockResolvedValue(mockUpdatedRule);

      const response = await request(app)
        .put('/api/v1/policies/rules/rule-789')
        .send({
          rule_name: 'Updated Rule',
          conditions: [{ field: 'attendance', operator: '<', value: 80 }]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rule_name).toBe('Updated Rule');
    });

    it('should return 404 for non-existent rule', async () => {
      academicRuleService.updateRule.mockRejectedValue(new Error('Rule not found'));

      const response = await request(app)
        .put('/api/v1/policies/rules/non-existent')
        .send({ rule_name: 'Updated' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/policies/rules/:ruleId/deactivate', () => {
    it('should deactivate a rule successfully', async () => {
      const mockDeactivatedRule = {
        rule_id: 'rule-789',
        status: 'inactive'
      };

      academicRuleService.deactivateRule.mockResolvedValue(mockDeactivatedRule);

      const response = await request(app)
        .post('/api/v1/policies/rules/rule-789/deactivate');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('inactive');
    });
  });

  describe('DELETE /api/v1/policies/rules/:ruleId', () => {
    it('should delete a rule successfully', async () => {
      academicRuleService.deleteRule.mockResolvedValue();

      const response = await request(app)
        .delete('/api/v1/policies/rules/rule-789');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
    });
  });

  describe('GET /api/v1/policies/metadata/types', () => {
    it('should return available rule types and metadata', async () => {
      const response = await request(app)
        .get('/api/v1/policies/metadata/types');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rule_types).toBeDefined();
      expect(response.body.data.action_types).toBeDefined();
      expect(response.body.data.operators).toBeDefined();
      expect(response.body.data.rule_types).toContain(RULE_TYPES.ATTENDANCE_THRESHOLD);
      expect(response.body.data.action_types).toContain(ACTION_TYPES.SET_ELIGIBILITY);
    });
  });

  describe('POST /api/v1/policies/rules/validate', () => {
    it('should validate a valid rule configuration', async () => {
      academicRuleService.validateRuleConfig.mockReturnValue(true);
      academicRuleService.checkRuleConflicts.mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/policies/rules/validate')
        .send({
          name: 'Test Rule',
          type: RULE_TYPES.ATTENDANCE_THRESHOLD,
          conditions: [{ field: 'attendance', operator: '<', value: 75 }],
          actions: [{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(true);
    });

    it('should return validation errors for invalid configuration', async () => {
      academicRuleService.validateRuleConfig.mockImplementation(() => {
        throw new Error('Invalid rule type');
      });

      const response = await request(app)
        .post('/api/v1/policies/rules/validate')
        .send({
          name: 'Invalid Rule',
          type: 'invalid_type',
          conditions: [],
          actions: []
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toContain('Invalid rule type');
    });

    it('should detect rule conflicts', async () => {
      academicRuleService.validateRuleConfig.mockReturnValue(true);
      academicRuleService.checkRuleConflicts.mockRejectedValue(
        new Error('Rule conflicts with existing rule')
      );

      const response = await request(app)
        .post('/api/v1/policies/rules/validate')
        .send({
          name: 'Conflicting Rule',
          type: RULE_TYPES.ATTENDANCE_THRESHOLD,
          conditions: [{ field: 'attendance', operator: '<', value: 75 }],
          actions: [{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }]
        });

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toContain('conflicts');
    });
  });

  describe('POST /api/v1/policies/rules/evaluate', () => {
    it('should evaluate rules for a student', async () => {
      const mockEvaluations = [
        {
          evaluation_id: 'eval-1',
          rule_id: 'rule-1',
          rule_name: 'Attendance Rule',
          condition_met: true,
          action_executed: true
        }
      ];

      academicRuleService.evaluateRulesForStudent.mockResolvedValue(mockEvaluations);

      const response = await request(app)
        .post('/api/v1/policies/rules/evaluate')
        .send({
          student_id: 'student-123',
          context: { attendance_percentage: 70 }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.evaluations).toHaveLength(1);
    });

    it('should return 400 when student_id is missing', async () => {
      const response = await request(app)
        .post('/api/v1/policies/rules/evaluate')
        .send({
          context: { attendance_percentage: 70 }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('student_id and context are required');
    });

    it('should return 400 when context is missing', async () => {
      const response = await request(app)
        .post('/api/v1/policies/rules/evaluate')
        .send({
          student_id: 'student-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle evaluation errors', async () => {
      academicRuleService.evaluateRulesForStudent.mockRejectedValue(
        new Error('Evaluation failed')
      );

      const response = await request(app)
        .post('/api/v1/policies/rules/evaluate')
        .send({
          student_id: 'student-123',
          context: { attendance_percentage: 70 }
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/policies/rules/evaluations/:studentId', () => {
    it('should get evaluation history for a student', async () => {
      const mockHistory = [
        {
          evaluation_id: 'eval-1',
          rule_id: 'rule-1',
          condition_met: true,
          evaluated_at: new Date()
        }
      ];

      academicRuleService.getEvaluationHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/api/v1/policies/rules/evaluations/student-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.evaluations).toHaveLength(1);
    });

    it('should support pagination parameters', async () => {
      academicRuleService.getEvaluationHistory.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/policies/rules/evaluations/student-123')
        .query({ limit: 10, offset: 20, ruleId: 'rule-1' });

      expect(response.status).toBe(200);
      expect(academicRuleService.getEvaluationHistory).toHaveBeenCalledWith(
        'student-123',
        'tenant-456',
        expect.objectContaining({ limit: 10, offset: 20, ruleId: 'rule-1' })
      );
    });

    it('should handle errors', async () => {
      academicRuleService.getEvaluationHistory.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/v1/policies/rules/evaluations/student-123');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});


// Mock the ruleOverrideService
const ruleOverrideService = require('../services/ruleOverrideService');
jest.mock('../services/ruleOverrideService');

describe('Academic Rules API Routes - Override Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/policies/overrides', () => {
    it('should create a new override request', async () => {
      const mockOverride = {
        override_id: 'override-123',
        rule_id: 'rule-456',
        student_id: 'student-789',
        status: 'pending'
      };

      ruleOverrideService.createOverrideRequest.mockResolvedValue(mockOverride);

      const response = await request(app)
        .post('/api/v1/policies/overrides')
        .send({
          rule_id: 'rule-456',
          student_id: 'student-789',
          reason: 'Medical emergency'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.override_id).toBe('override-123');
    });

    it('should handle creation errors', async () => {
      ruleOverrideService.createOverrideRequest.mockRejectedValue(
        new Error('Invalid request')
      );

      const response = await request(app)
        .post('/api/v1/policies/overrides')
        .send({
          rule_id: 'rule-456',
          student_id: 'student-789'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/policies/overrides', () => {
    it('should list override requests', async () => {
      const mockOverrides = [
        { override_id: 'override-1', status: 'pending' },
        { override_id: 'override-2', status: 'approved' }
      ];

      ruleOverrideService.listOverrides.mockResolvedValue(mockOverrides);

      const response = await request(app)
        .get('/api/v1/policies/overrides');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should filter overrides by status', async () => {
      ruleOverrideService.listOverrides.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/policies/overrides')
        .query({ status: 'pending', rule_id: 'rule-123' });

      expect(response.status).toBe(200);
      expect(ruleOverrideService.listOverrides).toHaveBeenCalledWith(
        'tenant-456',
        expect.objectContaining({ status: 'pending', rule_id: 'rule-123' })
      );
    });

    it('should handle errors', async () => {
      ruleOverrideService.listOverrides.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .get('/api/v1/policies/overrides');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/policies/overrides/statistics', () => {
    it('should get override statistics', async () => {
      const mockStats = {
        total: 100,
        pending: 20,
        approved: 60,
        rejected: 20
      };

      ruleOverrideService.getOverrideStatistics.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/v1/policies/overrides/statistics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(100);
    });

    it('should handle errors', async () => {
      ruleOverrideService.getOverrideStatistics.mockRejectedValue(new Error('Error'));

      const response = await request(app)
        .get('/api/v1/policies/overrides/statistics');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/policies/overrides/pending/:role', () => {
    it('should get pending overrides for a role', async () => {
      const mockOverrides = [
        { override_id: 'override-1', current_approval_level: 'teacher' }
      ];

      ruleOverrideService.getPendingOverridesForRole.mockResolvedValue(mockOverrides);

      const response = await request(app)
        .get('/api/v1/policies/overrides/pending/teacher');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should handle errors', async () => {
      ruleOverrideService.getPendingOverridesForRole.mockRejectedValue(new Error('Error'));

      const response = await request(app)
        .get('/api/v1/policies/overrides/pending/admin');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/policies/overrides/student/:studentId', () => {
    it('should get override history for a student', async () => {
      const mockHistory = [
        { override_id: 'override-1', student_id: 'student-123' }
      ];

      ruleOverrideService.getStudentOverrideHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/api/v1/policies/overrides/student/student-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should handle errors', async () => {
      ruleOverrideService.getStudentOverrideHistory.mockRejectedValue(new Error('Error'));

      const response = await request(app)
        .get('/api/v1/policies/overrides/student/student-123');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/policies/overrides/:overrideId', () => {
    it('should get a specific override by ID', async () => {
      const mockOverride = {
        override_id: 'override-123',
        rule_id: 'rule-456',
        status: 'pending'
      };

      ruleOverrideService.getOverrideById.mockResolvedValue(mockOverride);

      const response = await request(app)
        .get('/api/v1/policies/overrides/override-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.override_id).toBe('override-123');
    });

    it('should return 404 for non-existent override', async () => {
      ruleOverrideService.getOverrideById.mockRejectedValue(
        new Error('Override request not found')
      );

      const response = await request(app)
        .get('/api/v1/policies/overrides/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should handle other errors', async () => {
      ruleOverrideService.getOverrideById.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .get('/api/v1/policies/overrides/override-123');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/policies/overrides/:overrideId/approve', () => {
    it('should approve an override request', async () => {
      const mockOverride = {
        override_id: 'override-123',
        status: 'approved'
      };

      ruleOverrideService.processApproval.mockResolvedValue(mockOverride);

      const response = await request(app)
        .post('/api/v1/policies/overrides/override-123/approve')
        .send({
          approver_role: 'teacher',
          reason: 'Valid reason'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('approved');
    });

    it('should return 400 when approver_role is missing', async () => {
      const response = await request(app)
        .post('/api/v1/policies/overrides/override-123/approve')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('approver_role is required');
    });

    it('should return 404 for non-existent override', async () => {
      ruleOverrideService.processApproval.mockRejectedValue(
        new Error('Override not found')
      );

      const response = await request(app)
        .post('/api/v1/policies/overrides/non-existent/approve')
        .send({ approver_role: 'teacher' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should handle other errors', async () => {
      ruleOverrideService.processApproval.mockRejectedValue(new Error('Processing error'));

      const response = await request(app)
        .post('/api/v1/policies/overrides/override-123/approve')
        .send({ approver_role: 'teacher' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/policies/overrides/:overrideId/reject', () => {
    it('should reject an override request', async () => {
      const mockOverride = {
        override_id: 'override-123',
        status: 'rejected'
      };

      ruleOverrideService.processApproval.mockResolvedValue(mockOverride);

      const response = await request(app)
        .post('/api/v1/policies/overrides/override-123/reject')
        .send({
          approver_role: 'admin',
          reason: 'Insufficient documentation'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('rejected');
    });

    it('should return 400 when approver_role is missing', async () => {
      const response = await request(app)
        .post('/api/v1/policies/overrides/override-123/reject')
        .send({ reason: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('approver_role is required');
    });

    it('should return 400 when reason is missing', async () => {
      const response = await request(app)
        .post('/api/v1/policies/overrides/override-123/reject')
        .send({ approver_role: 'admin' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('reason is required for rejection');
    });

    it('should return 404 for non-existent override', async () => {
      ruleOverrideService.processApproval.mockRejectedValue(
        new Error('Override not found')
      );

      const response = await request(app)
        .post('/api/v1/policies/overrides/non-existent/reject')
        .send({ approver_role: 'admin', reason: 'Test' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/policies/statistics', () => {
    it('should get override statistics', async () => {
      const mockStats = {
        total: 50,
        pending: 10,
        approved: 30,
        rejected: 10
      };

      ruleOverrideService.getOverrideStatistics.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/v1/policies/statistics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(50);
    });

    it('should handle errors', async () => {
      ruleOverrideService.getOverrideStatistics.mockRejectedValue(new Error('Error'));

      const response = await request(app)
        .get('/api/v1/policies/statistics');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});


describe('Academic Rules API Routes - Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Error handling for list rules', () => {
    it('should handle errors when listing rules', async () => {
      academicRuleService.listRules.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/policies/rules');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to list academic rules');
    });
  });

  describe('POST /api/v1/policies/rules/evaluate with Redis', () => {
    it('should initialize service with Redis when available', async () => {
      const mockRedis = { get: jest.fn(), set: jest.fn() };
      const mockEvaluations = [
        {
          evaluation_id: 'eval-1',
          rule_id: 'rule-1',
          condition_met: true
        }
      ];

      academicRuleService.evaluateRulesForStudent.mockResolvedValue(mockEvaluations);

      // Create a new app with Redis middleware
      const appWithRedis = express();
      appWithRedis.use(express.json());
      appWithRedis.use((req, res, next) => {
        req.user = {
          user_id: 'user-123',
          tenant_id: 'tenant-456'
        };
        req.redis = mockRedis;
        next();
      });
      appWithRedis.use('/api/v1/policies', academicRulesRouter);

      const response = await request(appWithRedis)
        .post('/api/v1/policies/rules/evaluate')
        .send({
          student_id: 'student-123',
          context: { attendance_percentage: 70 }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});


describe('Academic Rules API Routes - Additional Branch Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Error status code branches', () => {
    it('should return 500 for deactivate errors other than not found', async () => {
      academicRuleService.deactivateRule.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/v1/policies/rules/rule-789/deactivate');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should return 500 for delete errors other than not found', async () => {
      academicRuleService.deleteRule.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .delete('/api/v1/policies/rules/rule-789');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for deactivate when rule not found', async () => {
      academicRuleService.deactivateRule.mockRejectedValue(new Error('Rule not found'));

      const response = await request(app)
        .post('/api/v1/policies/rules/non-existent/deactivate');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for delete when rule not found', async () => {
      academicRuleService.deleteRule.mockRejectedValue(new Error('Rule not found'));

      const response = await request(app)
        .delete('/api/v1/policies/rules/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 500 for get rule errors other than not found', async () => {
      academicRuleService.getRuleById.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/policies/rules/rule-789');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for update errors other than not found', async () => {
      academicRuleService.updateRule.mockRejectedValue(new Error('Validation error'));

      const response = await request(app)
        .put('/api/v1/policies/rules/rule-789')
        .send({ rule_name: 'Updated' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Tenant ID from different sources', () => {
    it('should get tenant_id from req.body when req.user is not available', async () => {
      const appNoAuth = express();
      appNoAuth.use(express.json());
      appNoAuth.use('/api/v1/policies', academicRulesRouter);

      const mockRule = {
        rule_id: 'rule-789',
        tenant_id: 'tenant-from-body',
        rule_name: 'Test Rule'
      };

      academicRuleService.createRule.mockResolvedValue(mockRule);

      const response = await request(appNoAuth)
        .post('/api/v1/policies/rules')
        .send({
          tenant_id: 'tenant-from-body',
          name: 'Test Rule',
          type: RULE_TYPES.ATTENDANCE_THRESHOLD,
          conditions: [{ field: 'attendance', operator: '<', value: 75 }],
          actions: [{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }]
        });

      expect(response.status).toBe(201);
      expect(academicRuleService.createRule).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_id: 'tenant-from-body' })
      );
    });

    it('should get tenant_id from req.query when req.user is not available', async () => {
      const appNoAuth = express();
      appNoAuth.use(express.json());
      appNoAuth.use('/api/v1/policies', academicRulesRouter);

      academicRuleService.listRules.mockResolvedValue([]);

      const response = await request(appNoAuth)
        .get('/api/v1/policies/rules')
        .query({ tenant_id: 'tenant-from-query' });

      expect(response.status).toBe(200);
      expect(academicRuleService.listRules).toHaveBeenCalledWith(
        'tenant-from-query',
        expect.any(Object)
      );
    });
  });

  describe('Default values and optional parameters', () => {
    it('should use default limit and offset for evaluation history', async () => {
      academicRuleService.getEvaluationHistory.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/policies/rules/evaluations/student-123');

      expect(response.status).toBe(200);
      expect(academicRuleService.getEvaluationHistory).toHaveBeenCalledWith(
        'student-123',
        'tenant-456',
        expect.objectContaining({ limit: 50, offset: 0, ruleId: null })
      );
    });

    it('should handle NaN for limit and offset', async () => {
      academicRuleService.getEvaluationHistory.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/policies/rules/evaluations/student-123')
        .query({ limit: 'invalid', offset: 'invalid' });

      expect(response.status).toBe(200);
      expect(academicRuleService.getEvaluationHistory).toHaveBeenCalledWith(
        'student-123',
        'tenant-456',
        expect.objectContaining({ limit: 50, offset: 0 })
      );
    });
  });
});
