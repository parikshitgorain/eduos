/**
 * Academic Rule Service
 * Handles rule configuration, validation, and conflict detection for academic policies
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

/**
 * Rule types supported by the system
 */
const RULE_TYPES = {
  ATTENDANCE_THRESHOLD: 'attendance_threshold',
  GRADE_ELIGIBILITY: 'grade_eligibility',
  GRACE_MARKS: 'grace_marks'
};

/**
 * Supported operators for rule conditions
 */
const OPERATORS = ['>=', '<=', '>', '<', '==', '!=', 'in', 'not_in'];

/**
 * Supported action types
 */
const ACTION_TYPES = {
  SET_ELIGIBILITY: 'set_eligibility',
  APPLY_GRACE_MARKS: 'apply_grace_marks',
  SEND_NOTIFICATION: 'send_notification',
  BLOCK_ENROLLMENT: 'block_enrollment'
};

class AcademicRuleService {
  constructor() {
    this.redis = null;
    this.db = null;
  }

  /**
   * Initialize service with database and Redis connections
   * @param {Object} database - Database connection
   * @param {Object} redisClient - Redis client
   */
  initialize(database, redisClient) {
    this.db = database || db;
    this.redis = redisClient;
  }

  /**
   * Create a new academic rule
   * @param {Object} ruleConfig - Rule configuration
   * @returns {Promise<Object>} Created rule
   */
  async createRule(ruleConfig) {
    const database = this.db || db;
    const { tenant_id, name, type, conditions, actions, priority, effective_from, effective_until, created_by } = ruleConfig;

    // Validate rule configuration
    this.validateRuleConfig(ruleConfig);

    // Check for conflicts with existing rules
    await this.checkRuleConflicts(tenant_id, type, conditions);

    const ruleId = uuidv4();
    const now = new Date();

    const rule = {
      rule_id: ruleId,
      tenant_id,
      rule_name: name,
      rule_type: type,
      conditions: JSON.stringify(conditions),
      actions: JSON.stringify(actions),
      priority: priority || 100,
      effective_from: effective_from || now,
      effective_until: effective_until || null,
      status: 'active',
      created_by,
      created_at: now,
      updated_at: now
    };

    await database('academic_rules').insert(rule);

    // Invalidate cache
    await this.invalidateRuleCache(tenant_id);

    return {
      rule_id: ruleId,
      ...rule,
      conditions: JSON.parse(rule.conditions),
      actions: JSON.parse(rule.actions)
    };
  }

  /**
   * Validate rule configuration
   * @param {Object} ruleConfig - Rule configuration to validate
   * @throws {Error} If validation fails
   */
  validateRuleConfig(ruleConfig) {
    const { name, type, conditions, actions, tenant_id } = ruleConfig;

    // Required fields
    if (!name || !type || !conditions || !actions || !tenant_id) {
      throw new Error('Missing required fields: name, type, conditions, actions, tenant_id');
    }

    // Validate rule type
    if (!Object.values(RULE_TYPES).includes(type)) {
      throw new Error(`Invalid rule type: ${type}. Must be one of: ${Object.values(RULE_TYPES).join(', ')}`);
    }

    // Validate conditions structure
    if (!Array.isArray(conditions) || conditions.length === 0) {
      throw new Error('Conditions must be a non-empty array');
    }

    conditions.forEach((condition, index) => {
      if (!condition.field || !condition.operator || condition.value === undefined) {
        throw new Error(`Invalid condition at index ${index}: must have field, operator, and value`);
      }

      if (!OPERATORS.includes(condition.operator)) {
        throw new Error(`Invalid operator "${condition.operator}" at condition ${index}. Must be one of: ${OPERATORS.join(', ')}`);
      }
    });

    // Validate actions structure
    if (!Array.isArray(actions) || actions.length === 0) {
      throw new Error('Actions must be a non-empty array');
    }

    actions.forEach((action, index) => {
      if (!action.type) {
        throw new Error(`Invalid action at index ${index}: must have type`);
      }

      if (!Object.values(ACTION_TYPES).includes(action.type)) {
        throw new Error(`Invalid action type "${action.type}" at index ${index}. Must be one of: ${Object.values(ACTION_TYPES).join(', ')}`);
      }

      // Validate action-specific parameters
      this.validateActionParameters(action, index);
    });

    // Validate date ranges
    if (ruleConfig.effective_from && ruleConfig.effective_until) {
      const from = new Date(ruleConfig.effective_from);
      const until = new Date(ruleConfig.effective_until);
      
      if (from >= until) {
        throw new Error('effective_from must be before effective_until');
      }
    }
  }

