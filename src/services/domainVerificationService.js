/**
 * Domain Verification Service
 * 
 * Background service for automatic domain verification and SSL provisioning
 * Task: 1.2.2 - Implement domain verification workflow
 */

const dns = require('dns').promises;
const { query } = require('../config/database');
const { invalidateCache } = require('../middleware/domainMapping');

/**
 * Verify a single domain's DNS configuration
 * 
 * @param {string} domainId - Domain ID to verify
 * @returns {Promise<Object>} - Verification result
 */
async function verifyDomainDNS(domainId) {
  try {
    // Get domain details
    const result = await query(
      `SELECT domain_id, domain, verification_token, is_verified, tenant_id
       FROM tenant_domains
       WHERE domain_id = $1 AND is_verified = FALSE AND is_active = TRUE`,
      [domainId]
    );
    
    if (result.rowCount === 0) {
      return {
        success: false,
        reason: 'Domain not found or already verified'
      };
    }
    
    const domainRecord = result.rows[0];
    
    // Look up TXT records for _eduos-verification subdomain
    try {
      const txtRecords = await dns.resolveTxt(`_eduos-verification.${domainRecord.domain}`);
      
      // Flatten array of arrays and check for verification token
      const allRecords = txtRecords.flat();
      const isVerified = allRecords.includes(domainRecord.verification_token);
      
      if (!isVerified) {
        return {
          success: false,
          domain: domainRecord.domain,
          reason: 'DNS TXT record not found or does not match',
          expected: domainRecord.verification_token,
          found: allRecords
        };
      }
      
      // Update domain as verified
      await query(
        `UPDATE tenant_domains
         SET is_verified = TRUE,
             verified_at = NOW(),
             updated_at = NOW()
         WHERE domain_id = $1`,
        [domainId]
      );
      
      // Invalidate cache for this domain
      invalidateCache(domainRecord.domain);
      
      return {
        success: true,
        domain: domainRecord.domain,
        domainId: domainRecord.domain_id,
        tenantId: domainRecord.tenant_id,
        verifiedAt: new Date().toISOString()
      };
      
    } catch (error) {
      if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
        return {
          success: false,
          domain: domainRecord.domain,
          reason: 'DNS TXT record not found',
          error: error.code
        };
      }
      throw error;
    }
    
  } catch (error) {
    console.error('Error verifying domain DNS:', error);
    throw error;
  }
}

/**
 * Verify all pending domains
 * This function is called by the background job
 * 
 * @returns {Promise<Object>} - Summary of verification results
 */
async function verifyAllPendingDomains() {
  try {
    // Get all unverified custom domains
    const result = await query(
      `SELECT domain_id, domain, created_at
       FROM tenant_domains
       WHERE is_verified = FALSE 
         AND domain_type = 'custom'
         AND is_active = TRUE
       ORDER BY created_at ASC`
    );
    
    const pendingDomains = result.rows;
    const results = {
      total: pendingDomains.length,
      verified: 0,
      failed: 0,
      details: []
    };
    
    // Verify each domain
    for (const domain of pendingDomains) {
      const verificationResult = await verifyDomainDNS(domain.domain_id);
      
      if (verificationResult.success) {
        results.verified++;
        results.details.push({
          domain: verificationResult.domain,
          status: 'verified',
          verifiedAt: verificationResult.verifiedAt
        });
        
        // Send notification email
        await sendVerificationSuccessEmail(
          verificationResult.tenantId,
          verificationResult.domain
        );
      } else {
        results.failed++;
        results.details.push({
          domain: verificationResult.domain || domain.domain,
          status: 'failed',
          reason: verificationResult.reason
        });
      }
    }
    
    return results;
    
  } catch (error) {
    console.error('Error verifying pending domains:', error);
    throw error;
  }
}

/**
 * Provision SSL certificate for a verified domain
 * 
 * @param {string} domainId - Domain ID
 * @returns {Promise<Object>} - SSL provisioning result
 */
async function provisionSSLCertificate(domainId) {
  try {
    // Get domain details
    const result = await query(
      `SELECT domain_id, domain, is_verified, ssl_status
       FROM tenant_domains
       WHERE domain_id = $1 AND is_verified = TRUE`,
      [domainId]
    );
    
    if (result.rowCount === 0) {
      return {
        success: false,
        reason: 'Domain not found or not verified'
      };
    }
    
    const domainRecord = result.rows[0];
    
    // In production, integrate with Let's Encrypt ACME protocol
    // For now, we'll simulate SSL provisioning
    
    // TODO: Implement Let's Encrypt integration
    // 1. Create ACME client
    // 2. Request certificate for domain
    // 3. Complete HTTP-01 or DNS-01 challenge
    // 4. Download certificate
    // 5. Install certificate on load balancer/CDN
    
    // Simulate SSL provisioning (90-day validity)
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt);
    expiresAt.setDate(expiresAt.getDate() + 90);
    
    await query(
      `UPDATE tenant_domains
       SET ssl_status = 'active',
           ssl_issued_at = $1,
           ssl_expires_at = $2,
           updated_at = NOW()
       WHERE domain_id = $3`,
      [issuedAt, expiresAt, domainId]
    );
    
    return {
      success: true,
      domain: domainRecord.domain,
      sslStatus: 'active',
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
    
  } catch (error) {
    console.error('Error provisioning SSL certificate:', error);
    
    // Update SSL status to failed
    await query(
      `UPDATE tenant_domains
       SET ssl_status = 'failed',
           updated_at = NOW()
       WHERE domain_id = $1`,
      [domainId]
    );
    
    throw error;
  }
}

