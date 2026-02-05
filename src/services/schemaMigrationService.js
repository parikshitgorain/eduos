/**
 * Schema Migration Service
 * 
 * Business logic for schema migrations with dry-run mode and rollback capabilities.
 * 
 * Task: 2.2.4 - Build schema migration engine with dry-run mode
 * 
 * Features:
 * - Dry-run API simulates migration on sample records (1K-10K)
 * - Migration report: fields affected, validation failures, impact estimate
 * - Auto-rollback on failure (within SLA: 30s Enterprise, 5min Business, 15min Basic)
 * - Migration audit log with before/after snapshots
 * - UI: migration wizard with step-by-step guidance
 */

const { query, transaction } = require('../config/database');
const schemaService = require('./schemaService');

/**
 * Tenant tier SLA for rollback timeouts (in milliseconds)
 */
const ROLLBACK_SLA = {
  enterprise: 30 * 1000,    // 30 seconds
  business: 5 * 60 * 1000,  // 5 minutes
  basic: 15 * 60 * 1000     // 15 minutes
};

/**
 * Analyze migration impact between two schema snapshots
 */
async function analyzeMigrationImpact(fromSnapshotId, toSnapshotId, tenantId) {
  // Get both schemas
  const fromSchema = await schemaService.getSchemaSnapshotById(fromSnapshotId, tenantId);
  const toSchema = await schemaService.getSchemaSnapshotById(toSnapshotId, tenantId);
  
  if (!fromSchema || !toSchema) {
    throw new Error('One or both schema snapshots not found');
  }
  
  if (fromSchema.form_type !== toSchema.form_type) {
    throw new Error('Cannot migrate between different form types');
  }
  
  // Build field maps for comparison
  const fromFields = new Map(fromSchema.fields.map(f => [f.field_name, f]));
  const toFields = new Map(toSchema.fields.map(f => [f.field_name, f]));
  
  const impact = {
    form_type: fromSchema.form_type,
    from_version: fromSchema.semantic_version,
    to_version: toSchema.semantic_version,
    fields_added: [],
    fields_removed: [],
    fields_modified: [],
    fields_unchanged: [],
    breaking_changes: [],
    warnings: []
  };
  
  // Identify added fields
  for (const [fieldName, field] of toFields) {
    if (!fromFields.has(fieldName)) {
      impact.fields_added.push({
        field_name: fieldName,
        field_type: field.field_type,
        is_required: field.is_required
      });
      
      // Warning if new required field
      if (field.is_required && !field.default_value) {
        impact.warnings.push({
          type: 'new_required_field',
          field_name: fieldName,
          message: `New required field '${fieldName}' has no default value. Existing records will need manual data entry.`
        });
      }
    }
  }
  
  // Identify removed and modified fields
  for (const [fieldName, oldField] of fromFields) {
    if (!toFields.has(fieldName)) {
      impact.fields_removed.push({
        field_name: fieldName,
        field_type: oldField.field_type
      });
      
      impact.breaking_changes.push({
        type: 'field_removed',
        field_name: fieldName,
        message: `Field '${fieldName}' will be removed. Data will become inaccessible.`
      });
    } else {
      const newField = toFields.get(fieldName);
      
      // Check for modifications
      const modifications = [];
      
      if (oldField.field_type !== newField.field_type) {
        modifications.push('type_changed');
        impact.breaking_changes.push({
          type: 'type_changed',
          field_name: fieldName,
          message: `Field '${fieldName}' type changed from ${oldField.field_type} to ${newField.field_type}. Data may be incompatible.`
        });
      }
      
      if (oldField.is_required !== newField.is_required) {
        modifications.push('required_changed');
        if (newField.is_required && !oldField.is_required) {
          impact.warnings.push({
            type: 'field_now_required',
            field_name: fieldName,
            message: `Field '${fieldName}' is now required. Existing records with null values will fail validation.`
          });
        }
      }
      
      if (JSON.stringify(oldField.validation_rules) !== JSON.stringify(newField.validation_rules)) {
        modifications.push('validation_changed');
        impact.warnings.push({
          type: 'validation_changed',
          field_name: fieldName,
          message: `Validation rules changed for '${fieldName}'. Existing data may fail new validation.`
        });
      }
      
      if (modifications.length > 0) {
        impact.fields_modified.push({
          field_name: fieldName,
          modifications,
          old_type: oldField.field_type,
          new_type: newField.field_type
        });
      } else {
        impact.fields_unchanged.push(fieldName);
      }
    }
  }
  
  return impact;
}

