const pool = require('../config/database');

/**
 * Scheduling Service
 * Handles schedule management and conflict detection
 */
class SchedulingService {
  /**
   * Validate a schedule slot for conflicts
   * @param {Object} slotData - Schedule slot data
   * @returns {Promise<Object>} Validation result with conflicts
   */
  async validateScheduleSlot(slotData) {
    const {
      tenant_id,
      room_id,
      teacher_id,
      batch_id,
      day_of_week,
      start_time,
      end_time,
      effective_from,
      effective_to,
      exclude_slot_id = null
    } = slotData;

    // Input validation
    if (!tenant_id || !room_id || !teacher_id || !batch_id) {
      throw new Error('Missing required fields: tenant_id, room_id, teacher_id, batch_id');
    }

    if (day_of_week < 0 || day_of_week > 6) {
      throw new Error('day_of_week must be between 0 (Sunday) and 6 (Saturday)');
    }

    if (!start_time || !end_time) {
      throw new Error('start_time and end_time are required');
    }

    if (!effective_from) {
      throw new Error('effective_from date is required');
    }

    const client = await pool.connect();
    
    try {
      // Set tenant context for RLS
      await client.query('SET app.current_tenant_id = $1', [tenant_id]);

      // Call the conflict detection function
      const result = await client.query(
        `SELECT * FROM detect_schedule_conflicts($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          tenant_id,
          room_id,
          teacher_id,
          batch_id,
          day_of_week,
          start_time,
          end_time,
          effective_from,
          effective_to || null,
          exclude_slot_id
        ]
      );

      const conflicts = result.rows;

      return {
        valid: conflicts.length === 0,
        conflicts: conflicts.map(c => ({
          type: c.conflict_type,
          conflicting_slot_id: c.conflicting_slot_id,
          description: c.conflict_description
        })),
        conflict_count: conflicts.length
      };

    } finally {
      client.release();
    }
  }

  /**
   * Create a new schedule slot
   * @param {Object} slotData - Schedule slot data
   * @returns {Promise<Object>} Created schedule slot
   */
  async createScheduleSlot(slotData) {
    const {
      tenant_id,
      room_id,
      teacher_id,
      batch_id,
      subject_id,
      day_of_week,
      start_time,
      end_time,
      effective_from,
      effective_to = null,
      is_recurring = true,
      recurrence_pattern = 'weekly',
      notes = null,
      created_by
    } = slotData;

    // Validate for conflicts first
    const validation = await this.validateScheduleSlot({
      tenant_id,
      room_id,
      teacher_id,
      batch_id,
      day_of_week,
      start_time,
      end_time,
      effective_from,
      effective_to
    });

    if (!validation.valid) {
      throw new Error(`Schedule conflicts detected: ${JSON.stringify(validation.conflicts)}`);
    }

    const client = await pool.connect();
    
    try {
      // Set tenant context for RLS
      await client.query('SET app.current_tenant_id = $1', [tenant_id]);

      const result = await client.query(
        `INSERT INTO schedule_slots (
          tenant_id, room_id, teacher_id, batch_id, subject_id,
          day_of_week, start_time, end_time, effective_from, effective_to,
          is_recurring, recurrence_pattern, notes, created_by, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'active')
        RETURNING *`,
        [
          tenant_id, room_id, teacher_id, batch_id, subject_id,
          day_of_week, start_time, end_time, effective_from, effective_to,
          is_recurring, recurrence_pattern, notes, created_by
        ]
      );

      return result.rows[0];

    } finally {
      client.release();
    }
  }

  /**
   * Update an existing schedule slot
   * @param {string} slot_id - Schedule slot ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated schedule slot
   */
  async updateScheduleSlot(slot_id, updates) {
    const {
      tenant_id,
      room_id,
      teacher_id,
      batch_id,
      day_of_week,
      start_time,
      end_time,
      effective_from,
      effective_to,
      updated_by
    } = updates;

    // If time/resource changes, validate for conflicts
    if (room_id || teacher_id || batch_id || day_of_week || start_time || end_time) {
      // Get current slot data
      const currentSlot = await this.getScheduleSlot(slot_id, tenant_id);
      
      const validation = await this.validateScheduleSlot({
        tenant_id,
        room_id: room_id || currentSlot.room_id,
        teacher_id: teacher_id || currentSlot.teacher_id,
        batch_id: batch_id || currentSlot.batch_id,
        day_of_week: day_of_week !== undefined ? day_of_week : currentSlot.day_of_week,
        start_time: start_time || currentSlot.start_time,
        end_time: end_time || currentSlot.end_time,
        effective_from: effective_from || currentSlot.effective_from,
        effective_to: effective_to !== undefined ? effective_to : currentSlot.effective_to,
        exclude_slot_id: slot_id
      });

      if (!validation.valid) {
        throw new Error(`Schedule conflicts detected: ${JSON.stringify(validation.conflicts)}`);
      }
    }

    const client = await pool.connect();
    
    try {
      // Set tenant context for RLS
      await client.query('SET app.current_tenant_id = $1', [tenant_id]);

      // Build dynamic update query
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      if (room_id) {
        updateFields.push(`room_id = $${paramCount++}`);
        values.push(room_id);
      }
      if (teacher_id) {
        updateFields.push(`teacher_id = $${paramCount++}`);
        values.push(teacher_id);
      }
      if (batch_id) {
        updateFields.push(`batch_id = $${paramCount++}`);
        values.push(batch_id);
      }
      if (day_of_week !== undefined) {
        updateFields.push(`day_of_week = $${paramCount++}`);
        values.push(day_of_week);
      }
      if (start_time) {
        updateFields.push(`start_time = $${paramCount++}`);
        values.push(start_time);
      }
      if (end_time) {
        updateFields.push(`end_time = $${paramCount++}`);
        values.push(end_time);
      }
      if (effective_from) {
        updateFields.push(`effective_from = $${paramCount++}`);
        values.push(effective_from);
      }
      if (effective_to !== undefined) {
        updateFields.push(`effective_to = $${paramCount++}`);
        values.push(effective_to);
      }
      if (updated_by) {
        updateFields.push(`updated_by = $${paramCount++}`);
        values.push(updated_by);
      }

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(slot_id);
      const result = await client.query(
        `UPDATE schedule_slots 
         SET ${updateFields.join(', ')}
         WHERE slot_id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Schedule slot not found');
      }

      return result.rows[0];

    } finally {
      client.release();
    }
  }

