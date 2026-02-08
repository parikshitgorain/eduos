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
