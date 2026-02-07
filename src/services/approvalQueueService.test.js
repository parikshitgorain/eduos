/**
 * Tests for Approval Queue Service
 */

const approvalQueueService = require('./approvalQueueService');
const pool = require('../config/database');

// Mock database pool
jest.mock('../config/database', () => ({
    query: jest.fn()
}));

describe('Approval Queue Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createRecommendation', () => {
        it('should create a new recommendation', async () => {
            const mockRecommendation = {
                recommendation_id: 'rec-123',
                tenant_id: 'tenant-1',
                recommendation_type: 'duplicate_detection',
                recommendation_text: 'Potential duplicate found',
                confidence_score: 0.85,
                status: 'pending'
            };

            pool.query
                .mockResolvedValueOnce({ rows: [mockRecommendation] }) // INSERT
                .mockResolvedValueOnce({ rows: [{ log_id: 'log-1' }] }); // Audit log

            const result = await approvalQueueService.createRecommendation({
                tenantId: 'tenant-1',
                recommendationType: 'duplicate_detection',
                recommendationText: 'Potential duplicate found',
                confidenceScore: 0.85,
                reasonCodes: ['name_match', 'dob_match'],
                createdBy: 'user-1'
            });

            expect(result).toEqual(mockRecommendation);
            expect(pool.query).toHaveBeenCalledTimes(2);
        });

        it('should include optional fields when provided', async () => {
            const mockRecommendation = {
                recommendation_id: 'rec-123',
                related_entity_type: 'student',
                related_entity_id: 'student-1'
            };

            pool.query
                .mockResolvedValueOnce({ rows: [mockRecommendation] })
                .mockResolvedValueOnce({ rows: [{ log_id: 'log-1' }] });

            await approvalQueueService.createRecommendation({
                tenantId: 'tenant-1',
                recommendationType: 'duplicate_detection',
                recommendationText: 'Test',
                confidenceScore: 0.9,
                relatedEntityType: 'student',
                relatedEntityId: 'student-1',
                createdBy: 'user-1'
            });

            const insertCall = pool.query.mock.calls[0];
            expect(insertCall[1]).toContain('student');
            expect(insertCall[1]).toContain('student-1');
        });
    });

    describe('getRecommendations', () => {
        it('should get recommendations with pagination', async () => {
            const mockRecommendations = [
                { recommendation_id: 'rec-1', status: 'pending' },
                { recommendation_id: 'rec-2', status: 'pending' }
            ];

            pool.query
                .mockResolvedValueOnce({ rows: [{ total: '10' }] }) // Count
                .mockResolvedValueOnce({ rows: mockRecommendations }); // Data

            const result = await approvalQueueService.getRecommendations({
                tenantId: 'tenant-1',
                limit: 2,
                offset: 0
            });

            expect(result.recommendations).toEqual(mockRecommendations);
            expect(result.pagination).toEqual({
                total: 10,
                limit: 2,
                offset: 0,
                hasMore: true
            });
        });

        it('should filter by status', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ total: '5' }] })
                .mockResolvedValueOnce({ rows: [] });

            await approvalQueueService.getRecommendations({
                tenantId: 'tenant-1',
                status: 'approved'
            });

            const countQuery = pool.query.mock.calls[0][0];
            expect(countQuery).toContain('status = $2');
        });

        it('should filter by recommendation type', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ total: '3' }] })
                .mockResolvedValueOnce({ rows: [] });

            await approvalQueueService.getRecommendations({
                tenantId: 'tenant-1',
                recommendationType: 'duplicate_detection'
            });

            const countQuery = pool.query.mock.calls[0][0];
            expect(countQuery).toContain('recommendation_type = $2');
        });

        it('should filter by minimum confidence', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ total: '2' }] })
                .mockResolvedValueOnce({ rows: [] });

            await approvalQueueService.getRecommendations({
                tenantId: 'tenant-1',
                minConfidence: 0.8
            });

            const countQuery = pool.query.mock.calls[0][0];
            expect(countQuery).toContain('confidence_score >= $2');
        });

        it('should sort by specified field', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ total: '5' }] })
                .mockResolvedValueOnce({ rows: [] });

            await approvalQueueService.getRecommendations({
                tenantId: 'tenant-1',
                sortBy: 'confidence_score',
                sortOrder: 'ASC'
            });

            const dataQuery = pool.query.mock.calls[1][0];
            expect(dataQuery).toContain('ORDER BY confidence_score ASC');
        });
    });

    describe('getRecommendationById', () => {
        it('should get a recommendation by ID', async () => {
            const mockRecommendation = {
                recommendation_id: 'rec-123',
                tenant_id: 'tenant-1'
            };

            pool.query.mockResolvedValueOnce({ rows: [mockRecommendation] });

            const result = await approvalQueueService.getRecommendationById('rec-123', 'tenant-1');

            expect(result).toEqual(mockRecommendation);
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE recommendation_id = $1 AND tenant_id = $2'),
                ['rec-123', 'tenant-1']
            );
        });

        it('should return null if not found', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const result = await approvalQueueService.getRecommendationById('rec-999', 'tenant-1');

            expect(result).toBeNull();
        });
    });

    describe('approveRecommendation', () => {
        it('should approve a recommendation and generate token', async () => {
            const mockApproved = {
                recommendation_id: 'rec-123',
                status: 'approved',
                approval_token: 'tok_abc123',
                approved_by: 'user-1'
            };

            pool.query
                .mockResolvedValueOnce({ rows: [mockApproved] }) // UPDATE
                .mockResolvedValueOnce({ rows: [{ log_id: 'log-1' }] }); // Audit

            const result = await approvalQueueService.approveRecommendation(
                'rec-123',
                'tenant-1',
                'user-1',
                'Looks good'
            );

            expect(result.status).toBe('approved');
            expect(result.approval_token).toBeTruthy();
            expect(result.approved_by).toBe('user-1');
        });

        it('should throw error if recommendation not found', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            await expect(
                approvalQueueService.approveRecommendation('rec-999', 'tenant-1', 'user-1')
            ).rejects.toThrow('Recommendation not found or already processed');
        });
    });

    describe('rejectRecommendation', () => {
        it('should reject a recommendation', async () => {
            const mockRejected = {
                recommendation_id: 'rec-123',
                status: 'rejected',
                approved_by: 'user-1',
                approval_reason: 'Not a duplicate'
            };

            pool.query
                .mockResolvedValueOnce({ rows: [mockRejected] })
                .mockResolvedValueOnce({ rows: [{ log_id: 'log-1' }] });

            const result = await approvalQueueService.rejectRecommendation(
                'rec-123',
                'tenant-1',
                'user-1',
                'Not a duplicate'
            );

            expect(result.status).toBe('rejected');
            expect(result.approval_reason).toBe('Not a duplicate');
        });

        it('should throw error if recommendation not found', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            await expect(
                approvalQueueService.rejectRecommendation('rec-999', 'tenant-1', 'user-1', 'reason')
            ).rejects.toThrow('Recommendation not found or already processed');
        });
    });

    describe('requestMoreInfo', () => {
        it('should request more information', async () => {
            const mockUpdated = {
                recommendation_id: 'rec-123',
                status: 'more_info_requested',
                approval_reason: 'Need more details'
            };

            pool.query
                .mockResolvedValueOnce({ rows: [mockUpdated] })
                .mockResolvedValueOnce({ rows: [{ log_id: 'log-1' }] });

            const result = await approvalQueueService.requestMoreInfo(
                'rec-123',
                'tenant-1',
                'user-1',
                'Need more details'
            );

            expect(result.status).toBe('more_info_requested');
        });
    });

    describe('getQueueStats', () => {
        it('should get queue statistics', async () => {
            const mockStats = {
                pending_count: '5',
                approved_count: '10',
                rejected_count: '2',
                more_info_count: '1',
                expired_count: '0',
                avg_confidence: '0.85',
                unique_types: '3',
                oldest_pending: new Date()
            };

            const mockTypeBreakdown = [
                { recommendation_type: 'duplicate_detection', count: '3', avg_confidence: '0.9' },
                { recommendation_type: 'risk_prediction', count: '2', avg_confidence: '0.8' }
            ];

            pool.query
                .mockResolvedValueOnce({ rows: [mockStats] })
                .mockResolvedValueOnce({ rows: mockTypeBreakdown });

            const result = await approvalQueueService.getQueueStats('tenant-1');

            expect(result.pending_count).toBe('5');
            expect(result.by_type).toEqual(mockTypeBreakdown);
        });
    });

    describe('expireOldRecommendations', () => {
        it('should expire old recommendations', async () => {
            pool.query.mockResolvedValueOnce({ rows: [{ expired_count: 3 }] });

            const result = await approvalQueueService.expireOldRecommendations();

            expect(result).toBe(3);
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('expire_old_recommendations')
            );
        });
    });

    describe('getAuditLog', () => {
        it('should get audit log for a recommendation', async () => {
            const mockAuditLog = [
                { log_id: 'log-1', action: 'created', performed_at: new Date() },
                { log_id: 'log-2', action: 'approved', performed_at: new Date() }
            ];

            pool.query.mockResolvedValueOnce({ rows: mockAuditLog });

            const result = await approvalQueueService.getAuditLog('rec-123', 'tenant-1');

            expect(result).toEqual(mockAuditLog);
            expect(result).toHaveLength(2);
        });
    });
});
