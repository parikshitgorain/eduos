/**
 * Tests for Academic Rule Service
 */

const academicRuleService = require('./academicRuleService');
const { RULE_TYPES, ACTION_TYPES } = require('./academicRuleService');

// Mock the database module
jest.mock('../config/database', () => {
  const mockQuery = {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue([])
  };

  const mockDb = jest.fn(() => mockQuery);
  Object.assign(mockDb, mockQuery);
  
  return mockDb;
});

const db = require('../config/database');

describe('AcademicRuleService - Validation', () => {
  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-456';

  describe('validateRuleConfig', () => {
    it('should validate a correct rule configuration', () => {
      const validConfig = {
        tenant_id: mockTenantId,
        name: 'Test Rule',
        type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: [
          { field: 'attendance_percentage', operator: '<', value: 75 }
        ],
        actions: [
          { type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }
        ],
        created_by: mockUserId
      };

      expect(() => academicRuleService.validateRuleConfig(validConfig)).not.toThrow();
    });

    it('should throw error for missing required fields', () => {
      const invalidConfig = {
        tenant_id: mockTenantId,
        name: 'Invalid Rule'
        // Missing type, conditions, actions
      };

      expect(() => academicRuleService.validateRuleConfig(invalidConfig))
        .toThrow('Missing required fields');
    });

    it('should throw error for invalid rule type', () => {
      const invalidConfig = {
        tenant_id: mockTenantId,
        name: 'Invalid Rule',
        type: 'invalid_type',
        conditions: [{ field: 'test', operator: '>', value: 0 }],
        actions: [{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: true }],
        created_by: mockUserId
      };

      expect(() => academicRuleService.validateRuleConfig(invalidConfig))
        .toThrow('Invalid rule type');
    });

    it('should throw error for invalid operator', () => {
      const invalidConfig = {
        tenant_id: mockTenantId,
        name: 'Invalid Operator Rule',
        type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: [{ field: 'attendance', operator: 'invalid', value: 75 }],
        actions: [{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }],
        created_by: mockUserId
      };

      expect(() => academicRuleService.validateRuleConfig(invalidConfig))
        .toThrow('Invalid operator');
    });

    it('should throw error for empty conditions array', () => {
      const invalidConfig = {
        tenant_id: mockTenantId,
        name: 'No Conditions Rule',
        type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: [],
        actions: [{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }],
        created_by: mockUserId
      };

      expect(() => academicRuleService.validateRuleConfig(invalidConfig))
        .toThrow('Conditions must be a non-empty array');
    });

    it('should throw error for empty actions array', () => {
      const invalidConfig = {
        tenant_id: mockTenantId,
        name: 'No Actions Rule',
        type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: [{ field: 'attendance', operator: '<', value: 75 }],
        actions: [],
        created_by: mockUserId
      };

      expect(() => academicRuleService.validateRuleConfig(invalidConfig))
        .toThrow('Actions must be a non-empty array');
    });

    it('should throw error for invalid date range', () => {
      const invalidConfig = {
        tenant_id: mockTenantId,
        name: 'Invalid Date Range',
        type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: [{ field: 'attendance', operator: '<', value: 75 }],
        actions: [{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }],
        effective_from: '2026-12-31',
        effective_until: '2026-01-01',
        created_by: mockUserId
      };

      expect(() => academicRuleService.validateRuleConfig(invalidConfig))
        .toThrow('effective_from must be before effective_until');
    });

    it('should validate all supported operators', () => {
      const operators = ['>=', '<=', '>', '<', '==', '!=', 'in', 'not_in'];
      
      operators.forEach(operator => {
        const config = {
          tenant_id: mockTenantId,
          name: `Test ${operator}`,
          type: RULE_TYPES.ATTENDANCE_THRESHOLD,
          conditions: [{ field: 'attendance', operator, value: 75 }],
          actions: [{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }],
          created_by: mockUserId
        };

        expect(() => academicRuleService.validateRuleConfig(config)).not.toThrow();
      });
    });

    it('should validate all supported rule types', () => {
      const ruleTypes = [
        RULE_TYPES.ATTENDANCE_THRESHOLD,
        RULE_TYPES.GRADE_ELIGIBILITY,
        RULE_TYPES.GRACE_MARKS
      ];

      ruleTypes.forEach(type => {
        const config = {
          tenant_id: mockTenantId,
          name: `Test ${type}`,
          type,
          conditions: [{ field: 'test', operator: '>', value: 0 }],
          actions: [{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: true }],
          created_by: mockUserId
        };

        expect(() => academicRuleService.validateRuleConfig(config)).not.toThrow();
      });
    });
  });

  describe('validateActionParameters', () => {
    it('should validate SET_ELIGIBILITY action', () => {
      const validAction = { type: ACTION_TYPES.SET_ELIGIBILITY, eligible: true };
      expect(() => academicRuleService.validateActionParameters(validAction, 0)).not.toThrow();

      const invalidAction = { type: ACTION_TYPES.SET_ELIGIBILITY, eligible: 'yes' };
      expect(() => academicRuleService.validateActionParameters(invalidAction, 0))
        .toThrow('requires boolean');
    });

    it('should validate APPLY_GRACE_MARKS action', () => {
      const validAction = { type: ACTION_TYPES.APPLY_GRACE_MARKS, marks: 5, max_marks: 10 };
      expect(() => academicRuleService.validateActionParameters(validAction, 0)).not.toThrow();

      const invalidAction = { type: ACTION_TYPES.APPLY_GRACE_MARKS, marks: -5 };
      expect(() => academicRuleService.validateActionParameters(invalidAction, 0))
        .toThrow('positive number');
    });

    it('should validate SEND_NOTIFICATION action', () => {
      const validAction = { type: ACTION_TYPES.SEND_NOTIFICATION, message: 'Test message' };
      expect(() => academicRuleService.validateActionParameters(validAction, 0)).not.toThrow();

      const invalidAction = { type: ACTION_TYPES.SEND_NOTIFICATION, message: 123 };
      expect(() => academicRuleService.validateActionParameters(invalidAction, 0))
        .toThrow('string');
    });

    it('should validate BLOCK_ENROLLMENT action', () => {
      const validAction = { type: ACTION_TYPES.BLOCK_ENROLLMENT, reason: 'Test reason' };
      expect(() => academicRuleService.validateActionParameters(validAction, 0)).not.toThrow();

      const invalidAction = { type: ACTION_TYPES.BLOCK_ENROLLMENT };
      expect(() => academicRuleService.validateActionParameters(invalidAction, 0))
        .toThrow('requires string');
    });

    it('should validate all action types', () => {
      const actions = [
        { type: ACTION_TYPES.SET_ELIGIBILITY, eligible: true },
        { type: ACTION_TYPES.APPLY_GRACE_MARKS, marks: 5 },
        { type: ACTION_TYPES.SEND_NOTIFICATION, message: 'Test' },
        { type: ACTION_TYPES.BLOCK_ENROLLMENT, reason: 'Test' }
      ];

      actions.forEach((action, index) => {
        expect(() => academicRuleService.validateActionParameters(action, index)).not.toThrow();
      });
    });
  });

  describe('hasConflictingConditions', () => {
    it('should detect exact same conditions', () => {
      const conditions1 = [
        { field: 'attendance_percentage', operator: '<', value: 75 }
      ];
      const conditions2 = [
        { field: 'attendance_percentage', operator: '<', value: 75 }
      ];

      const result = academicRuleService.hasConflictingConditions(conditions1, conditions2);
      expect(result).toBe(true);
    });

    it('should detect overlapping >= operators', () => {
      const conditions1 = [
        { field: 'attendance_percentage', operator: '>=', value: 75 }
      ];
      const conditions2 = [
        { field: 'attendance_percentage', operator: '>=', value: 80 }
      ];

      const result = academicRuleService.hasConflictingConditions(conditions1, conditions2);
      expect(result).toBe(true);
    });

    it('should detect overlapping <= operators', () => {
      const conditions1 = [
        { field: 'score', operator: '<=', value: 40 }
      ];
      const conditions2 = [
        { field: 'score', operator: '<=', value: 35 }
      ];

      const result = academicRuleService.hasConflictingConditions(conditions1, conditions2);
      expect(result).toBe(true);
    });

    it('should allow non-conflicting conditions on different fields', () => {
      const conditions1 = [
        { field: 'attendance_percentage', operator: '<', value: 75 }
      ];
      const conditions2 = [
        { field: 'grade_average', operator: '<', value: 40 }
      ];

      const result = academicRuleService.hasConflictingConditions(conditions1, conditions2);
      expect(result).toBe(false);
    });

    it('should allow non-conflicting conditions with different operators', () => {
      const conditions1 = [
        { field: 'score', operator: '>=', value: 75 }
      ];
      const conditions2 = [
        { field: 'score', operator: '<=', value: 40 }
      ];

      const result = academicRuleService.hasConflictingConditions(conditions1, conditions2);
      expect(result).toBe(false);
    });
  });

  describe('isAmbiguousConditionPair', () => {
    it('should detect exact same condition', () => {
      const cond1 = { field: 'attendance', operator: '<', value: 75 };
      const cond2 = { field: 'attendance', operator: '<', value: 75 };

      const result = academicRuleService.isAmbiguousConditionPair(cond1, cond2);
      expect(result).toBe(true);
    });

    it('should detect overlapping >= conditions', () => {
      const cond1 = { field: 'attendance', operator: '>=', value: 75 };
      const cond2 = { field: 'attendance', operator: '>=', value: 80 };

      const result = academicRuleService.isAmbiguousConditionPair(cond1, cond2);
      expect(result).toBe(true);
    });

    it('should detect overlapping > conditions', () => {
      const cond1 = { field: 'attendance', operator: '>', value: 75 };
      const cond2 = { field: 'attendance', operator: '>', value: 80 };

      const result = academicRuleService.isAmbiguousConditionPair(cond1, cond2);
      expect(result).toBe(true);
    });

    it('should detect overlapping <= conditions', () => {
      const cond1 = { field: 'score', operator: '<=', value: 40 };
      const cond2 = { field: 'score', operator: '<=', value: 35 };

      const result = academicRuleService.isAmbiguousConditionPair(cond1, cond2);
      expect(result).toBe(true);
    });

    it('should detect overlapping < conditions', () => {
      const cond1 = { field: 'score', operator: '<', value: 40 };
      const cond2 = { field: 'score', operator: '<', value: 35 };

      const result = academicRuleService.isAmbiguousConditionPair(cond1, cond2);
      expect(result).toBe(true);
    });

    it('should allow non-ambiguous conditions', () => {
      const cond1 = { field: 'score', operator: '>=', value: 75 };
      const cond2 = { field: 'score', operator: '<=', value: 40 };

      const result = academicRuleService.isAmbiguousConditionPair(cond1, cond2);
      expect(result).toBe(false);
    });
  });
});


