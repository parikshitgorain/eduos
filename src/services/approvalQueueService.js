/**
 * Approval Queue Service
 * Manages AI recommendations awaiting human approval (HITL workflow)
 */

const pool = require('../config/database');
const crypto = require('crypto');

/**
 * Create a new AI recommendation in the approval queue
 * 
 * @param {Object} params - Recommendation parameters
 * @param {string} params.tenantId - Tenant ID
 * @param {string} params.recommendationType - Type of recommendation
 * @param {string} params.recommendationText - Human-readable recommendation
 * @param {number} params.confidenceScore - Confidence score (0.0 - 1.0)
 * @param {string[]} params.reasonCodes - Array of reason codes
 * @param {Object} params.shapValues - SHAP feature importance values
 * @param {Object} params.featureImportance - Feature importance scores
 * @param {string} params.modelVersion - Model version
 * @param {boolean} params.requiresApproval - Whether approval is required
 * @param {string} params.relatedEntityType - Type of related entity (optional)
 * @param {string} params.relatedEntityId - ID of related entity (optional)
 * @param {string} params.createdBy - User ID who created the recommendation
 * @param {Date} params.expiresAt - Expiration timestamp (optional)
 * @returns {Promise<Object>} Created recommendation
 */
async function createRecommendation({
    tenantId,
    recommendationType,
    recommendationText,
    confidenceScore,
    reasonCodes = [],
    shapValues = null,
    featureImportance = null,
    modelVersion = 'v1.0.0',
    requiresApproval = true,
    relatedEntityType = null,
    relatedEntityId = null,
    createdBy,
    expiresAt = null
}) {
    const query = `
        INSERT INTO ai_recommendations (
            tenant_id,
            recommendation_type,
            recommendation_text,
            confidence_score,
            reason_codes,
            shap_values,
            feature_importance,
            model_version,
            requires_approval,
            related_entity_type,
            related_entity_id,
            created_by,
            expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *;
    `;

    const values = [
        tenantId,
        recommendationType,
        recommendationText,
        confidenceScore,
        reasonCodes,
        shapValues ? JSON.stringify(shapValues) : null,
        featureImportance ? JSON.stringify(featureImportance) : null,
        modelVersion,
        requiresApproval,
        relatedEntityType,
        relatedEntityId,
        createdBy,
        expiresAt
    ];

    const result = await pool.query(query, values);
    const recommendation = result.rows[0];

    // Log creation to audit trail
    await logAuditAction({
        tenantId,
        recommendationId: recommendation.recommendation_id,
        action: 'created',
        performedBy: createdBy,
        reason: 'AI recommendation created',
        recommendationSnapshot: recommendation
    });

    return recommendation;
}

/**
 * Get recommendations from the queue
 * 
 * @param {Object} filters - Filter parameters
 * @param {string} filters.tenantId - Tenant ID
 * @param {string} filters.status - Filter by status (optional)
 * @param {string} filters.recommendationType - Filter by type (optional)
 * @param {number} filters.minConfidence - Minimum confidence score (optional)
 * @param {Date} filters.startDate - Start date filter (optional)
 * @param {Date} filters.endDate - End date filter (optional)
 * @param {number} filters.limit - Maximum number of results (default: 50)
 * @param {number} filters.offset - Offset for pagination (default: 0)
 * @param {string} filters.sortBy - Sort field (default: 'created_at')
 * @param {string} filters.sortOrder - Sort order (default: 'DESC')
 * @returns {Promise<Object>} Recommendations and pagination info
 */
