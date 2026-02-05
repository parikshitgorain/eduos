/**
 * Input Validation Middleware
 * 
 * Validates and sanitizes user input to prevent injection attacks
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware to check validation results
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

/**
 * UUID validation rules
 */
const uuidValidation = (field, location = 'param') => {
  const validator = location === 'param' ? param(field) : 
                    location === 'body' ? body(field) : 
                    query(field);
  
  return validator
    .isUUID(4)
    .withMessage(`${field} must be a valid UUID v4`);
};

/**
 * Email validation rules
 */
const emailValidation = (field = 'email') => {
  return body(field)
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address');
};

/**
 * Domain validation rules
 */
const domainValidation = (field = 'domain') => {
  return body(field)
    .matches(/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i)
    .withMessage('Must be a valid domain name')
    .isLength({ max: 253 })
    .withMessage('Domain name too long');
};

/**
 * Subdomain validation rules
 */
const subdomainValidation = (field = 'subdomain') => {
  return body(field)
    .matches(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i)
    .withMessage('Subdomain must contain only alphanumeric characters and hyphens')
    .isLength({ min: 3, max: 63 })
    .withMessage('Subdomain must be between 3 and 63 characters');
};

/**
 * String sanitization
 */
const sanitizeString = (field, options = {}) => {
  const { minLength = 1, maxLength = 255, allowEmpty = false } = options;
  
  let validator = body(field)
    .trim()
    .escape();
  
  if (!allowEmpty) {
    validator = validator.notEmpty().withMessage(`${field} is required`);
  }
  
  return validator
    .isLength({ min: minLength, max: maxLength })
    .withMessage(`${field} must be between ${minLength} and ${maxLength} characters`);
};

/**
 * Integer validation
 */
const integerValidation = (field, options = {}) => {
  const { min, max } = options;
  
  let validator = body(field)
    .isInt({ min, max })
    .withMessage(`${field} must be an integer${min !== undefined ? ` >= ${min}` : ''}${max !== undefined ? ` <= ${max}` : ''}`);
  
  return validator.toInt();
};

/**
 * Boolean validation
 */
const booleanValidation = (field) => {
  return body(field)
    .isBoolean()
    .withMessage(`${field} must be a boolean`)
    .toBoolean();
};

/**
 * Date validation
 */
const dateValidation = (field) => {
  return body(field)
    .isISO8601()
    .withMessage(`${field} must be a valid ISO 8601 date`)
    .toDate();
};

/**
 * Array validation
 */
const arrayValidation = (field, options = {}) => {
  const { minLength = 0, maxLength = 100 } = options;
  
  return body(field)
    .isArray({ min: minLength, max: maxLength })
    .withMessage(`${field} must be an array with ${minLength}-${maxLength} items`);
};

/**
 * JSON validation
 */
const jsonValidation = (field) => {
  return body(field)
    .custom((value) => {
      try {
        if (typeof value === 'string') {
          JSON.parse(value);
        } else if (typeof value === 'object') {
          return true;
        } else {
          throw new Error('Invalid JSON');
        }
        return true;
      } catch (e) {
        throw new Error(`${field} must be valid JSON`);
      }
    });
};

/**
 * Phone number validation
 */
const phoneValidation = (field = 'phone') => {
  return body(field)
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Must be a valid phone number in E.164 format');
};

/**
 * URL validation
 */
const urlValidation = (field = 'url') => {
  return body(field)
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Must be a valid URL');
};

/**
 * Prevent SQL injection in search queries
 */
const searchQueryValidation = (field = 'q') => {
  return query(field)
    .trim()
    .escape()
    .isLength({ max: 100 })
    .withMessage('Search query too long')
    .matches(/^[a-zA-Z0-9\s\-_]*$/)
    .withMessage('Search query contains invalid characters');
};

module.exports = {
  validate,
  uuidValidation,
  emailValidation,
  domainValidation,
  subdomainValidation,
  sanitizeString,
  integerValidation,
  booleanValidation,
  dateValidation,
  arrayValidation,
  jsonValidation,
  phoneValidation,
  urlValidation,
  searchQueryValidation
};
