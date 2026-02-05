/**
 * Enrollment Service
 * 
 * Business logic for managing student enrollments in batches.
 * 
 * Task: 2.1.3 - Create student enrollment workflow
 * 
 * Features:
 * - Students can be enrolled in multiple batches
 * - Enrollment includes: start_date, end_date, status (active/inactive/graduated)
 * - Enrollment history preserved (immutable records)
 * - Bulk enrollment API for CSV imports
 * - Validation: prevent duplicate enrollments in same batch
 */

const { query, transaction } = require('../config/database');

/**
 * Validate if student exists
 */
async function validateStudent(studentId, tenantId, client = null) {
  const executor = client || { query };
  const result = await executor.query(
    'SELECT student_id FROM students WHERE student_id = $1 AND tenant_id = $2',
    [studentId, tenantId]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Student with ID ${studentId} not found`);
  }
  
  return true;
}

/**
 * Validate if batch exists
 */
async function validateBatch(batchId, tenantId, client = null) {
  const executor = client || { query };
  const result = await executor.query(
    'SELECT batch_id FROM batches WHERE batch_id = $1 AND tenant_id = $2',
    [batchId, tenantId]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Batch with ID ${batchId} not found`);
  }
  
  return true;
}

/**
 * Check if enrollment already exists (active or inactive)
 */
