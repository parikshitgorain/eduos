/**
 * Approval Queue API Routes
 * Manages AI recommendations awaiting human approval (HITL workflow)
 */

const express = require('express');
const router = express.Router();
const approvalQueueService = require('../services/approvalQueueService');

/**
 * POST /api/v1/approvals/recommendations
 * Create a new AI recommendation in the approval queue
 */
router.post('/recommendations', async (req, res) => {
    try {
        const {
            recommendationType,
            recommendationText,
            confidenceScore,
            reasonCodes,
            shapValues,
            featureImportance,
            modelVersion,
            requiresApproval,
            relatedEntityType,
            relatedEntityId,
            expiresAt
        } = req.body;

        // Validation
        if (!recommendationType || !recommendationText || confidenceScore === undefined) {
            return res.status(400).json({
                error: 'Missing required fields: recommendationType, recommendationText, confidenceScore'
            });
        }

        if (confidenceScore < 0 || confidenceScore > 1) {
            return res.status(400).json({
                error: 'Confidence score must be between 0.0 and 1.0'
            });
        }

        // Get tenant ID and user ID from context (set by middleware)
        const tenantId = req.tenantId || req.body.tenantId;
        const createdBy = req.userId || req.body.createdBy;

        if (!tenantId || !createdBy) {
            return res.status(400).json({
                error: 'Missing tenant ID or user ID'
            });
        }

        const recommendation = await approvalQueueService.createRecommendation({
            tenantId,
            recommendationType,
            recommendationText,
            confidenceScore,
            reasonCodes: reasonCodes || [],
            shapValues,
            featureImportance,
            modelVersion: modelVersion || 'v1.0.0',
            requiresApproval: requiresApproval !== false,
            relatedEntityType,
            relatedEntityId,
            createdBy,
            expiresAt: expiresAt ? new Date(expiresAt) : null
        });

        res.status(201).json(recommendation);
    } catch (error) {
        console.error('Error creating recommendation:', error);
        res.status(500).json({
            error: 'Failed to create recommendation',
            message: error.message
        });
    }
});

/**
 * GET /api/v1/approvals/recommendations
 * Get recommendations from the queue with filtering and pagination
 */
router.get('/recommendations', async (req, res) => {
    try {
        const tenantId = req.tenantId || req.query.tenantId;

        if (!tenantId) {
            return res.status(400).json({
                error: 'Missing tenant ID'
            });
        }

        const {
            status,
            recommendationType,
            minConfidence,
            startDate,
            endDate,
            limit,
            offset,
            sortBy,
            sortOrder
        } = req.query;

        const result = await approvalQueueService.getRecommendations({
            tenantId,
            status,
            recommendationType,
            minConfidence: minConfidence ? parseFloat(minConfidence) : null,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            limit: limit ? parseInt(limit) : 50,
            offset: offset ? parseInt(offset) : 0,
            sortBy: sortBy || 'created_at',
            sortOrder: sortOrder || 'DESC'
        });

        res.json(result);
    } catch (error) {
        console.error('Error getting recommendations:', error);
        res.status(500).json({
            error: 'Failed to get recommendations',
            message: error.message
        });
    }
});

/**
 * GET /api/v1/approvals/recommendations/:id
 * Get a single recommendation by ID
 */
router.get('/recommendations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId || req.query.tenantId;

        if (!tenantId) {
            return res.status(400).json({
                error: 'Missing tenant ID'
            });
        }

        const recommendation = await approvalQueueService.getRecommendationById(id, tenantId);

        if (!recommendation) {
            return res.status(404).json({
                error: 'Recommendation not found'
            });
        }

        res.json(recommendation);
    } catch (error) {
        console.error('Error getting recommendation:', error);
        res.status(500).json({
            error: 'Failed to get recommendation',
            message: error.message
        });
    }
});

/**
 * POST /api/v1/approvals/recommendations/:id/approve
 * Approve a recommendation
 */