  /**
   * Validate action-specific parameters
   * @param {Object} action - Action to validate
   * @param {number} index - Action index for error messages
   */
  validateActionParameters(action, index) {
    switch (action.type) {
      case ACTION_TYPES.SET_ELIGIBILITY:
        if (typeof action.eligible !== 'boolean') {
          throw new Error(`Action ${index}: set_eligibility requires boolean 'eligible' parameter`);
        }
        break;

      case ACTION_TYPES.APPLY_GRACE_MARKS:
        if (typeof action.marks !== 'number' || action.marks < 0) {
          throw new Error(`Action ${index}: apply_grace_marks requires positive number 'marks' parameter`);
        }
        if (action.max_marks !== undefined && (typeof action.max_marks !== 'number' || action.max_marks < 0)) {
          throw new Error(`Action ${index}: max_marks must be a positive number`);
        }
        break;

      case ACTION_TYPES.SEND_NOTIFICATION:
        if (!action.message || typeof action.message !== 'string') {
          throw new Error(`Action ${index}: send_notification requires string 'message' parameter`);
        }
        break;

      case ACTION_TYPES.BLOCK_ENROLLMENT:
        if (!action.reason || typeof action.reason !== 'string') {
          throw new Error(`Action ${index}: block_enrollment requires string 'reason' parameter`);
        }
        break;
    }
  }

  /**
   * Check for conflicts with existing rules
   * @param {string} tenantId - Tenant ID
   * @param {string} ruleType - Rule type
   * @param {Array} conditions - Rule conditions
   */
  async checkRuleConflicts(tenantId, ruleType, conditions) {
    const database = this.db || db;
    // Get all active rules of the same type for this tenant
    const existingRules = await database('academic_rules')
      .where({
        tenant_id: tenantId,
        rule_type: ruleType,
        status: 'active'
      })
      .whereNull('effective_until')
      .orWhere('effective_until', '>', new Date());

    // Check for conflicting conditions
    for (const existingRule of existingRules) {
      const existingConditions = JSON.parse(existingRule.conditions);
      
      if (this.hasConflictingConditions(conditions, existingConditions)) {
        throw new Error(
          `Rule conflicts with existing rule "${existingRule.rule_name}" (ID: ${existingRule.rule_id}). ` +
          `Please review or deactivate the conflicting rule first.`
        );
      }
    }
  }

