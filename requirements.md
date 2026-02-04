# EduOS: Production-Grade System Specification (AI-Enabled)
**Version:** 4.1 (HACK2SKILL SUBMISSION BUILD)
**Status:** READY FOR JUDGING
**Scope:** Core Architecture, Domain Logic, AI Advisory Layer, Security, Operations.

---

## TABLE OF CONTENTS
1. [Module A: Core Architecture & Data Integrity](#module-a-core-architecture--data-integrity)
2. [Module B: Domain Logic & Educational Features](#module-b-domain-logic--educational-features)
3. [Module C: Financial & Operational Resilience](#module-c-financial--operational-resilience)
4. [Module D: Security, Compliance & Governance](#module-d-security-compliance--governance)
5. [Module E: Integration, Interfaces & User Experience](#module-e-integration-interfaces--user-experience)
6. [Module F: AI Governance & Ethical Intelligence](#module-f-ai-governance--ethical-intelligence)
7. [Appendix A: Engineering Mandates](#appendix-a-engineering-mandates)
8. [Appendix B: Visual Implementation Guide](#appendix-b-visual-implementation-guide)

---

## MODULE A: CORE ARCHITECTURE & DATA INTEGRITY

### 1. Schema Evolution and Data Migration Engine
**User Story:** As a system architect, I want bulletproof schema evolution with immutable snapshots, so that form changes never break historical data.

**Acceptance Criteria:**
1.  **Immutable Snapshots:** WHEN a form schema is modified, THE EduOS SHALL create an immutable snapshot with a SHA-256 hash and semantic version. Historical records MUST reference the snapshot ID used at the time of creation.
2.  **Inheritance Hierarchy:** THE EduOS SHALL enforce field visibility hierarchy: `Global → Institution → Center → Program → Class → Batch`. Child levels can only restrict (never expand) parent permissions.
3.  **Preview-as-Role:** THE EduOS SHALL provide functionality to preview schema changes as specific user roles before deployment.
4.  **Dry-Run Capability:** THE EduOS SHALL support dry-run modes for migrations, simulating changes on 1K-10K records to report potential conflicts.
5.  **Export/Import:** THE EduOS SHALL provide JSON export/import with full schema definitions for portability.
6.  **Historic Rendering Rule (FINAL):** Historical records MUST be rendered strictly using their immutable `schema_snapshot`. No automatic transformation to newer schemas is permitted for system views or legal/audit outputs. Any transformation is an explicit, admin-initiated, versioned export process that generates a new artifact.
7.  **Auto-Rollback:** Schema migration failures SHALL trigger automatic rollback within 30s (Enterprise) to 15min (Basic) with zero data loss.
8.  **Automated Testing:** Schema compatibility validation SHALL run an automated test suite covering field dependencies and validation rules with 95% coverage.
9.  **Archival:** The system SHALL maintain all historical versions with cryptographic integrity verification (Retention: 7 years Basic, 99 years Enterprise).

### 2. Canonical Student Identity and AI-Assisted Resolution
**User Story:** As a data integrity manager, I want to detect duplicate students—even those with spelling errors or different data entry formats—without accidentally merging distinct people.

**Acceptance Criteria:**
1.  **Unique Identity:** THE EduOS SHALL assign a Global UUID v4 with immutable creation timestamps for each student.
2.  **Hybrid Duplicate Detection (AI-Enhanced):**
    * **Deterministic Layer:** The system SHALL use standard fuzzy string matching (Levenshtein) for direct text comparisons.
    * **AI Advisory Layer:** The system SHALL employ a **Vector Embedding Model** (e.g., SBERT) to generate semantic embeddings. It SHALL flag "Semantic Duplicates" where vector similarity exceeds 0.85, capturing phonetic or contextual matches (e.g., "Robert" vs. "Bob").
    * **Consolidated Scoring:** The system SHALL present a "Likelihood Score" combining both deterministic and vector scores.
3.  **Human Sovereignty:** ALL merge operations, regardless of score, REQUIRE explicit human approval. Automatic merges are explicitly forbidden. The AI only suggests; the human decides.
4.  **Mandatory Approval:** Merge operations SHALL REQUIRE explicit admin approval including a "Merge Reason" and impact assessment.
5.  **Pre-Merge Snapshot:** A merge operation SHALL create a cryptographic snapshot of all source records *before* execution to allow reversal.
6.  **Reversibility:** The system SHALL support a `restore` operation to undo a merge within the tenant SLA window.
7.  **Conflict Precedence:** Canonical record data takes precedence over enrollment data; most recent timestamp wins for conflicting fields unless manually overridden.
8.  **Audit Trail:** All merge operations SHALL generate a `merge_id`, recording `merged_by`, `merged_at`, and bidirectional references.

### 3. Multi-Tenant Architecture with Data Isolation
**User Story:** As a platform operator, I want strict multi-tenant isolation so that institution data is never co-mingled.

**Acceptance Criteria:**
1.  **Isolation Strategy:** Data isolation SHALL be enforced at the database row-level (RLS) for Basic/Business tiers and via physical separation for Enterprise tiers.
2.  **Resource Quotas:** THE EduOS SHALL enforce hard limits on storage, API calls, and concurrent users per tenant to prevent "noisy neighbor" issues.
3.  **Deprovisioning:** Tenant deletion SHALL require multi-person approval, generate a cryptographic deletion certificate, and allow for a final data export.
4.  **Cross-Tenant Access:** Access across tenants SHALL require explicit, time-bound authorization tokens with full audit logging.
5.  **Compliance Configurations:** The system SHALL support tenant-specific compliance settings (e.g., GDPR vs. FERPA) without affecting other tenants.

### 26. Bulk Operations with Rollback Capability
**User Story:** As a data administrator, I want safe bulk operations with rollback capability, so that large-scale changes can be made safely.

**Acceptance Criteria:**
1.  **Dry-Run Mode:** All bulk imports/updates SHALL offer a dry-run mode providing an impact analysis report before execution.
2.  **Pre-Operation Snapshots:** The system SHALL create a restore point (snapshot) of affected data before any bulk operation.
3.  **Automatic Rollback:** If a bulk operation fails mid-process, the system SHALL automatically roll back to the pre-operation state.
4.  **Integrity Verification:** Post-operation checks SHALL verify referential integrity before marking the job as "Success."

---

## MODULE B: DOMAIN LOGIC & EDUCATIONAL FEATURES

### 4. Dynamic Form and Field Configuration Engine
**User Story:** As an institution admin, I want to configure fields with strict permissions and localization support.

**Acceptance Criteria:**
1.  **Field-Level RBAC:** Every field SHALL define `visible_to_roles` and `editable_by_roles`, enforced at the API/Server level (not just UI).
2.  **Consent Management:** Fields marked `consent_required` SHALL block access/storage until a valid, versioned consent record is linked to the user.
3.  **Retention Policies:** Fields SHALL support individual retention policies (e.g., "Delete medical info 1 year after graduation").
4.  **Validation:** Server-side validation rules SHALL be enforced with sub-5ms latency.
5.  **Audit:** Access to sensitive fields SHALL be logged with user context and cryptographic integrity.

### 5. Offline-First Attendance & AI Pattern Validation
**User Story:** As a teacher, I want attendance to be easy to mark offline, but secure against fraud or errors.

**Acceptance Criteria:**
1.  **Event Schema:** Offline events SHALL store: `{event_id, client_ts, device_id, user_id, data, idempotency_key}`.
2.  **Deterministic Conflict Resolution:** When syncing, if records conflict, the system SHALL use the "Earliest Client Timestamp" rule by default, while logging the conflict.
3.  **Idempotency:** The system SHALL use `event_id + device_id` to prevent duplicate attendance records if the sync button is pressed twice.
4.  **Timezone Normalization:** All timestamps SHALL be normalized to UTC server-side, while preserving the original `client_local_time` for audit.
5.  **AI Anomaly Detection:** Upon synchronization, the system SHALL run an **Isolation Forest** (or similar) algorithm to detect:
    * **Impossible Travel:** Distances between consecutive check-ins that imply unrealistic speed.
    * **Pattern Breaks:** Sudden unexplained absences for highly consistent students.
    * **Action:** The AI SHALL NOT auto-reject, but flag the record as `verification_required` for admin review.

### 20. User Lifecycle State Management
**User Story:** As a user administrator, I want to manage user states (active, suspended, deleted) safely.

**Acceptance Criteria:**
1.  **Explicit States:** Users SHALL have explicit states: `Active`, `Suspended`, `Archived`, `Soft-Deleted`.
2.  **Soft-Delete Only:** The system SHALL perform soft-deletes by default; hard deletes require specific policy approval.
3.  **Ownership Transfer:** When a user is deleted/archived, their assets (classes, docs) SHALL be transferrable to another user via a wizard.
4.  **Reactivation:** The system SHALL support restoration of soft-deleted users with approval workflows.

### 21. Academic Policy & Rule Engine
**User Story:** As an academic administrator, I want to configure rules that the system enforces automatically.

**Acceptance Criteria:**
1.  **Rule Configuration:** The system SHALL support rules such as "Minimum 75% attendance for exam eligibility" or "Grace marks up to 5%".
2.  **Real-Time Evaluation:** Eligibility rules SHALL be evaluated in real-time when data changes.
3.  **Overrides:** Manual overrides of system rules SHALL require an approval workflow and mandatory reason logging.
4.  **Prospective Application:** Policy changes SHALL apply prospectively by default, with an option for retroactive application requiring special approval.

### 24. Student Timeline & Academic Continuity
**User Story:** As an admin, I want a longitudinal view of a student's history across years and programs.

**Acceptance Criteria:**
1.  **Chronological Timeline:** The system SHALL maintain a unified timeline view including enrollments, assessments, transfers, and certificates.
2.  **Portability:** Student records SHALL be exportable in a standardized format (JSON-LD) for transfer between institutions.
3.  **Credential Verification:** Milestones (graduations) SHALL be cryptographically signed to allow third-party verification.
4.  **Data Lineage:** The timeline SHALL allow drilling down into the source of every grade or attendance mark.

### 28. Accessibility & Generative Assist
**User Story:** As a user with disabilities, I want the platform to adapt content to my needs automatically.

**Acceptance Criteria:**
1.  **WCAG Compliance:** All interfaces SHALL comply with WCAG 2.1 AA standards.
2.  **Assistive Tech:** The system SHALL support screen readers (NVDA, VoiceOver) and keyboard-only navigation.
3.  **Generative Alt-Text:** WHEN an image is uploaded without description, the system SHALL use a **Vision-Language Model (VLM)** to automatically generate a descriptive caption. This caption SHALL be tagged `source: ai-generated`.
4.  **Content Simplification:** The system SHALL provide a "Simplify Text" feature using an **LLM** to rewrite complex academic language into "Easy Read" formats for students with cognitive differences.
5.  **Persistence:** Accessibility preferences SHALL be persisted across sessions.

### 31. Scheduling & AI Optimization Engine
**User Story:** As a scheduler, I want to create complex timetables without conflicts, using AI to solve the puzzle.

**Acceptance Criteria:**
1.  **Conflict Detection:** The system SHALL detect hard conflicts (Rooms, Teachers, Batches) immediately upon assignment.
2.  **AI-Assisted Optimization:** The system SHALL provide an "Auto-Schedule" function using **Constraint Satisfaction Optimization (CSP)** or **Genetic Algorithms**.
    * **Goal:** Optimize room utilization and minimize teacher gaps.
    * **Output:** The AI SHALL propose 3 valid schedule options. The Admin MUST explicitly "Publish" one; the AI cannot publish automatically.
3.  **Change Propagation:** Schedule changes SHALL automatically notify all affected stakeholders.
4.  **Exceptions:** The system SHALL support temporary schedule overrides (e.g., "Substitute Teacher for one day") without breaking the recurring pattern.

### 34. Predictive Academic Risk Engine (NEW)
**User Story:** As a counselor, I want early warning signals for students at risk of dropout so I can intervene early.

**Acceptance Criteria:**
1.  **Risk Scoring:** The system SHALL compute a nightly "Engagement Risk Score" (0-100) for every active student using a predictive model (e.g., Logistic Regression or XGBoost).
2.  **Feature Drivers:** The model SHALL weigh factors including: Attendance trends, Assignment submission latency, and LMS login frequency.
3.  **Privacy:** These scores SHALL be visible **ONLY** to authorized staff (Teachers/Counselors), never to students.
4.  **Explainability:** High-risk flags (>75) MUST include a natural language explanation (e.g., "Risk elevated due to 3 missed assignments this week").
5.  **Intervention Logging:** The system SHALL allow advisors to log interventions against these flags to provide feedback for model retraining.

---

## MODULE C: FINANCIAL & OPERATIONAL RESILIENCE

### 6. Payment Processing and Financial Management
**User Story:** As a financial controller, I want bulletproof payment processing with guaranteed idempotency.

**Acceptance Criteria:**
1.  **Idempotency:** Webhooks SHALL be processed using `webhook_id + tenant_id` to prevent duplicate payments.
2.  **Invoice Sequencing:** Invoices SHALL use tenant-unique sequential numbering with gap detection.
3.  **Reconciliation:** The system SHALL provide a UI for reconciling bank statements against system records.
4.  **Discrepancy Alerts:** Payment discrepancies SHALL trigger alerts within guaranteed timeframes (1-15 min depending on tier).
5.  **Refund Workflow:** Refunds SHALL require an approval workflow and generate a linked Credit Note.

### 11. Performance and Scalability (Tiered)
**User Story:** As a platform operator, I want realistic performance guarantees tied to infrastructure.

**Acceptance Criteria:**
1.  **Latency:** Response times SHALL be sub-500ms (Basic), sub-200ms (Business), or sub-100ms (Enterprise) for 95% of requests.
2.  **Graceful Degradation:** When capacity is exceeded, the system SHALL degrade gracefully (e.g., Read-Only mode) rather than crashing.
3.  **Connection Pooling:** The system SHALL implement connection pooling appropriate for the tier (100-2000 connections).
4.  **Root Cause Analysis:** SLO breaches SHALL trigger automated RCA generation with infrastructure metrics.

### 12. Disaster Recovery and Business Continuity
**User Story:** As a business continuity manager, I want to know exactly how fast we can recover from failure.

**Acceptance Criteria:**
1.  **RTO/RPO:**
    * **Basic:** RTO 4h / RPO 1h (Daily backups).
    * **Business:** RTO 1h / RPO 15min (Hourly backups + Secondary Region).
    * **Enterprise:** RTO 15min / RPO 5min (Real-time replication).
2.  **Failover:** The system SHALL support automated failover for Business/Enterprise tiers.
3.  **DR Testing Cadence (FINAL):**
    * **Basic:** Annual tabletop + quarterly restore test.
    * **Business:** Quarterly partial failover test.
    * **Enterprise:** Quarterly full failover test.
4.  **Granular Restore:** The system SHALL support Point-in-Time Recovery (PITR) for Enterprise tenants.

### 15. Resource Management and Rate Limiting
**User Story:** As an operator, I want to prevent abuse and ensure fair resource allocation.

**Acceptance Criteria:**
1.  **Quotas:** The system SHALL enforce strict quotas on Storage, API Calls, and DB Connections.
2.  **Rate Limiting:** API requests SHALL be rate-limited per tenant and per user with configurable bursts.
3.  **Monitoring:** Real-time tracking of resource usage SHALL alert tenants when approaching limits.
4.  **Degradation:** Resource exhaustion SHALL result in clear error messages (HTTP 429), not system timeouts.

### 23. Graceful Degradation & Failure Mode Handling
**User Story:** As a user, I want the system to remain partially usable even if some services fail.

**Acceptance Criteria:**
1.  **Queueing:** If the Payment Gateway fails, requests SHALL be queued for retry; manual recording options must be available.
2.  **Offline Fallback:** If Attendance Sync fails, data SHALL be stored locally until connectivity restores.
3.  **Notification Redundancy:** If Push Notifications fail, the system SHALL fallback to Email or SMS.
4.  **Read-Only Mode:** If the Primary DB is overloaded, the system SHALL switch to Read-Only mode using Read Replicas.

---

## MODULE D: SECURITY, COMPLIANCE & GOVERNANCE

### 13. Audit and Compliance
**User Story:** As a compliance officer, I want tamper-evident logs to satisfy legal requirements.

**Acceptance Criteria:**
1.  **Tamper-Evidence:** Audit logs SHALL use cryptographic hashing (SHA-256) to detect modification.
2.  **Export:** Audit exports SHALL be digitally signed.
3.  **Retention:** Audit logs SHALL be retained for 7 years (Basic) to 99 years (Enterprise).
4.  **Legal Hold:** The system SHALL support "Legal Hold" status to prevent deletion of data during litigation.
5.  **Cryptography Scope:**
    * **Hashing:** Used for data integrity verification (e.g., SHA-256).
    * **Signing:** Used for sender verification and non-repudiation.
    * **HSM:** Hardware Security Modules are optional for Enterprise tiers only.

### 14. Security and Access Control
**User Story:** As a security officer, I want comprehensive access controls and threat detection.

**Acceptance Criteria:**
1.  **Authentication:** The system SHALL support MFA, SSO (SAML/OIDC), and adaptive authentication.
2.  **Encryption:** Data SHALL be encrypted at rest (AES-256) and in transit (TLS 1.3).
3.  **Threat Detection:** The system SHALL provide real-time anomaly detection (e.g., impossible travel, brute force).
4.  **Vulnerability Scans:** Automated security scanning SHALL be performed regularly.

### 16. Data Retention and Lifecycle Management
**User Story:** As a data governance officer, I want data to be deleted automatically when no longer needed.

**Acceptance Criteria:**
1.  **Policy Engine:** The system SHALL support configurable retention policies based on data type (e.g., "Student Data", "Financial Records").
2.  **Automated Transition:** Data SHALL automatically move from Active → Archived → Deleted based on policy.
3.  **Secure Deletion:** Deletion SHALL be cryptographically verified.
4.  **Minimization:** The system SHALL identify and remove unnecessary data automatically.

### 18. Data Privacy and Consent Management
**User Story:** As a privacy officer, I want to manage user consent granularly.

**Acceptance Criteria:**
1.  **Granular Consent:** The system SHALL capture explicit consent for specific data usage purposes.
2.  **Withdrawal:** If consent is withdrawn, the system SHALL stop processing affected data immediately (within 72h).
3.  **Subject Rights:** The system SHALL support automated Data Subject Access Requests (DSAR) and "Right to be Forgotten."
4.  **Minors:** Enhanced protections and parental consent flows SHALL be enforced for users under the age of majority.

### 19. Configuration Governance & Approval System
**User Story:** As an admin, I want critical configuration changes to require approval.

**Acceptance Criteria:**
1.  **Lifecycle:** Config changes SHALL follow a `Draft → Review → Approve → Publish` workflow.
2.  **Impact Analysis:** The system SHALL display an impact summary (e.g., "This change affects 500 students") before approval.
3.  **Rollback:** Configuration changes SHALL be versioned and automatically reversible.
4.  **Emergency Override:** Emergency changes SHALL be possible but require dual-approval and immediate post-incident review.

### 22. Human-Readable Decision Explanations
**User Story:** As a user, I want to understand why the system made a specific decision.

**Acceptance Criteria:**
1.  **Explanation Generation:** The system SHALL generate plain-language explanations for automated decisions (e.g., "Student marked absent because...").
2.  **Evidence:** Explanations SHALL reference specific rules and data points used.
3.  **Export:** Explanations SHALL be exportable as PDF for official communication.

### 25. SuperAdmin Impersonation and Privileged Access
**User Story:** As an auditor, I want strict controls on SuperAdmins accessing tenant data.

**Acceptance Criteria:**
1.  **Justification:** Impersonation SHALL require a written justification and second-party approval.
2.  **Time-Limited:** Sessions SHALL be time-limited (max 4 hours).
3.  **Audit:** All actions taken during impersonation SHALL be logged with the context of the original admin user.

---

## MODULE E: INTEGRATION, INTERFACES & USER EXPERIENCE

### 7. Assessment and Examination System
**User Story:** As an academic coordinator, I want secure and flexible assessment tools.

**Acceptance Criteria:**
1.  **Integrity:** Assessments SHALL support browser lockdown and time limits.
2.  **Immutable Grades:** Grade records SHALL be cryptographically signed and immutable once finalized.
3.  **Grade Appeals:** An appeal approval creates a new signed version of the grade record; the original grade remains preserved in the audit history.
4.  **Question Banks:** The system SHALL support versioned question banks with usage analytics.
5.  **Appeals Workflow:** A structured workflow for grade appeals SHALL be provided.

### 8. Communication and Engagement Platform
**User Story:** As a coordinator, I want to communicate effectively with stakeholders.

**Acceptance Criteria:**
1.  **Multi-Channel:** Support for Email, SMS, Push, and In-App messaging.
2.  **Templates:** Versioned templates with personalization variables.
3.  **Compliance:** Automatic handling of Opt-Outs (CAN-SPAM/GDPR) and "Do Not Disturb" windows.
4.  **Analytics:** Tracking of delivery, open rates, and engagement.

### 9. Analytics and Reporting System
**User Story:** As an analyst, I want accurate reports with data lineage.

**Acceptance Criteria:**
1.  **Freshness:** Real-time or near real-time analytics with freshness indicators.
2.  **Custom Reports:** Drag-and-drop report builder with SQL options for power users.
3.  **Security:** Reports SHALL enforce Row-Level Security (RLS) automatically.
4.  **Export:** Support for PDF, Excel, and CSV exports.

### 10. API and Integration Framework
**User Story:** As a developer, I want a secure and well-documented API.

**Acceptance Criteria:**
1.  **OpenAPI:** All APIs SHALL be documented via OpenAPI 3.0 specs.
2.  **Versioning:** APIs SHALL support versioning with a minimum 24-month deprecation policy.
3.  **Security:** APIs SHALL use OAuth 2.0 and enforce request signing.
4.  **Webhooks:** Webhooks SHALL be signed (HMAC-SHA256) and support retries.

### 17. Monitoring and Observability
**User Story:** As an admin, I want to know the system health at a glance.

**Acceptance Criteria:**
1.  **Metrics:** Collection of Infrastructure (CPU/RAM) and Application (Response Time/Error Rate) metrics.
2.  **Tracing:** Distributed tracing for all requests.
3.  **Logging:** Centralized, structured logging.
4.  **Alerting:** Intelligent alerting with escalation policies.

### 27. Workflow Engine with Sandbox Testing
**User Story:** As a process admin, I want to test workflows before they go live.

**Acceptance Criteria:**
1.  **Sandbox:** A dedicated environment for testing workflow changes with dummy data.
2.  **A/B Testing:** Support for rolling out workflows to a percentage of users.
3.  **Blue/Green:** Support for Blue/Green deployment of workflow definitions.

### 29. Secure Media Pipeline & Storage Lifecycle
**User Story:** As a content admin, I want to store media securely and cost-effectively.

**Acceptance Criteria:**
1.  **Malware Scan:** All uploads SHALL be scanned for malware before storage.
2.  **Tiered Storage:** Media SHALL move to cheaper storage tiers (Hot -> Warm -> Cold) based on age.
3.  **Access Control:** Media access SHALL be via time-limited, signed URLs.

### 30. Guardian & Family Relationship Management
**User Story:** As a record keeper, I need to model complex family structures.

**Acceptance Criteria:**
1.  **Many-to-Many:** Support for multiple guardians per student and multiple students per guardian.
2.  **Custody Flags:** Flags to restrict access based on legal custody arrangements.
3.  **Emergency Contacts:** Prioritized list of contacts with relationship context.

### 32. LTI 1.3 Integration & OneRoster Export
**User Story:** As an integrator, I want standard interoperability.

**Acceptance Criteria:**
1.  **LTI 1.3:** Full support for LTI launch, deep linking, and grade passback.
2.  **OneRoster:** Support for OneRoster v1.1 CSV/JSON export.
3.  **Sync:** Mechanism to synchronize data with external LMS/SIS.

### 33. Notification Fallback & Communication Resilience
**User Story:** As an admin, I need to ensure critical alerts are delivered.

**Acceptance Criteria:**
1.  **Fallback Logic:** If Primary channel fails, auto-retry via Secondary (e.g., Push -> SMS -> Email).
2.  **Priority:** Critical alerts (Safety) SHALL override user preferences.
3.  **Retry:** Exponential backoff for failed delivery attempts.
4.  **Audit:** Complete log of delivery attempts and final status.

---

## MODULE F: AI GOVERNANCE & ETHICAL INTELLIGENCE

### 35. AI Governance, Explainability & Fairness
**User Story:** As a Data Protection Officer, I want to ensure AI decisions are transparent, fair, and auditable.

**Acceptance Criteria:**
1.  **HITL Guarantee:** NO AI algorithm is permitted to execute a "Write" operation on critical entities (Identity, Grade, Attendance) without a human approval token.
2.  **Explainability:** All AI outputs (Risk Scores, Match Confidence) MUST be accompanied by "Reason Codes" (e.g., SHAP values) explaining *why* the result was generated.
3.  **Bias Monitoring:** The system SHALL include a "Fairness Dashboard" that tracks AI accuracy rates across different demographics to detect algorithmic bias.
4.  **Kill Switch:** The SuperAdmin SHALL possess a global "AI Kill Switch" to instantly disable all inference services and revert the platform to purely deterministic logic.

### 36. AI Model Lifecycle & Data Boundaries (NEW)
**User Story:** As a system operator, I want to ensure AI models remain accurate and secure over time without leaking data.

**Acceptance Criteria:**
1.  **Versioning:** All AI models SHALL be versioned (e.g., `risk-model-v2.1`) with a transparent change log of training data ranges.
2.  **Validation:** Updates to models SHALL require validation on a holdout dataset before promotion to production.
3.  **Rollback:** The system SHALL support immediate rollback to a previous model version if performance degrades.
4.  **Data Boundary:** AI models SHALL ONLY consume structured, system-approved data. No external or user-generated free-text SHALL be used for decision models without explicit user consent.

---

## APPENDIX A: ENGINEERING MANDATES

### Migration Safety Rules
1.  All migrations **MUST** be backward compatible for at least one release window ("Expand then Contract").
2.  Production migrations require: Dev test → Staging run → Dry-run on 1% Prod data → Blue/Green deployment.
3.  A rollback script is **MANDATORY** for every migration.

### Infrastructure & SLO Mapping
| Tier | SLO (Availability) | RPO | Infra Requirement |
| :--- | :--- | :--- | :--- |
| **Basic** | 99.5% | 1h | Single Region, 2 AZs, Daily Backups |
| **Business** | 99.9% | 15m | Multi-AZ, Read Replicas, Hourly Backups |
| **Enterprise** | 99.95% | 5m | Multi-Region, Real-time Replication |


### Webhook Standards
* **Header:** `X-EduOS-Idempotency: <txn_id>`
* **Signature:** `X-Signature: HMAC-SHA256(<secret>, payload)`
* **Behavior:** Replaying a payload + signature **MUST** return `200 OK` (idempotent) and **MUST NOT** create duplicate records.

---

## APPENDIX B: VISUAL IMPLEMENTATION GUIDE

### 1. Schema Evolution & Immutable Snapshots
This diagram visualizes the relationship between the *Student Record*, the *Form Definition*, and the immutable *Schema Snapshot*.



### 2. Offline Sync & Conflict Resolution
This diagram demonstrates the "Earliest Client Timestamp" rule. It shows two scenarios: one where a sync succeeds, and one where a conflict is detected.



### 3. Payment Idempotency & Webhook Flow
This sequence diagram details the defense against double-billing. It illustrates the `webhook_id` check and HMAC signature verification.



### 4. AI Advisory Logic Flow
This diagram illustrates the "Human-in-the-Loop" architecture. It shows how AI models (Risk, Identity, Attendance) feed into an "Advisory Bus," which tags records for human review, rather than modifying the database directly.