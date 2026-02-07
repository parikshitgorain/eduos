/**
 * Attendance Service
 * 
 * Handles offline-first attendance tracking with sync and conflict resolution.
 * Implements idempotent sync operations and timezone normalization.
 */

const crypto = require('crypto');

class AttendanceService {
  constructor(db, redis) {
    this.db = db;
    this.redis = redis;
  }

  /**
   * Generate idempotency key for an event
   * @param {string} eventId - Event UUID
   * @param {string} deviceId - Device identifier
   * @param {string} clientTs - Client timestamp
   * @returns {string} SHA-256 hash
   */
  generateIdempotencyKey(eventId, deviceId, clientTs) {
    const data = `${eventId}:${deviceId}:${clientTs}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Check if an event has already been processed (idempotency check)
   * @param {string} idempotencyKey - Idempotency key
   * @returns {Promise<boolean>} True if already processed
   */
  async isEventProcessed(idempotencyKey) {
    const key = `idempotency:attendance:${idempotencyKey}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * Mark an event as processed in Redis cache
   * @param {string} idempotencyKey - Idempotency key
   * @param {number} ttl - Time to live in seconds (default: 24 hours)
   */
  async markEventProcessed(idempotencyKey, ttl = 86400) {
    const key = `idempotency:attendance:${idempotencyKey}`;
    await this.redis.setex(key, ttl, 'processed');
  }

  /**
   * Validate attendance event data
   * @param {Object} event - Attendance event
   * @returns {Object} Validation result
   */
  validateEvent(event) {
    const errors = [];

    if (!event.event_id) errors.push('event_id is required');
    if (!event.device_id) errors.push('device_id is required');
    if (!event.user_id) errors.push('user_id is required');
    if (!event.client_ts) errors.push('client_ts is required');
    if (!event.data) errors.push('data is required');
    
    // Validate timestamp is not in the future
    if (event.client_ts) {
      const timestampValidation = this.validateTimestamp(event.client_ts);
      if (!timestampValidation.valid) {
        errors.push(`Invalid timestamp: ${timestampValidation.error}`);
      }
    }
    
    if (event.data) {
      if (!event.data.student_id) errors.push('data.student_id is required');
      if (!event.data.session_id) errors.push('data.session_id is required');
      if (!event.data.status) errors.push('data.status is required');
      
      const validStatuses = ['present', 'absent', 'late'];
      if (event.data.status && !validStatuses.includes(event.data.status)) {
        errors.push(`data.status must be one of: ${validStatuses.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Normalize client timestamp to UTC
   * @param {string} clientTs - Client timestamp with timezone (ISO 8601)
   * @returns {Date} UTC timestamp
   */
  normalizeTimestamp(clientTs) {
    return new Date(clientTs);
  }

  /**
   * Validate timestamp is not in the future
   * @param {string} clientTs - Client timestamp
   * @param {number} toleranceMs - Tolerance in milliseconds (default: 5 minutes)
   * @returns {Object} Validation result
   */
  validateTimestamp(clientTs, toleranceMs = 300000) {
    const timestamp = new Date(clientTs);
    const now = new Date();
    const maxAllowed = new Date(now.getTime() + toleranceMs);

    if (timestamp > maxAllowed) {
      return {
        valid: false,
        error: 'Timestamp is in the future',
        timestamp: timestamp.toISOString(),
        maxAllowed: maxAllowed.toISOString()
      };
    }

    return { valid: true };
  }

  /**
   * Convert UTC timestamp to client timezone
   * @param {Date} utcTimestamp - UTC timestamp
   * @param {string} timezone - IANA timezone (e.g., 'Asia/Kolkata')
   * @returns {string} ISO 8601 string in client timezone
   */
  convertToClientTimezone(utcTimestamp, timezone) {
    if (!timezone) {
      return utcTimestamp.toISOString();
    }

    try {
      // Use Intl.DateTimeFormat for timezone conversion
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      const parts = formatter.formatToParts(utcTimestamp);
      const dateParts = {};
      parts.forEach(part => {
        if (part.type !== 'literal') {
          dateParts[part.type] = part.value;
        }
      });

      // Construct ISO 8601 string
      return `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}`;
    } catch (error) {
      // Fallback to UTC if timezone conversion fails
      return utcTimestamp.toISOString();
    }
  }

  /**
   * Check for existing attendance record (conflict detection)
   * @param {string} studentId - Student UUID
   * @param {string} sessionId - Session UUID
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<Object|null>} Existing record or null
   */
  async findExistingRecord(studentId, sessionId, tenantId) {
    const query = `
      SELECT 
        event_id,
        student_id,
        session_id,
        status,
        marked_at_utc,
        client_local_time,
        marked_by,
        device_id
      FROM attendance_records
      WHERE student_id = $1 
        AND session_id = $2 
        AND tenant_id = $3
      ORDER BY marked_at_utc ASC
      LIMIT 1
    `;
    
    const result = await this.db.query(query, [studentId, sessionId, tenantId]);
    return result.rows[0] || null;
  }

  /**
   * Apply "Earliest Client Timestamp" conflict resolution rule
   * @param {Object} existingRecord - Existing attendance record
   * @param {Object} newEvent - New event being synced
   * @returns {Object} Resolution decision
   */
  resolveConflict(existingRecord, newEvent) {
    const existingTs = new Date(existingRecord.marked_at_utc);
    const newTs = this.normalizeTimestamp(newEvent.client_ts);

    if (newTs < existingTs) {
      return {
        action: 'replace',
        winner: 'new',
        reason: 'Earlier client timestamp',
        existingTs: existingTs.toISOString(),
        newTs: newTs.toISOString()
      };
    } else {
      return {
        action: 'reject',
        winner: 'existing',
        reason: 'Later client timestamp',
        existingTs: existingTs.toISOString(),
        newTs: newTs.toISOString()
      };
    }
  }

  /**
   * Log sync conflict for admin review
   * @param {Object} conflict - Conflict details
   * @param {string} tenantId - Tenant UUID
   */
  async logConflict(conflict, tenantId) {
    const query = `
      INSERT INTO sync_conflicts (
        conflict_id,
        tenant_id,
        session_id,
        student_id,
        winning_event_id,
        rejected_event_id,
        resolution_rule,
        conflict_details,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `;

    const conflictId = crypto.randomUUID();
    await this.db.query(query, [
      conflictId,
      tenantId,
      conflict.sessionId,
      conflict.studentId,
      conflict.winningEventId,
      conflict.rejectedEventId,
      'earliest_client_timestamp',
      JSON.stringify(conflict.details)
    ]);

    return conflictId;
  }

  /**
   * Store attendance record in database
   * @param {Object} event - Attendance event
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<Object>} Stored record
   */
  async storeAttendanceRecord(event, tenantId) {
    const markedAtUtc = this.normalizeTimestamp(event.client_ts);
    
    const query = `
      INSERT INTO attendance_records (
        event_id,
        tenant_id,
        student_id,
        session_id,
        batch_id,
        status,
        marked_by,
        marked_at_utc,
        client_local_time,
        device_id,
        location,
        sync_status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING *
    `;

    const result = await this.db.query(query, [
      event.event_id,
      tenantId,
      event.data.student_id,
      event.data.session_id,
      event.data.batch_id || null,
      event.data.status,
      event.user_id,
      markedAtUtc,
      event.client_local_time || event.client_ts,
      event.device_id,
      event.data.location ? JSON.stringify(event.data.location) : null,
      'synced'
    ]);

    return result.rows[0];
  }

  /**
   * Update existing attendance record (conflict resolution)
   * @param {string} eventId - Event ID to replace
   * @param {Object} newEvent - New event data
   * @param {string} tenantId - Tenant UUID
   */
  async updateAttendanceRecord(eventId, newEvent, tenantId) {
    const markedAtUtc = this.normalizeTimestamp(newEvent.client_ts);
    
    const query = `
      UPDATE attendance_records
      SET 
        event_id = $1,
        status = $2,
        marked_by = $3,
        marked_at_utc = $4,
        client_local_time = $5,
        device_id = $6,
        location = $7,
        conflict_resolved = true,
        updated_at = NOW()
      WHERE event_id = $8 AND tenant_id = $9
      RETURNING *
    `;

    const result = await this.db.query(query, [
      newEvent.event_id,
      newEvent.data.status,
      newEvent.user_id,
      markedAtUtc,
      newEvent.client_local_time || newEvent.client_ts,
      newEvent.device_id,
      newEvent.data.location ? JSON.stringify(newEvent.data.location) : null,
      eventId,
      tenantId
    ]);

    return result.rows[0];
  }

  /**
   * Sync offline attendance events from mobile device
   * @param {Array} events - Array of offline events
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<Object>} Sync result
   */
  async syncOfflineEvents(events, tenantId) {
    const results = {
      synced: 0,
      conflicts: 0,
      errors: 0,
      details: []
    };

    for (const event of events) {
      try {
        // Validate event
        const validation = this.validateEvent(event);
        if (!validation.valid) {
          results.errors++;
          results.details.push({
            event_id: event.event_id,
            status: 'error',
            errors: validation.errors
          });
          continue;
        }

        // Generate idempotency key
        const idempotencyKey = this.generateIdempotencyKey(
          event.event_id,
          event.device_id,
          event.client_ts
        );

        // Check if already processed
        const alreadyProcessed = await this.isEventProcessed(idempotencyKey);
        if (alreadyProcessed) {
          results.details.push({
            event_id: event.event_id,
            status: 'duplicate',
            message: 'Event already processed'
          });
          continue;
        }

        // Check for existing record (conflict detection)
        const existingRecord = await this.findExistingRecord(
          event.data.student_id,
          event.data.session_id,
          tenantId
        );

        if (existingRecord) {
          // Conflict detected - apply resolution rule
          const resolution = this.resolveConflict(existingRecord, event);
          
          if (resolution.action === 'replace') {
            // New event wins - update existing record
            await this.updateAttendanceRecord(
              existingRecord.event_id,
              event,
              tenantId
            );

            // Log conflict
            await this.logConflict({
              sessionId: event.data.session_id,
              studentId: event.data.student_id,
              winningEventId: event.event_id,
              rejectedEventId: existingRecord.event_id,
              details: resolution
            }, tenantId);

            results.conflicts++;
            results.details.push({
              event_id: event.event_id,
              status: 'conflict_resolved',
              resolution: resolution
            });
          } else {
            // Existing record wins - reject new event
            await this.logConflict({
              sessionId: event.data.session_id,
              studentId: event.data.student_id,
              winningEventId: existingRecord.event_id,
              rejectedEventId: event.event_id,
              details: resolution
            }, tenantId);

            results.conflicts++;
            results.details.push({
              event_id: event.event_id,
              status: 'conflict_rejected',
              resolution: resolution
            });
          }
        } else {
          // No conflict - store new record
          await this.storeAttendanceRecord(event, tenantId);
          results.synced++;
          results.details.push({
            event_id: event.event_id,
            status: 'synced'
          });
        }

        // Mark event as processed
        await this.markEventProcessed(idempotencyKey);

      } catch (error) {
        results.errors++;
        results.details.push({
          event_id: event.event_id,
          status: 'error',
          message: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get attendance records for a session
   * @param {string} sessionId - Session UUID
   * @param {string} tenantId - Tenant UUID
   * @param {string} timezone - Optional IANA timezone for timestamp conversion
   * @returns {Promise<Array>} Attendance records
   */
  async getSessionAttendance(sessionId, tenantId, timezone = null) {
    const query = `
      SELECT 
        event_id,
        student_id,
        session_id,
        batch_id,
        status,
        marked_by,
        marked_at_utc,
        client_local_time,
        device_id,
        location,
        conflict_resolved,
        created_at
      FROM attendance_records
      WHERE session_id = $1 AND tenant_id = $2
      ORDER BY marked_at_utc ASC
    `;

    const result = await this.db.query(query, [sessionId, tenantId]);
    
    // Convert timestamps to client timezone if requested
    if (timezone) {
      return result.rows.map(record => ({
        ...record,
        marked_at_client: this.convertToClientTimezone(record.marked_at_utc, timezone),
        marked_at_utc: record.marked_at_utc.toISOString()
      }));
    }
    
    return result.rows;
  }

  /**
   * Get pending sync conflicts for admin review
   * @param {string} tenantId - Tenant UUID
   * @param {number} limit - Maximum number of conflicts to return
   * @returns {Promise<Array>} Conflict records
   */
  async getPendingConflicts(tenantId, limit = 50) {
    const query = `
      SELECT 
        conflict_id,
        session_id,
        student_id,
        winning_event_id,
        rejected_event_id,
        resolution_rule,
        conflict_details,
        created_at
      FROM sync_conflicts
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await this.db.query(query, [tenantId, limit]);
    return result.rows;
  }

  /**
   * Calculate attendance rate for a student
   * @param {string} studentId - Student UUID
   * @param {string} tenantId - Tenant UUID
   * @param {Date} startDate - Start date for calculation
   * @param {Date} endDate - End date for calculation
   * @returns {Promise<Object>} Attendance statistics
   */
  async calculateAttendanceRate(studentId, tenantId, startDate, endDate) {
    const query = `
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_count,
        COUNT(CASE WHEN status = 'late' THEN 1 END) as late_count
      FROM attendance_records
      WHERE student_id = $1 
        AND tenant_id = $2
        AND marked_at_utc >= $3
        AND marked_at_utc <= $4
    `;

    const result = await this.db.query(query, [studentId, tenantId, startDate, endDate]);
    const stats = result.rows[0];

    const totalSessions = parseInt(stats.total_sessions);
    const presentCount = parseInt(stats.present_count);
    const lateCount = parseInt(stats.late_count);

    // Calculate attendance rate: (present + late) / total × 100
    const attendanceRate = totalSessions > 0 
      ? ((presentCount + lateCount) / totalSessions * 100).toFixed(2)
      : 0;

    return {
      student_id: studentId,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      total_sessions: totalSessions,
      present: presentCount,
      absent: parseInt(stats.absent_count),
      late: lateCount,
      attendance_rate: parseFloat(attendanceRate)
    };
  }

  /**
   * Generate attendance report for multiple students
   * @param {Object} filters - Report filters
   * @param {string} filters.tenantId - Tenant UUID
   * @param {Array<string>} filters.studentIds - Optional array of student IDs
   * @param {string} filters.batchId - Optional batch ID
   * @param {string} filters.programId - Optional program ID
   * @param {Date} filters.startDate - Start date
   * @param {Date} filters.endDate - End date
   * @param {string} filters.reportType - Report type: 'daily', 'weekly', 'monthly', 'custom'
   * @returns {Promise<Object>} Attendance report
   */
  async generateAttendanceReport(filters) {
    const { tenantId, studentIds, batchId, programId, startDate, endDate, reportType = 'custom' } = filters;

    // Build dynamic query based on filters
    let whereConditions = ['ar.tenant_id = $1'];
    let queryParams = [tenantId];
    let paramIndex = 2;

    if (studentIds && studentIds.length > 0) {
      whereConditions.push(`ar.student_id = ANY($${paramIndex})`);
      queryParams.push(studentIds);
      paramIndex++;
    }

    if (batchId) {
      whereConditions.push(`ar.batch_id = $${paramIndex}`);
      queryParams.push(batchId);
      paramIndex++;
    }

    if (startDate) {
      whereConditions.push(`ar.marked_at_utc >= $${paramIndex}`);
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`ar.marked_at_utc <= $${paramIndex}`);
      queryParams.push(endDate);
      paramIndex++;
    }

    const query = `
      SELECT 
        ar.student_id,
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as absent_count,
        COUNT(CASE WHEN ar.status = 'late' THEN 1 END) as late_count,
        MIN(ar.marked_at_utc) as first_attendance,
        MAX(ar.marked_at_utc) as last_attendance
      FROM attendance_records ar
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY ar.student_id
      ORDER BY ar.student_id
    `;

    const result = await this.db.query(query, queryParams);

    // Calculate attendance rates for each student
    const studentReports = result.rows.map(row => {
      const totalSessions = parseInt(row.total_sessions);
      const presentCount = parseInt(row.present_count);
      const lateCount = parseInt(row.late_count);
      const attendanceRate = totalSessions > 0 
        ? ((presentCount + lateCount) / totalSessions * 100).toFixed(2)
        : 0;

      return {
        student_id: row.student_id,
        total_sessions: totalSessions,
        present: presentCount,
        absent: parseInt(row.absent_count),
        late: lateCount,
        attendance_rate: parseFloat(attendanceRate),
        first_attendance: row.first_attendance,
        last_attendance: row.last_attendance
      };
    });

    // Calculate aggregate statistics
    const totalStudents = studentReports.length;
    const avgAttendanceRate = totalStudents > 0
      ? (studentReports.reduce((sum, s) => sum + s.attendance_rate, 0) / totalStudents).toFixed(2)
      : 0;

    return {
      report_type: reportType,
      period: {
        start: startDate ? startDate.toISOString() : null,
        end: endDate ? endDate.toISOString() : null
      },
      filters: {
        batch_id: batchId || null,
        program_id: programId || null,
        student_count: totalStudents
      },
      summary: {
        total_students: totalStudents,
        average_attendance_rate: parseFloat(avgAttendanceRate)
      },
      students: studentReports,
      generated_at: new Date().toISOString()
    };
  }

  /**
   * Export attendance report to CSV format
   * @param {Object} report - Attendance report data
   * @returns {string} CSV formatted string
   */
  exportToCSV(report) {
    const headers = [
      'Student ID',
      'Total Sessions',
      'Present',
      'Absent',
      'Late',
      'Attendance Rate (%)',
      'First Attendance',
      'Last Attendance'
    ];

    const rows = report.students.map(student => [
      student.student_id,
      student.total_sessions,
      student.present,
      student.absent,
      student.late,
      student.attendance_rate,
      student.first_attendance || 'N/A',
      student.last_attendance || 'N/A'
    ]);

    // Build CSV string
    const csvLines = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ];

    return csvLines.join('\n');
  }

  /**
   * Get daily attendance summary
   * @param {string} tenantId - Tenant UUID
   * @param {Date} date - Date for daily report
   * @param {string} batchId - Optional batch ID filter
   * @returns {Promise<Object>} Daily attendance summary
   */
  async getDailyAttendanceSummary(tenantId, date, batchId = null) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.generateAttendanceReport({
      tenantId,
      batchId,
      startDate: startOfDay,
      endDate: endOfDay,
      reportType: 'daily'
    });
  }

  /**
   * Get weekly attendance summary
   * @param {string} tenantId - Tenant UUID
   * @param {Date} weekStartDate - Start of week
   * @param {string} batchId - Optional batch ID filter
   * @returns {Promise<Object>} Weekly attendance summary
   */
  async getWeeklyAttendanceSummary(tenantId, weekStartDate, batchId = null) {
    const endOfWeek = new Date(weekStartDate);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return this.generateAttendanceReport({
      tenantId,
      batchId,
      startDate: weekStartDate,
      endDate: endOfWeek,
      reportType: 'weekly'
    });
  }

  /**
   * Get monthly attendance summary
   * @param {string} tenantId - Tenant UUID
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @param {string} batchId - Optional batch ID filter
   * @returns {Promise<Object>} Monthly attendance summary
   */
  async getMonthlyAttendanceSummary(tenantId, year, month, batchId = null) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    return this.generateAttendanceReport({
      tenantId,
      batchId,
      startDate: startOfMonth,
      endDate: endOfMonth,
      reportType: 'monthly'
    });
  }
}

module.exports = AttendanceService;