/**
 * Run dry-run migration simulation on sample records
 */
async function runDryRunMigration(fromSnapshotId, toSnapshotId, tenantId, options = {}) {
  const {
    sampleSize = 1000,
    maxSampleSize = 10000
  } = options;
  
  // Validate sample size
  const validatedSampleSize = Math.min(Math.max(sampleSize, 100), maxSampleSize);
  
  // Analyze impact first
  const impact = await analyzeMigrationImpact(fromSnapshotId, toSnapshotId, tenantId);
  
  // Get sample records using the old schema
  const sampleRecordsSql = `
    SELECT 
      record_id,
      data,
      created_at
    FROM student_records
    WHERE tenant_id = $1 
      AND snapshot_id = $2
    ORDER BY created_at DESC
    LIMIT $3
  `;
  
  const sampleResult = await query(sampleRecordsSql, [tenantId, fromSnapshotId, validatedSampleSize]);
  const sampleRecords = sampleResult.rows;
  
  // Get total count of affected records
  const countSql = `
    SELECT COUNT(*) as total
    FROM student_records
    WHERE tenant_id = $1 AND snapshot_id = $2
  `;
  
  const countResult = await query(countSql, [tenantId, fromSnapshotId]);
  const totalRecords = parseInt(countResult.rows[0].total, 10);
  
  // Get new schema for validation
  const toSchema = await schemaService.getSchemaSnapshotById(toSnapshotId, tenantId);
  
  // Simulate validation on sample records
  const validationResults = {
    total_sampled: sampleRecords.length,
    total_affected: totalRecords,
    validation_passed: 0,
    validation_failed: 0,
    failures: []
  };
  
  for (const record of sampleRecords) {
    const validationErrors = validateRecordAgainstSchema(record.data, toSchema);
    
    if (validationErrors.length === 0) {
      validationResults.validation_passed++;
    } else {
      validationResults.validation_failed++;
      
      // Store first 100 failures for reporting
      if (validationResults.failures.length < 100) {
        validationResults.failures.push({
          record_id: record.record_id,
          errors: validationErrors
        });
      }
    }
  }
  
  // Estimate impact on full dataset
  const failureRate = sampleRecords.length > 0 
    ? validationResults.validation_failed / sampleRecords.length 
    : 0;
  
  const estimatedFailures = Math.round(totalRecords * failureRate);
  
  // Create dry-run report
  const dryRunReport = {
    dry_run_id: require('crypto').randomUUID(),
    tenant_id: tenantId,
    from_snapshot_id: fromSnapshotId,
    to_snapshot_id: toSnapshotId,
    impact_analysis: impact,
    validation_results: validationResults,
    estimated_impact: {
      total_records: totalRecords,
      estimated_failures: estimatedFailures,
      estimated_success_rate: totalRecords > 0 ? ((totalRecords - estimatedFailures) / totalRecords * 100).toFixed(2) : 100
    },
    sample_size: validatedSampleSize,
    executed_at: new Date().toISOString(),
    recommendation: determineRecommendation(impact, validationResults, estimatedFailures, totalRecords)
  };
  
  // Store dry-run report
  await storeDryRunReport(dryRunReport);
  
  return dryRunReport;
}

/**
 * Validate a record against a schema
 */
