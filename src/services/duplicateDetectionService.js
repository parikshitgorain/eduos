/**
 * Duplicate Detection Service
 * Task 3.2.1: Build deterministic fuzzy matching layer
 * 
 * Implements Levenshtein distance-based fuzzy matching for student duplicate detection.
 * Scoring formula: 0.4×first_name + 0.4×last_name + 0.2×DOB_match
 * Threshold: scores > 0.75 flagged as potential duplicates
 */

const { getPool } = require('../config/database');

/**
 * Calculate Levenshtein distance between two strings
 * Returns a similarity score between 0 and 1 (1 = identical)
 */
function levenshteinSimilarity(str1, str2) {
  // Handle null/undefined
  if (str1 === null || str1 === undefined || str2 === null || str2 === undefined) return 0;
  
  // Normalize strings: lowercase and trim
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  
  const len1 = s1.length;
  const len2 = s2.length;
  
  // Handle empty strings - both empty means identical
  if (len1 === 0 && len2 === 0) return 1.0;
  if (len1 === 0 || len2 === 0) return 0;
  
  // Create distance matrix
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
  
  // Initialize first column and row
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  // Calculate distances
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  
  // Convert distance to similarity score (0-1)
  return 1 - (distance / maxLen);
}

/**
 * Calculate deterministic duplicate score for two student records
 * Formula: 0.4×first_name + 0.4×last_name + 0.2×DOB_match
 */
function calculateDeterministicScore(student1, student2) {
  const firstNameSimilarity = levenshteinSimilarity(
    student1.first_name,
    student2.first_name
  );
  
  const lastNameSimilarity = levenshteinSimilarity(
    student1.last_name,
    student2.last_name
  );
  
  // Date of birth exact match (1.0 if match, 0.0 if not)
  const dobMatch = student1.date_of_birth && student2.date_of_birth &&
    student1.date_of_birth === student2.date_of_birth ? 1.0 : 0.0;
  
  const score = (
    0.4 * firstNameSimilarity +
    0.4 * lastNameSimilarity +
    0.2 * dobMatch
  );
  
  return {
    score,
    firstNameSimilarity,
    lastNameSimilarity,
    dobMatch
  };
}

/**
 * Check for duplicate students in the database
 * POST /api/v1/students/check-duplicates
 * 
 * @param {Object} studentData - Student data to check
 * @param {string} studentData.first_name - First name
 * @param {string} studentData.last_name - Last name
 * @param {string} studentData.date_of_birth - Date of birth (YYYY-MM-DD)
 * @param {string} studentData.tenant_id - Tenant ID
 * @param {string} [studentData.student_id] - Optional student ID to exclude from search
 * @param {string} [studentData.email] - Optional email
 * @param {string} [studentData.phone] - Optional phone
 * @param {boolean} [studentData.use_ai] - Whether to use AI semantic matching (default: true)
 * @returns {Promise<Array>} Array of candidate duplicate pairs with scores
 */
async function checkDuplicates(studentData) {
  const pool = getPool();
  const { first_name, last_name, date_of_birth, tenant_id, student_id, email, phone, use_ai = true } = studentData;
  
  if (!first_name || !last_name || !tenant_id) {
    throw new Error('Missing required fields: first_name, last_name, tenant_id');
  }
  
  // Query all active students in the same tenant
  // Exclude the current student if student_id is provided (for updates)
  let query = `
    SELECT 
      student_id,
      first_name,
      last_name,
      date_of_birth,
      email,
      phone,
      created_at
    FROM students
    WHERE tenant_id = $1
      AND status = 'active'
  `;
  
  const params = [tenant_id];
  
  if (student_id) {
    query += ` AND student_id != $2`;
    params.push(student_id);
  }
  
  const result = await pool.query(query, params);
  const existingStudents = result.rows;
  
  // Calculate deterministic scores for all existing students
  const candidates = [];
  const deterministicThreshold = 0.5; // Lower threshold for deterministic to allow AI to enhance
  
  for (const existing of existingStudents) {
    const scoreData = calculateDeterministicScore(
      { first_name, last_name, date_of_birth },
      existing
    );
    
    // Only consider candidates with deterministic score > 0.5
    if (scoreData.score >= deterministicThreshold) {
      candidates.push({
        candidate_student_id: existing.student_id,
        candidate_first_name: existing.first_name,
        candidate_last_name: existing.last_name,
        candidate_date_of_birth: existing.date_of_birth,
        candidate_email: existing.email,
        candidate_phone: existing.phone,
        candidate_created_at: existing.created_at,
        deterministic_score: scoreData.score,
        first_name_similarity: scoreData.firstNameSimilarity,
        last_name_similarity: scoreData.lastNameSimilarity,
        dob_match: scoreData.dobMatch
      });
    }
  }
  
  // If no candidates or AI disabled, return deterministic-only results
  if (candidates.length === 0 || !use_ai) {
    return candidates
      .filter(c => c.deterministic_score >= 0.75)
      .map(c => ({
        ...c,
        likelihood_score: c.deterministic_score,
        ai_similarity_score: null,
        reason_codes: generateReasonCodes({
          score: c.deterministic_score,
          firstNameSimilarity: c.first_name_similarity,
          lastNameSimilarity: c.last_name_similarity,
          dobMatch: c.dob_match
        }),
        explainability: {
          method: 'deterministic_only',
          ai_enabled: false
        },
        status: 'pending_review'
      }))
      .sort((a, b) => b.likelihood_score - a.likelihood_score);
  }
  
  // Task 3.2.3: Apply consolidated scoring with AI semantic matching
  const consolidatedResults = await applyConsolidatedScoring(
    { first_name, last_name, date_of_birth, email, phone },
    candidates
  );
  
  // Filter by final threshold (0.75) and sort
  return consolidatedResults
    .filter(c => c.likelihood_score >= 0.75)
    .sort((a, b) => b.likelihood_score - a.likelihood_score);
}

