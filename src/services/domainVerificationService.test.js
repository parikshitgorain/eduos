/**
 * Domain Verification Service Tests
 * 
 * Tests for automatic domain verification and SSL provisioning
 * Task: 1.2.2 - Implement domain verification workflow
 */

const {
  verifyDomainDNS,
  verifyAllPendingDomains,
  provisionSSLCertificate,
  renewExpiringSSLCertificates,
  sendVerificationSuccessEmail,
  runBackgroundJob
} = require('./domainVerificationService');

const { query } = require('../config/database');
const dns = require('dns').promises;

// Mock DNS module
jest.mock('dns', () => ({
  promises: {
    resolveTxt: jest.fn()
  }
}));

// Mock database query
jest.mock('../config/database', () => ({
  query: jest.fn()
}));

// Mock domain mapping middleware
jest.mock('../middleware/domainMapping', () => ({
  invalidateCache: jest.fn()
}));

describe('Domain Verification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('verifyDomainDNS', () => {
    it('should verify domain with correct DNS TXT record', async () => {
      const domainId = 'domain-123';
      const verificationToken = 'test-token-123';
      
      // Mock database query to return unverified domain
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          domain_id: domainId,
          domain: 'school.example.com',
          verification_token: verificationToken,
          is_verified: false,
          tenant_id: 'tenant-123'
        }]
      });
      
      // Mock DNS lookup to return matching token
      dns.resolveTxt.mockResolvedValueOnce([
        [verificationToken]
      ]);
      
      // Mock update query
      query.mockResolvedValueOnce({ rowCount: 1 });
      
      const result = await verifyDomainDNS(domainId);
      
      expect(result.success).toBe(true);
      expect(result.domain).toBe('school.example.com');
      expect(result.domainId).toBe(domainId);
      expect(result.tenantId).toBe('tenant-123');
      
      // Verify DNS lookup was called correctly
      expect(dns.resolveTxt).toHaveBeenCalledWith('_eduos-verification.school.example.com');
      
      // Verify domain was marked as verified
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tenant_domains'),
        [domainId]
      );
    });
    
    it('should fail verification with incorrect DNS TXT record', async () => {
      const domainId = 'domain-123';
      const verificationToken = 'test-token-123';
      
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          domain_id: domainId,
          domain: 'school.example.com',
          verification_token: verificationToken,
          is_verified: false,
          tenant_id: 'tenant-123'
        }]
      });
      
      // Mock DNS lookup to return wrong token
      dns.resolveTxt.mockResolvedValueOnce([
        ['wrong-token']
      ]);
      
      const result = await verifyDomainDNS(domainId);
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('DNS TXT record not found or does not match');
      expect(result.expected).toBe(verificationToken);
      expect(result.found).toEqual(['wrong-token']);
    });
    
    it('should fail verification when DNS record not found', async () => {
      const domainId = 'domain-123';
      
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          domain_id: domainId,
          domain: 'school.example.com',
          verification_token: 'test-token-123',
          is_verified: false,
          tenant_id: 'tenant-123'
        }]
      });
      
      // Mock DNS lookup to throw ENOTFOUND error
      const error = new Error('DNS lookup failed');
      error.code = 'ENOTFOUND';
      dns.resolveTxt.mockRejectedValueOnce(error);
      
      const result = await verifyDomainDNS(domainId);
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('DNS TXT record not found');
      expect(result.error).toBe('ENOTFOUND');
    });
    
    it('should return failure for already verified domain', async () => {
      const domainId = 'domain-123';
      
      // Mock database query to return no rows (domain already verified)
      query.mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      });
      
      const result = await verifyDomainDNS(domainId);
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Domain not found or already verified');
    });
  });
  
  describe('verifyAllPendingDomains', () => {
    it('should verify multiple pending domains', async () => {
      // Mock query to return pending domains
      query.mockResolvedValueOnce({
        rowCount: 2,
        rows: [
          { domain_id: 'domain-1', domain: 'school1.example.com', created_at: new Date() },
          { domain_id: 'domain-2', domain: 'school2.example.com', created_at: new Date() }
        ]
      });
      
      // Mock verification for domain-1 (success)
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          domain_id: 'domain-1',
          domain: 'school1.example.com',
          verification_token: 'token-1',
          is_verified: false,
          tenant_id: 'tenant-1'
        }]
      });
      dns.resolveTxt.mockResolvedValueOnce([['token-1']]);
      query.mockResolvedValueOnce({ rowCount: 1 });
      
      // Mock tenant query for email
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ name: 'School 1', subdomain: 'school1' }]
      });
      
      // Mock notification insert
      query.mockResolvedValueOnce({ rowCount: 1 });
      
      // Mock verification for domain-2 (failure)
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          domain_id: 'domain-2',
          domain: 'school2.example.com',
          verification_token: 'token-2',
          is_verified: false,
          tenant_id: 'tenant-2'
        }]
      });
      const error = new Error('DNS lookup failed');
      error.code = 'ENOTFOUND';
      dns.resolveTxt.mockRejectedValueOnce(error);
      
      const result = await verifyAllPendingDomains();
      
      expect(result.total).toBe(2);
      expect(result.verified).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.details).toHaveLength(2);
      expect(result.details[0].status).toBe('verified');
      expect(result.details[1].status).toBe('failed');
    });
    
    it('should handle no pending domains', async () => {
      query.mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      });
      
      const result = await verifyAllPendingDomains();
      
      expect(result.total).toBe(0);
      expect(result.verified).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.details).toHaveLength(0);
    });
  });
  
  describe('provisionSSLCertificate', () => {
    it('should provision SSL certificate for verified domain', async () => {
      const domainId = 'domain-123';
      
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          domain_id: domainId,
          domain: 'school.example.com',
          is_verified: true,
          ssl_status: 'pending'
        }]
      });
      
      query.mockResolvedValueOnce({ rowCount: 1 });
      
      const result = await provisionSSLCertificate(domainId);
      
      expect(result.success).toBe(true);
      expect(result.domain).toBe('school.example.com');
      expect(result.sslStatus).toBe('active');
      expect(result.issuedAt).toBeDefined();
      expect(result.expiresAt).toBeDefined();
      
      // Verify SSL status was updated
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tenant_domains'),
        expect.arrayContaining([expect.any(Date), expect.any(Date), domainId])
      );
    });
    
    it('should fail for unverified domain', async () => {
      const domainId = 'domain-123';
      
      query.mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      });
      
      const result = await provisionSSLCertificate(domainId);
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Domain not found or not verified');
    });
  });
  
  describe('renewExpiringSSLCertificates', () => {
    it('should renew expiring SSL certificates', async () => {
      const expiringDate = new Date();
      expiringDate.setDate(expiringDate.getDate() + 15); // Expires in 15 days
      
      // Mock query to return expiring domains
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          domain_id: 'domain-123',
          domain: 'school.example.com',
          ssl_expires_at: expiringDate
        }]
      });
      
      // Mock SSL provisioning
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          domain_id: 'domain-123',
          domain: 'school.example.com',
          is_verified: true,
          ssl_status: 'active'
        }]
      });
      query.mockResolvedValueOnce({ rowCount: 1 });
      
      const result = await renewExpiringSSLCertificates();
      
      expect(result.total).toBe(1);
      expect(result.renewed).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.details[0].status).toBe('renewed');
    });
    
    it('should handle no expiring certificates', async () => {
      query.mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      });
      
      const result = await renewExpiringSSLCertificates();
      
      expect(result.total).toBe(0);
      expect(result.renewed).toBe(0);
      expect(result.failed).toBe(0);
    });
  });
  
  describe('sendVerificationSuccessEmail', () => {
    it('should send email notification on successful verification', async () => {
      const tenantId = 'tenant-123';
      const domain = 'school.example.com';
      
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          name: 'Test School',
          subdomain: 'testschool'
        }]
      });
      
      query.mockResolvedValueOnce({ rowCount: 1 });
      
      await sendVerificationSuccessEmail(tenantId, domain);
      
      // Verify notification was inserted
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([
          tenantId,
          'domain_verified',
          expect.stringContaining('Domain Verified'),
          expect.any(String),
          'sent'
        ])
      );
    });
    
    it('should handle tenant not found gracefully', async () => {
      const tenantId = 'tenant-123';
      const domain = 'school.example.com';
      
      query.mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      });
      
      // Should not throw error
      await expect(sendVerificationSuccessEmail(tenantId, domain)).resolves.not.toThrow();
    });
  });
  
  describe('runBackgroundJob', () => {
    it('should run both verification and SSL renewal', async () => {
      // Mock verifyAllPendingDomains
      query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      
      // Mock renewExpiringSSLCertificates
      query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      
      const result = await runBackgroundJob({
        verifyDomains: true,
        renewSSL: true
      });
      
      expect(result.timestamp).toBeDefined();
      expect(result.verification).toBeDefined();
      expect(result.sslRenewal).toBeDefined();
      expect(result.verification.total).toBe(0);
      expect(result.sslRenewal.total).toBe(0);
    });
    
    it('should run only verification when renewSSL is false', async () => {
      query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      
      const result = await runBackgroundJob({
        verifyDomains: true,
        renewSSL: false
      });
      
      expect(result.verification).toBeDefined();
      expect(result.sslRenewal).toBeNull();
    });
    
    it('should run only SSL renewal when verifyDomains is false', async () => {
      query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      
      const result = await runBackgroundJob({
        verifyDomains: false,
        renewSSL: true
      });
      
      expect(result.verification).toBeNull();
      expect(result.sslRenewal).toBeDefined();
    });
  });
});