function validateRecordAgainstSchema(recordData, schema) {
  const errors = [];
  
  for (const field of schema.fields) {
    const fieldValue = recordData[field.field_name];
    
    // Check required fields
    if (field.is_required && (fieldValue === null || fieldValue === undefined || fieldValue === '')) {
      errors.push({
        field_name: field.field_name,
        error_type: 'required',
        message: `Field '${field.field_name}' is required but has no value`
      });
      continue;
    }
    
    // Skip validation if field is empty and not required
    if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
      continue;
    }
    
    // Type validation
    const typeError = validateFieldType(fieldValue, field.field_type, field.field_name);
    if (typeError) {
      errors.push(typeError);
    }
    
    // Validation rules
    if (field.validation_rules && typeof field.validation_rules === 'object') {
      for (const [ruleType, ruleValue] of Object.entries(field.validation_rules)) {
        const ruleError = validateRule(fieldValue, ruleType, ruleValue, field.field_name);
        if (ruleError) {
          errors.push(ruleError);
        }
      }
    }
  }
  
  return errors;
}

/**
 * Validate field type
 */
function validateFieldType(value, fieldType, fieldName) {
  switch (fieldType) {
    case 'number':
      if (isNaN(value)) {
        return {
          field_name: fieldName,
          error_type: 'type_mismatch',
          message: `Field '${fieldName}' must be a number`
        };
      }
      break;
    
    case 'date':
      if (isNaN(Date.parse(value))) {
        return {
          field_name: fieldName,
          error_type: 'type_mismatch',
          message: `Field '${fieldName}' must be a valid date`
        };
      }
      break;
    
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return {
          field_name: fieldName,
          error_type: 'type_mismatch',
          message: `Field '${fieldName}' must be a valid email`
        };
      }
      break;
  }
  
  return null;
}

/**
 * Validate a specific rule
 */
function validateRule(value, ruleType, ruleValue, fieldName) {
  switch (ruleType) {
    case 'min':
      if (parseFloat(value) < parseFloat(ruleValue)) {
        return {
          field_name: fieldName,
          error_type: 'min_value',
          message: `Field '${fieldName}' must be at least ${ruleValue}`
        };
      }
      break;
    
    case 'max':
      if (parseFloat(value) > parseFloat(ruleValue)) {
        return {
          field_name: fieldName,
          error_type: 'max_value',
          message: `Field '${fieldName}' must be at most ${ruleValue}`
        };
      }
      break;
    
    case 'min_length':
      if (value.length < parseInt(ruleValue)) {
        return {
          field_name: fieldName,
          error_type: 'min_length',
          message: `Field '${fieldName}' must be at least ${ruleValue} characters`
        };
      }
      break;
    
    case 'max_length':
      if (value.length > parseInt(ruleValue)) {
        return {
          field_name: fieldName,
          error_type: 'max_length',
          message: `Field '${fieldName}' must be at most ${ruleValue} characters`
        };
      }
      break;
    
    case 'regex':
      const regex = new RegExp(ruleValue);
      if (!regex.test(value)) {
        return {
          field_name: fieldName,
          error_type: 'regex',
          message: `Field '${fieldName}' does not match required pattern`
        };
      }
      break;
  }
  
  return null;
}

/**
 * Determine migration recommendation
 */
function determineRecommendation(impact, validationResults, estimatedFailures, totalRecords) {
  const hasBreakingChanges = impact.breaking_changes.length > 0;
  const failureRate = totalRecords > 0 ? (estimatedFailures / totalRecords) : 0;
  
  if (hasBreakingChanges) {
    return {
      status: 'caution',
      message: 'This migration contains breaking changes. Review carefully before proceeding.',
      action: 'manual_review_required'
    };
  }
  
  if (failureRate > 0.1) {
    return {
      status: 'warning',
      message: `Estimated ${(failureRate * 100).toFixed(1)}% of records will fail validation. Consider data cleanup first.`,
      action: 'data_cleanup_recommended'
    };
  }
  
  if (failureRate > 0.01) {
    return {
      status: 'proceed_with_caution',
      message: `Small number of records (${estimatedFailures}) may fail validation. Review failures before proceeding.`,
      action: 'review_failures'
    };
  }
  
  return {
    status: 'safe',
    message: 'Migration appears safe to proceed. Minimal impact expected.',
    action: 'proceed'
  };
}

