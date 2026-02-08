/**
 * Tests for Academic Rules API Routes - Retroactive Application
 * Tests API endpoints for prospective vs retroactive rule application
 */

const request = require('supertest');
const express = require('express');
const academicRulesRouter = require('./academicRules');
const academicRuleService = require('../services/academicRuleService');
const { v4: uuidv4 } = require('uuid');

// Mock the service
jest.mock('../services/academicRuleService');
jest.mock('../services/ruleOverrideService');

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
  req.user = {
    user_id: uuidv4(),
    tenant_id: uuidv4()
  };
  next();
});

app.use('/api/v1/policies', academicRulesRouter);

describe('Academic Rules API - Retroactive Application', () => {
  let tenantId;
  let ruleId;
  let userId;

  beforeEach(() => {
    tenantId = uuidv4();
    ruleId = uuidv4();
    userId = uuidv4();
    jest.clearAllMocks();
  });

  describe('POST /api/v1/policies/retroactive/analyze', () => {
    it('should analyze retroactive impact successfully', async () => {
      const impactAnalysis = {
        rule_id: ruleId,
        rule_name: 'Test Rule',
        rule_type: 'attendance_threshold',
        analysis: {
          total_records: 1000,
          sample_size: 100,
          matched_in_sample: 25,
          estimated_affected: 250,
          match_rate: 0.25,
          date_range: {
            start: '2024-01-01',
            end: '2024-12-31'
          }
        },
        estimated_processing_time: '3 seconds'
      };

      academicRuleService.analyzeRetroactiveImpact.mockResolvedValue(impactAnalysis);

      const response = await request(app)
        .post('/api/v1/policies/retroactive/analyze')
        .send({
          rule_id: ruleId,
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          sample_size: 1000
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(impactAnalysis);
      expect(academicRuleService.analyzeRetroactiveImpact).toHaveBeenCalledWith(
        ruleId,
        expect.any(String),
        {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          sampleSize: 1000
        }
      );
    });

    it('should return 400 if rule_id is missing', async () => {
      const response = await request(app)
        .post('/api/v1/policies/retroactive/analyze')
        .send({
          start_date: '2024-01-01',
          end_date: '2024-12-31'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('rule_id is required');
    });

    it('should handle service errors', async () => {
      academicRuleService.analyzeRetroactiveImpact.mockRejectedValue(
        new Error('Rule not found')
      );

      const response = await request(app)
        .post('/api/v1/policies/retroactive/analyze')
        .send({
          rule_id: ruleId,
          start_date: '2024-01-01',
          end_date: '2024-12-31'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Rule not found');
    });
  });

  describe('POST /api/v1/policies/retroactive/request', () => {
    it('should create retroactive application request successfully', async () => {
      const requestData = {
        request_id: uuidv4(),
        rule_id: ruleId,
        tenant_id: tenantId,
        status: 'pending_approval',
        requested_by: userId,
        new_config: {
          rule: { rule_id: ruleId, rule_name: 'Test Rule' },
          date_range: { start: '2024-01-01', end: '2024-12-31' },
          reason: 'Policy change'
        },
        impact_analysis: {
          analysis: { estimated_affected: 100 }
        }
      };

      academicRuleService.requestRetroactiveApplication.mockResolvedValue(requestData);

      const response = await request(app)
        .post('/api/v1/policies/retroactive/request')
        .send({
          rule_id: ruleId,
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          reason: 'Policy change'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(requestData);
      expect(academicRuleService.requestRetroactiveApplication).toHaveBeenCalled();
    });

    it('should return 400 if rule_id is missing', async () => {
      const response = await request(app)
        .post('/api/v1/policies/retroactive/request')
        .send({
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          reason: 'Policy change'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('rule_id and reason are required');
    });

    it('should return 400 if reason is missing', async () => {
      const response = await request(app)
        .post('/api/v1/policies/retroactive/request')
        .send({
          rule_id: ruleId,
          start_date: '2024-01-01',
          end_date: '2024-12-31'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('rule_id and reason are required');
    });
  });

  describe('GET /api/v1/policies/retroactive/requests', () => {
    it('should list retroactive requests successfully', async () => {
      const requests = [
        {
          request_id: uuidv4(),
          rule_id: ruleId,
          status: 'pending_approval',
          new_config: { test: 'data1' }
        },
        {
          request_id: uuidv4(),
          rule_id: ruleId,
          status: 'approved',
          new_config: { test: 'data2' }
        }
      ];

      academicRuleService.listRetroactiveRequests.mockResolvedValue(requests);

      const response = await request(app)
        .get('/api/v1/policies/retroactive/requests');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(requests);
      expect(response.body.count).toBe(2);
    });

    it('should filter by status', async () => {
      academicRuleService.listRetroactiveRequests.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/policies/retroactive/requests')
        .query({ status: 'approved' });

      expect(response.status).toBe(200);
      expect(academicRuleService.listRetroactiveRequests).toHaveBeenCalledWith(
        expect.any(String),
        { status: 'approved', rule_id: undefined }
      );
    });

    it('should filter by rule_id', async () => {
      academicRuleService.listRetroactiveRequests.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/policies/retroactive/requests')
        .query({ rule_id: ruleId });

      expect(response.status).toBe(200);
      expect(academicRuleService.listRetroactiveRequests).toHaveBeenCalledWith(
        expect.any(String),
        { status: undefined, rule_id: ruleId }
      );
    });
  });

  describe('POST /api/v1/policies/retroactive/:requestId/approve', () => {
    it('should approve retroactive request successfully', async () => {
      const requestId = uuidv4();
      const approvedRequest = {
        request_id: requestId,
        status: 'approved',
        approved_by: userId,
        approved_at: new Date()
      };

      academicRuleService.approveRetroactiveRequest.mockResolvedValue(approvedRequest);

      const response = await request(app)
        .post(`/api/v1/policies/retroactive/${requestId}/approve`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('approved');
      expect(academicRuleService.approveRetroactiveRequest).toHaveBeenCalledWith(
        requestId,
        expect.any(String),
        expect.any(String)
      );
    });

    it('should return 404 if request not found', async () => {
      const requestId = uuidv4();
      academicRuleService.approveRetroactiveRequest.mockRejectedValue(
        new Error('Retroactive request not found')
      );

      const response = await request(app)
        .post(`/api/v1/policies/retroactive/${requestId}/approve`)
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 if request already processed', async () => {
      const requestId = uuidv4();
      academicRuleService.approveRetroactiveRequest.mockRejectedValue(
        new Error('Request is already approved')
      );

      const response = await request(app)
        .post(`/api/v1/policies/retroactive/${requestId}/approve`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/policies/retroactive/:requestId/reject', () => {
    it('should reject retroactive request successfully', async () => {
      const requestId = uuidv4();
      const rejectedRequest = {
        request_id: requestId,
        status: 'rejected',
        approved_by: userId,
        approved_at: new Date(),
        new_config: {
          rejection_reason: 'Insufficient justification'
        }
      };

      academicRuleService.rejectRetroactiveRequest.mockResolvedValue(rejectedRequest);

      const response = await request(app)
        .post(`/api/v1/policies/retroactive/${requestId}/reject`)
        .send({
          reason: 'Insufficient justification'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('rejected');
      expect(academicRuleService.rejectRetroactiveRequest).toHaveBeenCalledWith(
        requestId,
        expect.any(String),
        expect.any(String),
        'Insufficient justification'
      );
    });

    it('should return 400 if reason is missing', async () => {
      const requestId = uuidv4();

      const response = await request(app)
        .post(`/api/v1/policies/retroactive/${requestId}/reject`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('reason is required for rejection');
    });
  });

  describe('POST /api/v1/policies/retroactive/:requestId/apply', () => {
    it('should apply retroactive request successfully', async () => {
      const requestId = uuidv4();
      const result = {
        total_processed: 100,
        total_matched: 25,
        total_actions_executed: 25,
        errors: [],
        snapshot_id: uuidv4(),
        dry_run: false
      };

      academicRuleService.applyRuleRetroactively.mockResolvedValue(result);

      const response = await request(app)
        .post(`/api/v1/policies/retroactive/${requestId}/apply`)
        .send({
          batch_size: 100,
          dry_run: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(result);
      expect(response.body.message).toBe('Retroactive application completed successfully');
      expect(academicRuleService.applyRuleRetroactively).toHaveBeenCalledWith(
        requestId,
        expect.any(String),
        { batchSize: 100, dryRun: false }
      );
    });

    it('should support dry run mode', async () => {
      const requestId = uuidv4();
      const result = {
        total_processed: 100,
        total_matched: 25,
        total_actions_executed: 0,
        errors: [],
        snapshot_id: uuidv4(),
        dry_run: true
      };

      academicRuleService.applyRuleRetroactively.mockResolvedValue(result);

      const response = await request(app)
        .post(`/api/v1/policies/retroactive/${requestId}/apply`)
        .send({
          dry_run: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Dry run completed successfully');
      expect(response.body.data.dry_run).toBe(true);
    });

    it('should return 500 if request not approved', async () => {
      const requestId = uuidv4();
      academicRuleService.applyRuleRetroactively.mockRejectedValue(
        new Error('Request must be approved before applying')
      );

      const response = await request(app)
        .post(`/api/v1/policies/retroactive/${requestId}/apply`)
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/policies/retroactive/snapshots/:snapshotId/rollback', () => {
    it('should rollback retroactive application successfully', async () => {
      const snapshotId = uuidv4();
      const result = {
        total_restored: 25,
        errors: []
      };

      academicRuleService.rollbackRetroactiveApplication.mockResolvedValue(result);

      const response = await request(app)
        .post(`/api/v1/policies/retroactive/snapshots/${snapshotId}/rollback`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(result);
      expect(response.body.message).toBe('Retroactive application rolled back successfully');
      expect(academicRuleService.rollbackRetroactiveApplication).toHaveBeenCalledWith(
        snapshotId,
        expect.any(String)
      );
    });

    it('should return 404 if snapshot not found', async () => {
      const snapshotId = uuidv4();
      academicRuleService.rollbackRetroactiveApplication.mockRejectedValue(
        new Error('Snapshot not found')
      );

      const response = await request(app)
        .post(`/api/v1/policies/retroactive/snapshots/${snapshotId}/rollback`)
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Integration: Complete Retroactive Workflow', () => {
    it('should complete full retroactive application workflow', async () => {
      const requestId = uuidv4();
      const snapshotId = uuidv4();

      // Step 1: Analyze impact
      const impactAnalysis = {
        rule_id: ruleId,
        analysis: { estimated_affected: 100 }
      };
      academicRuleService.analyzeRetroactiveImpact.mockResolvedValue(impactAnalysis);

      const analyzeResponse = await request(app)
        .post('/api/v1/policies/retroactive/analyze')
        .send({ rule_id: ruleId });

      expect(analyzeResponse.status).toBe(200);

      // Step 2: Create request
      const requestData = {
        request_id: requestId,
        status: 'pending_approval'
      };
      academicRuleService.requestRetroactiveApplication.mockResolvedValue(requestData);

      const requestResponse = await request(app)
        .post('/api/v1/policies/retroactive/request')
        .send({
          rule_id: ruleId,
          reason: 'Policy change'
        });

      expect(requestResponse.status).toBe(201);

      // Step 3: Approve request
      const approvedRequest = {
        request_id: requestId,
        status: 'approved'
      };
      academicRuleService.approveRetroactiveRequest.mockResolvedValue(approvedRequest);

      const approveResponse = await request(app)
        .post(`/api/v1/policies/retroactive/${requestId}/approve`)
        .send({});

      expect(approveResponse.status).toBe(200);

      // Step 4: Apply retroactively
      const applyResult = {
        total_processed: 100,
        snapshot_id: snapshotId
      };
      academicRuleService.applyRuleRetroactively.mockResolvedValue(applyResult);

      const applyResponse = await request(app)
        .post(`/api/v1/policies/retroactive/${requestId}/apply`)
        .send({});

      expect(applyResponse.status).toBe(200);

      // Step 5: Rollback if needed
      const rollbackResult = {
        total_restored: 100
      };
      academicRuleService.rollbackRetroactiveApplication.mockResolvedValue(rollbackResult);

      const rollbackResponse = await request(app)
        .post(`/api/v1/policies/retroactive/snapshots/${snapshotId}/rollback`)
        .send({});

      expect(rollbackResponse.status).toBe(200);
    });
  });
});