/**
 * Generate human-readable reason codes for duplicate detection
 */
function generateReasonCodes(scoreData, aiData = null) {
  const reasons = [];
  
  // Deterministic reasons
  if (scoreData.firstNameSimilarity >= 0.9) {
    reasons.push(`High first name similarity (${(scoreData.firstNameSimilarity * 100).toFixed(0)}%)`);
  } else if (scoreData.firstNameSimilarity >= 0.7) {
    reasons.push(`Moderate first name similarity (${(scoreData.firstNameSimilarity * 100).toFixed(0)}%)`);
  }
  
  if (scoreData.lastNameSimilarity >= 0.9) {
    reasons.push(`High last name similarity (${(scoreData.lastNameSimilarity * 100).toFixed(0)}%)`);
  } else if (scoreData.lastNameSimilarity >= 0.7) {
    reasons.push(`Moderate last name similarity (${(scoreData.lastNameSimilarity * 100).toFixed(0)}%)`);
  }
  
  if (scoreData.dobMatch === 1.0) {
    reasons.push('Date of birth exact match');
  }
  
  // AI semantic reasons
  if (aiData && aiData.semantic_similarity) {
    if (aiData.semantic_similarity >= 0.9) {
      reasons.push(`High semantic match detected (Cosine: ${(aiData.semantic_similarity * 100).toFixed(0)}%)`);
    } else if (aiData.semantic_similarity >= 0.85) {
      reasons.push(`Semantic match detected (Cosine: ${(aiData.semantic_similarity * 100).toFixed(0)}%)`);
    }
  }
  
  if (reasons.length === 0) {
    reasons.push('Potential match detected');
  }
  
  return reasons;
}

/**
 * Task 3.2.3: Apply consolidated scoring combining deterministic + AI semantic matching
 * Formula: likelihood_score = 0.6 × deterministic_score + 0.4 × ai_similarity_score
 * 
 * @param {Object} queryStudent - Student data to check
 * @param {Array} candidates - Array of candidate matches with deterministic scores
 * @returns {Promise<Array>} Candidates with consolidated scores
 */