// ============================================================================
// REAL-TIME RULE EVALUATION TESTS
// ============================================================================

describe('AcademicRuleService - Real-Time Evaluation', () => {
  const mockTenantId = 'tenant-123';
  const mockStudentId = 'student-456';
  const mockUserId = 'user-789';

  // Mock database and Redis
  let mockDb;
  let mockRedis;

  beforeEach(() => {
    // Reset mocks
    const mockQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue([])
    };

    // Create a function that returns the query builder
    mockDb = jest.fn(() => mockQuery);
    // Add methods directly to the function for backwards compatibility
    Object.assign(mockDb, mockQuery);

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1)
    };

    // Initialize service with mocks
    academicRuleService.initialize(mockDb, mockRedis);
  });

  describe('evaluateRulesForStudent', () => {
    it('should evaluate attendance threshold rule and trigger action', async () => {
      const mockRule = {
        rule_id: 'rule-1',
        tenant_id: mockTenantId,
        rule_name: 'Minimum Attendance',
        rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: JSON.stringify([
          { field: 'attendance_percentage', operator: '<', value: 75 }
        ]),
        actions: JSON.stringify([
          { type: ACTION_TYPES.SEND_NOTIFICATION, message: 'Your attendance is below 75%' }
        ]),
        priority: 100,
        status: 'active',
        effective_from: new Date('2024-01-01'),
        effective_until: null
      };

      // Mock the query chain for academic_rules
      const academicRulesQuery = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([mockRule])
      };
      
      // Mock the query chain for notifications
      const notificationsQuery = {
        insert: jest.fn().mockResolvedValue([])
      };

      // Mock the query chain for rule_evaluations (both insert and update)
      const evaluationsQuery = {
        insert: jest.fn().mockResolvedValue([]),
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue([])
      };

      // Setup mockDb to return different queries based on table name
      mockDb.mockImplementation((tableName) => {
        if (tableName === 'academic_rules') {
          return academicRulesQuery;
        } else if (tableName === 'notifications') {
          return notificationsQuery;
        } else if (tableName === 'rule_evaluations') {
          return evaluationsQuery;
        }
        return academicRulesQuery;
      });

      const context = {
        attendance_percentage: 70
      };

      const evaluations = await academicRuleService.evaluateRulesForStudent(
        mockStudentId,
        mockTenantId,
        context
      );

      expect(evaluations).toHaveLength(1);
      expect(evaluations[0].condition_met).toBe(true);
      expect(evaluations[0].rule_name).toBe('Minimum Attendance');
    });

    it('should not trigger action when condition is not met', async () => {
      const mockRule = {
        rule_id: 'rule-2',
        tenant_id: mockTenantId,
        rule_name: 'Minimum Attendance',
        rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: JSON.stringify([
          { field: 'attendance_percentage', operator: '<', value: 75 }
        ]),
        actions: JSON.stringify([
          { type: ACTION_TYPES.SEND_NOTIFICATION, message: 'Low attendance alert' }
        ]),
        priority: 100,
        status: 'active',
        effective_from: new Date('2024-01-01'),
        effective_until: null
      };

      const academicRulesQuery = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([mockRule])
      };

      mockDb.mockImplementation((tableName) => {
        if (tableName === 'academic_rules') {
          return academicRulesQuery;
        } else if (tableName === 'rule_evaluations') {
          return { insert: jest.fn().mockResolvedValue([]) };
        }
        return academicRulesQuery;
      });

      const context = {
        attendance_percentage: 80 // Above threshold
      };

      const evaluations = await academicRuleService.evaluateRulesForStudent(
        mockStudentId,
        mockTenantId,
        context
      );

      expect(evaluations).toHaveLength(1);
      expect(evaluations[0].condition_met).toBe(false);
      expect(evaluations[0].action_executed).toBe(false);
    });

    it('should complete evaluation in under 100ms', async () => {
      const mockRule = {
        rule_id: 'rule-3',
        tenant_id: mockTenantId,
        rule_name: 'Fast Rule',
        rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: JSON.stringify([
          { field: 'attendance_percentage', operator: '>=', value: 75 }
        ]),
        actions: JSON.stringify([
          { type: ACTION_TYPES.SET_ELIGIBILITY, eligible: true }
        ]),
        priority: 100,
        status: 'active',
        effective_from: new Date('2024-01-01'),
        effective_until: null
      };

      const academicRulesQuery = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([mockRule])
      };

      const evaluationsQuery = {
        insert: jest.fn().mockResolvedValue([]),
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue([])
      };

      mockDb.mockImplementation((tableName) => {
        if (tableName === 'academic_rules') {
          return academicRulesQuery;
        } else if (tableName === 'rule_evaluations') {
          return evaluationsQuery;
        }
        return academicRulesQuery;
      });

      const context = {
        attendance_percentage: 80
      };

      const startTime = Date.now();
      await academicRuleService.evaluateRulesForStudent(
        mockStudentId,
        mockTenantId,
        context
      );
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(100);
    });
  });

  describe('getApplicableRules - Caching', () => {
    it('should use cached rules when available', async () => {
      const cachedRules = [
        {
          rule_id: 'rule-1',
          tenant_id: mockTenantId,
          rule_name: 'Cached Rule',
          rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
          conditions: [{ field: 'attendance_percentage', operator: '<', value: 75 }],
          actions: [{ type: ACTION_TYPES.SEND_NOTIFICATION, message: 'Alert' }],
          priority: 100,
          status: 'active'
        }
      ];

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedRules));

      const context = { attendance_percentage: 70 };
      const rules = await academicRuleService.getApplicableRules(mockTenantId, context);

      expect(mockRedis.get).toHaveBeenCalledWith(`rules:${mockTenantId}:active`);
      expect(rules).toHaveLength(1);
      expect(rules[0].rule_name).toBe('Cached Rule');
    });

    it('should fetch from database and cache when cache miss', async () => {
      const dbRules = [
        {
          rule_id: 'rule-2',
          tenant_id: mockTenantId,
          rule_name: 'DB Rule',
          rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
          conditions: JSON.stringify([{ field: 'attendance_percentage', operator: '<', value: 75 }]),
          actions: JSON.stringify([{ type: ACTION_TYPES.SEND_NOTIFICATION, message: 'Alert' }]),
          priority: 100,
          status: 'active',
          effective_from: new Date('2024-01-01'),
          effective_until: null
        }
      ];

      mockRedis.get.mockResolvedValue(null); // Cache miss

      const academicRulesQuery = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(dbRules)
      };

      mockDb.mockImplementation(() => academicRulesQuery);

      const context = { attendance_percentage: 70 };
      const rules = await academicRuleService.getApplicableRules(mockTenantId, context);

      expect(mockRedis.get).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `rules:${mockTenantId}:active`,
        300,
        expect.any(String)
      );
      expect(rules).toHaveLength(1);
    });
  });

  describe('checkConditions', () => {
    it('should evaluate >= operator correctly', () => {
      const conditions = [
        { field: 'attendance_percentage', operator: '>=', value: 75 }
      ];
      const context = { attendance_percentage: 80 };

      const result = academicRuleService.checkConditions(conditions, context);
      expect(result).toBe(true);
    });

    it('should evaluate < operator correctly', () => {
      const conditions = [
        { field: 'attendance_percentage', operator: '<', value: 75 }
      ];
      const context = { attendance_percentage: 70 };

      const result = academicRuleService.checkConditions(conditions, context);
      expect(result).toBe(true);
    });

    it('should evaluate == operator correctly', () => {
      const conditions = [
        { field: 'grade', operator: '==', value: 'A' }
      ];
      const context = { grade: 'A' };

      const result = academicRuleService.checkConditions(conditions, context);
      expect(result).toBe(true);
    });

    it('should evaluate in operator correctly', () => {
      const conditions = [
        { field: 'status', operator: 'in', value: ['active', 'pending'] }
      ];
      const context = { status: 'active' };

      const result = academicRuleService.checkConditions(conditions, context);
      expect(result).toBe(true);
    });

    it('should return false when all conditions are not met', () => {
      const conditions = [
        { field: 'attendance_percentage', operator: '>=', value: 75 },
        { field: 'grade', operator: '>=', value: 60 }
      ];
      const context = {
        attendance_percentage: 80,
        grade: 50 // Fails second condition
      };

      const result = academicRuleService.checkConditions(conditions, context);
      expect(result).toBe(false);
    });
  });

  describe('invalidateRuleCache', () => {
    it('should delete cache key for tenant', async () => {
      await academicRuleService.invalidateRuleCache(mockTenantId);

      expect(mockRedis.del).toHaveBeenCalledWith(`rules:${mockTenantId}:active`);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(
        academicRuleService.invalidateRuleCache(mockTenantId)
      ).resolves.not.toThrow();
    });
  });

  describe('getEvaluationHistory', () => {
    it('should retrieve evaluation history for a student', async () => {
      const mockEvaluations = [
        {
          evaluation_id: 'eval-1',
          rule_id: 'rule-1',
          tenant_id: mockTenantId,
          student_id: mockStudentId,
          context: JSON.stringify({ attendance_percentage: 70 }),
          condition_met: true,
          action_executed: true,
          action_result: JSON.stringify([{ action_type: 'send_notification', success: true }]),
          evaluated_at: new Date()
        }
      ];

      const evaluationsQuery = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue(mockEvaluations)
      };

      mockDb.mockImplementation(() => evaluationsQuery);

      const history = await academicRuleService.getEvaluationHistory(
        mockStudentId,
        mockTenantId,
        { limit: 50, offset: 0 }
      );

      expect(history).toHaveLength(1);
      expect(history[0].evaluation_id).toBe('eval-1');
      expect(history[0].context).toEqual({ attendance_percentage: 70 });
    });
  });

  describe('formatNotificationMessage', () => {
    it('should replace context variables in message template', () => {
      const template = 'Your attendance is {{attendance_percentage}}%';
      const context = { attendance_percentage: 70 };
      const rule = { rule_name: 'Test Rule' };

      const formatted = academicRuleService.formatNotificationMessage(
        template,
        context,
        rule
      );

      expect(formatted).toBe('Your attendance is 70%');
    });

    it('should replace rule variables in message template', () => {
      const template = 'Rule {{rule_name}} has been triggered';
      const context = {};
      const rule = { rule_name: 'Attendance Alert' };

      const formatted = academicRuleService.formatNotificationMessage(
        template,
        context,
        rule
      );

      expect(formatted).toBe('Rule Attendance Alert has been triggered');
    });
  });
});


