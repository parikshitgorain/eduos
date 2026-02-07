# SOC 2 Type II Audit Preparation Guide

**Version:** 1.0  
**Last Updated:** 2026-02-07  
**Owner:** Compliance Team  
**Task:** 4.3.5 - Setup security monitoring and incident response

---

## Table of Contents

1. [Overview](#overview)
2. [SOC 2 Trust Service Criteria](#soc-2-trust-service-criteria)
3. [Audit Preparation Timeline](#audit-preparation-timeline)
4. [Control Implementation](#control-implementation)
5. [Evidence Collection](#evidence-collection)
6. [Audit Readiness Checklist](#audit-readiness-checklist)
7. [Common Audit Findings](#common-audit-findings)

---

## Overview

### What is SOC 2?

SOC 2 (Service Organization Control 2) is an auditing procedure that ensures service providers securely manage data to protect the interests of the organization and the privacy of its clients. It is based on the Trust Services Criteria developed by the American Institute of CPAs (AICPA).

### SOC 2 Type I vs Type II

- **Type I:** Evaluates the design of controls at a specific point in time
- **Type II:** Evaluates the operating effectiveness of controls over a period of time (typically 6-12 months)

### Why SOC 2 Matters for EduOS

- **Customer Trust:** Educational institutions require SOC 2 compliance
- **Competitive Advantage:** Differentiates us from competitors
- **Risk Management:** Identifies and mitigates security risks
- **Regulatory Compliance:** Supports FERPA, GDPR compliance

### Audit Timeline

**Observation Period:** 6-12 months  
**Audit Duration:** 4-6 weeks  
**Report Delivery:** 2-4 weeks after audit completion

---

## SOC 2 Trust Service Criteria

### CC1: Control Environment

**Objective:** The entity demonstrates a commitment to integrity and ethical values.

#### Key Controls

1. **Code of Conduct**
   - Written code of conduct for all employees
   - Annual acknowledgment required
   - Violations reported and investigated

2. **Background Checks**
   - Pre-employment background checks
   - Verification of credentials
   - Documented approval process

3. **Security Awareness Training**
   - Mandatory security training for all employees
   - Quarterly refresher training
   - Phishing simulation exercises

4. **Organizational Structure**
   - Clear reporting lines
   - Defined roles and responsibilities
   - Separation of duties

#### Evidence Required
- [ ] Code of Conduct document
- [ ] Employee acknowledgment records
- [ ] Background check policy and records
- [ ] Training completion records
- [ ] Organizational chart
- [ ] Job descriptions

### CC2: Communication and Information

**Objective:** The entity obtains or generates and uses relevant, quality information to support the functioning of internal control.

#### Key Controls

1. **Security Policies**
   - Comprehensive security policy documentation
   - Regular review and updates
   - Communication to all employees

2. **Incident Response Plan**
   - Documented incident response procedures
   - Regular testing and updates
   - Communication channels established

3. **Change Management**
   - Formal change management process
   - Change approval requirements
   - Communication of changes

#### Evidence Required
- [ ] Security policy documents
- [ ] Policy review and approval records
- [ ] Incident response playbook
- [ ] Incident response test results
- [ ] Change management policy
- [ ] Change tickets and approvals

### CC3: Risk Assessment

**Objective:** The entity identifies risks to the achievement of its objectives across the entity and analyzes risks as a basis for determining how the risks should be managed.

#### Key Controls

1. **Risk Assessment Process**
   - Annual risk assessment
   - Risk register maintenance
   - Risk treatment plans

2. **Threat Modeling**
   - Application threat modeling
   - Infrastructure threat modeling
   - Third-party risk assessment

3. **Vulnerability Management**
   - Regular vulnerability scanning
   - Patch management process
   - Penetration testing

#### Evidence Required
- [ ] Risk assessment reports
- [ ] Risk register
- [ ] Threat models
- [ ] Vulnerability scan reports
- [ ] Patch management records
- [ ] Penetration test reports

### CC4: Monitoring Activities

**Objective:** The entity selects, develops, and performs ongoing and/or separate evaluations to ascertain whether the components of internal control are present and functioning.

#### Key Controls

1. **Security Monitoring**
   - 24/7 security monitoring
   - SIEM implementation
   - Alert response procedures

2. **Log Management**
   - Centralized log collection
   - Log retention policy
   - Log review procedures

3. **Performance Monitoring**
   - System performance monitoring
   - Availability monitoring
   - Capacity planning

#### Evidence Required
- [ ] Security monitoring dashboards
- [ ] SIEM configuration
- [ ] Alert response records
- [ ] Log retention policy
- [ ] Log review records
- [ ] Performance reports

### CC5: Control Activities

**Objective:** The entity selects and develops control activities that contribute to the mitigation of risks to the achievement of objectives to acceptable levels.

#### Key Controls

1. **Access Controls**
   - Role-based access control (RBAC)
   - Least privilege principle
   - Access review process

2. **Change Management**
   - Formal change approval process
   - Testing requirements
   - Rollback procedures

3. **Data Protection**
   - Encryption at rest and in transit
   - Data classification
   - Data retention and disposal

#### Evidence Required
- [ ] Access control matrix
- [ ] Access review records
- [ ] Change management tickets
- [ ] Test results
- [ ] Encryption configuration
- [ ] Data classification policy

### CC6: Logical and Physical Access Controls

**Objective:** The entity restricts logical and physical access to assets and information to authorized users.

#### Key Controls

1. **Authentication**
   - Multi-factor authentication (MFA)
   - Password policy
   - Session management

2. **Authorization**
   - Role-based access control
   - Principle of least privilege
   - Segregation of duties

3. **Physical Security**
   - Data center access controls
   - Visitor management
   - Video surveillance

#### Evidence Required
- [ ] MFA configuration
- [ ] Password policy
- [ ] User access lists
- [ ] Access review records
- [ ] Data center access logs
- [ ] Visitor logs

### CC7: System Operations

**Objective:** The entity manages the execution of system operations to meet its objectives.

#### Key Controls

1. **Capacity Management**
   - Capacity monitoring
   - Capacity planning
   - Resource allocation

2. **Backup and Recovery**
   - Regular backups
   - Backup testing
   - Disaster recovery plan

3. **Availability Management**
   - High availability architecture
   - Failover procedures
   - Uptime monitoring

#### Evidence Required
- [ ] Capacity reports
- [ ] Backup logs
- [ ] Backup test results
- [ ] Disaster recovery plan
- [ ] DR test results
- [ ] Uptime reports

### CC8: Change Management

**Objective:** The entity identifies changes to the system that could impact internal control and manages those changes.

#### Key Controls

1. **Change Control Process**
   - Change request procedures
   - Change approval workflow
   - Change implementation procedures

2. **Testing Requirements**
   - Development environment
   - Staging environment
   - Test plans and results

3. **Deployment Process**
   - Deployment procedures
   - Rollback procedures
   - Post-deployment verification

#### Evidence Required
- [ ] Change management policy
- [ ] Change tickets
- [ ] Approval records
- [ ] Test plans and results
- [ ] Deployment logs
- [ ] Rollback procedures

### CC9: Risk Mitigation

**Objective:** The entity identifies, selects, and develops risk mitigation activities arising from potential business disruptions.

#### Key Controls

1. **Business Continuity Plan**
   - BCP documentation
   - Regular testing
   - Annual review

2. **Disaster Recovery Plan**
   - DR procedures
   - Recovery time objectives (RTO)
   - Recovery point objectives (RPO)

3. **Incident Response**
   - Incident response plan
   - Incident response team
   - Regular drills

#### Evidence Required
- [ ] Business continuity plan
- [ ] BCP test results
- [ ] Disaster recovery plan
- [ ] DR test results
- [ ] Incident response playbook
- [ ] Incident response drill records

---

## Audit Preparation Timeline

### 12 Months Before Audit

- [ ] Conduct gap analysis against SOC 2 requirements
- [ ] Develop remediation plan for identified gaps
- [ ] Implement missing controls
- [ ] Begin evidence collection

### 9 Months Before Audit

- [ ] Complete control implementation
- [ ] Conduct internal audit
- [ ] Address internal audit findings
- [ ] Establish evidence collection procedures

### 6 Months Before Audit

- [ ] Begin observation period
- [ ] Ensure all controls are operating
- [ ] Collect evidence systematically
- [ ] Conduct quarterly control testing

### 3 Months Before Audit

- [ ] Conduct readiness assessment
- [ ] Address any control deficiencies
- [ ] Organize evidence repository
- [ ] Prepare control narratives

### 1 Month Before Audit

- [ ] Select audit firm (if not already selected)
- [ ] Finalize evidence package
- [ ] Conduct management review
- [ ] Brief audit team

### During Audit

- [ ] Provide requested evidence promptly
- [ ] Respond to auditor questions
- [ ] Conduct daily debriefs
- [ ] Track open items

### After Audit

- [ ] Review draft report
- [ ] Address management responses
- [ ] Implement corrective actions
- [ ] Plan for continuous compliance

---

## Control Implementation

### Security Monitoring Controls

#### Control: Real-time Security Event Monitoring

**Description:** The organization monitors security events in real-time using a Security Information and Event Management (SIEM) system.

**Implementation:**
```javascript
// Security monitoring service
const { logSecurityEvent, triggerSecurityAlert } = require('./services/securityMonitoringService');

// Log security event
await logSecurityEvent({
  eventType: 'brute_force_attempt',
  severity: 'high',
  tenantId: req.tenant.id,
  userId: req.user.id,
  ipAddress: req.ip
}, db);

// Trigger alert if threshold exceeded
if (failedAttempts >= 5) {
  await triggerSecurityAlert({
    type: 'brute_force_attempt',
    severity: 'high',
    message: 'Brute force attack detected',
    userId: req.user.id
  }, db);
}
```

**Evidence:**
- SIEM configuration screenshots
- Sample security event logs
- Alert configuration
- Alert response records

**Testing Frequency:** Quarterly

**Test Procedure:**
1. Generate test security event
2. Verify event is logged in SIEM
3. Verify alert is triggered
4. Verify alert is received by security team
5. Document test results

#### Control: Incident Response Procedures

**Description:** The organization maintains documented incident response procedures and conducts regular drills.

**Implementation:**
- Incident Response Playbook (see INCIDENT_RESPONSE_PLAYBOOK.md)
- Incident response team roster
- Communication protocols
- Quarterly tabletop exercises

**Evidence:**
- Incident response playbook
- Incident response drill records
- Actual incident records
- Post-incident reports

**Testing Frequency:** Quarterly

**Test Procedure:**
1. Conduct tabletop exercise
2. Simulate security incident
3. Follow incident response procedures
4. Document actions taken
5. Conduct lessons learned session

### Access Control Implementation

#### Control: Multi-Factor Authentication

**Description:** All users with access to production systems must use multi-factor authentication.

**Implementation:**
```javascript
// MFA enforcement
const { verifyMFA } = require('./services/mfaService');

// Check if MFA is enabled
if (!user.mfa_enabled) {
  return res.status(403).json({
    error: 'MFA required',
    message: 'Multi-factor authentication is required for this account'
  });
}

// Verify MFA token
const isValid = await verifyMFA(user.id, mfaToken, db);
if (!isValid) {
  return res.status(401).json({
    error: 'Invalid MFA token'
  });
}
```

**Evidence:**
- MFA configuration policy
- User MFA enrollment records
- MFA authentication logs
- MFA bypass exception approvals

**Testing Frequency:** Quarterly

**Test Procedure:**
1. Select sample of users
2. Verify MFA is enabled
3. Attempt login without MFA
4. Verify access is denied
5. Document test results

### Change Management Implementation

#### Control: Change Approval Process

**Description:** All changes to production systems require approval before implementation.

**Implementation:**
- Change request template
- Approval workflow in Jira/ServiceNow
- Required approvals based on change type
- Change advisory board for high-risk changes

**Evidence:**
- Change management policy
- Change tickets with approvals
- Change advisory board meeting minutes
- Emergency change approvals

**Testing Frequency:** Quarterly

**Test Procedure:**
1. Select sample of changes
2. Verify change ticket exists
3. Verify required approvals obtained
4. Verify testing completed
5. Document test results

---

## Evidence Collection

### Evidence Repository Structure

```
/soc2-evidence/
├── policies/
│   ├── security-policy.pdf
│   ├── access-control-policy.pdf
│   ├── change-management-policy.pdf
│   └── incident-response-policy.pdf
├── procedures/
│   ├── incident-response-playbook.pdf
│   ├── backup-procedures.pdf
│   └── deployment-procedures.pdf
├── training/
│   ├── security-awareness-training.pdf
│   ├── training-completion-records.xlsx
│   └── phishing-simulation-results.pdf
├── access-controls/
│   ├── access-control-matrix.xlsx
│   ├── access-review-q1.pdf
│   ├── access-review-q2.pdf
│   ├── access-review-q3.pdf
│   └── access-review-q4.pdf
├── change-management/
│   ├── change-tickets-q1.pdf
│   ├── change-tickets-q2.pdf
│   ├── change-tickets-q3.pdf
│   └── change-tickets-q4.pdf
├── monitoring/
│   ├── siem-configuration.pdf
│   ├── security-events-q1.pdf
│   ├── security-events-q2.pdf
│   ├── security-events-q3.pdf
│   └── security-events-q4.pdf
├── incidents/
│   ├── incident-log.xlsx
│   ├── incident-reports/
│   └── drill-records/
├── vulnerability-management/
│   ├── vulnerability-scans-q1.pdf
│   ├── vulnerability-scans-q2.pdf
│   ├── vulnerability-scans-q3.pdf
│   ├── vulnerability-scans-q4.pdf
│   └── penetration-test-report.pdf
├── backups/
│   ├── backup-logs-q1.pdf
│   ├── backup-logs-q2.pdf
│   ├── backup-test-results-q1.pdf
│   └── backup-test-results-q2.pdf
└── availability/
    ├── uptime-reports-q1.pdf
    ├── uptime-reports-q2.pdf
    ├── uptime-reports-q3.pdf
    └── uptime-reports-q4.pdf
```

### Evidence Collection Automation

```javascript
// Automated evidence collection script
const { generateSecurityMetrics, exportForSIEM } = require('./services/securityMonitoringService');
const { exportAuditLogs } = require('./services/auditService');

async function collectQuarterlyEvidence(quarter, year) {
  const startDate = getQuarterStartDate(quarter, year);
  const endDate = getQuarterEndDate(quarter, year);
  
  // Security events
  const securityMetrics = await generateSecurityMetrics(
    'system',
    db,
    startDate,
    endDate
  );
  
  // Audit logs
  const auditLogs = await exportAuditLogs(
    'system',
    db,
    { startDate, endDate }
  );
  
  // Save to evidence repository
  await saveEvidence(`security-events-q${quarter}.json`, securityMetrics);
  await saveEvidence(`audit-logs-q${quarter}.json`, auditLogs);
  
  console.log(`Evidence collected for Q${quarter} ${year}`);
}
```

---

## Audit Readiness Checklist

### Pre-Audit Checklist

#### Policies and Procedures
- [ ] All policies reviewed and current (within last 12 months)
- [ ] All procedures documented and accessible
- [ ] Policy acknowledgments collected from all employees
- [ ] Policies communicated to relevant stakeholders

#### Access Controls
- [ ] Access reviews completed quarterly
- [ ] Terminated user access revoked promptly
- [ ] MFA enabled for all production access
- [ ] Privileged access properly controlled

#### Change Management
- [ ] All changes have tickets
- [ ] All changes have required approvals
- [ ] All changes have test results
- [ ] Emergency changes properly documented

#### Security Monitoring
- [ ] SIEM operational and monitored
- [ ] Security alerts configured
- [ ] Alert response procedures documented
- [ ] Security events logged and retained

#### Incident Response
- [ ] Incident response plan current
- [ ] Incident response team identified
- [ ] Incident response drills conducted
- [ ] Incidents properly documented

#### Vulnerability Management
- [ ] Vulnerability scans conducted quarterly
- [ ] Critical vulnerabilities remediated promptly
- [ ] Penetration test conducted annually
- [ ] Findings tracked to resolution

#### Backup and Recovery
- [ ] Backups performed regularly
- [ ] Backup tests conducted quarterly
- [ ] Disaster recovery plan current
- [ ] DR test conducted annually

#### Training
- [ ] Security awareness training completed by all employees
- [ ] Training records maintained
- [ ] Phishing simulations conducted
- [ ] Role-specific training provided

### During Audit Checklist

#### Day 1
- [ ] Kickoff meeting conducted
- [ ] Audit scope confirmed
- [ ] Evidence repository access provided
- [ ] Point of contact identified

#### Daily
- [ ] Respond to auditor requests promptly
- [ ] Track open items
- [ ] Conduct daily debrief
- [ ] Escalate issues as needed

#### Final Week
- [ ] Review draft findings
- [ ] Prepare management responses
- [ ] Provide additional evidence if needed
- [ ] Conduct exit meeting

---

## Common Audit Findings

### Finding: Incomplete Access Reviews

**Issue:** Access reviews not conducted quarterly or not properly documented.

**Remediation:**
1. Establish quarterly access review schedule
2. Create access review template
3. Assign responsibility for reviews
4. Document review results
5. Track and remediate findings

**Prevention:**
- Calendar reminders for reviews
- Automated access reports
- Management oversight

### Finding: Insufficient Change Documentation

**Issue:** Changes implemented without proper documentation or approval.

**Remediation:**
1. Enforce change management policy
2. Require tickets for all changes
3. Implement approval workflow
4. Conduct change management training
5. Monitor compliance

**Prevention:**
- Automated change detection
- Regular audits of changes
- Management reporting

### Finding: Inadequate Incident Response Testing

**Issue:** Incident response plan not tested regularly.

**Remediation:**
1. Schedule quarterly tabletop exercises
2. Conduct annual full-scale drill
3. Document test results
4. Update plan based on lessons learned
5. Train incident response team

**Prevention:**
- Calendar reminders for drills
- Incident response team roster
- Regular plan reviews

### Finding: Delayed Vulnerability Remediation

**Issue:** Critical vulnerabilities not remediated within SLA.

**Remediation:**
1. Establish vulnerability remediation SLAs
2. Prioritize critical vulnerabilities
3. Track vulnerabilities to closure
4. Escalate overdue items
5. Report to management

**Prevention:**
- Automated vulnerability tracking
- Regular vulnerability scans
- Management reporting

---

## Continuous Compliance

### Quarterly Activities

- [ ] Conduct access reviews
- [ ] Review and test backups
- [ ] Conduct vulnerability scans
- [ ] Test incident response procedures
- [ ] Review security events and alerts
- [ ] Collect evidence for audit

### Annual Activities

- [ ] Review and update all policies
- [ ] Conduct penetration testing
- [ ] Test disaster recovery plan
- [ ] Conduct risk assessment
- [ ] Review and update threat models
- [ ] Conduct SOC 2 audit

### Ongoing Activities

- [ ] Monitor security events 24/7
- [ ] Respond to security alerts
- [ ] Manage changes through formal process
- [ ] Conduct security awareness training
- [ ] Maintain audit logs
- [ ] Review and approve access requests

---

## Appendix

### A. SOC 2 Control Mapping

| Control ID | Control Name | EduOS Implementation |
|------------|--------------|---------------------|
| CC1.1 | Code of Conduct | Employee handbook, annual acknowledgment |
| CC1.2 | Background Checks | Pre-employment screening |
| CC1.3 | Security Training | Quarterly security awareness training |
| CC2.1 | Security Policies | Comprehensive security policy suite |
| CC2.2 | Incident Response | Incident response playbook |
| CC3.1 | Risk Assessment | Annual risk assessment |
| CC3.2 | Vulnerability Management | Quarterly scans, annual pen test |
| CC4.1 | Security Monitoring | SIEM, 24/7 monitoring |
| CC4.2 | Log Management | Centralized logging, retention policy |
| CC5.1 | Access Controls | RBAC, least privilege |
| CC5.2 | Change Management | Formal change approval process |
| CC5.3 | Data Protection | Encryption at rest and in transit |
| CC6.1 | Authentication | MFA, password policy |
| CC6.2 | Authorization | Role-based access control |
| CC7.1 | Capacity Management | Monitoring, planning |
| CC7.2 | Backup and Recovery | Regular backups, quarterly tests |
| CC8.1 | Change Control | Change request, approval, testing |
| CC9.1 | Business Continuity | BCP, annual testing |
| CC9.2 | Disaster Recovery | DR plan, annual testing |

### B. Useful Resources

- **AICPA SOC 2 Guide:** https://www.aicpa.org/soc2
- **Trust Services Criteria:** https://www.aicpa.org/trust-services-criteria
- **SOC 2 Academy:** https://www.soc2academy.com
- **Vanta SOC 2 Guide:** https://www.vanta.com/soc-2

### C. Audit Firm Selection Criteria

- Experience with SaaS companies
- Experience with educational technology
- Reasonable pricing
- Good communication
- Timely delivery
- Industry reputation

---

**Document Control:**
- **Version:** 1.0
- **Last Review:** 2026-02-07
- **Next Review:** 2027-02-07
- **Owner:** Compliance Team
- **Approver:** CISO, CFO
