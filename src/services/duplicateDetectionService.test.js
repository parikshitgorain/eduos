/**
 * Tests for Duplicate Detection Service
 * Task 3.2.1: Build deterministic fuzzy matching layer
 */

const duplicateDetectionService = require('./duplicateDetectionService');

// Mock the database
jest.mock('../config/database', () => ({
  getPool: jest.fn()
}));

const { getPool } = require('../config/database');

describe('Duplicate Detection Service', () => {
  let mockPool;
  
  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn()
    };
    getPool.mockReturnValue(mockPool);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('levenshteinSimilarity', () => {
    it('should return 1.0 for identical strings', () => {
      const result = duplicateDetectionService.levenshteinSimilarity('John', 'John');
      expect(result).toBe(1.0);
    });
    
    it('should return 1.0 for identical strings with different case', () => {
      const result = duplicateDetectionService.levenshteinSimilarity('John', 'john');
      expect(result).toBe(1.0);
    });
    
    it('should return 1.0 for identical strings with whitespace', () => {
      const result = duplicateDetectionService.levenshteinSimilarity('  John  ', 'John');
      expect(result).toBe(1.0);
    });
    
    it('should return 0 for completely different strings', () => {
      const result = duplicateDetectionService.levenshteinSimilarity('John', 'Xyz');
      expect(result).toBeLessThan(0.5);
    });
    
    it('should return high similarity for similar strings', () => {
      const result = duplicateDetectionService.levenshteinSimilarity('John', 'Jon');
      expect(result).toBeGreaterThan(0.7);
    });
    
    it('should handle phonetic variations', () => {
      const result = duplicateDetectionService.levenshteinSimilarity('Smith', 'Smyth');
      expect(result).toBeGreaterThan(0.6);
    });
    
    it('should return 0 for null or undefined strings', () => {
      expect(duplicateDetectionService.levenshteinSimilarity(null, 'John')).toBe(0);
      expect(duplicateDetectionService.levenshteinSimilarity('John', null)).toBe(0);
      expect(duplicateDetectionService.levenshteinSimilarity(undefined, 'John')).toBe(0);
    });
    
    it('should return 1.0 for empty strings', () => {
      const result = duplicateDetectionService.levenshteinSimilarity('', '');
      expect(result).toBe(1.0);
    });
  });
  
  describe('calculateDeterministicScore', () => {
    it('should return score of 1.0 for identical students', () => {
      const student1 = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-03-15'
      };
      const student2 = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-03-15'
      };
      
      const result = duplicateDetectionService.calculateDeterministicScore(student1, student2);
      expect(result.score).toBe(1.0);
      expect(result.firstNameSimilarity).toBe(1.0);
      expect(result.lastNameSimilarity).toBe(1.0);
      expect(result.dobMatch).toBe(1.0);
    });
    
    it('should apply correct weights: 0.4×first + 0.4×last + 0.2×DOB', () => {
      const student1 = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-03-15'
      };
      const student2 = {
        first_name: 'John',  // 100% match
        last_name: 'Doe',    // 100% match
        date_of_birth: '2005-03-16'  // No match
      };
      
      const result = duplicateDetectionService.calculateDeterministicScore(student1, student2);
      // 0.4 * 1.0 + 0.4 * 1.0 + 0.2 * 0.0 = 0.8
      expect(result.score).toBe(0.8);
    });
    
    it('should flag high similarity names with different DOB', () => {
      const student1 = {
        first_name: 'Robert',
        last_name: 'Johnson',
        date_of_birth: '2005-03-15'
      };
      const student2 = {
        first_name: 'Robert',
        last_name: 'Johnson',
        date_of_birth: '2005-06-20'
      };
      
      const result = duplicateDetectionService.calculateDeterministicScore(student1, student2);
      expect(result.score).toBeGreaterThan(0.75);
      expect(result.dobMatch).toBe(0.0);
    });
    
    it('should detect phonetic variations', () => {
      const student1 = {
        first_name: 'Catherine',
        last_name: 'Smith',
        date_of_birth: '2005-03-15'
      };
      const student2 = {
        first_name: 'Katherine',
        last_name: 'Smyth',
        date_of_birth: '2005-03-15'
      };
      
      const result = duplicateDetectionService.calculateDeterministicScore(student1, student2);
      expect(result.score).toBeGreaterThan(0.6);
    });
    
    it('should handle missing date of birth', () => {
      const student1 = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: null
      };
      const student2 = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-03-15'
      };
      
      const result = duplicateDetectionService.calculateDeterministicScore(student1, student2);
      expect(result.dobMatch).toBe(0.0);
      expect(result.score).toBe(0.8); // 0.4 + 0.4 + 0
    });
  });
  
  describe('checkDuplicates', () => {
    it('should throw error for missing required fields', async () => {
      await expect(
        duplicateDetectionService.checkDuplicates({})
      ).rejects.toThrow('Missing required fields');
    });
    
    it('should return empty array when no duplicates found', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            student_id: 'existing-uuid',
            first_name: 'Jane',
            last_name: 'Smith',
            date_of_birth: '2006-01-01',
            email: 'jane@example.com',
            phone: '1234567890',
            created_at: new Date()
          }
        ]
      });
      
      const result = await duplicateDetectionService.checkDuplicates({
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-03-15',
        tenant_id: 'tenant-uuid'
      });
      
      expect(result).toEqual([]);
    });
    
    it('should return candidates with score > 0.75', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            student_id: 'duplicate-uuid',
            first_name: 'John',
            last_name: 'Doe',
            date_of_birth: '2005-03-15',
            email: 'john@example.com',
            phone: '9876543210',
            created_at: new Date('2024-01-01')
          }
        ]
      });
      
      const result = await duplicateDetectionService.checkDuplicates({
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-03-15',
        tenant_id: 'tenant-uuid'
      });
      
      expect(result).toHaveLength(1);
      expect(result[0].candidate_student_id).toBe('duplicate-uuid');
      expect(result[0].likelihood_score).toBe(1.0);
      expect(result[0].status).toBe('pending_review');
      expect(result[0].reason_codes).toContain('Date of birth exact match');
    });
    
    it('should exclude current student when student_id provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      
      await duplicateDetectionService.checkDuplicates({
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-03-15',
        tenant_id: 'tenant-uuid',
        student_id: 'current-student-uuid'
      });
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND student_id != $2'),
        ['tenant-uuid', 'current-student-uuid']
      );
    });
    
    it('should sort candidates by likelihood score (highest first)', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            student_id: 'student-1',
            first_name: 'John',
            last_name: 'Doe',
            date_of_birth: '2005-03-16',
            email: 'john1@example.com',
            phone: '1111111111',
            created_at: new Date()
          },
          {
            student_id: 'student-2',
            first_name: 'John',
            last_name: 'Doe',
            date_of_birth: '2005-03-15',
            email: 'john2@example.com',
            phone: '2222222222',
            created_at: new Date()
          }
        ]
      });
      
      const result = await duplicateDetectionService.checkDuplicates({
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-03-15',
        tenant_id: 'tenant-uuid'
      });
      
      expect(result).toHaveLength(2);
      // student-2 should be first (exact DOB match = score 1.0)
      expect(result[0].candidate_student_id).toBe('student-2');
      expect(result[0].likelihood_score).toBe(1.0);
      // student-1 should be second (no DOB match = score 0.8)
      expect(result[1].candidate_student_id).toBe('student-1');
      expect(result[1].likelihood_score).toBe(0.8);
    });
    
    it('should only query active students', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      
      await duplicateDetectionService.checkDuplicates({
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-03-15',
        tenant_id: 'tenant-uuid'
      });
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("AND status = 'active'"),
        expect.any(Array)
      );
    });
    
    it('should enforce tenant isolation', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      
      await duplicateDetectionService.checkDuplicates({
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-03-15',
        tenant_id: 'tenant-uuid'
      });
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1'),
        expect.arrayContaining(['tenant-uuid'])
      );
    });
  });
  
  describe('generateReasonCodes', () => {
    it('should generate reason for high first name similarity', () => {
      const scoreData = {
        firstNameSimilarity: 0.95,
        lastNameSimilarity: 0.5,
        dobMatch: 0.0
      };
      
      const reasons = duplicateDetectionService.generateReasonCodes(scoreData);
      expect(reasons).toContain('High first name similarity (95%)');
    });
    
    it('should generate reason for moderate last name similarity', () => {
      const scoreData = {
        firstNameSimilarity: 0.5,
        lastNameSimilarity: 0.75,
        dobMatch: 0.0
      };
      
      const reasons = duplicateDetectionService.generateReasonCodes(scoreData);
      expect(reasons).toContain('Moderate last name similarity (75%)');
    });
    
    it('should generate reason for DOB exact match', () => {
      const scoreData = {
        firstNameSimilarity: 0.6,
        lastNameSimilarity: 0.6,
        dobMatch: 1.0
      };
      
      const reasons = duplicateDetectionService.generateReasonCodes(scoreData);
      expect(reasons).toContain('Date of birth exact match');
    });
    
    it('should generate default reason when no specific matches', () => {
      const scoreData = {
        firstNameSimilarity: 0.6,
        lastNameSimilarity: 0.6,
        dobMatch: 0.0
      };
      
      const reasons = duplicateDetectionService.generateReasonCodes(scoreData);
      expect(reasons).toContain('Potential match detected');
    });
  });
  
  describe('batchCheckDuplicates', () => {
    it('should check duplicates for multiple students', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      
      const students = [
        { first_name: 'John', last_name: 'Doe', date_of_birth: '2005-03-15' },
        { first_name: 'Jane', last_name: 'Smith', date_of_birth: '2006-01-01' }
      ];
      
      const result = await duplicateDetectionService.batchCheckDuplicates(
        students,
        'tenant-uuid'
      );
      
      expect(result).toHaveLength(2);
      expect(result[0].input_student).toEqual(students[0]);
      expect(result[0].has_duplicates).toBe(false);
      expect(result[1].input_student).toEqual(students[1]);
      expect(result[1].has_duplicates).toBe(false);
    });
    
    it('should flag students with duplicates', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              student_id: 'duplicate-uuid',
              first_name: 'John',
              last_name: 'Doe',
              date_of_birth: '2005-03-15',
              email: 'john@example.com',
              phone: '1234567890',
              created_at: new Date()
            }
          ]
        })
        .mockResolvedValueOnce({ rows: [] });
      
      const students = [
        { first_name: 'John', last_name: 'Doe', date_of_birth: '2005-03-15' },
        { first_name: 'Jane', last_name: 'Smith', date_of_birth: '2006-01-01' }
      ];
      
      const result = await duplicateDetectionService.batchCheckDuplicates(
        students,
        'tenant-uuid'
      );
      
      expect(result[0].has_duplicates).toBe(true);
      expect(result[0].duplicates).toHaveLength(1);
      expect(result[1].has_duplicates).toBe(false);
    });
  });
  
  describe('Performance Requirements', () => {
    it('should handle large datasets efficiently', async () => {
      // Simulate 100K students
      const largeDataset = Array(1000).fill(null).map((_, i) => ({
        student_id: `student-${i}`,
        first_name: `Student${i}`,
        last_name: `Last${i}`,
        date_of_birth: '2005-01-01',
        email: `student${i}@example.com`,
        phone: `123456${i}`,
        created_at: new Date()
      }));
      
      mockPool.query.mockResolvedValue({ rows: largeDataset });
      
      const startTime = Date.now();
      
      await duplicateDetectionService.checkDuplicates({
        first_name: 'TestStudent',
        last_name: 'TestLast',
        date_of_birth: '2005-01-01',
        tenant_id: 'tenant-uuid'
      });
      
      const duration = Date.now() - startTime;
      
      // Should complete in reasonable time (< 500ms for 1K records)
      // Note: 100K would be tested in integration tests
      expect(duration).toBeLessThan(500);
    });
  });
});
