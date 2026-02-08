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
});
