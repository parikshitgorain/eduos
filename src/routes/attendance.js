/**
 * Attendance Routes
 * 
 * API endpoints for offline-first attendance tracking and sync.
 */

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const AttendanceService = require('../services/attendanceService');

/**
 * POST /api/v1/attendance/sync
 * 
 * Sync offline attendance events from mobile device.
 * Implements idempotent sync with conflict resolution.
 * 
 * Request Body:
 * {
 *   "events": [
 *     {
 *       "event_id": "uuid-v4",
 *       "device_id": "device-identifier",
 *       "user_id": "teacher-uuid",
 *       "client_ts": "2026-02-04T09:15:30+05:30",
 *       "client_local_time": "2026-02-04T09:15:30+05:30",
 *       "event_type": "attendance_mark",
 *       "data": {
 *         "batch_id": "batch-uuid",
 *         "session_id": "session-uuid",
 *         "student_id": "student-uuid",
 *         "status": "present | absent | late",
 *         "location": {
 *           "latitude": 12.9716,
 *           "longitude": 77.5946,
 *           "accuracy_meters": 10
 *         }
 *       }
 *     }
 *   ]
 * }
 * 
 * Response:
 * {
 *   "status": "success",
 *   "synced_events": 25,
 *   "conflicts_resolved": 2,
 *   "errors": 0,
 *   "details": [...]
 * }
 */
router.post(
  '/sync',
  [
    body('events').isArray().withMessage('events must be an array'),
    body('events.*.event_id').notEmpty().withMessage('event_id is required'),
    body('events.*.device_id').notEmpty().withMessage('device_id is required'),
    body('events.*.user_id').notEmpty().withMessage('user_id is required'),
    body('events.*.client_ts').isISO8601().withMessage('client_ts must be ISO 8601 format'),
    body('events.*.data').isObject().withMessage('data must be an object'),
    body('events.*.data.student_id').notEmpty().withMessage('data.student_id is required'),
    body('events.*.data.session_id').notEmpty().withMessage('data.session_id is required'),
    body('events.*.data.status').isIn(['present', 'absent', 'late']).withMessage('data.status must be present, absent, or late')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }

    try {
      // Get tenant_id from request context (set by tenantContext middleware)
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({
          status: 'error',
          message: 'Tenant ID is required'
        });
      }

      // Initialize attendance service
      const attendanceService = new AttendanceService(req.db, req.redis);

      // Sync events
      const result = await attendanceService.syncOfflineEvents(
        req.body.events,
        tenantId
      );

      // Return response
      res.status(200).json({
        status: 'success',
        synced_events: result.synced,
        conflicts_resolved: result.conflicts,
        errors: result.errors,
        details: result.details
      });

    } catch (error) {
      console.error('Attendance sync error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error during sync',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/v1/attendance/session/:sessionId
 * 
 * Get all attendance records for a specific session.
 * 
 * Response:
 * {
 *   "status": "success",
 *   "session_id": "session-uuid",
 *   "records": [...]
 * }
 */
router.get(
  '/session/:sessionId',
  [
    param('sessionId').isUUID().withMessage('sessionId must be a valid UUID')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }

    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({
          status: 'error',
          message: 'Tenant ID is required'
        });
      }

      const attendanceService = new AttendanceService(req.db, req.redis);
      const records = await attendanceService.getSessionAttendance(
        req.params.sessionId,
        tenantId
      );

      res.status(200).json({
        status: 'success',
        session_id: req.params.sessionId,
        count: records.length,
        records: records
      });

    } catch (error) {
      console.error('Get session attendance error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/v1/attendance/conflicts
 * 
 * Get pending sync conflicts for admin review.
 * 
 * Query Parameters:
 * - limit: Maximum number of conflicts to return (default: 50)
 * 
 * Response:
 * {
 *   "status": "success",
 *   "count": 10,
 *   "conflicts": [...]
 * }
 */
router.get(
  '/conflicts',
  async (req, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({
          status: 'error',
          message: 'Tenant ID is required'
        });
      }

      const limit = parseInt(req.query.limit) || 50;
      const attendanceService = new AttendanceService(req.db, req.redis);
      const conflicts = await attendanceService.getPendingConflicts(tenantId, limit);

      res.status(200).json({
        status: 'success',
        count: conflicts.length,
        conflicts: conflicts
      });

    } catch (error) {
      console.error('Get conflicts error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: error.message
      });
    }
  }
);

module.exports = router;
