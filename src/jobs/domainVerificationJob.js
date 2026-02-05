/**
 * Domain Verification Background Job
 * 
 * Scheduled job that runs periodically to:
 * 1. Verify pending domain DNS configurations
 * 2. Provision SSL certificates for verified domains
 * 3. Renew expiring SSL certificates
 * 
 * Task: 1.2.2 - Implement domain verification workflow
 */

const { runBackgroundJob } = require('../services/domainVerificationService');

/**
 * Job configuration
 */
const JOB_CONFIG = {
  // Run every 15 minutes
  intervalMs: 15 * 60 * 1000,
  
  // Job name for logging
  name: 'domain-verification-job',
  
  // Enable/disable job
  enabled: process.env.DOMAIN_VERIFICATION_JOB_ENABLED !== 'false'
};

/**
 * Job state
 */
let jobInterval = null;
let isRunning = false;
let lastRunTime = null;
let lastRunResult = null;

/**
 * Execute the domain verification job
 * 
 * @returns {Promise<Object>} - Job execution result
 */
async function executeJob() {
  if (isRunning) {
    console.log('[Domain Verification Job] Job already running, skipping...');
    return {
      skipped: true,
      reason: 'Job already running'
    };
  }
  
  isRunning = true;
  const startTime = Date.now();
  
  try {
    console.log('[Domain Verification Job] Starting job execution...');
    
    // Run the background job
    const result = await runBackgroundJob({
      verifyDomains: true,
      renewSSL: true
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`[Domain Verification Job] Job completed in ${duration}ms`);
    console.log('[Domain Verification Job] Results:', JSON.stringify(result, null, 2));
    
    lastRunTime = new Date();
    lastRunResult = {
      success: true,
      duration,
      ...result
    };
    
    return lastRunResult;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('[Domain Verification Job] Job failed:', error);
    
    lastRunTime = new Date();
    lastRunResult = {
      success: false,
      duration,
      error: error.message,
      stack: error.stack
    };
    
    return lastRunResult;
    
  } finally {
    isRunning = false;
  }
}

/**
 * Start the background job scheduler
 * 
 * @returns {void}
 */
function startJob() {
  if (!JOB_CONFIG.enabled) {
    console.log('[Domain Verification Job] Job is disabled via configuration');
    return;
  }
  
  if (jobInterval) {
    console.log('[Domain Verification Job] Job is already running');
    return;
  }
  
  console.log(`[Domain Verification Job] Starting job with ${JOB_CONFIG.intervalMs}ms interval`);
  
  // Run immediately on startup
  executeJob().catch(error => {
    console.error('[Domain Verification Job] Initial execution failed:', error);
  });
  
  // Schedule periodic execution
  jobInterval = setInterval(() => {
    executeJob().catch(error => {
      console.error('[Domain Verification Job] Scheduled execution failed:', error);
    });
  }, JOB_CONFIG.intervalMs);
  
  console.log('[Domain Verification Job] Job started successfully');
}

/**
 * Stop the background job scheduler
 * 
 * @returns {void}
 */
function stopJob() {
  if (!jobInterval) {
    console.log('[Domain Verification Job] Job is not running');
    return;
  }
  
  console.log('[Domain Verification Job] Stopping job...');
  
  clearInterval(jobInterval);
  jobInterval = null;
  
  console.log('[Domain Verification Job] Job stopped successfully');
}

/**
 * Get job status
 * 
 * @returns {Object} - Job status information
 */
function getJobStatus() {
  return {
    name: JOB_CONFIG.name,
    enabled: JOB_CONFIG.enabled,
    running: jobInterval !== null,
    isExecuting: isRunning,
    intervalMs: JOB_CONFIG.intervalMs,
    lastRunTime: lastRunTime ? lastRunTime.toISOString() : null,
    lastRunResult: lastRunResult,
    nextRunTime: jobInterval && lastRunTime 
      ? new Date(lastRunTime.getTime() + JOB_CONFIG.intervalMs).toISOString()
      : null
  };
}

/**
 * Manually trigger job execution
 * Useful for testing or manual verification
 * 
 * @returns {Promise<Object>} - Job execution result
 */
async function triggerJob() {
  console.log('[Domain Verification Job] Manual trigger requested');
  return await executeJob();
}

module.exports = {
  startJob,
  stopJob,
  getJobStatus,
  triggerJob,
  executeJob
};
