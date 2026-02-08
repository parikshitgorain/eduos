/**
 * Rule Override Service
 * Handles rule override requests with configurable approval chains
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

/**
 * Override status values
 */
const OVERRIDE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

/**
 * Default approval chain roles
 */
const DEFAULT_APPROVAL_CHAIN = ['teacher', 'admin', 'dean'];

class RuleOverrideService {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize service with database connection
   * @param {Object} database - Database connection
   */
  initialize(database) {
    this.db = database || db;
  }

  /**
   * Create a new rule override request
   * @param {Object} overrideData - Override request data
   * @returns {Promise<Object>} Created override request
   */
  async createOverrideRequest(overrideData) {
    const {
      tenant_id,
      rule_id,
      student_id,
      reason,
      supporting_documents,
      requested_by,
      approval_chain
    } = overrideData;

    // Validate required fields
    if (!tenant_id || !rule_id || !student_id || !reason || !requested_by) {
      throw new Error('Missing required fields: tenant_id, rule_id, student_id, reason, requested_by');
    }

    // Verify rule exists
    const database = this.db || db;
    const rule = await database('academic_rules')
      .where({ rule_id, tenant_id })
      .first();

    if (!rule) {
      throw new Error('Rule not found');
    }

    // Check if there's already a pending override for this student and rule
    const existingOverride = await database('rule_overrides')
      .where({
        rule_id,
        student_id,
        tenant_id,
        status: OVERRIDE_STATUS.PENDING
      })
      .first();

    if (existingOverride) {
      throw new Error('A pending override request already exists for this student and rule');
    }

    const overrideId = uuidv4();
    const now = new Date();

    // Use provided approval chain or default
    const chain = approval_chain || DEFAULT_APPROVAL_CHAIN;

    const override = {
      override_id: overrideId,
      rule_id,
      tenant_id,
      student_id,
      reason,
      supporting_documents: supporting_documents ? JSON.stringify(supporting_documents) : null,
      requested_by,
      status: OVERRIDE_STATUS.PENDING,
      approval_chain: JSON.stringify(chain),
      current_approval_level: 0,
      approvals: JSON.stringify([]),
      created_at: now,
      updated_at: now
    };

    await database('rule_overrides').insert(override);

    // Log audit trail
    await this.logOverrideAudit({
      override_id: overrideId,
      tenant_id,
      action: 'created',
      actor_id: requested_by,
      details: { reason, rule_id, student_id }
    });

    return {
      override_id: overrideId,
      ...override,
      supporting_documents: override.supporting_documents ? JSON.parse(override.supporting_documents) : null,
      approval_chain: JSON.parse(override.approval_chain),
      approvals: JSON.parse(override.approvals)
    };
  }

