/**
 * Webhook Retry Job Tests
 */

const { runWebhookRetryJob, handleJobResult, handleFatalError } = require('./webhookRetryJob');

// Mock webhook retry service
jest.mock('../services/webhookRetryService', () => ({
  processRetries: jest.fn(),
  getRetryStatistics: jest.fn(),
}));

const webhookRetryService = require('../services/webhookRetryService');

describe('WebhookRetryJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear console mocks
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  describe('runWebhookRetryJob', () => {
    it('should successfully process webhook retries', async () => {
      const mockSummary = {
        total: 5,
        successful: 4,
        failed: 1,
      };

      const mockStats = {
        pending_retries: 3,
        max_retries_exceeded: 1,
        successful_retries: 10,
        avg_retries_to_success: 2.5,
      };

      webhookRetryService.processRetries.mockResolvedValue(mockSummary);
      webhookRetryService.getRetryStatistics.mockResolvedValue(mockStats);

      const result = await runWebhookRetryJob();

      expect(result.success).toBe(true);
      expect(result.summary).toEqual(mockSummary);
      expect(result.stats).toEqual(mockStats);
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
      expect(webhookRetryService.processRetries).toHaveBeenCalled();
      expect(webhookRetryService.getRetryStatistics).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('[WebhookRetryJob] Starting webhook retry job...');
      expect(console.log).toHaveBeenCalledWith('[WebhookRetryJob] Job completed in', expect.any(Number), 'ms');
      expect(console.log).toHaveBeenCalledWith('[WebhookRetryJob] Summary:', mockSummary);
      expect(console.log).toHaveBeenCalledWith('[WebhookRetryJob] Statistics:', mockStats);
    });

    it('should handle job failure', async () => {
      const error = new Error('Database connection failed');
      webhookRetryService.processRetries.mockRejectedValue(error);

      const result = await runWebhookRetryJob();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(console.error).toHaveBeenCalledWith('[WebhookRetryJob] Job failed:', error);
    });

    it('should handle empty retry queue', async () => {
      const mockSummary = {
        total: 0,
        successful: 0,
        failed: 0,
      };

      const mockStats = {
        pending_retries: 0,
        max_retries_exceeded: 0,
        successful_retries: 0,
        avg_retries_to_success: 0,
      };

      webhookRetryService.processRetries.mockResolvedValue(mockSummary);
      webhookRetryService.getRetryStatistics.mockResolvedValue(mockStats);

      const result = await runWebhookRetryJob();

      expect(result.success).toBe(true);
      expect(result.summary.total).toBe(0);
    });

    it('should measure execution duration', async () => {
      const mockSummary = { total: 1, successful: 1, failed: 0 };
      const mockStats = { pending_retries: 0 };

      webhookRetryService.processRetries.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(mockSummary), 100);
        });
      });
      webhookRetryService.getRetryStatistics.mockResolvedValue(mockStats);

      const result = await runWebhookRetryJob();

      expect(result.success).toBe(true);
      expect(result.duration_ms).toBeGreaterThanOrEqual(100);
    });

    it('should handle processRetries throwing an error', async () => {
      const error = new Error('Network timeout');
      webhookRetryService.processRetries.mockRejectedValue(error);

      const result = await runWebhookRetryJob();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
      expect(result.summary).toBeUndefined();
      expect(result.stats).toBeUndefined();
    });

    it('should handle getRetryStatistics throwing an error', async () => {
      const mockSummary = { total: 1, successful: 1, failed: 0 };
      const error = new Error('Stats query failed');
      
      webhookRetryService.processRetries.mockResolvedValue(mockSummary);
      webhookRetryService.getRetryStatistics.mockRejectedValue(error);

      const result = await runWebhookRetryJob();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Stats query failed');
    });

    it('should log all stages of execution', async () => {
      const mockSummary = { total: 2, successful: 2, failed: 0 };
      const mockStats = { pending_retries: 1 };

      webhookRetryService.processRetries.mockResolvedValue(mockSummary);
      webhookRetryService.getRetryStatistics.mockResolvedValue(mockStats);

      await runWebhookRetryJob();

      // Verify all log calls
      expect(console.log).toHaveBeenCalledTimes(4);
      expect(console.log).toHaveBeenNthCalledWith(1, '[WebhookRetryJob] Starting webhook retry job...');
      expect(console.log).toHaveBeenNthCalledWith(2, '[WebhookRetryJob] Job completed in', expect.any(Number), 'ms');
      expect(console.log).toHaveBeenNthCalledWith(3, '[WebhookRetryJob] Summary:', mockSummary);
      expect(console.log).toHaveBeenNthCalledWith(4, '[WebhookRetryJob] Statistics:', mockStats);
    });

    it('should return all required fields on success', async () => {
      const mockSummary = { total: 3, successful: 2, failed: 1 };
      const mockStats = { pending_retries: 5 };

      webhookRetryService.processRetries.mockResolvedValue(mockSummary);
      webhookRetryService.getRetryStatistics.mockResolvedValue(mockStats);

      const result = await runWebhookRetryJob();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('duration_ms');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('stats');
      expect(result.success).toBe(true);
      expect(typeof result.duration_ms).toBe('number');
    });

    it('should return only success and error fields on failure', async () => {
      webhookRetryService.processRetries.mockRejectedValue(new Error('Test error'));

      const result = await runWebhookRetryJob();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
      expect(result.duration_ms).toBeUndefined();
      expect(result.summary).toBeUndefined();
      expect(result.stats).toBeUndefined();
    });
  });

  describe('handleJobResult', () => {
    it('should return exit code 0 for successful job', () => {
      const result = { success: true, summary: {}, stats: {} };
      
      const exitCode = handleJobResult(result);
      
      expect(exitCode).toBe(0);
      expect(console.log).toHaveBeenCalledWith('[WebhookRetryJob] Result:', result);
    });

    it('should return exit code 1 for failed job', () => {
      const result = { success: false, error: 'Test error' };
      
      const exitCode = handleJobResult(result);
      
      expect(exitCode).toBe(1);
      expect(console.log).toHaveBeenCalledWith('[WebhookRetryJob] Result:', result);
    });

    it('should log the result before returning exit code', () => {
      const result = { success: true, summary: { total: 5 } };
      
      handleJobResult(result);
      
      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith('[WebhookRetryJob] Result:', result);
    });
  });

  describe('handleFatalError', () => {
    it('should return exit code 1 for fatal errors', () => {
      const error = new Error('Fatal error');
      
      const exitCode = handleFatalError(error);
      
      expect(exitCode).toBe(1);
      expect(console.error).toHaveBeenCalledWith('[WebhookRetryJob] Fatal error:', error);
    });

    it('should log the error before returning exit code', () => {
      const error = new Error('Database crashed');
      
      handleFatalError(error);
      
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith('[WebhookRetryJob] Fatal error:', error);
    });

    it('should handle different error types', () => {
      const stringError = 'String error';
      const objectError = { message: 'Object error' };
      
      expect(handleFatalError(stringError)).toBe(1);
      expect(handleFatalError(objectError)).toBe(1);
      
      expect(console.error).toHaveBeenCalledTimes(2);
    });
  });
});
