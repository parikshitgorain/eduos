/**
 * Tests for Rule Evaluation Trigger Utility
 */

const ruleEvaluationTrigger = require('./ruleEvaluationTrigger');
const academicRuleService = require('../services/academicRuleService');

// Mock the academicRuleService
jest.mock('../services/academicRuleService');

describe('Rule Evaluation Trigger', () => {
  let mockDb;
  let mockRedis;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock database with raw function
    const dbQuery = {
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn()
    };

    mockDb = jest.fn(() => dbQuery);
    mockDb.raw = jest.fn((sql) => sql); // Mock raw function

    // Mock Redis
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };

    // Mock academicRuleService methods
    academicRuleService.initialize = jest.fn();
    academicRuleService.evaluateRulesForStudent = jest.fn();
  });

  describe('triggerAttendanceRuleEvaluation', () => {
    it('should evaluate attendance rules successfully', async () => {
      // Mock attendance data
      const attendanceData = {
        total_sessions: '10',
        present_count: '8'
      };

      const dbQuery = mockDb();
      dbQuery.first.mockResolvedValue(attendanceData);

      // Mock evaluation results
      const mockEvaluations = [
        { rule_id: 'rule-1', triggered: true, action: 'notify' }
      ];
      academicRuleService.evaluateRulesForStudent.mockResolvedValue(mockEvaluations);

      const result = await ruleEvaluationTrigger.triggerAttendanceRuleEvaluation(
        'student-123',
        'tenant-456',
        mockDb,
        mockRedis
      );

      expect(mockDb).toHaveBeenCalled();
      expect(academicRuleService.initialize).toHaveBeenCalledWith(mockDb, mockRedis);
      expect(academicRuleService.evaluateRulesForStudent).toHaveBeenCalledWith(
        'student-123',
        'tenant-456',
        expect.objectContaining({
          attendance_percentage: 80,
          total_sessions: 10,
          present_count: 8,
          absent_count: 2
        })
      );
      expect(result).toEqual(mockEvaluations);
    });

    it('should return empty array when no attendance sessions exist', async () => {
      const attendanceData = {
        total_sessions: '0',
        present_count: '0'
      };

      const dbQuery = mockDb();
      dbQuery.first.mockResolvedValue(attendanceData);

      const result = await ruleEvaluationTrigger.triggerAttendanceRuleEvaluation(
        'student-123',
        'tenant-456',
        mockDb,
        mockRedis
      );

      expect(result).toEqual([]);
      expect(academicRuleService.evaluateRulesForStudent).not.toHaveBeenCalled();
    });

    it('should handle null attendance data', async () => {
      const attendanceData = {
        total_sessions: null,
        present_count: null
      };

      const dbQuery = mockDb();
      dbQuery.first.mockResolvedValue(attendanceData);

      const result = await ruleEvaluationTrigger.triggerAttendanceRuleEvaluation(
        'student-123',
        'tenant-456',
        mockDb,
        mockRedis
      );

      expect(result).toEqual([]);
    });

    it('should calculate attendance percentage correctly', async () => {
      const attendanceData = {
        total_sessions: '20',
        present_count: '15'
      };

      const dbQuery = mockDb();
      dbQuery.first.mockResolvedValue(attendanceData);

      academicRuleService.evaluateRulesForStudent.mockResolvedValue([]);

      await ruleEvaluationTrigger.triggerAttendanceRuleEvaluation(
        'student-123',
        'tenant-456',
        mockDb,
        mockRedis
      );

      expect(academicRuleService.evaluateRulesForStudent).toHaveBeenCalledWith(
        'student-123',
        'tenant-456',
        expect.objectContaining({
          attendance_percentage: 75,
          total_sessions: 20,
          present_count: 15,
          absent_count: 5
        })
      );
    });

    it('should throw error when database query fails', async () => {
      const dbQuery = mockDb();
      dbQuery.first.mockRejectedValue(new Error('Database error'));

      await expect(
        ruleEvaluationTrigger.triggerAttendanceRuleEvaluation(
          'student-123',
          'tenant-456',
          mockDb,
          mockRedis
        )
      ).rejects.toThrow('Database error');
    });

    it('should throw error when rule evaluation fails', async () => {
      const attendanceData = {
        total_sessions: '10',
        present_count: '8'
      };

      const dbQuery = mockDb();
      dbQuery.first.mockResolvedValue(attendanceData);

      academicRuleService.evaluateRulesForStudent.mockRejectedValue(
        new Error('Evaluation error')
      );

      await expect(
        ruleEvaluationTrigger.triggerAttendanceRuleEvaluation(
          'student-123',
          'tenant-456',
          mockDb,
          mockRedis
        )
      ).rejects.toThrow('Evaluation error');
    });
  });

  describe('triggerGradeRuleEvaluation', () => {
    it('should evaluate grade rules successfully', async () => {
      const mockEvaluations = [
        { rule_id: 'rule-2', triggered: true, action: 'alert' }
      ];
      academicRuleService.evaluateRulesForStudent.mockResolvedValue(mockEvaluations);

      const result = await ruleEvaluationTrigger.triggerGradeRuleEvaluation(
        'student-123',
        'tenant-456',
        'A',
        85,
        100,
        mockDb,
        mockRedis
      );

      expect(academicRuleService.initialize).toHaveBeenCalledWith(mockDb, mockRedis);
      expect(academicRuleService.evaluateRulesForStudent).toHaveBeenCalledWith(
        'student-123',
        'tenant-456',
        expect.objectContaining({
          grade: 'A',
          marks: 85,
          max_marks: 100,
          percentage: 85
        })
      );
      expect(result).toEqual(mockEvaluations);
    });

    it('should handle zero max marks', async () => {
      academicRuleService.evaluateRulesForStudent.mockResolvedValue([]);

      await ruleEvaluationTrigger.triggerGradeRuleEvaluation(
        'student-123',
        'tenant-456',
        'F',
        0,
        0,
        mockDb,
        mockRedis
      );

      expect(academicRuleService.evaluateRulesForStudent).toHaveBeenCalledWith(
        'student-123',
        'tenant-456',
        expect.objectContaining({
          grade: 'F',
          marks: 0,
          max_marks: 0,
          percentage: 0
        })
      );
    });

    it('should calculate percentage correctly', async () => {
      academicRuleService.evaluateRulesForStudent.mockResolvedValue([]);

      await ruleEvaluationTrigger.triggerGradeRuleEvaluation(
        'student-123',
        'tenant-456',
        'B',
        75,
        100,
        mockDb,
        mockRedis
      );

      expect(academicRuleService.evaluateRulesForStudent).toHaveBeenCalledWith(
        'student-123',
        'tenant-456',
        expect.objectContaining({
          percentage: 75
        })
      );
    });

    it('should throw error when evaluation fails', async () => {
      academicRuleService.evaluateRulesForStudent.mockRejectedValue(
        new Error('Evaluation failed')
      );

      await expect(
        ruleEvaluationTrigger.triggerGradeRuleEvaluation(
          'student-123',
          'tenant-456',
          'A',
          90,
          100,
          mockDb,
          mockRedis
        )
      ).rejects.toThrow('Evaluation failed');
    });

    it('should handle partial marks correctly', async () => {
      academicRuleService.evaluateRulesForStudent.mockResolvedValue([]);

      await ruleEvaluationTrigger.triggerGradeRuleEvaluation(
        'student-123',
        'tenant-456',
        'C',
        45.5,
        50,
        mockDb,
        mockRedis
      );

      expect(academicRuleService.evaluateRulesForStudent).toHaveBeenCalledWith(
        'student-123',
        'tenant-456',
        expect.objectContaining({
          marks: 45.5,
          max_marks: 50,
          percentage: 91
        })
      );
    });
  });

  describe('triggerBatchRuleEvaluation', () => {
    it('should evaluate rules for multiple students successfully', async () => {
      const studentIds = ['student-1', 'student-2', 'student-3'];
      const context = { test_context: 'value' };

      academicRuleService.evaluateRulesForStudent
        .mockResolvedValueOnce([{ rule_id: 'rule-1', triggered: true }])
        .mockResolvedValueOnce([{ rule_id: 'rule-2', triggered: false }])
        .mockResolvedValueOnce([{ rule_id: 'rule-3', triggered: true }]);

      const result = await ruleEvaluationTrigger.triggerBatchRuleEvaluation(
        studentIds,
        'tenant-456',
        context,
        mockDb,
        mockRedis
      );

      expect(academicRuleService.initialize).toHaveBeenCalledWith(mockDb, mockRedis);
      expect(academicRuleService.evaluateRulesForStudent).toHaveBeenCalledTimes(3);
      expect(result).toEqual({
        total: 3,
        evaluated: 3,
        failed: 0,
        evaluations: [
          {
            student_id: 'student-1',
            success: true,
            evaluations: [{ rule_id: 'rule-1', triggered: true }]
          },
          {
            student_id: 'student-2',
            success: true,
            evaluations: [{ rule_id: 'rule-2', triggered: false }]
          },
          {
            student_id: 'student-3',
            success: true,
            evaluations: [{ rule_id: 'rule-3', triggered: true }]
          }
        ]
      });
    });

    it('should handle partial failures in batch evaluation', async () => {
      const studentIds = ['student-1', 'student-2', 'student-3'];
      const context = { test_context: 'value' };

      academicRuleService.evaluateRulesForStudent
        .mockResolvedValueOnce([{ rule_id: 'rule-1', triggered: true }])
        .mockRejectedValueOnce(new Error('Student 2 evaluation failed'))
        .mockResolvedValueOnce([{ rule_id: 'rule-3', triggered: true }]);

      const result = await ruleEvaluationTrigger.triggerBatchRuleEvaluation(
        studentIds,
        'tenant-456',
        context,
        mockDb,
        mockRedis
      );

      expect(result).toEqual({
        total: 3,
        evaluated: 2,
        failed: 1,
        evaluations: [
          {
            student_id: 'student-1',
            success: true,
            evaluations: [{ rule_id: 'rule-1', triggered: true }]
          },
          {
            student_id: 'student-2',
            success: false,
            error: 'Student 2 evaluation failed'
          },
          {
            student_id: 'student-3',
            success: true,
            evaluations: [{ rule_id: 'rule-3', triggered: true }]
          }
        ]
      });
    });

    it('should handle empty student list', async () => {
      const result = await ruleEvaluationTrigger.triggerBatchRuleEvaluation(
        [],
        'tenant-456',
        {},
        mockDb,
        mockRedis
      );

      expect(result).toEqual({
        total: 0,
        evaluated: 0,
        failed: 0,
        evaluations: []
      });
      expect(academicRuleService.evaluateRulesForStudent).not.toHaveBeenCalled();
    });

    it('should handle single student in batch', async () => {
      const studentIds = ['student-1'];
      const context = { test_context: 'value' };

      academicRuleService.evaluateRulesForStudent.mockResolvedValue([
        { rule_id: 'rule-1', triggered: true }
      ]);

      const result = await ruleEvaluationTrigger.triggerBatchRuleEvaluation(
        studentIds,
        'tenant-456',
        context,
        mockDb,
        mockRedis
      );

      expect(result.total).toBe(1);
      expect(result.evaluated).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.evaluations).toHaveLength(1);
    });

    it('should throw error when initialization fails', async () => {
      academicRuleService.initialize.mockImplementation(() => {
        throw new Error('Initialization failed');
      });

      await expect(
        ruleEvaluationTrigger.triggerBatchRuleEvaluation(
          ['student-1'],
          'tenant-456',
          {},
          mockDb,
          mockRedis
        )
      ).rejects.toThrow('Initialization failed');
    });

    it('should handle all students failing', async () => {
      const studentIds = ['student-1', 'student-2'];
      const context = { test_context: 'value' };

      academicRuleService.evaluateRulesForStudent
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'));

      const result = await ruleEvaluationTrigger.triggerBatchRuleEvaluation(
        studentIds,
        'tenant-456',
        context,
        mockDb,
        mockRedis
      );

      expect(result).toEqual({
        total: 2,
        evaluated: 0,
        failed: 2,
        evaluations: [
          {
            student_id: 'student-1',
            success: false,
            error: 'Error 1'
          },
          {
            student_id: 'student-2',
            success: false,
            error: 'Error 2'
          }
        ]
      });
    });

    it('should pass context correctly to each student evaluation', async () => {
      const studentIds = ['student-1', 'student-2'];
      const context = { 
        attendance_percentage: 85,
        grade: 'A'
      };

      academicRuleService.evaluateRulesForStudent.mockResolvedValue([]);

      await ruleEvaluationTrigger.triggerBatchRuleEvaluation(
        studentIds,
        'tenant-456',
        context,
        mockDb,
        mockRedis
      );

      expect(academicRuleService.evaluateRulesForStudent).toHaveBeenCalledWith(
        'student-1',
        'tenant-456',
        context
      );
      expect(academicRuleService.evaluateRulesForStudent).toHaveBeenCalledWith(
        'student-2',
        'tenant-456',
        context
      );
    });
  });
});
