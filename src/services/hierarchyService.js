/**
 * Hierarchy Service
 * 
 * Business logic for managing Institute → Center → Program → Batch hierarchy.
 * 
 * Task: 2.1.1 - Implement Institute → Center → Program → Batch entity tree
 */

const { query, transaction } = require('../config/database');

/**
 * Validation helper to check if entity exists
 */
async function entityExists(entityType, entityId, tenantId, client = null) {
  const tables = {
    institute: 'institutes',
    center: 'centers',
    program: 'programs',
    batch: 'batches'
  };
  
  const table = tables[entityType];
  if (!table) {
    throw new Error(`Invalid entity type: ${entityType}`);
  }
  
  const idColumn = `${entityType}_id`;
  const sql = `SELECT ${idColumn} FROM ${table} WHERE ${idColumn} = $1 AND tenant_id = $2`;
  
  const executor = client || { query };
  const result = await executor.query(sql, [entityId, tenantId]);
  return result.rows.length > 0;
}

/**
 * Check if entity has children (for cascade delete protection)
 */
async function hasChildren(entityType, entityId, client = null) {
  const executor = client || { query };
  const result = await executor.query(
    'SELECT count_hierarchy_children($1, $2) as count',
    [entityType, entityId]
  );
  return result.rows[0].count > 0;
}

// ============================================================================
// INSTITUTE OPERATIONS
// ============================================================================

/**
 * Create a new institute
 */
async function createInstitute({ tenantId, name, code, metadata = {} }) {
  // Validation
  if (!name || name.trim().length === 0) {
    throw new Error('Validation failed: Institute name is required');
  }
  
  const sql = `
    INSERT INTO institutes (tenant_id, name, code, metadata)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  
  const result = await query(sql, [tenantId, name.trim(), code, metadata]);
  return result.rows[0];
}

/**
 * Get institute by ID
 */
async function getInstituteById(instituteId, tenantId, client = null) {
  const executor = client || { query };
  const sql = `
    SELECT * FROM institutes
    WHERE institute_id = $1 AND tenant_id = $2
  `;
  
  const result = await executor.query(sql, [instituteId, tenantId]);
  return result.rows[0] || null;
}

/**
 * List institutes for a tenant
 */
async function listInstitutes(tenantId, options = {}, client = null) {
  const { page = 1, limit = 20, status } = options;
  const offset = (page - 1) * limit;
  
  let sql = `
    SELECT * FROM institutes
    WHERE tenant_id = $1
  `;
  const params = [tenantId];
  
  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }
  
  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);
  
  const executor = client || { query };
  const result = await executor.query(sql, params);
  
  // Get total count
  const countSql = `SELECT COUNT(*) FROM institutes WHERE tenant_id = $1` + (status ? ` AND status = $2` : '');
  const countParams = status ? [tenantId, status] : [tenantId];
  const countResult = await executor.query(countSql, countParams);
  const total = parseInt(countResult.rows[0].count, 10);
  
  return {
    institutes: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Update institute
 */
async function updateInstitute(instituteId, tenantId, updates) {
  const allowedFields = ['name', 'code', 'status', 'metadata'];
  const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
  
  if (fields.length === 0) {
    throw new Error('No valid fields to update');
  }
  
  const setClause = fields.map((field, index) => `${field} = $${index + 3}`).join(', ');
  const values = fields.map(field => updates[field]);
  
  const sql = `
    UPDATE institutes
    SET ${setClause}
    WHERE institute_id = $1 AND tenant_id = $2
    RETURNING *
  `;
  
  const result = await query(sql, [instituteId, tenantId, ...values]);
  
  if (result.rows.length === 0) {
    throw new Error('Institute not found');
  }
  
  return result.rows[0];
}

/**
 * Delete institute (with cascade protection)
 */
async function deleteInstitute(instituteId, tenantId) {
  return transaction(async (client) => {
    // Check if institute exists
    const exists = await entityExists('institute', instituteId, tenantId, client);
    if (!exists) {
      throw new Error('Institute not found');
    }
    
    // Check for children
    const children = await hasChildren('institute', instituteId, client);
    if (children) {
      throw new Error('Cannot delete institute with existing centers. Delete or reassign centers first.');
    }
    
    const sql = `
      DELETE FROM institutes
      WHERE institute_id = $1 AND tenant_id = $2
      RETURNING *
    `;
    
    const result = await client.query(sql, [instituteId, tenantId]);
    return result.rows[0];
  });
}

// ============================================================================
// CENTER OPERATIONS
// ============================================================================

/**
 * Create a new center
 */
async function createCenter({ tenantId, instituteId, name, code, metadata = {} }) {
  // Validation
  if (!name || name.trim().length === 0) {
    throw new Error('Validation failed: Center name is required');
  }
  
  if (!instituteId) {
    throw new Error('Validation failed: Institute ID is required');
  }
  
  // Verify institute exists
  const instituteExists = await entityExists('institute', instituteId, tenantId);
  if (!instituteExists) {
    throw new Error('Institute not found');
  }
  
  const sql = `
    INSERT INTO centers (tenant_id, institute_id, name, code, metadata)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  
  const result = await query(sql, [tenantId, instituteId, name.trim(), code, metadata]);
  return result.rows[0];
}

