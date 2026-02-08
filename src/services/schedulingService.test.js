const schedulingService = require('./schedulingService');
const pool = require('../config/database');

// Mock the database pool
jest.mock('../config/database', () => ({
  connect: jest.fn(),
  query: jest.fn()
}));

describe('SchedulingService', () => {
  let mockClient;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    pool.connect.mockResolvedValue(mockClient);
  });

  describe('validateScheduleSlot', () => {
    it('should return valid when no conflicts exist', async () => {
      const slotData = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        room_id: '123e4567-e89b-12d3-a456-426614174001',
        teacher_id: '123e4567-e89b-12d3-a456-426614174002',
        batch_id: '123e4567-e89b-12d3-a456-426614174003',
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '10:00:00',
        effective_from: '2026-01-01'
      };

      // Mock no conflicts
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context
        .mockResolvedValueOnce({ rows: [] }); // detect_schedule_conflicts

      const result = await schedulingService.validateScheduleSlot(slotData);

      expect(result.valid).toBe(true);
      expect(result.conflicts).toEqual([]);
      expect(result.conflict_count).toBe(0);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return conflicts when room is double-booked', async () => {
      const slotData = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        room_id: '123e4567-e89b-12d3-a456-426614174001',
        teacher_id: '123e4567-e89b-12d3-a456-426614174002',
        batch_id: '123e4567-e89b-12d3-a456-426614174003',
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '10:00:00',
        effective_from: '2026-01-01'
      };

      const conflicts = [
        {
          conflict_type: 'room_double_booking',
          conflicting_slot_id: '123e4567-e89b-12d3-a456-426614174010',
          conflict_description: 'Room 101 is already booked on Monday from 09:00:00 to 10:00:00'
        }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context
        .mockResolvedValueOnce({ rows: conflicts }); // detect_schedule_conflicts

      const result = await schedulingService.validateScheduleSlot(slotData);

      expect(result.valid).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('room_double_booking');
      expect(result.conflict_count).toBe(1);
    });

    it('should throw error for missing required fields', async () => {
      const slotData = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        room_id: '123e4567-e89b-12d3-a456-426614174001'
        // Missing teacher_id, batch_id, etc.
      };

      await expect(schedulingService.validateScheduleSlot(slotData))
        .rejects.toThrow('Missing required fields');
    });

    it('should throw error for invalid day_of_week', async () => {
      const slotData = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        room_id: '123e4567-e89b-12d3-a456-426614174001',
        teacher_id: '123e4567-e89b-12d3-a456-426614174002',
        batch_id: '123e4567-e89b-12d3-a456-426614174003',
        day_of_week: 7, // Invalid
        start_time: '09:00:00',
        end_time: '10:00:00',
        effective_from: '2026-01-01'
      };

      await expect(schedulingService.validateScheduleSlot(slotData))
        .rejects.toThrow('day_of_week must be between 0 (Sunday) and 6 (Saturday)');
    });

    it('should detect multiple conflict types', async () => {
      const slotData = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        room_id: '123e4567-e89b-12d3-a456-426614174001',
        teacher_id: '123e4567-e89b-12d3-a456-426614174002',
        batch_id: '123e4567-e89b-12d3-a456-426614174003',
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '10:00:00',
        effective_from: '2026-01-01'
      };

      const conflicts = [
        {
          conflict_type: 'room_double_booking',
          conflicting_slot_id: '123e4567-e89b-12d3-a456-426614174010',
          conflict_description: 'Room 101 is already booked'
        },
        {
          conflict_type: 'teacher_double_booking',
          conflicting_slot_id: '123e4567-e89b-12d3-a456-426614174011',
          conflict_description: 'Teacher John Doe is already assigned'
        }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context
        .mockResolvedValueOnce({ rows: conflicts }); // detect_schedule_conflicts

      const result = await schedulingService.validateScheduleSlot(slotData);

      expect(result.valid).toBe(false);
      expect(result.conflicts).toHaveLength(2);
      expect(result.conflict_count).toBe(2);
    });
  });

  describe('createScheduleSlot', () => {
    it('should create a schedule slot when no conflicts exist', async () => {
      const slotData = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        room_id: '123e4567-e89b-12d3-a456-426614174001',
        teacher_id: '123e4567-e89b-12d3-a456-426614174002',
        batch_id: '123e4567-e89b-12d3-a456-426614174003',
        subject_id: '123e4567-e89b-12d3-a456-426614174004',
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '10:00:00',
        effective_from: '2026-01-01',
        created_by: '123e4567-e89b-12d3-a456-426614174005'
      };

      const createdSlot = {
        slot_id: '123e4567-e89b-12d3-a456-426614174010',
        ...slotData,
        status: 'active',
        created_at: new Date()
      };

      // Mock validation (no conflicts)
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context (validation)
        .mockResolvedValueOnce({ rows: [] }) // detect_schedule_conflicts
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context (create)
        .mockResolvedValueOnce({ rows: [createdSlot] }); // INSERT

      const result = await schedulingService.createScheduleSlot(slotData);

      expect(result).toEqual(createdSlot);
      expect(mockClient.query).toHaveBeenCalledTimes(4);
    });

    it('should throw error when conflicts exist', async () => {
      const slotData = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        room_id: '123e4567-e89b-12d3-a456-426614174001',
        teacher_id: '123e4567-e89b-12d3-a456-426614174002',
        batch_id: '123e4567-e89b-12d3-a456-426614174003',
        subject_id: '123e4567-e89b-12d3-a456-426614174004',
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '10:00:00',
        effective_from: '2026-01-01'
      };

      const conflicts = [
        {
          conflict_type: 'room_double_booking',
          conflicting_slot_id: '123e4567-e89b-12d3-a456-426614174010',
          conflict_description: 'Room conflict'
        }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context
        .mockResolvedValueOnce({ rows: conflicts }); // detect_schedule_conflicts

      await expect(schedulingService.createScheduleSlot(slotData))
        .rejects.toThrow('Schedule conflicts detected');
    });
  });

  describe('updateScheduleSlot', () => {
    it('should update a schedule slot when no conflicts exist', async () => {
      const slot_id = '123e4567-e89b-12d3-a456-426614174010';
      const updates = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        room_id: '123e4567-e89b-12d3-a456-426614174001',
        updated_by: '123e4567-e89b-12d3-a456-426614174005'
      };

      const currentSlot = {
        slot_id,
        tenant_id: updates.tenant_id,
        room_id: '123e4567-e89b-12d3-a456-426614174099',
        teacher_id: '123e4567-e89b-12d3-a456-426614174002',
        batch_id: '123e4567-e89b-12d3-a456-426614174003',
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '10:00:00',
        effective_from: '2026-01-01'
      };

      const updatedSlot = {
        ...currentSlot,
        room_id: updates.room_id
      };

      // Mock getScheduleSlot
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context (get)
        .mockResolvedValueOnce({ rows: [currentSlot] }) // SELECT
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context (validate)
        .mockResolvedValueOnce({ rows: [] }) // detect_schedule_conflicts
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context (update)
        .mockResolvedValueOnce({ rows: [updatedSlot] }); // UPDATE

      const result = await schedulingService.updateScheduleSlot(slot_id, updates);

      expect(result).toEqual(updatedSlot);
    });

    it('should throw error when update causes conflicts', async () => {
      const slot_id = '123e4567-e89b-12d3-a456-426614174010';
      const updates = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        room_id: '123e4567-e89b-12d3-a456-426614174001'
      };

      const currentSlot = {
        slot_id,
        tenant_id: updates.tenant_id,
        room_id: '123e4567-e89b-12d3-a456-426614174099',
        teacher_id: '123e4567-e89b-12d3-a456-426614174002',
        batch_id: '123e4567-e89b-12d3-a456-426614174003',
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '10:00:00',
        effective_from: '2026-01-01'
      };

      const conflicts = [
        {
          conflict_type: 'room_double_booking',
          conflicting_slot_id: '123e4567-e89b-12d3-a456-426614174011',
          conflict_description: 'Room conflict'
        }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context (get)
        .mockResolvedValueOnce({ rows: [currentSlot] }) // SELECT
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context (validate)
        .mockResolvedValueOnce({ rows: conflicts }); // detect_schedule_conflicts

      await expect(schedulingService.updateScheduleSlot(slot_id, updates))
        .rejects.toThrow('Schedule conflicts detected');
    });
  });

  describe('getScheduleSlot', () => {
    it('should retrieve a schedule slot by ID', async () => {
      const slot_id = '123e4567-e89b-12d3-a456-426614174010';
      const tenant_id = '123e4567-e89b-12d3-a456-426614174000';

      const slot = {
        slot_id,
        tenant_id,
        room_name: 'Room 101',
        teacher_first_name: 'John',
        teacher_last_name: 'Doe',
        batch_name: 'Batch A',
        subject_name: 'Mathematics'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context
        .mockResolvedValueOnce({ rows: [slot] }); // SELECT

      const result = await schedulingService.getScheduleSlot(slot_id, tenant_id);

      expect(result).toEqual(slot);
    });

    it('should throw error when slot not found', async () => {
      const slot_id = '123e4567-e89b-12d3-a456-426614174010';
      const tenant_id = '123e4567-e89b-12d3-a456-426614174000';

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context
        .mockResolvedValueOnce({ rows: [] }); // SELECT (not found)

      await expect(schedulingService.getScheduleSlot(slot_id, tenant_id))
        .rejects.toThrow('Schedule slot not found');
    });
  });

  describe('getScheduleSlots', () => {
    it('should retrieve schedule slots with filters', async () => {
      const tenant_id = '123e4567-e89b-12d3-a456-426614174000';
      const filters = {
        room_id: '123e4567-e89b-12d3-a456-426614174001',
        day_of_week: 1,
        status: 'active'
      };

      const slots = [
        { slot_id: '1', room_name: 'Room 101' },
        { slot_id: '2', room_name: 'Room 101' }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context
        .mockResolvedValueOnce({ rows: slots }); // SELECT

      const result = await schedulingService.getScheduleSlots(tenant_id, filters);

      expect(result).toEqual(slots);
      expect(result).toHaveLength(2);
    });

    it('should retrieve all slots when no filters provided', async () => {
      const tenant_id = '123e4567-e89b-12d3-a456-426614174000';

      const slots = [
        { slot_id: '1' },
        { slot_id: '2' },
        { slot_id: '3' }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context
        .mockResolvedValueOnce({ rows: slots }); // SELECT

      const result = await schedulingService.getScheduleSlots(tenant_id);

      expect(result).toEqual(slots);
      expect(result).toHaveLength(3);
    });
  });

  describe('deleteScheduleSlot', () => {
    it('should soft delete a schedule slot', async () => {
      const slot_id = '123e4567-e89b-12d3-a456-426614174010';
      const tenant_id = '123e4567-e89b-12d3-a456-426614174000';

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context
        .mockResolvedValueOnce({ rows: [{ slot_id }] }); // UPDATE

      const result = await schedulingService.deleteScheduleSlot(slot_id, tenant_id);

      expect(result).toBe(true);
    });

    it('should return false when slot not found', async () => {
      const slot_id = '123e4567-e89b-12d3-a456-426614174010';
      const tenant_id = '123e4567-e89b-12d3-a456-426614174000';

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context
        .mockResolvedValueOnce({ rows: [] }); // UPDATE (not found)

      const result = await schedulingService.deleteScheduleSlot(slot_id, tenant_id);

      expect(result).toBe(false);
    });
  });

  describe('logConflict', () => {
    it('should log a detected conflict', async () => {
      const conflictData = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        conflict_type: 'room_double_booking',
        severity: 'high',
        slot_id_1: '123e4567-e89b-12d3-a456-426614174010',
        slot_id_2: '123e4567-e89b-12d3-a456-426614174011',
        description: 'Room conflict detected',
        conflict_details: { room: 'Room 101' }
      };

      const loggedConflict = {
        conflict_id: '123e4567-e89b-12d3-a456-426614174020',
        ...conflictData,
        status: 'unresolved'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context
        .mockResolvedValueOnce({ rows: [loggedConflict] }); // INSERT

      const result = await schedulingService.logConflict(conflictData);

      expect(result).toEqual(loggedConflict);
    });
  });

  describe('getConflicts', () => {
    it('should retrieve conflicts with filters', async () => {
      const tenant_id = '123e4567-e89b-12d3-a456-426614174000';
      const filters = {
        status: 'unresolved',
        conflict_type: 'room_double_booking'
      };

      const conflicts = [
        { conflict_id: '1', conflict_type: 'room_double_booking' },
        { conflict_id: '2', conflict_type: 'room_double_booking' }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context
        .mockResolvedValueOnce({ rows: conflicts }); // SELECT

      const result = await schedulingService.getConflicts(tenant_id, filters);

      expect(result).toEqual(conflicts);
      expect(result).toHaveLength(2);
    });

    it('should retrieve all conflicts when no filters provided', async () => {
      const tenant_id = '123e4567-e89b-12d3-a456-426614174000';

      const conflicts = [
        { conflict_id: '1', conflict_type: 'room_double_booking' },
        { conflict_id: '2', conflict_type: 'teacher_double_booking' },
        { conflict_id: '3', conflict_type: 'batch_double_booking' }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context
        .mockResolvedValueOnce({ rows: conflicts }); // SELECT

      const result = await schedulingService.getConflicts(tenant_id, {});

      expect(result).toEqual(conflicts);
      expect(result).toHaveLength(3);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      pool.connect.mockRejectedValue(new Error('Database connection failed'));

      await expect(schedulingService.validateScheduleSlot({
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        room_id: '123e4567-e89b-12d3-a456-426614174001',
        teacher_id: '123e4567-e89b-12d3-a456-426614174002',
        batch_id: '123e4567-e89b-12d3-a456-426614174003',
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '10:00:00',
        effective_from: '2026-01-01'
      })).rejects.toThrow('Database connection failed');
    });

    it('should validate with effective_to date', async () => {
      const slotData = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        room_id: '123e4567-e89b-12d3-a456-426614174001',
        teacher_id: '123e4567-e89b-12d3-a456-426614174002',
        batch_id: '123e4567-e89b-12d3-a456-426614174003',
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '10:00:00',
        effective_from: '2026-01-01',
        effective_to: '2026-06-30'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context
        .mockResolvedValueOnce({ rows: [] }); // detect_schedule_conflicts

      const result = await schedulingService.validateScheduleSlot(slotData);

      expect(result.valid).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['2026-06-30'])
      );
    });

    it('should validate with exclude_slot_id', async () => {
      const slotData = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        room_id: '123e4567-e89b-12d3-a456-426614174001',
        teacher_id: '123e4567-e89b-12d3-a456-426614174002',
        batch_id: '123e4567-e89b-12d3-a456-426614174003',
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '10:00:00',
        effective_from: '2026-01-01',
        exclude_slot_id: '123e4567-e89b-12d3-a456-426614174010'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context
        .mockResolvedValueOnce({ rows: [] }); // detect_schedule_conflicts

      const result = await schedulingService.validateScheduleSlot(slotData);

      expect(result.valid).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['123e4567-e89b-12d3-a456-426614174010'])
      );
    });

    it('should create schedule with all optional fields', async () => {
      const slotData = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        room_id: '123e4567-e89b-12d3-a456-426614174001',
        teacher_id: '123e4567-e89b-12d3-a456-426614174002',
        batch_id: '123e4567-e89b-12d3-a456-426614174003',
        subject_id: '123e4567-e89b-12d3-a456-426614174004',
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '10:00:00',
        effective_from: '2026-01-01',
        effective_to: '2026-06-30',
        is_recurring: false,
        recurrence_pattern: 'one-time',
        notes: 'Special class',
        created_by: '123e4567-e89b-12d3-a456-426614174005'
      };

      const createdSlot = {
        slot_id: '123e4567-e89b-12d3-a456-426614174010',
        ...slotData,
        status: 'active'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context (validation)
        .mockResolvedValueOnce({ rows: [] }) // detect_schedule_conflicts
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context (create)
        .mockResolvedValueOnce({ rows: [createdSlot] }); // INSERT

      const result = await schedulingService.createScheduleSlot(slotData);

      expect(result).toEqual(createdSlot);
      expect(result.is_recurring).toBe(false);
      expect(result.recurrence_pattern).toBe('one-time');
      expect(result.notes).toBe('Special class');
    });

    it('should update schedule with multiple fields', async () => {
      const slot_id = '123e4567-e89b-12d3-a456-426614174010';
      const updates = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        room_id: '123e4567-e89b-12d3-a456-426614174001',
        teacher_id: '123e4567-e89b-12d3-a456-426614174002',
        day_of_week: 2,
        start_time: '10:00:00',
        end_time: '11:00:00',
        updated_by: '123e4567-e89b-12d3-a456-426614174005'
      };

      const currentSlot = {
        slot_id,
        tenant_id: updates.tenant_id,
        room_id: '123e4567-e89b-12d3-a456-426614174099',
        teacher_id: '123e4567-e89b-12d3-a456-426614174098',
        batch_id: '123e4567-e89b-12d3-a456-426614174003',
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '10:00:00',
        effective_from: '2026-01-01'
      };

      const updatedSlot = {
        ...currentSlot,
        ...updates
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context (get)
        .mockResolvedValueOnce({ rows: [currentSlot] }) // SELECT
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context (validate)
        .mockResolvedValueOnce({ rows: [] }) // detect_schedule_conflicts
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context (update)
        .mockResolvedValueOnce({ rows: [updatedSlot] }); // UPDATE

      const result = await schedulingService.updateScheduleSlot(slot_id, updates);

      expect(result.day_of_week).toBe(2);
      expect(result.start_time).toBe('10:00:00');
      expect(result.end_time).toBe('11:00:00');
    });

    it('should throw error when updating with no fields', async () => {
      const slot_id = '123e4567-e89b-12d3-a456-426614174010';
      const updates = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000'
      };

      const currentSlot = {
        slot_id,
        tenant_id: updates.tenant_id,
        room_id: '123e4567-e89b-12d3-a456-426614174001',
        teacher_id: '123e4567-e89b-12d3-a456-426614174002',
        batch_id: '123e4567-e89b-12d3-a456-426614174003',
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '10:00:00',
        effective_from: '2026-01-01'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context (get)
        .mockResolvedValueOnce({ rows: [currentSlot] }) // SELECT
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context (update)
        .mockRejectedValueOnce(new Error('No fields to update')); // UPDATE fails

      await expect(schedulingService.updateScheduleSlot(slot_id, updates))
        .rejects.toThrow('No fields to update');
    });

    it('should get schedule slots with effective_date filter', async () => {
      const tenant_id = '123e4567-e89b-12d3-a456-426614174000';
      const filters = {
        effective_date: '2026-03-15'
      };

      const slots = [
        { slot_id: '1', effective_from: '2026-01-01', effective_to: '2026-06-30' }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context
        .mockResolvedValueOnce({ rows: slots }); // SELECT

      const result = await schedulingService.getScheduleSlots(tenant_id, filters);

      expect(result).toEqual(slots);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('effective_from'),
        expect.arrayContaining(['2026-03-15'])
      );
    });

    it('should log conflict with default severity', async () => {
      const conflictData = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        conflict_type: 'room_double_booking',
        slot_id_1: '123e4567-e89b-12d3-a456-426614174010',
        description: 'Room conflict detected'
      };

      const loggedConflict = {
        conflict_id: '123e4567-e89b-12d3-a456-426614174020',
        ...conflictData,
        severity: 'high',
        status: 'unresolved'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // SET tenant context
        .mockResolvedValueOnce({ rows: [loggedConflict] }); // INSERT

      const result = await schedulingService.logConflict(conflictData);

      expect(result.severity).toBe('high');
      expect(result.status).toBe('unresolved');
    });
  });
});
