/**
 * Tests for Academic Rule Service
 */

const academicRuleService = require('./academicRuleService');
const { RULE_TYPES, ACTION_TYPES } = require('./academicRuleService');

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
