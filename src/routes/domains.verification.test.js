/**
 * Domain Verification API Integration Tests
 * 
 * Tests for domain verification workflow endpoints
 * Task: 1.2.2 - Implement domain verification workflow
 */

const request = require('supertest');
const app = require('../server');
const { query } = require('../config/database');

// Mock database
jest.mock('../config/database');

// Mock domain verification service
jest.mock('../services/domainVerificationService', () => ({
  provisionSSLCertificate: jest.fn(),
  runBackgroundJob: jest.fn()
}));

// Mock background job
jest.mock('../jobs/domainVerificationJob', () => ({
  getJobStatus: jest.fn(),
  triggerJob: jest.fn()
}));

const { provisionSSLCertificate } = require('../services/domainVerificationService');
const { getJobStatus, triggerJob } = require('../jobs/domainVerificationJob');

describe('Domain Verification API', () => {
  const mockTenant = {
    tenant_id: 'tenant-123',
    name: 'Test School',
    subdomain: 'testschool',
    tier: 'business',
    status: 'active'
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock tenant context middleware
    query.mockImplementation((text, params) => {
      if (text.includes('SELECT * FROM tenants WHERE tenant_id')) {
        return Promise.resolve({
          rowCount: 1,
          rows: [mockTenant]
        });
      }
      return Promise.resolve({ rowCount: 0, rows: [] });
    });
  });
  
  describe('POST /api/v1/domains/:domainId/provision-ssl', () => {
    it('should provision SSL certificate successfully', async () => {
      const domainId = 'domain-123';
      
      // Mock tenant lookup
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [mockTenant]
      });
      
      // Mock SSL provisioning
      provisionSSLCertificate.mockResolvedValueOnce({
        success: true,
        domain: 'school.example.com',
        sslStatus: 'active',
        issuedAt: '2026-02-05T10:00:00Z',
        expiresAt: '2026-05-06T10:00:00Z'
      });
      
      const response = await request(app)
        .post(`/api/v1/domains/${domainId}/provision-ssl`)
        .set('Authorization', 'Bearer mock-token')
        .set('X-Tenant-ID', mockTenant.tenant_id);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('SSL certificate provisioned successfully');
      expect(response.body.domain).toBe('school.example.com');
      expect(response.body.ssl_status).toBe('active');
      expect(response.body.issued_at).toBeDefined();
      expect(response.body.expires_at).toBeDefined();
      
      expect(provisionSSLCertificate).toHaveBeenCalledWith(domainId);
    });
    
    it('should return 400 when SSL provisioning fails', async () => {
      const domainId = 'domain-123';
      
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [mockTenant]
      });
      
      provisionSSLCertificate.mockResolvedValueOnce({
        success: false,
        reason: 'Domain not verified'
      });
      
      const response = await request(app)
        .post(`/api/v1/domains/${domainId}/provision-ssl`)
        .set('Authorization', 'Bearer mock-token')
        .set('X-Tenant-ID', mockTenant.tenant_id);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('SSL Provisioning Failed');
      expect(response.body.message).toBe('Domain not verified');
    });
    
    it('should return 500 when SSL provisioning throws error', async () => {
      const domainId = 'domain-123';
      
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [mockTenant]
      });
      
      provisionSSLCertificate.mockRejectedValueOnce(new Error('SSL service unavailable'));
      
      const response = await request(app)
        .post(`/api/v1/domains/${domainId}/provision-ssl`)
        .set('Authorization', 'Bearer mock-token')
        .set('X-Tenant-ID', mockTenant.tenant_id);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal Server Error');
    });
  });
  
  describe('GET /api/v1/domains/jobs/status', () => {
    it('should return job status', async () => {
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [mockTenant]
      });
      
      const mockJobStatus = {
        name: 'domain-verification-job',
        enabled: true,
        running: true,
        isExecuting: false,
        intervalMs: 900000,
        lastRunTime: '2026-02-05T10:00:00Z',
        lastRunResult: {
          success: true,
          verification: { total: 2, verified: 1, failed: 1 },
          sslRenewal: { total: 1, renewed: 1, failed: 0 }
        },
        nextRunTime: '2026-02-05T10:15:00Z'
      };
      
      getJobStatus.mockReturnValueOnce(mockJobStatus);
      
      const response = await request(app)
        .get('/api/v1/domains/jobs/status')
        .set('Authorization', 'Bearer mock-token')
        .set('X-Tenant-ID', mockTenant.tenant_id);
      
      expect(response.status).toBe(200);
      expect(response.body.job_status).toEqual(mockJobStatus);
      expect(response.body.timestamp).toBeDefined();
      
      expect(getJobStatus).toHaveBeenCalled();
    });
  });
  
  describe('POST /api/v1/domains/jobs/trigger', () => {
    it('should manually trigger background job', async () => {
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [mockTenant]
      });
      
      const mockJobResult = {
        success: true,
        duration: 1234,
        verification: { total: 1, verified: 1, failed: 0 },
        sslRenewal: { total: 0, renewed: 0, failed: 0 }
      };
      
      triggerJob.mockResolvedValueOnce(mockJobResult);
      
      const response = await request(app)
        .post('/api/v1/domains/jobs/trigger')
        .set('Authorization', 'Bearer mock-token')
        .set('X-Tenant-ID', mockTenant.tenant_id);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Background job triggered successfully');
      expect(response.body.result).toEqual(mockJobResult);
      expect(response.body.timestamp).toBeDefined();
      
      expect(triggerJob).toHaveBeenCalled();
    });
    
    it('should return 500 when job trigger fails', async () => {
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [mockTenant]
      });
      
      triggerJob.mockRejectedValueOnce(new Error('Job execution failed'));
      
      const response = await request(app)
        .post('/api/v1/domains/jobs/trigger')
        .set('Authorization', 'Bearer mock-token')
        .set('X-Tenant-ID', mockTenant.tenant_id);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal Server Error');
      expect(response.body.message).toBe('Failed to trigger background job');
    });
  });
});
