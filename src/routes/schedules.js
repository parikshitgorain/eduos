const express = require('express');
const router = express.Router();
const schedulingService = require('../services/schedulingService');

/**
 * @route POST /api/v1/schedules/validate
 * @desc Validate a schedule slot for conflicts
 * @access Private
 */
router.post('/validate', async (req, res) => {
  try {
    const {
      room_id,
      teacher_id,
      batch_id,
      day_of_week,
      start_time,
      end_time,
      effective_from,
      effective_to,
      exclude_slot_id
    } = req.body;

    // Get tenant_id from request context (set by tenantContext middleware)
    const tenant_id = req.tenantId || req.body.tenant_id;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }

    // Validate required fields
    if (!room_id || !teacher_id || !batch_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: room_id, teacher_id, batch_id'
      });
    }

    if (day_of_week === undefined || day_of_week < 0 || day_of_week > 6) {
      return res.status(400).json({
        success: false,
        error: 'day_of_week must be between 0 (Sunday) and 6 (Saturday)'
      });
    }

    if (!start_time || !end_time) {
      return res.status(400).json({
        success: false,
        error: 'start_time and end_time are required'
      });
    }

    if (!effective_from) {
      return res.status(400).json({
        success: false,
        error: 'effective_from date is required'
      });
    }

    // Validate the schedule slot
    const validation = await schedulingService.validateScheduleSlot({
      tenant_id,
      room_id,
      teacher_id,
      batch_id,
      day_of_week,
      start_time,
      end_time,
      effective_from,
      effective_to,
      exclude_slot_id
    });

    res.json({
      success: true,
      data: validation
    });

  } catch (error) {
    console.error('Schedule validation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate schedule'
    });
  }
});

/**
 * @route POST /api/v1/schedules
 * @desc Create a new schedule slot
 * @access Private
 */
router.post('/', async (req, res) => {
  try {
    const {
      room_id,
      teacher_id,
      batch_id,
      subject_id,
      day_of_week,
      start_time,
      end_time,
      effective_from,
      effective_to,
      is_recurring,
      recurrence_pattern,
      notes
    } = req.body;

    // Get tenant_id and user_id from request context
    const tenant_id = req.tenantId || req.body.tenant_id;
    const created_by = req.userId || req.body.created_by;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }

    // Create the schedule slot
    const slot = await schedulingService.createScheduleSlot({
      tenant_id,
      room_id,
      teacher_id,
      batch_id,
      subject_id,
      day_of_week,
      start_time,
      end_time,
      effective_from,
      effective_to,
      is_recurring,
      recurrence_pattern,
      notes,
      created_by
    });

    res.status(201).json({
      success: true,
      data: slot
    });

  } catch (error) {
    console.error('Schedule creation error:', error);
    
    // Check if it's a conflict error
    if (error.message.includes('conflicts detected')) {
      return res.status(409).json({
        success: false,
        error: error.message,
        conflict: true
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create schedule'
    });
  }
});

/**
 * @route GET /api/v1/schedules
 * @desc Get schedule slots with filters
 * @access Private
 */
router.get('/', async (req, res) => {
  try {
    const tenant_id = req.tenantId || req.query.tenant_id;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }

    const filters = {
      room_id: req.query.room_id,
      teacher_id: req.query.teacher_id,
      batch_id: req.query.batch_id,
      day_of_week: req.query.day_of_week ? parseInt(req.query.day_of_week) : undefined,
      status: req.query.status,
      effective_date: req.query.effective_date
    };

    const slots = await schedulingService.getScheduleSlots(tenant_id, filters);

    res.json({
      success: true,
      data: slots,
      count: slots.length
    });

  } catch (error) {
    console.error('Schedule retrieval error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve schedules'
    });
  }
});

/**
 * @route GET /api/v1/schedules/:slot_id
 * @desc Get a specific schedule slot
 * @access Private
 */
router.get('/:slot_id', async (req, res) => {
  try {
    const { slot_id } = req.params;
    const tenant_id = req.tenantId || req.query.tenant_id;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }

    const slot = await schedulingService.getScheduleSlot(slot_id, tenant_id);

    res.json({
      success: true,
      data: slot
    });

  } catch (error) {
    console.error('Schedule retrieval error:', error);
    
    if (error.message === 'Schedule slot not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve schedule'
    });
  }
});

/**
 * @route PUT /api/v1/schedules/:slot_id
 * @desc Update a schedule slot
 * @access Private
 */
router.put('/:slot_id', async (req, res) => {
  try {
    const { slot_id } = req.params;
    const tenant_id = req.tenantId || req.body.tenant_id;
    const updated_by = req.userId || req.body.updated_by;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }

    const updates = {
      tenant_id,
      ...req.body,
      updated_by
    };

    const slot = await schedulingService.updateScheduleSlot(slot_id, updates);

    res.json({
      success: true,
      data: slot
    });

  } catch (error) {
    console.error('Schedule update error:', error);
    
    if (error.message.includes('conflicts detected')) {
      return res.status(409).json({
        success: false,
        error: error.message,
        conflict: true
      });
    }

    if (error.message === 'Schedule slot not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update schedule'
    });
  }
});

/**
 * @route DELETE /api/v1/schedules/:slot_id
 * @desc Delete (cancel) a schedule slot
 * @access Private
 */
router.delete('/:slot_id', async (req, res) => {
  try {
    const { slot_id } = req.params;
    const tenant_id = req.tenantId || req.query.tenant_id;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }

    const success = await schedulingService.deleteScheduleSlot(slot_id, tenant_id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Schedule slot not found'
      });
    }

    res.json({
      success: true,
      message: 'Schedule slot cancelled successfully'
    });

  } catch (error) {
    console.error('Schedule deletion error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete schedule'
    });
  }
});

/**
 * @route GET /api/v1/schedules/conflicts
 * @desc Get schedule conflicts
 * @access Private
 */
router.get('/conflicts/list', async (req, res) => {
  try {
    const tenant_id = req.tenantId || req.query.tenant_id;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }

    const filters = {
      status: req.query.status,
      conflict_type: req.query.conflict_type
    };

    const conflicts = await schedulingService.getConflicts(tenant_id, filters);

    res.json({
      success: true,
      data: conflicts,
      count: conflicts.length
    });

  } catch (error) {
    console.error('Conflict retrieval error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve conflicts'
    });
  }
});

module.exports = router;