  /**
   * Get a schedule slot by ID
   * @param {string} slot_id - Schedule slot ID
   * @param {string} tenant_id - Tenant ID
   * @returns {Promise<Object>} Schedule slot
   */
  async getScheduleSlot(slot_id, tenant_id) {
    const client = await pool.connect();
    
    try {
      // Set tenant context for RLS
      await client.query('SET app.current_tenant_id = $1', [tenant_id]);

      const result = await client.query(
        `SELECT s.*, 
                r.room_name, r.room_code,
                t.first_name as teacher_first_name, t.last_name as teacher_last_name,
                b.batch_name, b.batch_code,
                sub.subject_name, sub.subject_code
         FROM schedule_slots s
         JOIN rooms r ON s.room_id = r.room_id
         JOIN teachers t ON s.teacher_id = t.teacher_id
         JOIN batches b ON s.batch_id = b.batch_id
         JOIN subjects sub ON s.subject_id = sub.subject_id
         WHERE s.slot_id = $1`,
        [slot_id]
      );

      if (result.rows.length === 0) {
        throw new Error('Schedule slot not found');
      }

      return result.rows[0];

    } finally {
      client.release();
    }
  }

  /**
   * Get schedule slots for a tenant with filters
   * @param {string} tenant_id - Tenant ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Schedule slots
   */
  async getScheduleSlots(tenant_id, filters = {}) {
    const {
      room_id,
      teacher_id,
      batch_id,
      day_of_week,
      status = 'active',
      effective_date
    } = filters;

    const client = await pool.connect();
    
    try {
      // Set tenant context for RLS
      await client.query('SET app.current_tenant_id = $1', [tenant_id]);

      let query = `
        SELECT s.*, 
               r.room_name, r.room_code,
               t.first_name as teacher_first_name, t.last_name as teacher_last_name,
               b.batch_name, b.batch_code,
               sub.subject_name, sub.subject_code
        FROM schedule_slots s
        JOIN rooms r ON s.room_id = r.room_id
        JOIN teachers t ON s.teacher_id = t.teacher_id
        JOIN batches b ON s.batch_id = b.batch_id
        JOIN subjects sub ON s.subject_id = sub.subject_id
        WHERE s.tenant_id = $1
      `;

      const values = [tenant_id];
      let paramCount = 2;

      if (room_id) {
        query += ` AND s.room_id = $${paramCount++}`;
        values.push(room_id);
      }
      if (teacher_id) {
        query += ` AND s.teacher_id = $${paramCount++}`;
        values.push(teacher_id);
      }
      if (batch_id) {
        query += ` AND s.batch_id = $${paramCount++}`;
        values.push(batch_id);
      }
      if (day_of_week !== undefined) {
        query += ` AND s.day_of_week = $${paramCount++}`;
        values.push(day_of_week);
      }
      if (status) {
        query += ` AND s.status = $${paramCount++}`;
        values.push(status);
      }
      if (effective_date) {
        query += ` AND s.effective_from <= $${paramCount} AND (s.effective_to IS NULL OR s.effective_to >= $${paramCount})`;
        values.push(effective_date);
        paramCount++;
      }

      query += ` ORDER BY s.day_of_week, s.start_time`;

      const result = await client.query(query, values);
      return result.rows;

    } finally {
      client.release();
    }
  }