async function applyConsolidatedScoring(queryStudent, candidates) {
  if (candidates.length === 0) {
    return [];
  }
  
  try {
    // Check if AI service is available
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    
    // Prepare request for AI service
    const candidateStudents = candidates.map(c => ({
      student_id: c.candidate_student_id,
      first_name: c.candidate_first_name,
      last_name: c.candidate_last_name,
      date_of_birth: c.candidate_date_of_birth,
      email: c.candidate_email,
      phone: c.candidate_phone
    }));
    
    const requestBody = {
      query_student: {
        first_name: queryStudent.first_name,
        last_name: queryStudent.last_name,
        date_of_birth: queryStudent.date_of_birth,
        email: queryStudent.email,
        phone: queryStudent.phone
      },
      candidate_students: candidateStudents,
      threshold: 0.85 // AI threshold for semantic duplicates
    };
    
    // Call AI service for semantic matching using http module
    const http = require('http');
    const url = require('url');
    
    const aiUrl = new url.URL(`${aiServiceUrl}/api/v1/semantic/find-duplicates`);
    const postData = JSON.stringify(requestBody);
    
    const options = {
      hostname: aiUrl.hostname,
      port: aiUrl.port || 8000,
      path: aiUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 5000 // 5 second timeout
    };
    
    const aiResponse = await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`Invalid JSON response: ${e.message}`));
            }
          } else {
            reject(new Error(`AI service returned status ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('AI service request timeout'));
      });
      
      req.write(postData);
      req.end();
    });
    
    // Create a map of AI scores by student_id
    const aiScoreMap = new Map();
    for (const match of aiResponse.matches || []) {
      aiScoreMap.set(
        match.candidate_student.student_id,
        {
          semantic_similarity: match.semantic_similarity,
          is_semantic_duplicate: match.is_semantic_duplicate,
          model_version: match.model_version,
          embedding_dimension: match.embedding_dimension
        }
      );
    }
    
    // Apply consolidated scoring formula: 0.6 × deterministic + 0.4 × AI
    const consolidatedResults = candidates.map(candidate => {
      const aiScore = aiScoreMap.get(candidate.candidate_student_id);
      
      let likelihood_score;
      let ai_similarity_score = null;
      let explainability;
      
      if (aiScore) {
        // Consolidated score with AI
        likelihood_score = (0.6 * candidate.deterministic_score) + (0.4 * aiScore.semantic_similarity);
        ai_similarity_score = aiScore.semantic_similarity;
        
        explainability = {
          method: 'consolidated',
          formula: '0.6 × deterministic + 0.4 × AI_similarity',
          deterministic_score: candidate.deterministic_score,
          deterministic_weight: 0.6,
          ai_similarity_score: aiScore.semantic_similarity,
          ai_weight: 0.4,
          ai_model: aiScore.model_version,
          embedding_dimension: aiScore.embedding_dimension,
          is_semantic_duplicate: aiScore.is_semantic_duplicate
        };
      } else {
        // No AI score available for this candidate (below AI threshold)
        likelihood_score = candidate.deterministic_score;
        
        explainability = {
          method: 'deterministic_only',
          reason: 'Below AI semantic threshold (0.85)',
          deterministic_weight: 1.0,
          ai_weight: 0.0
        };
      }
      
      return {
        ...candidate,
        likelihood_score,
        ai_similarity_score,
        reason_codes: generateReasonCodes(
          {
            score: candidate.deterministic_score,
            firstNameSimilarity: candidate.first_name_similarity,
            lastNameSimilarity: candidate.last_name_similarity,
            dobMatch: candidate.dob_match
          },
          aiScore
        ),
        explainability,
        status: 'pending_review'
      };
    });
    
    return consolidatedResults;
    
  } catch (error) {
    // AI service error - fall back to deterministic only
    console.error('Error calling AI service:', error.message);
    
    return candidates.map(c => ({
      ...c,
      likelihood_score: c.deterministic_score,
      ai_similarity_score: null,
      reason_codes: generateReasonCodes({
        score: c.deterministic_score,
        firstNameSimilarity: c.first_name_similarity,
        lastNameSimilarity: c.last_name_similarity,
        dobMatch: c.dob_match
      }),
      explainability: {
        method: 'deterministic_only',
        reason: `AI service error: ${error.message}`,
        deterministic_weight: 1.0,
        ai_weight: 0.0
      },
      status: 'pending_review'
    }));
  }
}

/**
 * Batch check duplicates for multiple students (for bulk imports)
 * 
 * @param {Array} students - Array of student data objects
 * @param {string} tenantId - Tenant ID
 * @param {boolean} [useAi] - Whether to use AI semantic matching
 * @returns {Promise<Array>} Array of results with duplicates for each student
 */
async function batchCheckDuplicates(students, tenantId, useAi = true) {
  const results = [];
  
  for (const student of students) {
    const duplicates = await checkDuplicates({
      ...student,
      tenant_id: tenantId,
      use_ai: useAi
    });
    
    results.push({
      input_student: student,
      duplicates,
      has_duplicates: duplicates.length > 0
    });
  }
  
  return results;
}

module.exports = {
  levenshteinSimilarity,
  calculateDeterministicScore,
  checkDuplicates,
  batchCheckDuplicates,
  generateReasonCodes,
  applyConsolidatedScoring
};
