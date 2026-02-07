/**
 * AI Kill Switch Service Tests
 * 
 * Task 3.4.3: Create AI Kill Switch mechanism
 */

const aiKillSwitchService = require('./aiKillSwitchService');
const { redis } = require('../config/redis');
const axios = require('axios');

// Mock dependencies
jest.mock('axios');
jest.mock('../config/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn()
  }
}));

describe('AI Kill Switch Service', () => {
  let mockPool;
  let mockClient;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock database pool and client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient)
    };
  });
  
  describe('getKillSwitchStatus', () => {
    it('should return status from Redis cache if available', async () => {
      const cachedStatus = {
        enabled: true,
        disabled_at: null,
        disabled_by: null,
        reason: null
      };
      
      redis.get.mockResolvedValue(JSON.stringify(cachedStatus));
      
      const status = await aiKillSwitchService.getKillSwitchStatus();
      
      expect(redis.get).toHaveBeenCalledWith('ai:kill_switch:status');
      expect(status).toEqual(cachedStatus);
      expect(axios.get).not.toHaveBeenCalled();
    });
    
    it('should fetch from AI service if not in cache', async () => {
      const serviceStatus = {
        enabled: false,
        disabled_at: '2026-02-07T12:00:00Z',
        disabled_by: 'superadmin_001',
        reason: 'Security incident'
      };
      
      redis.get.mockResolvedValue(null);
      axios.get.mockResolvedValue({ data: serviceStatus });
      
      const status = await aiKillSwitchService.getKillSwitchStatus();
      
      expect(redis.get).toHaveBeenCalledWith('ai:kill_switch:status');
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/kill-switch')
      );
      expect(redis.set).toHaveBeenCalledWith(
        'ai:kill_switch:status',
        JSON.stringify(serviceStatus)
      );
      expect(status).toEqual(serviceStatus);
    });
    
    it('should return default enabled status on error', async () => {
      redis.get.mockRejectedValue(new Error('Redis error'));
      
      const status = await aiKillSwitchService.getKillSwitchStatus();
      
      expect(status).toEqual({
        enabled: true,
        disabled_at: null,
        disabled_by: null,
        reason: null
      });
    });
  });
  
  describe('toggleKillSwitch', () => {
    it('should disable AI services successfully', async () => {
      const toggledStatus = {
        enabled: false,
        disabled_at: '2026-02-07T12:00:00Z',
        disabled_by: 'superadmin_001',
        reason: 'Security incident'
      };
      
      axios.post.mockResolvedValue({ data: toggledStatus });
      mockClient.query.mockResolvedValue({ rows: [] });
      
      const status = await aiKillSwitchService.toggleKillSwitch(
        false,
        'Security incident',
        'superadmin_001',
        mockPool
      );
      
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/kill-switch'),
        {
          enable: false,
          reason: 'Security incident',
          toggled_by: 'superadmin_001'
        }
      );
      
      expect(redis.set).toHaveBeenCalledWith(
        'ai:kill_switch:status',
        JSON.stringify(toggledStatus)
      );
      
      expect(status).toEqual(toggledStatus);
    });
    
    it('should enable AI services successfully', async () => {
      const toggledStatus = {
        enabled: true,
        disabled_at: null,
        disabled_by: null,
        reason: null
      };
      
      axios.post.mockResolvedValue({ data: toggledStatus });
      mockClient.query.mockResolvedValue({ rows: [] });
      
      const status = await aiKillSwitchService.toggleKillSwitch(
        true,
        'Issue resolved',
        'superadmin_001',
        mockPool
      );
      
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/kill-switch'),
        {
          enable: true,
          reason: 'Issue resolved',
          toggled_by: 'superadmin_001'
        }
      );
      
      expect(status.enabled).toBe(true);
    });
    
    it('should log kill switch event to audit trail', async () => {
      const toggledStatus = {
        enabled: false,
        disabled_at: '2026-02-07T12:00:00Z',
        disabled_by: 'superadmin_001',
        reason: 'Testing'
      };
      
      axios.post.mockResolvedValue({ data: toggledStatus });
      mockClient.query.mockResolvedValue({ rows: [] });
      
      await aiKillSwitchService.toggleKillSwitch(
        false,
        'Testing',
        'superadmin_001',
        mockPool
      );
      
      // Check audit log was created
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'AI_GOVERNANCE',
          'superadmin_001',
          'ai_kill_switch',
          'global',
          'AI_KILL_SWITCH_DISABLED'
        ])
      );
    });
    
    it('should notify all admins when toggled', async () => {
      const toggledStatus = {
        enabled: false,
        disabled_at: '2026-02-07T12:00:00Z',
        disabled_by: 'superadmin_001',
        reason: 'Emergency'
      };
      
      axios.post.mockResolvedValue({ data: toggledStatus });
      
      // Mock admin users query
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // audit log insert
        .mockResolvedValueOnce({ // admin users query
          rows: [
            { user_id: 'admin_1', email: 'admin1@test.com', first_name: 'Admin', last_name: 'One' },
            { user_id: 'admin_2', email: 'admin2@test.com', first_name: 'Admin', last_name: 'Two' }
          ]
        })
        .mockResolvedValue({ rows: [] }); // notification inserts
      
      await aiKillSwitchService.toggleKillSwitch(
        false,
        'Emergency',
        'superadmin_001',
        mockPool
      );
      
      // Check notifications were created
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([
          'admin_1',
          expect.any(String),
          expect.stringContaining('disabled'),
          'AI_GOVERNANCE',
          'critical'
        ])
      );
    });
    
    it('should throw error if AI service call fails', async () => {
      axios.post.mockRejectedValue(new Error('AI service unavailable'));
      
      await expect(
        aiKillSwitchService.toggleKillSwitch(
          false,
          'Test',
          'superadmin_001',
          mockPool
        )
      ).rejects.toThrow('Failed to toggle AI Kill Switch');
    });
  });
  
  describe('isAIEnabled', () => {
    it('should return true when AI is enabled', async () => {
      redis.get.mockResolvedValue(JSON.stringify({
        enabled: true,
        disabled_at: null,
        disabled_by: null,
        reason: null
      }));
      
      const enabled = await aiKillSwitchService.isAIEnabled();
      
      expect(enabled).toBe(true);
    });
    
    it('should return false when AI is disabled', async () => {
      redis.get.mockResolvedValue(JSON.stringify({
        enabled: false,
        disabled_at: '2026-02-07T12:00:00Z',
        disabled_by: 'superadmin_001',
        reason: 'Maintenance'
      }));
      
      const enabled = await aiKillSwitchService.isAIEnabled();
      
      expect(enabled).toBe(false);
    });
    
    it('should default to true on error', async () => {
      redis.get.mockRejectedValue(new Error('Redis error'));
      
      const enabled = await aiKillSwitchService.isAIEnabled();
      
      expect(enabled).toBe(true);
    });
  });
  
  describe('checkAIKillSwitch middleware', () => {
    let req, res, next;
    
    beforeEach(() => {
      req = {};
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });
    
    it('should call next() when AI is enabled', async () => {
      redis.get.mockResolvedValue(JSON.stringify({
        enabled: true,
        disabled_at: null,
        disabled_by: null,
        reason: null
      }));
      
      await aiKillSwitchService.checkAIKillSwitch(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    it('should return 503 when AI is disabled', async () => {
      const disabledStatus = {
        enabled: false,
        disabled_at: '2026-02-07T12:00:00Z',
        disabled_by: 'superadmin_001',
        reason: 'Security incident'
      };
      
      redis.get.mockResolvedValue(JSON.stringify(disabledStatus));
      
      await aiKillSwitchService.checkAIKillSwitch(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        error: 'AI services are currently disabled',
        disabled_at: disabledStatus.disabled_at,
        disabled_by: disabledStatus.disabled_by,
        reason: disabledStatus.reason,
        fallback: 'System has reverted to deterministic logic only'
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    it('should call next() on error (fail open)', async () => {
      redis.get.mockRejectedValue(new Error('Redis error'));
      
      await aiKillSwitchService.checkAIKillSwitch(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
  
  describe('logKillSwitchEvent', () => {
    it('should log disable event to audit trail', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      
      await aiKillSwitchService.logKillSwitchEvent(
        false,
        'Security incident',
        'superadmin_001',
        mockPool
      );
      
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'AI_GOVERNANCE',
          'superadmin_001',
          'ai_kill_switch',
          'global',
          'AI_KILL_SWITCH_DISABLED',
          expect.stringContaining('Security incident')
        ])
      );
    });
    
    it('should log enable event to audit trail', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      
      await aiKillSwitchService.logKillSwitchEvent(
        true,
        'Issue resolved',
        'superadmin_001',
        mockPool
      );
      
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'AI_GOVERNANCE',
          'superadmin_001',
          'ai_kill_switch',
          'global',
          'AI_KILL_SWITCH_ENABLED'
        ])
      );
    });
    
    it('should not throw on database error', async () => {
      mockClient.query.mockRejectedValue(new Error('Database error'));
      
      await expect(
        aiKillSwitchService.logKillSwitchEvent(
          false,
          'Test',
          'superadmin_001',
          mockPool
        )
      ).resolves.not.toThrow();
    });
  });
  
  describe('notifyAdmins', () => {
    it('should notify all admins when AI is disabled', async () => {
      mockClient.query
        .mockResolvedValueOnce({ // admin users query
          rows: [
            { user_id: 'admin_1', email: 'admin1@test.com', first_name: 'Admin', last_name: 'One' },
            { user_id: 'admin_2', email: 'admin2@test.com', first_name: 'Admin', last_name: 'Two' }
          ]
        })
        .mockResolvedValue({ rows: [] }); // notification inserts
      
      await aiKillSwitchService.notifyAdmins(
        false,
        'Security incident',
        'superadmin_001',
        mockPool
      );
      
      // Should create notification for each admin
      expect(mockClient.query).toHaveBeenCalledTimes(3); // 1 select + 2 inserts
      
      // Check critical priority for disable
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([
          'admin_1',
          expect.any(String),
          expect.stringContaining('disabled'),
          'AI_GOVERNANCE',
          'critical'
        ])
      );
    });
    
    it('should notify all admins when AI is enabled', async () => {
      mockClient.query
        .mockResolvedValueOnce({ // admin users query
          rows: [
            { user_id: 'admin_1', email: 'admin1@test.com', first_name: 'Admin', last_name: 'One' }
          ]
        })
        .mockResolvedValue({ rows: [] }); // notification insert
      
      await aiKillSwitchService.notifyAdmins(
        true,
        'Issue resolved',
        'superadmin_001',
        mockPool
      );
      
      // Check medium priority for enable
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([
          'admin_1',
          expect.any(String),
          expect.stringContaining('enabled'),
          'AI_GOVERNANCE',
          'medium'
        ])
      );
    });
    
    it('should handle case when no admins found', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      
      await expect(
        aiKillSwitchService.notifyAdmins(
          false,
          'Test',
          'superadmin_001',
          mockPool
        )
      ).resolves.not.toThrow();
    });
    
    it('should not throw on database error', async () => {
      mockClient.query.mockRejectedValue(new Error('Database error'));
      
      await expect(
        aiKillSwitchService.notifyAdmins(
          false,
          'Test',
          'superadmin_001',
          mockPool
        )
      ).resolves.not.toThrow();
    });
  });
});