  /**
   * Delete a schedule slot
   * @param {string} slot_id - Schedule slot ID
   * @param {string} tenant_id - Tenant ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteScheduleSlot(slot_id, tenant_id) {
    const client = await pool.connect();
    
    try {
      // Set tenant context for RLS
      await client.query('SET app.current_tenant_id = $1', [tenant_id]);

      // Soft delete by setting status to 'cancelled'
      const result = await client.query(
        `UPDATE schedule_slots 
         SET status = 'cancelled'
         WHERE slot_id = $1
         RETURNING *`,
        [slot_id]
      );

      return result.rows.length > 0;

    } finally {
      client.release();
    }
  }

  /**
   * Log a detected conflict
   * @param {Object} conflictData - Conflict data
   * @returns {Promise<Object>} Created conflict record
   */
  async logConflict(conflictData) {
    const {
      tenant_id,
      conflict_type,
      severity = 'high',
      slot_id_1,
      slot_id_2 = null,
      description,
      conflict_details = {}
    } = conflictData;

    const client = await pool.connect();
    
    try {
      // Set tenant context for RLS
      await client.query('SET app.current_tenant_id = $1', [tenant_id]);

      const result = await client.query(
        `INSERT INTO schedule_conflicts (
          tenant_id, conflict_type, severity, slot_id_1, slot_id_2,
          description, conflict_details, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'unresolved')
        RETURNING *`,
        [
          tenant_id, conflict_type, severity, slot_id_1, slot_id_2,
          description, JSON.stringify(conflict_details)
        ]
      );

      return result.rows[0];

    } finally {
      client.release();
    }
  }

  /**
   * Get conflicts for a tenant
   * @param {string} tenant_id - Tenant ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Conflicts
   */
  async getConflicts(tenant_id, filters = {}) {
    const { status = 'unresolved', conflict_type } = filters;

    const client = await pool.connect();
    
    try {
      // Set tenant context for RLS
      await client.query('SET app.current_tenant_id = $1', [tenant_id]);

      let query = `
        SELECT c.*,
               s1.day_of_week, s1.start_time, s1.end_time,
               r1.room_name as room_1, t1.first_name || ' ' || t1.last_name as teacher_1,
               b1.batch_name as batch_1
        FROM schedule_conflicts c
        JOIN schedule_slots s1 ON c.slot_id_1 = s1.slot_id
        JOIN rooms r1 ON s1.room_id = r1.room_id
        JOIN teachers t1 ON s1.teacher_id = t1.teacher_id
        JOIN batches b1 ON s1.batch_id = b1.batch_id
        WHERE c.tenant_id = $1
      `;

      const values = [tenant_id];
      let paramCount = 2;

      if (status) {
        query += ` AND c.status = $${paramCount++}`;
        values.push(status);
      }
      if (conflict_type) {
        query += ` AND c.conflict_type = $${paramCount++}`;
        values.push(conflict_type);
      }

      query += ` ORDER BY c.detected_at DESC`;

      const result = await client.query(query, values);
      return result.rows;

    } finally {
      client.release();
    }
  }

