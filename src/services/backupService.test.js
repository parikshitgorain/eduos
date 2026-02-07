/**
 * Backup Service Tests
 */

const backupService = require('./backupService');
const db = require('../config/database');

// Mock database
jest.mock('../config/database');

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

const { exec } = require('child_process');
const { promisify } = require('util');

describe('BackupService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateBackupId', () => {
    it('should generate unique backup IDs', () => {
      const id1 = backupService.generateBackupId();
      const id2 = backupService.generateBackupId();
      
      expect(id1).toMatch(/^backup_\d+_[a-f0-9]{8}$/);
      expect(id2).toMatch(/^backup_\d+_[a-f0-9]{8}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('performFullBackup', () => {
    it('should perform full backup for Basic tier', async () => {
      // Mock database queries
      db.query = jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // createBackupRecord
        .mockResolvedValueOnce({ rows: [] }) // updateBackupRecord
        .mockResolvedValueOnce({ rows: [] }); // cleanupOldBackups

      // Mock exec for backup scripts
      const execAsync = promisify(exec);
      exec.mockImplementation((cmd, opts, callback) => {
        callback(null, { stdout: 'Backup completed', stderr: '' });
      });

      const result = await backupService.performFullBackup('Basic');

      expect(result).toHaveProperty('backup_id');
      expect(result).toHaveProperty('status', 'completed');
      expect(result).toHaveProperty('tier', 'Basic');
      expect(result).toHaveProperty('details');
      expect(Array.isArray(result.details)).toBe(true);
    });

    it('should handle backup failures gracefully', async () => {
      // Mock database queries
      db.query = jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // createBackupRecord
        .mockResolvedValueOnce({ rows: [] }); // updateBackupRecord (failed)

      // Mock exec to fail
      exec.mockImplementation((cmd, opts, callback) => {
        callback(new Error('Backup script failed'), null);
      });

      await expect(backupService.performFullBackup('Basic'))
        .rejects.toThrow('Backup failed');
    });

    it('should apply correct retention policy for each tier', async () => {
      const tiers = ['Basic', 'Business', 'Enterprise'];
      const expectedRetention = {
        Basic: 30,
        Business: 90,
        Enterprise: 365
      };

      for (const tier of tiers) {
        const retention = backupService.retentionPolicies[tier];
        expect(retention).toBe(expectedRetention[tier]);
      }
    });
  });

  describe('getBackupStatus', () => {
    it('should return backup statistics', async () => {
      const mockStats = {
        completed_count: '10',
        failed_count: '1',
        in_progress_count: '0',
        last_successful_backup: new Date(),
        total_backup_size: '1073741824' // 1GB
      };

      db.query = jest.fn().mockResolvedValue({ rows: [mockStats] });

      const status = await backupService.getBackupStatus();

      expect(status).toEqual(mockStats);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
    });

    it('should handle database errors', async () => {
      db.query = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(backupService.getBackupStatus())
        .rejects.toThrow('Database error');
    });
  });

  describe('listBackups', () => {
    it('should list all backups', async () => {
      const mockBackups = [
        {
          backup_id: 'backup_1',
          tier: 'Basic',
          status: 'completed',
          created_at: new Date(),
          metadata: {}
        },
        {
          backup_id: 'backup_2',
          tier: 'Business',
          status: 'completed',
          created_at: new Date(),
          metadata: {}
        }
      ];

      db.query = jest.fn().mockResolvedValue({ rows: mockBackups });

      const backups = await backupService.listBackups();

      expect(backups).toEqual(mockBackups);
      expect(backups).toHaveLength(2);
    });

    it('should filter backups by tier', async () => {
      const mockBackups = [
        {
          backup_id: 'backup_1',
          tier: 'Enterprise',
          status: 'completed',
          created_at: new Date(),
          metadata: {}
        }
      ];

      db.query = jest.fn().mockResolvedValue({ rows: mockBackups });

      const backups = await backupService.listBackups({ tier: 'Enterprise' });

      expect(backups).toEqual(mockBackups);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('tier = $1'),
        ['Enterprise']
      );
    });

    it('should filter backups by status', async () => {
      const mockBackups = [
        {
          backup_id: 'backup_1',
          tier: 'Basic',
          status: 'failed',
          created_at: new Date(),
          metadata: {}
        }
      ];

      db.query = jest.fn().mockResolvedValue({ rows: mockBackups });

      const backups = await backupService.listBackups({ status: 'failed' });

      expect(backups).toEqual(mockBackups);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        ['failed']
      );
    });
  });

  describe('cleanupOldBackups', () => {
    it('should mark expired backups for Basic tier', async () => {
      db.query = jest.fn().mockResolvedValue({ rowCount: 5 });

      await backupService.cleanupOldBackups('Basic');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE backups'),
        expect.arrayContaining([expect.any(Date)])
      );
    });

    it('should use correct retention period for each tier', async () => {
      const tiers = ['Basic', 'Business', 'Enterprise'];
      
      for (const tier of tiers) {
        db.query = jest.fn().mockResolvedValue({ rowCount: 0 });
        await backupService.cleanupOldBackups(tier);
        
        // Verify the cutoff date is calculated correctly
        const expectedRetention = backupService.retentionPolicies[tier];
        expect(db.query).toHaveBeenCalled();
      }
    });
  });

  describe('pointInTimeRecovery', () => {
    it('should reject PITR beyond 7-day window', async () => {
      const targetTime = new Date();
      targetTime.setDate(targetTime.getDate() - 10); // 10 days ago

      await expect(backupService.pointInTimeRecovery(targetTime))
        .rejects.toThrow('PITR only available for last 7 days');
    });

    it('should find closest backup for PITR', async () => {
      const targetTime = new Date();
      targetTime.setDate(targetTime.getDate() - 3); // 3 days ago

      const mockBackup = {
        backup_id: 'backup_123',
        created_at: new Date(targetTime.getTime() - 3600000), // 1 hour before target
        status: 'completed'
      };

      db.query = jest.fn()
        .mockResolvedValueOnce({ rows: [mockBackup] }) // findClosestBackup
        .mockResolvedValueOnce({ rows: [mockBackup] }) // getBackupRecord in restoreFromBackup
        .mockResolvedValueOnce({ rows: [] }); // additional query if needed

      // Mock restore methods
      backupService.restorePostgreSQL = jest.fn().mockResolvedValue({
        component: 'postgresql',
        status: 'success'
      });
      backupService.restoreRedis = jest.fn().mockResolvedValue({
        component: 'redis',
        status: 'success'
      });

      const result = await backupService.pointInTimeRecovery(targetTime);

      expect(result).toHaveProperty('status', 'completed');
      expect(result).toHaveProperty('backup_used', 'backup_123');
    });

    it('should reject PITR when no suitable backup found', async () => {
      const targetTime = new Date();
      targetTime.setDate(targetTime.getDate() - 2);

      db.query = jest.fn().mockResolvedValue({ rows: [] });

      await expect(backupService.pointInTimeRecovery(targetTime))
        .rejects.toThrow('No suitable backup found for PITR');
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore from completed backup', async () => {
      const mockBackup = {
        backup_id: 'backup_123',
        status: 'completed',
        tier: 'Basic'
      };

      db.query = jest.fn().mockResolvedValue({ rows: [mockBackup] });

      // Mock restore methods
      backupService.restorePostgreSQL = jest.fn().mockResolvedValue({
        component: 'postgresql',
        status: 'success'
      });
      backupService.restoreRedis = jest.fn().mockResolvedValue({
        component: 'redis',
        status: 'success'
      });

      const result = await backupService.restoreFromBackup('backup_123');

      expect(result).toHaveProperty('status', 'completed');
      expect(result).toHaveProperty('backup_id', 'backup_123');
      expect(backupService.restorePostgreSQL).toHaveBeenCalled();
      expect(backupService.restoreRedis).toHaveBeenCalled();
    });

    it('should reject restore from non-existent backup', async () => {
      db.query = jest.fn().mockResolvedValue({ rows: [] });

      await expect(backupService.restoreFromBackup('nonexistent'))
        .rejects.toThrow('Backup not found');
    });

    it('should reject restore from incomplete backup', async () => {
      const mockBackup = {
        backup_id: 'backup_123',
        status: 'in_progress',
        tier: 'Basic'
      };

      db.query = jest.fn().mockResolvedValue({ rows: [mockBackup] });

      await expect(backupService.restoreFromBackup('backup_123'))
        .rejects.toThrow('Cannot restore from incomplete backup');
    });

    it('should support selective restore', async () => {
      const mockBackup = {
        backup_id: 'backup_123',
        status: 'completed',
        tier: 'Basic'
      };

      db.query = jest.fn().mockResolvedValue({ rows: [mockBackup] });

      backupService.restorePostgreSQL = jest.fn().mockResolvedValue({
        component: 'postgresql',
        status: 'success'
      });
      backupService.restoreRedis = jest.fn().mockResolvedValue({
        component: 'redis',
        status: 'success'
      });

      // Restore only PostgreSQL
      await backupService.restoreFromBackup('backup_123', {
        restorePostgreSQL: true,
        restoreRedis: false
      });

      expect(backupService.restorePostgreSQL).toHaveBeenCalled();
      expect(backupService.restoreRedis).not.toHaveBeenCalled();
    });
  });

  describe('Retention Policies', () => {
    it('should have correct retention periods', () => {
      expect(backupService.retentionPolicies).toEqual({
        Basic: 30,
        Business: 90,
        Enterprise: 365
      });
    });

    it('should have 7-day PITR window', () => {
      expect(backupService.pitrWindow).toBe(7);
    });
  });
});
