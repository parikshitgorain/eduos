/**
 * Webhook Retry Job
 * 
 * Scheduled job to process failed webhooks with exponential backoff
 * Should be run every minute via cron or scheduler
 * 
 * Usage:
 * - Cron: * * * * * node src/jobs/webhookRetryJob.js
 * - Kubernetes CronJob: schedule every minute
 * - AWS EventBridge: rate(1 minute)
 */

const webhookRetryService = require('../services/webhookRetryService');

/**
 * Main job function
 */
async function runWebhookRetryJob() {
  console.log('[WebhookRetryJob] Starting webhook retry job...');
  
  try {
    const startTime = Date.now();
    
    // Process all failed webhooks ready for retry
    const summary = await webhookRetryService.processRetries();
    
    const duration = Date.now() - startTime;
    
    console.log('[WebhookRetryJob] Job completed in', duration, 'ms');
    console.log('[WebhookRetryJob] Summary:', summary);
    
    // Get retry statistics
    const stats = await webhookRetryService.getRetryStatistics();
    console.log('[WebhookRetryJob] Statistics:', stats);
    
    return {
      success: true,
      duration_ms: duration,
      summary,
      stats,
    };
  } catch (error) {
    console.error('[WebhookRetryJob] Job failed:', error);
    
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Handle job result and exit
 * Separated for testability
 */
function handleJobResult(result) {
  console.log('[WebhookRetryJob] Result:', result);
  return result.success ? 0 : 1;
}

/**
 * Handle fatal error and exit
 * Separated for testability
 */
function handleFatalError(error) {
  console.error('[WebhookRetryJob] Fatal error:', error);
  return 1;
}

/**
 * Run job if executed directly
 */
/* istanbul ignore next */
if (require.main === module) {
  runWebhookRetryJob()
    .then(result => process.exit(handleJobResult(result)))
    .catch(error => process.exit(handleFatalError(error)));
}

module.exports = { 
  runWebhookRetryJob,
  handleJobResult,
  handleFatalError,
};