/**
 * Store dry-run report
 */
async function storeDryRunReport(report) {
  const sql = `
    INSERT INTO schema_migration_dry_runs (
      dry_run_id,
      tenant_id,
      from_snapshot_id,
      to_snapshot_id,
      report_data,
      executed_at
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  
  const result = await query(sql, [
    report.dry_run_id,
    report.tenant_id,
    report.from_snapshot_id,
    report.to_snapshot_id,
    report,
    report.executed_at
  ]);
  
  return result.rows[0];
}

/**
 * Execute schema migration with rollback capability
 */
async function executeMigration(fromSnapshotId, toSnapshotId, tenantId, executedBy, options = {}) {
  const {
    skipDryRun = false,
    tier = 'basic'
  } = options;
  
  // Get tenant tier for SLA
  const rollbackTimeout = ROLLBACK_SLA[tier] || ROLLBACK_SLA.basic;
  
  // Run dry-run first unless skipped
  let dryRunReport = null;
  if (!skipDryRun) {
    dryRunReport = await runDryRunMigration(fromSnapshotId, toSnapshotId, tenantId);
    
    // Check if migration is safe
    if (dryRunReport.recommendation.status === 'caution' && !options.forceExecute) {
      throw new Error('Migration contains breaking changes. Use forceExecute option to proceed.');
    }
  }
  
  const migrationId = require('crypto').randomUUID();
  const startTime = Date.now();
  
  try {
    // Create migration record
    await createMigrationRecord(migrationId, fromSnapshotId, toSnapshotId, tenantId, executedBy, dryRunReport);
    
    // Execute migration in transaction with timeout
    const migrationResult = await executeMigrationTransaction(
      migrationId,
      fromSnapshotId,
      toSnapshotId,
      tenantId,
      rollbackTimeout
    );
    
    const duration = Date.now() - startTime;
    
    // Update migration record with success
    await updateMigrationRecord(migrationId, 'completed', {
      records_migrated: migrationResult.records_migrated,
      duration_ms: duration
    });
    
    return {
      migration_id: migrationId,
      status: 'completed',
      records_migrated: migrationResult.records_migrated,
      duration_ms: duration,
      dry_run_report: dryRunReport
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Update migration record with failure
    await updateMigrationRecord(migrationId, 'failed', {
      error_message: error.message,
      duration_ms: duration
    });
    
    // Check if we exceeded SLA
    if (duration > rollbackTimeout) {
      throw new Error(`Migration failed and exceeded rollback SLA (${rollbackTimeout}ms). Manual intervention required.`);
    }
    
    throw error;
  }
}

/**
 * Create migration record
 */
async function createMigrationRecord(migrationId, fromSnapshotId, toSnapshotId, tenantId, executedBy, dryRunReport) {
  const sql = `
    INSERT INTO schema_migrations_log (
      migration_id,
      tenant_id,
      from_snapshot_id,
      to_snapshot_id,
      migration_status,
      executed_by,
      dry_run_id,
      started_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    RETURNING *
  `;
  
  const result = await query(sql, [
    migrationId,
    tenantId,
    fromSnapshotId,
    toSnapshotId,
    'in_progress',
    executedBy,
    dryRunReport?.dry_run_id || null
  ]);
  
  return result.rows[0];
}

/**
 * Update migration record
 */
async function updateMigrationRecord(migrationId, status, metadata = {}) {
  const sql = `
    UPDATE schema_migrations_log
    SET 
      migration_status = $1,
      completed_at = NOW(),
      metadata = $2
    WHERE migration_id = $3
    RETURNING *
  `;
  
  const result = await query(sql, [status, metadata, migrationId]);
  return result.rows[0];
}

/**
 * Execute migration transaction with timeout
 */
async function executeMigrationTransaction(migrationId, fromSnapshotId, toSnapshotId, tenantId, timeout) {
  return await transaction(async (client) => {
    // Set statement timeout for auto-rollback
    await client.query(`SET LOCAL statement_timeout = ${timeout}`);
    
    // Create before-snapshot for rollback
    const beforeSnapshotSql = `
      INSERT INTO schema_migration_snapshots (
        migration_id,
        tenant_id,
        snapshot_type,
        snapshot_data
      )
      SELECT 
        $1,
        $2,
        'before',
        jsonb_agg(row_to_json(sr))
      FROM student_records sr
      WHERE sr.tenant_id = $2 AND sr.snapshot_id = $3
      RETURNING *
    `;
    
    await client.query(beforeSnapshotSql, [migrationId, tenantId, fromSnapshotId]);
    
    // Update all records to use new snapshot
    const updateSql = `
      UPDATE student_records
      SET 
        snapshot_id = $1,
        updated_at = NOW()
      WHERE tenant_id = $2 AND snapshot_id = $3
      RETURNING record_id
    `;
    
    const updateResult = await client.query(updateSql, [toSnapshotId, tenantId, fromSnapshotId]);
    
    // Create after-snapshot
    const afterSnapshotSql = `
      INSERT INTO schema_migration_snapshots (
        migration_id,
        tenant_id,
        snapshot_type,
        snapshot_data
      )
      SELECT 
        $1,
        $2,
        'after',
        jsonb_agg(row_to_json(sr))
      FROM student_records sr
      WHERE sr.tenant_id = $2 AND sr.snapshot_id = $3
      RETURNING *
    `;
    
    await client.query(afterSnapshotSql, [migrationId, tenantId, toSnapshotId]);
    
    return {
      records_migrated: updateResult.rows.length
    };
  });
}

/**
 * Get migration history
 */
async function getMigrationHistory(tenantId, options = {}) {
  const {
    page = 1,
    limit = 20,
    status
  } = options;
  
  const offset = (page - 1) * limit;
  
  let sql = `
    SELECT 
      ml.*,
      fs.semantic_version as from_version,
      ts.semantic_version as to_version,
      fs.form_type
    FROM schema_migrations_log ml
    JOIN schema_snapshots fs ON ml.from_snapshot_id = fs.snapshot_id
    JOIN schema_snapshots ts ON ml.to_snapshot_id = ts.snapshot_id
    WHERE ml.tenant_id = $1
  `;
  
  const params = [tenantId];
  let paramIndex = 2;
  
  if (status) {
    params.push(status);
    sql += ` AND ml.migration_status = $${paramIndex++}`;
  }
  
  sql += ` ORDER BY ml.started_at DESC`;
  sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);
  
  const result = await query(sql, params);
  
  // Get total count
  let countSql = `SELECT COUNT(*) FROM schema_migrations_log WHERE tenant_id = $1`;
  const countParams = [tenantId];
  
  if (status) {
    countParams.push(status);
    countSql += ` AND migration_status = $2`;
  }
  
  const countResult = await query(countSql, countParams);
  const total = parseInt(countResult.rows[0].count, 10);
  
  return {
    migrations: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get migration details
 */
async function getMigrationDetails(migrationId, tenantId) {
  const sql = `
    SELECT 
      ml.*,
      fs.semantic_version as from_version,
      ts.semantic_version as to_version,
      fs.form_type,
      dr.report_data as dry_run_report
    FROM schema_migrations_log ml
    JOIN schema_snapshots fs ON ml.from_snapshot_id = fs.snapshot_id
    JOIN schema_snapshots ts ON ml.to_snapshot_id = ts.snapshot_id
    LEFT JOIN schema_migration_dry_runs dr ON ml.dry_run_id = dr.dry_run_id
    WHERE ml.migration_id = $1 AND ml.tenant_id = $2
  `;
  
  const result = await query(sql, [migrationId, tenantId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return result.rows[0];
}

module.exports = {
  analyzeMigrationImpact,
  runDryRunMigration,
  executeMigration,
  getMigrationHistory,
  getMigrationDetails,
  ROLLBACK_SLA
};
