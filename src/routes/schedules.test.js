const request = require('supertest');
const express = require('express');
const schedulesRouter = require('./schedules');
const schedulingService = require('../services/schedulingService');

// Mock the scheduling service
jest.mock('../services/schedulingService');

const app = express();
app.use(express.json());

// Mock middleware to set tenant context
app.use((req, res, next) => {
  req.tenantId = req.body.tenant_id || req.query.tenant_id || '123e4567-e89b-12d3-a456-426614174000';
  req.userId = '123e4567-e89b-12d3-a456-426614174005';
  next();
});

app.use('/api/v1/schedules', schedulesRouter);

describe('Schedules API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/schedules/validate', () => {
    it('should validate a schedule slot successfully', async () => {
      const validationResult = {
        valid: true,
        conflicts: [],
        conflict_count: 0
      };

      schedulingService.validateScheduleSlot.mockResolvedValue(validationResult);

      const response = await request(app)
        .post('/api/v1/schedules/validate')
        .send({
          tenant_id: '123e4567-e89b-12d3-a456-426614174000',
          room_id: '123e4567-e89b-12d3-a456-426614174001',
          teacher_id: '123e4567-e89b-12d3-a456-426614174002',
          batch_id: '123e4567-e89b-12d3-a456-426614174003',
          day_of_week: 1,
          start_time: '09:00:00',
          end_time: '10:00:00',
          effective_from: '2026-01-01'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(validationResult);
    });

    it('should return conflicts when detected', async () => {
      const validationResult = {
        valid: false,
        conflicts: [
          {
            type: 'room_double_booking',
            conflicting_slot_id: '123e4567-e89b-12d3-a456-426614174010',
            description: 'Room 101 is already booked'
          }
        ],
        conflict_count: 1
      };

      schedulingService.validateScheduleSlot.mockResolvedValue(validationResult);

      const response = await request(app)
        .post('/api/v1/schedules/validate')
        .send({
          tenant_id: '123e4567-e89b-12d3-a456-426614174000',
          room_id: '123e4567-e89b-12d3-a456-426614174001',
          teacher_id: '123e4567-e89b-12d3-a456-426614174002',
          batch_id: '123e4567-e89b-12d3-a456-426614174003',
          day_of_week: 1,
          start_time: '09:00:00',
          end_time: '10:00:00',
          effective_from: '2026-01-01'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.conflicts).toHaveLength(1);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/schedules/validate')
        .send({
          tenant_id: '123e4567-e89b-12d3-a456-426614174000',
          room_id: '123e4567-e89b-12d3-a456-426614174001'
          // Missing teacher_id, batch_id, etc.
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 400 for invalid day_of_week', async () => {
      const response = await request(app)
        .post('/api/v1/schedules/validate')
        .send({
          tenant_id: '123e4567-e89b-12d3-a456-426614174000',
          room_id: '123e4567-e89b-12d3-a456-426614174001',
          teacher_id: '123e4567-e89b-12d3-a456-426614174002',
          batch_id: '123e4567-e89b-12d3-a456-426614174003',
          day_of_week: 7, // Invalid
          start_time: '09:00:00',
          end_time: '10:00:00',
          effective_from: '2026-01-01'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/schedules', () => {
    it('should create a schedule slot successfully', async () => {
      const createdSlot = {
        slot_id: '123e4567-e89b-12d3-a456-426614174010',
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        room_id: '123e4567-e89b-12d3-a456-426614174001',
        teacher_id: '123e4567-e89b-12d3-a456-426614174002',
        batch_id: '123e4567-e89b-12d3-a456-426614174003',
        subject_id: '123e4567-e89b-12d3-a456-426614174004',
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '10:00:00',
        status: 'active'
      };

      schedulingService.createScheduleSlot.mockResolvedValue(createdSlot);

      const response = await request(app)
        .post('/api/v1/schedules')
        .send({
          tenant_id: '123e4567-e89b-12d3-a456-426614174000',
          room_id: '123e4567-e89b-12d3-a456-426614174001',
          teacher_id: '123e4567-e89b-12d3-a456-426614174002',
          batch_id: '123e4567-e89b-12d3-a456-426614174003',
          subject_id: '123e4567-e89b-12d3-a456-426614174004',
          day_of_week: 1,
          start_time: '09:00:00',
          end_time: '10:00:00',
          effective_from: '2026-01-01'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(createdSlot);
    });

    it('should return 409 when conflicts exist', async () => {
      schedulingService.createScheduleSlot.mockRejectedValue(
        new Error('Schedule conflicts detected: [{"type":"room_double_booking"}]')
      );

      const response = await request(app)
        .post('/api/v1/schedules')
        .send({
          tenant_id: '123e4567-e89b-12d3-a456-426614174000',
          room_id: '123e4567-e89b-12d3-a456-426614174001',
          teacher_id: '123e4567-e89b-12d3-a456-426614174002',
          batch_id: '123e4567-e89b-12d3-a456-426614174003',
          subject_id: '123e4567-e89b-12d3-a456-426614174004',
          day_of_week: 1,
          start_time: '09:00:00',
          end_time: '10:00:00',
          effective_from: '2026-01-01'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.conflict).toBe(true);
    });
  });

  describe('GET /api/v1/schedules', () => {
    it('should retrieve schedule slots', async () => {
      const slots = [
        { slot_id: '1', room_name: 'Room 101' },
        { slot_id: '2', room_name: 'Room 102' }
      ];

      schedulingService.getScheduleSlots.mockResolvedValue(slots);

      const response = await request(app)
        .get('/api/v1/schedules')
        .query({ tenant_id: '123e4567-e89b-12d3-a456-426614174000' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(slots);
      expect(response.body.count).toBe(2);
    });

    it('should retrieve schedule slots with filters', async () => {
      const slots = [
        { slot_id: '1', room_name: 'Room 101', day_of_week: 1 }
      ];

      schedulingService.getScheduleSlots.mockResolvedValue(slots);

      const response = await request(app)
        .get('/api/v1/schedules')
        .query({
          tenant_id: '123e4567-e89b-12d3-a456-426614174000',
          room_id: '123e4567-e89b-12d3-a456-426614174001',
          day_of_week: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(slots);
    });
  });

  describe('GET /api/v1/schedules/:slot_id', () => {
    it('should retrieve a specific schedule slot', async () => {
      const slot = {
        slot_id: '123e4567-e89b-12d3-a456-426614174010',
        room_name: 'Room 101',
        teacher_first_name: 'John',
        teacher_last_name: 'Doe'
      };

      schedulingService.getScheduleSlot.mockResolvedValue(slot);

      const response = await request(app)
        .get('/api/v1/schedules/123e4567-e89b-12d3-a456-426614174010')
        .query({ tenant_id: '123e4567-e89b-12d3-a456-426614174000' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(slot);
    });

    it('should return 404 when slot not found', async () => {
      schedulingService.getScheduleSlot.mockRejectedValue(
        new Error('Schedule slot not found')
      );

      const response = await request(app)
        .get('/api/v1/schedules/123e4567-e89b-12d3-a456-426614174010')
        .query({ tenant_id: '123e4567-e89b-12d3-a456-426614174000' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/schedules/:slot_id', () => {
    it('should update a schedule slot successfully', async () => {
      const updatedSlot = {
        slot_id: '123e4567-e89b-12d3-a456-426614174010',
        room_id: '123e4567-e89b-12d3-a456-426614174099',
        status: 'active'
      };

      schedulingService.updateScheduleSlot.mockResolvedValue(updatedSlot);

      const response = await request(app)
        .put('/api/v1/schedules/123e4567-e89b-12d3-a456-426614174010')
        .send({
          tenant_id: '123e4567-e89b-12d3-a456-426614174000',
          room_id: '123e4567-e89b-12d3-a456-426614174099'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(updatedSlot);
    });

    it('should return 409 when update causes conflicts', async () => {
      schedulingService.updateScheduleSlot.mockRejectedValue(
        new Error('Schedule conflicts detected')
      );

      const response = await request(app)
        .put('/api/v1/schedules/123e4567-e89b-12d3-a456-426614174010')
        .send({
          tenant_id: '123e4567-e89b-12d3-a456-426614174000',
          room_id: '123e4567-e89b-12d3-a456-426614174099'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.conflict).toBe(true);
    });
  });

  describe('DELETE /api/v1/schedules/:slot_id', () => {
    it('should delete a schedule slot successfully', async () => {
      schedulingService.deleteScheduleSlot.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/v1/schedules/123e4567-e89b-12d3-a456-426614174010')
        .query({ tenant_id: '123e4567-e89b-12d3-a456-426614174000' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cancelled successfully');
    });

    it('should return 404 when slot not found', async () => {
      schedulingService.deleteScheduleSlot.mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/v1/schedules/123e4567-e89b-12d3-a456-426614174010')
        .query({ tenant_id: '123e4567-e89b-12d3-a456-426614174000' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/schedules/conflicts/list', () => {
    it('should retrieve conflicts', async () => {
      const conflicts = [
        {
          conflict_id: '1',
          conflict_type: 'room_double_booking',
          status: 'unresolved'
        },
        {
          conflict_id: '2',
          conflict_type: 'teacher_double_booking',
          status: 'unresolved'
        }
      ];

      schedulingService.getConflicts.mockResolvedValue(conflicts);

      const response = await request(app)
        .get('/api/v1/schedules/conflicts/list')
        .query({ tenant_id: '123e4567-e89b-12d3-a456-426614174000' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(conflicts);
      expect(response.body.count).toBe(2);
    });

    it('should retrieve conflicts with filters', async () => {
      const conflicts = [
        {
          conflict_id: '1',
          conflict_type: 'room_double_booking',
          status: 'unresolved'
        }
      ];

      schedulingService.getConflicts.mockResolvedValue(conflicts);

      const response = await request(app)
        .get('/api/v1/schedules/conflicts/list')
        .query({
          tenant_id: '123e4567-e89b-12d3-a456-426614174000',
          status: 'unresolved',
          conflict_type: 'room_double_booking'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(conflicts);
    });
  });
});
