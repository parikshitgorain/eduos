# Security Team Training Program

**Version:** 1.0  
**Last Updated:** 2026-02-07  
**Owner:** Security Team  
**Task:** 4.3.5 - Setup security monitoring and incident response

---

## Table of Contents

1. [Overview](#overview)
2. [Training Objectives](#training-objectives)
3. [Training Schedule](#training-schedule)
4. [Core Training Modules](#core-training-modules)
5. [Quarterly Drill Scenarios](#quarterly-drill-scenarios)
6. [Tabletop Exercise Guide](#tabletop-exercise-guide)
7. [Training Assessment](#training-assessment)
8. [Continuous Learning](#continuous-learning)

---

## Overview

### Purpose

This training program ensures that the security team and incident response personnel are prepared to effectively detect, respond to, and recover from security incidents. Regular training and drills maintain readiness and improve response capabilities.

### Scope

This program applies to:
- Security team members
- Incident response team members
- System administrators
- DevOps engineers
- On-call engineers
- Management stakeholders

### Training Philosophy

- **Hands-on Practice:** Learning by doing through simulations and drills
- **Continuous Improvement:** Regular updates based on lessons learned
- **Realistic Scenarios:** Training based on actual threats and incidents
- **Team Coordination:** Emphasis on communication and collaboration

---

## Training Objectives

### Knowledge Objectives

By completing this training program, participants will be able to:

1. **Identify** common security threats and attack patterns
2. **Understand** the incident response process and their role in it
3. **Recognize** indicators of compromise and security events
4. **Apply** security monitoring tools and techniques
5. **Execute** incident response procedures effectively
6. **Communicate** clearly during security incidents
7. **Document** incidents and evidence properly
8. **Analyze** incidents to identify root causes
9. **Implement** remediation and prevention measures
10. **Comply** with regulatory and compliance requirements

### Skill Objectives

Participants will develop skills in:

- Security event analysis
- Threat hunting
- Incident triage and prioritization
- Evidence collection and preservation
- System forensics
- Containment and eradication techniques
- Recovery procedures
- Post-incident analysis

### Behavioral Objectives

Participants will demonstrate:

- Calm and effective response under pressure
- Clear communication with team and stakeholders
- Adherence to documented procedures
- Proactive threat detection
- Continuous learning mindset
- Collaboration and teamwork

---

## Training Schedule

### Onboarding (New Team Members)

**Duration:** 2 weeks  
**Format:** Self-paced + instructor-led

#### Week 1: Foundations
- **Day 1-2:** Security fundamentals and threat landscape
- **Day 3-4:** EduOS architecture and security controls
- **Day 5:** Security monitoring tools and SIEM

#### Week 2: Incident Response
- **Day 1-2:** Incident response process and playbooks
- **Day 3:** Hands-on lab: Security event analysis
- **Day 4:** Hands-on lab: Incident response simulation
- **Day 5:** Assessment and certification

### Quarterly Training

**Duration:** 4 hours per quarter  
**Format:** Instructor-led + hands-on

#### Q1: Threat Detection and Analysis
- Latest threat intelligence
- Advanced SIEM queries
- Threat hunting techniques
- Hands-on lab: Detecting APT activity

#### Q2: Incident Response Procedures
- Incident response playbook review
- New tools and techniques
- Communication protocols
- Tabletop exercise: Data breach

#### Q3: Forensics and Evidence Collection
- Digital forensics fundamentals
- Evidence preservation
- Chain of custody
- Hands-on lab: Forensic analysis

#### Q4: Recovery and Lessons Learned
- Recovery procedures
- Business continuity
- Post-incident analysis
- Full-scale incident response drill

### Monthly Activities

**Duration:** 1 hour per month  
**Format:** Team meeting

- Security news and threat briefing
- Recent incident review
- Tool updates and new features
- Knowledge sharing session

### Annual Activities

**Duration:** 2 days  
**Format:** Workshop

- Comprehensive security training
- Advanced topics and certifications
- External expert presentations
- Full-scale disaster recovery drill

---

## Core Training Modules

### Module 1: Security Fundamentals

**Duration:** 4 hours  
**Prerequisites:** None

#### Learning Objectives
- Understand the CIA triad (Confidentiality, Integrity, Availability)
- Identify common attack vectors and techniques
- Recognize the MITRE ATT&CK framework
- Understand defense-in-depth strategy

#### Topics Covered
1. Information security principles
2. Threat landscape overview
3. Attack lifecycle (Kill Chain)
4. MITRE ATT&CK framework
5. Defense strategies

#### Hands-on Lab
- Analyze sample attacks using MITRE ATT&CK
- Map defenses to attack techniques

#### Assessment
- Multiple choice quiz (80% passing score)
- Practical exercise: Threat analysis

### Module 2: EduOS Security Architecture

**Duration:** 4 hours  
**Prerequisites:** Module 1

#### Learning Objectives
- Understand EduOS system architecture
- Identify security controls and their purpose
- Navigate security monitoring tools
- Access and interpret security logs

#### Topics Covered
1. EduOS architecture overview
2. Multi-tenancy and data isolation
3. Authentication and authorization
4. Encryption and data protection
5. Security monitoring infrastructure

#### Hands-on Lab
- Navigate EduOS security dashboards
- Query audit logs
- Review security events

#### Assessment
- Architecture diagram exercise
- Log analysis practical

### Module 3: Security Monitoring and SIEM

**Duration:** 6 hours  
**Prerequisites:** Module 2

#### Learning Objectives
- Operate SIEM effectively
- Create and tune detection rules
- Analyze security events
- Investigate alerts

#### Topics Covered
1. SIEM fundamentals
2. Log sources and data ingestion
3. Detection rule creation
4. Alert triage and investigation
5. Threat hunting techniques

#### Hands-on Lab
```bash
# Sample SIEM queries

# Failed login attempts
source="auth_logs" event_type="login_failed" 
| stats count by user_id, ip_address 
| where count > 5

# Privilege escalation
source="audit_logs" event_type="role_assigned" 
| where new_role="superadmin"
| table timestamp, user_id, changed_by, old_role, new_role

# Bulk data access
source="audit_logs" action="read" 
| stats count by user_id, resource_type 
| where count > 100

# After-hours access
source="audit_logs" 
| eval hour=strftime(_time, "%H")
| where hour < 6 OR hour > 22
| table timestamp, user_id, action, resource_type
```

#### Assessment
- Create 5 detection rules
- Investigate 3 sample alerts
- Write investigation report

### Module 4: Incident Response Process

**Duration:** 6 hours  
**Prerequisites:** Module 3

#### Learning Objectives
- Execute incident response procedures
- Perform incident triage
- Collect and preserve evidence
- Communicate effectively during incidents
- Document incidents properly

#### Topics Covered
1. Incident response lifecycle
2. Incident classification and severity
3. Evidence collection and preservation
4. Containment strategies
5. Communication protocols
6. Documentation requirements

#### Hands-on Lab
- Incident response simulation
- Evidence collection exercise
- Incident report writing

#### Assessment
- Incident response simulation (graded)
- Incident report review

### Module 5: Threat Hunting

**Duration:** 4 hours  
**Prerequisites:** Module 3

#### Learning Objectives
- Develop threat hunting hypotheses
- Use threat intelligence effectively
- Identify indicators of compromise
- Conduct proactive threat hunts

#### Topics Covered
1. Threat hunting methodology
2. Hypothesis development
3. Threat intelligence sources
4. IOC identification
5. Hunt documentation

#### Hands-on Lab
```sql
-- Sample threat hunting queries

-- Unusual outbound connections
SELECT 
  timestamp,
  source_ip,
  destination_ip,
  destination_port,
  bytes_transferred
FROM network_logs
WHERE destination_ip NOT IN (SELECT ip FROM known_services)
  AND bytes_transferred > 1000000
ORDER BY bytes_transferred DESC;

-- Suspicious process execution
SELECT 
  timestamp,
  user_id,
  process_name,
  command_line,
  parent_process
FROM process_logs
WHERE process_name IN ('powershell.exe', 'cmd.exe', 'bash')
  AND command_line LIKE '%base64%'
ORDER BY timestamp DESC;

-- Lateral movement indicators
SELECT 
  timestamp,
  source_user,
  source_host,
  destination_host,
  authentication_method
FROM auth_logs
WHERE authentication_method = 'pass-the-hash'
  OR authentication_method = 'pass-the-ticket'
ORDER BY timestamp DESC;
```

#### Assessment
- Conduct threat hunt exercise
- Present findings to team

### Module 6: Digital Forensics

**Duration:** 6 hours  
**Prerequisites:** Module 4

#### Learning Objectives
- Collect forensic evidence properly
- Maintain chain of custody
- Analyze system artifacts
- Reconstruct attack timeline

#### Topics Covered
1. Forensic principles
2. Evidence collection techniques
3. Memory forensics
4. Disk forensics
5. Network forensics
6. Timeline analysis

#### Hands-on Lab
```bash
# Memory dump analysis
volatility -f memory.dump imageinfo
volatility -f memory.dump pslist
volatility -f memory.dump netscan
volatility -f memory.dump malfind

# Disk forensics
autopsy disk.img

# Log analysis
grep "failed login" /var/log/auth.log | wc -l
awk '{print $1, $2, $3, $11}' /var/log/auth.log | sort | uniq -c
```

#### Assessment
- Forensic analysis practical
- Timeline reconstruction exercise

---

## Quarterly Drill Scenarios

### Q1 Drill: Brute Force Attack

**Scenario:** Multiple failed login attempts detected from various IP addresses targeting admin accounts.

**Objectives:**
- Detect brute force attack
- Identify affected accounts
- Implement containment measures
- Investigate attack source

**Duration:** 2 hours

**Participants:**
- Incident Commander
- Security Analyst
- Technical Lead
- Communications Lead

**Scenario Inject Timeline:**

| Time | Event |
|------|-------|
| T+0 | Alert: 50 failed login attempts in 5 minutes |
| T+15 | Alert: Failed attempts continue, now 200+ |
| T+30 | Alert: One account successfully compromised |
| T+45 | Alert: Compromised account accessing sensitive data |
| T+60 | Inject: Media inquiry about security breach |

**Expected Actions:**
1. Acknowledge alert and activate response team
2. Analyze failed login patterns
3. Block attacking IP addresses
4. Suspend compromised account
5. Reset credentials
6. Review data accessed
7. Prepare customer communication
8. Document incident

**Success Criteria:**
- [ ] Alert acknowledged within 5 minutes
- [ ] Response team activated within 15 minutes
- [ ] Attacking IPs blocked within 30 minutes
- [ ] Compromised account suspended within 45 minutes
- [ ] Incident documented properly

### Q2 Drill: Data Breach

**Scenario:** Unusual bulk data export detected. Investigation reveals unauthorized access to student records.

**Objectives:**
- Investigate data breach
- Determine scope of breach
- Contain and eradicate threat
- Notify affected parties
- Comply with regulations

**Duration:** 4 hours

**Participants:**
- Incident Commander
- Security Analyst
- Technical Lead
- Communications Lead
- Legal/Compliance Officer

**Scenario Inject Timeline:**

| Time | Event |
|------|-------|
| T+0 | Alert: Bulk export of 10,000 student records |
| T+30 | Finding: Export by compromised admin account |
| T+60 | Finding: Account compromised 3 days ago |
| T+90 | Finding: Data includes PII and academic records |
| T+120 | Inject: Regulatory authority inquiry |
| T+180 | Inject: Customer demands explanation |

**Expected Actions:**
1. Investigate bulk export alert
2. Identify compromised account
3. Determine data accessed
4. Assess breach timeline
5. Contain threat (suspend account, revoke access)
6. Notify affected institutions
7. Report to regulatory authorities
8. Prepare public statement
9. Implement additional controls

**Success Criteria:**
- [ ] Investigation initiated within 15 minutes
- [ ] Scope determined within 2 hours
- [ ] Threat contained within 3 hours
- [ ] Notifications sent within 72 hours (GDPR)
- [ ] Incident fully documented

### Q3 Drill: Ransomware Attack

**Scenario:** Ransomware detected encrypting files on production servers.

**Objectives:**
- Detect ransomware quickly
- Isolate infected systems
- Prevent spread
- Recover from backups
- Eradicate threat

**Duration:** 4 hours

**Participants:**
- Incident Commander
- Security Analyst
- Technical Lead
- Infrastructure Team
- Communications Lead

**Scenario Inject Timeline:**

| Time | Event |
|------|-------|
| T+0 | Alert: Unusual file modifications detected |
| T+15 | Alert: Ransomware note found on server |
| T+30 | Alert: Encryption spreading to other servers |
| T+60 | Inject: Backup server also affected |
| T+120 | Inject: Ransom demand received |
| T+180 | Inject: Media reports on attack |

**Expected Actions:**
1. Identify ransomware variant
2. Isolate infected systems immediately
3. Disconnect from network
4. Assess backup integrity
5. Determine infection vector
6. Eradicate ransomware
7. Restore from clean backups
8. Verify no persistence mechanisms
9. Strengthen defenses

**Success Criteria:**
- [ ] Ransomware identified within 15 minutes
- [ ] Systems isolated within 30 minutes
- [ ] Spread prevented
- [ ] Clean backups identified
- [ ] Recovery plan executed
- [ ] Systems restored within 8 hours

### Q4 Drill: Insider Threat

**Scenario:** Suspicious activity by privileged user suggests potential insider threat.

**Objectives:**
- Detect insider threat indicators
- Investigate without alerting suspect
- Collect evidence
- Coordinate with HR and Legal
- Mitigate threat

**Duration:** 3 hours

**Participants:**
- Incident Commander
- Security Analyst
- Technical Lead
- HR Representative
- Legal Counsel

**Scenario Inject Timeline:**

| Time | Event |
|------|-------|
| T+0 | Alert: After-hours access by admin user |
| T+30 | Finding: Bulk data download to USB drive |
| T+60 | Finding: Access to unrelated tenant data |
| T+90 | Finding: Attempts to delete audit logs |
| T+120 | Inject: User submits resignation |

**Expected Actions:**
1. Investigate suspicious activity discreetly
2. Review audit logs thoroughly
3. Assess data accessed
4. Consult with HR and Legal
5. Collect evidence
6. Monitor user activity
7. Prepare for account suspension
8. Execute suspension (with HR/Legal approval)
9. Secure physical access
10. Assess damage

**Success Criteria:**
- [ ] Investigation conducted discreetly
- [ ] Evidence properly collected
- [ ] HR and Legal consulted
- [ ] Coordinated response executed
- [ ] Damage assessed
- [ ] Incident documented

---

## Tabletop Exercise Guide

### Exercise Format

**Duration:** 2-3 hours  
**Frequency:** Quarterly  
**Participants:** 6-12 people

### Roles

- **Facilitator:** Guides the exercise, presents scenario
- **Incident Commander:** Leads response
- **Security Analyst:** Investigates technical details
- **Technical Lead:** Implements technical solutions
- **Communications Lead:** Handles communications
- **Observer:** Takes notes, evaluates performance

### Exercise Structure

#### 1. Introduction (15 minutes)
- Welcome and objectives
- Scenario overview
- Ground rules
- Role assignments

#### 2. Scenario Presentation (10 minutes)
- Initial incident description
- Available information
- Questions and clarifications

#### 3. Response Discussion (90 minutes)
- Participants discuss response actions
- Facilitator injects new information
- Team makes decisions
- Document actions and decisions

#### 4. Debrief (30 minutes)
- Review actions taken
- Discuss what went well
- Identify areas for improvement
- Capture lessons learned

#### 5. Action Items (15 minutes)
- Document improvement actions
- Assign owners and due dates
- Schedule follow-up

### Sample Scenario Template

```markdown
# Tabletop Exercise: [Scenario Name]

## Scenario Overview
[Brief description of the incident]

## Initial Information
- **Date/Time:** [When incident detected]
- **Detected By:** [How/who detected]
- **Initial Indicators:** [What was observed]
- **Affected Systems:** [Systems involved]

## Scenario Injects

### Inject 1 (T+15 minutes)
**Information:** [New information revealed]
**Questions:**
1. What actions do you take?
2. Who needs to be notified?
3. What additional information do you need?

### Inject 2 (T+30 minutes)
**Information:** [New information revealed]
**Questions:**
1. How does this change your response?
2. What are your priorities now?
3. What resources do you need?

[Continue with additional injects...]

## Discussion Questions
1. What went well in the response?
2. What could be improved?
3. What gaps were identified?
4. What actions should we take?

## Success Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
```

---

## Training Assessment

### Knowledge Assessment

**Format:** Multiple choice and short answer  
**Passing Score:** 80%  
**Retake Policy:** Unlimited retakes allowed

**Sample Questions:**

1. What are the phases of the incident response lifecycle?
2. What is the maximum time to notify users of a data breach under GDPR?
3. What is the purpose of a hash chain in audit logs?
4. What is the difference between containment and eradication?
5. What information should be included in an incident report?

### Practical Assessment

**Format:** Hands-on simulation  
**Passing Score:** 75%  
**Retake Policy:** One retake allowed

**Assessment Criteria:**
- Correct identification of security events
- Appropriate response actions
- Effective communication
- Proper documentation
- Adherence to procedures

### Drill Performance Evaluation

**Format:** Observer evaluation during drills  
**Evaluation Criteria:**

| Criterion | Weight | Score (1-5) |
|-----------|--------|-------------|
| Response Time | 20% | |
| Technical Accuracy | 25% | |
| Communication | 20% | |
| Teamwork | 15% | |
| Documentation | 20% | |

**Performance Levels:**
- **Excellent (4.5-5.0):** Exceeds expectations
- **Proficient (3.5-4.4):** Meets expectations
- **Developing (2.5-3.4):** Needs improvement
- **Unsatisfactory (<2.5):** Requires remediation

---

## Continuous Learning

### Recommended Certifications

- **CISSP** (Certified Information Systems Security Professional)
- **CISM** (Certified Information Security Manager)
- **CEH** (Certified Ethical Hacker)
- **GCIH** (GIAC Certified Incident Handler)
- **GCFA** (GIAC Certified Forensic Analyst)
- **OSCP** (Offensive Security Certified Professional)

### Learning Resources

#### Online Platforms
- **Cybrary:** Free security training courses
- **SANS Cyber Aces:** Free tutorials and challenges
- **TryHackMe:** Hands-on security training
- **HackTheBox:** Penetration testing labs
- **Coursera:** Security courses from universities

#### Books
- "The Practice of Network Security Monitoring" by Richard Bejtlich
- "Incident Response & Computer Forensics" by Jason Luttgens
- "Blue Team Handbook" by Don Murdoch
- "The Art of Memory Forensics" by Michael Hale Ligh

#### Conferences
- **RSA Conference:** Annual security conference
- **Black Hat:** Security research conference
- **DEF CON:** Hacker conference
- **BSides:** Community-driven security events

### Knowledge Sharing

#### Weekly Security Briefing
- Latest security news
- New vulnerabilities
- Threat intelligence updates
- Tool tips and tricks

#### Monthly Lunch & Learn
- Deep dive on security topic
- Guest speakers
- Tool demonstrations
- Case study discussions

#### Quarterly Knowledge Base Updates
- Document new procedures
- Update playbooks
- Share lessons learned
- Publish best practices

---

## Appendix

### A. Training Completion Tracker

| Employee | Module 1 | Module 2 | Module 3 | Module 4 | Module 5 | Module 6 | Q1 Drill | Q2 Drill | Q3 Drill | Q4 Drill |
|----------|----------|----------|----------|----------|----------|----------|----------|----------|----------|----------|
| [Name] | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### B. Drill Schedule

| Quarter | Drill Type | Date | Facilitator | Participants |
|---------|-----------|------|-------------|--------------|
| Q1 2026 | Brute Force | 2026-03-15 | [Name] | [Names] |
| Q2 2026 | Data Breach | 2026-06-15 | [Name] | [Names] |
| Q3 2026 | Ransomware | 2026-09-15 | [Name] | [Names] |
| Q4 2026 | Insider Threat | 2026-12-15 | [Name] | [Names] |

### C. Training Feedback Form

```markdown
# Training Feedback Form

**Training:** [Module/Drill Name]
**Date:** [Date]
**Instructor:** [Name]

## Content (1-5)
- Relevance: [ ]
- Clarity: [ ]
- Depth: [ ]

## Delivery (1-5)
- Instructor knowledge: [ ]
- Engagement: [ ]
- Pace: [ ]

## Materials (1-5)
- Quality: [ ]
- Usefulness: [ ]
- Completeness: [ ]

## Overall (1-5)
- Overall rating: [ ]

## Comments
[Your feedback here]

## Suggestions for Improvement
[Your suggestions here]
```

---

**Document Control:**
- **Version:** 1.0
- **Last Review:** 2026-02-07
- **Next Review:** 2026-08-07
- **Owner:** Security Team
- **Approver:** CISO
