/**
 * Student Merge Service
 * Task: 3.3.2 Build merge workflow with impact assessment
 * 
 * Provides merge workflow functionality:
 * - Impact assessment before merge
 * - All-or-nothing database transaction
 * - Audit trail creation
 * - Integration with pre-merge snapshots
 */

const { pool } = require('../config/database');
const mergeSnapshotService = require('./mergeSnapshotService');

/**
 * Execute student merge operation with full workflow
 * 
 * @param {Object} params - Merge parameters
 * @param {string} params.tenantId - Tenant UUID
 * @param {string} params.primaryStudentId - Primary (canonical) student UUID
 * @param {string[]} params.secondaryStudentIds - Array of secondary student UUIDs to merge
 * @param {string} params.mergeReason - Mandatory reason for merge
 * @param {string} params.mergedBy - User UUID who initiated the merge
 * @returns {Promise<Object>} Merge result with audit details
 */
async function executeMerge({ tenantId, primaryStudentId, secondaryStudentIds, mergeReason, mergedBy }) {
  const client = await pool.connect();
  
  try {
    // Validate inputs
    if (!tenantId || !primaryStudentId || !secondaryStudentIds || !mergedBy) {
      throw new Error('Missing required parameters for merge operation');
    }
    
    if (!mergeReason) {
      throw new Error('Missing required parameters for merge operation');
    }
    
    if (!Array.isArray(secondaryStudentIds) || secondaryStudentIds.length === 0) {
      throw new Error('secondaryStudentIds must be a non-empty array');
    }
    
    if (!mergeReason.trim()) {
      throw new Error('Merge reason cannot be empty');
    }
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Set tenant context for RLS
    await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    
    // Step 1: Create pre-merge snapshot using database function directly
    const snapshotResult = await client.query(
      `SELECT create_merge_snapshot($1::UUID, $2::UUID, $3::UUID[], $4::UUID) AS snapshot_id`,
      [tenantId, primaryStudentId, secondaryStudentIds, mergedBy]
    );
    
    const snapshotId = snapshotResult.rows[0].snapshot_id;
    
    // Step 2: Calculate impact assessment (within same transaction)
    const enrollmentsResult = await client.query(
      `SELECT COUNT(*) as count 
       FROM enrollments 
       WHERE tenant_id = $1 AND student_id = ANY($2)`,
      [tenantId, secondaryStudentIds]
    );
    
    const attendanceResult = await client.query(
      `SELECT COUNT(*) as count 
       FROM attendance 
       WHERE tenant_id = $1 AND student_id = ANY($2)`,
      [tenantId, secondaryStudentIds]
    );
    
    // Payment records table might not exist yet, default to 0
    const paymentsCount = 0;
    
    const enrollmentsCount = parseInt(enrollmentsResult.rows[0].count);
    const attendanceCount = parseInt(attendanceResult.rows[0].count);
    
    // Step 3: Update all foreign key references
    
    // Update enrollments
    await client.query(
      `UPDATE enrollments 
       SET student_id = $1 
       WHERE tenant_id = $2 AND student_id = ANY($3)`,
      [primaryStudentId, tenantId, secondaryStudentIds]
    );
    
    // Update attendance records
    await client.query(
      `UPDATE attendance 
       SET student_id = $1 
       WHERE tenant_id = $2 AND student_id = ANY($3)`,
      [primaryStudentId, tenantId, secondaryStudentIds]
    );
    
    // Note: Payment records table not implemented yet, skipping payment update
    
    // Step 4: Update primary student record with merge metadata
    await client.query(
      `UPDATE students 
       SET merged_from = COALESCE(merged_from, ARRAY[]::UUID[]) || $1::UUID[]
       WHERE tenant_id = $2 AND student_id = $3`,
      [secondaryStudentIds, tenantId, primaryStudentId]
    );
    
    // Step 5: Soft-delete secondary records
    await client.query(
      `UPDATE students 
       SET status = 'merged',
           merged_into = $1,
           merged_at = NOW()
       WHERE tenant_id = $2 AND student_id = ANY($3)`,
      [primaryStudentId, tenantId, secondaryStudentIds]
    );
    
    // Step 6: Create audit record
    const auditResult = await client.query(
      `INSERT INTO merge_audit_log (
        tenant_id,
        merge_snapshot_id,
        primary_student_id,
        secondary_student_ids,
        merge_reason,
        merged_by,
        merged_at,
        status,
        affected_enrollments,
        affected_attendance,
        affected_payments
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'completed', $7, $8, $9)
      RETURNING merge_id, merged_at`,
      [
        tenantId,
        snapshotId,
        primaryStudentId,
        secondaryStudentIds,
        mergeReason,
        mergedBy,
        enrollmentsCount,
        attendanceCount,
        paymentsCount
      ]
    );
    
    const mergeId = auditResult.rows[0].merge_id;
    const mergedAt = auditResult.rows[0].merged_at;
    
    // Commit transaction
    await client.query('COMMIT');
    
    return {
      mergeId,
      snapshotId,
      primaryStudentId,
      secondaryStudentIds,
      mergedAt,
      mergedBy,
      mergeReason,
      impact: {
        enrollments: enrollmentsCount,
        attendance: attendanceCount,
        payments: paymentsCount,
        total: enrollmentsCount + attendanceCount + paymentsCount
      },
      status: 'completed'
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Merge execution error:', error);
    throw new Error(`Failed to execute merge: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Get impact assessment for a potential merge without executing it
 * 
 * @param {Object} params - Assessment parameters
 * @param {string} params.tenantId - Tenant UUID
 * @param {string} params.primaryStudentId - Primary student UUID
 * @param {string[]} params.secondaryStudentIds - Array of secondary student UUIDs
 * @returns {Promise<Object>} Impact assessment with confirmation message
 */
async function getImpactAssessment({ tenantId, primaryStudentId, secondaryStudentIds }) {
  // Validate inputs
  if (!tenantId || !primaryStudentId || !secondaryStudentIds) {
    throw new Error('Missing required parameters for impact assessment');
  }
  
  if (!Array.isArray(secondaryStudentIds) || secondaryStudentIds.length === 0) {
    throw new Error('secondaryStudentIds must be a non-empty array');
  }
  
  // Calculate impact
  const impact = await mergeSnapshotService.calculateMergeImpact({
    tenantId,
    primaryStudentId,
    secondaryStudentIds
  });
  
  // Generate confirmation message
  const totalRecords = impact.affectedRecords.total;
  const confirmationMessage = `I understand this will affect ${totalRecords} record${totalRecords !== 1 ? 's' : ''} ` +
    `(${impact.affectedRecords.enrollments} enrollment${impact.affectedRecords.enrollments !== 1 ? 's' : ''}, ` +
    `${impact.affectedRecords.attendance} attendance record${impact.affectedRecords.attendance !== 1 ? 's' : ''}, ` +
    `${impact.affectedRecords.payments} payment${impact.affectedRecords.payments !== 1 ? 's' : ''})`;
  
  return {
    ...impact,
    confirmationMessage,
    requiresConfirmation: true
  };
}

/**
 * Get merge history for a student
 * 
 * @param {Object} params - Query parameters
 * @param {string} params.tenantId - Tenant UUID
 * @param {string} params.studentId - Student UUID (can be primary or secondary)
 * @returns {Promise<Object[]>} Array of merge records
 */
async function getMergeHistory({ tenantId, studentId }) {
  const client = await pool.connect();
  
  try {
    // Begin transaction for RLS context
    await client.query('BEGIN');
    
    // Set tenant context for RLS
    await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    
    // Find merges where student is primary or secondary
    const result = await client.query(
      `SELECT 
        merge_id,
        merge_snapshot_id,
        primary_student_id,
        secondary_student_ids,
        merge_reason,
        merged_by,
        merged_at,
        status,
        reversed_at,
        reversed_by,
        reverse_reason,
        affected_enrollments,
        affected_attendance,
        affected_payments
      FROM merge_audit_log
      WHERE tenant_id = $1 
        AND (primary_student_id = $2 OR $2 = ANY(secondary_student_ids))
      ORDER BY merged_at DESC`,
      [tenantId, studentId]
    );
    
    await client.query('COMMIT');
    
    return result.rows.map(row => ({
      mergeId: row.merge_id,
      snapshotId: row.merge_snapshot_id,
      primaryStudentId: row.primary_student_id,
      secondaryStudentIds: row.secondary_student_ids,
      mergeReason: row.merge_reason,
      mergedBy: row.merged_by,
      mergedAt: row.merged_at,
      status: row.status,
      reversedAt: row.reversed_at,
      reversedBy: row.reversed_by,
      reverseReason: row.reverse_reason,
      affectedRecords: {
        enrollments: row.affected_enrollments,
        attendance: row.affected_attendance,
        payments: row.affected_payments,
        total: row.affected_enrollments + row.affected_attendance + row.affected_payments
      }
    }));
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Failed to retrieve merge history: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Get details of a specific merge operation
 * 
 * @param {string} mergeId - Merge UUID
 * @param {string} tenantId - Tenant UUID
 * @returns {Promise<Object>} Merge details
 */
async function getMergeDetails(mergeId, tenantId) {
  const client = await pool.connect();
  
  try {
    // Begin transaction for RLS context
    await client.query('BEGIN');
    
    // Set tenant context for RLS
    await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    
    const result = await client.query(
      `SELECT 
        merge_id,
        merge_snapshot_id,
        primary_student_id,
        secondary_student_ids,
        merge_reason,
        merged_by,
        merged_at,
        status,
        reversed_at,
        reversed_by,
        reverse_reason,
        affected_enrollments,
        affected_attendance,
        affected_payments,
        metadata
      FROM merge_audit_log
      WHERE merge_id = $1 AND tenant_id = $2`,
      [mergeId, tenantId]
    );
    
    await client.query('COMMIT');
    
    if (result.rows.length === 0) {
      throw new Error('Merge not found');
    }
    
    const merge = result.rows[0];
    
    return {
      mergeId: merge.merge_id,
      snapshotId: merge.merge_snapshot_id,
      primaryStudentId: merge.primary_student_id,
      secondaryStudentIds: merge.secondary_student_ids,
      mergeReason: merge.merge_reason,
      mergedBy: merge.merged_by,
      mergedAt: merge.merged_at,
      status: merge.status,
      reversedAt: merge.reversed_at,
      reversedBy: merge.reversed_by,
      reverseReason: merge.reverse_reason,
      affectedRecords: {
        enrollments: merge.affected_enrollments,
        attendance: merge.affected_attendance,
        payments: merge.affected_payments,
        total: merge.affected_enrollments + merge.affected_attendance + merge.affected_payments
      },
      metadata: merge.metadata
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Failed to retrieve merge details: ${error.message}`);
  } finally {
    client.release();
  }
}

module.exports = {
  executeMerge,
  getImpactAssessment,
  getMergeHistory,
  getMergeDetails
};
