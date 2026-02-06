/**
 * Schema Integrity Check Job Tests
 * Task: 2.2.2 - Implement immutable schema snapshots with SHA-256 hashing
 */

const schemaIntegrityCheckJob = require('./schemaIntegrityCheckJob');

// Mock dependencies
jest.mock('../config/database', () => ({
  query: jest.fn()
}));

jest.mock('../services/schemaService', () => ({
  verifySchemaIntegritySystem: jest.fn()
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn(),
  destroy: jest.fn()
}));

const { query } = require('../config/database');
const schemaService = require('../services/schemaService');
const cron = require('node-cron');

describe('Schema Integrity Check Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('runIntegrityCheck', () => {
    it('should run integrity check successfully', async () => {
      const mockSnapshots = [{ snapshot_id: 'snap-1' }];

      query
        .mockResolvedValueOnce({ rows: mockSnapshots })
        .mockResolvedValueOnce({ rows: [{ check_id: 'check-123' }] })
        .mockResolvedValueOnce({ rows: [] });

      schemaService.verifySchemaIntegritySystem.mockResolvedValue({ is_valid: true });

      const result = await schemaIntegrityCheckJob.runIntegrityCheck();

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.total_checked).toBe(1);
      expect(result.failed_count).toBe(0);
    });

    it('should handle integrity violations', async () => {
      const mockSnapshots = [{ snapshot_id: 'snap-1' }];

      query
        .mockResolvedValueOnce({ rows: mockSnapshots })
        .mockResolvedValueOnce({ rows: [{ check_id: 'check-123' }] })
        .mockResolvedValueOnce({ rows: [] });

      schemaService.verifySchemaIntegritySystem.mockResolvedValue({ is_valid: false });

      const result = await schemaIntegrityCheckJob.runIntegrityCheck();

      expect(result.success).toBe(false);
      expect(result.failed_count).toBe(1);
    });

    it('should handle empty snapshot list', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ check_id: 'check-123' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await schemaIntegrityCheckJob.runIntegrityCheck();

      expect(result.success).toBe(true);
      expect(result.total_checked).toBe(0);
    });

    it('should handle database errors', async () => {
      query.mockRejectedValueOnce(new Error('Database error'));

      await expect(schemaIntegrityCheckJob.runIntegrityCheck()).rejects.toThrow('Database error');
    });
  });

  describe('verifySnapshotIntegrity', () => {
    it('should verify snapshot integrity', async () => {
      schemaService.verifySchemaIntegritySystem.mockResolvedValue({ is_valid: true });

      const result = await schemaIntegrityCheckJob.verifySnapshotIntegrity('snap-1');

      expect(result.is_valid).toBe(true);
      expect(schemaService.verifySchemaIntegritySystem).toHaveBeenCalledWith('snap-1');
    });
  });

  describe('getIntegrityCheckHistory', () => {
    it('should return check history', async () => {
      const mockHistory = [{ check_id: 'check-1' }];
      query.mockResolvedValue({ rows: mockHistory });

      const result = await schemaIntegrityCheckJob.getIntegrityCheckHistory();

      expect(result).toEqual(mockHistory);
    });
  });

  describe('getLatestIntegrityCheck', () => {
    it('should return latest check', async () => {
      const mockCheck = { check_id: 'latest' };
      query.mockResolvedValue({ rows: [mockCheck] });

      const result = await schemaIntegrityCheckJob.getLatestIntegrityCheck();

      expect(result).toEqual(mockCheck);
    });

    it('should return null when no checks found', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await schemaIntegrityCheckJob.getLatestIntegrityCheck();

      expect(result).toBeNull();
    });
  });

  describe('Job Scheduling', () => {
    it('should schedule nightly check', () => {
      const mockTask = { stop: jest.fn() };
      cron.schedule.mockReturnValue(mockTask);

      const result = schemaIntegrityCheckJob.scheduleNightlyCheck();

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 2 * * *',
        expect.any(Function),
        expect.objectContaining({ scheduled: true })
      );
      expect(result).toBe(mockTask);
    });

    it('should start job', () => {
      const mockTask = { stop: jest.fn() };
      cron.schedule.mockReturnValue(mockTask);

      const result = schemaIntegrityCheckJob.startIntegrityCheckJob();

      expect(result).toBeDefined();
    });

    it('should stop job', () => {
      const mockTask = { stop: jest.fn() };
      
      schemaIntegrityCheckJob.stopIntegrityCheckJob(mockTask);

      expect(mockTask.stop).toHaveBeenCalled();
    });
  });

  describe('sendIntegrityAlert', () => {
    it('should send alert with proper data', async () => {
      const alertData = { 
        failed_count: 2,
        failed_snapshots: ['snap-1', 'snap-2'],
        check_id: 'check-123',
        total_checked: 5
      };

      await schemaIntegrityCheckJob.sendIntegrityAlert(alertData);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Sending alert')
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('snap-1, snap-2')
      );
    });
  });
});
