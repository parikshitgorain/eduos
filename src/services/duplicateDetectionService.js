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
 * @returns {Promise<Array>} Array of candidate duplicate pairs with scores
 */
async function checkDuplicates(studentData) {
  const pool = getPool();
  const { first_name, last_name, date_of_birth, tenant_id, student_id } = studentData;
  
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
  
  // Calculate scores for all existing students
  const candidates = [];
  const threshold = 0.75;
  
  for (const existing of existingStudents) {
    const scoreData = calculateDeterministicScore(
      { first_name, last_name, date_of_birth },
      existing
    );
    
    if (scoreData.score >= threshold) {
      candidates.push({
        candidate_student_id: existing.student_id,
        candidate_first_name: existing.first_name,
        candidate_last_name: existing.last_name,
        candidate_date_of_birth: existing.date_of_birth,
        candidate_email: existing.email,
        candidate_phone: existing.phone,
        candidate_created_at: existing.created_at,
        likelihood_score: scoreData.score,
        deterministic_score: scoreData.score,
        first_name_similarity: scoreData.firstNameSimilarity,
        last_name_similarity: scoreData.lastNameSimilarity,
        dob_match: scoreData.dobMatch,
        reason_codes: generateReasonCodes(scoreData),
        status: 'pending_review'
      });
    }
  }
  
  // Sort by likelihood score (highest first)
  candidates.sort((a, b) => b.likelihood_score - a.likelihood_score);
  
  return candidates;
}

/**
 * Generate human-readable reason codes for duplicate detection
 */
function generateReasonCodes(scoreData) {
  const reasons = [];
  
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
  
  if (reasons.length === 0) {
    reasons.push('Potential match detected');
  }
  
  return reasons;
}

/**
 * Batch check duplicates for multiple students (for bulk imports)
 * 
 * @param {Array} students - Array of student data objects
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Array>} Array of results with duplicates for each student
 */
async function batchCheckDuplicates(students, tenantId) {
  const results = [];
  
  for (const student of students) {
    const duplicates = await checkDuplicates({
      ...student,
      tenant_id: tenantId
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
  generateReasonCodes
};