  /**
   * Process approval/rejection for an override request
   * @param {string} overrideId - Override request ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} decision - Approval decision
   * @returns {Promise<Object>} Updated override request
   */
  async processApproval(overrideId, tenantId, decision) {
    const { approver_id, approver_role, action, reason } = decision;

    if (!approver_id || !approver_role || !action) {
      throw new Error('Missing required fields: approver_id, approver_role, action');
    }

    if (!['approve', 'reject'].includes(action)) {
      throw new Error('Action must be either "approve" or "reject"');
    }

    const database = this.db || db;

    // Get current override request
    const override = await database('rule_overrides')
      .where({ override_id: overrideId, tenant_id: tenantId })
      .first();

    if (!override) {
      throw new Error('Override request not found');
    }

    if (override.status !== OVERRIDE_STATUS.PENDING) {
      throw new Error(`Override request is already ${override.status}`);
    }

    const approvalChain = JSON.parse(override.approval_chain);
    const currentLevel = override.current_approval_level;
    const approvals = JSON.parse(override.approvals);

    // Verify approver role matches current level in chain
    const expectedRole = approvalChain[currentLevel];
    if (approver_role !== expectedRole) {
      throw new Error(
        `Invalid approver role. Expected ${expectedRole} at this level, got ${approver_role}`
      );
    }

    // Record approval/rejection
    const approvalRecord = {
      level: currentLevel,
      role: approver_role,
      approver_id,
      action,
      reason: reason || null,
      timestamp: new Date()
    };

    approvals.push(approvalRecord);

    let newStatus = override.status;
    let finalApprover = null;
    let finalApprovalDate = null;

    if (action === 'reject') {
      // Rejection at any level terminates the process
      newStatus = OVERRIDE_STATUS.REJECTED;
      finalApprover = approver_id;
      finalApprovalDate = new Date();
    } else if (currentLevel === approvalChain.length - 1) {
      // Last level approval - request is fully approved
      newStatus = OVERRIDE_STATUS.APPROVED;
      finalApprover = approver_id;
      finalApprovalDate = new Date();
    }

    // Update override request
    const updates = {
      approvals: JSON.stringify(approvals),
      current_approval_level: action === 'approve' ? currentLevel + 1 : currentLevel,
      status: newStatus,
      updated_at: new Date()
    };

    if (finalApprover) {
      updates.approved_by = finalApprover;
      updates.approved_at = finalApprovalDate;
      updates.approval_reason = reason || null;
    }

    await database('rule_overrides')
      .where({ override_id: overrideId, tenant_id: tenantId })
      .update(updates);

    // Log audit trail
    await this.logOverrideAudit({
      override_id: overrideId,
      tenant_id: tenantId,
      action: action === 'approve' ? 'approved_level' : 'rejected',
      actor_id: approver_id,
      details: {
        level: currentLevel,
        role: approver_role,
        reason,
        final_status: newStatus
      }
    });

    // Send notification to requester
    await this.sendOverrideNotification(overrideId, tenantId, newStatus, reason);

    return this.getOverrideById(overrideId, tenantId);
  }

  /**
   * Get override request by ID
   * @param {string} overrideId - Override ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} Override request
   */
  async getOverrideById(overrideId, tenantId) {
    const database = this.db || db;

    const override = await database('rule_overrides')
      .where({ override_id: overrideId, tenant_id: tenantId })
      .first();

    if (!override) {
      throw new Error('Override request not found');
    }

    return {
      ...override,
      supporting_documents: override.supporting_documents ? JSON.parse(override.supporting_documents) : null,
      approval_chain: JSON.parse(override.approval_chain),
      approvals: JSON.parse(override.approvals)
    };
  }

  /**
   * List override requests with filters
   * @param {string} tenantId - Tenant ID
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} List of override requests
   */
  async listOverrides(tenantId, filters = {}) {
    const database = this.db || db;
    let query = database('rule_overrides')
      .where({ tenant_id: tenantId });

    if (filters.status) {
      query = query.where({ status: filters.status });
    }

    if (filters.rule_id) {
      query = query.where({ rule_id: filters.rule_id });
    }

    if (filters.student_id) {
      query = query.where({ student_id: filters.student_id });
    }

    if (filters.requested_by) {
      query = query.where({ requested_by: filters.requested_by });
    }

    const overrides = await query.orderBy('created_at', 'desc');

    return overrides.map(override => ({
      ...override,
      supporting_documents: override.supporting_documents ? JSON.parse(override.supporting_documents) : null,
      approval_chain: JSON.parse(override.approval_chain),
      approvals: JSON.parse(override.approvals)
    }));
  }

  /**
   * Get pending overrides for a specific approver role
   * @param {string} tenantId - Tenant ID
   * @param {string} approverRole - Role of the approver
   * @returns {Promise<Array>} Pending overrides requiring this role's approval
   */
  async getPendingOverridesForRole(tenantId, approverRole) {
    const database = this.db || db;

    const allPending = await database('rule_overrides')
      .where({
        tenant_id: tenantId,
        status: OVERRIDE_STATUS.PENDING
      })
      .orderBy('created_at', 'asc');

    // Filter to only those where current level matches the approver role
    const filtered = allPending.filter(override => {
      const approvalChain = JSON.parse(override.approval_chain);
      const currentLevel = override.current_approval_level;
      return approvalChain[currentLevel] === approverRole;
    });

    return filtered.map(override => ({
      ...override,
      supporting_documents: override.supporting_documents ? JSON.parse(override.supporting_documents) : null,
      approval_chain: JSON.parse(override.approval_chain),
      approvals: JSON.parse(override.approvals)
    }));
  }

