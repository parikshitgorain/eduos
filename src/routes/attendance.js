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
 * Headers:
 * - Accept-Timezone: IANA timezone (e.g., 'Asia/Kolkata') for timestamp conversion
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

      // Get timezone from Accept-Timezone header
      const timezone = req.headers['accept-timezone'] || null;

      const attendanceService = new AttendanceService(req.db, req.redis);
      const records = await attendanceService.getSessionAttendance(
        req.params.sessionId,
        tenantId,
        timezone
      );

      res.status(200).json({
        status: 'success',
        session_id: req.params.sessionId,
        count: records.length,
        timezone: timezone || 'UTC',
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

/**
 * GET /api/v1/attendance/reports/student/:studentId
 * 
 * Get attendance rate for a specific student.
 * 
 * Query Parameters:
 * - startDate: Start date (ISO 8601)
 * - endDate: End date (ISO 8601)
 * 
 * Response:
 * {
 *   "status": "success",
 *   "report": {...}
 * }
 */
router.get(
  '/reports/student/:studentId',
  [
    param('studentId').isUUID().withMessage('studentId must be a valid UUID')
  ],
  async (req, res) => {
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

      const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

      const attendanceService = new AttendanceService(req.db, req.redis);
      const report = await attendanceService.calculateAttendanceRate(
        req.params.studentId,
        tenantId,
        startDate,
        endDate
      );

      res.status(200).json({
        status: 'success',
        report: report
      });

    } catch (error) {
      console.error('Get student attendance rate error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/v1/attendance/reports/generate
 * 
 * Generate attendance report with filters.
 * 
 * Request Body:
 * {
 *   "reportType": "daily | weekly | monthly | custom",
 *   "startDate": "2026-02-01T00:00:00Z",
 *   "endDate": "2026-02-07T23:59:59Z",
 *   "batchId": "batch-uuid",
 *   "studentIds": ["student-1", "student-2"],
 *   "format": "json | csv"
 * }
 * 
 * Response:
 * {
 *   "status": "success",
 *   "report": {...}
 * }
 */
router.post(
  '/reports/generate',
  [
    body('reportType').isIn(['daily', 'weekly', 'monthly', 'custom']).withMessage('reportType must be daily, weekly, monthly, or custom'),
    body('startDate').optional().isISO8601().withMessage('startDate must be ISO 8601 format'),
    body('endDate').optional().isISO8601().withMessage('endDate must be ISO 8601 format'),
    body('format').optional().isIn(['json', 'csv']).withMessage('format must be json or csv')
  ],
  async (req, res) => {
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

      const { reportType, startDate, endDate, batchId, studentIds, format = 'json' } = req.body;

      const attendanceService = new AttendanceService(req.db, req.redis);
      const report = await attendanceService.generateAttendanceReport({
        tenantId,
        reportType,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        batchId,
        studentIds
      });

      // Export to CSV if requested
      if (format === 'csv') {
        const csv = attendanceService.exportToCSV(report);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${Date.now()}.csv"`);
        return res.status(200).send(csv);
      }

      res.status(200).json({
        status: 'success',
        report: report
      });

    } catch (error) {
      console.error('Generate attendance report error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/v1/attendance/reports/daily
 * 
 * Get daily attendance summary.
 * 
 * Query Parameters:
 * - date: Date for report (ISO 8601, default: today)
 * - batchId: Optional batch ID filter
 * 
 * Response:
 * {
 *   "status": "success",
 *   "report": {...}
 * }
 */
router.get(
  '/reports/daily',
  async (req, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({
          status: 'error',
          message: 'Tenant ID is required'
        });
      }

      const date = req.query.date ? new Date(req.query.date) : new Date();
      const batchId = req.query.batchId || null;

      const attendanceService = new AttendanceService(req.db, req.redis);
      const report = await attendanceService.getDailyAttendanceSummary(tenantId, date, batchId);

      res.status(200).json({
        status: 'success',
        report: report
      });

    } catch (error) {
      console.error('Get daily attendance summary error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/v1/attendance/reports/weekly
 * 
 * Get weekly attendance summary.
 * 
 * Query Parameters:
 * - weekStart: Start of week (ISO 8601, default: this week)
 * - batchId: Optional batch ID filter
 * 
 * Response:
 * {
 *   "status": "success",
 *   "report": {...}
 * }
 */
router.get(
  '/reports/weekly',
  async (req, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({
          status: 'error',
          message: 'Tenant ID is required'
        });
      }

      const weekStart = req.query.weekStart ? new Date(req.query.weekStart) : new Date();
      const batchId = req.query.batchId || null;

      const attendanceService = new AttendanceService(req.db, req.redis);
      const report = await attendanceService.getWeeklyAttendanceSummary(tenantId, weekStart, batchId);

      res.status(200).json({
        status: 'success',
        report: report
      });

    } catch (error) {
      console.error('Get weekly attendance summary error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/v1/attendance/reports/monthly
 * 
 * Get monthly attendance summary.
 * 
 * Query Parameters:
 * - year: Year (default: current year)
 * - month: Month 1-12 (default: current month)
 * - batchId: Optional batch ID filter
 * 
 * Response:
 * {
 *   "status": "success",
 *   "report": {...}
 * }
 */
router.get(
  '/reports/monthly',
  async (req, res) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({
          status: 'error',
          message: 'Tenant ID is required'
        });
      }

      const now = new Date();
      const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();
      const month = req.query.month ? parseInt(req.query.month) : now.getMonth() + 1;
      const batchId = req.query.batchId || null;

      const attendanceService = new AttendanceService(req.db, req.redis);
      const report = await attendanceService.getMonthlyAttendanceSummary(tenantId, year, month, batchId);

      res.status(200).json({
        status: 'success',
        report: report
      });

    } catch (error) {
      console.error('Get monthly attendance summary error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: error.message
      });
    }
  }
);

module.exports = router;
