/**
 * Schema Service
 * 
 * Business logic for managing dynamic form schemas and field definitions.
 * 
 * Task: 2.2.1 - Build schema definition and storage system
 * 
 * Features:
 * - JSON schema format for form definitions
 * - Schema stored in schema_snapshots table with versioning
 * - Field types: text, number, date, dropdown, checkbox, file upload
 * - Validation rules: required, min/max, regex, custom validators
 * - Schema export/import API for portability
 * - Immutable snapshots with SHA-256 hashing
 * - Semantic versioning (SemVer)
 */

const { query, transaction } = require('../config/database');
const crypto = require('crypto');

/**
 * Supported field types
 */
const FIELD_TYPES = [
  'text',
  'number',
  'date',
  'dropdown',
  'checkbox',
  'file_upload',
  'email',
  'phone',
  'textarea',
  'radio'
];

/**
 * Supported validation rule types
 */
const VALIDATION_RULE_TYPES = [
  'required',
  'min',
  'max',
  'min_length',
  'max_length',
  'regex',
  'email',
  'phone',
  'url',
  'custom'
];

/**
 * Compute SHA-256 hash of schema definition
 */
function computeSchemaHash(schemaDefinition) {
  // Convert to canonical JSON string (sorted keys)
  const canonicalJson = JSON.stringify(schemaDefinition, Object.keys(schemaDefinition).sort());
  return crypto.createHash('sha256').update(canonicalJson).digest('hex');
}

/**
 * Parse semantic version string
 */