describe('AcademicRuleService - Additional Coverage', () => {
  const mockTenantId = 'tenant-123';
  const mockStudentId = 'student-456';
  const mockUserId = 'user-789';

  let mockDb;
  let mockRedis;

  beforeEach(() => {
    const mockQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      whereNot: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue([])
    };

    mockDb = jest.fn(() => mockQuery);
    Object.assign(mockDb, mockQuery);

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1)
    };

    academicRuleService.initialize(mockDb, mockRedis);
  });

  describe('evaluateCondition - All operators', () => {
    it('should evaluate != operator', () => {
      const condition = { field: 'status', operator: '!=', value: 'inactive' };
      const context = { status: 'active' };
      
      const result = academicRuleService.evaluateCondition(condition, context);
      expect(result).toBe(true);
    });

    it('should evaluate not_in operator', () => {
      const condition = { field: 'grade', operator: 'not_in', value: ['F', 'D'] };
      const context = { grade: 'A' };
      
      const result = academicRuleService.evaluateCondition(condition, context);
      expect(result).toBe(true);
    });

    it('should return false for unknown operator', () => {
      const condition = { field: 'test', operator: 'unknown', value: 10 };
      const context = { test: 10 };
      
      const result = academicRuleService.evaluateCondition(condition, context);
      expect(result).toBe(false);
    });

    it('should return false when context value is undefined', () => {
      const condition = { field: 'missing_field', operator: '==', value: 10 };
      const context = { other_field: 10 };
      
      const result = academicRuleService.evaluateCondition(condition, context);
      expect(result).toBe(false);
    });

    it('should evaluate > operator', () => {
      const condition = { field: 'score', operator: '>', value: 50 };
      const context = { score: 60 };
      
      const result = academicRuleService.evaluateCondition(condition, context);
      expect(result).toBe(true);
    });

    it('should evaluate <= operator', () => {
      const condition = { field: 'score', operator: '<=', value: 50 };
      const context = { score: 40 };
      
      const result = academicRuleService.evaluateCondition(condition, context);
      expect(result).toBe(true);
    });
  });

  describe('filterRulesByContext', () => {
    it('should filter rules for attendance context', () => {
      const rules = [
        { rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD, rule_id: 'rule-1' },
        { rule_type: RULE_TYPES.GRADE_ELIGIBILITY, rule_id: 'rule-2' }
      ];
      const context = { attendance_percentage: 75 };

      const filtered = academicRuleService.filterRulesByContext(rules, context);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].rule_id).toBe('rule-1');
    });

    it('should filter rules for grade context', () => {
      const rules = [
        { rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD, rule_id: 'rule-1' },
        { rule_type: RULE_TYPES.GRADE_ELIGIBILITY, rule_id: 'rule-2' },
        { rule_type: RULE_TYPES.GRACE_MARKS, rule_id: 'rule-3' }
      ];
      const context = { grade: 65 };

      const filtered = academicRuleService.filterRulesByContext(rules, context);
      expect(filtered).toHaveLength(2);
    });

    it('should filter rules for marks context', () => {
      const rules = [
        { rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD, rule_id: 'rule-1' },
        { rule_type: RULE_TYPES.GRACE_MARKS, rule_id: 'rule-2' }
      ];
      const context = { marks: 55 };

      const filtered = academicRuleService.filterRulesByContext(rules, context);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].rule_id).toBe('rule-2');
    });
  });

  describe('executeAction - All action types', () => {
    it('should execute SET_ELIGIBILITY action', async () => {
      const action = { type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false };
      const rule = { rule_id: 'rule-1', rule_name: 'Test Rule' };
      const context = {};

      const result = await academicRuleService.executeAction(
        action,
        mockStudentId,
        mockTenantId,
        context,
        rule
      );

      expect(result.action).toBe('set_eligibility');
      expect(result.eligible).toBe(false);
    });

    it('should execute APPLY_GRACE_MARKS action with max_marks', async () => {
      const action = { type: ACTION_TYPES.APPLY_GRACE_MARKS, marks: 10, max_marks: 5 };
      const rule = { rule_id: 'rule-1', rule_name: 'Grace Marks Rule' };
      const context = { marks: 35 };

      const result = await academicRuleService.executeAction(
        action,
        mockStudentId,
        mockTenantId,
        context,
        rule
      );

      expect(result.action).toBe('apply_grace_marks');
      expect(result.grace_marks).toBe(5); // Capped at max_marks
      expect(result.new_marks).toBe(40);
    });

    it('should execute APPLY_GRACE_MARKS action without max_marks', async () => {
      const action = { type: ACTION_TYPES.APPLY_GRACE_MARKS, marks: 5 };
      const rule = { rule_id: 'rule-1', rule_name: 'Grace Marks Rule' };
      const context = { grade: 60 };

      const result = await academicRuleService.executeAction(
        action,
        mockStudentId,
        mockTenantId,
        context,
        rule
      );

      expect(result.action).toBe('apply_grace_marks');
      expect(result.grace_marks).toBe(5);
      expect(result.new_marks).toBe(65);
    });

    it('should execute SEND_NOTIFICATION action', async () => {
      const action = { type: ACTION_TYPES.SEND_NOTIFICATION, message: 'Alert: {{attendance_percentage}}%' };
      const rule = { rule_id: 'rule-1', rule_name: 'Notification Rule' };
      const context = { attendance_percentage: 70 };

      const notificationsQuery = {
        insert: jest.fn().mockResolvedValue([])
      };

      mockDb.mockImplementation((tableName) => {
        if (tableName === 'notifications') {
          return notificationsQuery;
        }
        return mockDb;
      });

      const result = await academicRuleService.executeAction(
        action,
        mockStudentId,
        mockTenantId,
        context,
        rule
      );

      expect(result.action).toBe('send_notification');
      expect(result.message).toContain('70%');
      expect(notificationsQuery.insert).toHaveBeenCalled();
    });

    it('should handle notification insert errors gracefully', async () => {
      const action = { type: ACTION_TYPES.SEND_NOTIFICATION, message: 'Test' };
      const rule = { rule_id: 'rule-1', rule_name: 'Test Rule' };
      const context = {};

      const notificationsQuery = {
        insert: jest.fn().mockRejectedValue(new Error('DB error'))
      };

      mockDb.mockImplementation((tableName) => {
        if (tableName === 'notifications') {
          return notificationsQuery;
        }
        return mockDb;
      });

      const result = await academicRuleService.executeAction(
        action,
        mockStudentId,
        mockTenantId,
        context,
        rule
      );

      expect(result.action).toBe('send_notification');
    });

    it('should execute BLOCK_ENROLLMENT action', async () => {
      const action = { type: ACTION_TYPES.BLOCK_ENROLLMENT, reason: 'Low attendance' };
      const rule = { rule_id: 'rule-1', rule_name: 'Block Rule' };
      const context = {};

      const result = await academicRuleService.executeAction(
        action,
        mockStudentId,
        mockTenantId,
        context,
        rule
      );

      expect(result.action).toBe('block_enrollment');
      expect(result.reason).toBe('Low attendance');
    });

    it('should throw error for unknown action type', async () => {
      const action = { type: 'unknown_action' };
      const rule = { rule_id: 'rule-1', rule_name: 'Test Rule' };
      const context = {};

      await expect(
        academicRuleService.executeAction(action, mockStudentId, mockTenantId, context, rule)
      ).rejects.toThrow('Unknown action type');
    });
  });

  describe('getApplicableRules - Redis error handling', () => {
    it('should handle Redis read errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection error'));

      const dbRules = [
        {
          rule_id: 'rule-1',
          tenant_id: mockTenantId,
          rule_name: 'Test Rule',
          rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
          conditions: JSON.stringify([{ field: 'attendance_percentage', operator: '<', value: 75 }]),
          actions: JSON.stringify([{ type: ACTION_TYPES.SEND_NOTIFICATION, message: 'Alert' }]),
          priority: 100,
          status: 'active',
          effective_from: new Date('2024-01-01'),
          effective_until: null
        }
      ];

      const academicRulesQuery = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(dbRules)
      };

      mockDb.mockImplementation(() => academicRulesQuery);

      const context = { attendance_percentage: 70 };
      const rules = await academicRuleService.getApplicableRules(mockTenantId, context);

      expect(rules).toHaveLength(1);
    });

    it('should handle Redis write errors gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockRejectedValue(new Error('Redis write error'));

      const dbRules = [
        {
          rule_id: 'rule-1',
          tenant_id: mockTenantId,
          rule_name: 'Test Rule',
          rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
          conditions: JSON.stringify([{ field: 'attendance_percentage', operator: '<', value: 75 }]),
          actions: JSON.stringify([{ type: ACTION_TYPES.SEND_NOTIFICATION, message: 'Alert' }]),
          priority: 100,
          status: 'active',
          effective_from: new Date('2024-01-01'),
          effective_until: null
        }
      ];

      const academicRulesQuery = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(dbRules)
      };

      mockDb.mockImplementation(() => academicRulesQuery);

      const context = { attendance_percentage: 70 };
      const rules = await academicRuleService.getApplicableRules(mockTenantId, context);

      expect(rules).toHaveLength(1);
    });
  });

  describe('validateActionParameters - Edge cases', () => {
    it('should reject APPLY_GRACE_MARKS with invalid max_marks', () => {
      const action = { type: ACTION_TYPES.APPLY_GRACE_MARKS, marks: 5, max_marks: -1 };
      
      expect(() => academicRuleService.validateActionParameters(action, 0))
        .toThrow('max_marks must be a positive number');
    });

    it('should reject APPLY_GRACE_MARKS with non-number max_marks', () => {
      const action = { type: ACTION_TYPES.APPLY_GRACE_MARKS, marks: 5, max_marks: 'invalid' };
      
      expect(() => academicRuleService.validateActionParameters(action, 0))
        .toThrow('max_marks must be a positive number');
    });
  });

  describe('validateRuleConfig - Condition validation', () => {
    it('should reject condition without field', () => {
      const config = {
        tenant_id: mockTenantId,
        name: 'Invalid Rule',
        type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: [{ operator: '<', value: 75 }],
        actions: [{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }],
        created_by: mockUserId
      };

      expect(() => academicRuleService.validateRuleConfig(config))
        .toThrow('must have field, operator, and value');
    });

    it('should reject condition without operator', () => {
      const config = {
        tenant_id: mockTenantId,
        name: 'Invalid Rule',
        type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: [{ field: 'attendance', value: 75 }],
        actions: [{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }],
        created_by: mockUserId
      };

      expect(() => academicRuleService.validateRuleConfig(config))
        .toThrow('must have field, operator, and value');
    });

    it('should reject condition without value', () => {
      const config = {
        tenant_id: mockTenantId,
        name: 'Invalid Rule',
        type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: [{ field: 'attendance', operator: '<' }],
        actions: [{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }],
        created_by: mockUserId
      };

      expect(() => academicRuleService.validateRuleConfig(config))
        .toThrow('must have field, operator, and value');
    });

    it('should reject action without type', () => {
      const config = {
        tenant_id: mockTenantId,
        name: 'Invalid Rule',
        type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: [{ field: 'attendance', operator: '<', value: 75 }],
        actions: [{ eligible: false }],
        created_by: mockUserId
      };

      expect(() => academicRuleService.validateRuleConfig(config))
        .toThrow('must have type');
    });

    it('should reject invalid action type', () => {
      const config = {
        tenant_id: mockTenantId,
        name: 'Invalid Rule',
        type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: [{ field: 'attendance', operator: '<', value: 75 }],
        actions: [{ type: 'invalid_action' }],
        created_by: mockUserId
      };

      expect(() => academicRuleService.validateRuleConfig(config))
        .toThrow('Invalid action type');
    });
  });

  describe('isAmbiguousConditionPair - Mixed operators', () => {
    it('should detect overlapping > and >= conditions', () => {
      const cond1 = { field: 'score', operator: '>', value: 75 };
      const cond2 = { field: 'score', operator: '>=', value: 80 };

      const result = academicRuleService.isAmbiguousConditionPair(cond1, cond2);
      expect(result).toBe(true);
    });

    it('should detect overlapping < and <= conditions', () => {
      const cond1 = { field: 'score', operator: '<', value: 40 };
      const cond2 = { field: 'score', operator: '<=', value: 35 };

      const result = academicRuleService.isAmbiguousConditionPair(cond1, cond2);
      expect(result).toBe(true);
    });
  });

  describe('evaluateRulesForStudent - Performance logging', () => {
    it('should log warning when latency exceeds 100ms', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockRule = {
        rule_id: 'rule-1',
        tenant_id: mockTenantId,
        rule_name: 'Slow Rule',
        rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: JSON.stringify([{ field: 'attendance_percentage', operator: '<', value: 75 }]),
        actions: JSON.stringify([{ type: ACTION_TYPES.SEND_NOTIFICATION, message: 'Alert' }]),
        priority: 100,
        status: 'active',
        effective_from: new Date('2024-01-01'),
        effective_until: null
      };

      const academicRulesQuery = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockImplementation(() => {
          // Simulate slow query
          return new Promise(resolve => setTimeout(() => resolve([mockRule]), 150));
        })
      };

      const evaluationsQuery = {
        insert: jest.fn().mockResolvedValue([]),
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue([])
      };

      const notificationsQuery = {
        insert: jest.fn().mockResolvedValue([])
      };

      mockDb.mockImplementation((tableName) => {
        if (tableName === 'academic_rules') {
          return academicRulesQuery;
        } else if (tableName === 'rule_evaluations') {
          return evaluationsQuery;
        } else if (tableName === 'notifications') {
          return notificationsQuery;
        }
        return academicRulesQuery;
      });

      const context = { attendance_percentage: 70 };
      await academicRuleService.evaluateRulesForStudent(mockStudentId, mockTenantId, context);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rule evaluation latency exceeded 100ms')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Database operations without Redis', () => {
    it('should work without Redis initialized', async () => {
      academicRuleService.initialize(mockDb, null);

      await academicRuleService.invalidateRuleCache(mockTenantId);
      // Should not throw
    });
  });
});