/**
 * Check and renew expiring SSL certificates
 * Renews certificates that expire within 30 days
 * 
 * @returns {Promise<Object>} - Renewal summary
 */
async function renewExpiringSSLCertificates() {
  try {
    // Get domains with SSL certificates expiring in 30 days
    const result = await query(
      `SELECT domain_id, domain, ssl_expires_at
       FROM tenant_domains
       WHERE ssl_status = 'active'
         AND ssl_expires_at < NOW() + INTERVAL '30 days'
         AND is_active = TRUE
       ORDER BY ssl_expires_at ASC`
    );
    
    const expiringDomains = result.rows;
    const results = {
      total: expiringDomains.length,
      renewed: 0,
      failed: 0,
      details: []
    };
    
    // Renew each certificate
    for (const domain of expiringDomains) {
      try {
        const renewalResult = await provisionSSLCertificate(domain.domain_id);
        
        if (renewalResult.success) {
          results.renewed++;
          results.details.push({
            domain: renewalResult.domain,
            status: 'renewed',
            expiresAt: renewalResult.expiresAt
          });
        } else {
          results.failed++;
          results.details.push({
            domain: domain.domain,
            status: 'failed',
            reason: renewalResult.reason
          });
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          domain: domain.domain,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    return results;
    
  } catch (error) {
    console.error('Error renewing SSL certificates:', error);
    throw error;
  }
}

/**
 * Send email notification on successful domain verification
 * 
 * @param {string} tenantId - Tenant ID
 * @param {string} domain - Verified domain
 * @returns {Promise<void>}
 */
async function sendVerificationSuccessEmail(tenantId, domain) {
  try {
    // Get tenant details
    const result = await query(
      `SELECT name, subdomain FROM tenants WHERE tenant_id = $1`,
      [tenantId]
    );
    
    if (result.rowCount === 0) {
      console.error('Tenant not found for email notification:', tenantId);
      return;
    }
    
    const tenant = result.rows[0];
    
    // In production, integrate with email service (SendGrid, AWS SES, etc.)
    // For now, we'll log the email content
    
    const emailContent = {
      to: `admin@${tenant.subdomain}.eduos.com`, // In production, get from tenant settings
      subject: `Domain Verified: ${domain}`,
      body: `
        Hello ${tenant.name} Team,
        
        Great news! Your custom domain has been successfully verified:
        
        Domain: ${domain}
        Verified At: ${new Date().toISOString()}
        
        Your domain is now active and ready to use. Users can access your EduOS platform at:
        https://${domain}
        
        Next Steps:
        1. SSL certificate provisioning is in progress (usually completes within 1 hour)
        2. Update your DNS A/CNAME records to point to our servers
        3. Test your domain to ensure everything works correctly
        
        If you have any questions, please contact our support team.
        
        Best regards,
        EduOS Platform Team
      `
    };
    
    // TODO: Implement actual email sending
    console.log('Email notification (simulated):', emailContent);
    
    // Log notification in database
    await query(
      `INSERT INTO notifications (tenant_id, type, subject, body, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [tenantId, 'domain_verified', emailContent.subject, emailContent.body, 'sent']
    );
    
  } catch (error) {
    console.error('Error sending verification success email:', error);
    // Don't throw - email failure shouldn't break verification
  }
}

/**
 * Background job runner
 * Runs domain verification and SSL renewal checks
 * 
 * @param {Object} options - Job options
 * @returns {Promise<Object>} - Job results
 */
async function runBackgroundJob(options = {}) {
  const {
    verifyDomains = true,
    renewSSL = true
  } = options;
  
  const results = {
    timestamp: new Date().toISOString(),
    verification: null,
    sslRenewal: null
  };
  
  try {
    // Verify pending domains
    if (verifyDomains) {
      console.log('Starting domain verification job...');
      results.verification = await verifyAllPendingDomains();
      console.log('Domain verification job completed:', results.verification);
    }
    
    // Renew expiring SSL certificates
    if (renewSSL) {
      console.log('Starting SSL renewal job...');
      results.sslRenewal = await renewExpiringSSLCertificates();
      console.log('SSL renewal job completed:', results.sslRenewal);
    }
    
    return results;
    
  } catch (error) {
    console.error('Background job error:', error);
    throw error;
  }
}

module.exports = {
  verifyDomainDNS,
  verifyAllPendingDomains,
  provisionSSLCertificate,
  renewExpiringSSLCertificates,
  sendVerificationSuccessEmail,
  runBackgroundJob
};
