/**
 * Unit Tests for Task 3.2.3: Consolidated Duplicate Scoring System
 * 
 * Tests the integration of deterministic + AI semantic matching
 * Formula: likelihood_score = 0.6 × deterministic_score + 0.4 × ai_similarity_score
 */

const {
  applyConsolidatedScoring,
  generateReasonCodes
} = require('./duplicateDetectionService');

// Mock http module
jest.mock('http');
const http = require('http');

describe('Task 3.2.3: Consolidated Duplicate Scoring System', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Set AI service URL
    process.env.AI_SERVICE_URL = 'http://localhost:8000';
  });
  
  describe('applyConsolidatedScoring', () => {
    
    test('should return empty array for empty candidates', async () => {
      const queryStudent = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-03-15'
      };
      
      const result = await applyConsolidatedScoring(queryStudent, []);
      
      expect(result).toEqual([]);
    });
    
    test('should apply consolidated scoring formula: 0.6×deterministic + 0.4×AI', async () => {
      const queryStudent = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-03-15',
        email: 'john@example.com',
        phone: '+1234567890'
      };
      
      const candidates = [
        {
          candidate_student_id: 'student-123',
          candidate_first_name: 'Jon',
          candidate_last_name: 'Doe',
          candidate_date_of_birth: '2005-03-15',
          candidate_email: 'jon@example.com',
          candidate_phone: '+1234567890',
          deterministic_score: 0.85,
          first_name_similarity: 0.85,
          last_name_similarity: 1.0,
          dob_match: 1.0
        }
      ];
      
      // Mock AI service response
      const mockAiResponse = {
        matches: [
          {
            candidate_student: {
              student_id: 'student-123',
              first_name: 'Jon',
              last_name: 'Doe'
            },
            semantic_similarity: 0.92,
            is_semantic_duplicate: true,
            model_version: 'all-MiniLM-L6-v2',
            embedding_dimension: 384
          }
        ]
      };
      
      // Mock http.request
      http.request.mockImplementation((options, callback) => {
        const mockRes = {
          statusCode: 200,
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(JSON.stringify(mockAiResponse));
            } else if (event === 'end') {
              handler();
            }
          })
        };
        
        callback(mockRes);
        
        return {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn()
        };
      });
      
      const result = await applyConsolidatedScoring(queryStudent, candidates);
      
      expect(result).toHaveLength(1);
      
      const match = result[0];
      
      // Verify consolidated score calculation
      const expectedScore = (0.6 * 0.85) + (0.4 * 0.92);
      expect(match.likelihood_score).toBeCloseTo(expectedScore, 5);
      expect(match.likelihood_score).toBeCloseTo(0.878, 3); // 0.51 + 0.368 = 0.878
      
      // Verify AI similarity score is included
      expect(match.ai_similarity_score).toBe(0.92);
      
      // Verify explainability metadata
      expect(match.explainability).toEqual({
        method: 'consolidated',
        formula: '0.6 × deterministic + 0.4 × AI_similarity',
        deterministic_score: 0.85,
        deterministic_weight: 0.6,
        ai_similarity_score: 0.92,
        ai_weight: 0.4,
        ai_model: 'all-MiniLM-L6-v2',
        embedding_dimension: 384,
        is_semantic_duplicate: true
      });
      
      // Verify reason codes include both deterministic and AI
      expect(match.reason_codes).toContain('Moderate first name similarity (85%)');
      expect(match.reason_codes).toContain('High last name similarity (100%)');
      expect(match.reason_codes).toContain('Date of birth exact match');
      expect(match.reason_codes).toContain('High semantic match detected (Cosine: 92%)');
      
      expect(match.status).toBe('pending_review');
    });
    
    test('should handle candidates below AI threshold (deterministic only)', async () => {
      const queryStudent = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-03-15'
      };
      
      const candidates = [
        {
          candidate_student_id: 'student-456',
          candidate_first_name: 'Jane',
          candidate_last_name: 'Smith',
          candidate_date_of_birth: '2005-03-15',
          deterministic_score: 0.60,
          first_name_similarity: 0.3,
          last_name_similarity: 0.2,
          dob_match: 1.0
        }
      ];
      
      // Mock AI service response with no matches (below threshold)
      const mockAiResponse = {
        matches: []
      };
      
      http.request.mockImplementation((options, callback) => {
        const mockRes = {
          statusCode: 200,
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(JSON.stringify(mockAiResponse));
            } else if (event === 'end') {
              handler();
            }
          })
        };
        
        callback(mockRes);
        
        return {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn()
        };
      });
      
      const result = await applyConsolidatedScoring(queryStudent, candidates);
      
      expect(result).toHaveLength(1);
      
      const match = result[0];
      
      // Should use deterministic score only
      expect(match.likelihood_score).toBe(0.60);
      expect(match.ai_similarity_score).toBeNull();
      
      // Verify explainability shows deterministic only
      expect(match.explainability).toEqual({
        method: 'deterministic_only',
        reason: 'Below AI semantic threshold (0.85)',
        deterministic_weight: 1.0,
        ai_weight: 0.0
      });
    });
    
    test('should fall back to deterministic when AI service is unavailable', async () => {
      const queryStudent = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-03-15'
      };
      
      const candidates = [
        {
          candidate_student_id: 'student-789',
          candidate_first_name: 'John',
          candidate_last_name: 'Doe',
          candidate_date_of_birth: '2005-03-15',
          deterministic_score: 0.95,
          first_name_similarity: 1.0,
          last_name_similarity: 1.0,
          dob_match: 1.0
        }
      ];
      
      // Mock AI service error
      http.request.mockImplementation(() => {
        return {
          on: jest.fn((event, handler) => {
            if (event === 'error') {
              handler(new Error('Connection refused'));
            }
          }),
          write: jest.fn(),
          end: jest.fn()
        };
      });
      
      const result = await applyConsolidatedScoring(queryStudent, candidates);
      
      expect(result).toHaveLength(1);
      
      const match = result[0];
      
      // Should fall back to deterministic score
      expect(match.likelihood_score).toBe(0.95);
      expect(match.ai_similarity_score).toBeNull();
      
      // Verify explainability shows error reason
      expect(match.explainability.method).toBe('deterministic_only');
      expect(match.explainability.reason).toContain('AI service error');
    });
    
    test('should handle multiple candidates with mixed AI results', async () => {
      const queryStudent = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-03-15'
      };
      
      const candidates = [
        {
          candidate_student_id: 'student-1',
          candidate_first_name: 'Jon',
          candidate_last_name: 'Doe',
          deterministic_score: 0.85,
          first_name_similarity: 0.85,
          last_name_similarity: 1.0,
          dob_match: 1.0
        },
        {
          candidate_student_id: 'student-2',
          candidate_first_name: 'Johnny',
          candidate_last_name: 'Doe',
          deterministic_score: 0.75,
          first_name_similarity: 0.70,
          last_name_similarity: 1.0,
          dob_match: 1.0
        },
        {
          candidate_student_id: 'student-3',
          candidate_first_name: 'Jane',
          candidate_last_name: 'Doe',
          deterministic_score: 0.60,
          first_name_similarity: 0.30,
          last_name_similarity: 1.0,
          dob_match: 1.0
        }
      ];
      
      // Mock AI service response - only first two above AI threshold
      const mockAiResponse = {
        matches: [
          {
            candidate_student: { student_id: 'student-1' },
            semantic_similarity: 0.92,
            is_semantic_duplicate: true,
            model_version: 'all-MiniLM-L6-v2',
            embedding_dimension: 384
          },
          {
            candidate_student: { student_id: 'student-2' },
            semantic_similarity: 0.88,
            is_semantic_duplicate: true,
            model_version: 'all-MiniLM-L6-v2',
            embedding_dimension: 384
          }
        ]
      };
      
      http.request.mockImplementation((options, callback) => {
        const mockRes = {
          statusCode: 200,
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(JSON.stringify(mockAiResponse));
            } else if (event === 'end') {
              handler();
            }
          })
        };
        
        callback(mockRes);
        
        return {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn()
        };
      });
      
      const result = await applyConsolidatedScoring(queryStudent, candidates);
      
      expect(result).toHaveLength(3);
      
      // First candidate: consolidated score
      expect(result[0].likelihood_score).toBeCloseTo((0.6 * 0.85) + (0.4 * 0.92), 5);
      expect(result[0].ai_similarity_score).toBe(0.92);
      expect(result[0].explainability.method).toBe('consolidated');
      
      // Second candidate: consolidated score
      expect(result[1].likelihood_score).toBeCloseTo((0.6 * 0.75) + (0.4 * 0.88), 5);
      expect(result[1].ai_similarity_score).toBe(0.88);
      expect(result[1].explainability.method).toBe('consolidated');
      
      // Third candidate: deterministic only (below AI threshold)
      expect(result[2].likelihood_score).toBe(0.60);
      expect(result[2].ai_similarity_score).toBeNull();
      expect(result[2].explainability.method).toBe('deterministic_only');
    });
    
    test('should handle edge case: identical names with phonetic variation', async () => {
      const queryStudent = {
        first_name: 'Robert',
        last_name: 'Smith',
        date_of_birth: '2000-01-01'
      };
      
      const candidates = [
        {
          candidate_student_id: 'student-bob',
          candidate_first_name: 'Bob',
          candidate_last_name: 'Smith',
          candidate_date_of_birth: '2000-01-01',
          deterministic_score: 0.65, // Lower due to name difference
          first_name_similarity: 0.40,
          last_name_similarity: 1.0,
          dob_match: 1.0
        }
      ];
      
      // AI should catch the phonetic match (Robert = Bob)
      const mockAiResponse = {
        matches: [
          {
            candidate_student: { student_id: 'student-bob' },
            semantic_similarity: 0.95, // High semantic similarity
            is_semantic_duplicate: true,
            model_version: 'all-MiniLM-L6-v2',
            embedding_dimension: 384
          }
        ]
      };
      
      http.request.mockImplementation((options, callback) => {
        const mockRes = {
          statusCode: 200,
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(JSON.stringify(mockAiResponse));
            } else if (event === 'end') {
              handler();
            }
          })
        };
        
        callback(mockRes);
        
        return {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn()
        };
      });
      
      const result = await applyConsolidatedScoring(queryStudent, candidates);
      
      expect(result).toHaveLength(1);
      
      const match = result[0];
      
      // Consolidated score should be higher due to AI boost
      const expectedScore = (0.6 * 0.65) + (0.4 * 0.95);
      expect(match.likelihood_score).toBeCloseTo(expectedScore, 5);
      expect(match.likelihood_score).toBeCloseTo(0.77, 2); // 0.39 + 0.38 = 0.77
      
      // This demonstrates AI's value: deterministic alone (0.65) wouldn't flag this,
      // but consolidated score (0.77) does flag it as potential duplicate
      expect(match.likelihood_score).toBeGreaterThan(0.75);
    });
  });
  
  describe('generateReasonCodes', () => {
    
    test('should generate reason codes for high similarity', () => {
      const scoreData = {
        firstNameSimilarity: 0.95,
        lastNameSimilarity: 0.92,
        dobMatch: 1.0
      };
      
      const aiData = {
        semantic_similarity: 0.90
      };
      
      const reasons = generateReasonCodes(scoreData, aiData);
      
      expect(reasons).toContain('High first name similarity (95%)');
      expect(reasons).toContain('High last name similarity (92%)');
      expect(reasons).toContain('Date of birth exact match');
      expect(reasons).toContain('High semantic match detected (Cosine: 90%)');
    });
    
    test('should generate reason codes for moderate similarity', () => {
      const scoreData = {
        firstNameSimilarity: 0.75,
        lastNameSimilarity: 0.80,
        dobMatch: 0.0
      };
      
      const reasons = generateReasonCodes(scoreData);
      
      expect(reasons).toContain('Moderate first name similarity (75%)');
      expect(reasons).toContain('Moderate last name similarity (80%)');
      expect(reasons).not.toContain('Date of birth exact match');
    });
    
    test('should include AI semantic match in reason codes', () => {
      const scoreData = {
        firstNameSimilarity: 0.60,
        lastNameSimilarity: 0.70,
        dobMatch: 0.0
      };
      
      const aiData = {
        semantic_similarity: 0.87
      };
      
      const reasons = generateReasonCodes(scoreData, aiData);
      
      expect(reasons).toContain('Semantic match detected (Cosine: 87%)');
    });
    
    test('should return default message for low similarity', () => {
      const scoreData = {
        firstNameSimilarity: 0.50,
        lastNameSimilarity: 0.60,
        dobMatch: 0.0
      };
      
      const reasons = generateReasonCodes(scoreData);
      
      expect(reasons).toEqual(['Potential match detected']);
    });
  });
  
  describe('API Response Format Compliance', () => {
    
    test('should match design spec Section 2.2.2 response format', async () => {
      const queryStudent = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-03-15'
      };
      
      const candidates = [
        {
          candidate_student_id: 'student-uuid-1',
          candidate_first_name: 'Jon',
          candidate_last_name: 'Doe',
          candidate_date_of_birth: '2005-03-15',
          deterministic_score: 0.82,
          first_name_similarity: 0.92,
          last_name_similarity: 1.0,
          dob_match: 1.0
        }
      ];
      
      const mockAiResponse = {
        matches: [
          {
            candidate_student: { student_id: 'student-uuid-1' },
            semantic_similarity: 0.95,
            is_semantic_duplicate: true,
            model_version: 'all-MiniLM-L6-v2',
            embedding_dimension: 384
          }
        ]
      };
      
      http.request.mockImplementation((options, callback) => {
        const mockRes = {
          statusCode: 200,
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(JSON.stringify(mockAiResponse));
            } else if (event === 'end') {
              handler();
            }
          })
        };
        
        callback(mockRes);
        
        return {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn()
        };
      });
      
      const result = await applyConsolidatedScoring(queryStudent, candidates);
      
      expect(result).toHaveLength(1);
      
      const match = result[0];
      
      // Verify all required fields from design spec
      expect(match).toHaveProperty('candidate_student_id');
      expect(match).toHaveProperty('likelihood_score');
      expect(match).toHaveProperty('deterministic_score');
      expect(match).toHaveProperty('ai_similarity_score');
      expect(match).toHaveProperty('reason_codes');
      expect(match).toHaveProperty('explainability');
      expect(match).toHaveProperty('status');
      
      // Verify types
      expect(typeof match.likelihood_score).toBe('number');
      expect(typeof match.deterministic_score).toBe('number');
      expect(typeof match.ai_similarity_score).toBe('number');
      expect(Array.isArray(match.reason_codes)).toBe(true);
      expect(typeof match.explainability).toBe('object');
      expect(match.status).toBe('pending_review');
      
      // Verify score calculation
      const expectedScore = (0.6 * 0.82) + (0.4 * 0.95);
      expect(match.likelihood_score).toBeCloseTo(expectedScore, 5);
    });
  });
});
