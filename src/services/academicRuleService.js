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
  /**
   * Create a new academic rule
   * @param {Object} ruleConfig - Rule configuration
   * @returns {Promise<Object>} Created rule
   */
  async createRule(ruleConfig) {
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

    await db('academic_rules').insert(rule);

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
    // Get all active rules of the same type for this tenant
    const existingRules = await db('academic_rules')
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
    const rule = await db('academic_rules')
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
    let query = db('academic_rules')
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
    const existingRule = await this.getRuleById(ruleId, tenantId);

    // Validate updates
    if (updates.conditions) {
      this.validateRuleConfig({
        ...existingRule,
        ...updates,
        tenant_id: tenantId
      });

      // Check for conflicts (excluding current rule)
      const otherRules = await db('academic_rules')
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

    await db('academic_rules')
      .where({ rule_id: ruleId, tenant_id: tenantId })
      .update(updateData);

    return this.getRuleById(ruleId, tenantId);
  }

  /**
   * Deactivate a rule
   * @param {string} ruleId - Rule ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} Deactivated rule
   */
  async deactivateRule(ruleId, tenantId) {
    await db('academic_rules')
      .where({ rule_id: ruleId, tenant_id: tenantId })
      .update({
        status: 'inactive',
        updated_at: new Date()
      });

    return this.getRuleById(ruleId, tenantId);
  }

  /**
   * Delete a rule (soft delete by setting status to 'deleted')
   * @param {string} ruleId - Rule ID
   * @param {string} tenantId - Tenant ID
   */
  async deleteRule(ruleId, tenantId) {
    await db('academic_rules')
      .where({ rule_id: ruleId, tenant_id: tenantId })
      .update({
        status: 'deleted',
        updated_at: new Date()
      });
  }
}

module.exports = new AcademicRuleService();
module.exports.RULE_TYPES = RULE_TYPES;
module.exports.ACTION_TYPES = ACTION_TYPES;
module.exports.OPERATORS = OPERATORS;