router.post('/recommendations/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const tenantId = req.tenantId || req.body.tenantId;
        const approvedBy = req.userId || req.body.approvedBy;

        if (!tenantId || !approvedBy) {
            return res.status(400).json({
                error: 'Missing tenant ID or user ID'
            });
        }

        const recommendation = await approvalQueueService.approveRecommendation(
            id,
            tenantId,
            approvedBy,
            reason
        );

        res.json(recommendation);
    } catch (error) {
        console.error('Error approving recommendation:', error);
        
        if (error.message.includes('not found or already processed')) {
            return res.status(404).json({
                error: 'Recommendation not found or already processed',
                message: error.message
            });
        }

        res.status(500).json({
            error: 'Failed to approve recommendation',
            message: error.message
        });
    }
});

/**
 * POST /api/v1/approvals/recommendations/:id/reject
 * Reject a recommendation
 */
router.post('/recommendations/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const tenantId = req.tenantId || req.body.tenantId;
        const rejectedBy = req.userId || req.body.rejectedBy;

        if (!tenantId || !rejectedBy) {
            return res.status(400).json({
                error: 'Missing tenant ID or user ID'
            });
        }

        if (!reason) {
            return res.status(400).json({
                error: 'Rejection reason is required'
            });
        }

        const recommendation = await approvalQueueService.rejectRecommendation(
            id,
            tenantId,
            rejectedBy,
            reason
        );

        res.json(recommendation);
    } catch (error) {
        console.error('Error rejecting recommendation:', error);
        
        if (error.message.includes('not found or already processed')) {
            return res.status(404).json({
                error: 'Recommendation not found or already processed',
                message: error.message
            });
        }

        res.status(500).json({
            error: 'Failed to reject recommendation',
            message: error.message
        });
    }
});

/**
 * POST /api/v1/approvals/recommendations/:id/request-info
 * Request more information for a recommendation
 */
router.post('/recommendations/:id/request-info', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const tenantId = req.tenantId || req.body.tenantId;
        const requestedBy = req.userId || req.body.requestedBy;

        if (!tenantId || !requestedBy) {
            return res.status(400).json({
                error: 'Missing tenant ID or user ID'
            });
        }

        if (!reason) {
            return res.status(400).json({
                error: 'Reason is required'
            });
        }

        const recommendation = await approvalQueueService.requestMoreInfo(
            id,
            tenantId,
            requestedBy,
            reason
        );

        res.json(recommendation);
    } catch (error) {
        console.error('Error requesting more info:', error);
        
        if (error.message.includes('not found or already processed')) {
            return res.status(404).json({
                error: 'Recommendation not found or already processed',
                message: error.message
            });
        }

        res.status(500).json({
            error: 'Failed to request more information',
            message: error.message
        });
    }
});

/**
 * GET /api/v1/approvals/stats
 * Get queue statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const tenantId = req.tenantId || req.query.tenantId;

        if (!tenantId) {
            return res.status(400).json({
                error: 'Missing tenant ID'
            });
        }

        const stats = await approvalQueueService.getQueueStats(tenantId);
        res.json(stats);
    } catch (error) {
        console.error('Error getting queue stats:', error);
        res.status(500).json({
            error: 'Failed to get queue statistics',
            message: error.message
        });
    }
});

/**
 * GET /api/v1/approvals/recommendations/:id/audit
 * Get audit log for a recommendation
 */
router.get('/recommendations/:id/audit', async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId || req.query.tenantId;

        if (!tenantId) {
            return res.status(400).json({
                error: 'Missing tenant ID'
            });
        }

        const auditLog = await approvalQueueService.getAuditLog(id, tenantId);
        res.json(auditLog);
    } catch (error) {
        console.error('Error getting audit log:', error);
        res.status(500).json({
            error: 'Failed to get audit log',
            message: error.message
        });
    }
});

/**
 * POST /api/v1/approvals/expire
 * Expire old pending recommendations (admin only)
 */
router.post('/expire', async (req, res) => {
    try {
        const expiredCount = await approvalQueueService.expireOldRecommendations();
        res.json({
            message: 'Old recommendations expired successfully',
            expired_count: expiredCount
        });
    } catch (error) {
        console.error('Error expiring recommendations:', error);
        res.status(500).json({
            error: 'Failed to expire recommendations',
            message: error.message
        });
    }
});

module.exports = router;
