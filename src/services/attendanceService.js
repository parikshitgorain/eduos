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
   * @returns {Promise<Array>} Attendance records
   */
  async getSessionAttendance(sessionId, tenantId) {
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
}

module.exports = AttendanceService;
