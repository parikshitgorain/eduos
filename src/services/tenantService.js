/**
 * Tenant Service
 * 
 * Handles tenant provisioning, configuration, and resource quota management.
 * 
 * Task: 1.1.3 - Create tenant provisioning API
 */

const { transaction } = require('../config/database');

/**
 * Tier-based resource quotas
 */
const TIER_QUOTAS = {
  Basic: {
    max_students: 500,
    max_storage_gb: 10,
    max_api_calls_per_day: 10000,
    max_concurrent_users: 50,
    backup_retention_days: 30,
    support_level: 'email'
  },
  Business: {
    max_students: 5000,
    max_storage_gb: 100,
    max_api_calls_per_day: 100000,
    max_concurrent_users: 500,
    backup_retention_days: 90,
    support_level: 'priority'
  },
  Enterprise: {
    max_students: -1, // unlimited
    max_storage_gb: -1, // unlimited
    max_api_calls_per_day: -1, // unlimited
    max_concurrent_users: -1, // unlimited
    backup_retention_days: 365,
    support_level: '24/7'
  }
};

/**
 * Validate tenant creation input
 * @param {Object} data - Tenant data
 * @returns {Object} - Validation result
 */
function validateTenantInput(data) {
  const errors = [];
  
  // Validate name
  if (!data.name || typeof data.name !== 'string') {
    errors.push('name is required and must be a string');
  } else if (data.name.length < 2 || data.name.length > 255) {
    errors.push('name must be between 2 and 255 characters');
  }
  
  // Validate subdomain
  if (!data.subdomain || typeof data.subdomain !== 'string') {
    errors.push('subdomain is required and must be a string');
  } else {
    // Subdomain validation: lowercase alphanumeric and hyphens only
    const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
    if (!subdomainRegex.test(data.subdomain)) {
      errors.push('subdomain must be lowercase alphanumeric with hyphens, 2-63 characters');
    }
    
    // Reserved subdomains
    const reserved = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'localhost', 'staging', 'dev', 'test'];
    if (reserved.includes(data.subdomain)) {
      errors.push(`subdomain '${data.subdomain}' is reserved`);
    }
  }
  
  // Validate tier
  if (!data.tier || typeof data.tier !== 'string') {
    errors.push('tier is required and must be a string');
  } else if (!['Basic', 'Business', 'Enterprise'].includes(data.tier)) {
    errors.push('tier must be one of: Basic, Business, Enterprise');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a new tenant with automatic schema initialization
 * @param {Object} tenantData - Tenant creation data
 * @returns {Promise<Object>} - Created tenant with quotas
 */
async function createTenant(tenantData) {
  // Validate input
  const validation = validateTenantInput(tenantData);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }
  
  const { name, subdomain, tier, metadata = {} } = tenantData;
  
  // Execute tenant creation in a transaction
  const result = await transaction(async (client) => {
    // Step 1: Create tenant record
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, subdomain, tier, status, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING tenant_id, name, subdomain, tier, status, created_at, updated_at, metadata`,
      [name, subdomain, tier, 'active', JSON.stringify(metadata)]
    );
    
    const tenant = tenantResult.rows[0];
    
    // Step 2: Get resource quotas for the tier
    const quotas = TIER_QUOTAS[tier];
    
    // Step 3: Create resource quotas record
    await client.query(
      `INSERT INTO tenant_quotas (
        tenant_id, 
        max_students, 
        max_storage_gb, 
        max_api_calls_per_day, 
        max_concurrent_users,
        backup_retention_days,
        support_level,
        current_students,
        current_storage_gb,
        current_api_calls_today
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, 0)`,
      [
        tenant.tenant_id,
        quotas.max_students,
        quotas.max_storage_gb,
        quotas.max_api_calls_per_day,
        quotas.max_concurrent_users,
        quotas.backup_retention_days,
        quotas.support_level
      ]
    );
    
    // Step 4: Initialize tenant-specific schema (if needed)
    // For now, we're using RLS with shared tables
    // In the future, this could create tenant-specific schemas for Enterprise tier
    
    // Step 5: Create audit log entry
    await client.query(
      `INSERT INTO audit_logs (
        tenant_id,
        event_type,
        event_action,
        resource_type,
        resource_id,
        actor_type,
        details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        tenant.tenant_id,
        'tenant',
        'created',
        'tenant',
        tenant.tenant_id,
        'system',
        JSON.stringify({
          name: tenant.name,
          subdomain: tenant.subdomain,
          tier: tenant.tier
        })
      ]
    );
    
    return {
      tenant,
      quotas
    };
  });
  
  return result;
}