  /**
   * Request AI-assisted schedule optimization
   * @param {Object} optimizationRequest - Optimization request data
   * @returns {Promise<Object>} Optimization proposals
   */
  async requestScheduleOptimization(optimizationRequest) {
    const {
      tenant_id,
      academic_term_id,
      sessions,
      time_slots,
      rooms,
      num_proposals = 3,
      requested_by
    } = optimizationRequest;

    // Input validation
    if (!tenant_id || !academic_term_id || !sessions || !time_slots || !rooms) {
      throw new Error('Missing required fields for schedule optimization');
    }

    if (sessions.length === 0) {
      throw new Error('At least one session is required');
    }

    if (time_slots.length === 0) {
      throw new Error('At least one time slot is required');
    }

    if (rooms.length === 0) {
      throw new Error('At least one room is required');
    }

    const client = await pool.connect();
    
    try {
      // Set tenant context for RLS
      await client.query('SET app.current_tenant_id = $1', [tenant_id]);

      // Call AI service for optimization
      const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const axios = require('axios');
      
      const response = await axios.post(`${aiServiceUrl}/api/v1/schedule/optimize`, {
        sessions,
        time_slots,
        rooms,
        num_proposals
      });

      const proposals = response.data.proposals;

      // Store proposals in database
      const storedProposals = [];
      
      for (const proposal of proposals) {
        const result = await client.query(
          `INSERT INTO schedule_proposals (
            tenant_id, academic_term_id, proposal_id, 
            fitness_score, hard_constraint_violations, soft_constraint_score,
            summary, assignments, status, requested_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
          RETURNING *`,
          [
            tenant_id,
            academic_term_id,
            proposal.proposal_id,
            proposal.fitness_score,
            proposal.hard_constraint_violations,
            proposal.soft_constraint_score,
            JSON.stringify(proposal.summary),
            JSON.stringify(proposal.assignments),
            requested_by
          ]
        );

        storedProposals.push(result.rows[0]);
      }

      return {
        proposals: storedProposals,
        total_proposals: storedProposals.length,
        processing_time_ms: response.data.processing_time_ms,
        algorithm_used: response.data.algorithm_used,
        advisory_note: response.data.advisory_note
      };

    } catch (error) {
      if (error.response) {
        // AI service returned an error
        throw new Error(`AI service error: ${error.response.data.detail || error.message}`);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get schedule proposals for a tenant
   * @param {string} tenant_id - Tenant ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Schedule proposals
   */
  async getScheduleProposals(tenant_id, filters = {}) {
    const {
      academic_term_id,
      status = 'pending'
    } = filters;

    const client = await pool.connect();
    
    try {
      // Set tenant context for RLS
      await client.query('SET app.current_tenant_id = $1', [tenant_id]);

      let query = `
        SELECT * FROM schedule_proposals
        WHERE tenant_id = $1
      `;

      const values = [tenant_id];
      let paramCount = 2;

      if (academic_term_id) {
        query += ` AND academic_term_id = $${paramCount++}`;
        values.push(academic_term_id);
      }

      if (status) {
        query += ` AND status = $${paramCount++}`;
        values.push(status);
      }

      query += ` ORDER BY created_at DESC`;

      const result = await client.query(query, values);
      return result.rows;

    } finally {
      client.release();
    }
  }

  /**
   * Get a specific schedule proposal
   * @param {string} proposal_id - Proposal ID
   * @param {string} tenant_id - Tenant ID
   * @returns {Promise<Object>} Schedule proposal
   */
  async getScheduleProposal(proposal_id, tenant_id) {
    const client = await pool.connect();
    
    try {
      // Set tenant context for RLS
      await client.query('SET app.current_tenant_id = $1', [tenant_id]);

      const result = await client.query(
        `SELECT * FROM schedule_proposals
         WHERE proposal_id = $1 AND tenant_id = $2`,
        [proposal_id, tenant_id]
      );

      if (result.rows.length === 0) {
        throw new Error('Schedule proposal not found');
      }

      return result.rows[0];

    } finally {
      client.release();
    }
  }

  /**
   * Publish a schedule proposal (Human approval required)
   * @param {string} proposal_id - Proposal ID
   * @param {string} tenant_id - Tenant ID
   * @param {string} published_by - User ID who published
   * @param {string} publish_reason - Reason for publishing this proposal
   * @returns {Promise<Object>} Published schedule
   */
  async publishScheduleProposal(proposal_id, tenant_id, published_by, publish_reason) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Set tenant context for RLS
      await client.query('SET app.current_tenant_id = $1', [tenant_id]);

      // Get the proposal
      const proposalResult = await client.query(
        `SELECT * FROM schedule_proposals
         WHERE proposal_id = $1 AND tenant_id = $2`,
        [proposal_id, tenant_id]
      );

      if (proposalResult.rows.length === 0) {
        throw new Error('Schedule proposal not found');
      }

      const proposal = proposalResult.rows[0];

      if (proposal.status === 'published') {
        throw new Error('This proposal has already been published');
      }

      if (proposal.status === 'rejected') {
        throw new Error('Cannot publish a rejected proposal');
      }

      // Mark other proposals for the same term as rejected
      await client.query(
        `UPDATE schedule_proposals
         SET status = 'rejected', updated_at = NOW()
         WHERE academic_term_id = $1 
         AND tenant_id = $2 
         AND proposal_id != $3
         AND status = 'pending'`,
        [proposal.academic_term_id, tenant_id, proposal_id]
      );

      // Mark this proposal as published
      await client.query(
        `UPDATE schedule_proposals
         SET status = 'published', 
             published_by = $1, 
             published_at = NOW(),
             publish_reason = $2,
             updated_at = NOW()
         WHERE proposal_id = $3 AND tenant_id = $4`,
        [published_by, publish_reason, proposal_id, tenant_id]
      );

      // Create actual schedule slots from the proposal assignments
      const assignments = proposal.assignments;
      const createdSlots = [];

      for (const assignment of assignments) {
        // Find or create the necessary entities (rooms, teachers, batches, subjects)
        // For now, we'll assume they exist and just create the schedule slots
        
        const slotResult = await client.query(
          `INSERT INTO schedule_slots (
            tenant_id, room_id, teacher_id, batch_id, subject_id,
            day_of_week, start_time, end_time, 
            effective_from, is_recurring, recurrence_pattern,
            notes, created_by, status, proposal_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, 'weekly', $10, $11, 'active', $12)
          RETURNING *`,
          [
            tenant_id,
            assignment.room_id || null,  // These would need to be resolved from names
            assignment.teacher_id || null,
            assignment.batch_id || null,
            assignment.subject_id || null,
            assignment.day_of_week,
            assignment.start_time,
            assignment.end_time,
            proposal.created_at,  // Use proposal creation date as effective_from
            `Published from AI proposal ${proposal_id}`,
            published_by,
            proposal_id
          ]
        );

        createdSlots.push(slotResult.rows[0]);
      }

      await client.query('COMMIT');

      return {
        proposal_id,
        status: 'published',
        published_by,
        published_at: new Date(),
        publish_reason,
        slots_created: createdSlots.length,
        slots: createdSlots
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reject a schedule proposal
   * @param {string} proposal_id - Proposal ID
   * @param {string} tenant_id - Tenant ID
   * @param {string} rejected_by - User ID who rejected
   * @param {string} rejection_reason - Reason for rejection
   * @returns {Promise<Object>} Rejection result
   */
  async rejectScheduleProposal(proposal_id, tenant_id, rejected_by, rejection_reason) {
    const client = await pool.connect();
    
    try {
      // Set tenant context for RLS
      await client.query('SET app.current_tenant_id = $1', [tenant_id]);

      const result = await client.query(
        `UPDATE schedule_proposals
         SET status = 'rejected',
             rejected_by = $1,
             rejected_at = NOW(),
             rejection_reason = $2,
             updated_at = NOW()
         WHERE proposal_id = $3 AND tenant_id = $4
         RETURNING *`,
        [rejected_by, rejection_reason, proposal_id, tenant_id]
      );

      if (result.rows.length === 0) {
        throw new Error('Schedule proposal not found');
      }

      return result.rows[0];

    } finally {
      client.release();
    }
  }
}

module.exports = new SchedulingService();
