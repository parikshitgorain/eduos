/**
 * IP Access Control Routes Tests
 * 
 * Task: 4.3.1 - Implement rate limiting and DDoS protection
 */

const request = require('supertest');
const express = require('express');
const ipAccessControlRoutes = require('./ipAccessControl');

// Mock the rate limiter module
jest.mock('../middleware/rateLimiter', () => {
  const mockIPAccessControl = {
    getBlacklist: jest.fn().mockResolvedValue(['1.2.3.4', '5.6.7.8']),
    getWhitelist: jest.fn().mockResolvedValue(['9.10.11.12']),
    addToBlacklist: jest.fn().mockResolvedValue(true),
    removeFromBlacklist: jest.fn().mockResolvedValue(true),
    addToWhitelist: jest.fn().mockResolvedValue(true),
    removeFromWhitelist: jest.fn().mockResolvedValue(true),
    isBlacklisted: jest.fn().mockResolvedValue(false),
    isWhitelisted: jest.fn().mockResolvedValue(false)
  };

  return {
    ipAccessControl: mockIPAccessControl
  };
});

describe('IP Access Control Routes', () => {
  let app;
  const { ipAccessControl } = require('../middleware/rateLimiter');

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/ip-access-control', ipAccessControlRoutes);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('GET /api/v1/ip-access-control/blacklist', () => {
    it('should return list of blacklisted IPs', async () => {
      const response = await request(app)
        .get('/api/v1/ip-access-control/blacklist');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.ips).toEqual(['1.2.3.4', '5.6.7.8']);
      expect(ipAccessControl.getBlacklist).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      ipAccessControl.getBlacklist.mockRejectedValueOnce(new Error('Redis error'));

      const response = await request(app)
        .get('/api/v1/ip-access-control/blacklist');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal Server Error');
    });
  });

  describe('GET /api/v1/ip-access-control/whitelist', () => {
    it('should return list of whitelisted IPs', async () => {
      const response = await request(app)
        .get('/api/v1/ip-access-control/whitelist');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.ips).toEqual(['9.10.11.12']);
      expect(ipAccessControl.getWhitelist).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      ipAccessControl.getWhitelist.mockRejectedValueOnce(new Error('Redis error'));

      const response = await request(app)
        .get('/api/v1/ip-access-control/whitelist');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal Server Error');
    });
  });

  describe('POST /api/v1/ip-access-control/blacklist', () => {
    it('should add IP to blacklist', async () => {
      const response = await request(app)
        .post('/api/v1/ip-access-control/blacklist')
        .send({ ip: '1.2.3.4' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('added to blacklist');
      expect(response.body.ip).toBe('1.2.3.4');
      expect(ipAccessControl.addToBlacklist).toHaveBeenCalledWith('1.2.3.4', undefined);
    });

    it('should add IP to blacklist with TTL', async () => {
      const response = await request(app)
        .post('/api/v1/ip-access-control/blacklist')
        .send({ ip: '1.2.3.4', ttl: 3600 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.ttl).toBe(3600);
      expect(ipAccessControl.addToBlacklist).toHaveBeenCalledWith('1.2.3.4', 3600);
    });

    it('should reject request without IP', async () => {
      const response = await request(app)
        .post('/api/v1/ip-access-control/blacklist')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('IP address is required');
    });

    it('should reject invalid IP format', async () => {
      const response = await request(app)
        .post('/api/v1/ip-access-control/blacklist')
        .send({ ip: 'invalid-ip' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('Invalid IP address format');
    });

    it('should handle errors gracefully', async () => {
      ipAccessControl.addToBlacklist.mockRejectedValueOnce(new Error('Redis error'));

      const response = await request(app)
        .post('/api/v1/ip-access-control/blacklist')
        .send({ ip: '1.2.3.4' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal Server Error');
    });
  });

  describe('DELETE /api/v1/ip-access-control/blacklist/:ip', () => {
    it('should remove IP from blacklist', async () => {
      const response = await request(app)
        .delete('/api/v1/ip-access-control/blacklist/1.2.3.4');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('removed from blacklist');
      expect(response.body.ip).toBe('1.2.3.4');
      expect(ipAccessControl.removeFromBlacklist).toHaveBeenCalledWith('1.2.3.4');
    });

    it('should handle errors gracefully', async () => {
      ipAccessControl.removeFromBlacklist.mockRejectedValueOnce(new Error('Redis error'));

      const response = await request(app)
        .delete('/api/v1/ip-access-control/blacklist/1.2.3.4');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal Server Error');
    });
  });

  describe('POST /api/v1/ip-access-control/whitelist', () => {
    it('should add IP to whitelist', async () => {
      const response = await request(app)
        .post('/api/v1/ip-access-control/whitelist')
        .send({ ip: '1.2.3.4' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('added to whitelist');
      expect(response.body.ip).toBe('1.2.3.4');
      expect(ipAccessControl.addToWhitelist).toHaveBeenCalledWith('1.2.3.4');
    });

    it('should reject request without IP', async () => {
      const response = await request(app)
        .post('/api/v1/ip-access-control/whitelist')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('IP address is required');
    });

    it('should reject invalid IP format', async () => {
      const response = await request(app)
        .post('/api/v1/ip-access-control/whitelist')
        .send({ ip: 'invalid-ip' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('Invalid IP address format');
    });

    it('should handle errors gracefully', async () => {
      ipAccessControl.addToWhitelist.mockRejectedValueOnce(new Error('Redis error'));

      const response = await request(app)
        .post('/api/v1/ip-access-control/whitelist')
        .send({ ip: '1.2.3.4' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal Server Error');
    });
  });

  describe('DELETE /api/v1/ip-access-control/whitelist/:ip', () => {
    it('should remove IP from whitelist', async () => {
      const response = await request(app)
        .delete('/api/v1/ip-access-control/whitelist/1.2.3.4');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('removed from whitelist');
      expect(response.body.ip).toBe('1.2.3.4');
      expect(ipAccessControl.removeFromWhitelist).toHaveBeenCalledWith('1.2.3.4');
    });

    it('should handle errors gracefully', async () => {
      ipAccessControl.removeFromWhitelist.mockRejectedValueOnce(new Error('Redis error'));

      const response = await request(app)
        .delete('/api/v1/ip-access-control/whitelist/1.2.3.4');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal Server Error');
    });
  });

  describe('GET /api/v1/ip-access-control/check/:ip', () => {
    it('should check IP status - normal', async () => {
      ipAccessControl.isBlacklisted.mockResolvedValueOnce(false);
      ipAccessControl.isWhitelisted.mockResolvedValueOnce(false);

      const response = await request(app)
        .get('/api/v1/ip-access-control/check/1.2.3.4');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.ip).toBe('1.2.3.4');
      expect(response.body.blacklisted).toBe(false);
      expect(response.body.whitelisted).toBe(false);
      expect(response.body.status).toBe('normal');
    });

    it('should check IP status - blacklisted', async () => {
      ipAccessControl.isBlacklisted.mockResolvedValueOnce(true);
      ipAccessControl.isWhitelisted.mockResolvedValueOnce(false);

      const response = await request(app)
        .get('/api/v1/ip-access-control/check/1.2.3.4');

      expect(response.status).toBe(200);
      expect(response.body.blacklisted).toBe(true);
      expect(response.body.status).toBe('blocked');
    });

    it('should check IP status - whitelisted', async () => {
      ipAccessControl.isBlacklisted.mockResolvedValueOnce(false);
      ipAccessControl.isWhitelisted.mockResolvedValueOnce(true);

      const response = await request(app)
        .get('/api/v1/ip-access-control/check/1.2.3.4');

      expect(response.status).toBe(200);
      expect(response.body.whitelisted).toBe(true);
      expect(response.body.status).toBe('allowed');
    });

    it('should handle errors gracefully', async () => {
      ipAccessControl.isBlacklisted.mockRejectedValueOnce(new Error('Redis error'));

      const response = await request(app)
        .get('/api/v1/ip-access-control/check/1.2.3.4');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal Server Error');
    });
  });
});
