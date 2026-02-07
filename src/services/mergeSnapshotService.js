/**
 * Merge Snapshot Service
 * Task: 3.3.1 Implement pre-merge cryptographic snapshots
 * 
 * Provides cryptographic snapshot functionality for merge operations:
 * - Create pre-merge snapshots with SHA-256 integrity
 * - Verify snapshot integrity
 * - Support reversibility within SLA windows
 */

const { pool } = require('../config/database');

/**
 * Create a cryptographic snapshot before merge operation
 * 
 * @param {Object} params - Snapshot parameters
 * @param {string} params.tenantId - Tenant UUID
 * @param {string} params.primaryStudentId - Primary student UUID
 * @param {string[]} params.secondaryStudentIds - Array of secondary student UUIDs
 * @param {string} params.createdBy - User UUID who initiated the merge
 * @returns {Promise<Object>} Snapshot details with snapshot_id and hash
 */
async function createMergeSnapshot({ tenantId, primaryStudentId, secondaryStudentIds, createdBy }) {
  const client = await pool.connect();
  
  try {
    // Begin transaction
    await client.query('BEGIN');
    
    // Set tenant context for RLS
    await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    
    // Validate inputs
    if (!tenantId || !primaryStudentId || !secondaryStudentIds || !createdBy) {
      throw new Error('Missing required parameters for snapshot creation');
    }
    
    if (!Array.isArray(secondaryStudentIds) || secondaryStudentIds.length === 0) {
      throw new Error('secondaryStudentIds must be a non-empty array');
    }
    
    // Create snapshot using database function
    const result = await client.query(
      `SELECT create_merge_snapshot($1::UUID, $2::UUID, $3::UUID[], $4::UUID) AS snapshot_id`,
      [tenantId, primaryStudentId, secondaryStudentIds, createdBy]
    );
    
    const snapshotId = result.rows[0].snapshot_id;
    
    // Retrieve snapshot details
    const snapshotDetails = await client.query(
      `SELECT 
        merge_snapshot_id,
        snapshot_hash,
        created_at,
        created_by,
        primary_record,
        secondary_records
      FROM merge_snapshots
      WHERE merge_snapshot_id = $1`,
      [snapshotId]
    );
    
    if (snapshotDetails.rows.length === 0) {
      throw new Error('Failed to retrieve created snapshot');
    }
    
    const snapshot = snapshotDetails.rows[0];
    
    // Commit transaction
    await client.query('COMMIT');
    
    return {
      snapshotId: snapshot.merge_snapshot_id,
      snapshotHash: snapshot.snapshot_hash,
      createdAt: snapshot.created_at,
      createdBy: snapshot.created_by,
      primaryRecord: snapshot.primary_record,
      secondaryRecords: snapshot.secondary_records,
      recordCount: {
        primary: 1,
        secondary: snapshot.secondary_records.length
      }
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Failed to create merge snapshot: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Verify the cryptographic integrity of a snapshot
 * 
 * @param {string} snapshotId - Snapshot UUID
 * @param {string} tenantId - Tenant UUID
 * @returns {Promise<Object>} Verification result
 */
async function verifySnapshotIntegrity(snapshotId, tenantId) {
  const client = await pool.connect();
  
  try {
    // Begin transaction for RLS context
    await client.query('BEGIN');
    
    // Set tenant context for RLS
    await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    
    // Verify integrity using database function
    const result = await client.query(
      `SELECT verify_snapshot_integrity($1::UUID) AS is_valid`,
      [snapshotId]
    );
    
    const isValid = result.rows[0].is_valid;
    
    // Get snapshot details
    const snapshotDetails = await client.query(
      `SELECT 
        merge_snapshot_id,
        snapshot_hash,
        created_at,
        created_by
      FROM merge_snapshots
      WHERE merge_snapshot_id = $1`,
      [snapshotId]
    );
    
    await client.query('COMMIT');
    
    if (snapshotDetails.rows.length === 0) {
      throw new Error('Snapshot not found');
    }
    
    const snapshot = snapshotDetails.rows[0];
    
    return {
      snapshotId: snapshot.merge_snapshot_id,
      isValid,
      snapshotHash: snapshot.snapshot_hash,
      createdAt: snapshot.created_at,
      verifiedAt: new Date().toISOString()
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Failed to verify snapshot integrity: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Retrieve a snapshot by ID
 * 
 * @param {string} snapshotId - Snapshot UUID
 * @param {string} tenantId - Tenant UUID
 * @returns {Promise<Object>} Snapshot details
 */
async function getSnapshot(snapshotId, tenantId) {
  const client = await pool.connect();
  
  try {
    // Validate UUID format to prevent SQL injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      throw new Error('Invalid tenant ID format');
    }
    
    // Begin transaction for RLS context
    await client.query('BEGIN');
    
    // Set tenant context for RLS (must use string interpolation for SET command)
    await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    
    const result = await client.query(
      `SELECT 
        merge_snapshot_id,
        tenant_id,
        primary_record,
        secondary_records,
        snapshot_hash,
        created_at,
        created_by,
        metadata
      FROM merge_snapshots
      WHERE merge_snapshot_id = $1`,
      [snapshotId]
    );
    
    await client.query('COMMIT');
    
    if (result.rows.length === 0) {
      throw new Error('Snapshot not found');
    }
    
    const snapshot = result.rows[0];
    
    return {
      snapshotId: snapshot.merge_snapshot_id,
      tenantId: snapshot.tenant_id,
      primaryRecord: snapshot.primary_record,
      secondaryRecords: snapshot.secondary_records,
      snapshotHash: snapshot.snapshot_hash,
      createdAt: snapshot.created_at,
      createdBy: snapshot.created_by,
      metadata: snapshot.metadata
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Failed to retrieve snapshot: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * List snapshots for a tenant with pagination
 * 
 * @param {Object} params - Query parameters
 * @param {string} params.tenantId - Tenant UUID
 * @param {number} params.limit - Number of records per page (default: 20)
 * @param {number} params.offset - Offset for pagination (default: 0)
 * @returns {Promise<Object>} Paginated snapshot list
 */
async function listSnapshots({ tenantId, limit = 20, offset = 0 }) {
  const client = await pool.connect();
  
  try {
    // Begin transaction for RLS context
    await client.query('BEGIN');
    
    // Set tenant context for RLS
    await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    
    // Get total count
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM merge_snapshots WHERE tenant_id = $1`,
      [tenantId]
    );
    
    const total = parseInt(countResult.rows[0].total);
    
    // Get paginated results
    const result = await client.query(
      `SELECT 
        merge_snapshot_id,
        snapshot_hash,
        created_at,
        created_by,
        jsonb_array_length(secondary_records) as secondary_count
      FROM merge_snapshots
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset]
    );
    
    await client.query('COMMIT');
    
    return {
      snapshots: result.rows.map(row => ({
        snapshotId: row.merge_snapshot_id,
        snapshotHash: row.snapshot_hash,
        createdAt: row.created_at,
        createdBy: row.created_by,
        secondaryCount: row.secondary_count
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Failed to list snapshots: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Calculate impact assessment for a potential merge
 * 
 * @param {Object} params - Assessment parameters
 * @param {string} params.tenantId - Tenant UUID
 * @param {string} params.primaryStudentId - Primary student UUID
 * @param {string[]} params.secondaryStudentIds - Array of secondary student UUIDs
 * @returns {Promise<Object>} Impact assessment
 */
async function calculateMergeImpact({ tenantId, primaryStudentId, secondaryStudentIds }) {
  const client = await pool.connect();
  
  try {
    // Begin transaction for RLS context
    await client.query('BEGIN');
    
    // Set tenant context for RLS
    await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    
    // Count affected enrollments
    const enrollmentsResult = await client.query(
      `SELECT COUNT(*) as count 
       FROM enrollments 
       WHERE tenant_id = $1 AND student_id = ANY($2)`,
      [tenantId, secondaryStudentIds]
    );
    
    // Count affected attendance records
    const attendanceResult = await client.query(
      `SELECT COUNT(*) as count 
       FROM attendance 
       WHERE tenant_id = $1 AND student_id = ANY($2)`,
      [tenantId, secondaryStudentIds]
    );
    
    // Count affected payment records (if table exists)
    let paymentsCount = 0;
    try {
      const paymentsResult = await client.query(
        `SELECT COUNT(*) as count 
         FROM payment_records 
         WHERE tenant_id = $1 AND student_id = ANY($2)`,
        [tenantId, secondaryStudentIds]
      );
      paymentsCount = parseInt(paymentsResult.rows[0].count);
    } catch (error) {
      // Payment table might not exist yet
      console.warn('Payment records table not found, skipping payment count');
    }
    
    const enrollmentsCount = parseInt(enrollmentsResult.rows[0].count);
    const attendanceCount = parseInt(attendanceResult.rows[0].count);
    
    await client.query('COMMIT');
    
    return {
      primaryStudentId,
      secondaryStudentIds,
      affectedRecords: {
        enrollments: enrollmentsCount,
        attendance: attendanceCount,
        payments: paymentsCount,
        total: enrollmentsCount + attendanceCount + paymentsCount
      },
      estimatedDuration: calculateEstimatedDuration(
        enrollmentsCount + attendanceCount + paymentsCount
      )
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Failed to calculate merge impact: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Calculate estimated duration for merge operation
 * @private
 */
function calculateEstimatedDuration(totalRecords) {
  // Estimate: ~10ms per record + 100ms base overhead
  const estimatedMs = (totalRecords * 10) + 100;
  
  if (estimatedMs < 1000) {
    return `${estimatedMs}ms`;
  } else if (estimatedMs < 60000) {
    return `${(estimatedMs / 1000).toFixed(1)}s`;
  } else {
    return `${(estimatedMs / 60000).toFixed(1)}min`;
  }
}

module.exports = {
  createMergeSnapshot,
  verifySnapshotIntegrity,
  getSnapshot,
  listSnapshots,
  calculateMergeImpact
};