/**
 * Get tenant by ID
 * @param {string} tenantId - Tenant UUID
 * @returns {Promise<Object>} - Tenant with quotas
 */
async function getTenantById(tenantId, client) {
  const tenantResult = await client.query(
    `SELECT t.*, tq.max_students, tq.max_storage_gb, tq.max_api_calls_per_day,
            tq.max_concurrent_users, tq.backup_retention_days, tq.support_level,
            tq.current_students, tq.current_storage_gb, tq.current_api_calls_today
     FROM tenants t
     LEFT JOIN tenant_quotas tq ON t.tenant_id = tq.tenant_id
     WHERE t.tenant_id = $1`,
    [tenantId]
  );
  
  if (tenantResult.rowCount === 0) {
    return null;
  }
  
  return tenantResult.rows[0];
}

/**
 * Get tenant by subdomain
 * @param {string} subdomain - Tenant subdomain
 * @returns {Promise<Object>} - Tenant with quotas
 */
async function getTenantBySubdomain(subdomain, client) {
  const tenantResult = await client.query(
    `SELECT t.*, tq.max_students, tq.max_storage_gb, tq.max_api_calls_per_day,
            tq.max_concurrent_users, tq.backup_retention_days, tq.support_level,
            tq.current_students, tq.current_storage_gb, tq.current_api_calls_today
     FROM tenants t
     LEFT JOIN tenant_quotas tq ON t.tenant_id = tq.tenant_id
     WHERE t.subdomain = $1`,
    [subdomain]
  );
  
  if (tenantResult.rowCount === 0) {
    return null;
  }
  
  return tenantResult.rows[0];
}

/**
 * List all tenants with pagination
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Paginated tenant list
 */
async function listTenants(options = {}, client) {
  const { page = 1, limit = 20, status = null, tier = null } = options;
  const offset = (page - 1) * limit;
  
  let whereClause = [];
  let params = [];
  let paramIndex = 1;
  
  if (status) {
    whereClause.push(`t.status = $${paramIndex++}`);
    params.push(status);
  }
  
  if (tier) {
    whereClause.push(`t.tier = $${paramIndex++}`);
    params.push(tier);
  }
  
  const whereSQL = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';
  
  // Get total count
  const countResult = await client.query(
    `SELECT COUNT(*) as total FROM tenants t ${whereSQL}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);
  
  // Get paginated results
  params.push(limit, offset);
  const tenantsResult = await client.query(
    `SELECT t.*, tq.max_students, tq.current_students, tq.support_level
     FROM tenants t
     LEFT JOIN tenant_quotas tq ON t.tenant_id = tq.tenant_id
     ${whereSQL}
     ORDER BY t.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    params
  );
  
  return {
    tenants: tenantsResult.rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Update tenant
 * @param {string} tenantId - Tenant UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Updated tenant
 */
async function updateTenant(tenantId, updates) {
  const allowedFields = ['name', 'tier', 'status', 'metadata'];
  const updateFields = [];
  const params = [tenantId];
  let paramIndex = 2;
  
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      updateFields.push(`${key} = $${paramIndex++}`);
      params.push(key === 'metadata' ? JSON.stringify(value) : value);
    }
  }
  
  if (updateFields.length === 0) {
    throw new Error('No valid fields to update');
  }
  
  const result = await transaction(async (client) => {
    const tenantResult = await client.query(
      `UPDATE tenants
       SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE tenant_id = $1
       RETURNING *`,
      params
    );
    
    if (tenantResult.rowCount === 0) {
      throw new Error('Tenant not found');
    }
    
    // If tier changed, update quotas
    if (updates.tier) {
      const quotas = TIER_QUOTAS[updates.tier];
      await client.query(
        `UPDATE tenant_quotas
         SET max_students = $2,
             max_storage_gb = $3,
             max_api_calls_per_day = $4,
             max_concurrent_users = $5,
             backup_retention_days = $6,
             support_level = $7
         WHERE tenant_id = $1`,
        [
          tenantId,
          quotas.max_students,
          quotas.max_storage_gb,
          quotas.max_api_calls_per_day,
          quotas.max_concurrent_users,
          quotas.backup_retention_days,
          quotas.support_level
        ]
      );
    }
    
    return tenantResult.rows[0];
  });
  
  return result;
}

module.exports = {
  createTenant,
  getTenantById,
  getTenantBySubdomain,
  listTenants,
  updateTenant,
  validateTenantInput,
  TIER_QUOTAS
};