  /**
   * Get override history for a student
   * @param {string} studentId - Student ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Array>} Override history
   */
  async getStudentOverrideHistory(studentId, tenantId) {
    const database = this.db || db;

    const overrides = await database('rule_overrides')
      .where({ student_id: studentId, tenant_id: tenantId })
      .orderBy('created_at', 'desc');

    return overrides.map(override => ({
      ...override,
      supporting_documents: override.supporting_documents ? JSON.parse(override.supporting_documents) : null,
      approval_chain: JSON.parse(override.approval_chain),
      approvals: JSON.parse(override.approvals)
    }));
  }

  /**
   * Log override audit trail
   * @param {Object} auditData - Audit log data
   * @returns {Promise<void>}
   */
  async logOverrideAudit(auditData) {
    const { override_id, tenant_id, action, actor_id, details } = auditData;

    const database = this.db || db;
    const auditId = uuidv4();

    try {
      await database('rule_override_audit').insert({
        audit_id: auditId,
        override_id,
        tenant_id,
        action,
        actor_id,
        details: JSON.stringify(details),
        created_at: new Date()
      });
    } catch (error) {
      console.error('Error logging override audit:', error);
      // Don't throw - audit logging failure shouldn't break the main flow
    }
  }

  /**
   * Send notification about override decision
   * @param {string} overrideId - Override ID
   * @param {string} tenantId - Tenant ID
   * @param {string} status - Final status
   * @param {string} reason - Decision reason
   * @returns {Promise<void>}
   */
  async sendOverrideNotification(overrideId, tenantId, status, reason) {
    const database = this.db || db;

    try {
      const override = await database('rule_overrides')
        .where({ override_id: overrideId, tenant_id })
        .first();

      if (!override) {
        return;
      }

      const rule = await database('academic_rules')
        .where({ rule_id: override.rule_id, tenant_id })
        .first();

      let message = '';
      let title = '';

      if (status === OVERRIDE_STATUS.APPROVED) {
        title = 'Rule Override Request Approved';
        message = `Your override request for rule "${rule?.rule_name || 'Unknown'}" has been approved.`;
      } else if (status === OVERRIDE_STATUS.REJECTED) {
        title = 'Rule Override Request Rejected';
        message = `Your override request for rule "${rule?.rule_name || 'Unknown'}" has been rejected.`;
        if (reason) {
          message += ` Reason: ${reason}`;
        }
      } else {
        // Intermediate approval - notify that it's progressing
        title = 'Rule Override Request - Approval Progress';
        message = `Your override request for rule "${rule?.rule_name || 'Unknown'}" has progressed to the next approval level.`;
      }

      const notificationId = uuidv4();

      await database('notifications').insert({
        notification_id: notificationId,
        tenant_id: tenantId,
        recipient_id: override.requested_by,
        recipient_type: 'user',
        title,
        message,
        type: 'rule_override_decision',
        priority: 'high',
        status: 'pending',
        metadata: JSON.stringify({
          override_id: overrideId,
          rule_id: override.rule_id,
          student_id: override.student_id,
          final_status: status
        }),
        created_at: new Date()
      });
    } catch (error) {
      console.error('Error sending override notification:', error);
      // Don't throw - notification failure shouldn't break the main flow
    }
  }

  /**
   * Get override statistics for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} Override statistics
   */
  async getOverrideStatistics(tenantId) {
    const database = this.db || db;

    const stats = await database('rule_overrides')
      .where({ tenant_id: tenantId })
      .select('status')
      .count('* as count')
      .groupBy('status');

    const result = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0
    };

    stats.forEach(stat => {
      result[stat.status] = parseInt(stat.count);
      result.total += parseInt(stat.count);
    });

    return result;
  }
}

module.exports = new RuleOverrideService();
module.exports.OVERRIDE_STATUS = OVERRIDE_STATUS;
module.exports.DEFAULT_APPROVAL_CHAIN = DEFAULT_APPROVAL_CHAIN;