describe('AcademicRuleService - Complete Branch Coverage', () => {
  const mockTenantId = 'tenant-123';
  const mockStudentId = 'student-456';
  const mockUserId = 'user-789';

  let mockDb;
  let mockRedis;

  beforeEach(() => {
    const mockQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      whereNot: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue([])
    };

    mockDb = jest.fn(() => mockQuery);
    Object.assign(mockDb, mockQuery);

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1)
    };

    academicRuleService.initialize(mockDb, mockRedis);
  });

  describe('updateRule - with actions', () => {
    it('should update rule with new actions', async () => {
      const existingRule = {
        rule_id: 'rule-123',
        tenant_id: mockTenantId,
        rule_name: 'Test Rule',
        rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: JSON.stringify([{ field: 'attendance_percentage', operator: '<', value: 75 }]),
        actions: JSON.stringify([{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }]),
        status: 'active'
      };

      const getRuleQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(existingRule)
      };

      const updateQuery = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue([])
      };

      const redisDelQuery = {
        del: jest.fn().mockResolvedValue(1)
      };

      let callCount = 0;
      mockDb.mockImplementation(() => {
        callCount++;
        if (callCount === 1 || callCount === 3) return getRuleQuery;
        return updateQuery;
      });

      const updates = {
        actions: [{ type: ACTION_TYPES.SEND_NOTIFICATION, message: 'New notification' }]
      };

      await academicRuleService.updateRule('rule-123', mockTenantId, updates);

      expect(updateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          actions: expect.any(String)
        })
      );
    });
  });

  describe('evaluateRulesForStudent - error handling', () => {
    it('should handle errors during rule evaluation', async () => {
      const academicRulesQuery = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockRejectedValue(new Error('Database error'))
      };

      mockDb.mockImplementation(() => academicRulesQuery);

      const context = { attendance_percentage: 70 };

      await expect(
        academicRuleService.evaluateRulesForStudent(mockStudentId, mockTenantId, context)
      ).rejects.toThrow('Database error');
    });
  });

  describe('executeRuleActions - error handling', () => {
    it('should handle action execution errors gracefully', async () => {
      const mockRule = {
        rule_id: 'rule-1',
        tenant_id: mockTenantId,
        rule_name: 'Test Rule',
        rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: JSON.stringify([{ field: 'attendance_percentage', operator: '<', value: 75 }]),
        actions: JSON.stringify([
          { type: 'invalid_action_type' }
        ]),
        priority: 100,
        status: 'active',
        effective_from: new Date('2024-01-01'),
        effective_until: null
      };

      const academicRulesQuery = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([mockRule])
      };

      const evaluationsQuery = {
        insert: jest.fn().mockResolvedValue([]),
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue([])
      };

      mockDb.mockImplementation((tableName) => {
        if (tableName === 'academic_rules') {
          return academicRulesQuery;
        } else if (tableName === 'rule_evaluations') {
          return evaluationsQuery;
        }
        return academicRulesQuery;
      });

      const context = { attendance_percentage: 70 };

      const evaluations = await academicRuleService.evaluateRulesForStudent(
        mockStudentId,
        mockTenantId,
        context
      );

      expect(evaluations).toHaveLength(1);
      expect(evaluations[0].condition_met).toBe(true);
    });
  });

  describe('logEvaluation - error handling', () => {
    it('should handle logging errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockRule = {
        rule_id: 'rule-1',
        tenant_id: mockTenantId,
        rule_name: 'Test Rule',
        rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: JSON.stringify([{ field: 'attendance_percentage', operator: '<', value: 75 }]),
        actions: JSON.stringify([{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: true }]),
        priority: 100,
        status: 'active',
        effective_from: new Date('2024-01-01'),
        effective_until: null
      };

      const academicRulesQuery = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([mockRule])
      };

      const evaluationsQuery = {
        insert: jest.fn().mockRejectedValue(new Error('Insert failed')),
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue([])
      };

      mockDb.mockImplementation((tableName) => {
        if (tableName === 'academic_rules') {
          return academicRulesQuery;
        } else if (tableName === 'rule_evaluations') {
          return evaluationsQuery;
        }
        return academicRulesQuery;
      });

      const context = { attendance_percentage: 70 };

      const evaluations = await academicRuleService.evaluateRulesForStudent(
        mockStudentId,
        mockTenantId,
        context
      );

      expect(evaluations).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalledWith('Error logging evaluation:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('filterRulesByContext - empty context', () => {
    it('should return empty array when no relevant context fields', () => {
      const rules = [
        { rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD, rule_id: 'rule-1' },
        { rule_type: RULE_TYPES.GRADE_ELIGIBILITY, rule_id: 'rule-2' }
      ];
      const context = { irrelevant_field: 'value' };

      const filtered = academicRuleService.filterRulesByContext(rules, context);
      expect(filtered).toHaveLength(0);
    });

    it('should include both GRADE_ELIGIBILITY and GRACE_MARKS for grade context', () => {
      const rules = [
        { rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD, rule_id: 'rule-1' },
        { rule_type: RULE_TYPES.GRADE_ELIGIBILITY, rule_id: 'rule-2' },
        { rule_type: RULE_TYPES.GRACE_MARKS, rule_id: 'rule-3' }
      ];
      const context = { grade: 65 };

      const filtered = academicRuleService.filterRulesByContext(rules, context);
      expect(filtered).toHaveLength(2);
      expect(filtered.map(r => r.rule_id)).toEqual(['rule-2', 'rule-3']);
    });
  });

  describe('evaluateCondition - edge cases', () => {
    it('should handle in operator with non-array value', () => {
      const condition = { field: 'status', operator: 'in', value: 'not-an-array' };
      const context = { status: 'active' };
      
      const result = academicRuleService.evaluateCondition(condition, context);
      expect(result).toBe(false);
    });

    it('should handle not_in operator with non-array value', () => {
      const condition = { field: 'status', operator: 'not_in', value: 'not-an-array' };
      const context = { status: 'active' };
      
      const result = academicRuleService.evaluateCondition(condition, context);
      expect(result).toBe(false);
    });

    it('should handle in operator when value not in array', () => {
      const condition = { field: 'status', operator: 'in', value: ['pending', 'rejected'] };
      const context = { status: 'active' };
      
      const result = academicRuleService.evaluateCondition(condition, context);
      expect(result).toBe(false);
    });

    it('should handle not_in operator when value is in array', () => {
      const condition = { field: 'status', operator: 'not_in', value: ['active', 'pending'] };
      const context = { status: 'active' };
      
      const result = academicRuleService.evaluateCondition(condition, context);
      expect(result).toBe(false);
    });
  });

  describe('applyGraceMarks - with grade instead of marks', () => {
    it('should use grade when marks is not available', async () => {
      const action = { type: ACTION_TYPES.APPLY_GRACE_MARKS, marks: 5 };
      const rule = { rule_id: 'rule-1', rule_name: 'Grace Marks Rule' };
      const context = { grade: 60 };

      const result = await academicRuleService.applyGraceMarks(
        mockStudentId,
        mockTenantId,
        action.marks,
        undefined,
        context
      );

      expect(result.original_marks).toBe(60);
      expect(result.new_marks).toBe(65);
    });
  });

  describe('formatNotificationMessage - multiple replacements', () => {
    it('should replace multiple occurrences of same variable', () => {
      const template = 'Your attendance is {{attendance_percentage}}%. Minimum required: {{attendance_percentage}}%';
      const context = { attendance_percentage: 70 };
      const rule = { rule_name: 'Test Rule' };

      const formatted = academicRuleService.formatNotificationMessage(
        template,
        context,
        rule
      );

      expect(formatted).toBe('Your attendance is 70%. Minimum required: 70%');
    });

    it('should handle template with no variables', () => {
      const template = 'This is a static message';
      const context = { attendance_percentage: 70 };
      const rule = { rule_name: 'Test Rule' };

      const formatted = academicRuleService.formatNotificationMessage(
        template,
        context,
        rule
      );

      expect(formatted).toBe('This is a static message');
    });

    it('should replace multiple different variables', () => {
      const template = 'Rule {{rule_name}}: Your attendance is {{attendance_percentage}}%';
      const context = { attendance_percentage: 70 };
      const rule = { rule_name: 'Attendance Alert' };

      const formatted = academicRuleService.formatNotificationMessage(
        template,
        context,
        rule
      );

      expect(formatted).toBe('Rule Attendance Alert: Your attendance is 70%');
    });
  });

  describe('validateActionParameters - all branches', () => {
    it('should accept valid APPLY_GRACE_MARKS without max_marks', () => {
      const action = { type: ACTION_TYPES.APPLY_GRACE_MARKS, marks: 5 };
      
      expect(() => academicRuleService.validateActionParameters(action, 0)).not.toThrow();
    });

    it('should accept valid APPLY_GRACE_MARKS with valid max_marks', () => {
      const action = { type: ACTION_TYPES.APPLY_GRACE_MARKS, marks: 5, max_marks: 10 };
      
      expect(() => academicRuleService.validateActionParameters(action, 0)).not.toThrow();
    });
  });

  describe('hasConflictingConditions - no conflicts', () => {
    it('should return false when conditions are on different fields', () => {
      const conditions1 = [
        { field: 'attendance_percentage', operator: '<', value: 75 }
      ];
      const conditions2 = [
        { field: 'grade', operator: '<', value: 60 }
      ];

      const result = academicRuleService.hasConflictingConditions(conditions1, conditions2);
      expect(result).toBe(false);
    });

    it('should return false when no conditions match', () => {
      const conditions1 = [
        { field: 'field1', operator: '<', value: 75 }
      ];
      const conditions2 = [
        { field: 'field2', operator: '<', value: 60 }
      ];

      const result = academicRuleService.hasConflictingConditions(conditions1, conditions2);
      expect(result).toBe(false);
    });
  });

  describe('isAmbiguousConditionPair - all branches', () => {
    it('should return false for different operators on same field', () => {
      const cond1 = { field: 'score', operator: '>=', value: 75 };
      const cond2 = { field: 'score', operator: '==', value: 75 };

      const result = academicRuleService.isAmbiguousConditionPair(cond1, cond2);
      expect(result).toBe(false);
    });

    it('should return false for same operator but different values that dont overlap', () => {
      const cond1 = { field: 'score', operator: '==', value: 75 };
      const cond2 = { field: 'score', operator: '==', value: 80 };

      const result = academicRuleService.isAmbiguousConditionPair(cond1, cond2);
      expect(result).toBe(false);
    });
  });

  describe('getEvaluationHistory - with ruleId filter', () => {
    it('should filter by ruleId when provided', async () => {
      const mockEvaluations = [
        {
          evaluation_id: 'eval-1',
          rule_id: 'rule-1',
          tenant_id: mockTenantId,
          student_id: mockStudentId,
          context: JSON.stringify({ attendance_percentage: 70 }),
          condition_met: true,
          action_executed: true,
          action_result: null,
          evaluated_at: new Date()
        }
      ];

      const evaluationsQuery = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve(mockEvaluations))
      };

      mockDb.mockImplementation(() => evaluationsQuery);

      const history = await academicRuleService.getEvaluationHistory(
        mockStudentId,
        mockTenantId,
        { limit: 50, offset: 0, ruleId: 'rule-1' }
      );

      expect(history).toHaveLength(1);
      // Check that where was called twice - once for student/tenant, once for ruleId
      expect(evaluationsQuery.where).toHaveBeenCalledTimes(2);
      expect(evaluationsQuery.where).toHaveBeenCalledWith({ rule_id: 'rule-1' });
    });
  });
});


