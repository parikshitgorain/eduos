/**
 * Rule Evaluation Trigger Utility
 * 
 * Provides helper functions to trigger rule evaluation when data changes
 * (attendance, grades, etc.)
 */

const academicRuleService = require('../services/academicRuleService');

/**
 * Trigger rule evaluation after attendance update
 * @param {string} studentId - Student ID
 * @param {string} tenantId - Tenant ID
 * @param {Object} db - Database connection
 * @param {Object} redis - Redis client
 * @returns {Promise<Array>} Evaluation results
 */
async function triggerAttendanceRuleEvaluation(studentId, tenantId, db, redis) {
  try {
    // Calculate current attendance percentage
    const attendanceData = await db('attendance')
      .where({ student_id: studentId, tenant_id: tenantId })
      .select(db.raw('COUNT(*) as total_sessions'))
      .select(db.raw("COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count"))
      .first();

    const totalSessions = parseInt(attendanceData.total_sessions) || 0;
    const presentCount = parseInt(attendanceData.present_count) || 0;
    
    if (totalSessions === 0) {
      return [];
    }

    const attendancePercentage = (presentCount / totalSessions) * 100;

    // Build evaluation context
    const context = {
      attendance_percentage: attendancePercentage,
      total_sessions: totalSessions,
      present_count: presentCount,
      absent_count: totalSessions - presentCount
    };

    // Initialize service and evaluate
    academicRuleService.initialize(db, redis);
    const evaluations = await academicRuleService.evaluateRulesForStudent(
      studentId,
      tenantId,
      context
    );

    return evaluations;
  } catch (error) {
    console.error('Error triggering attendance rule evaluation:', error);
    throw error;
  }
}

/**
 * Trigger rule evaluation after grade update
 * @param {string} studentId - Student ID
 * @param {string} tenantId - Tenant ID
 * @param {number} grade - Grade value
 * @param {number} marks - Marks obtained
 * @param {number} maxMarks - Maximum marks
 * @param {Object} db - Database connection
 * @param {Object} redis - Redis client
 * @returns {Promise<Array>} Evaluation results
 */
async function triggerGradeRuleEvaluation(studentId, tenantId, grade, marks, maxMarks, db, redis) {
  try {
    // Build evaluation context
    const context = {
      grade: grade,
      marks: marks,
      max_marks: maxMarks,
      percentage: maxMarks > 0 ? (marks / maxMarks) * 100 : 0
    };

    // Initialize service and evaluate
    academicRuleService.initialize(db, redis);
    const evaluations = await academicRuleService.evaluateRulesForStudent(
      studentId,
      tenantId,
      context
    );

    return evaluations;
  } catch (error) {
    console.error('Error triggering grade rule evaluation:', error);
    throw error;
  }
}

/**
 * Trigger rule evaluation for multiple students (batch processing)
 * @param {Array} studentIds - Array of student IDs
 * @param {string} tenantId - Tenant ID
 * @param {Object} context - Evaluation context
 * @param {Object} db - Database connection
 * @param {Object} redis - Redis client
 * @returns {Promise<Object>} Batch evaluation results
 */
async function triggerBatchRuleEvaluation(studentIds, tenantId, context, db, redis) {
  try {
    academicRuleService.initialize(db, redis);
    
    const results = {
      total: studentIds.length,
      evaluated: 0,
      failed: 0,
      evaluations: []
    };

    for (const studentId of studentIds) {
      try {
        const evaluations = await academicRuleService.evaluateRulesForStudent(
          studentId,
          tenantId,
          context
        );
        
        results.evaluated++;
        results.evaluations.push({
          student_id: studentId,
          success: true,
          evaluations: evaluations
        });
      } catch (error) {
        results.failed++;
        results.evaluations.push({
          student_id: studentId,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error triggering batch rule evaluation:', error);
    throw error;
  }
}

module.exports = {
  triggerAttendanceRuleEvaluation,
  triggerGradeRuleEvaluation,
  triggerBatchRuleEvaluation
};
