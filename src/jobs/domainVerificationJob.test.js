/**
 * Domain Verification Job Tests
 * 
 * Tests for background job scheduler
 * Task: 1.2.2 - Implement domain verification workflow
 */

const {
  startJob,
  stopJob,
  getJobStatus,
  triggerJob,
  executeJob
} = require('./domainVerificationJob');

const { runBackgroundJob } = require('../services/domainVerificationService');

// Mock the domain verification service
jest.mock('../services/domainVerificationService', () => ({
  runBackgroundJob: jest.fn()
}));

// Import fresh module for each test suite
let domainVerificationJob;

describe('Domain Verification Job', () => {
  beforeAll(() => {
    // Load module once
    domainVerificationJob = require('./domainVerificationJob');
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Ensure job is stopped before each test
    const { stopJob } = require('./domainVerificationJob');
    stopJob();
  });
  
  afterEach(() => {
    // Clean up after each test
    const { stopJob } = require('./domainVerificationJob');
    stopJob();
  });
  
  describe('executeJob', () => {
    it('should execute job successfully', async () => {
      const mockResult = {
        timestamp: new Date().toISOString(),
        verification: {
          total: 2,
          verified: 1,
          failed: 1
        },
        sslRenewal: {
          total: 1,
          renewed: 1,
          failed: 0
        }
      };
      
      runBackgroundJob.mockResolvedValueOnce(mockResult);
      
      const result = await executeJob();
      
      expect(result.success).toBe(true);
      expect(result.verification).toEqual(mockResult.verification);
      expect(result.sslRenewal).toEqual(mockResult.sslRenewal);
      expect(result.duration).toBeDefined();
      
      expect(runBackgroundJob).toHaveBeenCalledWith({
        verifyDomains: true,
        renewSSL: true
      });
    });
    
    it('should handle job execution errors', async () => {
      const mockError = new Error('Job execution failed');
      runBackgroundJob.mockRejectedValueOnce(mockError);
      
      const result = await executeJob();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Job execution failed');
      expect(result.duration).toBeDefined();
    });
    
    it('should skip execution if job is already running', async () => {
      // Start a long-running job
      runBackgroundJob.mockImplementationOnce(() => {
        return new Promise(resolve => setTimeout(resolve, 1000));
      });
      
      // Start first execution (don't await)
      const firstExecution = executeJob();
      
      // Try to start second execution immediately
      const secondExecution = await executeJob();
      
      expect(secondExecution.skipped).toBe(true);
      expect(secondExecution.reason).toBe('Job already running');
      
      // Wait for first execution to complete
      await firstExecution;
    });
  });
  
  describe('getJobStatus', () => {
    it('should return job status with execution history', async () => {
      // Execute job first to create history
      runBackgroundJob.mockResolvedValueOnce({
        timestamp: new Date().toISOString(),
        verification: { total: 0, verified: 0, failed: 0 },
        sslRenewal: { total: 0, renewed: 0, failed: 0 }
      });
      
      await executeJob();
      
      const status = getJobStatus();
      
      expect(status.name).toBe('domain-verification-job');
      expect(status.running).toBe(false);
      expect(status.isExecuting).toBe(false);
      expect(status.intervalMs).toBe(15 * 60 * 1000);
      expect(status.lastRunTime).not.toBeNull();
      expect(status.lastRunResult).toBeDefined();
      expect(status.lastRunResult.success).toBe(true);
    });
    
    it('should return basic status information', () => {
      const status = getJobStatus();
      
      expect(status.name).toBe('domain-verification-job');
      expect(status.running).toBe(false);
      expect(status.isExecuting).toBe(false);
      expect(status.intervalMs).toBe(15 * 60 * 1000);
      // lastRunTime may or may not be null depending on previous tests
      // Just verify the field exists
      expect(status).toHaveProperty('lastRunTime');
      expect(status).toHaveProperty('nextRunTime');
    });
  });
  
  describe('triggerJob', () => {
    it('should manually trigger job execution', async () => {
      runBackgroundJob.mockResolvedValueOnce({
        timestamp: new Date().toISOString(),
        verification: { total: 1, verified: 1, failed: 0 },
        sslRenewal: { total: 0, renewed: 0, failed: 0 }
      });
      
      const result = await triggerJob();
      
      expect(result.success).toBe(true);
      expect(result.verification.verified).toBe(1);
      expect(runBackgroundJob).toHaveBeenCalled();
    });
  });
  
  describe('Job lifecycle', () => {
    it('should start and stop job', () => {
      // Reset environment variable
      delete process.env.DOMAIN_VERIFICATION_JOB_ENABLED;
      
      startJob();
      let status = getJobStatus();
      expect(status.running).toBe(true);
      
      stopJob();
      status = getJobStatus();
      expect(status.running).toBe(false);
    });
    
    it('should not start job if already running', () => {
      delete process.env.DOMAIN_VERIFICATION_JOB_ENABLED;
      
      startJob();
      const firstStatus = getJobStatus();
      
      // Try to start again
      startJob();
      const secondStatus = getJobStatus();
      
      expect(firstStatus.running).toBe(true);
      expect(secondStatus.running).toBe(true);
      
      stopJob();
    });
    
    it('should not start job if disabled', () => {
      // Set environment variable to disable job
      process.env.DOMAIN_VERIFICATION_JOB_ENABLED = 'false';
      
      // Reload module to pick up new env var
      jest.resetModules();
      const { startJob: startJobReloaded, getJobStatus: getJobStatusReloaded } = require('./domainVerificationJob');
      
      startJobReloaded();
      const status = getJobStatusReloaded();
      
      expect(status.running).toBe(false);
      
      // Clean up
      delete process.env.DOMAIN_VERIFICATION_JOB_ENABLED;
    });
  });
});