  /**
   * Check if two sets of conditions conflict
   * @param {Array} conditions1 - First set of conditions
   * @param {Array} conditions2 - Second set of conditions
   * @returns {boolean} True if conditions conflict
   */
  hasConflictingConditions(conditions1, conditions2) {
    // Two rules conflict if they have overlapping conditions on the same field
    // with different operators or values that could cause ambiguity
    
    for (const cond1 of conditions1) {
      for (const cond2 of conditions2) {
        if (cond1.field === cond2.field) {
          // Same field - check if operators/values create ambiguity
          if (this.isAmbiguousConditionPair(cond1, cond2)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Check if two conditions on the same field are ambiguous
   * @param {Object} cond1 - First condition
   * @param {Object} cond2 - Second condition
   * @returns {boolean} True if ambiguous
   */
  isAmbiguousConditionPair(cond1, cond2) {
    // Exact same condition
    if (cond1.operator === cond2.operator && cond1.value === cond2.value) {
      return true;
    }

    // Overlapping ranges (e.g., >= 75 and >= 80)
    if ((cond1.operator === '>=' || cond1.operator === '>') && 
        (cond2.operator === '>=' || cond2.operator === '>')) {
      return true;
    }

    if ((cond1.operator === '<=' || cond1.operator === '<') && 
        (cond2.operator === '<=' || cond2.operator === '<')) {
      return true;
    }

    return false;
  }

  /**
   * Get rule by ID
   * @param {string} ruleId - Rule ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} Rule object
   */
  async getRuleById(ruleId, tenantId) {
    const database = this.db || db;
    const rule = await database('academic_rules')
      .where({ rule_id: ruleId, tenant_id: tenantId })
      .first();

    if (!rule) {
      throw new Error('Rule not found');
    }

    return {
      ...rule,
      conditions: JSON.parse(rule.conditions),
      actions: JSON.parse(rule.actions)
    };
  }

  /**
   * List all rules for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of rules
   */
  async listRules(tenantId, filters = {}) {
    const database = this.db || db;
    let query = database('academic_rules')
      .where({ tenant_id: tenantId });

    if (filters.type) {
      query = query.where({ rule_type: filters.type });
    }

    if (filters.status) {
      query = query.where({ status: filters.status });
    }

    if (filters.active_only) {
      query = query.where({ status: 'active' })
        .where(function() {
          this.whereNull('effective_until')
            .orWhere('effective_until', '>', new Date());
        });
    }

    const rules = await query.orderBy('priority', 'desc');

    return rules.map(rule => ({
      ...rule,
      conditions: JSON.parse(rule.conditions),
      actions: JSON.parse(rule.actions)
    }));
  }

  /**
   * Update an existing rule
   * @param {string} ruleId - Rule ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated rule
   */
  async updateRule(ruleId, tenantId, updates) {
    const database = this.db || db;
    const existingRule = await this.getRuleById(ruleId, tenantId);

    // Validate updates
    if (updates.conditions) {
      this.validateRuleConfig({
        name: updates.name || existingRule.rule_name,
        type: updates.type || existingRule.rule_type,
        conditions: updates.conditions,
        actions: updates.actions || existingRule.actions,
        tenant_id: tenantId,
        created_by: existingRule.created_by
      });

      // Check for conflicts (excluding current rule)
      const otherRules = await database('academic_rules')
        .where({
          tenant_id: tenantId,
          rule_type: updates.type || existingRule.rule_type,
          status: 'active'
        })
        .whereNot({ rule_id: ruleId });

      for (const otherRule of otherRules) {
        const otherConditions = JSON.parse(otherRule.conditions);
        if (this.hasConflictingConditions(updates.conditions, otherConditions)) {
          throw new Error(
            `Updated rule would conflict with existing rule "${otherRule.rule_name}" (ID: ${otherRule.rule_id})`
          );
        }
      }
    }

    const updateData = {
      ...updates,
      updated_at: new Date()
    };

    if (updates.conditions) {
      updateData.conditions = JSON.stringify(updates.conditions);
    }

    if (updates.actions) {
      updateData.actions = JSON.stringify(updates.actions);
    }

    await database('academic_rules')
      .where({ rule_id: ruleId, tenant_id: tenantId })
      .update(updateData);

    // Invalidate cache
    await this.invalidateRuleCache(tenantId);

    return this.getRuleById(ruleId, tenantId);
  }

  /**
   * Deactivate a rule
   * @param {string} ruleId - Rule ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} Deactivated rule
   */
  async deactivateRule(ruleId, tenantId) {
    const database = this.db || db;
    await database('academic_rules')
      .where({ rule_id: ruleId, tenant_id: tenantId })
      .update({
        status: 'inactive',
        updated_at: new Date()
      });

    // Invalidate cache
    await this.invalidateRuleCache(tenantId);

    return this.getRuleById(ruleId, tenantId);
  }

  /**
   * Delete a rule (soft delete by setting status to 'deleted')
   * @param {string} ruleId - Rule ID
   * @param {string} tenantId - Tenant ID
   */
  async deleteRule(ruleId, tenantId) {
    const database = this.db || db;
    await database('academic_rules')
      .where({ rule_id: ruleId, tenant_id: tenantId })
      .update({
        status: 'deleted',
        updated_at: new Date()
      });
  }

  // ============================================================================
  // REAL-TIME RULE EVALUATION
  // ============================================================================

  /**
   * Evaluate rules for a student based on context (attendance, grades, etc.)
   * @param {string} studentId - Student ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} context - Evaluation context (attendance_percentage, grade, etc.)
   * @returns {Promise<Array>} Array of evaluation results
   */
  async evaluateRulesForStudent(studentId, tenantId, context) {
    const startTime = Date.now();
    
    try {
      // Get applicable rules from cache or database
      const rules = await this.getApplicableRules(tenantId, context);
      
      const evaluationResults = [];
      
      for (const rule of rules) {
        const result = await this.evaluateSingleRule(rule, studentId, tenantId, context);
        evaluationResults.push(result);
        
        // If rule was triggered, execute actions
        if (result.condition_met && !result.action_executed) {
          await this.executeRuleActions(rule, studentId, tenantId, context, result);
        }
      }
      
      const latency = Date.now() - startTime;
      
      // Log performance warning if latency exceeds 100ms
      if (latency > 100) {
        console.warn(`Rule evaluation latency exceeded 100ms: ${latency}ms for student ${studentId}`);
      }
      
      return evaluationResults;
    } catch (error) {
      console.error('Error evaluating rules:', error);
      throw error;
    }
  }

  /**
   * Get applicable rules for evaluation (with caching)
   * @param {string} tenantId - Tenant ID
   * @param {Object} context - Evaluation context
   * @returns {Promise<Array>} Array of applicable rules
   */
  async getApplicableRules(tenantId, context) {
    const cacheKey = `rules:${tenantId}:active`;
    
    // Try to get from cache first
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          const rules = JSON.parse(cached);
          return this.filterRulesByContext(rules, context);
        }
      } catch (error) {
        console.warn('Redis cache read error:', error);
      }
    }
    
    // Get from database
    const database = this.db || db;
    const now = new Date();
    
    const rules = await database('academic_rules')
      .where({
        tenant_id: tenantId,
        status: 'active'
      })
      .where(function() {
        this.whereNull('effective_until')
          .orWhere('effective_until', '>', now);
      })
      .where('effective_from', '<=', now)
      .orderBy('priority', 'desc');
    
    // Parse JSON fields
    const parsedRules = rules.map(rule => ({
      ...rule,
      conditions: JSON.parse(rule.conditions),
      actions: JSON.parse(rule.actions)
    }));
    
    // Cache for 5 minutes
    if (this.redis) {
      try {
        await this.redis.setex(cacheKey, 300, JSON.stringify(parsedRules));
      } catch (error) {
        console.warn('Redis cache write error:', error);
      }
    }
    
    return this.filterRulesByContext(parsedRules, context);
  }

  /**
   * Filter rules by context type
   * @param {Array} rules - All rules
   * @param {Object} context - Evaluation context
   * @returns {Array} Filtered rules
   */
  filterRulesByContext(rules, context) {
    // Determine which rule types are relevant based on context
    const relevantTypes = [];
    
    if (context.attendance_percentage !== undefined) {
      relevantTypes.push(RULE_TYPES.ATTENDANCE_THRESHOLD);
    }
    
    if (context.grade !== undefined || context.marks !== undefined) {
      relevantTypes.push(RULE_TYPES.GRADE_ELIGIBILITY);
      relevantTypes.push(RULE_TYPES.GRACE_MARKS);
    }
    
    return rules.filter(rule => relevantTypes.includes(rule.rule_type));
  }

  /**
   * Evaluate a single rule against context
   * @param {Object} rule - Rule to evaluate
   * @param {string} studentId - Student ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} context - Evaluation context
   * @returns {Promise<Object>} Evaluation result
   */
  async evaluateSingleRule(rule, studentId, tenantId, context) {
    const { v4: uuidv4 } = require('uuid');
    const evaluationId = uuidv4();
    const evaluatedAt = new Date();
    
    // Check if all conditions are met
    const conditionMet = this.checkConditions(rule.conditions, context);
    
    // Create evaluation record
    const evaluation = {
      evaluation_id: evaluationId,
      rule_id: rule.rule_id,
      tenant_id: tenantId,
      student_id: studentId,
      context: JSON.stringify(context),
      condition_met: conditionMet,
      action_executed: false,
      action_result: null,
      evaluated_at: evaluatedAt
    };
    
    // Log evaluation to database (async, don't wait)
    this.logEvaluation(evaluation).catch(error => {
      console.error('Error logging evaluation:', error);
    });
    
    return {
      ...evaluation,
      rule_name: rule.rule_name,
      rule_type: rule.rule_type,
      actions: rule.actions
    };
  }

  /**
   * Check if all conditions are met
   * @param {Array} conditions - Rule conditions
   * @param {Object} context - Evaluation context
   * @returns {boolean} True if all conditions met
   */
  checkConditions(conditions, context) {
    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate a single condition
   * @param {Object} condition - Condition to evaluate
   * @param {Object} context - Evaluation context
   * @returns {boolean} True if condition met
   */
  evaluateCondition(condition, context) {
    const { field, operator, value } = condition;
    const contextValue = context[field];
    
    if (contextValue === undefined) {
      return false;
    }
    
    switch (operator) {
      case '>=':
        return contextValue >= value;
      case '<=':
        return contextValue <= value;
      case '>':
        return contextValue > value;
      case '<':
        return contextValue < value;
      case '==':
        return contextValue == value;
      case '!=':
        return contextValue != value;
      case 'in':
        return Array.isArray(value) && value.includes(contextValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(contextValue);
      default:
        return false;
    }
  }

  /**
   * Execute rule actions
   * @param {Object} rule - Rule with actions
   * @param {string} studentId - Student ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} context - Evaluation context
   * @param {Object} evaluationResult - Evaluation result to update
   * @returns {Promise<void>}
   */
  async executeRuleActions(rule, studentId, tenantId, context, evaluationResult) {
    const actionResults = [];
    
    for (const action of rule.actions) {
      try {
        const result = await this.executeAction(action, studentId, tenantId, context, rule);
        actionResults.push({
          action_type: action.type,
          success: true,
          result: result
        });
      } catch (error) {
        console.error(`Error executing action ${action.type}:`, error);
        actionResults.push({
          action_type: action.type,
          success: false,
          error: error.message
        });
      }
    }
    
    // Update evaluation record with action results
    evaluationResult.action_executed = true;
    evaluationResult.action_result = JSON.stringify(actionResults);
    
    await this.updateEvaluationResult(evaluationResult.evaluation_id, {
      action_executed: true,
      action_result: JSON.stringify(actionResults)
    });
  }

  /**
   * Execute a single action
   * @param {Object} action - Action to execute
   * @param {string} studentId - Student ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} context - Evaluation context
   * @param {Object} rule - Parent rule
   * @returns {Promise<Object>} Action result
   */
  async executeAction(action, studentId, tenantId, context, rule) {
    switch (action.type) {
      case ACTION_TYPES.SET_ELIGIBILITY:
        return await this.setEligibility(studentId, tenantId, action.eligible, rule);
        
      case ACTION_TYPES.APPLY_GRACE_MARKS:
        return await this.applyGraceMarks(studentId, tenantId, action.marks, action.max_marks, context);
        
      case ACTION_TYPES.SEND_NOTIFICATION:
        return await this.sendNotification(studentId, tenantId, action.message, rule, context);
        
      case ACTION_TYPES.BLOCK_ENROLLMENT:
        return await this.blockEnrollment(studentId, tenantId, action.reason, rule);
        
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Set eligibility status for student
   * @param {string} studentId - Student ID
   * @param {string} tenantId - Tenant ID
   * @param {boolean} eligible - Eligibility status
   * @param {Object} rule - Rule that triggered this
   * @returns {Promise<Object>} Result
   */
  async setEligibility(studentId, tenantId, eligible, rule) {
    // This would update a student_eligibility table or similar
    // For now, we'll just return the result
    return {
      action: 'set_eligibility',
      student_id: studentId,
      eligible: eligible,
      rule_id: rule.rule_id,
      rule_name: rule.rule_name
    };
  }

  /**
   * Apply grace marks to student
   * @param {string} studentId - Student ID
   * @param {string} tenantId - Tenant ID
   * @param {number} marks - Grace marks to apply
   * @param {number} maxMarks - Maximum grace marks allowed
   * @param {Object} context - Evaluation context
   * @returns {Promise<Object>} Result
   */
  async applyGraceMarks(studentId, tenantId, marks, maxMarks, context) {
    // Calculate actual grace marks (respecting max)
    const actualMarks = maxMarks ? Math.min(marks, maxMarks) : marks;
    
    return {
      action: 'apply_grace_marks',
      student_id: studentId,
      grace_marks: actualMarks,
      original_marks: context.marks || context.grade,
      new_marks: (context.marks || context.grade) + actualMarks
    };
  }

  /**
   * Send notification to student/admin
   * @param {string} studentId - Student ID
   * @param {string} tenantId - Tenant ID
   * @param {string} message - Notification message
   * @param {Object} rule - Rule that triggered this
   * @param {Object} context - Evaluation context
   * @returns {Promise<Object>} Result
   */
  async sendNotification(studentId, tenantId, message, rule, context) {
    // Format message with context variables
    const formattedMessage = this.formatNotificationMessage(message, context, rule);
    
    // In a real implementation, this would integrate with a notification service
    // For now, we'll log it and return the result
    console.log(`Notification for student ${studentId}: ${formattedMessage}`);
    
    // Store notification in database
    const database = this.db || db;
    const notificationId = require('uuid').v4();
    
    try {
      await database('notifications').insert({
        notification_id: notificationId,
        tenant_id: tenantId,
        recipient_id: studentId,
        recipient_type: 'student',
        title: `Academic Rule Alert: ${rule.rule_name}`,
        message: formattedMessage,
        type: 'rule_triggered',
        priority: 'high',
        status: 'pending',
        metadata: JSON.stringify({
          rule_id: rule.rule_id,
          rule_name: rule.rule_name,
          context: context
        }),
        created_at: new Date()
      });
    } catch (error) {
      console.warn('Error storing notification:', error);
    }
    
    return {
      action: 'send_notification',
      student_id: studentId,
      message: formattedMessage,
      notification_id: notificationId
    };
  }

  /**
   * Format notification message with context variables
   * @param {string} template - Message template
   * @param {Object} context - Evaluation context
   * @param {Object} rule - Rule
   * @returns {string} Formatted message
   */
  formatNotificationMessage(template, context, rule) {
    let message = template;
    
    // Replace context variables
    Object.keys(context).forEach(key => {
      const placeholder = `{{${key}}}`;
      if (message.includes(placeholder)) {
        message = message.replace(new RegExp(placeholder, 'g'), context[key]);
      }
    });
    
    // Replace rule variables
    message = message.replace(/{{rule_name}}/g, rule.rule_name);
    
    return message;
  }

  /**
   * Block enrollment for student
   * @param {string} studentId - Student ID
   * @param {string} tenantId - Tenant ID
   * @param {string} reason - Block reason
   * @param {Object} rule - Rule that triggered this
   * @returns {Promise<Object>} Result
   */
  async blockEnrollment(studentId, tenantId, reason, rule) {
    // This would update enrollment status or create a block record
    return {
      action: 'block_enrollment',
      student_id: studentId,
      reason: reason,
      rule_id: rule.rule_id,
      rule_name: rule.rule_name
    };
  }

  /**
   * Log evaluation to database
   * @param {Object} evaluation - Evaluation record
   * @returns {Promise<void>}
   */
  async logEvaluation(evaluation) {
    const database = this.db || db;
    await database('rule_evaluations').insert(evaluation);
  }

  /**
   * Update evaluation result with action execution details
   * @param {string} evaluationId - Evaluation ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<void>}
   */
  async updateEvaluationResult(evaluationId, updates) {
    const database = this.db || db;
    await database('rule_evaluations')
      .where({ evaluation_id: evaluationId })
      .update(updates);
  }

  /**
   * Invalidate rule cache for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<void>}
   */
  async invalidateRuleCache(tenantId) {
    if (!this.redis) {
      return;
    }
    
    const cacheKey = `rules:${tenantId}:active`;
    
    try {
      await this.redis.del(cacheKey);
    } catch (error) {
      console.warn('Error invalidating rule cache:', error);
    }
  }

  /**
   * Get evaluation history for a student
   * @param {string} studentId - Student ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Evaluation history
   */
  async getEvaluationHistory(studentId, tenantId, options = {}) {
    const database = this.db || db;
    const { limit = 50, offset = 0, ruleId = null } = options;
    
    let query = database('rule_evaluations')
      .where({
        student_id: studentId,
        tenant_id: tenantId
      })
      .orderBy('evaluated_at', 'desc')
      .limit(limit)
      .offset(offset);
    
    if (ruleId) {
      query = query.where({ rule_id: ruleId });
    }
    
    const evaluations = await query;
    
    return evaluations.map(evaluation => ({
      ...evaluation,
      context: JSON.parse(evaluation.context),
      action_result: evaluation.action_result ? JSON.parse(evaluation.action_result) : null
    }));
  }

  // ============================================================================
  // PROSPECTIVE VS RETROACTIVE APPLICATION
  // ============================================================================

  /**
   * Analyze impact of applying a rule retroactively
   * @param {string} ruleId - Rule ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Impact analysis report
   */
  async analyzeRetroactiveImpact(ruleId, tenantId, options = {}) {
    const database = this.db || db;
    const { startDate, endDate, sampleSize = 1000 } = options;
    
    // Get the rule
    const rule = await this.getRuleById(ruleId, tenantId);
    
    // Determine data source based on rule type
    let affectedRecords = [];
    let totalCount = 0;
    
    if (rule.rule_type === RULE_TYPES.ATTENDANCE_THRESHOLD) {
      // Query attendance records
      const query = database('attendance')
        .where({ tenant_id: tenantId })
        .select('student_id')
        .count('* as attendance_count')
        .groupBy('student_id');
      
      if (startDate) {
        query.where('attendance_date', '>=', startDate);
      }
      if (endDate) {
        query.where('attendance_date', '<=', endDate);
      }
      
      affectedRecords = await query.limit(sampleSize);
      
      // Get total count
      const countQuery = database('attendance')
        .where({ tenant_id: tenantId })
        .countDistinct('student_id as count');
      
      if (startDate) {
        countQuery.where('attendance_date', '>=', startDate);
      }
      if (endDate) {
        countQuery.where('attendance_date', '<=', endDate);
      }
      
      const countResult = await countQuery.first();
      totalCount = parseInt(countResult.count);
      
    } else if (rule.rule_type === RULE_TYPES.GRADE_ELIGIBILITY || rule.rule_type === RULE_TYPES.GRACE_MARKS) {
      // Query grade/assessment records
      const query = database('assessments')
        .where({ tenant_id: tenantId })
        .select('student_id', 'grade', 'marks');
      
      if (startDate) {
        query.where('assessment_date', '>=', startDate);
      }
      if (endDate) {
        query.where('assessment_date', '<=', endDate);
      }
      
      affectedRecords = await query.limit(sampleSize);
      
      // Get total count
      const countQuery = database('assessments')
        .where({ tenant_id: tenantId })
        .count('* as count');
      
      if (startDate) {
        countQuery.where('assessment_date', '>=', startDate);
      }
      if (endDate) {
        countQuery.where('assessment_date', '<=', endDate);
      }
      
      const countResult = await countQuery.first();
      totalCount = parseInt(countResult.count);
    }
    
    // Simulate rule evaluation on sample records
    let matchedCount = 0;
    const sampleResults = [];
    
    for (const record of affectedRecords.slice(0, Math.min(100, affectedRecords.length))) {
      const context = this.buildContextFromRecord(record, rule.rule_type);
      const conditionMet = this.checkConditions(rule.conditions, context);
      
      if (conditionMet) {
        matchedCount++;
        sampleResults.push({
          student_id: record.student_id,
          context,
          actions_to_execute: rule.actions
        });
      }
    }
    
    // Estimate total affected based on sample
    const sampleMatchRate = affectedRecords.length > 0 ? matchedCount / Math.min(affectedRecords.length, 100) : 0;
    const estimatedAffected = Math.round(totalCount * sampleMatchRate);
    
    return {
      rule_id: ruleId,
      rule_name: rule.rule_name,
      rule_type: rule.rule_type,
      analysis: {
        total_records: totalCount,
        sample_size: affectedRecords.length,
        matched_in_sample: matchedCount,
        estimated_affected: estimatedAffected,
        match_rate: sampleMatchRate,
        date_range: {
          start: startDate || 'beginning',
          end: endDate || 'now'
        }
      },
      sample_results: sampleResults.slice(0, 10), // Return first 10 for preview
      actions_to_execute: rule.actions,
      estimated_processing_time: this.estimateProcessingTime(estimatedAffected)
    };
  }

  /**
   * Build evaluation context from a database record
   * @param {Object} record - Database record
   * @param {string} ruleType - Rule type
   * @returns {Object} Evaluation context
   */
  buildContextFromRecord(record, ruleType) {
    if (ruleType === RULE_TYPES.ATTENDANCE_THRESHOLD) {
      // Calculate attendance percentage
      const totalDays = record.total_days || 100;
      const presentDays = record.present_days || record.attendance_count || 0;
      return {
        attendance_percentage: (presentDays / totalDays) * 100,
        total_days: totalDays,
        present_days: presentDays
      };
    } else if (ruleType === RULE_TYPES.GRADE_ELIGIBILITY || ruleType === RULE_TYPES.GRACE_MARKS) {
      return {
        grade: record.grade,
        marks: record.marks
      };
    }
    return {};
  }

  /**
   * Estimate processing time for retroactive application
   * @param {number} recordCount - Number of records to process
   * @returns {string} Estimated time in human-readable format
   */
  estimateProcessingTime(recordCount) {
    // Assume 100 records per second
    const seconds = Math.ceil(recordCount / 100);
    
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      return `${Math.ceil(seconds / 60)} minutes`;
    } else {
      return `${Math.ceil(seconds / 3600)} hours`;
    }
  }

  /**
   * Request retroactive application of a rule
   * @param {string} ruleId - Rule ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} requestData - Request data
   * @returns {Promise<Object>} Retroactive request
   */
  async requestRetroactiveApplication(ruleId, tenantId, requestData) {
    const database = this.db || db;
    const { requested_by, start_date, end_date, reason } = requestData;
    
    // Get the rule
    const rule = await this.getRuleById(ruleId, tenantId);
    
    // Perform impact analysis
    const impact = await this.analyzeRetroactiveImpact(ruleId, tenantId, {
      startDate: start_date,
      endDate: end_date
    });
    
    // Create retroactive request
    const requestId = uuidv4();
    const request = {
      request_id: requestId,
      rule_id: ruleId,
      tenant_id: tenantId,
      old_config: null, // No old config for new retroactive application
      new_config: JSON.stringify({
        rule: rule,
        date_range: {
          start: start_date,
          end: end_date
        },
        reason: reason
      }),
      status: 'pending_approval',
      requested_by,
      affected_count: impact.analysis.estimated_affected,
      created_at: new Date()
    };
    
    await database('retroactive_policy_requests').insert(request);
    
    return {
      request_id: requestId,
      ...request,
      new_config: JSON.parse(request.new_config),
      impact_analysis: impact
    };
  }

  /**
   * Approve retroactive application request
   * @param {string} requestId - Request ID
   * @param {string} tenantId - Tenant ID
   * @param {string} approvedBy - Approver user ID
   * @returns {Promise<Object>} Approved request
   */
  async approveRetroactiveRequest(requestId, tenantId, approvedBy) {
    const database = this.db || db;
    
    // Get the request
    const request = await database('retroactive_policy_requests')
      .where({ request_id: requestId, tenant_id: tenantId })
      .first();
    
    if (!request) {
      throw new Error('Retroactive request not found');
    }
    
    if (request.status !== 'pending_approval') {
      throw new Error(`Request is already ${request.status}`);
    }
    
    // Update request status
    await database('retroactive_policy_requests')
      .where({ request_id: requestId })
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date()
      });
    
    // Return updated request
    const updatedRequest = await database('retroactive_policy_requests')
      .where({ request_id: requestId })
      .first();
    
    return {
      ...updatedRequest,
      new_config: JSON.parse(updatedRequest.new_config)
    };
  }

  /**
   * Reject retroactive application request
   * @param {string} requestId - Request ID
   * @param {string} tenantId - Tenant ID
   * @param {string} rejectedBy - Rejector user ID
   * @param {string} reason - Rejection reason
   * @returns {Promise<Object>} Rejected request
   */
  async rejectRetroactiveRequest(requestId, tenantId, rejectedBy, reason) {
    const database = this.db || db;
    
    // Get the request
    const request = await database('retroactive_policy_requests')
      .where({ request_id: requestId, tenant_id: tenantId })
      .first();
    
    if (!request) {
      throw new Error('Retroactive request not found');
    }
    
    if (request.status !== 'pending_approval') {
      throw new Error(`Request is already ${request.status}`);
    }
    
    // Update request status
    await database('retroactive_policy_requests')
      .where({ request_id: requestId })
      .update({
        status: 'rejected',
        approved_by: rejectedBy,
        approved_at: new Date(),
        new_config: JSON.stringify({
          ...JSON.parse(request.new_config),
          rejection_reason: reason
        })
      });
    
    // Return updated request
    const updatedRequest = await database('retroactive_policy_requests')
      .where({ request_id: requestId })
      .first();
    
    return {
      ...updatedRequest,
      new_config: JSON.parse(updatedRequest.new_config)
    };
  }

  /**
   * Apply rule retroactively to historical data (batch processing)
   * @param {string} requestId - Approved retroactive request ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result
   */
  async applyRuleRetroactively(requestId, tenantId, options = {}) {
    const database = this.db || db;
    const { batchSize = 100, dryRun = false } = options;
    
    // Get the approved request
    const request = await database('retroactive_policy_requests')
      .where({ request_id: requestId, tenant_id: tenantId })
      .first();
    
    if (!request) {
      throw new Error('Retroactive request not found');
    }
    
    if (request.status !== 'approved') {
      throw new Error('Request must be approved before applying');
    }
    
    const config = JSON.parse(request.new_config);
    const rule = config.rule;
    const { start, end } = config.date_range;
    
    // Create snapshot for rollback
    const snapshotId = uuidv4();
    const snapshot = {
      snapshot_id: snapshotId,
      request_id: requestId,
      tenant_id: tenantId,
      rule_id: rule.rule_id,
      created_at: new Date(),
      affected_records: []
    };
    
    // Get all affected records
    let affectedRecords = [];
    
    if (rule.rule_type === RULE_TYPES.ATTENDANCE_THRESHOLD) {
      const query = database('attendance')
        .where({ tenant_id: tenantId })
        .select('*');
      
      if (start) {
        query.where('attendance_date', '>=', start);
      }
      if (end) {
        query.where('attendance_date', '<=', end);
      }
      
      affectedRecords = await query;
      
    } else if (rule.rule_type === RULE_TYPES.GRADE_ELIGIBILITY || rule.rule_type === RULE_TYPES.GRACE_MARKS) {
      const query = database('assessments')
        .where({ tenant_id: tenantId })
        .select('*');
      
      if (start) {
        query.where('assessment_date', '>=', start);
      }
      if (end) {
        query.where('assessment_date', '<=', end);
      }
      
      affectedRecords = await query;
    }
    
    // Process records in batches
    const results = {
      total_processed: 0,
      total_matched: 0,
      total_actions_executed: 0,
      errors: [],
      snapshot_id: snapshotId,
      dry_run: dryRun
    };
    
    for (let i = 0; i < affectedRecords.length; i += batchSize) {
      const batch = affectedRecords.slice(i, i + batchSize);
      
      for (const record of batch) {
        try {
          const context = this.buildContextFromRecord(record, rule.rule_type);
          const conditionMet = this.checkConditions(rule.conditions, context);
          
          results.total_processed++;
          
          if (conditionMet) {
            results.total_matched++;
            
            // Store original state for rollback
            snapshot.affected_records.push({
              record_id: record.id || record.student_id,
              original_state: record,
              context: context
            });
            
            if (!dryRun) {
              // Execute actions
              const evaluationResult = {
                evaluation_id: uuidv4(),
                rule_id: rule.rule_id,
                tenant_id: tenantId,
                student_id: record.student_id,
                context: context,
                condition_met: true,
                action_executed: false,
                evaluated_at: new Date(),
                retroactive: true,
                request_id: requestId
              };
              
              await this.executeRuleActions(rule, record.student_id, tenantId, context, evaluationResult);
              results.total_actions_executed++;
            }
          }
        } catch (error) {
          results.errors.push({
            record_id: record.id || record.student_id,
            error: error.message
          });
        }
      }
    }
    
    // Store snapshot for rollback
    if (!dryRun) {
      await database('retroactive_application_snapshots').insert({
        snapshot_id: snapshotId,
        request_id: requestId,
        tenant_id: tenantId,
        rule_id: rule.rule_id,
        snapshot_data: JSON.stringify(snapshot),
        created_at: new Date()
      });
    }
    
    return results;
  }

  /**
   * Rollback retroactive application
   * @param {string} snapshotId - Snapshot ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} Rollback result
   */
  async rollbackRetroactiveApplication(snapshotId, tenantId) {
    const database = this.db || db;
    
    // Get the snapshot
    const snapshotRecord = await database('retroactive_application_snapshots')
      .where({ snapshot_id: snapshotId, tenant_id: tenantId })
      .first();
    
    if (!snapshotRecord) {
      throw new Error('Snapshot not found');
    }
    
    const snapshot = JSON.parse(snapshotRecord.snapshot_data);
    
    // Restore original states
    const results = {
      total_restored: 0,
      errors: []
    };
    
    for (const record of snapshot.affected_records) {
      try {
        // Restore original state
        // This would depend on the specific table and record type
        // For now, we'll just log the restoration
        console.log(`Restoring record ${record.record_id} to original state`);
        results.total_restored++;
      } catch (error) {
        results.errors.push({
          record_id: record.record_id,
          error: error.message
        });
      }
    }
    
    // Mark snapshot as rolled back
    await database('retroactive_application_snapshots')
      .where({ snapshot_id: snapshotId })
      .update({
        rolled_back: true,
        rolled_back_at: new Date()
      });
    
    return results;
  }

  /**
   * List retroactive requests for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of requests
   */
  async listRetroactiveRequests(tenantId, filters = {}) {
    const database = this.db || db;
    
    let query = database('retroactive_policy_requests')
      .where({ tenant_id: tenantId });
    
    if (filters.status) {
      query = query.where({ status: filters.status });
    }
    
    if (filters.rule_id) {
      query = query.where({ rule_id: filters.rule_id });
    }
    
    const requests = await query.orderBy('created_at', 'desc');
    
    return requests.map(request => ({
      ...request,
      new_config: JSON.parse(request.new_config),
      old_config: request.old_config ? JSON.parse(request.old_config) : null
    }));
  }
}

module.exports = new AcademicRuleService();
module.exports.RULE_TYPES = RULE_TYPES;
module.exports.ACTION_TYPES = ACTION_TYPES;
module.exports.OPERATORS = OPERATORS;