function parseSemVer(version) {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid semantic version format: ${version}. Expected format: v1.2.3`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10)
  };
}

/**
 * Increment semantic version based on change type
 */
function incrementSemVer(currentVersion, changeType = 'patch') {
  const { major, minor, patch } = parseSemVer(currentVersion);
  
  switch (changeType) {
    case 'major':
      return `v${major + 1}.0.0`;
    case 'minor':
      return `v${major}.${minor + 1}.0`;
    case 'patch':
    default:
      return `v${major}.${minor}.${patch + 1}`;
  }
}

/**
 * Validate field definition
 */
function validateFieldDefinition(field) {
  if (!field.field_name) {
    throw new Error('Validation failed: field_name is required');
  }
  
  if (!field.field_type) {
    throw new Error('Validation failed: field_type is required');
  }
  
  if (!FIELD_TYPES.includes(field.field_type)) {
    throw new Error(`Validation failed: field_type must be one of ${FIELD_TYPES.join(', ')}`);
  }
  
  if (!field.label) {
    throw new Error('Validation failed: label is required');
  }
  
  // Validate field options for dropdown, radio, checkbox
  if (['dropdown', 'radio', 'checkbox'].includes(field.field_type)) {
    if (!field.field_options || !field.field_options.options || !Array.isArray(field.field_options.options)) {
      throw new Error(`Validation failed: field_options.options array is required for ${field.field_type} fields`);
    }
  }
  
  return true;
}

/**
 * Validate validation rule
 */
function validateValidationRule(rule) {
  if (!rule.rule_type) {
    throw new Error('Validation failed: rule_type is required');
  }
  
  if (!VALIDATION_RULE_TYPES.includes(rule.rule_type)) {
    throw new Error(`Validation failed: rule_type must be one of ${VALIDATION_RULE_TYPES.join(', ')}`);
  }
  
  if (!rule.error_message) {
    throw new Error('Validation failed: error_message is required');
  }
  
  return true;
}

/**
 * Create a new schema snapshot
 */
async function createSchemaSnapshot({
  tenantId,
  formType,
  fields,
  createdBy,
  changeSummary,
  parentSnapshotId = null,
  changeType = 'minor',
  status = 'active'
}) {
  // Validation
  if (!formType) {
    throw new Error('Validation failed: form_type is required');
  }
  
  if (!fields || !Array.isArray(fields) || fields.length === 0) {
    throw new Error('Validation failed: fields must be a non-empty array');
  }
  
  if (!createdBy) {
    throw new Error('Validation failed: created_by is required');
  }
  
  // Validate all fields
  fields.forEach(field => validateFieldDefinition(field));
  
  return await transaction(async (client) => {
    // Determine semantic version
    let semanticVersion = 'v1.0.0';
    
    if (parentSnapshotId) {
      // Get parent version
      const parentResult = await client.query(
        'SELECT semantic_version FROM schema_snapshots WHERE snapshot_id = $1 AND tenant_id = $2',
        [parentSnapshotId, tenantId]
      );
      
      if (parentResult.rows.length === 0) {
        throw new Error(`Parent snapshot not found: ${parentSnapshotId}`);
      }
      
      semanticVersion = incrementSemVer(parentResult.rows[0].semantic_version, changeType);
    } else {
      // Check if there's an existing schema for this form type
      const existingResult = await client.query(
        `SELECT semantic_version FROM schema_snapshots 
         WHERE tenant_id = $1 AND form_type = $2 
         ORDER BY created_at DESC LIMIT 1`,
        [tenantId, formType]
      );
      
      if (existingResult.rows.length > 0) {
        semanticVersion = incrementSemVer(existingResult.rows[0].semantic_version, changeType);
      }
    }
    
    // Build schema definition
    const schemaDefinition = {
      form_type: formType,
      version: semanticVersion,
      fields: fields.map(f => ({
        field_name: f.field_name,
        field_type: f.field_type,
        label: f.label,
        description: f.description || null,
        is_required: f.is_required || false,
        validation_rules: f.validation_rules || {},
        field_options: f.field_options || {},
        permissions: f.permissions || {}
      }))
    };
    
    // Compute hash
    const schemaHash = computeSchemaHash(schemaDefinition);
    
    // Create snapshot
    const snapshotSql = `
      INSERT INTO schema_snapshots (
        tenant_id, form_type, semantic_version, schema_hash, schema_definition,
        parent_snapshot_id, created_by, change_summary, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const snapshotResult = await client.query(snapshotSql, [
      tenantId,
      formType,
      semanticVersion,
      schemaHash,
      schemaDefinition,
      parentSnapshotId,
      createdBy,
      changeSummary || `Created schema version ${semanticVersion}`,
      status
    ]);
    
    const snapshot = snapshotResult.rows[0];
    
    // Create field definitions
    const fieldDefinitions = [];
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      
      const fieldSql = `
        INSERT INTO field_definitions (
          snapshot_id, tenant_id, field_name, field_type, label, description,
          placeholder, default_value, is_required, is_unique, is_encrypted,
          display_order, validation_rules, field_options, permissions
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `;
      
      const fieldResult = await client.query(fieldSql, [
        snapshot.snapshot_id,
        tenantId,
        field.field_name,
        field.field_type,
        field.label,
        field.description || null,
        field.placeholder || null,
        field.default_value || null,
        field.is_required || false,
        field.is_unique || false,
        field.is_encrypted || false,
        field.display_order !== undefined ? field.display_order : i,
        field.validation_rules || {},
        field.field_options || {},
        field.permissions || {}
      ]);
      
      fieldDefinitions.push(fieldResult.rows[0]);
      
      // Create validation rules if provided
      if (field.validation_rules && typeof field.validation_rules === 'object') {
        for (const [ruleType, ruleValue] of Object.entries(field.validation_rules)) {
          if (VALIDATION_RULE_TYPES.includes(ruleType)) {
            const ruleSql = `
              INSERT INTO validation_rules (
                field_id, tenant_id, rule_type, rule_value, error_message
              )
              VALUES ($1, $2, $3, $4, $5)
            `;
            
            const errorMessage = field.validation_error_messages?.[ruleType] || 
              `Validation failed for ${field.field_name}: ${ruleType}`;
            
            await client.query(ruleSql, [
              fieldResult.rows[0].field_id,
              tenantId,
              ruleType,
              ruleValue?.toString() || null,
              errorMessage
            ]);
          }
        }
      }
    }
    
    return {
      snapshot,
      fields: fieldDefinitions
    };
  });
}

/**
 * Get schema snapshot by ID
 */
