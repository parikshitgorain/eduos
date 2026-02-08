/**
 * Academic Rules API Routes
 * Provides endpoints for managing academic policy rules
 */

const express = require('express');
const router = express.Router();
const academicRuleService = require('../services/academicRuleService');
const { RULE_TYPES, ACTION_TYPES, OPERATORS } = require('../services/academicRuleService');

/**
 * POST /api/v1/policies/rules
 * Create a new academic rule
 */
router.post('/rules', async (req, res) => {
  try {
    const { tenant_id } = req.user || req.body; // Get from auth context or body
    const ruleConfig = {
      ...req.body,
      tenant_id,
      created_by: req.user?.user_id || 'system'
    };

    const rule = await academicRuleService.createRule(ruleConfig);

    res.status(201).json({
      success: true,
      message: 'Academic rule created successfully',
      data: rule
    });
  } catch (error) {
    console.error('Error creating academic rule:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create academic rule',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/policies/rules
 * List all rules for a tenant
 */
router.get('/rules', async (req, res) => {
  try {
    const { tenant_id } = req.user || req.query;
    const filters = {
      type: req.query.type,
      status: req.query.status,
      active_only: req.query.active_only === 'true'
    };

    const rules = await academicRuleService.listRules(tenant_id, filters);

    res.json({
      success: true,
      data: rules,
      count: rules.length
    });
  } catch (error) {
    console.error('Error listing academic rules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list academic rules',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/policies/rules/:ruleId
 * Get a specific rule by ID
 */
router.get('/rules/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { tenant_id } = req.user || req.query;

    const rule = await academicRuleService.getRuleById(ruleId, tenant_id);

    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    console.error('Error getting academic rule:', error);
    const statusCode = error.message === 'Rule not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to get academic rule',
      error: error.message
    });
  }
});

/**
 * PUT /api/v1/policies/rules/:ruleId
 * Update an existing rule
 */
router.put('/rules/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { tenant_id } = req.user || req.body;
    const updates = req.body;

    const rule = await academicRuleService.updateRule(ruleId, tenant_id, updates);

    res.json({
      success: true,
      message: 'Academic rule updated successfully',
      data: rule
    });
  } catch (error) {
    console.error('Error updating academic rule:', error);
    const statusCode = error.message === 'Rule not found' ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update academic rule',
      error: error.message
    });
  }
});

/**
 * POST /api/v1/policies/rules/:ruleId/deactivate
 * Deactivate a rule
 */
router.post('/rules/:ruleId/deactivate', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { tenant_id } = req.user || req.body;

    const rule = await academicRuleService.deactivateRule(ruleId, tenant_id);

    res.json({
      success: true,
      message: 'Academic rule deactivated successfully',
      data: rule
    });
  } catch (error) {
    console.error('Error deactivating academic rule:', error);
    const statusCode = error.message === 'Rule not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to deactivate academic rule',
      error: error.message
    });
  }
});

/**
 * DELETE /api/v1/policies/rules/:ruleId
 * Delete a rule (soft delete)
 */
router.delete('/rules/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { tenant_id } = req.user || req.query;

    await academicRuleService.deleteRule(ruleId, tenant_id);

    res.json({
      success: true,
      message: 'Academic rule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting academic rule:', error);
    const statusCode = error.message === 'Rule not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to delete academic rule',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/policies/rules/metadata/types
 * Get available rule types
 */
router.get('/metadata/types', (req, res) => {
  res.json({
    success: true,
    data: {
      rule_types: Object.values(RULE_TYPES),
      action_types: Object.values(ACTION_TYPES),
      operators: OPERATORS
    }
  });
});

/**
 * POST /api/v1/policies/rules/validate
 * Validate a rule configuration without creating it
 */
router.post('/rules/validate', async (req, res) => {
  try {
    const { tenant_id } = req.user || req.body;
    const ruleConfig = {
      ...req.body,
      tenant_id
    };

    // Validate the rule configuration
    academicRuleService.validateRuleConfig(ruleConfig);

    // Check for conflicts
    await academicRuleService.checkRuleConflicts(
      tenant_id,
      ruleConfig.type,
      ruleConfig.conditions
    );

    res.json({
      success: true,
      message: 'Rule configuration is valid',
      valid: true
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Rule configuration is invalid',
      valid: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/policies/rules/evaluate
 * Evaluate rules for a student based on current context
 * 
 * Request Body:
 * {
 *   "student_id": "uuid",
 *   "context": {
 *     "attendance_percentage": 72.5,
 *     "grade": 65,
 *     "marks": 65
 *   }
 * }
 */
router.post('/rules/evaluate', async (req, res) => {
  try {
    const { tenant_id } = req.user || req.body;
    const { student_id, context } = req.body;

    if (!student_id || !context) {
      return res.status(400).json({
        success: false,
        message: 'student_id and context are required'
      });
    }

    // Initialize service with Redis if available
    if (req.redis) {
      academicRuleService.initialize(req.db, req.redis);
    }

    const evaluations = await academicRuleService.evaluateRulesForStudent(
      student_id,
      tenant_id,
      context
    );

    res.json({
      success: true,
      data: {
        student_id,
        evaluations,
        count: evaluations.length
      }
    });
  } catch (error) {
    console.error('Error evaluating rules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to evaluate rules',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/policies/rules/evaluations/:studentId
 * Get evaluation history for a student
 * 
 * Query Parameters:
 * - limit: Maximum number of evaluations to return (default: 50)
 * - offset: Offset for pagination (default: 0)
 * - ruleId: Filter by specific rule ID (optional)
 */
router.get('/rules/evaluations/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { tenant_id } = req.user || req.query;

    const options = {
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
      ruleId: req.query.ruleId || null
    };

    const evaluations = await academicRuleService.getEvaluationHistory(
      studentId,
      tenant_id,
      options
    );

    res.json({
      success: true,
      data: {
        student_id: studentId,
        evaluations,
        count: evaluations.length
      }
    });
  } catch (error) {
    console.error('Error getting evaluation history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get evaluation history',
      error: error.message
    });
  }
});

module.exports = router;