async function getRecommendations({
    tenantId,
    status = null,
    recommendationType = null,
    minConfidence = null,
    startDate = null,
    endDate = null,
    limit = 50,
    offset = 0,
    sortBy = 'created_at',
    sortOrder = 'DESC'
}) {
    // Build WHERE clause
    const conditions = ['tenant_id = $1'];
    const values = [tenantId];
    let paramIndex = 2;

    if (status) {
        conditions.push(`status = $${paramIndex}`);
        values.push(status);
        paramIndex++;
    }

    if (recommendationType) {
        conditions.push(`recommendation_type = $${paramIndex}`);
        values.push(recommendationType);
        paramIndex++;
    }

    if (minConfidence !== null) {
        conditions.push(`confidence_score >= $${paramIndex}`);
        values.push(minConfidence);
        paramIndex++;
    }

    if (startDate) {
        conditions.push(`created_at >= $${paramIndex}`);
        values.push(startDate);
        paramIndex++;
    }

    if (endDate) {
        conditions.push(`created_at <= $${paramIndex}`);
        values.push(endDate);
        paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Validate sort field
    const validSortFields = ['created_at', 'confidence_score', 'updated_at', 'recommendation_type'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Get total count
    const countQuery = `
        SELECT COUNT(*) as total
        FROM ai_recommendations
        WHERE ${whereClause};
    `;
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Get recommendations
    const query = `
        SELECT *
        FROM ai_recommendations
        WHERE ${whereClause}
        ORDER BY ${sortField} ${sortDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    return {
        recommendations: result.rows,
        pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total
        }
    };
}

/**
 * Get a single recommendation by ID
 * 
 * @param {string} recommendationId - Recommendation ID
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object|null>} Recommendation or null if not found
 */
async function getRecommendationById(recommendationId, tenantId) {
    const query = `
        SELECT *
        FROM ai_recommendations
        WHERE recommendation_id = $1 AND tenant_id = $2;
    `;

    const result = await pool.query(query, [recommendationId, tenantId]);
    return result.rows[0] || null;
}

/**
 * Approve a recommendation
 * 
 * @param {string} recommendationId - Recommendation ID
 * @param {string} tenantId - Tenant ID
 * @param {string} approvedBy - User ID of approver
 * @param {string} reason - Approval reason (optional)
 * @returns {Promise<Object>} Updated recommendation with approval token
 */
async function approveRecommendation(recommendationId, tenantId, approvedBy, reason = null) {
    // Generate approval token
    const approvalToken = `tok_${crypto.randomBytes(16).toString('hex')}`;

    const query = `
        UPDATE ai_recommendations
        SET status = 'approved',
            approved_by = $1,
            approved_at = CURRENT_TIMESTAMP,
            approval_token = $2,
            approval_reason = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE recommendation_id = $4
          AND tenant_id = $5
          AND status = 'pending'
        RETURNING *;
    `;

    const result = await pool.query(query, [
        approvedBy,
        approvalToken,
        reason,
        recommendationId,
        tenantId
    ]);

    if (result.rows.length === 0) {
        throw new Error('Recommendation not found or already processed');
    }

    const recommendation = result.rows[0];

    // Log approval to audit trail
    await logAuditAction({
        tenantId,
        recommendationId,
        action: 'approved',
        performedBy: approvedBy,
        reason,
        recommendationSnapshot: recommendation
    });

    return recommendation;
}

/**
 * Reject a recommendation
 * 
 * @param {string} recommendationId - Recommendation ID
 * @param {string} tenantId - Tenant ID
 * @param {string} rejectedBy - User ID of rejector
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object>} Updated recommendation
 */
async function rejectRecommendation(recommendationId, tenantId, rejectedBy, reason) {
    const query = `
        UPDATE ai_recommendations
        SET status = 'rejected',
            approved_by = $1,
            approved_at = CURRENT_TIMESTAMP,
            approval_reason = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE recommendation_id = $3
          AND tenant_id = $4
          AND status = 'pending'
        RETURNING *;
    `;

    const result = await pool.query(query, [
        rejectedBy,
        reason,
        recommendationId,
        tenantId
    ]);

    if (result.rows.length === 0) {
        throw new Error('Recommendation not found or already processed');
    }

    const recommendation = result.rows[0];

    // Log rejection to audit trail
    await logAuditAction({
        tenantId,
        recommendationId,
        action: 'rejected',
        performedBy: rejectedBy,
        reason,
        recommendationSnapshot: recommendation
    });

    return recommendation;
}

/**
 * Request more information for a recommendation
 * 
 * @param {string} recommendationId - Recommendation ID
 * @param {string} tenantId - Tenant ID
 * @param {string} requestedBy - User ID of requester
 * @param {string} reason - Reason for requesting more info
 * @returns {Promise<Object>} Updated recommendation
 */
async function requestMoreInfo(recommendationId, tenantId, requestedBy, reason) {
    const query = `
        UPDATE ai_recommendations
        SET status = 'more_info_requested',
            approved_by = $1,
            approved_at = CURRENT_TIMESTAMP,
            approval_reason = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE recommendation_id = $3
          AND tenant_id = $4
          AND status = 'pending'
        RETURNING *;
    `;

    const result = await pool.query(query, [
        requestedBy,
        reason,
        recommendationId,
        tenantId
    ]);

    if (result.rows.length === 0) {
        throw new Error('Recommendation not found or already processed');
    }

    const recommendation = result.rows[0];

    // Log action to audit trail
    await logAuditAction({
        tenantId,
        recommendationId,
        action: 'more_info_requested',
        performedBy: requestedBy,
        reason,
        recommendationSnapshot: recommendation
    });

    return recommendation;
}

/**
 * Get queue statistics
 * 
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} Queue statistics
 */
async function getQueueStats(tenantId) {
    const query = `
        SELECT 
            COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
            COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
            COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
            COUNT(*) FILTER (WHERE status = 'more_info_requested') as more_info_count,
            COUNT(*) FILTER (WHERE status = 'expired') as expired_count,
            AVG(confidence_score) FILTER (WHERE status = 'pending') as avg_confidence,
            COUNT(DISTINCT recommendation_type) as unique_types,
            MIN(created_at) FILTER (WHERE status = 'pending') as oldest_pending
        FROM ai_recommendations
        WHERE tenant_id = $1;
    `;

    const result = await pool.query(query, [tenantId]);
    const stats = result.rows[0];

    // Get breakdown by type
    const typeQuery = `
        SELECT 
            recommendation_type,
            COUNT(*) as count,
            AVG(confidence_score) as avg_confidence
        FROM ai_recommendations
        WHERE tenant_id = $1 AND status = 'pending'
        GROUP BY recommendation_type
        ORDER BY count DESC;
    `;

    const typeResult = await pool.query(typeQuery, [tenantId]);

    return {
        ...stats,
        by_type: typeResult.rows
    };
}

/**
 * Expire old pending recommendations
 * 
 * @returns {Promise<number>} Number of expired recommendations
 */
async function expireOldRecommendations() {
    const query = `SELECT expire_old_recommendations() as expired_count;`;
    const result = await pool.query(query);
    return result.rows[0].expired_count;
}

/**
 * Log an audit action
 * 
 * @param {Object} params - Audit parameters
 * @param {string} params.tenantId - Tenant ID
 * @param {string} params.recommendationId - Recommendation ID
 * @param {string} params.action - Action performed
 * @param {string} params.performedBy - User ID who performed the action
 * @param {string} params.reason - Reason for the action
 * @param {Object} params.recommendationSnapshot - Snapshot of recommendation state
 * @returns {Promise<Object>} Audit log entry
 */
async function logAuditAction({
    tenantId,
    recommendationId,
    action,
    performedBy,
    reason,
    recommendationSnapshot
}) {
    const query = `
        INSERT INTO ai_approval_audit_log (
            tenant_id,
            recommendation_id,
            action,
            performed_by,
            reason,
            recommendation_snapshot
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
    `;

    const result = await pool.query(query, [
        tenantId,
        recommendationId,
        action,
        performedBy,
        reason,
        JSON.stringify(recommendationSnapshot)
    ]);

    return result.rows[0];
}

/**
 * Get audit log for a recommendation
 * 
 * @param {string} recommendationId - Recommendation ID
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Array>} Audit log entries
 */
async function getAuditLog(recommendationId, tenantId) {
    const query = `
        SELECT *
        FROM ai_approval_audit_log
        WHERE recommendation_id = $1 AND tenant_id = $2
        ORDER BY performed_at DESC;
    `;

    const result = await pool.query(query, [recommendationId, tenantId]);
    return result.rows;
}

module.exports = {
    createRecommendation,
    getRecommendations,
    getRecommendationById,
    approveRecommendation,
    rejectRecommendation,
    requestMoreInfo,
    getQueueStats,
    expireOldRecommendations,
    getAuditLog
};
