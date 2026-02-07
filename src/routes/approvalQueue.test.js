/**
 * Tests for Approval Queue API Routes
 */

const request = require('supertest');
const express = require('express');
const approvalQueueRoutes = require('./approvalQueue');
const approvalQueueService = require('../services/approvalQueueService');

// Mock the service
jest.mock('../services/approvalQueueService');

// Create test app
const app = express();
app.use(express.json());

// Mock middleware to set tenant and user context
app.use((req, res, next) => {
    req.tenantId = 'tenant-1';
    req.userId = 'user-1';
    next();
});

app.use('/api/v1/approvals', approvalQueueRoutes);

describe('Approval Queue API Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/v1/approvals/recommendations', () => {
        it('should create a new recommendation', async () => {
            const mockRecommendation = {
                recommendation_id: 'rec-123',
                recommendation_type: 'duplicate_detection',
                confidence_score: 0.85
            };

            approvalQueueService.createRecommendation.mockResolvedValue(mockRecommendation);

            const response = await request(app)
                .post('/api/v1/approvals/recommendations')
                .send({
                    recommendationType: 'duplicate_detection',
                    recommendationText: 'Potential duplicate found',
                    confidenceScore: 0.85,
                    reasonCodes: ['name_match']
                });

            expect(response.status).toBe(201);
            expect(response.body).toEqual(mockRecommendation);
            expect(approvalQueueService.createRecommendation).toHaveBeenCalled();
        });

        it('should return 400 if required fields are missing', async () => {
            const response = await request(app)
                .post('/api/v1/approvals/recommendations')
                .send({
                    recommendationType: 'duplicate_detection'
                    // Missing recommendationText and confidenceScore
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Missing required fields');
        });

        it('should return 400 if confidence score is invalid', async () => {
            const response = await request(app)
                .post('/api/v1/approvals/recommendations')
                .send({
                    recommendationType: 'duplicate_detection',
                    recommendationText: 'Test',
                    confidenceScore: 1.5 // Invalid: > 1.0
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Confidence score must be between 0.0 and 1.0');
        });
    });

    describe('GET /api/v1/approvals/recommendations', () => {
        it('should get recommendations with pagination', async () => {
            const mockResult = {
                recommendations: [
                    { recommendation_id: 'rec-1' },
                    { recommendation_id: 'rec-2' }
                ],
                pagination: {
                    total: 10,
                    limit: 50,
                    offset: 0,
                    hasMore: false
                }
            };

            approvalQueueService.getRecommendations.mockResolvedValue(mockResult);

            const response = await request(app)
                .get('/api/v1/approvals/recommendations');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockResult);
        });

        it('should apply filters from query parameters', async () => {
            approvalQueueService.getRecommendations.mockResolvedValue({
                recommendations: [],
                pagination: { total: 0, limit: 50, offset: 0, hasMore: false }
            });

            await request(app)
                .get('/api/v1/approvals/recommendations')
                .query({
                    status: 'pending',
                    recommendationType: 'duplicate_detection',
                    minConfidence: '0.8'
                });

            expect(approvalQueueService.getRecommendations).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'pending',
                    recommendationType: 'duplicate_detection',
                    minConfidence: 0.8
                })
            );
        });
    });

    describe('GET /api/v1/approvals/recommendations/:id', () => {
        it('should get a recommendation by ID', async () => {
            const mockRecommendation = {
                recommendation_id: 'rec-123',
                status: 'pending'
            };

            approvalQueueService.getRecommendationById.mockResolvedValue(mockRecommendation);

            const response = await request(app)
                .get('/api/v1/approvals/recommendations/rec-123');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockRecommendation);
        });

        it('should return 404 if recommendation not found', async () => {
            approvalQueueService.getRecommendationById.mockResolvedValue(null);

            const response = await request(app)
                .get('/api/v1/approvals/recommendations/rec-999');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Recommendation not found');
        });
    });

    describe('POST /api/v1/approvals/recommendations/:id/approve', () => {
        it('should approve a recommendation', async () => {
            const mockApproved = {
                recommendation_id: 'rec-123',
                status: 'approved',
                approval_token: 'tok_abc123'
            };

            approvalQueueService.approveRecommendation.mockResolvedValue(mockApproved);

            const response = await request(app)
                .post('/api/v1/approvals/recommendations/rec-123/approve')
                .send({ reason: 'Looks good' });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('approved');
            expect(response.body.approval_token).toBeTruthy();
        });

        it('should return 404 if recommendation not found', async () => {
            approvalQueueService.approveRecommendation.mockRejectedValue(
                new Error('Recommendation not found or already processed')
            );

            const response = await request(app)
                .post('/api/v1/approvals/recommendations/rec-999/approve')
                .send({ reason: 'Test' });

            expect(response.status).toBe(404);
        });
    });

    describe('POST /api/v1/approvals/recommendations/:id/reject', () => {
        it('should reject a recommendation', async () => {
            const mockRejected = {
                recommendation_id: 'rec-123',
                status: 'rejected'
            };

            approvalQueueService.rejectRecommendation.mockResolvedValue(mockRejected);

            const response = await request(app)
                .post('/api/v1/approvals/recommendations/rec-123/reject')
                .send({ reason: 'Not a duplicate' });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('rejected');
        });

        it('should return 400 if reason is missing', async () => {
            const response = await request(app)
                .post('/api/v1/approvals/recommendations/rec-123/reject')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Rejection reason is required');
        });
    });

    describe('POST /api/v1/approvals/recommendations/:id/request-info', () => {
        it('should request more information', async () => {
            const mockUpdated = {
                recommendation_id: 'rec-123',
                status: 'more_info_requested'
            };

            approvalQueueService.requestMoreInfo.mockResolvedValue(mockUpdated);

            const response = await request(app)
                .post('/api/v1/approvals/recommendations/rec-123/request-info')
                .send({ reason: 'Need more details' });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('more_info_requested');
        });

        it('should return 400 if reason is missing', async () => {
            const response = await request(app)
                .post('/api/v1/approvals/recommendations/rec-123/request-info')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Reason is required');
        });
    });

    describe('GET /api/v1/approvals/stats', () => {
        it('should get queue statistics', async () => {
            const mockStats = {
                pending_count: '5',
                approved_count: '10',
                by_type: [
                    { recommendation_type: 'duplicate_detection', count: '3' }
                ]
            };

            approvalQueueService.getQueueStats.mockResolvedValue(mockStats);

            const response = await request(app)
                .get('/api/v1/approvals/stats');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockStats);
        });
    });

    describe('GET /api/v1/approvals/recommendations/:id/audit', () => {
        it('should get audit log for a recommendation', async () => {
            const mockAuditLog = [
                { log_id: 'log-1', action: 'created' },
                { log_id: 'log-2', action: 'approved' }
            ];

            approvalQueueService.getAuditLog.mockResolvedValue(mockAuditLog);

            const response = await request(app)
                .get('/api/v1/approvals/recommendations/rec-123/audit');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockAuditLog);
        });
    });

    describe('POST /api/v1/approvals/expire', () => {
        it('should expire old recommendations', async () => {
            approvalQueueService.expireOldRecommendations.mockResolvedValue(3);

            const response = await request(app)
                .post('/api/v1/approvals/expire');

            expect(response.status).toBe(200);
            expect(response.body.expired_count).toBe(3);
        });
    });
});