/**
 * Get center by ID
 */
async function getCenterById(centerId, tenantId, client = null) {
  const executor = client || { query };
  const sql = `
    SELECT c.*, i.name as institute_name
    FROM centers c
    JOIN institutes i ON c.institute_id = i.institute_id
    WHERE c.center_id = $1 AND c.tenant_id = $2
  `;
  
  const result = await executor.query(sql, [centerId, tenantId]);
  return result.rows[0] || null;
}

/**
 * List centers for a tenant or institute
 */
async function listCenters(tenantId, options = {}, client = null) {
  const { page = 1, limit = 20, status, instituteId } = options;
  const offset = (page - 1) * limit;
  
  let sql = `
    SELECT c.*, i.name as institute_name
    FROM centers c
    JOIN institutes i ON c.institute_id = i.institute_id
    WHERE c.tenant_id = $1
  `;
  const params = [tenantId];
  
  if (instituteId) {
    params.push(instituteId);
    sql += ` AND c.institute_id = $${params.length}`;
  }
  
  if (status) {
    params.push(status);
    sql += ` AND c.status = $${params.length}`;
  }
  
  sql += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);
  
  const executor = client || { query };
  const result = await executor.query(sql, params);
  
  // Get total count
  let countSql = `SELECT COUNT(*) FROM centers WHERE tenant_id = $1`;
  const countParams = [tenantId];
  if (instituteId) {
    countParams.push(instituteId);
    countSql += ` AND institute_id = $2`;
  }
  if (status) {
    countParams.push(status);
    countSql += ` AND status = $${countParams.length}`;
  }
  
  const countResult = await executor.query(countSql, countParams);
  const total = parseInt(countResult.rows[0].count, 10);
  
  return {
    centers: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Update center
 */
async function updateCenter(centerId, tenantId, updates) {
  const allowedFields = ['name', 'code', 'status', 'metadata', 'institute_id'];
  const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
  
  if (fields.length === 0) {
    throw new Error('No valid fields to update');
  }
  
  // If updating institute_id, verify it exists
  if (updates.institute_id) {
    const instituteExists = await entityExists('institute', updates.institute_id, tenantId);
    if (!instituteExists) {
      throw new Error('Institute not found');
    }
  }
  
  const setClause = fields.map((field, index) => `${field} = $${index + 3}`).join(', ');
  const values = fields.map(field => updates[field]);
  
  const sql = `
    UPDATE centers
    SET ${setClause}
    WHERE center_id = $1 AND tenant_id = $2
    RETURNING *
  `;
  
  const result = await query(sql, [centerId, tenantId, ...values]);
  
  if (result.rows.length === 0) {
    throw new Error('Center not found');
  }
  
  return result.rows[0];
}

/**
 * Delete center (with cascade protection)
 */
async function deleteCenter(centerId, tenantId) {
  return transaction(async (client) => {
    // Check if center exists
    const exists = await entityExists('center', centerId, tenantId, client);
    if (!exists) {
      throw new Error('Center not found');
    }
    
    // Check for children
    const children = await hasChildren('center', centerId, client);
    if (children) {
      throw new Error('Cannot delete center with existing programs. Delete or reassign programs first.');
    }
    
    const sql = `
      DELETE FROM centers
      WHERE center_id = $1 AND tenant_id = $2
      RETURNING *
    `;
    
    const result = await client.query(sql, [centerId, tenantId]);
    return result.rows[0];
  });
}

// ============================================================================
// PROGRAM OPERATIONS
// ============================================================================

/**
 * Create a new program
 */
async function createProgram({ tenantId, centerId, name, code, durationMonths, metadata = {} }) {
  // Validation
  if (!name || name.trim().length === 0) {
    throw new Error('Validation failed: Program name is required');
  }
  
  if (!centerId) {
    throw new Error('Validation failed: Center ID is required');
  }
  
  // Verify center exists
  const centerExists = await entityExists('center', centerId, tenantId);
  if (!centerExists) {
    throw new Error('Center not found');
  }
  
  const sql = `
    INSERT INTO programs (tenant_id, center_id, name, code, duration_months, metadata)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  
  const result = await query(sql, [tenantId, centerId, name.trim(), code, durationMonths, metadata]);
  return result.rows[0];
}

/**
 * Get program by ID
 */
async function getProgramById(programId, tenantId, client = null) {
  const executor = client || { query };
  const sql = `
    SELECT p.*, c.name as center_name, i.name as institute_name
    FROM programs p
    JOIN centers c ON p.center_id = c.center_id
    JOIN institutes i ON c.institute_id = i.institute_id
    WHERE p.program_id = $1 AND p.tenant_id = $2
  `;
  
  const result = await executor.query(sql, [programId, tenantId]);
  return result.rows[0] || null;
}

/**
 * List programs for a tenant or center
 */
async function listPrograms(tenantId, options = {}, client = null) {
  const { page = 1, limit = 20, status, centerId } = options;
  const offset = (page - 1) * limit;
  
  let sql = `
    SELECT p.*, c.name as center_name, i.name as institute_name
    FROM programs p
    JOIN centers c ON p.center_id = c.center_id
    JOIN institutes i ON c.institute_id = i.institute_id
    WHERE p.tenant_id = $1
  `;
  const params = [tenantId];
  
  if (centerId) {
    params.push(centerId);
    sql += ` AND p.center_id = $${params.length}`;
  }
  
  if (status) {
    params.push(status);
    sql += ` AND p.status = $${params.length}`;
  }
  
  sql += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);
  
  const executor = client || { query };
  const result = await executor.query(sql, params);
  
  // Get total count
  let countSql = `SELECT COUNT(*) FROM programs WHERE tenant_id = $1`;
  const countParams = [tenantId];
  if (centerId) {
    countParams.push(centerId);
    countSql += ` AND center_id = $2`;
  }
  if (status) {
    countParams.push(status);
    countSql += ` AND status = $${countParams.length}`;
  }
  
  const countResult = await executor.query(countSql, countParams);
  const total = parseInt(countResult.rows[0].count, 10);
  
  return {
    programs: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Update program
 */
async function updateProgram(programId, tenantId, updates) {
  const allowedFields = ['name', 'code', 'status', 'duration_months', 'metadata', 'center_id'];
  const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
  
  if (fields.length === 0) {
    throw new Error('No valid fields to update');
  }
  
  // If updating center_id, verify it exists
  if (updates.center_id) {
    const centerExists = await entityExists('center', updates.center_id, tenantId);
    if (!centerExists) {
      throw new Error('Center not found');
    }
  }
  
  const setClause = fields.map((field, index) => `${field} = $${index + 3}`).join(', ');
  const values = fields.map(field => updates[field]);
  
  const sql = `
    UPDATE programs
    SET ${setClause}
    WHERE program_id = $1 AND tenant_id = $2
    RETURNING *
  `;
  
  const result = await query(sql, [programId, tenantId, ...values]);
  
  if (result.rows.length === 0) {
    throw new Error('Program not found');
  }
  
  return result.rows[0];
}

/**
 * Delete program (with cascade protection)
 */
async function deleteProgram(programId, tenantId) {
  return transaction(async (client) => {
    // Check if program exists
    const exists = await entityExists('program', programId, tenantId, client);
    if (!exists) {
      throw new Error('Program not found');
    }
    
    // Check for children
    const children = await hasChildren('program', programId, client);
    if (children) {
      throw new Error('Cannot delete program with existing batches. Delete or reassign batches first.');
    }
    
    const sql = `
      DELETE FROM programs
      WHERE program_id = $1 AND tenant_id = $2
      RETURNING *
    `;
    
    const result = await client.query(sql, [programId, tenantId]);
    return result.rows[0];
  });
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Create a new batch
 */
async function createBatch({ tenantId, programId, name, code, startDate, endDate, capacity, metadata = {} }) {
  // Validation
  if (!name || name.trim().length === 0) {
    throw new Error('Validation failed: Batch name is required');
  }
  
  if (!programId) {
    throw new Error('Validation failed: Program ID is required');
  }
  
  // Verify program exists
  const programExists = await entityExists('program', programId, tenantId);
  if (!programExists) {
    throw new Error('Program not found');
  }
  
  const sql = `
    INSERT INTO batches (tenant_id, program_id, name, code, start_date, end_date, capacity, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  
  const result = await query(sql, [tenantId, programId, name.trim(), code, startDate, endDate, capacity, metadata]);
  return result.rows[0];
}

/**
 * Get batch by ID with full hierarchy
 */
async function getBatchById(batchId, tenantId, client = null) {
  const executor = client || { query };
  const sql = `
    SELECT b.*, p.name as program_name, c.name as center_name, i.name as institute_name
    FROM batches b
    JOIN programs p ON b.program_id = p.program_id
    JOIN centers c ON p.center_id = c.center_id
    JOIN institutes i ON c.institute_id = i.institute_id
    WHERE b.batch_id = $1 AND b.tenant_id = $2
  `;
  
  const result = await executor.query(sql, [batchId, tenantId]);
  return result.rows[0] || null;
}

/**
 * List batches for a tenant or program
 */
async function listBatches(tenantId, options = {}, client = null) {
  const { page = 1, limit = 20, status, programId } = options;
  const offset = (page - 1) * limit;
  
  let sql = `
    SELECT b.*, p.name as program_name, c.name as center_name, i.name as institute_name
    FROM batches b
    JOIN programs p ON b.program_id = p.program_id
    JOIN centers c ON p.center_id = c.center_id
    JOIN institutes i ON c.institute_id = i.institute_id
    WHERE b.tenant_id = $1
  `;
  const params = [tenantId];
  
  if (programId) {
    params.push(programId);
    sql += ` AND b.program_id = $${params.length}`;
  }
  
  if (status) {
    params.push(status);
    sql += ` AND b.status = $${params.length}`;
  }
  
  sql += ` ORDER BY b.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);
  
  const executor = client || { query };
  const result = await executor.query(sql, params);
  
  // Get total count
  let countSql = `SELECT COUNT(*) FROM batches WHERE tenant_id = $1`;
  const countParams = [tenantId];
  if (programId) {
    countParams.push(programId);
    countSql += ` AND program_id = $2`;
  }
  if (status) {
    countParams.push(status);
    countSql += ` AND status = $${countParams.length}`;
  }
  
  const countResult = await executor.query(countSql, countParams);
  const total = parseInt(countResult.rows[0].count, 10);
  
  return {
    batches: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Update batch
 */
async function updateBatch(batchId, tenantId, updates) {
  const allowedFields = ['name', 'code', 'status', 'start_date', 'end_date', 'capacity', 'metadata', 'program_id'];
  const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
  
  if (fields.length === 0) {
    throw new Error('No valid fields to update');
  }
  
  // If updating program_id, verify it exists
  if (updates.program_id) {
    const programExists = await entityExists('program', updates.program_id, tenantId);
    if (!programExists) {
      throw new Error('Program not found');
    }
  }
  
  const setClause = fields.map((field, index) => `${field} = $${index + 3}`).join(', ');
  const values = fields.map(field => updates[field]);
  
  const sql = `
    UPDATE batches
    SET ${setClause}
    WHERE batch_id = $1 AND tenant_id = $2
    RETURNING *
  `;
  
  const result = await query(sql, [batchId, tenantId, ...values]);
  
  if (result.rows.length === 0) {
    throw new Error('Batch not found');
  }
  
  return result.rows[0];
}

/**
 * Delete batch (with cascade protection)
 */
async function deleteBatch(batchId, tenantId) {
  return transaction(async (client) => {
    // Check if batch exists
    const exists = await entityExists('batch', batchId, tenantId, client);
    if (!exists) {
      throw new Error('Batch not found');
    }
    
    // Check for enrollments
    const enrollmentCheck = await client.query(
      'SELECT COUNT(*) FROM enrollments WHERE batch_id = $1 AND tenant_id = $2',
      [batchId, tenantId]
    );
    
    if (parseInt(enrollmentCheck.rows[0].count, 10) > 0) {
      throw new Error('Cannot delete batch with existing enrollments. Remove enrollments first.');
    }
    
    const sql = `
      DELETE FROM batches
      WHERE batch_id = $1 AND tenant_id = $2
      RETURNING *
    `;
    
    const result = await client.query(sql, [batchId, tenantId]);
    return result.rows[0];
  });
}

// ============================================================================
// HIERARCHY NAVIGATION OPERATIONS (Task 2.1.2)
// ============================================================================

/**
 * Get children of a hierarchy node
 * Returns immediate children based on entity type
 */
async function getNodeChildren(nodeId, entityType, tenantId) {
  // Validate entity type
  const validTypes = ['institute', 'center', 'program', 'batch'];
  if (!validTypes.includes(entityType)) {
    throw new Error(`Invalid entity type: ${entityType}`);
  }
  
  // Batch has no children
  if (entityType === 'batch') {
    return [];
  }
  
  // Map entity types to their child tables and relationships
  const childMapping = {
    institute: { table: 'centers', parentColumn: 'institute_id', childIdColumn: 'center_id' },
    center: { table: 'programs', parentColumn: 'center_id', childIdColumn: 'program_id' },
    program: { table: 'batches', parentColumn: 'program_id', childIdColumn: 'batch_id' }
  };
  
  const mapping = childMapping[entityType];
  
  const sql = `
    SELECT * FROM ${mapping.table}
    WHERE ${mapping.parentColumn} = $1 AND tenant_id = $2
    ORDER BY created_at DESC
  `;
  
  const result = await query(sql, [nodeId, tenantId]);
  return result.rows;
}

/**
 * Get ancestors of a hierarchy node (parent chain)
 * Returns array from root to immediate parent
 */
async function getNodeAncestors(nodeId, entityType, tenantId) {
  // Validate entity type
  const validTypes = ['institute', 'center', 'program', 'batch'];
  if (!validTypes.includes(entityType)) {
    throw new Error(`Invalid entity type: ${entityType}`);
  }
  
  // Institute has no ancestors
  if (entityType === 'institute') {
    return [];
  }
  
  const ancestors = [];
  
  // Build ancestor chain based on entity type
  if (entityType === 'batch') {
    // Get batch -> program -> center -> institute
    const batch = await getBatchById(nodeId, tenantId);
    if (!batch) {
      throw new Error('Batch not found');
    }
    
    const program = await getProgramById(batch.program_id, tenantId);
    if (program) {
      ancestors.push({
        entity_type: 'program',
        entity_id: program.program_id,
        name: program.name,
        code: program.code
      });
      
      const center = await getCenterById(program.center_id, tenantId);
      if (center) {
        ancestors.push({
          entity_type: 'center',
          entity_id: center.center_id,
          name: center.name,
          code: center.code
        });
        
        const institute = await getInstituteById(center.institute_id, tenantId);
        if (institute) {
          ancestors.push({
            entity_type: 'institute',
            entity_id: institute.institute_id,
            name: institute.name,
            code: institute.code
          });
        }
      }
    }
  } else if (entityType === 'program') {
    // Get program -> center -> institute
    const program = await getProgramById(nodeId, tenantId);
    if (!program) {
      throw new Error('Program not found');
    }
    
    const center = await getCenterById(program.center_id, tenantId);
    if (center) {
      ancestors.push({
        entity_type: 'center',
        entity_id: center.center_id,
        name: center.name,
        code: center.code
      });
      
      const institute = await getInstituteById(center.institute_id, tenantId);
      if (institute) {
        ancestors.push({
          entity_type: 'institute',
          entity_id: institute.institute_id,
          name: institute.name,
          code: institute.code
        });
      }
    }
  } else if (entityType === 'center') {
    // Get center -> institute
    const center = await getCenterById(nodeId, tenantId);
    if (!center) {
      throw new Error('Center not found');
    }
    
    const institute = await getInstituteById(center.institute_id, tenantId);
    if (institute) {
      ancestors.push({
        entity_type: 'institute',
        entity_id: institute.institute_id,
        name: institute.name,
        code: institute.code
      });
    }
  }
  
  // Reverse to get root-to-parent order
  return ancestors.reverse();
}

/**
 * Resolve permissions for a field based on hierarchy
 * Child levels can only restrict, not expand permissions
 */
function resolveFieldPermissions(fieldConfig, userContext) {
  // Start with global permissions
  let visibleToRoles = new Set(fieldConfig.global_permissions?.visible_to_roles || []);
  let editableByRoles = new Set(fieldConfig.global_permissions?.editable_by_roles || []);
  
  // Apply hierarchy restrictions in order: institute -> center -> program -> batch
  const hierarchyLevels = ['institute', 'center', 'program', 'batch'];
  
  for (const level of hierarchyLevels) {
    const levelId = userContext[`${level}_id`];
    if (!levelId) continue;
    
    const override = fieldConfig[`${level}_overrides`]?.[levelId];
    if (override) {
      // Intersection: child can only restrict, not expand
      if (override.visible_to_roles) {
        const overrideVisible = new Set(override.visible_to_roles);
        visibleToRoles = new Set([...visibleToRoles].filter(role => overrideVisible.has(role)));
      }
      
      if (override.editable_by_roles) {
        const overrideEditable = new Set(override.editable_by_roles);
        editableByRoles = new Set([...editableByRoles].filter(role => overrideEditable.has(role)));
      }
    }
  }
  
  return {
    visible_to_roles: Array.from(visibleToRoles),
    editable_by_roles: Array.from(editableByRoles)
  };
}

/**
 * Get full hierarchy tree for a tenant
 * Returns nested structure with all entities
 */
async function getHierarchyTree(tenantId, options = {}) {
  const { includeInactive = false } = options;
  
  // Get all institutes
  const institutesResult = await listInstitutes(tenantId, { 
    limit: 1000,
    status: includeInactive ? undefined : 'active'
  });
  
  const tree = [];
  
  for (const institute of institutesResult.institutes) {
    const instituteNode = {
      entity_type: 'institute',
      entity_id: institute.institute_id,
      name: institute.name,
      code: institute.code,
      status: institute.status,
      children: []
    };
    
    // Get centers for this institute
    const centersResult = await listCenters(tenantId, {
      instituteId: institute.institute_id,
      limit: 1000,
      status: includeInactive ? undefined : 'active'
    });
    
    for (const center of centersResult.centers) {
      const centerNode = {
        entity_type: 'center',
        entity_id: center.center_id,
        name: center.name,
        code: center.code,
        status: center.status,
        children: []
      };
      
      // Get programs for this center
      const programsResult = await listPrograms(tenantId, {
        centerId: center.center_id,
        limit: 1000,
        status: includeInactive ? undefined : 'active'
      });
      
      for (const program of programsResult.programs) {
        const programNode = {
          entity_type: 'program',
          entity_id: program.program_id,
          name: program.name,
          code: program.code,
          status: program.status,
          children: []
        };
        
        // Get batches for this program
        const batchesResult = await listBatches(tenantId, {
          programId: program.program_id,
          limit: 1000,
          status: includeInactive ? undefined : 'active'
        });
        
        for (const batch of batchesResult.batches) {
          programNode.children.push({
            entity_type: 'batch',
            entity_id: batch.batch_id,
            name: batch.name,
            code: batch.code,
            status: batch.status,
            start_date: batch.start_date,
            end_date: batch.end_date,
            capacity: batch.capacity
          });
        }
        
        centerNode.children.push(programNode);
      }
      
      instituteNode.children.push(centerNode);
    }
    
    tree.push(instituteNode);
  }
  
  return tree;
}

module.exports = {
  // Institute operations
  createInstitute,
  getInstituteById,
  listInstitutes,
  updateInstitute,
  deleteInstitute,
  
  // Center operations
  createCenter,
  getCenterById,
  listCenters,
  updateCenter,
  deleteCenter,
  
  // Program operations
  createProgram,
  getProgramById,
  listPrograms,
  updateProgram,
  deleteProgram,
  
  // Batch operations
  createBatch,
  getBatchById,
  listBatches,
  updateBatch,
  deleteBatch,
  
  // Hierarchy navigation (Task 2.1.2)
  getNodeChildren,
  getNodeAncestors,
  resolveFieldPermissions,
  getHierarchyTree
};
