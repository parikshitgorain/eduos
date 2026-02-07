# EduOS Platform - Administrator Guide

**Version:** 1.0  
**Last Updated:** 2026-02-08  
**Audience:** System Administrators, Institute Administrators

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Tenant Management](#tenant-management)
4. [User Management](#user-management)
5. [Hierarchy Configuration](#hierarchy-configuration)
6. [Schema Configuration](#schema-configuration)
7. [Domain Management](#domain-management)
8. [Security & Access Control](#security--access-control)
9. [Payment Configuration](#payment-configuration)
10. [Monitoring & Maintenance](#monitoring--maintenance)
11. [Troubleshooting](#troubleshooting)
12. [Best Practices](#best-practices)

---

## Introduction

Welcome to the EduOS Platform Administrator Guide. This guide provides comprehensive instructions for managing your educational institution's EduOS deployment.

### What You'll Learn

- How to set up and configure your tenant
- Managing users and permissions
- Configuring organizational hierarchy
- Creating and managing dynamic forms
- Setting up custom domains
- Monitoring system health

### Prerequisites

- Administrator access to EduOS Platform
- Basic understanding of educational institution structure
- Familiarity with web-based administration tools

---

## Getting Started

### First-Time Login

1. **Access the Admin Portal**
   - Navigate to `https://your-subdomain.eduos.com/admin`
   - Or use your custom domain: `https://admin.your-school.edu`

2. **Login Credentials**
   - Use the credentials provided during tenant provisioning
   - Email: Your admin email
   - Password: Temporary password (you'll be prompted to change it)

3. **Initial Setup Wizard**
   - Complete your profile
   - Set up multi-factor authentication (MFA)
   - Configure basic tenant settings

### Dashboard Overview

The admin dashboard provides:
- **Quick Stats**: Active students, today's attendance, pending payments
- **Recent Activity**: Latest system events
- **Alerts**: Important notifications and warnings
- **Quick Actions**: Common administrative tasks

---

## Tenant Management

### Tenant Settings

#### Basic Information

Navigate to **Settings → Tenant → Basic Information**

**Configurable Fields:**
- **Tenant Name**: Your institution's name
- **Subdomain**: Your EduOS subdomain (e.g., `springfield.eduos.com`)
- **Timezone**: Default timezone for all operations
- **Currency**: Default currency (INR for Indian institutions)
- **Language**: Primary language for the interface

**Example Configuration:**
```
Tenant Name: Springfield Elementary School
Subdomain: springfield
Timezone: Asia/Kolkata
Currency: INR (₹)
Language: English
```

#### Tier & Quotas

Your tenant tier determines available features and limits:

| Feature | Basic | Business | Enterprise |
|---------|-------|----------|------------|
| Max Students | 1,000 | 10,000 | Unlimited |
| Storage | 10 GB | 100 GB | 1 TB |
| API Calls/Day | 10,000 | 100,000 | Unlimited |
| Custom Domains | 0 | 1 | Unlimited |
| Support | Email | Email + Chat | 24/7 Phone |

**To Upgrade Your Tier:**
1. Navigate to **Settings → Billing → Upgrade**
2. Select desired tier
3. Review pricing and features
4. Complete payment
5. Upgrade is applied immediately

#### Usage Monitoring

Monitor your resource usage at **Settings → Tenant → Usage**

**Key Metrics:**
- **Students**: Current count vs. quota
- **Storage**: Used space vs. allocated
- **API Calls**: Today's usage vs. daily limit
- **Bandwidth**: Data transfer statistics

**Alerts:**
- 80% usage: Warning notification
- 90% usage: Critical notification
- 100% usage: Service degradation or blocking

---

## User Management

### User Roles

EduOS implements hierarchical role-based access control (RBAC):

```
SuperAdmin (Platform Level)
    ↓
InstituteAdmin (Institution Level)
    ↓
CenterAdmin (Campus/Center Level)
    ↓
Teacher (Class/Batch Level)
    ↓
Student (Individual Level)
```

**Role Capabilities:**

| Role | Capabilities |
|------|--------------|
| **SuperAdmin** | Full platform access, tenant management, AI kill switch |
| **InstituteAdmin** | Full tenant access, user management, schema configuration |
| **CenterAdmin** | Center-level management, teacher assignment, reporting |
| **Teacher** | Class management, attendance, grading, student communication |
| **Student** | View own records, submit assignments, view grades |

### Creating Users

#### Method 1: Single User Creation

1. Navigate to **Users → Create User**
2. Fill in required fields:
   ```
   Email: teacher@school.edu
   Name: Jane Smith
   Role: Teacher
   Hierarchy Node: North Campus → Computer Science
   ```
3. Set initial password or send invitation email
4. Assign specific permissions (optional)
5. Click **Create User**

#### Method 2: Bulk User Import

1. Navigate to **Users → Import**
2. Download CSV template
3. Fill in user data:
   ```csv
   email,name,role,hierarchy_node_id
   teacher1@school.edu,John Doe,Teacher,center_123
   teacher2@school.edu,Jane Smith,Teacher,center_123
   ```
4. Upload CSV file
5. Review validation results
6. Confirm import

**Validation Rules:**
- Email must be unique
- Role must be valid
- Hierarchy node must exist
- Password requirements: 8+ chars, uppercase, lowercase, number, special char

### Managing User Permissions

#### Field-Level Permissions

Control what data users can see and edit:

1. Navigate to **Users → [User] → Permissions**
2. Select resource (e.g., Students)
3. Configure field permissions:

**Example: Teacher Permissions for Student Records**
```
Field: first_name
  ✓ Visible
  ✗ Editable

Field: attendance_record
  ✓ Visible
  ✓ Editable

Field: national_id
  ✗ Visible
  ✗ Editable
```

#### Custom Permission Sets

Create reusable permission templates:

1. Navigate to **Settings → Permissions → Templates**
2. Click **Create Template**
3. Name: "Math Teacher"
4. Configure permissions:
   - Students: Read only
   - Attendance: Read/Write
   - Grades: Read/Write (Math subject only)
5. Save template
6. Assign to users

### User Lifecycle Management

#### Suspending Users

Temporarily disable access without deleting:

1. Navigate to **Users → [User]**
2. Click **Actions → Suspend**
3. Provide reason
4. Set suspension duration (optional)
5. Confirm

**Effects:**
- User cannot log in
- Active sessions terminated
- Data remains intact
- Can be reactivated anytime

#### Deleting Users

Permanently remove users (soft delete):

1. Navigate to **Users → [User]**
2. Click **Actions → Delete**
3. **Important**: Transfer ownership of:
   - Classes
   - Documents
   - Assignments
4. Confirm deletion

**Data Retention:**
- User data soft-deleted (recoverable for 90 days)
- Audit logs preserved permanently
- Associated records (attendance, grades) remain

---

## Hierarchy Configuration

### Understanding Hierarchy

EduOS uses a flexible 5-level hierarchy:

```
Institute (Root)
  ↓
Center (Campus/Branch)
  ↓
Program (Department/Course)
  ↓
Class (Year/Grade)
  ↓
Batch (Section/Group)
```

### Creating Hierarchy Nodes

#### Step 1: Create Institute (Root)

This is created automatically during tenant provisioning.

#### Step 2: Create Centers

1. Navigate to **Hierarchy → Create Node**
2. Select type: **Center**
3. Fill in details:
   ```
   Name: North Campus
   Parent: Springfield Institute
   Code: NC
   Address: 123 Main Street
   Phone: +91-9876543210
   ```
4. Click **Create**

#### Step 3: Create Programs

1. Navigate to **Hierarchy → [Center] → Create Child**
2. Select type: **Program**
3. Fill in details:
   ```
   Name: Computer Science
   Parent: North Campus
   Code: CS
   Duration: 4 years
   ```
4. Click **Create**

#### Step 4: Create Classes

1. Navigate to **Hierarchy → [Program] → Create Child**
2. Select type: **Class**
3. Fill in details:
   ```
   Name: Year 1
   Parent: Computer Science
   Code: CS-Y1
   Academic Year: 2026
   ```
4. Click **Create**

#### Step 5: Create Batches

1. Navigate to **Hierarchy → [Class] → Create Child**
2. Select type: **Batch**
3. Fill in details:
   ```
   Name: Section A
   Parent: Year 1
   Code: CS-Y1-A
   Max Students: 60
   ```
4. Click **Create**

### Hierarchy Best Practices

**Naming Conventions:**
- Use clear, descriptive names
- Include codes for easy reference
- Be consistent across levels

**Structure Guidelines:**
- Keep hierarchy depth reasonable (3-5 levels)
- Avoid circular references
- Plan for growth and reorganization

**Permission Inheritance:**
- Permissions flow down the hierarchy
- Child nodes can only restrict, not expand
- Test permissions at each level

---

## Schema Configuration

### Understanding Schemas

Schemas define the structure of dynamic forms for students, staff, and other entities.

**Key Concepts:**
- **Immutable Snapshots**: Every schema change creates a new version
- **Historic Rendering**: Old records use their original schema
- **Field-Level Permissions**: Control visibility and editability per role
- **Validation Rules**: Ensure data quality

### Creating a Schema

#### Step 1: Basic Information

1. Navigate to **Schemas → Create Schema**
2. Fill in basic details:
   ```
   Name: Student Profile
   Entity Type: Student
   Description: Complete student information form
   ```

#### Step 2: Add Fields

Click **Add Field** for each field:

**Example: First Name Field**
```
Field Name: first_name
Display Label: First Name
Type: Text
Required: Yes
Max Length: 50
Validation: Letters only
```

**Example: Date of Birth Field**
```
Field Name: date_of_birth
Display Label: Date of Birth
Type: Date
Required: Yes
Min Date: 1990-01-01
Max Date: 2020-12-31
```

**Example: Email Field**
```
Field Name: email
Display Label: Email Address
Type: Email
Required: Yes
Validation: Valid email format
```

#### Step 3: Configure Permissions

For each field, set role-based permissions:

**Example: National ID Field**
```
Field: national_id
Visible to:
  ✓ InstituteAdmin
  ✓ CenterAdmin
  ✗ Teacher
  ✗ Student

Editable by:
  ✓ InstituteAdmin
  ✗ CenterAdmin
  ✗ Teacher
  ✗ Student
```

#### Step 4: Preview and Test

1. Click **Preview as Role**
2. Select role: Teacher
3. Review visible/editable fields
4. Test validation rules
5. Make adjustments if needed

#### Step 5: Publish Schema

1. Review all fields and permissions
2. Click **Publish**
3. Schema is versioned (e.g., v1.0.0)
4. SHA-256 hash generated for integrity
5. Schema becomes active

### Modifying Schemas

**Important**: Schemas are immutable. Modifications create new versions.

#### Creating a New Version

1. Navigate to **Schemas → [Schema] → Create Version**
2. Modify fields as needed
3. Version automatically incremented (v1.0.0 → v1.1.0)
4. Preview changes
5. Publish new version

**Version Types:**
- **Major (v2.0.0)**: Breaking changes, incompatible with old data
- **Minor (v1.1.0)**: New fields, backward compatible
- **Patch (v1.0.1)**: Bug fixes, no structural changes

### Schema Migration

When publishing a new schema version, you can migrate existing records:

#### Dry-Run Migration

1. Navigate to **Schemas → [Schema] → Migrate**
2. Select target version
3. Click **Dry Run**
4. Review impact report:
   ```
   Records to migrate: 2,500
   New fields: 3
   Removed fields: 1
   Validation failures: 12
   Estimated time: 45 seconds
   ```
5. Review validation failures
6. Fix data issues or adjust schema

#### Execute Migration

1. After successful dry run
2. Click **Execute Migration**
3. Monitor progress
4. Review completion report
5. Verify migrated records

**Auto-Rollback:**
- If migration fails, automatic rollback occurs
- Rollback time: 30s (Enterprise), 5min (Business), 15min (Basic)
- Original data preserved

---

## Domain Management

### Custom Domain Setup

Custom domains allow you to use your own domain (e.g., `portal.school.edu`) instead of the default subdomain.

#### Prerequisites

- Business or Enterprise tier
- Access to your domain's DNS settings
- SSL certificate (Let's Encrypt provided automatically)

#### Step 1: Add Domain

1. Navigate to **Settings → Domains → Add Domain**
2. Enter your domain:
   ```
   Domain: portal.springfield.edu
   ```
3. Click **Add Domain**

#### Step 2: DNS Verification

1. System generates verification token
2. Add TXT record to your DNS:
   ```
   Type: TXT
   Name: _eduos-verification
   Value: eduos-verify-abc123def456
   TTL: 3600
   ```
3. Wait for DNS propagation (5-30 minutes)
4. Click **Verify DNS**

#### Step 3: Configure DNS

After verification, add CNAME record:

```
Type: CNAME
Name: portal
Value: your-tenant.eduos.com
TTL: 3600
```

#### Step 4: SSL Certificate

1. System automatically provisions Let's Encrypt certificate
2. Certificate renewal: Automatic every 60 days
3. Status: **Settings → Domains → [Domain] → SSL Status**

#### Step 5: Activate Domain

1. Once SSL is active
2. Click **Activate Domain**
3. Domain becomes primary access point
4. Old subdomain still works (redirects to custom domain)

### Domain Troubleshooting

**Common Issues:**

| Issue | Solution |
|-------|----------|
| DNS not verifying | Wait 30 min, check TXT record syntax |
| SSL provisioning failed | Verify CNAME record, check firewall |
| Domain not accessible | Clear DNS cache, check CNAME |
| Mixed content warnings | Ensure all resources use HTTPS |

---

## Security & Access Control

### Multi-Factor Authentication (MFA)

#### Enforcing MFA

1. Navigate to **Settings → Security → MFA**
2. Select enforcement level:
   - **Optional**: Users can enable MFA
   - **Required for Admins**: All admin roles must use MFA
   - **Required for All**: All users must use MFA
3. Set grace period: 7 days (users have 7 days to set up MFA)
4. Click **Save**

#### User MFA Setup

Users set up MFA from their profile:

1. **Profile → Security → Enable MFA**
2. Scan QR code with authenticator app (Google Authenticator, Authy)
3. Enter verification code
4. Save 10 backup codes (single-use)
5. MFA is now active

#### MFA Recovery

If a user loses their MFA device:

1. Navigate to **Users → [User] → Security**
2. Click **Reset MFA**
3. Provide reason (logged in audit trail)
4. User receives email with temporary code
5. User can set up MFA again

### Session Management

#### Session Settings

Configure session behavior:

1. Navigate to **Settings → Security → Sessions**
2. Configure:
   ```
   Session Timeout: 1 hour (idle)
   Max Session Duration: 8 hours
   Concurrent Sessions:
     - Basic: 2
     - Business: 5
     - Enterprise: 10
   Remember Me: 7 days
   ```

#### Active Sessions

View and manage active sessions:

1. Navigate to **Users → [User] → Sessions**
2. View active sessions:
   ```
   Session ID: sess_abc123
   Device: Chrome on Windows
   IP: 192.168.1.100
   Location: Mumbai, India
   Last Activity: 5 minutes ago
   ```
3. Revoke suspicious sessions: Click **Revoke**

### IP Access Control

#### Whitelist/Blacklist

Control access by IP address:

1. Navigate to **Settings → Security → IP Access**
2. Add to whitelist:
   ```
   IP: 203.0.113.0/24
   Description: School Network
   Expires: Never
   ```
3. Add to blacklist:
   ```
   IP: 198.51.100.50
   Reason: Suspicious activity
   Expires: 30 days
   ```

#### Rate Limiting

View and adjust rate limits:

1. Navigate to **Settings → Security → Rate Limits**
2. Current limits:
   ```
   Public API: 100 req/15min per IP
   Authenticated: 1000 req/15min per user
   Login Attempts: 5 attempts/15min
   ```
3. Adjust for your needs (Enterprise only)

---

## Payment Configuration

### Payment Gateway Setup

#### Razorpay Configuration

1. Navigate to **Settings → Payments → Gateways**
2. Select **Razorpay**
3. Enter credentials:
   ```
   Key ID: rzp_test_abc123
   Key Secret: ••••••••••••••
   Webhook Secret: whsec_abc123
   ```
4. Test connection
5. Enable gateway

#### Stripe Configuration

1. Navigate to **Settings → Payments → Gateways**
2. Select **Stripe**
3. Enter credentials:
   ```
   Publishable Key: pk_test_abc123
   Secret Key: sk_test_••••••••
   Webhook Secret: whsec_abc123
   ```
4. Test connection
5. Enable gateway

### Invoice Configuration

#### Invoice Settings

1. Navigate to **Settings → Payments → Invoices**
2. Configure:
   ```
   Invoice Prefix: INV
   Starting Number: 1
   Number Format: INV-{YYYY}-{MM}-{NNNN}
   
   Tax Settings:
     GST Rate: 18%
     Include CGST/SGST: Yes
   
   Payment Terms: Net 30 days
   Late Fee: 2% per month
   ```

#### Invoice Template

Customize invoice appearance:

1. Navigate to **Settings → Payments → Invoice Template**
2. Upload logo
3. Configure colors and fonts
4. Add custom footer text
5. Preview invoice
6. Save template

### Refund Workflow

#### Approval Chain

Configure refund approval workflow:

1. Navigate to **Settings → Payments → Refunds**
2. Set approval chain:
   ```
   Level 1: Teacher (< ₹1,000)
   Level 2: Admin (₹1,000 - ₹10,000)
   Level 3: Finance Manager (> ₹10,000)
   ```
3. Set approval timeout: 48 hours
4. Configure notifications

---

## Monitoring & Maintenance

### System Health

#### Dashboard Metrics

Monitor system health at **Monitoring → Dashboard**

**Key Metrics:**
- **API Response Time**: p50, p95, p99
- **Error Rate**: Percentage of failed requests
- **Database Performance**: Query time, connection pool
- **Cache Hit Rate**: Redis cache effectiveness
- **Storage Usage**: Disk space utilization

**Alert Thresholds:**
```
Response Time p95 > 500ms: Warning
Response Time p95 > 1000ms: Critical
Error Rate > 1%: Warning
Error Rate > 5%: Critical
Cache Hit Rate < 90%: Warning
Storage > 80%: Warning
Storage > 95%: Critical
```

### Audit Logs

#### Viewing Audit Logs

1. Navigate to **Monitoring → Audit Logs**
2. Filter by:
   - User
   - Action (login, data access, modification)
   - Date range
   - Resource type
3. Export logs (CSV, JSON, PDF)

#### Compliance Reports

Generate compliance reports:

1. Navigate to **Monitoring → Compliance**
2. Select report type:
   - **GDPR**: Data access, consent, deletions
   - **FERPA**: Student data access logs
   - **SOC 2**: Security and availability metrics
3. Select date range
4. Generate report
5. Download PDF with digital signature

### Backup & Recovery

#### Backup Status

View backup status at **Monitoring → Backups**

**Backup Schedule:**
- **Database**: Daily at 2:00 AM
- **Redis**: Daily at 3:00 AM
- **Files**: Daily at 4:00 AM

**Retention:**
- Basic: 30 days
- Business: 90 days
- Enterprise: 365 days

#### Restore from Backup

1. Navigate to **Monitoring → Backups → Restore**
2. Select backup date
3. Choose restore type:
   - **Full Restore**: Complete system restore
   - **Partial Restore**: Specific tables/data
   - **Point-in-Time**: Restore to specific timestamp (Enterprise)
4. Review impact
5. Confirm restore
6. Monitor progress

**Disaster Recovery:**
- RTO (Recovery Time Objective):
  - Basic: 4 hours
  - Business: 1 hour
  - Enterprise: 15 minutes
- RPO (Recovery Point Objective):
  - Basic: 1 hour
  - Business: 15 minutes
  - Enterprise: 5 minutes

---

## Troubleshooting

### Common Issues

#### Users Cannot Log In

**Symptoms:**
- "Invalid credentials" error
- Account locked message

**Solutions:**
1. Verify user account is active (not suspended)
2. Check MFA status (if enforced)
3. Reset password: **Users → [User] → Reset Password**
4. Check IP whitelist/blacklist
5. Review audit logs for failed login attempts

#### Slow Performance

**Symptoms:**
- Pages loading slowly
- API timeouts

**Solutions:**
1. Check system health dashboard
2. Review database query performance
3. Check cache hit rate (should be > 95%)
4. Verify network connectivity
5. Contact support if issue persists

#### Payment Failures

**Symptoms:**
- Payment gateway errors
- Webhook not received

**Solutions:**
1. Verify gateway credentials
2. Check webhook endpoint configuration
3. Review webhook logs: **Payments → Webhooks → Logs**
4. Test gateway connection
5. Check firewall rules

#### Schema Migration Failures

**Symptoms:**
- Migration stuck or failed
- Validation errors

**Solutions:**
1. Run dry-run migration first
2. Review validation failures
3. Fix data issues or adjust schema
4. Check auto-rollback logs
5. Contact support for manual intervention

---

## Best Practices

### Security

1. **Enable MFA** for all admin accounts
2. **Regular Audits**: Review audit logs weekly
3. **Least Privilege**: Grant minimum necessary permissions
4. **Strong Passwords**: Enforce password complexity
5. **Session Timeout**: Set reasonable timeout values
6. **IP Whitelisting**: Restrict access to known IPs (if possible)

### Data Management

1. **Regular Backups**: Verify backup success daily
2. **Test Restores**: Perform quarterly restore tests
3. **Data Cleanup**: Archive old records regularly
4. **Schema Planning**: Plan schema changes carefully
5. **Dry-Run Migrations**: Always test migrations first

### Performance

1. **Monitor Metrics**: Check dashboard daily
2. **Cache Optimization**: Maintain > 95% cache hit rate
3. **Database Indexes**: Review slow queries monthly
4. **Storage Management**: Archive old files
5. **Load Testing**: Test before peak periods

### User Management

1. **Onboarding**: Provide training for new users
2. **Regular Reviews**: Audit user permissions quarterly
3. **Offboarding**: Disable accounts promptly
4. **Documentation**: Maintain user guides
5. **Support**: Provide clear support channels

---

## Getting Help

### Support Channels

| Tier | Support Channels | Response Time |
|------|------------------|---------------|
| Basic | Email | 48 hours |
| Business | Email + Chat | 24 hours |
| Enterprise | Email + Chat + Phone | 4 hours |

### Contact Information

- **Email**: support@eduos.com
- **Chat**: Available in admin portal (Business+)
- **Phone**: +91-1800-123-4567 (Enterprise)
- **Documentation**: https://docs.eduos.com
- **Status Page**: https://status.eduos.com

### Before Contacting Support

Please have ready:
1. Tenant ID
2. User ID (if user-specific issue)
3. Steps to reproduce the issue
4. Screenshots or error messages
5. Browser and OS information

---

## Appendix

### Glossary

- **Tenant**: Your institution's isolated instance
- **Hierarchy**: Organizational structure (Institute → Center → Program → Class → Batch)
- **Schema**: Dynamic form definition
- **Snapshot**: Immutable version of a schema
- **RLS**: Row-Level Security (database isolation)
- **MFA**: Multi-Factor Authentication
- **RBAC**: Role-Based Access Control

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + K` | Quick search |
| `Ctrl + /` | Show shortcuts |
| `Ctrl + S` | Save current form |
| `Esc` | Close modal |

---

**Last Updated:** 2026-02-08  
**Guide Version:** 1.0  
**Platform Version:** 1.0