describe('AcademicRuleService - CRUD Operations Coverage', () => {
  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-789';

  let mockDb;
  let mockRedis;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const mockQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      whereNot: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue([])
    };

    mockDb = jest.fn(() => mockQuery);
    Object.assign(mockDb, mockQuery);
    
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1)
    };

    academicRuleService.initialize(mockDb, mockRedis);
  });

  describe('createRule - complete flow', () => {
    it('should create rule with all optional fields', async () => {
      // Mock checkRuleConflicts to return no conflicts
      const conflictQuery = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve([]))
      };

      // Mock insert
      const insertQuery = {
        insert: jest.fn().mockResolvedValue([])
      };

      let callCount = 0;
      mockDb.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return conflictQuery;
        return insertQuery;
      });

      const ruleConfig = {
        tenant_id: mockTenantId,
        name: 'Complete Rule',
        type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: [{ field: 'attendance_percentage', operator: '<', value: 75 }],
        actions: [{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }],
        priority: 200,
        effective_from: new Date('2026-01-01'),
        effective_until: new Date('2026-12-31'),
        created_by: mockUserId
      };

      const rule = await academicRuleService.createRule(ruleConfig);

      expect(rule).toBeDefined();
      expect(rule.rule_id).toBeDefined();
      expect(rule.priority).toBe(200);
    });

    it('should create rule with default priority and effective_from', async () => {
      // Mock checkRuleConflicts
      const conflictQuery = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve([]))
      };

      // Mock insert
      const insertQuery = {
        insert: jest.fn().mockResolvedValue([])
      };

      let callCount = 0;
      mockDb.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return conflictQuery;
        return insertQuery;
      });

      const ruleConfig = {
        tenant_id: mockTenantId,
        name: 'Default Values Rule',
        type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: [{ field: 'attendance_percentage', operator: '<', value: 75 }],
        actions: [{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }],
        created_by: mockUserId
      };

      const rule = await academicRuleService.createRule(ruleConfig);

      expect(rule).toBeDefined();
      expect(rule.priority).toBe(100); // Default priority
    });
  });

  describe('listRules - with filters', () => {
    it('should list rules with type filter', async () => {
      const mockRules = [
        {
          rule_id: 'rule-1',
          tenant_id: mockTenantId,
          rule_name: 'Rule 1',
          rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
          conditions: JSON.stringify([{ field: 'attendance', operator: '<', value: 75 }]),
          actions: JSON.stringify([{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }]),
          status: 'active'
        }
      ];

      const whereChain = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve(mockRules))
      };

      mockDb.mockImplementation(() => whereChain);

      const rules = await academicRuleService.listRules(mockTenantId, {
        type: RULE_TYPES.ATTENDANCE_THRESHOLD
      });

      expect(rules).toHaveLength(1);
    });

    it('should list rules with status filter', async () => {
      const mockRules = [];

      const whereChain = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve(mockRules))
      };

      mockDb.mockImplementation(() => whereChain);

      const rules = await academicRuleService.listRules(mockTenantId, {
        status: 'inactive'
      });

      expect(rules).toHaveLength(0);
    });

    it('should list active rules only with active_only filter', async () => {
      const mockRules = [];

      const whereChain = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve(mockRules))
      };

      mockDb.mockImplementation(() => whereChain);

      const rules = await academicRuleService.listRules(mockTenantId, {
        active_only: true
      });

      expect(rules).toHaveLength(0);
    });
  });

  describe('updateRule - conflict checking', () => {
    it('should check for conflicts when updating conditions', async () => {
      const existingRule = {
        rule_id: 'rule-123',
        tenant_id: mockTenantId,
        rule_name: 'Test Rule',
        rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: JSON.stringify([{ field: 'attendance_percentage', operator: '<', value: 75 }]),
        actions: JSON.stringify([{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }]),
        status: 'active'
      };

      const conflictingRule = {
        rule_id: 'rule-456',
        tenant_id: mockTenantId,
        rule_name: 'Conflicting Rule',
        rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: JSON.stringify([{ field: 'attendance_percentage', operator: '<', value: 80 }]),
        actions: JSON.stringify([{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }]),
        status: 'active'
      };

      const getRuleQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(existingRule)
      };

      const conflictQuery = {
        where: jest.fn().mockReturnThis(),
        whereNot: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve([conflictingRule]))
      };

      let callCount = 0;
      mockDb.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return getRuleQuery;
        return conflictQuery;
      });

      const updates = {
        conditions: [{ field: 'attendance_percentage', operator: '<', value: 80 }]
      };

      await expect(
        academicRuleService.updateRule('rule-123', mockTenantId, updates)
      ).rejects.toThrow('Updated rule would conflict');
    });

    it('should update rule when no conflicts exist', async () => {
      const existingRule = {
        rule_id: 'rule-123',
        tenant_id: mockTenantId,
        rule_name: 'Test Rule',
        rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: JSON.stringify([{ field: 'attendance_percentage', operator: '<', value: 75 }]),
        actions: JSON.stringify([{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }]),
        status: 'active'
      };

      const getRuleQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(existingRule)
      };

      const conflictQuery = {
        where: jest.fn().mockReturnThis(),
        whereNot: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve([])) // No conflicts
      };

      const updateQuery = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue([])
      };

      let callCount = 0;
      mockDb.mockImplementation(() => {
        callCount++;
        if (callCount === 1 || callCount === 4) return getRuleQuery;
        if (callCount === 2) return conflictQuery;
        if (callCount === 3) return updateQuery;
        return getRuleQuery;
      });

      const updates = {
        conditions: [{ field: 'attendance_percentage', operator: '<', value: 70 }]
      };

      const updatedRule = await academicRuleService.updateRule('rule-123', mockTenantId, updates);

      expect(updatedRule).toBeDefined();
      expect(updateQuery.update).toHaveBeenCalled();
    });

    it('should update rule without checking conflicts when conditions not updated', async () => {
      const existingRule = {
        rule_id: 'rule-123',
        tenant_id: mockTenantId,
        rule_name: 'Test Rule',
        rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: JSON.stringify([{ field: 'attendance_percentage', operator: '<', value: 75 }]),
        actions: JSON.stringify([{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }]),
        status: 'active'
      };

      const getRuleQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(existingRule)
      };

      const updateQuery = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue([])
      };

      let callCount = 0;
      mockDb.mockImplementation(() => {
        callCount++;
        if (callCount === 1 || callCount === 3) return getRuleQuery;
        return updateQuery;
      });

      const updates = {
        rule_name: 'Updated Name'
      };

      const updatedRule = await academicRuleService.updateRule('rule-123', mockTenantId, updates);

      expect(updatedRule).toBeDefined();
      expect(updateQuery.update).toHaveBeenCalled();
    });
  });

  describe('deactivateRule and deleteRule', () => {
    it('should deactivate a rule', async () => {
      const existingRule = {
        rule_id: 'rule-123',
        tenant_id: mockTenantId,
        rule_name: 'Test Rule',
        rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: JSON.stringify([{ field: 'attendance_percentage', operator: '<', value: 75 }]),
        actions: JSON.stringify([{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }]),
        status: 'inactive'
      };

      const updateQuery = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue([])
      };

      const getRuleQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(existingRule)
      };

      let callCount = 0;
      mockDb.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return updateQuery;
        return getRuleQuery;
      });

      const deactivatedRule = await academicRuleService.deactivateRule('rule-123', mockTenantId);

      expect(deactivatedRule).toBeDefined();
      expect(updateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'inactive' })
      );
    });

    it('should delete a rule (soft delete)', async () => {
      const updateQuery = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue([])
      };

      mockDb.mockImplementation(() => updateQuery);

      await academicRuleService.deleteRule('rule-123', mockTenantId);

      expect(updateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'deleted' })
      );
    });
  });

  describe('checkRuleConflicts - with effective_until', () => {
    it('should check conflicts with rules that have effective_until in future', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const existingRule = {
        rule_id: 'rule-existing',
        tenant_id: mockTenantId,
        rule_name: 'Existing Rule',
        rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
        conditions: JSON.stringify([{ field: 'attendance_percentage', operator: '<', value: 75 }]),
        actions: JSON.stringify([{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }]),
        status: 'active',
        effective_until: futureDate
      };

      const conflictQuery = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve([existingRule]))
      };

      mockDb.mockImplementation(() => conflictQuery);

      const newConditions = [{ field: 'attendance_percentage', operator: '<', value: 75 }];

      await expect(
        academicRuleService.checkRuleConflicts(mockTenantId, RULE_TYPES.ATTENDANCE_THRESHOLD, newConditions)
      ).rejects.toThrow('Rule conflicts with existing rule');
    });

    it('should not throw when no conflicts exist', async () => {
      const conflictQuery = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve([])) // No existing rules
      };

      mockDb.mockImplementation(() => conflictQuery);

      const newConditions = [{ field: 'attendance_percentage', operator: '<', value: 75 }];

      await expect(
        academicRuleService.checkRuleConflicts(mockTenantId, RULE_TYPES.ATTENDANCE_THRESHOLD, newConditions)
      ).resolves.not.toThrow();
    });
  });

  describe('getApplicableRules - date filtering', () => {
    it('should filter rules by effective_from and effective_until dates', async () => {
      const now = new Date();
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const mockRules = [
        {
          rule_id: 'rule-1',
          tenant_id: mockTenantId,
          rule_name: 'Active Rule',
          rule_type: RULE_TYPES.ATTENDANCE_THRESHOLD,
          conditions: JSON.stringify([{ field: 'attendance_percentage', operator: '<', value: 75 }]),
          actions: JSON.stringify([{ type: ACTION_TYPES.SET_ELIGIBILITY, eligible: false }]),
          status: 'active',
          effective_from: pastDate,
          effective_until: futureDate
        }
      ];

      const rulesQuery = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockRules)
      };

      mockDb.mockImplementation(() => rulesQuery);

      const context = { attendance_percentage: 70 };
      const rules = await academicRuleService.getApplicableRules(mockTenantId, context);

      expect(rules).toHaveLength(1);
      expect(rulesQuery.where).toHaveBeenCalledWith('effective_from', '<=', expect.any(Date));
    });
  });
});