async function checkDuplicateEnrollment(studentId, batchId, tenantId, client = null) {
  const executor = client || { query };
  const result = await executor.query(
    `SELECT enrollment_id, status FROM enrollments 
     WHERE student_id = $1 AND batch_id = $2 AND tenant_id = $3 
     AND status IN ('active', 'inactive')`,
    [studentId, batchId, tenantId]
  );
  
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Create a new enrollment
 */
async function createEnrollment({ tenantId, studentId, batchId, startDate, endDate, status = 'active', metadata = {} }) {
  // Validation
  if (!studentId) {
    throw new Error('Validation failed: student_id is required');
  }
  
  if (!batchId) {
    throw new Error('Validation failed: batch_id is required');
  }
  
  if (!startDate) {
    throw new Error('Validation failed: start_date is required');
  }
  
  // Validate status
  const validStatuses = ['active', 'inactive', 'graduated', 'withdrawn'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Validation failed: status must be one of ${validStatuses.join(', ')}`);
  }
  
  // Validate dates
  if (endDate && new Date(startDate) > new Date(endDate)) {
    throw new Error('Validation failed: start_date must be before end_date');
  }
  
  return await transaction(async (client) => {
    // Validate student exists
    await validateStudent(studentId, tenantId, client);
    
    // Validate batch exists
    await validateBatch(batchId, tenantId, client);
    
    // Check for duplicate enrollment
    const existingEnrollment = await checkDuplicateEnrollment(studentId, batchId, tenantId, client);
    if (existingEnrollment) {
      throw new Error(
        `Duplicate enrollment detected: Student is already enrolled in this batch with status '${existingEnrollment.status}'`
      );
    }
    
    // Create enrollment
    const sql = `
      INSERT INTO enrollments (tenant_id, student_id, batch_id, start_date, end_date, status, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const result = await client.query(sql, [
      tenantId,
      studentId,
      batchId,
      startDate,
      endDate || null,
      status,
      metadata
    ]);
    
    return result.rows[0];
  });
}

/**
 * Get enrollment by ID
 */
async function getEnrollmentById(enrollmentId, tenantId) {
  const sql = `
    SELECT 
      e.*,
      s.first_name,
      s.last_name,
      s.email,
      b.name as batch_name
    FROM enrollments e
    LEFT JOIN students s ON e.student_id = s.student_id AND e.tenant_id = s.tenant_id
    LEFT JOIN batches b ON e.batch_id = b.batch_id AND e.tenant_id = b.tenant_id
    WHERE e.enrollment_id = $1 AND e.tenant_id = $2
  `;
  
  const result = await query(sql, [enrollmentId, tenantId]);
  return result.rows[0] || null;
}

/**
 * List enrollments with filtering and pagination
 */
async function listEnrollments(tenantId, options = {}) {
  const {
    page = 1,
    limit = 20,
    studentId,
    batchId,
    status,
    startDateFrom,
    startDateTo
  } = options;
  
  const offset = (page - 1) * limit;
  
  let sql = `
    SELECT 
      e.*,
      s.first_name,
      s.last_name,
      s.email,
      b.name as batch_name
    FROM enrollments e
    LEFT JOIN students s ON e.student_id = s.student_id AND e.tenant_id = s.tenant_id
    LEFT JOIN batches b ON e.batch_id = b.batch_id AND e.tenant_id = b.tenant_id
    WHERE e.tenant_id = $1
  `;
  
  const params = [tenantId];
  let paramIndex = 2;
  
  if (studentId) {
    params.push(studentId);
    sql += ` AND e.student_id = $${paramIndex++}`;
  }
  
  if (batchId) {
    params.push(batchId);
    sql += ` AND e.batch_id = $${paramIndex++}`;
  }
  
  if (status) {
    params.push(status);
    sql += ` AND e.status = $${paramIndex++}`;
  }
  
  if (startDateFrom) {
    params.push(startDateFrom);
    sql += ` AND e.start_date >= $${paramIndex++}`;
  }
  
  if (startDateTo) {
    params.push(startDateTo);
    sql += ` AND e.start_date <= $${paramIndex++}`;
  }
  
  sql += ` ORDER BY e.created_at DESC`;
  sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);
  
  const result = await query(sql, params);
  
  // Get total count
  let countSql = `SELECT COUNT(*) FROM enrollments e WHERE e.tenant_id = $1`;
  const countParams = [tenantId];
  let countParamIndex = 2;
  
  if (studentId) {
    countParams.push(studentId);
    countSql += ` AND e.student_id = $${countParamIndex++}`;
  }
  
  if (batchId) {
    countParams.push(batchId);
    countSql += ` AND e.batch_id = $${countParamIndex++}`;
  }
  
  if (status) {
    countParams.push(status);
    countSql += ` AND e.status = $${countParamIndex++}`;
  }
  
  if (startDateFrom) {
    countParams.push(startDateFrom);
    countSql += ` AND e.start_date >= $${countParamIndex++}`;
  }
  
  if (startDateTo) {
    countParams.push(startDateTo);
    countSql += ` AND e.start_date <= $${countParamIndex++}`;
  }
  
  const countResult = await query(countSql, countParams);
  const total = parseInt(countResult.rows[0].count, 10);
  
  return {
    enrollments: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Update enrollment status
 * Note: This creates a new record in the audit trail while updating the current record
 */
async function updateEnrollmentStatus(enrollmentId, tenantId, newStatus, metadata = {}) {
  const validStatuses = ['active', 'inactive', 'graduated', 'withdrawn'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Validation failed: status must be one of ${validStatuses.join(', ')}`);
  }
  
  return await transaction(async (client) => {
    // Get current enrollment
    const currentResult = await client.query(
      'SELECT * FROM enrollments WHERE enrollment_id = $1 AND tenant_id = $2',
      [enrollmentId, tenantId]
    );
    
    if (currentResult.rows.length === 0) {
      throw new Error(`Enrollment with ID ${enrollmentId} not found`);
    }
    
    const currentEnrollment = currentResult.rows[0];
    
    // Update the enrollment
    const sql = `
      UPDATE enrollments
      SET status = $1, metadata = $2, updated_at = NOW()
      WHERE enrollment_id = $3 AND tenant_id = $4
      RETURNING *
    `;
    
    const mergedMetadata = {
      ...currentEnrollment.metadata,
      ...metadata,
      status_history: [
        ...(currentEnrollment.metadata.status_history || []),
        {
          from_status: currentEnrollment.status,
          to_status: newStatus,
          changed_at: new Date().toISOString()
        }
      ]
    };
    
    const result = await client.query(sql, [newStatus, mergedMetadata, enrollmentId, tenantId]);
    return result.rows[0];
  });
}

/**
 * Update enrollment dates
 */
async function updateEnrollmentDates(enrollmentId, tenantId, { startDate, endDate }) {
  // Validate dates
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    throw new Error('Validation failed: start_date must be before end_date');
  }
  
  return await transaction(async (client) => {
    // Get current enrollment
    const currentResult = await client.query(
      'SELECT * FROM enrollments WHERE enrollment_id = $1 AND tenant_id = $2',
      [enrollmentId, tenantId]
    );
    
    if (currentResult.rows.length === 0) {
      throw new Error(`Enrollment with ID ${enrollmentId} not found`);
    }
    
    const currentEnrollment = currentResult.rows[0];
    
    const sql = `
      UPDATE enrollments
      SET 
        start_date = COALESCE($1, start_date),
        end_date = COALESCE($2, end_date),
        updated_at = NOW()
      WHERE enrollment_id = $3 AND tenant_id = $4
      RETURNING *
    `;
    
    const result = await client.query(sql, [
      startDate || currentEnrollment.start_date,
      endDate !== undefined ? endDate : currentEnrollment.end_date,
      enrollmentId,
      tenantId
    ]);
    
    return result.rows[0];
  });
}

/**
 * Get enrollment history for a student
 */
async function getStudentEnrollmentHistory(studentId, tenantId) {
  const sql = `
    SELECT 
      e.*,
      b.name as batch_name,
      p.name as program_name,
      c.name as center_name,
      i.name as institute_name
    FROM enrollments e
    LEFT JOIN batches b ON e.batch_id = b.batch_id AND e.tenant_id = b.tenant_id
    LEFT JOIN programs p ON b.program_id = p.program_id AND b.tenant_id = p.tenant_id
    LEFT JOIN centers c ON p.center_id = c.center_id AND p.tenant_id = c.tenant_id
    LEFT JOIN institutes i ON c.institute_id = i.institute_id AND c.tenant_id = i.tenant_id
    WHERE e.student_id = $1 AND e.tenant_id = $2
    ORDER BY e.start_date DESC, e.created_at DESC
  `;
  
  const result = await query(sql, [studentId, tenantId]);
  return result.rows;
}

/**
 * Bulk enrollment creation from CSV import
 */
async function bulkCreateEnrollments(tenantId, enrollments) {
  if (!Array.isArray(enrollments) || enrollments.length === 0) {
    throw new Error('Validation failed: enrollments must be a non-empty array');
  }
  
  const results = {
    successful: [],
    failed: []
  };
  
  return await transaction(async (client) => {
    for (const enrollment of enrollments) {
      try {
        // Validate required fields
        if (!enrollment.studentId || !enrollment.batchId || !enrollment.startDate) {
          throw new Error('Missing required fields: studentId, batchId, or startDate');
        }
        
        // Validate student exists
        await validateStudent(enrollment.studentId, tenantId, client);
        
        // Validate batch exists
        await validateBatch(enrollment.batchId, tenantId, client);
        
        // Check for duplicate enrollment
        const existingEnrollment = await checkDuplicateEnrollment(
          enrollment.studentId,
          enrollment.batchId,
          tenantId,
          client
        );
        
        if (existingEnrollment) {
          throw new Error(
            `Student is already enrolled in this batch with status '${existingEnrollment.status}'`
          );
        }
        
        // Validate dates
        if (enrollment.endDate && new Date(enrollment.startDate) > new Date(enrollment.endDate)) {
          throw new Error('start_date must be before end_date');
        }
        
        // Validate status
        const status = enrollment.status || 'active';
        const validStatuses = ['active', 'inactive', 'graduated', 'withdrawn'];
        if (!validStatuses.includes(status)) {
          throw new Error(`status must be one of ${validStatuses.join(', ')}`);
        }
        
        // Create enrollment
        const sql = `
          INSERT INTO enrollments (tenant_id, student_id, batch_id, start_date, end_date, status, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `;
        
        const result = await client.query(sql, [
          tenantId,
          enrollment.studentId,
          enrollment.batchId,
          enrollment.startDate,
          enrollment.endDate || null,
          status,
          enrollment.metadata || {}
        ]);
        
        results.successful.push({
          enrollment: result.rows[0],
          originalData: enrollment
        });
      } catch (error) {
        results.failed.push({
          enrollment,
          error: error.message
        });
      }
    }
    
    return results;
  });
}

/**
 * Delete enrollment (soft delete by setting status to withdrawn)
 */
async function deleteEnrollment(enrollmentId, tenantId) {
  return await updateEnrollmentStatus(enrollmentId, tenantId, 'withdrawn', {
    deleted_at: new Date().toISOString()
  });
}

module.exports = {
  createEnrollment,
  getEnrollmentById,
  listEnrollments,
  updateEnrollmentStatus,
  updateEnrollmentDates,
  getStudentEnrollmentHistory,
  bulkCreateEnrollments,
  deleteEnrollment
};
