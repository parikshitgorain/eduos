# EduOS Platform - Knowledge Base & FAQ

**Version:** 1.0  
**Last Updated:** 2026-02-08  
**Searchable:** Yes

---

## Table of Contents

1. [Frequently Asked Questions](#frequently-asked-questions)
2. [Troubleshooting Guide](#troubleshooting-guide)
3. [How-To Guides](#how-to-guides)
4. [Common Error Messages](#common-error-messages)
5. [Best Practices](#best-practices)
6. [Glossary](#glossary)

---

## Frequently Asked Questions

### General Questions

#### Q: What is EduOS?
**A:** EduOS is a production-grade, AI-enabled SaaS platform designed for educational institutions. It provides comprehensive student management, attendance tracking, financial operations, and AI-powered insights with strict multi-tenant isolation.

#### Q: What are the different tiers available?
**A:** EduOS offers three tiers:
- **Basic**: Up to 1,000 students, 10 GB storage, email support
- **Business**: Up to 10,000 students, 100 GB storage, email + chat support, 1 custom domain
- **Enterprise**: Unlimited students, 1 TB storage, 24/7 phone support, unlimited custom domains

#### Q: How is my data protected?
**A:** EduOS implements multiple layers of security:
- Database-level Row-Level Security (RLS) for tenant isolation
- Encryption at rest (AES-256) and in transit (TLS 1.3)
- Cryptographic audit trails with SHA-256 hash chains
- Multi-factor authentication (MFA)
- Regular security audits and penetration testing

#### Q: Can I export my data?
**A:** Yes! You can export data in multiple formats:
- Students: CSV, JSON, Excel
- Attendance: CSV, PDF reports
- Payments: CSV, Excel
- Audit Logs: JSON, PDF (with digital signature)
- Complete tenant export available on request

### Account & Access

#### Q: I forgot my password. How do I reset it?
**A:** Click "Forgot Password" on the login page, enter your email, and you'll receive a reset link. The link expires in 1 hour for security.

#### Q: How do I enable multi-factor authentication (MFA)?
**A:** Navigate to Profile → Security → Enable MFA. Scan the QR code with your authenticator app and enter the verification code. Save your backup codes in a secure location.

#### Q: I lost my MFA device. How can I access my account?
**A:** Use one of your backup codes to log in, then set up MFA again. If you don't have backup codes, contact your administrator to reset your MFA.

#### Q: Why am I getting "Insufficient permissions" errors?
**A:** This means your role doesn't have access to the requested resource. Contact your administrator to request the necessary permissions.

### Tenant Management

#### Q: How do I upgrade my tier?
**A:** Navigate to Settings → Billing → Upgrade, select your desired tier, and complete the payment. The upgrade is applied immediately.

#### Q: What happens when I reach my quota limits?
**A:** You'll receive notifications at 80% and 90% usage. At 100%, some services may be degraded or blocked. Upgrade your tier to increase limits.

#### Q: Can I have multiple custom domains?
**A:** Yes, if you're on the Enterprise tier. Business tier includes 1 custom domain. Basic tier doesn't support custom domains.

### Students & Enrollment

#### Q: How do I add a new student?
**A:** Navigate to Students → Create Student, fill in the required fields, and click Create. The system will automatically check for potential duplicates.

#### Q: What is duplicate detection?
**A:** EduOS uses AI-powered duplicate detection to identify potential duplicate student records based on name similarity and other factors. You'll be alerted if a potential duplicate is found.

#### Q: Can students be enrolled in multiple batches?
**A:** Yes! Students can be enrolled in multiple batches simultaneously. Each enrollment has its own start date, end date, and status.

#### Q: How do I bulk import students?
**A:** Navigate to Students → Import, download the CSV template, fill in student data, and upload the file. The system will validate the data and show any errors before importing.

### Attendance

#### Q: How does offline attendance work?
**A:** The mobile app stores attendance records locally when offline. When connectivity is restored, records are automatically synced to the server with conflict resolution.

#### Q: What happens if I mark attendance twice?
**A:** The system uses idempotency keys to prevent duplicate attendance records. If you submit the same attendance twice, the second submission is ignored.

#### Q: Can I edit attendance after it's been marked?
**A:** Yes, if you have the necessary permissions. All edits are logged in the audit trail with the reason for the change.

### Payments & Invoicing

#### Q: Which payment gateways are supported?
**A:** EduOS supports Razorpay and Stripe. Both support credit cards, debit cards, UPI, net banking, and wallets.

#### Q: How are invoice numbers generated?
**A:** Invoices use sequential numbering per tenant in the format INV-{YYYY}-{MM}-{NNNN}. The system detects and alerts on any gaps in the sequence.

#### Q: How do I process a refund?
**A:** Navigate to Payments → [Payment] → Request Refund. The refund goes through an approval chain based on the amount. Once approved, it's processed through the payment gateway.

#### Q: What is bank reconciliation?
**A:** Bank reconciliation matches your bank statement transactions with invoices in the system. Upload your bank statement, and the system will auto-match transactions and highlight discrepancies.

### Schemas & Forms

#### Q: What are schemas?
**A:** Schemas define the structure of dynamic forms for students, staff, and other entities. They specify fields, validation rules, and permissions.

#### Q: Why are schemas immutable?
**A:** Immutability preserves historical data integrity. When you view an old student record, it uses the schema version from when it was created, ensuring accurate historical rendering.

#### Q: How do I modify a schema?
**A:** Create a new version of the schema. The system will increment the version number and create an immutable snapshot. You can then migrate existing records to the new version.

#### Q: What is a dry-run migration?
**A:** A dry-run simulates the migration on sample records without actually changing data. It shows potential issues, validation failures, and estimated time.

---

## Troubleshooting Guide

### Login Issues

#### Problem: "Invalid credentials" error
**Symptoms:** Cannot log in with correct email and password

**Solutions:**
1. Verify you're using the correct email address
2. Check if Caps Lock is on
3. Try resetting your password
4. Verify your account is active (not suspended)
5. Check if MFA is required and you're entering the correct code
6. Clear browser cache and cookies
7. Try a different browser

#### Problem: Account locked
**Symptoms:** "Account locked due to too many failed attempts"

**Solutions:**
1. Wait 15 minutes for automatic unlock
2. Contact your administrator for immediate unlock
3. Check audit logs for suspicious activity
4. Change password after unlock

### Performance Issues

#### Problem: Slow page loading
**Symptoms:** Pages take more than 5 seconds to load

**Solutions:**
1. Check your internet connection speed
2. Clear browser cache
3. Disable browser extensions
4. Check system status page for outages
5. Try accessing during off-peak hours
6. Contact support if issue persists

#### Problem: API timeouts
**Symptoms:** "Request timeout" errors when using API

**Solutions:**
1. Check API rate limits (may be throttled)
2. Verify network connectivity
3. Reduce request payload size
4. Implement retry logic with exponential backoff
5. Check system status page
6. Contact support with request ID

### Data Issues

#### Problem: Missing students
**Symptoms:** Students not appearing in list

**Solutions:**
1. Check filter settings (status, batch, date range)
2. Verify you have permission to view students
3. Check if students are in your hierarchy scope
4. Verify tenant context is correct
5. Check audit logs for deletion events
6. Contact support if data loss suspected

#### Problem: Duplicate students
**Symptoms:** Same student appears multiple times

**Solutions:**
1. Use duplicate detection feature
2. Review potential duplicates in review queue
3. Merge duplicate records (creates audit trail)
4. Implement stricter validation rules
5. Train staff on proper data entry

### Payment Issues

#### Problem: Payment gateway errors
**Symptoms:** "Payment failed" or gateway timeout

**Solutions:**
1. Verify gateway credentials are correct
2. Check gateway status (Razorpay/Stripe status page)
3. Verify webhook endpoint is accessible
4. Check firewall rules
5. Review webhook logs for errors
6. Test with sandbox credentials first
7. Contact gateway support

#### Problem: Webhook not received
**Symptoms:** Payment succeeded but not reflected in system

**Solutions:**
1. Check webhook endpoint configuration
2. Verify webhook signature secret
3. Review webhook logs in gateway dashboard
4. Check firewall/security rules
5. Manually trigger webhook retry
6. Contact support with webhook ID

---

## How-To Guides

### How to Set Up a New Tenant

1. Navigate to admin portal
2. Click "Create Tenant"
3. Fill in basic information:
   - Name
   - Subdomain
   - Tier
   - Admin email
4. Configure settings:
   - Timezone
   - Currency
   - Language
5. Review and create
6. Admin receives welcome email with credentials
7. Admin logs in and completes setup wizard

### How to Create a Custom Domain

1. Navigate to Settings → Domains
2. Click "Add Domain"
3. Enter your domain (e.g., portal.school.edu)
4. Add DNS TXT record for verification:
   ```
   Type: TXT
   Name: _eduos-verification
   Value: [provided by system]
   ```
5. Wait for DNS propagation (5-30 minutes)
6. Click "Verify DNS"
7. Add CNAME record:
   ```
   Type: CNAME
   Name: portal
   Value: your-tenant.eduos.com
   ```
8. System provisions SSL certificate automatically
9. Click "Activate Domain"
10. Domain is now active!

### How to Migrate a Schema

1. Navigate to Schemas → [Schema]
2. Click "Create Version"
3. Make desired changes to fields
4. Click "Dry Run Migration"
5. Review impact report:
   - Records affected
   - Validation failures
   - Estimated time
6. Fix any validation issues
7. Click "Execute Migration"
8. Monitor progress
9. Verify migrated records
10. If issues occur, system auto-rolls back

### How to Generate a Compliance Report

1. Navigate to Monitoring → Compliance
2. Select report type:
   - GDPR
   - FERPA
   - SOC 2
3. Select date range
4. Configure filters (optional):
   - Users
   - Actions
   - Resources
5. Click "Generate Report"
6. Wait for processing (may take a few minutes)
7. Download PDF with digital signature
8. Verify signature for authenticity

---

## Common Error Messages

### Authentication Errors

#### `AUTH_001: Invalid credentials`
**Meaning:** Email or password is incorrect  
**Solution:** Verify credentials, reset password if needed

#### `AUTH_002: Account locked`
**Meaning:** Too many failed login attempts  
**Solution:** Wait 15 minutes or contact administrator

#### `AUTH_003: MFA required`
**Meaning:** Multi-factor authentication is enforced  
**Solution:** Set up MFA in your profile

#### `AUTH_004: Token expired`
**Meaning:** Your session has expired  
**Solution:** Log in again

### Validation Errors

#### `VAL_001: Required field missing`
**Meaning:** A required field was not provided  
**Solution:** Fill in all required fields

#### `VAL_002: Invalid email format`
**Meaning:** Email address format is invalid  
**Solution:** Use format: user@domain.com

#### `VAL_003: Date out of range`
**Meaning:** Date is outside allowed range  
**Solution:** Check min/max date constraints

#### `VAL_004: Duplicate entry`
**Meaning:** Record with same unique field already exists  
**Solution:** Check for existing records, use different value

### Permission Errors

#### `PERM_001: Insufficient permissions`
**Meaning:** Your role doesn't have required permission  
**Solution:** Contact administrator to request permission

#### `PERM_002: Cross-tenant access denied`
**Meaning:** Attempting to access another tenant's data  
**Solution:** Verify tenant context is correct

#### `PERM_003: Field not visible`
**Meaning:** Field is hidden for your role  
**Solution:** Contact administrator if you need access

### Rate Limit Errors

#### `RATE_001: Too many requests`
**Meaning:** Exceeded rate limit  
**Solution:** Wait for rate limit reset (see Retry-After header)

#### `RATE_002: IP blacklisted`
**Meaning:** Your IP is on the blacklist  
**Solution:** Contact administrator to remove from blacklist

---

## Best Practices

### Security

1. **Enable MFA** for all accounts, especially administrators
2. **Use strong passwords**: 12+ characters, mixed case, numbers, symbols
3. **Review audit logs** regularly for suspicious activity
4. **Limit permissions** to minimum necessary (principle of least privilege)
5. **Rotate credentials** every 90 days
6. **Use IP whitelisting** when possible
7. **Keep software updated** to latest version

### Data Management

1. **Regular backups**: Verify backup success daily
2. **Test restores**: Perform quarterly restore tests
3. **Data validation**: Implement validation rules to ensure data quality
4. **Duplicate prevention**: Use duplicate detection before creating records
5. **Archive old data**: Move inactive records to archive
6. **Document changes**: Add notes when modifying important records

### Performance

1. **Monitor metrics**: Check dashboard daily for anomalies
2. **Optimize queries**: Use filters to reduce data returned
3. **Cache effectively**: Leverage Redis caching for frequently accessed data
4. **Batch operations**: Use bulk import/update for large datasets
5. **Schedule heavy tasks**: Run reports during off-peak hours

### User Management

1. **Onboard properly**: Provide training for new users
2. **Review permissions**: Audit user permissions quarterly
3. **Offboard promptly**: Disable accounts immediately when users leave
4. **Document roles**: Maintain clear documentation of role responsibilities
5. **Provide support**: Establish clear support channels

---

## Glossary

**API (Application Programming Interface)**: Interface for programmatic access to EduOS features

**Audit Trail**: Immutable log of all system operations with cryptographic integrity

**Batch**: Smallest unit in hierarchy (e.g., Section A of Year 1)

**Center**: Second level in hierarchy (e.g., North Campus)

**Custom Domain**: Your own domain (e.g., portal.school.edu) instead of subdomain

**Dry-Run**: Simulation of an operation without actually executing it

**Hash Chain**: Cryptographic technique linking audit log entries for tamper detection

**Hierarchy**: Organizational structure (Institute → Center → Program → Class → Batch)

**Idempotency**: Property ensuring duplicate requests have same effect as single request

**Immutable**: Cannot be changed after creation (e.g., schema snapshots)

**JWT (JSON Web Token)**: Token format used for authentication

**MFA (Multi-Factor Authentication)**: Additional security layer requiring second factor

**RBAC (Role-Based Access Control)**: Permission system based on user roles

**RLS (Row-Level Security)**: Database-level tenant isolation

**Schema**: Definition of form structure, fields, and validation rules

**Snapshot**: Immutable version of a schema

**Tenant**: Your institution's isolated instance of EduOS

**Webhook**: HTTP callback for event notifications

---

## Getting Help

### Self-Service Resources

1. **Documentation**: https://docs.eduos.com
2. **Video Tutorials**: https://docs.eduos.com/videos
3. **API Reference**: https://docs.eduos.com/api
4. **Status Page**: https://status.eduos.com

### Support Channels

| Tier | Channels | Response Time |
|------|----------|---------------|
| Basic | Email | 48 hours |
| Business | Email + Chat | 24 hours |
| Enterprise | Email + Chat + Phone | 4 hours |

### Contact Information

- **Email**: support@eduos.com
- **Chat**: Available in admin portal (Business+)
- **Phone**: +91-1800-123-4567 (Enterprise)

### Before Contacting Support

Please have ready:
1. Tenant ID
2. User ID (if applicable)
3. Steps to reproduce issue
4. Screenshots or error messages
5. Browser and OS information
6. Request ID (from error response)

---

**Last Updated:** 2026-02-08  
**Knowledge Base Version:** 1.0  
**Platform Version:** 1.0
