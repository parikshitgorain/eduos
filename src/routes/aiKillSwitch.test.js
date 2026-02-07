/**
 * AI Kill Switch Routes Tests
 * 
 * Task 3.4.3: Create AI Kill Switch mechanism
 */

const request = require('supertest');
const express = require('express');
const aiKillSwitchRoutes = require('./aiKillSwitch');
const aiKillSwitchService = require('../services/aiKillSwitchService');

// Mock the service
jest.mock('../services/aiKillSwitchService');

describe('AI Kill Switch Routes', () => {
  let app;
  let mockPool;
  let mockClient;
  
  beforeEach(() => {
    // Create Express app
    app = express();
    app.use(express.json());
    
    // Mock database pool
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient)
    };
    
    app.locals.pool = mockPool;
    
    // Mount routes
    app.use('/api/v1/ai', aiKillSwitchRoutes);
    
    // Reset mocks
    jest.clearAllMocks();
  });
  
  describe('GET /api/v1/ai/kill-switch', () => {
    it('should return kill switch status when enabled', async () => {
      const status = {
        enabled: true,
        disabled_at: null,
        disabled_by: null,
        reason: null
      };
      
      aiKillSwitchService.getKillSwitchStatus.mockResolvedValue(status);
      
      const response = await request(app)
        .get('/api/v1/ai/kill-switch')
        .expect(200);
      
      expect(response.body).toEqual({
        success: true,
        data: status
      });
    });
    
    it('should return kill switch status when disabled', async () => {
      const status = {
        enabled: false,
        disabled_at: '2026-02-07T12:00:00Z',
        disabled_by: 'superadmin_001',
        reason: 'Security incident'
      };
      
      aiKillSwitchService.getKillSwitchStatus.mockResolvedValue(status);
      
      const response = await request(app)
        .get('/api/v1/ai/kill-switch')
        .expect(200);
      
      expect(response.body).toEqual({
        success: true,
        data: status
      });
    });
    
    it('should return 500 on service error', async () => {
      aiKillSwitchService.getKillSwitchStatus.mockRejectedValue(
        new Error('Service error')
      );
      
      const response = await request(app)
        .get('/api/v1/ai/kill-switch')
        .expect(500);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get AI Kill Switch status');
    });
  });
  
  describe('POST /api/v1/ai/kill-switch/toggle', () => {
    it('should disable AI services successfully', async () => {
      const status = {
        enabled: false,
        disabled_at: '2026-02-07T12:00:00Z',
        disabled_by: 'superadmin_001',
        reason: 'Security incident'
      };
      
      aiKillSwitchService.toggleKillSwitch.mockResolvedValue(status);
      
      const response = await request(app)
        .post('/api/v1/ai/kill-switch/toggle')
        .send({
          enable: false,
          reason: 'Security incident'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(status);
      expect(response.body.message).toContain('disabled');
      
      expect(aiKillSwitchService.toggleKillSwitch).toHaveBeenCalledWith(
        false,
        'Security incident',
        expect.any(String),
        mockPool
      );
    });
    
    it('should enable AI services successfully', async () => {
      const status = {
        enabled: true,
        disabled_at: null,
        disabled_by: null,
        reason: null
      };
      
      aiKillSwitchService.toggleKillSwitch.mockResolvedValue(status);
      
      const response = await request(app)
        .post('/api/v1/ai/kill-switch/toggle')
        .send({
          enable: true,
          reason: 'Issue resolved'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(status);
      expect(response.body.message).toContain('enabled');
    });
    
    it('should return 400 if enable is not boolean', async () => {
      const response = await request(app)
        .post('/api/v1/ai/kill-switch/toggle')
        .send({
          enable: 'true',
          reason: 'Test'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('boolean');
    });
    
    it('should return 400 if reason is missing', async () => {
      const response = await request(app)
        .post('/api/v1/ai/kill-switch/toggle')
        .send({
          enable: false
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('reason');
    });
    
    it('should return 400 if reason is empty string', async () => {
      const response = await request(app)
        .post('/api/v1/ai/kill-switch/toggle')
        .send({
          enable: false,
          reason: '   '
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('reason');
    });
    
    it('should return 400 if reason is not a string', async () => {
      const response = await request(app)
        .post('/api/v1/ai/kill-switch/toggle')
        .send({
          enable: false,
          reason: 123
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('reason');
    });
    
    it('should return 500 on service error', async () => {
      aiKillSwitchService.toggleKillSwitch.mockRejectedValue(
        new Error('Service error')
      );
      
      const response = await request(app)
        .post('/api/v1/ai/kill-switch/toggle')
        .send({
          enable: false,
          reason: 'Test'
        })
        .expect(500);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to toggle AI Kill Switch');
    });
  });
  
  describe('GET /api/v1/ai/kill-switch/history', () => {
    it('should return kill switch history', async () => {
      const history = [
        {
          event_type: 'AI_GOVERNANCE',
          user_id: 'superadmin_001',
          action: 'AI_KILL_SWITCH_DISABLED',
          details: JSON.stringify({
            enabled: false,
            reason: 'Security incident',
            toggled_by: 'superadmin_001'
          }),
          timestamp: '2026-02-07T12:00:00Z',
          ip_address: '192.168.1.1'
        },
        {
          event_type: 'AI_GOVERNANCE',
          user_id: 'superadmin_001',
          action: 'AI_KILL_SWITCH_ENABLED',
          details: JSON.stringify({
            enabled: true,
            reason: 'Issue resolved',
            toggled_by: 'superadmin_001'
          }),
          timestamp: '2026-02-07T11:00:00Z',
          ip_address: '192.168.1.1'
        }
      ];
      
      mockClient.query.mockResolvedValue({ rows: history });
      
      const response = await request(app)
        .get('/api/v1/ai/kill-switch/history')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toEqual(history);
      expect(response.body.data.total).toBe(2);
      
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [50] // default limit
      );
    });
    
    it('should respect custom limit parameter', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      
      await request(app)
        .get('/api/v1/ai/kill-switch/history?limit=100')
        .expect(200);
      
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [100]
      );
    });
    
    it('should cap limit at 500', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      
      await request(app)
        .get('/api/v1/ai/kill-switch/history?limit=1000')
        .expect(200);
      
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [500] // capped at 500
      );
    });
    
    it('should return empty array when no history', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      
      const response = await request(app)
        .get('/api/v1/ai/kill-switch/history')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toEqual([]);
      expect(response.body.data.total).toBe(0);
    });
    
    it('should return 500 on database error', async () => {
      mockClient.query.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .get('/api/v1/ai/kill-switch/history')
        .expect(500);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get kill switch history');
    });
  });
});