async function getSchemaSnapshotById(snapshotId, tenantId) {
  const sql = `
    SELECT * FROM schema_snapshots
    WHERE snapshot_id = $1 AND tenant_id = $2
  `;
  
  const result = await query(sql, [snapshotId, tenantId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const snapshot = result.rows[0];
  
  // Get field definitions
  const fieldsSql = `
    SELECT * FROM field_definitions
    WHERE snapshot_id = $1
    ORDER BY display_order ASC, field_name ASC
  `;
  
  const fieldsResult = await query(fieldsSql, [snapshotId]);
  snapshot.fields = fieldsResult.rows;
  
  // Get validation rules for each field
  for (const field of snapshot.fields) {
    const rulesSql = `
      SELECT * FROM validation_rules
      WHERE field_id = $1 AND is_active = true
      ORDER BY created_at ASC
    `;
    
    const rulesResult = await query(rulesSql, [field.field_id]);
    field.validation_rules_detailed = rulesResult.rows;
  }
  
  return snapshot;
}

/**
 * Get latest active schema for a form type
 */
async function getLatestSchema(tenantId, formType) {
  const sql = `
    SELECT * FROM schema_snapshots
    WHERE tenant_id = $1 AND form_type = $2 AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  
  const result = await query(sql, [tenantId, formType]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return await getSchemaSnapshotById(result.rows[0].snapshot_id, tenantId);
}

/**
 * List schema snapshots with filtering
 */
async function listSchemaSnapshots(tenantId, options = {}) {
  const {
    page = 1,
    limit = 20,
    formType,
    status
  } = options;
  
  const offset = (page - 1) * limit;
  
  let sql = `
    SELECT * FROM schema_snapshots
    WHERE tenant_id = $1
  `;
  
  const params = [tenantId];
  let paramIndex = 2;
  
  if (formType) {
    params.push(formType);
    sql += ` AND form_type = $${paramIndex++}`;
  }
  
  if (status) {
    params.push(status);
    sql += ` AND status = $${paramIndex++}`;
  }
  
  sql += ` ORDER BY created_at DESC`;
  sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);
  
  const result = await query(sql, params);
  
  // Get total count
  let countSql = `SELECT COUNT(*) FROM schema_snapshots WHERE tenant_id = $1`;
  const countParams = [tenantId];
  let countParamIndex = 2;
  
  if (formType) {
    countParams.push(formType);
    countSql += ` AND form_type = $${countParamIndex++}`;
  }
  
  if (status) {
    countParams.push(status);
    countSql += ` AND status = $${countParamIndex++}`;
  }
  
  const countResult = await query(countSql, countParams);
  const total = parseInt(countResult.rows[0].count, 10);
  
  return {
    snapshots: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get schema version history for a form type
 */
async function getSchemaVersionHistory(tenantId, formType) {
  const sql = `
    SELECT 
      snapshot_id,
      semantic_version,
      created_at,
      created_by,
      change_summary,
      status,
      parent_snapshot_id,
      schema_hash
    FROM schema_snapshots
    WHERE tenant_id = $1 AND form_type = $2
    ORDER BY created_at DESC
  `;
  
  const result = await query(sql, [tenantId, formType]);
  return result.rows;
}

/**
 * Verify schema integrity
 */
async function verifySchemaIntegrity(snapshotId, tenantId) {
  const sql = `
    SELECT * FROM verify_schema_integrity($1)
  `;
  
  const result = await query(sql, [snapshotId]);
  
  if (result.rows.length === 0) {
    throw new Error(`Schema snapshot not found: ${snapshotId}`);
  }
  
  const verification = result.rows[0];
  
  // Filter by tenant_id for security
  const snapshotCheck = await query(
    'SELECT tenant_id FROM schema_snapshots WHERE snapshot_id = $1',
    [snapshotId]
  );
  
  if (snapshotCheck.rows.length === 0 || snapshotCheck.rows[0].tenant_id !== tenantId) {
    throw new Error(`Schema snapshot not found or access denied: ${snapshotId}`);
  }
  
  return verification;
}

/**
 * Verify integrity of all snapshots for a tenant
 */
async function verifyAllSnapshotsForTenant(tenantId) {
  const sql = `
    SELECT 
      snapshot_id,
      semantic_version,
      schema_hash,
      schema_definition,
      created_at
    FROM schema_snapshots
    WHERE tenant_id = $1
    ORDER BY created_at ASC
  `;
  
  const result = await query(sql, [tenantId]);
  const snapshots = result.rows;
  
  const verificationResults = [];
  let failedCount = 0;
  
  for (const snapshot of snapshots) {
    const computedHash = computeSchemaHash(snapshot.schema_definition);
    const isValid = snapshot.schema_hash === computedHash;
    
    if (!isValid) {
      failedCount++;
    }
    
    verificationResults.push({
      snapshot_id: snapshot.snapshot_id,
      semantic_version: snapshot.semantic_version,
      is_valid: isValid,
      stored_hash: snapshot.schema_hash,
      computed_hash: computedHash,
      created_at: snapshot.created_at
    });
  }
  
  return {
    total_checked: snapshots.length,
    failed_count: failedCount,
    success_rate: snapshots.length > 0 ? ((snapshots.length - failedCount) / snapshots.length * 100) : 100,
    results: verificationResults
  };
}

/**
 * Export schema
 */
async function exportSchema(snapshotId, tenantId, exportedBy, format = 'json') {
  const snapshot = await getSchemaSnapshotById(snapshotId, tenantId);
  
  if (!snapshot) {
    throw new Error(`Schema snapshot not found: ${snapshotId}`);
  }
  
  const exportData = {
    export_format: 'eduos-schema-v1',
    snapshot_id: snapshot.snapshot_id,
    form_type: snapshot.form_type,
    semantic_version: snapshot.semantic_version,
    schema_definition: snapshot.schema_definition,
    fields: snapshot.fields.map(f => ({
      field_name: f.field_name,
      field_type: f.field_type,
      label: f.label,
      description: f.description,
      placeholder: f.placeholder,
      default_value: f.default_value,
      is_required: f.is_required,
      is_unique: f.is_unique,
      is_encrypted: f.is_encrypted,
      display_order: f.display_order,
      validation_rules: f.validation_rules,
      field_options: f.field_options,
      permissions: f.permissions
    })),
    exported_at: new Date().toISOString()
  };
  
  // Store export record
  const sql = `
    INSERT INTO schema_exports (
      snapshot_id, tenant_id, export_format, export_data, exported_by
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  
  const result = await query(sql, [
    snapshotId,
    tenantId,
    format,
    exportData,
    exportedBy
  ]);
  
  return {
    export_id: result.rows[0].export_id,
    export_data: exportData
  };
}

/**
 * Import schema
 */
async function importSchema(tenantId, importData, importedBy, options = {}) {
  const {
    importMode = 'create_new',
    conflictResolution = 'skip'
  } = options;
  
  // Validate import data format
  if (!importData.export_format || importData.export_format !== 'eduos-schema-v1') {
    throw new Error('Invalid import format. Expected eduos-schema-v1');
  }
  
  if (!importData.form_type || !importData.fields) {
    throw new Error('Invalid import data. Missing form_type or fields');
  }
  
  return await transaction(async (client) => {
    // Create import record
    const importSql = `
      INSERT INTO schema_imports (
        tenant_id, import_format, import_data, import_status, imported_by
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const importResult = await client.query(importSql, [
      tenantId,
      'json',
      importData,
      'pending',
      importedBy
    ]);
    
    const importRecord = importResult.rows[0];
    
    try {
      // Check for existing schema with same form_type
      const existingResult = await client.query(
        `SELECT snapshot_id FROM schema_snapshots 
         WHERE tenant_id = $1 AND form_type = $2 AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
        [tenantId, importData.form_type]
      );
      
      let parentSnapshotId = null;
      
      if (existingResult.rows.length > 0) {
        if (importMode === 'create_new') {
          parentSnapshotId = existingResult.rows[0].snapshot_id;
        } else if (conflictResolution === 'skip') {
          throw new Error(`Schema already exists for form_type: ${importData.form_type}`);
        }
      }
      
      // Create new schema snapshot
      const newSnapshot = await createSchemaSnapshot({
        tenantId,
        formType: importData.form_type,
        fields: importData.fields,
        createdBy: importedBy,
        changeSummary: `Imported from external source`,
        parentSnapshotId,
        changeType: 'minor',
        status: 'active'
      });
      
      // Update import record
      await client.query(
        `UPDATE schema_imports 
         SET import_status = $1, result_snapshot_id = $2 
         WHERE import_id = $3`,
        ['success', newSnapshot.snapshot.snapshot_id, importRecord.import_id]
      );
      
      return {
        import_id: importRecord.import_id,
        status: 'success',
        snapshot_id: newSnapshot.snapshot.snapshot_id,
        imported_fields: importData.fields.length
      };
    } catch (error) {
      // Update import record with error
      await client.query(
        `UPDATE schema_imports 
         SET import_status = $1, error_log = $2 
         WHERE import_id = $3`,
        ['failed', error.message, importRecord.import_id]
      );
      
      throw error;
    }
  });
}

/**
 * Update schema status
 */
async function updateSchemaStatus(snapshotId, tenantId, newStatus) {
  const validStatuses = ['draft', 'active', 'archived'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Validation failed: status must be one of ${validStatuses.join(', ')}`);
  }
  
  const sql = `
    UPDATE schema_snapshots
    SET status = $1
    WHERE snapshot_id = $2 AND tenant_id = $3
    RETURNING *
  `;
  
  const result = await query(sql, [newStatus, snapshotId, tenantId]);
  
  if (result.rows.length === 0) {
    throw new Error(`Schema snapshot not found: ${snapshotId}`);
  }
  
  return result.rows[0];
}

module.exports = {
  FIELD_TYPES,
  VALIDATION_RULE_TYPES,
  createSchemaSnapshot,
  getSchemaSnapshotById,
  getLatestSchema,
  listSchemaSnapshots,
  getSchemaVersionHistory,
  verifySchemaIntegrity,
  verifyAllSnapshotsForTenant,
  exportSchema,
  importSchema,
  updateSchemaStatus,
  computeSchemaHash,
  parseSemVer,
  incrementSemVer
};
