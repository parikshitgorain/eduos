/**
 * JWT Token Generator Utility
 * 
 * Helper script to generate JWT tokens for testing and development
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Generate a JWT token with tenant context
 * @param {Object} payload - Token payload
 * @param {string} payload.tenant_id - Tenant UUID
 * @param {string} payload.user_id - User UUID
 * @param {Array<string>} payload.roles - User roles
 * @param {Array<string>} payload.permissions - User permissions
 * @param {string} expiresIn - Token expiration (default: 1h)
 * @returns {string} JWT token
 */
function generateToken(payload, expiresIn = '1h') {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Generate a token for Tenant A (for testing)
 */
function generateTenantAToken() {
  return generateToken({
    tenant_id: '11111111-1111-1111-1111-111111111111',
    user_id: '22222222-2222-2222-2222-222222222222',
    roles: ['admin'],
    permissions: ['read:students', 'write:students', 'read:attendance', 'write:attendance']
  });
}

/**
 * Generate a token for Tenant B (for testing)
 */
function generateTenantBToken() {
  return generateToken({
    tenant_id: '33333333-3333-3333-3333-333333333333',
    user_id: '44444444-4444-4444-4444-444444444444',
    roles: ['teacher'],
    permissions: ['read:students', 'write:attendance']
  });
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('JWT Token Generator\n');
    console.log('Usage:');
    console.log('  node src/utils/generateToken.js tenant-a    # Generate token for Tenant A');
    console.log('  node src/utils/generateToken.js tenant-b    # Generate token for Tenant B');
    console.log('  node src/utils/generateToken.js custom <tenant_id> <user_id>  # Custom token\n');
    
    console.log('Example Tokens:\n');
    console.log('Tenant A Token:');
    console.log(generateTenantAToken());
    console.log('\nTenant B Token:');
    console.log(generateTenantBToken());
    
    process.exit(0);
  }
  
  const command = args[0];
  
  switch (command) {
    case 'tenant-a':
      console.log(generateTenantAToken());
      break;
      
    case 'tenant-b':
      console.log(generateTenantBToken());
      break;
      
    case 'custom':
      if (args.length < 3) {
        console.error('Error: Missing tenant_id and user_id');
        console.log('Usage: node src/utils/generateToken.js custom <tenant_id> <user_id>');
        process.exit(1);
      }
      
      const token = generateToken({
        tenant_id: args[1],
        user_id: args[2],
        roles: args[3] ? args[3].split(',') : ['user'],
        permissions: args[4] ? args[4].split(',') : []
      });
      
      console.log(token);
      break;
      
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

module.exports = {
  generateToken,
  generateTenantAToken,
  generateTenantBToken
};
