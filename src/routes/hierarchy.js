/**
 * Hierarchy Routes
 * 
 * API endpoints for managing Institute → Center → Program → Batch hierarchy.
 * 
 * Task: 2.1.1 - Implement Institute → Center → Program → Batch entity tree
 */

const express = require('express');
const router = express.Router();
const hierarchyService = require('../services/hierarchyService');

// UUID validation regex
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Middleware to validate UUID format
 */
function validateUUID(paramName) {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Invalid ${paramName} format`
      });
    }
    next();
  };
}

/**
 * Middleware to extract tenant_id from request
 * In production, this would come from JWT token or session
 */
function extractTenantId(req, res, next) {
  // For now, expect tenant_id in header or query
  const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id;
  
  if (!tenantId) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Tenant ID is required'
    });
  }
  
  if (!uuidRegex.test(tenantId)) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Invalid tenant ID format'
    });
  }
  
  req.tenantId = tenantId;
  next();
}

// Apply tenant extraction to all routes
router.use(extractTenantId);

// ============================================================================
// INSTITUTE ROUTES
// ============================================================================

/**
 * POST /api/v1/hierarchy/institutes
 * Create a new institute
 */
router.post('/institutes', async (req, res) => {
  try {
    const { name, code, metadata } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Institute name is required'
      });
    }
    
    const institute = await hierarchyService.createInstitute({
      tenantId: req.tenantId,
      name,
      code,
      metadata
    });
    
    res.status(201).json({
      success: true,
      message: 'Institute created successfully',
      data: institute
    });
  } catch (error) {
    console.error('Error creating institute:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Institute code already exists'
      });
    }
    
    if (error.message.startsWith('Validation failed:')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create institute'
    });
  }
});

/**
 * GET /api/v1/hierarchy/institutes
 * List all institutes
 */
router.get('/institutes', async (req, res) => {
  try {
    const { page, limit, status } = req.query;
    
    const options = {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      status
    };
    
    if (options.limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Limit cannot exceed 100'
      });
    }
    
    const result = await hierarchyService.listInstitutes(req.tenantId, options);
    
    res.json({
      success: true,
      data: result.institutes,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error listing institutes:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to list institutes'
    });
  }
});

/**
 * GET /api/v1/hierarchy/institutes/:instituteId
 * Get institute by ID
 */
router.get('/institutes/:instituteId', validateUUID('instituteId'), async (req, res) => {
  try {
    const institute = await hierarchyService.getInstituteById(req.params.instituteId, req.tenantId);
    
    if (!institute) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Institute not found'
      });
    }
    
    res.json({
      success: true,
      data: institute
    });
  } catch (error) {
    console.error('Error fetching institute:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch institute'
    });
  }
});

/**
 * PATCH /api/v1/hierarchy/institutes/:instituteId
 * Update institute
 */
router.patch('/institutes/:instituteId', validateUUID('instituteId'), async (req, res) => {
  try {
    const updates = req.body;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No fields to update'
      });
    }
    
    const institute = await hierarchyService.updateInstitute(
      req.params.instituteId,
      req.tenantId,
      updates
    );
    
    res.json({
      success: true,
      message: 'Institute updated successfully',
      data: institute
    });
  } catch (error) {
    console.error('Error updating institute:', error);
    
    if (error.message === 'Institute not found') {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message
      });
    }
    
    if (error.message === 'No valid fields to update') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update institute'
    });
  }
});

/**
 * DELETE /api/v1/hierarchy/institutes/:instituteId
 * Delete institute
 */
router.delete('/institutes/:instituteId', validateUUID('instituteId'), async (req, res) => {
  try {
    const institute = await hierarchyService.deleteInstitute(req.params.instituteId, req.tenantId);
    
    res.json({
      success: true,
      message: 'Institute deleted successfully',
      data: institute
    });
  } catch (error) {
    console.error('Error deleting institute:', error);
    
    if (error.message === 'Institute not found') {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message
      });
    }
    
    if (error.message.includes('Cannot delete institute')) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to delete institute'
    });
  }
});

// ============================================================================
// CENTER ROUTES
// ============================================================================

/**
 * POST /api/v1/hierarchy/centers
 * Create a new center
 */
router.post('/centers', async (req, res) => {
  try {
    const { instituteId, name, code, metadata } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Center name is required'
      });
    }
    
    if (!instituteId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Institute ID is required'
      });
    }
    
    const center = await hierarchyService.createCenter({
      tenantId: req.tenantId,
      instituteId,
      name,
      code,
      metadata
    });
    
    res.status(201).json({
      success: true,
      message: 'Center created successfully',
      data: center
    });
  } catch (error) {
    console.error('Error creating center:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Center code already exists'
      });
    }
    
    if (error.message === 'Institute not found') {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message
      });
    }
    
    if (error.message.startsWith('Validation failed:')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create center'
    });
  }
});

/**
 * GET /api/v1/hierarchy/centers
 * List all centers
 */
router.get('/centers', async (req, res) => {
  try {
    const { page, limit, status, instituteId } = req.query;
    
    const options = {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      status,
      instituteId
    };
    
    if (options.limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Limit cannot exceed 100'
      });
    }
    
    const result = await hierarchyService.listCenters(req.tenantId, options);
    
    res.json({
      success: true,
      data: result.centers,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error listing centers:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to list centers'
    });
  }
});

/**
 * GET /api/v1/hierarchy/centers/:centerId
 * Get center by ID
 */
router.get('/centers/:centerId', validateUUID('centerId'), async (req, res) => {
  try {
    const center = await hierarchyService.getCenterById(req.params.centerId, req.tenantId);
    
    if (!center) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Center not found'
      });
    }
    
    res.json({
      success: true,
      data: center
    });
  } catch (error) {
    console.error('Error fetching center:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch center'
    });
  }
});

/**
 * PATCH /api/v1/hierarchy/centers/:centerId
 * Update center
 */
router.patch('/centers/:centerId', validateUUID('centerId'), async (req, res) => {
  try {
    const updates = req.body;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No fields to update'
      });
    }
    
    const center = await hierarchyService.updateCenter(
      req.params.centerId,
      req.tenantId,
      updates
    );
    
    res.json({
      success: true,
      message: 'Center updated successfully',
      data: center
    });
  } catch (error) {
    console.error('Error updating center:', error);
    
    if (error.message === 'Center not found' || error.message === 'Institute not found') {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message
      });
    }
    
    if (error.message === 'No valid fields to update') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update center'
    });
  }
});

/**
 * DELETE /api/v1/hierarchy/centers/:centerId
 * Delete center
 */
router.delete('/centers/:centerId', validateUUID('centerId'), async (req, res) => {
  try {
    const center = await hierarchyService.deleteCenter(req.params.centerId, req.tenantId);
    
    res.json({
      success: true,
      message: 'Center deleted successfully',
      data: center
    });
  } catch (error) {
    console.error('Error deleting center:', error);
    
    if (error.message === 'Center not found') {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message
      });
    }
    
    if (error.message.includes('Cannot delete center')) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to delete center'
    });
  }
});

// ============================================================================
// PROGRAM ROUTES
// ============================================================================

/**
 * POST /api/v1/hierarchy/programs
 * Create a new program
 */
router.post('/programs', async (req, res) => {
  try {
    const { centerId, name, code, durationMonths, metadata } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Program name is required'
      });
    }
    
    if (!centerId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Center ID is required'
      });
    }
    
    const program = await hierarchyService.createProgram({
      tenantId: req.tenantId,
      centerId,
      name,
      code,
      durationMonths,
      metadata
    });
    
    res.status(201).json({
      success: true,
      message: 'Program created successfully',
      data: program
    });
  } catch (error) {
    console.error('Error creating program:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Program code already exists'
      });
    }
    
    if (error.message === 'Center not found') {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message
      });
    }
    
    if (error.message.startsWith('Validation failed:')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create program'
    });
  }
});

/**
 * GET /api/v1/hierarchy/programs
 * List all programs
 */
router.get('/programs', async (req, res) => {
  try {
    const { page, limit, status, centerId } = req.query;
    
    const options = {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      status,
      centerId
    };
    
    if (options.limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Limit cannot exceed 100'
      });
    }
    
    const result = await hierarchyService.listPrograms(req.tenantId, options);
    
    res.json({
      success: true,
      data: result.programs,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error listing programs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to list programs'
    });
  }
});

/**
 * GET /api/v1/hierarchy/programs/:programId
 * Get program by ID
 */
router.get('/programs/:programId', validateUUID('programId'), async (req, res) => {
  try {
    const program = await hierarchyService.getProgramById(req.params.programId, req.tenantId);
    
    if (!program) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Program not found'
      });
    }
    
    res.json({
      success: true,
      data: program
    });
  } catch (error) {
    console.error('Error fetching program:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch program'
    });
  }
});

/**
 * PATCH /api/v1/hierarchy/programs/:programId
 * Update program
 */
router.patch('/programs/:programId', validateUUID('programId'), async (req, res) => {
  try {
    const updates = req.body;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No fields to update'
      });
    }
    
    const program = await hierarchyService.updateProgram(
      req.params.programId,
      req.tenantId,
      updates
    );
    
    res.json({
      success: true,
      message: 'Program updated successfully',
      data: program
    });
  } catch (error) {
    console.error('Error updating program:', error);
    
    if (error.message === 'Program not found' || error.message === 'Center not found') {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message
      });
    }
    
    if (error.message === 'No valid fields to update') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update program'
    });
  }
});

/**
 * DELETE /api/v1/hierarchy/programs/:programId
 * Delete program
 */
router.delete('/programs/:programId', validateUUID('programId'), async (req, res) => {
  try {
    const program = await hierarchyService.deleteProgram(req.params.programId, req.tenantId);
    
    res.json({
      success: true,
      message: 'Program deleted successfully',
      data: program
    });
  } catch (error) {
    console.error('Error deleting program:', error);
    
    if (error.message === 'Program not found') {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message
      });
    }
    
    if (error.message.includes('Cannot delete program')) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to delete program'
    });
  }
});

// ============================================================================
// BATCH ROUTES
// ============================================================================

/**
 * POST /api/v1/hierarchy/batches
 * Create a new batch
 */
router.post('/batches', async (req, res) => {
  try {
    const { programId, name, code, startDate, endDate, capacity, metadata } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Batch name is required'
      });
    }
    
    if (!programId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Program ID is required'
      });
    }
    
    const batch = await hierarchyService.createBatch({
      tenantId: req.tenantId,
      programId,
      name,
      code,
      startDate,
      endDate,
      capacity,
      metadata
    });
    
    res.status(201).json({
      success: true,
      message: 'Batch created successfully',
      data: batch
    });
  } catch (error) {
    console.error('Error creating batch:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Batch code already exists'
      });
    }
    
    if (error.message === 'Program not found') {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message
      });
    }
    
    if (error.message.startsWith('Validation failed:')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create batch'
    });
  }
});

/**
 * GET /api/v1/hierarchy/batches
 * List all batches
 */
router.get('/batches', async (req, res) => {
  try {
    const { page, limit, status, programId } = req.query;
    
    const options = {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      status,
      programId
    };
    
    if (options.limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Limit cannot exceed 100'
      });
    }
    
    const result = await hierarchyService.listBatches(req.tenantId, options);
    
    res.json({
      success: true,
      data: result.batches,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error listing batches:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to list batches'
    });
  }
});

/**
 * GET /api/v1/hierarchy/batches/:batchId
 * Get batch by ID
 */
router.get('/batches/:batchId', validateUUID('batchId'), async (req, res) => {
  try {
    const batch = await hierarchyService.getBatchById(req.params.batchId, req.tenantId);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Batch not found'
      });
    }
    
    res.json({
      success: true,
      data: batch
    });
  } catch (error) {
    console.error('Error fetching batch:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch batch'
    });
  }
});

/**
 * PATCH /api/v1/hierarchy/batches/:batchId
 * Update batch
 */
router.patch('/batches/:batchId', validateUUID('batchId'), async (req, res) => {
  try {
    const updates = req.body;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No fields to update'
      });
    }
    
    const batch = await hierarchyService.updateBatch(
      req.params.batchId,
      req.tenantId,
      updates
    );
    
    res.json({
      success: true,
      message: 'Batch updated successfully',
      data: batch
    });
  } catch (error) {
    console.error('Error updating batch:', error);
    
    if (error.message === 'Batch not found' || error.message === 'Program not found') {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message
      });
    }
    
    if (error.message === 'No valid fields to update') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update batch'
    });
  }
});

/**
 * DELETE /api/v1/hierarchy/batches/:batchId
 * Delete batch
 */
router.delete('/batches/:batchId', validateUUID('batchId'), async (req, res) => {
  try {
    const batch = await hierarchyService.deleteBatch(req.params.batchId, req.tenantId);
    
    res.json({
      success: true,
      message: 'Batch deleted successfully',
      data: batch
    });
  } catch (error) {
    console.error('Error deleting batch:', error);
    
    if (error.message === 'Batch not found') {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message
      });
    }
    
    if (error.message.includes('Cannot delete batch')) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to delete batch'
    });
  }
});

// ============================================================================
// HIERARCHY NAVIGATION ROUTES (Task 2.1.2)
// ============================================================================

/**
 * GET /api/v1/hierarchy/:nodeId/children
 * Get children of a hierarchy node
 */
router.get('/:nodeId/children', validateUUID('nodeId'), async (req, res) => {
  try {
    const { entityType } = req.query;
    
    if (!entityType) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'entityType query parameter is required (institute, center, program, or batch)'
      });
    }
    
    const validTypes = ['institute', 'center', 'program', 'batch'];
    if (!validTypes.includes(entityType)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid entityType. Must be one of: institute, center, program, batch'
      });
    }
    
    const children = await hierarchyService.getNodeChildren(
      req.params.nodeId,
      entityType,
      req.tenantId
    );
    
    res.json({
      success: true,
      data: {
        node_id: req.params.nodeId,
        entity_type: entityType,
        children_count: children.length,
        children
      }
    });
  } catch (error) {
    console.error('Error fetching node children:', error);
    
    if (error.message.includes('Invalid entity type')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch node children'
    });
  }
});

/**
 * GET /api/v1/hierarchy/:nodeId/ancestors
 * Get ancestors (parent chain) of a hierarchy node
 */
router.get('/:nodeId/ancestors', validateUUID('nodeId'), async (req, res) => {
  try {
    const { entityType } = req.query;
    
    if (!entityType) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'entityType query parameter is required (institute, center, program, or batch)'
      });
    }
    
    const validTypes = ['institute', 'center', 'program', 'batch'];
    if (!validTypes.includes(entityType)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid entityType. Must be one of: institute, center, program, batch'
      });
    }
    
    const ancestors = await hierarchyService.getNodeAncestors(
      req.params.nodeId,
      entityType,
      req.tenantId
    );
    
    res.json({
      success: true,
      data: {
        node_id: req.params.nodeId,
        entity_type: entityType,
        ancestors_count: ancestors.length,
        ancestors
      }
    });
  } catch (error) {
    console.error('Error fetching node ancestors:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message
      });
    }
    
    if (error.message.includes('Invalid entity type')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch node ancestors'
    });
  }
});

/**
 * GET /api/v1/hierarchy/tree
 * Get full hierarchy tree for the tenant
 */
router.get('/tree', async (req, res) => {
  try {
    const { includeInactive } = req.query;
    
    const tree = await hierarchyService.getHierarchyTree(req.tenantId, {
      includeInactive: includeInactive === 'true'
    });
    
    res.json({
      success: true,
      data: {
        tenant_id: req.tenantId,
        tree
      }
    });
  } catch (error) {
    console.error('Error fetching hierarchy tree:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch hierarchy tree'
    });
  }
});

/**
 * POST /api/v1/hierarchy/permissions/resolve
 * Resolve field permissions based on hierarchy context
 */
router.post('/permissions/resolve', async (req, res) => {
  try {
    const { fieldConfig, userContext } = req.body;
    
    if (!fieldConfig || !userContext) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'fieldConfig and userContext are required'
      });
    }
    
    const resolvedPermissions = hierarchyService.resolveFieldPermissions(
      fieldConfig,
      userContext
    );
    
    res.json({
      success: true,
      data: resolvedPermissions
    });
  } catch (error) {
    console.error('Error resolving permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to resolve permissions'
    });
  }
});

module.exports = router;
