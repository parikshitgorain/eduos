/**
 * Schema Migration Routes
 * 
 * API endpoints for schema migration with dry-run mode and rollback capabilities.
 * 
 * Task: 2.2.4 - Build schema migration engine with dry-run mode
 * 
 * Endpoints:
 * - POST /api/v1/schemas/migrations/analyze - Analyze migration impact
 * - POST /api/v1/schemas/migrations/dry-run - Run dry-run simulation
 * - POST /api/v1/schemas/migrations/execute - Execute migration
 * - GET /api/v1/schemas/migrations - Get migration history
 * - GET /api/v1/schemas/migrations/:migrationId - Get migration details
 */

const express = require('express');
const router = express.Router();
const migrationService = require('../services/schemaMigrationService');

/**
 * POST /api/v1/schemas/migrations/analyze
 * Analyze migration impact between two schema snapshots
 */
router.post('/analyze', async (req, res) => {
  try {
    const { from_snapshot_id, to_snapshot_id } = req.body;
    const tenantId = req.user.tenant_id;
    
    // Validation
    if (!from_snapshot_id || !to_snapshot_id) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'from_snapshot_id and to_snapshot_id are required'
      });
    }
    
    const impact = await migrationService.analyzeMigrationImpact(
      from_snapshot_id,
      to_snapshot_id,
      tenantId
    );
    
    res.status(200).json({
      success: true,
      impact
    });
  } catch (error) {
    console.error('Error analyzing migration impact:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/schemas/migrations/dry-run
 * Run dry-run migration simulation on sample records
 */
router.post('/dry-run', async (req, res) => {
  try {
    const { from_snapshot_id, to_snapshot_id, sample_size } = req.body;
    const tenantId = req.user.tenant_id;
    
    // Validation
    if (!from_snapshot_id || !to_snapshot_id) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'from_snapshot_id and to_snapshot_id are required'
      });
    }
    
    // Validate sample size
    if (sample_size && (sample_size < 100 || sample_size > 10000)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'sample_size must be between 100 and 10000'
      });
    }
    
    const dryRunReport = await migrationService.runDryRunMigration(
      from_snapshot_id,
      to_snapshot_id,
      tenantId,
      { sampleSize: sample_size }
    );
    
    res.status(200).json({
      success: true,
      dry_run_report: dryRunReport
    });
  } catch (error) {
    console.error('Error running dry-run migration:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/schemas/migrations/execute
 * Execute schema migration with rollback capability
 */
router.post('/execute', async (req, res) => {
  try {
    const { 
      from_snapshot_id, 
      to_snapshot_id, 
      skip_dry_run,
      force_execute,
      tier 
    } = req.body;
    const tenantId = req.user.tenant_id;
    const executedBy = req.user.user_id;
    
    // Validation
    if (!from_snapshot_id || !to_snapshot_id) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'from_snapshot_id and to_snapshot_id are required'
      });
    }
    
    // Check user permissions (admin only)
    if (!req.user.roles.includes('admin') && !req.user.roles.includes('superadmin')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admins can execute schema migrations'
      });
    }
    
    const migrationResult = await migrationService.executeMigration(
      from_snapshot_id,
      to_snapshot_id,
      tenantId,
      executedBy,
      {
        skipDryRun: skip_dry_run || false,
        forceExecute: force_execute || false,
        tier: tier || 'basic'
      }
    );
    
    res.status(200).json({
      success: true,
      migration: migrationResult
    });
  } catch (error) {
    console.error('Error executing migration:', error);
    
    // Check if it's a validation error
    if (error.message.includes('breaking changes') || error.message.includes('forceExecute')) {
      return res.status(400).json({
        error: 'Migration blocked',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'Migration failed',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/schemas/migrations
 * Get migration history with pagination
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { page, limit, status } = req.query;
    
    const options = {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      status
    };
    
    const result = await migrationService.getMigrationHistory(tenantId, options);
    
    res.status(200).json({
      success: true,
      migrations: result.migrations,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error getting migration history:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/schemas/migrations/:migrationId
 * Get migration details including dry-run report
 */
router.get('/:migrationId', async (req, res) => {
  try {
    const { migrationId } = req.params;
    const tenantId = req.user.tenant_id;
    
    const migration = await migrationService.getMigrationDetails(migrationId, tenantId);
    
    if (!migration) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Migration not found'
      });
    }
    
    res.status(200).json({
      success: true,
      migration
    });
  } catch (error) {
    console.error('Error getting migration details:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
