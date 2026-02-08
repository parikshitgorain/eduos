/**
 * Password strength levels
 */
export type PasswordStrength = 'weak' | 'medium' | 'strong';

/**
 * Password strength result
 */
export interface PasswordStrengthResult {
  strength: PasswordStrength;
  score: number; // 0-100
  feedback: string[];
}

/**
 * Calculate password strength based on various criteria
 * 
 * Scoring criteria:
 * - Length: 8+ chars (20 points), 12+ chars (30 points), 16+ chars (40 points)
 * - Uppercase letters: 10 points
 * - Lowercase letters: 10 points
 * - Numbers: 10 points
 * - Special characters: 15 points
 * - No repeated characters: 5 points
 * - No sequential characters: 10 points
 * 
 * @param password - The password to evaluate
 * @returns Password strength result with score and feedback
 */
export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return {
      strength: 'weak',
      score: 0,
      feedback: ['Password is required'],
    };
  }

  let score = 0;
  const feedback: string[] = [];

  // Length scoring
  if (password.length >= 16) {
    score += 40;
  } else if (password.length >= 12) {
    score += 30;
  } else if (password.length >= 8) {
    score += 20;
  } else {
    feedback.push('Use at least 8 characters');
  }

  // Character variety scoring
  if (/[A-Z]/.test(password)) {
    score += 10;
  } else {
    feedback.push('Add uppercase letters');
  }

  if (/[a-z]/.test(password)) {
    score += 10;
  } else {
    feedback.push('Add lowercase letters');
  }

  if (/\d/.test(password)) {
    score += 10;
  } else {
    feedback.push('Add numbers');
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score += 15;
  } else {
    feedback.push('Add special characters (!@#$%^&*)');
  }

  // Check for repeated characters (e.g., "aaa", "111")
  if (!/(.)\1{2,}/.test(password)) {
    score += 5;
  } else {
    feedback.push('Avoid repeated characters');
  }

  // Check for sequential characters (e.g., "abc", "123")
  const hasSequential = /abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789/i.test(password);
  if (!hasSequential) {
    score += 10;
  } else {
    feedback.push('Avoid sequential characters');
  }

  // Determine strength level
  let strength: PasswordStrength;
  if (score >= 80) {
    strength = 'strong';
  } else if (score >= 50) {
    strength = 'medium';
  } else {
    strength = 'weak';
  }

  return {
    strength,
    score,
    feedback: feedback.length > 0 ? feedback : ['Password looks good!'],
  };
}

/**
 * Get a simple strength rating (weak/medium/strong) for a password
 * 
 * @param password - The password to evaluate
 * @returns Password strength level
 */
export function getPasswordStrength(password: string): PasswordStrength {
  return calculatePasswordStrength(password).strength;
}
