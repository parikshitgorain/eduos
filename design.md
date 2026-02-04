# EduOS Platform: Technical Design Document

**Version:** 1.0  
**Status:** In Progress  
**Last Updated:** 2026-02-04

---

## Document Structure

This design document will be built section-by-section to ensure alignment with the requirements.md specification. Each section will detail the technical implementation approach for the corresponding requirement modules.

---

## Sections to be Completed

1. **Architecture Overview** - System architecture, technology stack, and design principles
2. **Module A: Core Architecture & Data Integrity** - Schema evolution, identity management, multi-tenancy
3. **Module B: Domain Logic & Educational Features** - Forms, attendance, user lifecycle, academic policies
4. **Module C: Financial & Operational Resilience** - Payments, performance, disaster recovery
5. **Module D: Security, Compliance & Governance** - Audit, security, privacy, access control
6. **Module E: Integration, Interfaces & User Experience** - APIs, assessments, communications, analytics
7. **Module F: AI Governance & Ethical Intelligence** - AI models, governance, explainability
8. **Data Models** - Database schemas and entity relationships
9. **API Specifications** - Endpoint definitions and contracts
10. **Deployment Architecture** - Infrastructure and deployment strategies
11. **Testing Strategy** - Unit, integration, and property-based testing approach
12. **Correctness Properties** - Formal specifications for property-based testing

---

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

EduOS employs a **Hybrid Architecture** that explicitly separates concerns between deterministic transactional systems and probabilistic advisory systems:

#### System of Record (Deterministic Layer)
- **Purpose:** Authoritative source of truth for all institutional data
- **Characteristics:** ACID-compliant, transactional, auditable, immutable where required
- **Technology:** Node.js or Go
- **Responsibilities:**
  - Student identity and enrollment management
  - Schema evolution and form definitions
  - Attendance records and academic data
  - Financial transactions and payment processing
  - Authentication and authorization
  - Audit logging and compliance

#### System of Intelligence (Probabilistic Layer)
- **Purpose:** Advisory and analytical capabilities that augment human decision-making
- **Characteristics:** ML-based, non-authoritative, human-in-the-loop
- **Technology:** Python (FastAPI)
- **Responsibilities:**
  - Duplicate student detection (semantic embeddings)
  - Attendance anomaly detection (Isolation Forest)
  - Academic risk prediction (XGBoost/Logistic Regression)
  - Schedule optimization (CSP/Genetic Algorithms)
  - Accessibility features (VLM for alt-text, LLM for simplification)

**Critical Governance Rule:** The AI layer operates in **advisory mode only**. It CANNOT execute write operations to the System of Record without explicit human approval tokens. All AI outputs are tagged with confidence scores and explainability metadata.

### 1.2 Microservices Architecture

EduOS is decomposed into 7 core microservices, each with bounded contexts and clear ownership:

#### 1. Auth Service
- **Responsibility:** Authentication, authorization, session management
- **Key Features:**
  - Multi-factor authentication (MFA)
  - SSO integration (SAML 2.0, OIDC)
  - Role-Based Access Control (RBAC) with field-level permissions
  - Tenant isolation enforcement
  - Impersonation audit trails
- **Data Store:** PostgreSQL (users, roles, permissions, sessions)
- **Cache:** Redis (session tokens, permission cache)

#### 2. Core Service (Identity & School Hierarchy)
- **Responsibility:** Canonical student identity, institutional hierarchy management
- **Key Features:**
  - UUID v4 student identity with immutable timestamps
  - Hybrid duplicate detection (deterministic + AI advisory)
  - Merge operations with cryptographic snapshots
  - Multi-tenant data isolation (RLS)
  - Hierarchy management (Institution → Center → Program → Class → Batch)
- **Data Store:** PostgreSQL with Row-Level Security (RLS)
- **Cache:** Redis (hierarchy lookups)

#### 3. Forms Service (Schema Engine)
- **Responsibility:** Dynamic form configuration, schema evolution, field-level RBAC
- **Key Features:**
  - Immutable schema snapshots (SHA-256 hashed, semantic versioned)
  - Field visibility inheritance hierarchy
  - Dry-run migration simulation
  - Preview-as-role functionality
  - Consent management and retention policies
- **Data Store:** PostgreSQL (schemas, snapshots, field definitions)
- **Cache:** Redis (active schema cache, validation rules)

#### 4. Attendance Service
- **Responsibility:** Offline-first attendance tracking with sync and anomaly detection
- **Key Features:**
  - Offline event storage with idempotency keys
  - Conflict resolution (earliest client timestamp rule)
  - Timezone normalization (UTC server-side)
  - AI anomaly detection integration (impossible travel, pattern breaks)
- **Data Store:** PostgreSQL (attendance records, sync logs)
- **Cache:** Redis (pending sync queue)
- **Mobile:** SQLite (offline storage)

#### 5. Payments Service
- **Responsibility:** Financial transactions, invoicing, reconciliation
- **Key Features:**
  - Idempotent webhook processing (webhook_id + tenant_id)
  - Sequential invoice numbering with gap detection
  - Refund workflows with approval chains
  - Bank reconciliation UI
  - **Currency:** Indian Rupee (₹ INR) - All financial transactions
- **Data Store:** PostgreSQL (transactions, invoices, reconciliation records)
- **Cache:** Redis (webhook deduplication)

#### 6. Analytics Service
- **Responsibility:** Reporting, dashboards, data lineage
- **Key Features:**
  - Real-time analytics with freshness indicators
  - Custom report builder (drag-and-drop + SQL)
  - Row-Level Security (RLS) enforcement
  - Export to PDF, Excel, CSV
- **Data Store:** PostgreSQL Read Replicas (query isolation)
- **Cache:** Redis (report cache, aggregation results)

#### 7. Integration Service
- **Responsibility:** External system integration, webhooks, API gateway
- **Key Features:**
  - OpenAPI 3.0 documentation
  - OAuth 2.0 authentication
  - Webhook signing (HMAC-SHA256)
  - LTI 1.3 and OneRoster support
  - Rate limiting and quota enforcement
- **Data Store:** PostgreSQL (integration configs, webhook logs)
- **Cache:** Redis (rate limit counters, API quotas)

### 1.3 Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Core Backend** | Node.js or Go | High-performance, async I/O for transactional workloads. Go preferred for CPU-intensive operations (schema validation, cryptographic operations). |
| **AI Inference Layer** | Python (FastAPI) | Industry-standard ML ecosystem (scikit-learn, XGBoost, sentence-transformers). FastAPI provides async support and OpenAPI integration. **Isolated from System of Record.** |
| **Primary Database** | PostgreSQL 14+ | ACID compliance, Row-Level Security (RLS) for multi-tenancy, JSONB for flexible schema storage, Point-in-Time Recovery (PITR). |
| **Caching Layer** | Redis 7+ | In-memory performance for schema snapshots, session storage, rate limiting, and webhook deduplication. |
| **Message Queue** | RabbitMQ or AWS SQS | Asynchronous job processing (bulk operations, email notifications, AI inference requests). |
| **Object Storage** | S3-compatible (AWS S3, MinIO) | Media storage with lifecycle policies (Hot → Warm → Cold). Signed URLs for access control. |
| **Search Engine** | Elasticsearch (optional) | Full-text search for student records, documents, and audit logs. |
| **Orchestration** | Kubernetes (K8s) | Container orchestration, auto-scaling, rolling deployments, health checks. |
| **Containerization** | Docker | Consistent deployment artifacts across environments. |
| **API Gateway** | Kong or AWS API Gateway | Rate limiting, request signing, OAuth 2.0 enforcement, API versioning. |
| **Monitoring** | Prometheus + Grafana | Metrics collection, alerting, SLO tracking. |
| **Logging** | ELK Stack (Elasticsearch, Logstash, Kibana) | Centralized structured logging with tamper-evident audit trails. |
| **Tracing** | Jaeger or AWS X-Ray | Distributed tracing for request flow analysis and performance debugging. |
| **CI/CD** | GitHub Actions or GitLab CI | Automated testing, security scanning, blue/green deployments. |
| **Mobile Offline Storage** | SQLite | Local-first architecture for attendance and form data entry. |

**System-Wide Configuration:**
- **Currency:** Indian Rupee (₹ INR) - All financial transactions, invoices, and payments
- **Locale:** Multi-language support for Indian languages (English, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi)
- **Timezone:** UTC for server-side storage; client timezone preserved for audit
- **Number Format:** Supports Western (0-9) and Indian script numerals (Devanagari, Bengali, Tamil, etc.)
- **Date Format:** DD/MM/YYYY (Indian standard)
- **Number System:** Indian numbering system (lakhs, crores) in addition to international system

### 1.4 Design Principles

#### 1.4.1 Governance-First AI
- **Human-in-the-Loop (HITL):** No AI algorithm may execute write operations on critical entities (Identity, Grade, Attendance) without an explicit human approval token.
- **Advisory Mode:** AI outputs are presented as suggestions with confidence scores and explainability metadata (SHAP values, reason codes).
- **Kill Switch:** SuperAdmins possess a global "AI Kill Switch" to instantly disable all inference services and revert to deterministic logic.
- **Bias Monitoring:** Fairness Dashboard tracks AI accuracy across demographics to detect algorithmic bias.

#### 1.4.2 Idempotency Everywhere
- **State-Changing APIs:** All POST, PUT, PATCH, DELETE operations MUST accept an `Idempotency-Key` header.
- **Webhook Processing:** Webhooks use `webhook_id + tenant_id` to prevent duplicate processing.
- **Attendance Sync:** Offline events use `event_id + device_id` to prevent duplicate records.
- **Payment Processing:** Transaction IDs are globally unique and immutable.

#### 1.4.3 Offline-First Mobile Architecture
- **Local Storage:** Mobile apps use SQLite for offline data entry (attendance, forms).
- **Sync Engine:** Bidirectional sync with conflict resolution (earliest client timestamp rule).
- **Idempotent Sync:** Sync operations are idempotent; pressing "Sync" multiple times does not create duplicates.
- **Timezone Handling:** Client timestamps preserved for audit; server normalizes to UTC.

#### 1.4.4 Immutability for Auditability
- **Schema Snapshots:** Form schemas are immutable once created; changes create new versioned snapshots.
- **Grade Records:** Finalized grades are cryptographically signed and immutable; appeals create new versions.
- **Audit Logs:** Tamper-evident logs use SHA-256 hashing; exports are digitally signed.
- **Merge Operations:** Pre-merge cryptographic snapshots enable reversibility.

#### 1.4.5 Multi-Tenancy Isolation
- **Row-Level Security (RLS):** PostgreSQL RLS enforces tenant isolation at the database level.
- **Physical Separation (Enterprise):** Enterprise tier uses dedicated database instances.
- **Resource Quotas:** Hard limits on storage, API calls, and concurrent users per tenant.
- **Cross-Tenant Access:** Requires explicit, time-bound authorization tokens with full audit logging.

#### 1.4.6 Graceful Degradation
- **Read-Only Mode:** If primary DB is overloaded, switch to read replicas.
- **Queue-Based Fallback:** Failed payment gateway requests are queued for retry.
- **Notification Redundancy:** Push → SMS → Email fallback chain.
- **Offline Fallback:** Mobile apps continue functioning with local storage when connectivity is lost.

---

## 2. Module A: Core Architecture & Data Integrity

### 2.1 Schema Evolution and Data Migration Engine (Requirement 1)

#### 2.1.1 Immutable Snapshot Mechanism

Every modification to a form schema triggers the creation of an immutable snapshot to ensure historical data integrity.

**Snapshot Creation Workflow:**

1. **Schema Modification Detected:** When an admin modifies a form (add/remove/edit fields), the system detects the change.
2. **Snapshot Generation:**
   - The current schema definition is serialized to JSON (canonical format: sorted keys, no whitespace).
   - A SHA-256 hash is computed: `hash = SHA256(canonical_json)`.
   - A semantic version is assigned following SemVer (e.g., `v1.2.3`):
     - **Major:** Breaking changes (field removal, type change).
     - **Minor:** Backward-compatible additions (new optional field).
     - **Patch:** Non-functional changes (label updates, help text).
   - The snapshot is stored with metadata:
     ```json
     {
       "snapshot_id": "uuid-v4",
       "schema_hash": "sha256-hex",
       "semantic_version": "v1.2.3",
       "created_at": "2026-02-04T10:30:00Z",
       "created_by": "admin-user-id",
       "schema_definition": { /* full JSON schema */ },
       "parent_snapshot_id": "uuid-of-previous-version",
       "change_summary": "Added 'emergency_contact' field"
     }
     ```
3. **Immutability Enforcement:**
   - Snapshots are stored in an append-only table with database-level constraints preventing updates/deletes.
   - Cryptographic integrity is verified on read: `SHA256(schema_definition) == schema_hash`.
4. **Record Association:**
   - Every student record, enrollment, or form submission stores a `snapshot_id` reference.
   - This reference is immutable once the record is created.

**Database Schema:**
```sql
CREATE TABLE schema_snapshots (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  form_type VARCHAR(50) NOT NULL, -- e.g., 'student_enrollment'
  semantic_version VARCHAR(20) NOT NULL,
  schema_hash CHAR(64) NOT NULL, -- SHA-256 hex
  schema_definition JSONB NOT NULL,
  parent_snapshot_id UUID REFERENCES schema_snapshots(snapshot_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  change_summary TEXT,
  CONSTRAINT no_update_or_delete CHECK (false) -- Enforces append-only
);

CREATE TABLE student_records (
  student_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  snapshot_id UUID NOT NULL REFERENCES schema_snapshots(snapshot_id),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- snapshot_id is immutable after creation
);
```

#### 2.1.2 Inheritance Hierarchy Logic

Field visibility and editability follow a strict hierarchy: **Global → Institution → Center → Program → Class → Batch**.

**Hierarchy Rules:**
- **Restriction Only:** Child levels can only restrict permissions defined by parents; they cannot expand access.
- **Example:**
  - **Global Level:** Field `date_of_birth` is `visible_to: [admin, teacher, student]`.
  - **Institution Level:** Can restrict to `visible_to: [admin, teacher]` (removes student access).
  - **Batch Level:** Can further restrict to `visible_to: [admin]` (removes teacher access).
  - **Invalid:** Batch cannot expand back to `[admin, teacher, student]`.

**Implementation:**
```json
{
  "field_id": "date_of_birth",
  "global_permissions": {
    "visible_to_roles": ["admin", "teacher", "student"],
    "editable_by_roles": ["admin"]
  },
  "institution_overrides": {
    "institution_id": "inst-123",
    "visible_to_roles": ["admin", "teacher"] // Restriction applied
  },
  "batch_overrides": {
    "batch_id": "batch-456",
    "visible_to_roles": ["admin"] // Further restriction
  }
}
```

**Permission Resolution Algorithm:**
```javascript
function resolveFieldPermissions(field, userContext) {
  let permissions = field.global_permissions;
  
  // Apply hierarchy restrictions (each level can only narrow permissions)
  const hierarchy = ['institution', 'center', 'program', 'class', 'batch'];
  for (const level of hierarchy) {
    const override = field[`${level}_overrides`]?.[userContext[`${level}_id`]];
    if (override) {
      permissions = {
        visible_to_roles: intersection(permissions.visible_to_roles, override.visible_to_roles),
        editable_by_roles: intersection(permissions.editable_by_roles, override.editable_by_roles)
      };
    }
  }
  
  return permissions;
}
```

#### 2.1.3 Historic Rendering Rule

**Critical Principle:** Historical records MUST be rendered using the exact schema snapshot that existed at the time of their creation. No automatic transformation to newer schemas is permitted for system views or legal/audit outputs.

**Rendering Workflow:**
1. **Fetch Record:** Retrieve student record with `snapshot_id`.
2. **Load Snapshot:** Fetch the immutable schema snapshot from `schema_snapshots` table.
3. **Verify Integrity:** Compute `SHA256(schema_definition)` and compare with stored `schema_hash`.
4. **Render Data:** Use the snapshot's field definitions, labels, and validation rules to render the data.
5. **Version Indicator:** Display a badge: "Viewing record as of Schema v1.2.3 (2025-06-15)".

**Transformation Process (Admin-Initiated Only):**
- If an admin needs to export historical data in a newer schema format, they must:
  1. Initiate an explicit "Schema Transformation Export" workflow.
  2. Specify source snapshot version and target snapshot version.
  3. Define field mapping rules (e.g., "old_field_name → new_field_name").
  4. System generates a new artifact (CSV/JSON) with transformation metadata.
  5. Original records remain unchanged; transformation is logged in audit trail.

**Database Query Example:**
```sql
-- Fetch student record with its original schema
SELECT 
  sr.student_id,
  sr.data,
  ss.semantic_version,
  ss.schema_definition,
  ss.created_at AS schema_created_at
FROM student_records sr
JOIN schema_snapshots ss ON sr.snapshot_id = ss.snapshot_id
WHERE sr.student_id = 'uuid-123';
```

#### 2.1.4 Migration Safety and Rollback

**Dry-Run Mode:**
- Before applying a schema change, admins can run a dry-run simulation on 1K-10K sample records.
- The system reports:
  - Fields that will become inaccessible.
  - Validation rules that will fail on existing data.
  - Estimated impact (e.g., "500 records will require manual review").

**Auto-Rollback on Failure:**
- If a migration fails (e.g., database constraint violation), the system automatically rolls back within:
  - **Enterprise:** 30 seconds
  - **Business:** 5 minutes
  - **Basic:** 15 minutes
- Rollback mechanism:
  - Database transaction is aborted.
  - Previous schema snapshot is re-activated.
  - Affected records are marked for manual review.

**Archival and Retention:**
- All schema snapshots are retained for:
  - **Basic:** 7 years
  - **Enterprise:** 99 years
- Cryptographic integrity verification runs nightly to detect tampering.

---
#### 2.1.5 Preview-as-Role Functionality

**Purpose:** Allow admins to preview schema changes as specific user roles before deployment.

**Implementation:**

```javascript
POST /api/v1/schemas/:schemaId/preview
Authorization: Bearer <admin-token>

{
  "preview_as_role": "teacher",
  "preview_context": {
    "institution_id": "inst-uuid",
    "batch_id": "batch-uuid"
  }
}

// Server simulates the schema rendering for the specified role
const previewSchema = applyRolePermissions(schema, 'teacher', context);

Response:
{
  "preview_id": "uuid-v4",
  "role": "teacher",
  "visible_fields": ["first_name", "last_name", "attendance_rate"],
  "hidden_fields": ["medical_history", "national_id"],
  "editable_fields": ["attendance_status"],
  "readonly_fields": ["first_name", "last_name"]
}
```

**UI Workflow:**
1. Admin modifies schema in draft mode.
2. Clicks "Preview as Teacher" button.
3. System renders the form exactly as a teacher would see it.
4. Admin can switch between roles (Student, Guardian, Admin) to verify permissions.
5. Once satisfied, admin publishes the schema.

#### 2.1.6 Schema Export/Import for Portability

**Export API:**

```javascript
GET /api/v1/schemas/:schemaId/export
Authorization: Bearer <admin-token>

Response:
{
  "export_id": "uuid-v4",
  "schema_id": "schema-uuid",
  "semantic_version": "v1.2.3",
  "schema_definition": { /* full JSON schema */ },
  "field_definitions": [ /* array of field configs */ ],
  "validation_rules": [ /* array of validation rules */ ],
  "exported_at": "2026-02-04T10:30:00Z",
  "format": "eduos-schema-v1"
}
```

**Import API:**

```javascript
POST /api/v1/schemas/import
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "schema_definition": { /* imported JSON */ },
  "import_mode": "create_new | merge_with_existing",
  "conflict_resolution": "skip | overwrite | prompt"
}

// Server validates the imported schema
- Check format version compatibility
- Validate field types and constraints
- Detect conflicts with existing schemas
- Create new snapshot if validation passes

Response:
{
  "import_id": "uuid-v4",
  "status": "success | partial | failed",
  "new_snapshot_id": "snapshot-uuid",
  "conflicts": [],
  "imported_fields": 25,
  "skipped_fields": 2
}
```

#### 2.1.7 Automated Schema Testing

**Test Suite Execution:**

When a schema change is proposed, the system automatically runs a test suite:

```javascript
POST /api/v1/schemas/:schemaId/test
Authorization: Bearer <admin-token>

{
  "test_mode": "full | quick",
  "sample_size": 1000  // Number of records to test against
}

// Test suite checks:
1. Field dependency validation (e.g., "If field A is visible, field B must also be visible")
2. Validation rule consistency (e.g., "Max value > Min value")
3. Permission hierarchy integrity (child cannot expand parent permissions)
4. Data type compatibility (existing data can be validated against new rules)
5. Required field coverage (all required fields have values in existing records)

Response:
{
  "test_id": "uuid-v4",
  "coverage_percent": 96.5,
  "tests_passed": 48,
  "tests_failed": 2,
  "failures": [
    {
      "test_name": "field_dependency_check",
      "error": "Field 'guardian_phone' is visible but depends on 'guardian_name' which is hidden",
      "severity": "error"
    }
  ],
  "warnings": [
    {
      "test_name": "data_compatibility_check",
      "message": "50 records have null values for newly required field 'emergency_contact'",
      "severity": "warning"
    }
  ]
}
```

**Coverage Target:** The test suite must achieve 95% coverage of field dependencies and validation rules as specified in Requirement 1.8.

---


### 2.2 Canonical Student Identity and AI-Assisted Resolution (Requirement 2)

#### 2.2.1 Unique Identity Assignment

Every student receives a globally unique identifier upon creation:

```json
{
  "student_id": "uuid-v4",
  "tenant_id": "uuid-v4",
  "created_at": "2026-02-04T10:30:00Z", // Immutable
  "identity_source": "manual_entry | import | api",
  "canonical_data": {
    "first_name": "John",
    "last_name": "Doe",
    "date_of_birth": "2005-03-15",
    "national_id": "encrypted-value"
  }
}
```

**Immutability Rules:**
- `student_id` and `created_at` are immutable once assigned.
- `canonical_data` can be updated, but all changes are logged in the audit trail.

#### 2.2.2 Hybrid Duplicate Detection Workflow

EduOS combines deterministic fuzzy matching with AI-powered semantic embeddings to detect potential duplicates.

**Detection Pipeline:**

**Step 1: Deterministic Layer (Fuzzy String Matching)**
- When a new student is created or imported, the system computes fuzzy match scores against existing students in the same tenant.
- **Algorithm:** Levenshtein distance for name fields, exact match for date of birth.
- **Scoring:**
  ```javascript
  deterministic_score = (
    0.4 * levenshtein_similarity(first_name) +
    0.4 * levenshtein_similarity(last_name) +
    0.2 * (date_of_birth_match ? 1.0 : 0.0)
  );
  ```
- **Threshold:** Scores > 0.75 are flagged as "Potential Duplicates".

**Step 2: AI Advisory Layer (Vector Embeddings)**
- The system sends candidate pairs to the AI Inference Service (Python/FastAPI).
- **Model:** Sentence-BERT (SBERT) or similar transformer-based embedding model.
- **Process:**
  1. Concatenate student attributes: `"{first_name} {last_name} {date_of_birth}"`.
  2. Generate 768-dimensional embedding vector.
  3. Compute cosine similarity between candidate pairs.
  4. **Threshold:** Similarity > 0.85 flags "Semantic Duplicates" (captures phonetic matches like "Robert" vs. "Bob").

**Step 3: Consolidated Scoring**
- Combine both scores into a single "Likelihood Score":
  ```javascript
  likelihood_score = 0.6 * deterministic_score + 0.4 * ai_similarity_score;
  ```
- **Output:**
  ```json
  {
    "candidate_pair": ["student-uuid-1", "student-uuid-2"],
    "likelihood_score": 0.89,
    "deterministic_score": 0.82,
    "ai_similarity_score": 0.95,
    "reason_codes": [
      "High name similarity (Levenshtein: 0.92)",
      "Semantic match detected (Cosine: 0.95)",
      "Date of birth exact match"
    ],
    "status": "pending_review"
  }
  ```

**Step 4: Human Review Queue**
- Flagged pairs are added to a "Duplicate Review Queue" visible to admins.
- The UI displays:
  - Side-by-side comparison of student records.
  - Likelihood score with explainability (reason codes).
  - Options: "Merge", "Not a Duplicate", "Need More Info".

**Critical Rule:** **ALL merge operations REQUIRE human approval. No auto-merges.**

#### 2.2.3 Merge Operation with Pre-Merge Snapshot

**Pre-Merge Snapshot (Cryptographic Backup):**
Before any merge, the system creates a cryptographic snapshot of all source records to enable reversibility.

**Merge Workflow:**

1. **Admin Initiates Merge:**
   - Selects primary (canonical) record and secondary (duplicate) record(s).
   - Provides a "Merge Reason" (mandatory text field).

2. **Pre-Merge Snapshot Creation:**
   ```json
   {
     "merge_snapshot_id": "uuid-v4",
     "created_at": "2026-02-04T11:00:00Z",
     "primary_record": { /* full JSON snapshot */ },
     "secondary_records": [ /* array of full JSON snapshots */ ],
     "snapshot_hash": "sha256-hex", // SHA-256 of concatenated records
     "tenant_id": "uuid-v4"
   }
   ```
   - Stored in an append-only `merge_snapshots` table.

3. **Impact Assessment:**
   - System displays:
     - Number of enrollments to be transferred.
     - Number of attendance records to be re-linked.
     - Number of payment records to be consolidated.
   - Admin must explicitly confirm: "I understand this will affect X records."

4. **Merge Execution (Database Transaction):**
   ```sql
   BEGIN;
   
   -- Update all foreign key references
   UPDATE enrollments SET student_id = 'primary-uuid' WHERE student_id IN ('secondary-uuid-1', 'secondary-uuid-2');
   UPDATE attendance_records SET student_id = 'primary-uuid' WHERE student_id IN ('secondary-uuid-1', 'secondary-uuid-2');
   UPDATE payment_records SET student_id = 'primary-uuid' WHERE student_id IN ('secondary-uuid-1', 'secondary-uuid-2');
   
   -- Merge canonical data (most recent timestamp wins unless manually overridden)
   UPDATE students SET canonical_data = merged_data WHERE student_id = 'primary-uuid';
   
   -- Soft-delete secondary records
   UPDATE students SET status = 'merged', merged_into = 'primary-uuid', merged_at = NOW() WHERE student_id IN ('secondary-uuid-1', 'secondary-uuid-2');
   
   -- Create audit record
   INSERT INTO merge_audit_log (merge_id, merge_snapshot_id, primary_id, secondary_ids, merged_by, merged_at, merge_reason)
   VALUES ('uuid-v4', 'snapshot-uuid', 'primary-uuid', ARRAY['secondary-uuid-1', 'secondary-uuid-2'], 'admin-uuid', NOW(), 'Duplicate entry from CSV import');
   
   COMMIT;
   ```

5. **Audit Trail:**
   - Every merge generates a `merge_id` with bidirectional references:
     - Primary record: `merged_from: ['secondary-uuid-1', 'secondary-uuid-2']`
     - Secondary records: `merged_into: 'primary-uuid'`
   - Audit log includes: `merged_by`, `merged_at`, `merge_reason`, `merge_snapshot_id`.

#### 2.2.4 Reversibility (Undo/Restore)

**Restore Operation:**
- Admins can undo a merge within the tenant SLA window (4 hours for Basic, 1 hour for Business/Enterprise).
- **Workflow:**
  1. Admin selects a merge from the audit log.
  2. System retrieves the `merge_snapshot_id`.
  3. Displays a preview of the restore operation.
  4. Admin confirms: "Restore to pre-merge state."
  5. System executes reverse transaction:
     - Restores secondary records from snapshot.
     - Reverts all foreign key references.
     - Marks merge as "reversed" in audit log.

**Database Implementation:**
```sql
-- Restore secondary records
INSERT INTO students (student_id, tenant_id, canonical_data, status, created_at)
SELECT student_id, tenant_id, canonical_data, 'active', created_at
FROM merge_snapshots
WHERE merge_snapshot_id = 'snapshot-uuid';

-- Revert foreign key references
UPDATE enrollments SET student_id = original_student_id WHERE merge_id = 'merge-uuid';
```

#### 2.2.5 Conflict Precedence Rules

When merging records with conflicting data:
- **Canonical Data Priority:** Data from the primary (canonical) record takes precedence.
- **Timestamp Rule:** For conflicting fields, the most recent timestamp wins unless manually overridden.
- **Manual Override:** Admins can explicitly choose which value to keep during the merge review.

---

### 2.3 Multi-Tenant Architecture with Data Isolation (Requirement 3)

#### 2.3.1 Row-Level Security (RLS) Implementation

EduOS enforces tenant isolation at the database level using PostgreSQL Row-Level Security (RLS).

**RLS Policy Definition:**

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Users can only access rows matching their tenant_id
CREATE POLICY tenant_isolation_policy ON students
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_policy ON enrollments
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_policy ON attendance_records
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

**Connection-Level Enforcement:**

Every database connection sets the `app.current_tenant_id` session variable based on the authenticated user's tenant:

```javascript
// Node.js example
async function getDatabaseConnection(userId) {
  const user = await getUserById(userId);
  const pool = new Pool({ /* connection config */ });
  const client = await pool.connect();
  
  // Set tenant context for this connection
  await client.query(`SET app.current_tenant_id = '${user.tenant_id}'`);
  
  return client;
}
```

**Benefits:**
- **Defense in Depth:** Even if application logic has a bug, the database enforces isolation.
- **Query Transparency:** Developers write queries without explicit `WHERE tenant_id = ?` clauses; RLS handles it automatically.
- **Audit Trail:** All queries are automatically scoped to the tenant; no risk of cross-tenant data leakage.

**Enterprise Tier: Physical Separation**

For Enterprise customers, EduOS provides dedicated database instances:
- **Dedicated PostgreSQL Instance:** Each tenant gets a separate database server.
- **Network Isolation:** Tenant databases are in separate VPCs with firewall rules.
- **Compliance:** Meets requirements for industries with strict data residency laws (e.g., healthcare, finance).

#### 2.3.2 Resource Quotas and Rate Limiting

**Quota Enforcement:**

```json
{
  "tenant_id": "uuid-v4",
  "tier": "business",
  "quotas": {
    "max_storage_gb": 100,
    "max_api_calls_per_day": 100000,
    "max_concurrent_users": 500,
    "max_db_connections": 50
  },
  "current_usage": {
    "storage_gb": 45.2,
    "api_calls_today": 23456,
    "concurrent_users": 120,
    "db_connections": 12
  }
}
```

**Enforcement Mechanisms:**
- **Storage:** Background job monitors storage usage; blocks new uploads when quota is exceeded.
- **API Calls:** Redis-based rate limiter tracks calls per tenant per day; returns HTTP 429 when exceeded.
- **Concurrent Users:** Auth service tracks active sessions; rejects new logins when limit is reached.
- **DB Connections:** Connection pool enforces per-tenant limits; queues requests when limit is reached.

**Alerting:**
- Tenants receive alerts at 80%, 90%, and 100% of quota usage.
- Admins can request quota increases via support tickets.

#### 2.3.3 Tenant Deprovisioning

**Deletion Workflow:**
1. **Multi-Person Approval:** Requires approval from 2+ authorized users (e.g., SuperAdmin + Tenant Owner).
2. **Final Data Export:** System generates a complete data export (JSON/CSV) and stores it in secure archive.
3. **Cryptographic Deletion Certificate:** System generates a signed certificate:
   ```json
   {
     "deletion_certificate_id": "uuid-v4",
     "tenant_id": "uuid-v4",
     "deleted_at": "2026-02-04T12:00:00Z",
     "deleted_by": ["admin-uuid-1", "admin-uuid-2"],
     "data_export_url": "s3://archive/tenant-uuid/export.zip",
     "certificate_hash": "sha256-hex",
     "signature": "rsa-signature"
   }
   ```
4. **Data Deletion:** All tenant data is securely deleted (cryptographic erasure for encrypted data).
5. **Audit Retention:** Deletion certificate and audit logs are retained per compliance requirements (7-99 years).

#### 2.3.4 Cross-Tenant Access

**Use Case:** SuperAdmin needs to access Tenant B's data for support purposes.

**Authorization Workflow:**
1. **Justification Required:** SuperAdmin provides written justification (e.g., "Investigating payment discrepancy reported in ticket #12345").
2. **Second-Party Approval:** Another SuperAdmin or Compliance Officer must approve the request.
3. **Time-Bound Token:** System generates a time-limited access token (max 4 hours).
4. **Audit Logging:** All actions taken during cross-tenant access are logged with:
   - Original admin user ID
   - Target tenant ID
   - Justification text
   - Approval chain
   - Timestamp of every query/action

**Database Implementation:**
```sql
-- Temporarily override RLS for cross-tenant access
SET app.current_tenant_id = 'target-tenant-uuid';
SET app.cross_tenant_access_token = 'time-bound-token';
SET app.original_admin_id = 'admin-uuid';

-- All queries are now scoped to target tenant, but logged with original admin context
```

#### 2.3.5 Compliance Configurations

Tenants can configure compliance settings independently:

```json
{
  "tenant_id": "uuid-v4",
  "compliance_profile": "gdpr", // Options: gdpr, ferpa, hipaa, custom
  "data_residency": "eu-west-1",
  "retention_policies": {
    "student_data": "7_years_after_graduation",
    "financial_records": "10_years",
    "audit_logs": "99_years"
  },
  "consent_requirements": {
    "marketing_emails": "explicit_opt_in",
    "data_analytics": "opt_out_available"
  }
}
```

**Enforcement:**
- Data residency: Tenant data is stored in the specified AWS region.
- Retention policies: Automated lifecycle management deletes data per policy.
- Consent: Forms dynamically adjust based on compliance profile.

---

### 2.4 Bulk Operations with Rollback Capability (Requirement 26)

#### 2.4.1 Dry-Run Mode

Before executing bulk operations (CSV import, mass update), admins can run a dry-run simulation.

**Workflow:**
1. **Upload CSV:** Admin uploads a CSV file with 10,000 student records.
2. **Dry-Run Analysis:**
   - System parses CSV and validates against current schema.
   - Identifies issues:
     - Missing required fields: 50 records
     - Invalid date formats: 12 records
     - Duplicate student IDs: 3 records
     - Schema validation failures: 8 records
   - Generates an **Impact Analysis Report**:
     ```json
     {
       "total_records": 10000,
       "valid_records": 9927,
       "invalid_records": 73,
       "estimated_duration": "45 seconds",
       "errors": [
         { "row": 15, "error": "Missing required field: date_of_birth" },
         { "row": 234, "error": "Invalid date format: '15-03-2005' (expected: YYYY-MM-DD)" }
       ]
     }
     ```
3. **Admin Review:** Admin reviews the report and fixes errors in the CSV.
4. **Re-Run Dry-Run:** Admin re-uploads the corrected CSV and confirms all records are valid.

#### 2.4.2 Pre-Operation Snapshot

Before executing the bulk operation, the system creates a restore point.

**Snapshot Mechanism:**
```sql
-- Create a snapshot of affected records
CREATE TABLE bulk_operation_snapshots (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  operation_type VARCHAR(50) NOT NULL, -- 'import', 'update', 'delete'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  affected_table VARCHAR(100) NOT NULL,
  snapshot_data JSONB NOT NULL, -- Array of affected records
  snapshot_hash CHAR(64) NOT NULL -- SHA-256 of snapshot_data
);

-- Example: Snapshot before bulk update
INSERT INTO bulk_operation_snapshots (tenant_id, operation_type, affected_table, snapshot_data, snapshot_hash)
SELECT 
  'tenant-uuid',
  'update',
  'students',
  jsonb_agg(row_to_json(students.*)),
  encode(digest(jsonb_agg(row_to_json(students.*))::text, 'sha256'), 'hex')
FROM students
WHERE student_id IN (SELECT student_id FROM bulk_update_queue);
```

#### 2.4.3 Automatic Rollback on Failure

If a bulk operation fails mid-process, the system automatically rolls back to the pre-operation state.

**Rollback Triggers:**
- Database constraint violation (e.g., foreign key error)
- Schema validation failure
- Timeout (operation exceeds 5 minutes)
- Manual abort by admin

**Rollback Mechanism:**
```sql
BEGIN;

-- Execute bulk operation
INSERT INTO students (student_id, tenant_id, canonical_data, snapshot_id)
SELECT 
  gen_random_uuid(),
  'tenant-uuid',
  row_data,
  'current-snapshot-id'
FROM bulk_import_queue;

-- If any error occurs, PostgreSQL automatically rolls back the transaction
-- No partial data is committed

COMMIT;
```

**Post-Rollback Actions:**
- System logs the failure reason in the audit trail.
- Admin receives a notification with error details.
- Snapshot is retained for 30 days for forensic analysis.

#### 2.4.4 Integrity Verification

After a successful bulk operation, the system verifies referential integrity.

**Verification Checks:**
1. **Foreign Key Integrity:** Ensure all `student_id` references in `enrollments`, `attendance_records`, etc., are valid.
2. **Schema Compliance:** Verify all records conform to the current schema snapshot.
3. **Duplicate Detection:** Run duplicate detection on newly imported records.
4. **Audit Completeness:** Ensure all operations are logged in the audit trail.

**Verification Query:**
```sql
-- Check for orphaned enrollment records
SELECT COUNT(*) FROM enrollments e
LEFT JOIN students s ON e.student_id = s.student_id
WHERE s.student_id IS NULL;

-- If count > 0, mark operation as "Needs Review"
```

**Status Transitions:**
- **In Progress:** Operation is executing.
- **Verifying:** Post-operation integrity checks are running.
- **Success:** All checks passed; operation is complete.
- **Needs Review:** Integrity issues detected; admin intervention required.
- **Rolled Back:** Operation failed and was automatically reversed.

---

### 2.4 Bulk Operations with Rollback Capability (Requirement 26)

#### 2.4.1 Dry-Run Mode and Impact Analysis

**Dry-Run Workflow:**

```javascript
class BulkOperationEngine {
  async dryRun(operationType, data) {
    // Create dry-run session
    const dryRunSession = await db('bulk_operation_sessions').insert({
      session_id: uuidv4(),
      operation_type: operationType, // 'import', 'update', 'delete'
      mode: 'dry_run',
      total_records: data.length,
      status: 'analyzing',
      created_at: new Date()
    });
    
    const impactReport = {
      total_records: data.length,
      valid_records: 0,
      invalid_records: 0,
      warnings: [],
      errors: [],
      affected_entities: {
        students: 0,
        enrollments: 0,
        attendance: 0,
        payments: 0
      }
    };
    
    // Analyze each record without committing
    for (const record of data) {
      try {
        // Validate record
        const validation = await this.validateRecord(operationType, record);
        
        if (validation.valid) {
          impactReport.valid_records++;
          
          // Count affected entities
          const impact = await this.analyzeImpact(operationType, record);
          impactReport.affected_entities.students += impact.students || 0;
          impactReport.affected_entities.enrollments += impact.enrollments || 0;
          impactReport.affected_entities.attendance += impact.attendance || 0;
          impactReport.affected_entities.payments += impact.payments || 0;
        } else {
          impactReport.invalid_records++;
          impactReport.errors.push({
            record_index: data.indexOf(record),
            record_id: record.id,
            errors: validation.errors
          });
        }
        
        // Check for warnings
        if (validation.warnings && validation.warnings.length > 0) {
          impactReport.warnings.push({
            record_index: data.indexOf(record),
            record_id: record.id,
            warnings: validation.warnings
          });
        }
      } catch (error) {
        impactReport.invalid_records++;
        impactReport.errors.push({
          record_index: data.indexOf(record),
          error: error.message
        });
      }
    }
    
    // Store impact report
    await db('bulk_operation_sessions')
      .where({ session_id: dryRunSession.session_id })
      .update({
        status: 'analyzed',
        impact_report: impactReport,
        completed_at: new Date()
      });
    
    return impactReport;
  }
  
  async analyzeImpact(operationType, record) {
    const impact = { students: 0, enrollments: 0, attendance: 0, payments: 0 };
    
    switch (operationType) {
      case 'student_update':
        impact.students = 1;
        // Check if student has enrollments
        const enrollments = await db('enrollments')
          .where({ student_id: record.student_id })
          .count('* as count');
        impact.enrollments = enrollments[0].count;
        break;
      
      case 'student_delete':
        impact.students = 1;
        // Count all related records
        const related = await db.raw(`
          SELECT 
            (SELECT COUNT(*) FROM enrollments WHERE student_id = ?) as enrollments,
            (SELECT COUNT(*) FROM attendance_records WHERE student_id = ?) as attendance,
            (SELECT COUNT(*) FROM fee_transactions WHERE student_id = ?) as payments
        `, [record.student_id, record.student_id, record.student_id]);
        
        impact.enrollments = related.rows[0].enrollments;
        impact.attendance = related.rows[0].attendance;
        impact.payments = related.rows[0].payments;
        break;
      
      case 'enrollment_import':
        impact.enrollments = 1;
        break;
    }
    
    return impact;
  }
}
```

---

#### 2.4.2 Pre-Operation Snapshots

**Snapshot Creation:**

```javascript
class BulkOperationSnapshot {
  async createSnapshot(operationType, affectedRecords) {
    const snapshot = await db('bulk_operation_snapshots').insert({
      snapshot_id: uuidv4(),
      operation_type: operationType,
      created_at: new Date(),
      record_count: affectedRecords.length
    });
    
    // Store affected records
    for (const record of affectedRecords) {
      await db('bulk_operation_snapshot_data').insert({
        snapshot_id: snapshot.snapshot_id,
        entity_type: record.entity_type,
        entity_id: record.entity_id,
        snapshot_data: record.data, // Full JSON snapshot
        created_at: new Date()
      });
    }
    
    return snapshot;
  }
  
  async restoreFromSnapshot(snapshotId) {
    const snapshot = await db('bulk_operation_snapshots')
      .where({ snapshot_id: snapshotId })
      .first();
    
    if (!snapshot) {
      throw new Error('Snapshot not found');
    }
    
    const snapshotData = await db('bulk_operation_snapshot_data')
      .where({ snapshot_id: snapshotId });
    
    const transaction = await db.transaction();
    
    try {
      for (const record of snapshotData) {
        // Restore each record
        await transaction(record.entity_type)
          .where({ [`${record.entity_type.slice(0, -1)}_id`]: record.entity_id })
          .update(record.snapshot_data);
      }
      
      await transaction.commit();
      
      return { success: true, restored_count: snapshotData.length };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
```

---

#### 2.4.3 Automatic Rollback on Failure

**Rollback Mechanism:**

```javascript
class BulkOperationExecutor {
  async execute(sessionId, data) {
    const session = await db('bulk_operation_sessions')
      .where({ session_id: sessionId })
      .first();
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Create pre-operation snapshot
    const snapshotEngine = new BulkOperationSnapshot();
    const affectedRecords = await this.identifyAffectedRecords(session.operation_type, data);
    const snapshot = await snapshotEngine.createSnapshot(session.operation_type, affectedRecords);
    
    // Update session with snapshot reference
    await db('bulk_operation_sessions')
      .where({ session_id: sessionId })
      .update({
        snapshot_id: snapshot.snapshot_id,
        status: 'executing',
        started_at: new Date()
      });
    
    const transaction = await db.transaction();
    
    try {
      let processedCount = 0;
      
      for (const record of data) {
        await this.processRecord(transaction, session.operation_type, record);
        processedCount++;
        
        // Update progress
        await db('bulk_operation_sessions')
          .where({ session_id: sessionId })
          .update({ processed_count: processedCount });
      }
      
      // Verify integrity before commit
      const integrityCheck = await this.verifyIntegrity(transaction, session.operation_type);
      
      if (!integrityCheck.passed) {
        throw new Error(`Integrity check failed: ${integrityCheck.errors.join(', ')}`);
      }
      
      await transaction.commit();
      
      // Mark as success
      await db('bulk_operation_sessions')
        .where({ session_id: sessionId })
        .update({
          status: 'completed',
          completed_at: new Date()
        });
      
      return { success: true, processed_count: processedCount };
    } catch (error) {
      // Automatic rollback
      await transaction.rollback();
      
      // Restore from snapshot
      try {
        await snapshotEngine.restoreFromSnapshot(snapshot.snapshot_id);
        
        await db('bulk_operation_sessions')
          .where({ session_id: sessionId })
          .update({
            status: 'rolled_back',
            error_message: error.message,
            rolled_back_at: new Date()
          });
        
        return { 
          success: false, 
          error: error.message,
          rolled_back: true 
        };
      } catch (restoreError) {
        // Rollback failed - critical error
        await db('bulk_operation_sessions')
          .where({ session_id: sessionId })
          .update({
            status: 'rollback_failed',
            error_message: `${error.message}; Rollback error: ${restoreError.message}`,
            failed_at: new Date()
          });
        
        throw new Error(`Bulk operation failed and rollback failed: ${restoreError.message}`);
      }
    }
  }
  
  async verifyIntegrity(transaction, operationType) {
    const checks = {
      passed: true,
      errors: []
    };
    
    // Check for orphaned records
    const orphanedEnrollments = await transaction.raw(`
      SELECT COUNT(*) as count FROM enrollments e
      LEFT JOIN students s ON e.student_id = s.student_id
      WHERE s.student_id IS NULL
    `);
    
    if (orphanedEnrollments.rows[0].count > 0) {
      checks.passed = false;
      checks.errors.push(`${orphanedEnrollments.rows[0].count} orphaned enrollments detected`);
    }
    
    // Check for duplicate records
    const duplicates = await transaction.raw(`
      SELECT student_id, COUNT(*) as count
      FROM students
      GROUP BY student_id
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.rows.length > 0) {
      checks.passed = false;
      checks.errors.push(`${duplicates.rows.length} duplicate student records detected`);
    }
    
    return checks;
  }
}
```

---

## 3. Module B: Domain Logic & Educational Features

### 3.1 Offline-First Attendance & AI Pattern Validation (Requirement 5)

#### 3.1.1 Event Schema for Offline Attendance

Mobile devices (tablets, phones) store attendance events locally in SQLite before syncing to the server.

**Event Schema:**
```json
{
  "event_id": "uuid-v4",
  "idempotency_key": "sha256-hash-of-event-data",
  "device_id": "unique-device-identifier",
  "user_id": "teacher-uuid",
  "client_ts": "2026-02-04T09:15:30+05:30",
  "client_local_time": "2026-02-04T09:15:30+05:30",
  "event_type": "attendance_mark",
  "data": {
    "batch_id": "batch-uuid",
    "session_id": "session-uuid",
    "student_id": "student-uuid",
    "status": "present | absent | late",
    "location": {
      "latitude": 12.9716,
      "longitude": 77.5946,
      "accuracy_meters": 10
    }
  },
  "sync_status": "pending | synced | conflict"
}
```

**Field Definitions:**
- `event_id`: Globally unique identifier for the event (UUID v4).
- `idempotency_key`: SHA-256 hash of `event_id + device_id + client_ts + data` to ensure uniqueness.
- `device_id`: Unique identifier for the device (generated on first app launch, persisted locally).
- `user_id`: Teacher who marked the attendance.
- `client_ts`: Timestamp when the event was created on the client device (ISO 8601 with timezone).
- `client_local_time`: Original local time preserved for audit purposes.
- `event_type`: Type of event (e.g., `attendance_mark`, `attendance_edit`).
- `data`: Event-specific payload (attendance details, location).
- `sync_status`: Current synchronization state.

**SQLite Schema (Mobile):**
```sql
CREATE TABLE offline_events (
  event_id TEXT PRIMARY KEY,
  idempotency_key TEXT UNIQUE NOT NULL,
  device_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  client_ts TEXT NOT NULL,
  client_local_time TEXT NOT NULL,
  event_type TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON blob
  sync_status TEXT DEFAULT 'pending',
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_sync_status ON offline_events(sync_status);
CREATE INDEX idx_device_id ON offline_events(device_id);
```

#### 3.1.2 Deterministic Conflict Resolution

When multiple devices sync attendance for the same student/session, conflicts may arise. EduOS uses the "Earliest Client Timestamp" rule for deterministic resolution.

**Conflict Scenario:**
- **Device A** (Teacher 1): Marks Student X as "Present" at `09:15:30`.
- **Device B** (Teacher 2): Marks Student X as "Absent" at `09:16:45`.
- Both devices sync to the server.

**Resolution Logic:**

1. **Server receives both events:**
   ```json
   [
     {
       "event_id": "event-a",
       "client_ts": "2026-02-04T09:15:30+05:30",
       "data": { "student_id": "student-x", "status": "present" }
     },
     {
       "event_id": "event-b",
       "client_ts": "2026-02-04T09:16:45+05:30",
       "data": { "student_id": "student-x", "status": "absent" }
     }
   ]
   ```

2. **Conflict Detection:**
   - Server detects multiple events for the same `(student_id, session_id)` tuple.
   - Compares `client_ts` values.

3. **Apply "Earliest Client Timestamp" Rule:**
   - Event A (`09:15:30`) wins because it has the earlier timestamp.
   - Event B is marked as `conflict_rejected` in the sync log.

4. **Conflict Logging:**
   ```sql
   INSERT INTO sync_conflicts (
     conflict_id, session_id, student_id, 
     winning_event_id, rejected_event_id, 
     resolution_rule, created_at
   ) VALUES (
     'uuid-v4', 'session-uuid', 'student-x',
     'event-a', 'event-b',
     'earliest_client_timestamp', NOW()
   );
   ```

5. **Admin Notification:**
   - System flags the conflict for admin review.
   - Admin can manually override the resolution if needed.

**Idempotency Guarantee:**
- If Device A presses "Sync" multiple times, the `idempotency_key` prevents duplicate records:
  ```sql
  INSERT INTO attendance_records (event_id, idempotency_key, ...)
  VALUES ('event-a', 'sha256-hash', ...)
  ON CONFLICT (idempotency_key) DO NOTHING;
  ```

#### 3.1.3 Timezone Normalization

All timestamps are normalized to UTC on the server, while preserving the original client local time for audit purposes.

**Normalization Process:**

1. **Client sends event with timezone:**
   ```json
   {
     "client_ts": "2026-02-04T09:15:30+05:30",
     "client_local_time": "2026-02-04T09:15:30+05:30"
   }
   ```

2. **Server converts to UTC:**
   ```javascript
   const clientTs = new Date("2026-02-04T09:15:30+05:30");
   const serverTs = clientTs.toISOString(); // "2026-02-04T03:45:30.000Z"
   ```

3. **Database storage:**
   ```sql
   INSERT INTO attendance_records (
     event_id, student_id, session_id, status,
     client_ts_utc, client_local_time, server_received_at
   ) VALUES (
     'event-uuid', 'student-uuid', 'session-uuid', 'present',
     '2026-02-04T03:45:30Z', '2026-02-04T09:15:30+05:30', NOW()
   );
   ```

**Benefits:**
- **Consistent Sorting:** All queries use UTC for chronological ordering.
- **Audit Trail:** Original local time is preserved for legal/compliance purposes.
- **Cross-Timezone Support:** Students traveling across timezones are handled correctly.

#### 3.1.4 AI Anomaly Detection (Isolation Forest)

Upon synchronization, the AI Inference Service analyzes attendance patterns to detect anomalies.

**Detection Pipeline:**

**Step 1: Feature Extraction**
For each synced attendance event, extract features:
```python
features = {
  "time_since_last_checkin_hours": 24.5,
  "distance_from_last_checkin_km": 450.2,
  "implied_travel_speed_kmh": 18.8,  # distance / time
  "student_attendance_rate_30d": 0.95,
  "day_of_week": "Monday",
  "is_holiday": False
}
```

**Step 2: Impossible Travel Detection**
- **Rule:** If `implied_travel_speed_kmh > 120` (unrealistic for students), flag as "Impossible Travel".
- **Example:**
  - Last check-in: Mumbai (09:00 AM)
  - Current check-in: Delhi (10:00 AM)
  - Distance: 1,400 km
  - Time: 1 hour
  - Speed: 1,400 km/h → **Flagged**

**Step 3: Pattern Break Detection (Isolation Forest)**
- **Model:** Isolation Forest (scikit-learn) trained on historical attendance patterns.
- **Training Data:** Last 90 days of attendance for all students in the tenant.
- **Anomaly Score:** Model outputs a score between 0 (normal) and 1 (anomalous).
- **Threshold:** Scores > 0.75 are flagged as "Pattern Break".

**Example Pattern Break:**
- Student has 95% attendance for 60 consecutive days.
- Suddenly absent for 5 consecutive days without prior notice.
- Model flags as anomalous.

**Step 4: Advisory Flagging (No Auto-Rejection)**

The AI does NOT auto-reject or modify attendance records. It only flags them for human review.

**Flagging Workflow:**
```sql
UPDATE attendance_records
SET verification_status = 'requires_review',
    anomaly_score = 0.87,
    anomaly_reason = 'Impossible travel detected: 1400 km in 1 hour'
WHERE event_id = 'event-uuid';

INSERT INTO admin_review_queue (
  queue_id, record_type, record_id, 
  priority, reason, created_at
) VALUES (
  'uuid-v4', 'attendance', 'event-uuid',
  'high', 'AI flagged: Impossible travel', NOW()
);
```

**Admin Review UI:**
- Displays flagged attendance records with:
  - Student name and photo
  - Anomaly score and reason
  - Map showing check-in locations
  - Historical attendance pattern chart
- Admin actions:
  - **Approve:** Mark as valid (e.g., "Student was on school trip").
  - **Reject:** Mark as invalid (e.g., "Fraudulent check-in").
  - **Request Clarification:** Send notification to teacher for explanation.

**Model Retraining:**
- Admin decisions (approve/reject) are logged and used to retrain the Isolation Forest model monthly.
- This creates a feedback loop that improves detection accuracy over time.

---

### 3.2 AI-Enhanced Features

#### 3.2.1 Accessibility: Generative Alt-Text (Requirement 28)

**Vision-Language Model (VLM) Pipeline:**

When an image is uploaded without a description, the system automatically generates alt-text using a VLM.

**Pipeline Architecture:**

1. **Image Upload:**
   ```javascript
   POST /api/v1/media/upload
   Content-Type: multipart/form-data
   
   {
     "file": <binary-image-data>,
     "context": "assignment_submission",
     "alt_text": null  // User did not provide alt-text
   }
   ```

2. **Malware Scan:**
   - Image is scanned for malware using ClamAV or similar.
   - If infected, upload is rejected.

3. **VLM Inference Request:**
   - System sends image to AI Inference Service (Python/FastAPI).
   - **Model:** BLIP-2, LLaVA, or similar vision-language model.
   - **Prompt:** "Describe this image in detail for a visually impaired user. Focus on educational content."

4. **VLM Response:**
   ```json
   {
     "alt_text": "A diagram showing the water cycle with labeled arrows indicating evaporation, condensation, precipitation, and collection. The sun is shown in the top left corner.",
     "confidence_score": 0.92,
     "model_version": "blip2-v1.3"
   }
   ```

5. **Storage with Metadata:**
   ```sql
   INSERT INTO media_files (
     file_id, tenant_id, file_path, mime_type,
     alt_text, alt_text_source, alt_text_confidence,
     uploaded_by, uploaded_at
   ) VALUES (
     'uuid-v4', 'tenant-uuid', 's3://bucket/path/image.jpg', 'image/jpeg',
     'A diagram showing the water cycle...', 'ai-generated', 0.92,
     'user-uuid', NOW()
   );
   ```

6. **User Override:**
   - Users can edit the AI-generated alt-text.
   - Edited alt-text is marked as `alt_text_source: 'user-edited'`.

**WCAG Compliance:**
- All images MUST have alt-text (either user-provided or AI-generated).
- Alt-text is exposed via `<img alt="...">` tags in HTML.
- Screen readers (NVDA, VoiceOver) can read the alt-text.

**Content Simplification (LLM):**

For students with cognitive differences, the system provides a "Simplify Text" feature.

**Simplification Pipeline:**

1. **User selects complex text:**
   ```
   Original: "The mitochondria is the powerhouse of the cell, responsible for 
   producing adenosine triphosphate (ATP) through oxidative phosphorylation."
   ```

2. **LLM Inference Request:**
   - **Model:** GPT-3.5, Llama 2, or similar LLM.
   - **Prompt:** "Rewrite the following text in simple language suitable for a 10-year-old: [text]"

3. **LLM Response:**
   ```
   Simplified: "The mitochondria is like a tiny power plant inside cells. 
   It makes energy that the cell needs to work."
   ```

4. **Display with Toggle:**
   - UI shows both original and simplified versions.
   - User can toggle between them.
   - Preference is saved: `user_preferences.simplified_text_enabled = true`.

#### 3.2.2 Scheduling: AI Optimization Engine (Requirement 31)

**Constraint Satisfaction Problem (CSP) Solver:**

The scheduling engine uses CSP or Genetic Algorithms to generate conflict-free timetables.

**Problem Definition:**

**Variables:**
- `Sessions`: List of all class sessions to be scheduled (e.g., "Math-101-Section-A").

**Domains:**
- `TimeSlots`: Available time slots (e.g., "Monday 9:00-10:00", "Tuesday 14:00-15:00").
- `Rooms`: Available classrooms (e.g., "Room-101", "Lab-A").
- `Teachers`: Available instructors (e.g., "Prof. Smith", "Dr. Jones").

**Constraints:**

1. **Hard Constraints (Must be satisfied):**
   - **Room Conflict:** A room cannot be assigned to multiple sessions at the same time.
   - **Teacher Conflict:** A teacher cannot teach multiple sessions at the same time.
   - **Batch Conflict:** A batch of students cannot attend multiple sessions at the same time.
   - **Room Capacity:** Session enrollment must not exceed room capacity.

2. **Soft Constraints (Optimization goals):**
   - **Minimize Teacher Gaps:** Reduce idle time between consecutive sessions for teachers.
   - **Maximize Room Utilization:** Prefer filling larger rooms before smaller ones.
   - **Balanced Workload:** Distribute sessions evenly across days of the week.

**CSP Solver Implementation:**

```python
from constraint import Problem, AllDifferentConstraint

def generate_schedule(sessions, time_slots, rooms, teachers):
    problem = Problem()
    
    # Define variables: each session needs a (time_slot, room, teacher) assignment
    for session in sessions:
        problem.addVariable(session.id, [
            (ts, room, teacher) 
            for ts in time_slots 
            for room in rooms 
            for teacher in teachers
            if is_valid_assignment(session, ts, room, teacher)
        ])
    
    # Add hard constraints
    problem.addConstraint(no_room_conflict, sessions)
    problem.addConstraint(no_teacher_conflict, sessions)
    problem.addConstraint(no_batch_conflict, sessions)
    
    # Solve and return top 3 solutions
    solutions = problem.getSolutions()
    return rank_solutions_by_soft_constraints(solutions)[:3]
```

**Genetic Algorithm Alternative:**

For large-scale scheduling (1000+ sessions), CSP may be too slow. Use Genetic Algorithms instead.

**GA Workflow:**

1. **Initialize Population:** Generate 100 random schedules.
2. **Fitness Function:** Score each schedule based on:
   - Hard constraint violations (penalty: -1000 per violation).
   - Soft constraint satisfaction (reward: +10 per optimized metric).
3. **Selection:** Select top 20% of schedules (fittest individuals).
4. **Crossover:** Combine pairs of schedules to create offspring.
5. **Mutation:** Randomly swap time slots/rooms in 10% of schedules.
6. **Iterate:** Repeat for 500 generations or until convergence.
7. **Output:** Return top 3 schedules with highest fitness scores.

**Human-in-the-Loop Workflow:**

1. **Admin initiates "Auto-Schedule":**
   - Selects academic term, batches, and constraints.
   - Clicks "Generate Schedule Options".

2. **AI generates 3 proposals:**
   ```json
   {
     "proposals": [
       {
         "proposal_id": "uuid-1",
         "fitness_score": 0.92,
         "hard_constraint_violations": 0,
         "soft_constraint_score": 87,
         "summary": {
           "avg_teacher_gap_minutes": 15,
           "room_utilization_percent": 85,
           "sessions_scheduled": 450
         }
       },
       {
         "proposal_id": "uuid-2",
         "fitness_score": 0.89,
         "hard_constraint_violations": 0,
         "soft_constraint_score": 82,
         "summary": { /* ... */ }
       },
       {
         "proposal_id": "uuid-3",
         "fitness_score": 0.85,
         "hard_constraint_violations": 0,
         "soft_constraint_score": 78,
         "summary": { /* ... */ }
       }
     ]
   }
   ```

3. **Admin reviews proposals:**
   - Views each schedule in a calendar UI.
   - Compares metrics (teacher gaps, room utilization).
   - Can manually tweak individual sessions.

4. **Admin publishes ONE schedule:**
   - Clicks "Publish Proposal 1".
   - System marks the schedule as `status: 'published'`.
   - **Critical:** The AI cannot auto-publish; human approval is mandatory.

5. **Change propagation:**
   - All affected stakeholders (teachers, students) receive notifications.
   - Calendar integrations (Google Calendar, Outlook) are updated.

**Temporary Overrides:**

For one-off changes (e.g., "Substitute teacher for one day"), the system supports exceptions:

```sql
INSERT INTO schedule_overrides (
  override_id, session_id, original_teacher_id, 
  substitute_teacher_id, override_date, reason
) VALUES (
  'uuid-v4', 'session-uuid', 'teacher-1-uuid',
  'teacher-2-uuid', '2026-02-10', 'Teacher 1 on medical leave'
);
```

The recurring schedule remains unchanged; only the specific date is overridden.

#### 3.2.3 Predictive Academic Risk Engine (Requirement 34)

**XGBoost Regression Model for Dropout Prediction:**

The system computes a nightly "Engagement Risk Score" (0-100) for every active student.

**Model Architecture:**

**Training Data:**
- Historical data from the last 2 academic years.
- Features: Attendance rate, assignment submission latency, LMS login frequency, grade trends.
- Target: Binary label (0 = retained, 1 = dropped out).

**Feature Engineering:**

```python
features = {
  # Attendance features
  "attendance_rate_30d": 0.72,  # Last 30 days
  "attendance_rate_90d": 0.85,  # Last 90 days
  "consecutive_absences": 3,
  "late_arrivals_30d": 5,
  
  # Assignment features
  "assignments_submitted_on_time_30d": 4,
  "assignments_submitted_late_30d": 2,
  "assignments_not_submitted_30d": 1,
  "avg_submission_delay_hours": 18.5,
  
  # LMS engagement features
  "lms_logins_30d": 12,
  "avg_session_duration_minutes": 25,
  "forum_posts_30d": 2,
  "video_watch_completion_rate": 0.65,
  
  # Academic performance features
  "current_gpa": 2.8,
  "gpa_trend": -0.3,  # Declining
  "failed_courses_current_term": 1,
  
  # Demographic features (for bias monitoring)
  "age": 19,
  "gender": "female",
  "socioeconomic_status": "low_income"
}
```

**Model Training:**

```python
import xgboost as xgb
from sklearn.model_selection import train_test_split

# Load historical data
X_train, X_test, y_train, y_test = train_test_split(features, labels, test_size=0.2)

# Train XGBoost model
model = xgb.XGBClassifier(
    max_depth=6,
    learning_rate=0.1,
    n_estimators=100,
    objective='binary:logistic'
)
model.fit(X_train, y_train)

# Evaluate
accuracy = model.score(X_test, y_test)
print(f"Model accuracy: {accuracy}")

# Save model
model.save_model("risk_model_v2.1.json")
```

**Nightly Batch Inference:**

Every night at 2:00 AM, the system runs batch inference on all active students:

```python
def compute_risk_scores():
    students = get_active_students()
    
    for student in students:
        features = extract_features(student)
        risk_probability = model.predict_proba([features])[0][1]
        risk_score = int(risk_probability * 100)  # Scale to 0-100
        
        # Generate explanation using SHAP
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values([features])
        top_factors = get_top_contributing_factors(shap_values)
        
        # Store result
        store_risk_score(student.id, risk_score, top_factors)
```

**Explainability (SHAP Values):**

For high-risk students (score > 75), the system generates a natural language explanation:

```python
def generate_explanation(shap_values, features):
    top_factors = sorted(
        zip(feature_names, shap_values),
        key=lambda x: abs(x[1]),
        reverse=True
    )[:3]
    
    explanation = "Risk elevated due to: "
    reasons = []
    
    for feature, impact in top_factors:
        if feature == "consecutive_absences" and impact > 0:
            reasons.append(f"{features['consecutive_absences']} consecutive absences")
        elif feature == "assignments_not_submitted_30d" and impact > 0:
            reasons.append(f"{features['assignments_not_submitted_30d']} missed assignments this month")
        elif feature == "lms_logins_30d" and impact > 0:
            reasons.append(f"only {features['lms_logins_30d']} LMS logins in 30 days")
    
    return explanation + ", ".join(reasons) + "."
```

**Example Output:**
```json
{
  "student_id": "student-uuid",
  "risk_score": 82,
  "risk_level": "high",
  "explanation": "Risk elevated due to: 3 consecutive absences, 2 missed assignments this month, only 8 LMS logins in 30 days.",
  "top_factors": [
    { "feature": "consecutive_absences", "impact": 0.35 },
    { "feature": "assignments_not_submitted_30d", "impact": 0.28 },
    { "feature": "lms_logins_30d", "impact": 0.22 }
  ],
  "computed_at": "2026-02-04T02:00:00Z"
}
```

**Privacy and Access Control:**

- Risk scores are visible ONLY to authorized staff (Teachers, Counselors, Admins).
- Students NEVER see their own risk scores.
- Access is logged in the audit trail.

**Intervention Logging:**

When a counselor intervenes, they log the action:

```sql
INSERT INTO risk_interventions (
  intervention_id, student_id, risk_score_at_intervention,
  intervention_type, notes, counselor_id, created_at
) VALUES (
  'uuid-v4', 'student-uuid', 82,
  'one_on_one_meeting', 'Discussed academic challenges and created action plan',
  'counselor-uuid', NOW()
);
```

**Model Retraining:**

- Intervention outcomes (student retained vs. dropped out) are used to retrain the model quarterly.
- This creates a feedback loop that improves prediction accuracy over time.

---

### 3.3 Core Domain Logic

#### 3.3.1 Dynamic Form and Field Configuration Engine (Requirement 4)

**Field-Level RBAC Enforcement:**

Every field in a form defines granular permissions that are enforced at the API/server level.

**Field Definition Schema:**

```json
{
  "field_id": "medical_history",
  "field_type": "textarea",
  "label": "Medical History",
  "required": false,
  "visible_to_roles": ["admin", "nurse", "guardian"],
  "editable_by_roles": ["admin", "nurse"],
  "consent_required": true,
  "consent_purpose": "medical_records_storage",
  "retention_policy": "delete_1_year_after_graduation",
  "validation_rules": {
    "max_length": 5000,
    "pattern": null
  },
  "audit_access": true
}
```

**Server-Side Enforcement:**

When a user requests access to a field, the server checks permissions:

```javascript
async function checkFieldAccess(userId, fieldId, action) {
  const user = await getUserById(userId);
  const field = await getFieldDefinition(fieldId);
  
  // Check visibility
  if (action === 'read') {
    if (!field.visible_to_roles.includes(user.role)) {
      throw new ForbiddenError(`User role '${user.role}' cannot view field '${fieldId}'`);
    }
  }
  
  // Check editability
  if (action === 'write') {
    if (!field.editable_by_roles.includes(user.role)) {
      throw new ForbiddenError(`User role '${user.role}' cannot edit field '${fieldId}'`);
    }
  }
  
  // Check consent
  if (field.consent_required) {
    const consent = await getConsent(userId, field.consent_purpose);
    if (!consent || consent.status !== 'granted') {
      throw new ConsentRequiredError(`Consent required for purpose: ${field.consent_purpose}`);
    }
  }
  
  // Log access to sensitive fields
  if (field.audit_access) {
    await logFieldAccess(userId, fieldId, action);
  }
  
  return true;
}
```

**API Endpoint Example:**

```javascript
POST /api/v1/students/:studentId/fields/:fieldId
Authorization: Bearer <token>

{
  "value": "Patient has asthma, requires inhaler"
}

// Server response
{
  "success": true,
  "field_id": "medical_history",
  "updated_at": "2026-02-04T10:30:00Z"
}

// If permission denied
{
  "error": "Forbidden",
  "message": "User role 'teacher' cannot edit field 'medical_history'"
}
```

**Consent Management:**

Fields marked `consent_required` block access until a valid consent record exists.

**Consent Record Schema:**

```json
{
  "consent_id": "uuid-v4",
  "user_id": "student-uuid",
  "guardian_id": "guardian-uuid",  // For minors
  "purpose": "medical_records_storage",
  "status": "granted | withdrawn | expired",
  "consent_version": "v1.2",
  "granted_at": "2026-01-15T09:00:00Z",
  "expires_at": "2027-01-15T09:00:00Z",
  "withdrawal_reason": null
}
```

**Consent Withdrawal:**

If a user withdraws consent, the system stops processing affected data within 72 hours:

```sql
UPDATE consents
SET status = 'withdrawn',
    withdrawn_at = NOW(),
    withdrawal_reason = 'User requested data deletion'
WHERE consent_id = 'uuid-v4';

-- Trigger data deletion job
INSERT INTO data_deletion_queue (
  job_id, user_id, purpose, scheduled_for
) VALUES (
  'uuid-v4', 'student-uuid', 'medical_records_storage', NOW() + INTERVAL '72 hours'
);
```

**Retention Policies:**

Fields with retention policies are automatically deleted after the specified period:

```sql
-- Nightly job to enforce retention policies
DELETE FROM student_field_values
WHERE field_id IN (
  SELECT field_id FROM field_definitions
  WHERE retention_policy = 'delete_1_year_after_graduation'
)
AND student_id IN (
  SELECT student_id FROM students
  WHERE graduation_date < NOW() - INTERVAL '1 year'
);
```

**Validation Performance:**

Server-side validation rules are enforced with sub-5ms latency:

```javascript
async function validateField(fieldId, value) {
  const field = await getFieldDefinition(fieldId);  // Cached in Redis
  const rules = field.validation_rules;
  
  // Max length check
  if (rules.max_length && value.length > rules.max_length) {
    throw new ValidationError(`Value exceeds max length of ${rules.max_length}`);
  }
  
  // Pattern check (regex)
  if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
    throw new ValidationError(`Value does not match required pattern`);
  }
  
  // Custom validation function
  if (rules.custom_validator) {
    const isValid = await executeCustomValidator(rules.custom_validator, value);
    if (!isValid) {
      throw new ValidationError(`Custom validation failed`);
    }
  }
  
  return true;
}
```

**Audit Logging:**

Access to sensitive fields is logged with cryptographic integrity:

```sql
INSERT INTO field_access_log (
  log_id, user_id, field_id, action, 
  student_id, timestamp, log_hash
) VALUES (
  'uuid-v4', 'user-uuid', 'medical_history', 'read',
  'student-uuid', NOW(), 
  encode(digest('user-uuid|medical_history|read|timestamp', 'sha256'), 'hex')
);
```

#### 3.3.2 User Lifecycle State Management (Requirement 20)

**State Machine:**

Users transition through explicit states: `Active → Suspended → Archived → Soft-Deleted`.

**State Definitions:**

- **Active:** User can log in and access the system normally.
- **Suspended:** User cannot log in; temporary restriction (e.g., disciplinary action).
- **Archived:** User is no longer active but data is retained (e.g., graduated student).
- **Soft-Deleted:** User is marked for deletion; data will be purged after retention period.

**State Transition Rules:**

```javascript
const STATE_TRANSITIONS = {
  'active': ['suspended', 'archived'],
  'suspended': ['active', 'archived'],
  'archived': ['active'],  // Reactivation allowed
  'soft_deleted': []  // Terminal state (no transitions)
};

function canTransition(currentState, newState) {
  return STATE_TRANSITIONS[currentState]?.includes(newState) || false;
}
```

**Database Schema:**

```sql
CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  status_changed_at TIMESTAMPTZ,
  status_changed_by UUID,
  status_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('active', 'suspended', 'archived', 'soft_deleted'))
);

CREATE INDEX idx_user_status ON users(status);
```

**State Transition API:**

```javascript
POST /api/v1/users/:userId/status
Authorization: Bearer <admin-token>

{
  "new_status": "suspended",
  "reason": "Violation of academic integrity policy",
  "effective_date": "2026-02-05T00:00:00Z"
}

// Server validates transition
if (!canTransition(user.status, request.new_status)) {
  throw new InvalidTransitionError(
    `Cannot transition from '${user.status}' to '${request.new_status}'`
  );
}

// Update user status
UPDATE users
SET status = 'suspended',
    status_changed_at = NOW(),
    status_changed_by = 'admin-uuid',
    status_reason = 'Violation of academic integrity policy'
WHERE user_id = 'user-uuid';

// Log state change
INSERT INTO user_status_history (
  history_id, user_id, old_status, new_status,
  changed_by, changed_at, reason
) VALUES (
  'uuid-v4', 'user-uuid', 'active', 'suspended',
  'admin-uuid', NOW(), 'Violation of academic integrity policy'
);
```

**Soft-Delete Workflow:**

By default, the system performs soft-deletes. Hard deletes require specific policy approval.

```sql
-- Soft-delete user
UPDATE users
SET status = 'soft_deleted',
    deleted_at = NOW(),
    status_changed_by = 'admin-uuid',
    status_reason = 'User requested account deletion'
WHERE user_id = 'user-uuid';

-- User data is retained but inaccessible
-- Authentication is blocked
SELECT * FROM users WHERE user_id = 'user-uuid' AND status != 'soft_deleted';
-- Returns no results
```

**Ownership Transfer:**

When a user is deleted/archived, their assets (classes, documents) must be transferred:

```javascript
POST /api/v1/users/:userId/transfer-ownership
Authorization: Bearer <admin-token>

{
  "new_owner_id": "new-teacher-uuid",
  "asset_types": ["classes", "documents", "assignments"],
  "transfer_reason": "Teacher resignation"
}

// Server executes transfer
UPDATE classes SET teacher_id = 'new-teacher-uuid' WHERE teacher_id = 'old-teacher-uuid';
UPDATE documents SET owner_id = 'new-teacher-uuid' WHERE owner_id = 'old-teacher-uuid';
UPDATE assignments SET created_by = 'new-teacher-uuid' WHERE created_by = 'old-teacher-uuid';

// Log transfer
INSERT INTO ownership_transfers (
  transfer_id, old_owner_id, new_owner_id,
  asset_count, transferred_by, transferred_at
) VALUES (
  'uuid-v4', 'old-teacher-uuid', 'new-teacher-uuid',
  45, 'admin-uuid', NOW()
);
```

**Reactivation Workflow:**

Soft-deleted users can be restored with approval:

```javascript
POST /api/v1/users/:userId/reactivate
Authorization: Bearer <admin-token>

{
  "approval_token": "signed-jwt-token",
  "reactivation_reason": "User requested account restoration"
}

// Validate approval token
if (!verifyApprovalToken(request.approval_token)) {
  throw new UnauthorizedError('Invalid approval token');
}

// Restore user
UPDATE users
SET status = 'active',
    deleted_at = NULL,
    status_changed_at = NOW(),
    status_changed_by = 'admin-uuid',
    status_reason = 'User requested account restoration'
WHERE user_id = 'user-uuid';
```

---

#### 3.3.3 Academic Policy & Rule Engine (Requirement 21)

**Real-Time Rule Evaluation:**

The system enforces academic policies (e.g., "Minimum 75% attendance for exam eligibility") in real-time.

**Rule Definition Schema:**

```json
{
  "rule_id": "attendance_eligibility",
  "rule_name": "Minimum Attendance for Exam Eligibility",
  "rule_type": "eligibility",
  "condition": {
    "operator": ">=",
    "left_operand": "student.attendance_rate_current_term",
    "right_operand": 0.75
  },
  "action": {
    "type": "block_exam_registration",
    "message": "You must have at least 75% attendance to be eligible for exams."
  },
  "effective_from": "2026-01-01T00:00:00Z",
  "effective_until": null,
  "applies_to": {
    "programs": ["undergraduate"],
    "courses": ["all"]
  },
  "override_allowed": true,
  "override_requires_approval": true
}
```

**Rule Evaluation Engine:**

```javascript
async function evaluateRule(ruleId, studentId, context) {
  const rule = await getRule(ruleId);
  const student = await getStudent(studentId);
  
  // Evaluate condition
  const leftValue = resolveOperand(rule.condition.left_operand, student, context);
  const rightValue = resolveOperand(rule.condition.right_operand, student, context);
  const result = evaluateOperator(rule.condition.operator, leftValue, rightValue);
  
  return {
    rule_id: ruleId,
    student_id: studentId,
    result: result,  // true or false
    evaluated_at: new Date(),
    context: context
  };
}

function resolveOperand(operand, student, context) {
  // Handle dynamic operands like "student.attendance_rate_current_term"
  if (operand.startsWith('student.')) {
    const field = operand.replace('student.', '');
    return student[field];
  }
  // Handle static values
  return operand;
}

function evaluateOperator(operator, left, right) {
  switch (operator) {
    case '>=': return left >= right;
    case '<=': return left <= right;
    case '==': return left == right;
    case '>': return left > right;
    case '<': return left < right;
    default: throw new Error(`Unknown operator: ${operator}`);
  }
}
```

**Real-Time Trigger:**

Rules are evaluated when relevant data changes:

```javascript
// When attendance is marked
async function markAttendance(studentId, sessionId, status) {
  // Update attendance record
  await createAttendanceRecord(studentId, sessionId, status);
  
  // Recalculate attendance rate
  const attendanceRate = await calculateAttendanceRate(studentId);
  await updateStudent(studentId, { attendance_rate_current_term: attendanceRate });
  
  // Trigger rule evaluation
  const rules = await getRulesForStudent(studentId);
  for (const rule of rules) {
    const result = await evaluateRule(rule.rule_id, studentId, { trigger: 'attendance_update' });
    
    if (!result.result && rule.action.type === 'block_exam_registration') {
      await blockExamRegistration(studentId, rule.action.message);
    }
  }
}
```

**Manual Overrides:**

Admins can override rule enforcement with approval workflows:

```javascript
POST /api/v1/students/:studentId/rule-overrides
Authorization: Bearer <admin-token>

{
  "rule_id": "attendance_eligibility",
  "override_reason": "Student was hospitalized for 2 weeks with medical certificate",
  "override_duration": "current_term",
  "approval_required": true
}

// Create override request
INSERT INTO rule_overrides (
  override_id, student_id, rule_id, 
  requested_by, requested_at, reason,
  status, approval_required
) VALUES (
  'uuid-v4', 'student-uuid', 'attendance_eligibility',
  'admin-uuid', NOW(), 'Student was hospitalized...',
  'pending_approval', true
);

// If approval required, create approval workflow
INSERT INTO approval_workflows (
  workflow_id, workflow_type, entity_id,
  approver_role, status, created_at
) VALUES (
  'uuid-v4', 'rule_override', 'override-uuid',
  'dean', 'pending', NOW()
);
```

**Approval Workflow:**

```javascript
POST /api/v1/approvals/:workflowId/approve
Authorization: Bearer <dean-token>

{
  "decision": "approved",
  "comments": "Medical certificate verified. Override granted."
}

// Update override status
UPDATE rule_overrides
SET status = 'approved',
    approved_by = 'dean-uuid',
    approved_at = NOW(),
    approver_comments = 'Medical certificate verified...'
WHERE override_id = 'override-uuid';

// Log in audit trail
INSERT INTO audit_log (
  log_id, action, entity_type, entity_id,
  performed_by, performed_at, details
) VALUES (
  'uuid-v4', 'rule_override_approved', 'rule_override', 'override-uuid',
  'dean-uuid', NOW(), '{"reason": "Medical certificate verified"}'
);
```

**Prospective vs. Retroactive Application:**

Policy changes apply prospectively by default:

```javascript
// New rule: "Minimum 80% attendance" (increased from 75%)
{
  "rule_id": "attendance_eligibility",
  "effective_from": "2026-03-01T00:00:00Z",  // Future date
  "condition": {
    "operator": ">=",
    "left_operand": "student.attendance_rate_current_term",
    "right_operand": 0.80  // Increased threshold
  }
}

// Students enrolled before 2026-03-01 are evaluated under old rule (75%)
// Students enrolled after 2026-03-01 are evaluated under new rule (80%)
```

**Retroactive Application (Requires Special Approval):**

```javascript
POST /api/v1/rules/:ruleId/apply-retroactively
Authorization: Bearer <superadmin-token>

{
  "retroactive_date": "2026-01-01T00:00:00Z",
  "approval_token": "signed-jwt-token",
  "justification": "Board decision to enforce stricter attendance policy"
}

// Requires dual-approval from SuperAdmin + Academic Dean
```

---

#### 3.3.4 Student Timeline & Academic Continuity (Requirement 24)

**Chronological Timeline View:**

The system maintains a unified timeline of all student events across years and programs.

**Timeline Event Schema:**

```json
{
  "event_id": "uuid-v4",
  "student_id": "student-uuid",
  "event_type": "enrollment | assessment | transfer | certificate | attendance | grade",
  "event_date": "2026-02-04T10:30:00Z",
  "event_data": {
    "program_id": "program-uuid",
    "course_id": "course-uuid",
    "grade": "A",
    "credits": 3
  },
  "source_system": "eduos | imported",
  "source_record_id": "grade-record-uuid",
  "cryptographic_signature": "rsa-signature",  // For milestones
  "created_at": "2026-02-04T10:30:00Z"
}
```

**Timeline Query API:**

```javascript
GET /api/v1/students/:studentId/timeline
Authorization: Bearer <token>

Query Parameters:
- start_date: "2024-01-01"
- end_date: "2026-12-31"
- event_types: ["enrollment", "assessment", "certificate"]
- include_lineage: true

Response:
{
  "student_id": "student-uuid",
  "timeline": [
    {
      "event_id": "uuid-1",
      "event_type": "enrollment",
      "event_date": "2024-09-01T00:00:00Z",
      "event_data": {
        "program_name": "Bachelor of Science in Computer Science",
        "batch": "2024-CS-A"
      }
    },
    {
      "event_id": "uuid-2",
      "event_type": "assessment",
      "event_date": "2024-12-15T14:00:00Z",
      "event_data": {
        "course_name": "Data Structures",
        "grade": "A",
        "credits": 4,
        "graded_by": "Prof. Smith"
      },
      "lineage": {
        "source": "grade_record",
        "record_id": "grade-uuid",
        "created_by": "teacher-uuid",
        "created_at": "2024-12-16T09:00:00Z"
      }
    },
    {
      "event_id": "uuid-3",
      "event_type": "certificate",
      "event_date": "2026-06-15T10:00:00Z",
      "event_data": {
        "certificate_type": "graduation",
        "degree": "Bachelor of Science",
        "gpa": 3.8,
        "honors": "Magna Cum Laude"
      },
      "cryptographic_signature": "rsa-signature-base64",
      "verification_url": "https://eduos.edu/verify/cert-uuid"
    }
  ]
}
```

**Data Lineage:**

Every timeline event includes lineage information for traceability:

```javascript
// Drill down into grade source
GET /api/v1/timeline/events/:eventId/lineage

Response:
{
  "event_id": "uuid-2",
  "lineage_chain": [
    {
      "level": 1,
      "entity_type": "grade_record",
      "entity_id": "grade-uuid",
      "created_by": "teacher-uuid",
      "created_at": "2024-12-16T09:00:00Z",
      "action": "grade_submitted"
    },
    {
      "level": 2,
      "entity_type": "assessment",
      "entity_id": "assessment-uuid",
      "created_by": "teacher-uuid",
      "created_at": "2024-12-15T14:00:00Z",
      "action": "exam_conducted"
    },
    {
      "level": 3,
      "entity_type": "course_enrollment",
      "entity_id": "enrollment-uuid",
      "created_by": "admin-uuid",
      "created_at": "2024-09-01T00:00:00Z",
      "action": "student_enrolled"
    }
  ]
}
```

**Portability (JSON-LD Export):**

Student records are exportable in a standardized JSON-LD format for transfer between institutions.

**JSON-LD Schema:**

```json
{
  "@context": "https://schema.org/",
  "@type": "Person",
  "@id": "https://eduos.edu/students/student-uuid",
  "identifier": "student-uuid",
  "name": "John Doe",
  "birthDate": "2005-03-15",
  "email": "john.doe@example.com",
  "alumniOf": {
    "@type": "EducationalOrganization",
    "name": "Example University",
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "US"
    }
  },
  "hasCredential": [
    {
      "@type": "EducationalOccupationalCredential",
      "name": "Bachelor of Science in Computer Science",
      "credentialCategory": "degree",
      "dateCreated": "2026-06-15",
      "educationalLevel": "undergraduate",
      "competencyRequired": "Completed 120 credits with GPA 3.8",
      "proof": {
        "@type": "DigitalDocument",
        "encodingFormat": "application/pdf",
        "url": "https://eduos.edu/certificates/cert-uuid.pdf",
        "sha256": "sha256-hash-of-certificate"
      }
    }
  ],
  "transcript": [
    {
      "@type": "Course",
      "name": "Data Structures",
      "courseCode": "CS201",
      "provider": {
        "@type": "EducationalOrganization",
        "name": "Example University"
      },
      "educationalCredentialAwarded": {
        "@type": "EducationalOccupationalCredential",
        "credentialCategory": "grade",
        "value": "A",
        "dateCreated": "2024-12-16"
      }
    }
  ]
}
```

**Export API:**

```javascript
GET /api/v1/students/:studentId/export
Authorization: Bearer <admin-token>

Query Parameters:
- format: "json-ld | pdf | xml"
- include_transcripts: true
- include_certificates: true
- signature_required: true

Response:
{
  "export_id": "uuid-v4",
  "student_id": "student-uuid",
  "format": "json-ld",
  "data": { /* JSON-LD document */ },
  "signature": "rsa-signature-base64",
  "exported_by": "admin-uuid",
  "exported_at": "2026-02-04T10:30:00Z"
}
```

**Credential Verification:**

Milestones (graduations, certificates) are cryptographically signed for third-party verification.

**Signing Process:**

```javascript
// Generate certificate
const certificate = {
  student_id: "student-uuid",
  degree: "Bachelor of Science",
  graduation_date: "2026-06-15",
  gpa: 3.8,
  institution: "Example University"
};

// Sign with institution's private key
const signature = crypto.sign(
  'sha256',
  Buffer.from(JSON.stringify(certificate)),
  institutionPrivateKey
);

// Store signature
await storeCertificate({
  ...certificate,
  signature: signature.toString('base64'),
  public_key_url: "https://eduos.edu/keys/institution-public-key.pem"
});
```

**Verification API (Public):**

```javascript
GET /api/v1/verify/certificate/:certificateId
No authentication required (public endpoint)

Response:
{
  "certificate_id": "cert-uuid",
  "student_name": "John Doe",
  "degree": "Bachelor of Science",
  "graduation_date": "2026-06-15",
  "institution": "Example University",
  "verification_status": "valid",
  "signature_valid": true,
  "verified_at": "2026-02-04T10:30:00Z"
}

// Verification process
1. Fetch certificate data
2. Fetch institution's public key from public_key_url
3. Verify signature: crypto.verify('sha256', certificateData, publicKey, signature)
4. Return verification result
```
### 3.3 User Lifecycle State Management (Requirement 20)

#### 3.3.1 User State Machine

**State Definitions:**

```javascript
const USER_STATES = {
  ACTIVE: 'active',           // User can log in and perform actions
  SUSPENDED: 'suspended',     // Temporary suspension, can be reactivated
  ARCHIVED: 'archived',       // Long-term inactive, data retained
  SOFT_DELETED: 'soft_deleted' // Marked for deletion, data retained for recovery period
};

class UserLifecycleManager {
  async transitionState(userId, newState, reason, performedBy) {
    const user = await db('users')
      .where({ user_id: userId })
      .first();
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Validate state transition
    const validTransitions = this.getValidTransitions(user.status);
    
    if (!validTransitions.includes(newState)) {
      throw new Error(`Invalid state transition from ${user.status} to ${newState}`);
    }
    
    // Create audit record
    await db('user_state_transitions').insert({
      transition_id: uuidv4(),
      user_id: userId,
      from_state: user.status,
      to_state: newState,
      reason: reason,
      performed_by: performedBy,
      transitioned_at: new Date()
    });
    
    // Update user state
    await db('users')
      .where({ user_id: userId })
      .update({
        status: newState,
        status_updated_at: new Date(),
        status_updated_by: performedBy
      });
    
    // Execute state-specific actions
    await this.executeStateActions(userId, newState);
    
    return { success: true, new_state: newState };
  }
  
  getValidTransitions(currentState) {
    const transitions = {
      'active': ['suspended', 'archived', 'soft_deleted'],
      'suspended': ['active', 'archived', 'soft_deleted'],
      'archived': ['active'],
      'soft_deleted': ['active'] // Can be restored within recovery period
    };
    
    return transitions[currentState] || [];
  }
  
  async executeStateActions(userId, newState) {
    switch (newState) {
      case 'suspended':
        // Revoke active sessions
        await db('user_sessions')
          .where({ user_id: userId, status: 'active' })
          .update({ status: 'revoked', revoked_at: new Date() });
        
        // Send notification
        await this.notifyUser(userId, 'account_suspended');
        break;
      
      case 'archived':
        // Revoke sessions
        await db('user_sessions')
          .where({ user_id: userId })
          .update({ status: 'revoked', revoked_at: new Date() });
        
        // Trigger ownership transfer wizard
        await this.initiateOwnershipTransfer(userId);
        break;
      
      case 'soft_deleted':
        // Revoke sessions
        await db('user_sessions')
          .where({ user_id: userId })
          .update({ status: 'revoked', revoked_at: new Date() });
        
        // Schedule hard delete after retention period (90 days)
        await db('scheduled_deletions').insert({
          deletion_id: uuidv4(),
          user_id: userId,
          scheduled_for: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          created_at: new Date()
        });
        
        // Trigger ownership transfer
        await this.initiateOwnershipTransfer(userId);
        break;
      
      case 'active':
        // Reactivation - cancel scheduled deletion if exists
        await db('scheduled_deletions')
          .where({ user_id: userId, status: 'pending' })
          .update({ status: 'cancelled', cancelled_at: new Date() });
        
        // Send welcome back notification
        await this.notifyUser(userId, 'account_reactivated');
        break;
    }
  }
}
```

---

#### 3.3.2 Ownership Transfer Wizard

**Asset Transfer Workflow:**

```javascript
class OwnershipTransferWizard {
  async initiateTransfer(userId) {
    // Identify all assets owned by user
    const assets = await this.identifyAssets(userId);
    
    // Create transfer session
    const transferSession = await db('ownership_transfer_sessions').insert({
      session_id: uuidv4(),
      user_id: userId,
      total_assets: assets.length,
      status: 'pending',
      created_at: new Date()
    });
    
    return {
      session_id: transferSession.session_id,
      assets: assets
    };
  }
  
  async identifyAssets(userId) {
    const assets = [];
    
    // Classes taught
    const classes = await db('classes')
      .where({ teacher_id: userId })
      .select('class_id', 'class_name');
    
    assets.push(...classes.map(c => ({
      type: 'class',
      id: c.class_id,
      name: c.class_name
    })));
    
    // Documents created
    const documents = await db('documents')
      .where({ created_by: userId })
      .select('document_id', 'title');
    
    assets.push(...documents.map(d => ({
      type: 'document',
      id: d.document_id,
      name: d.title
    })));
    
    // Assignments created
    const assignments = await db('assignments')
      .where({ created_by: userId })
      .select('assignment_id', 'title');
    
    assets.push(...assignments.map(a => ({
      type: 'assignment',
      id: a.assignment_id,
      name: a.title
    })));
    
    return assets;
  }
  
  async transferAssets(sessionId, assetTransfers) {
    // assetTransfers: [{ asset_type, asset_id, new_owner_id }]
    
    const transaction = await db.transaction();
    
    try {
      for (const transfer of assetTransfers) {
        switch (transfer.asset_type) {
          case 'class':
            await transaction('classes')
              .where({ class_id: transfer.asset_id })
              .update({ teacher_id: transfer.new_owner_id });
            break;
          
          case 'document':
            await transaction('documents')
              .where({ document_id: transfer.asset_id })
              .update({ created_by: transfer.new_owner_id });
            break;
          
          case 'assignment':
            await transaction('assignments')
              .where({ assignment_id: transfer.asset_id })
              .update({ created_by: transfer.new_owner_id });
            break;
        }
        
        // Log transfer
        await transaction('asset_transfer_log').insert({
          log_id: uuidv4(),
          session_id: sessionId,
          asset_type: transfer.asset_type,
          asset_id: transfer.asset_id,
          old_owner_id: transfer.old_owner_id,
          new_owner_id: transfer.new_owner_id,
          transferred_at: new Date()
        });
      }
      
      await transaction.commit();
      
      // Update session status
      await db('ownership_transfer_sessions')
        .where({ session_id: sessionId })
        .update({
          status: 'completed',
          completed_at: new Date()
        });
      
      return { success: true, transferred_count: assetTransfers.length };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
```

---

#### 3.3.3 Reactivation Workflow

**Restoration Process:**

```javascript
class UserReactivation {
  async requestReactivation(userId, requestedBy, reason) {
    const user = await db('users')
      .where({ user_id: userId })
      .first();
    
    if (!['soft_deleted', 'archived'].includes(user.status)) {
      throw new Error('User cannot be reactivated from current state');
    }
    
    // Create reactivation request
    const request = await db('reactivation_requests').insert({
      request_id: uuidv4(),
      user_id: userId,
      requested_by: requestedBy,
      reason: reason,
      status: 'pending_approval',
      created_at: new Date()
    });
    
    // Notify approvers
    await this.notifyApprovers(request.request_id);
    
    return request;
  }
  
  async approveReactivation(requestId, approverId) {
    const request = await db('reactivation_requests')
      .where({ request_id: requestId })
      .first();
    
    if (!request) {
      throw new Error('Request not found');
    }
    
    // Transition user to active state
    const lifecycle = new UserLifecycleManager();
    await lifecycle.transitionState(
      request.user_id,
      'active',
      `Reactivation approved by ${approverId}`,
      approverId
    );
    
    // Update request status
    await db('reactivation_requests')
      .where({ request_id: requestId })
      .update({
        status: 'approved',
        approved_by: approverId,
        approved_at: new Date()
      });
    
    return { success: true, message: 'User reactivated successfully' };
  }
}
```

---

### 3.4 Academic Policy & Rule Engine (Requirement 21)

#### 3.4.1 Rule Configuration System

**Rule Definition Schema:**

```javascript
class AcademicRuleEngine {
  constructor() {
    this.rules = [];
  }
  
  async defineRule(ruleConfig) {
    // Rule configuration
    const rule = await db('academic_rules').insert({
      rule_id: uuidv4(),
      tenant_id: ruleConfig.tenant_id,
      rule_name: ruleConfig.name,
      rule_type: ruleConfig.type, // 'attendance', 'grading', 'eligibility'
      condition: ruleConfig.condition, // JSON expression
      action: ruleConfig.action,
      priority: ruleConfig.priority || 100,
      effective_from: ruleConfig.effective_from || new Date(),
      effective_until: ruleConfig.effective_until,
      status: 'active',
      created_by: ruleConfig.created_by,
      created_at: new Date()
    });
    
    return rule;
  }
  
  async evaluateRule(ruleId, context) {
    const rule = await db('academic_rules')
      .where({ rule_id: ruleId, status: 'active' })
      .first();
    
    if (!rule) {
      throw new Error('Rule not found or inactive');
    }
    
    // Check if rule is effective
    const now = new Date();
    if (rule.effective_from > now || (rule.effective_until && rule.effective_until < now)) {
      return { applicable: false, reason: 'Rule not effective at this time' };
    }
    
    // Evaluate condition
    const conditionMet = await this.evaluateCondition(rule.condition, context);
    
    if (conditionMet) {
      // Execute action
      const result = await this.executeAction(rule.action, context);
      
      // Log evaluation
      await db('rule_evaluations').insert({
        evaluation_id: uuidv4(),
        rule_id: ruleId,
        context: context,
        condition_met: true,
        action_result: result,
        evaluated_at: new Date()
      });
      
      return { applicable: true, action_executed: true, result: result };
    }
    
    return { applicable: true, condition_met: false };
  }
  
  async evaluateCondition(condition, context) {
    // Example conditions:
    // { "field": "attendance_percentage", "operator": ">=", "value": 75 }
    // { "field": "grade_average", "operator": "<", "value": 40 }
    
    const fieldValue = context[condition.field];
    
    switch (condition.operator) {
      case '>=':
        return fieldValue >= condition.value;
      case '<=':
        return fieldValue <= condition.value;
      case '>':
        return fieldValue > condition.value;
      case '<':
        return fieldValue < condition.value;
      case '==':
        return fieldValue == condition.value;
      case '!=':
        return fieldValue != condition.value;
      default:
        throw new Error(`Unknown operator: ${condition.operator}`);
    }
  }
  
  async executeAction(action, context) {
    switch (action.type) {
      case 'set_eligibility':
        await db('student_eligibility')
          .where({ student_id: context.student_id })
          .update({
            exam_eligible: action.value,
            reason: action.reason,
            updated_at: new Date()
          });
        return { success: true, action: 'eligibility_updated' };
      
      case 'apply_grace_marks':
        const graceMarks = Math.min(action.max_grace, action.value);
        await db('grades')
          .where({ grade_id: context.grade_id })
          .update({
            grace_marks: graceMarks,
            final_score: db.raw('score + ?', [graceMarks]),
            updated_at: new Date()
          });
        return { success: true, action: 'grace_marks_applied', value: graceMarks };
      
      case 'send_notification':
        await this.sendNotification(context.student_id, action.message);
        return { success: true, action: 'notification_sent' };
      
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }
}
```

**Example Rule Definitions:**

```javascript
// Rule 1: Minimum 75% attendance for exam eligibility
const attendanceRule = {
  name: 'Minimum Attendance for Exam Eligibility',
  type: 'attendance',
  condition: {
    field: 'attendance_percentage',
    operator: '<',
    value: 75
  },
  action: {
    type: 'set_eligibility',
    value: false,
    reason: 'Attendance below 75% threshold'
  },
  priority: 100,
  effective_from: new Date('2026-01-01')
};

// Rule 2: Grace marks up to 5%
const graceMarksRule = {
  name: 'Grace Marks Policy',
  type: 'grading',
  condition: {
    field: 'score',
    operator: '>=',
    value: 35
  },
  action: {
    type: 'apply_grace_marks',
    max_grace: 5,
    value: 5
  },
  priority: 50
};
```

---

#### 3.4.2 Real-Time Rule Evaluation

**Trigger-Based Evaluation:**

```javascript
class RealTimeRuleEvaluator {
  async onAttendanceUpdate(studentId) {
    // Calculate current attendance percentage
    const attendance = await db('attendance_records')
      .where({ student_id: studentId })
      .select(
        db.raw('COUNT(*) as total_classes'),
        db.raw('SUM(CASE WHEN status = \'present\' THEN 1 ELSE 0 END) as present_count')
      )
      .first();
    
    const attendancePercentage = (attendance.present_count / attendance.total_classes) * 100;
    
    // Evaluate all attendance-related rules
    const rules = await db('academic_rules')
      .where({ rule_type: 'attendance', status: 'active' });
    
    const ruleEngine = new AcademicRuleEngine();
    
    for (const rule of rules) {
      await ruleEngine.evaluateRule(rule.rule_id, {
        student_id: studentId,
        attendance_percentage: attendancePercentage
      });
    }
  }
  
  async onGradeUpdate(gradeId) {
    const grade = await db('grades')
      .where({ grade_id: gradeId })
      .first();
    
    // Evaluate all grading-related rules
    const rules = await db('academic_rules')
      .where({ rule_type: 'grading', status: 'active' });
    
    const ruleEngine = new AcademicRuleEngine();
    
    for (const rule of rules) {
      await ruleEngine.evaluateRule(rule.rule_id, {
        student_id: grade.student_id,
        grade_id: gradeId,
        score: grade.score
      });
    }
  }
}
```

---

#### 3.4.3 Manual Overrides with Approval

**Override Workflow:**

```javascript
class RuleOverrideManager {
  async requestOverride(ruleId, studentId, reason, requestedBy) {
    const override = await db('rule_overrides').insert({
      override_id: uuidv4(),
      rule_id: ruleId,
      student_id: studentId,
      reason: reason,
      requested_by: requestedBy,
      status: 'pending_approval',
      created_at: new Date()
    });
    
    // Notify approvers
    await this.notifyApprovers(override.override_id);
    
    return override;
  }
  
  async approveOverride(overrideId, approverId, approvalReason) {
    const override = await db('rule_overrides')
      .where({ override_id: overrideId })
      .first();
    
    if (!override) {
      throw new Error('Override request not found');
    }
    
    // Apply override
    await db('rule_overrides')
      .where({ override_id: overrideId })
      .update({
        status: 'approved',
        approved_by: approverId,
        approval_reason: approvalReason,
        approved_at: new Date()
      });
    
    // Execute override action (e.g., manually set eligibility)
    await db('student_eligibility')
      .where({ student_id: override.student_id })
      .update({
        exam_eligible: true,
        override_applied: true,
        override_id: overrideId,
        updated_at: new Date()
      });
    
    return { success: true, message: 'Override approved and applied' };
  }
}
```

---

#### 3.4.4 Prospective vs Retroactive Application

**Policy Change Management:**

```javascript
class PolicyChangeManager {
  async updateRule(ruleId, newConfig, applicationMode) {
    // applicationMode: 'prospective' or 'retroactive'
    
    const oldRule = await db('academic_rules')
      .where({ rule_id: ruleId })
      .first();
    
    if (applicationMode === 'prospective') {
      // Apply to future evaluations only
      await db('academic_rules')
        .where({ rule_id: ruleId })
        .update({
          ...newConfig,
          effective_from: new Date(),
          updated_at: new Date()
        });
      
      return { success: true, mode: 'prospective' };
    } else if (applicationMode === 'retroactive') {
      // Requires special approval
      const approvalRequest = await db('retroactive_policy_requests').insert({
        request_id: uuidv4(),
        rule_id: ruleId,
        old_config: oldRule,
        new_config: newConfig,
        status: 'pending_approval',
        created_at: new Date()
      });
      
      return { 
        success: false, 
        mode: 'retroactive', 
        requires_approval: true,
        request_id: approvalRequest.request_id
      };
    }
  }
  
  async applyRetroactively(requestId, approverId) {
    const request = await db('retroactive_policy_requests')
      .where({ request_id: requestId })
      .first();
    
    // Update rule
    await db('academic_rules')
      .where({ rule_id: request.rule_id })
      .update({
        ...request.new_config,
        updated_at: new Date()
      });
    
    // Re-evaluate all affected students
    const affectedStudents = await this.identifyAffectedStudents(request.rule_id);
    
    const ruleEngine = new AcademicRuleEngine();
    for (const student of affectedStudents) {
      await ruleEngine.evaluateRule(request.rule_id, student.context);
    }
    
    // Update request status
    await db('retroactive_policy_requests')
      .where({ request_id: requestId })
      .update({
        status: 'approved',
        approved_by: approverId,
        approved_at: new Date(),
        affected_count: affectedStudents.length
      });
    
    return { 
      success: true, 
      affected_students: affectedStudents.length 
    };
  }
}
```

---

### 3.5 Student Timeline & Academic Continuity (Requirement 24)

#### 3.5.1 Chronological Timeline View

**Timeline Data Model:**

```javascript
class StudentTimeline {
  async getTimeline(studentId) {
    // Fetch all timeline events
    const events = [];
    
    // Enrollments
    const enrollments = await db('enrollments')
      .where({ student_id: studentId })
      .select('enrollment_id', 'program_id', 'enrolled_at', 'status');
    
    events.push(...enrollments.map(e => ({
      type: 'enrollment',
      id: e.enrollment_id,
      timestamp: e.enrolled_at,
      data: e
    })));
    
    // Assessments
    const assessments = await db('grades')
      .where({ student_id: studentId })
      .select('grade_id', 'assessment_id', 'score', 'finalized_at');
    
    events.push(...assessments.map(a => ({
      type: 'assessment',
      id: a.grade_id,
      timestamp: a.finalized_at,
      data: a
    })));
    
    // Transfers
    const transfers = await db('student_transfers')
      .where({ student_id: studentId })
      .select('transfer_id', 'from_program', 'to_program', 'transferred_at');
    
    events.push(...transfers.map(t => ({
      type: 'transfer',
      id: t.transfer_id,
      timestamp: t.transferred_at,
      data: t
    })));
    
    // Certificates
    const certificates = await db('certificates')
      .where({ student_id: studentId })
      .select('certificate_id', 'certificate_type', 'issued_at', 'signature');
    
    events.push(...certificates.map(c => ({
      type: 'certificate',
      id: c.certificate_id,
      timestamp: c.issued_at,
      data: c
    })));
    
    // Sort by timestamp
    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    return events;
  }
  
  async getTimelineWithLineage(studentId, eventId) {
    // Get specific event with full data lineage
    const event = await this.getEvent(eventId);
    
    // Trace lineage
    const lineage = await this.traceLineage(event);
    
    return {
      event: event,
      lineage: lineage
    };
  }
  
  async traceLineage(event) {
    const lineage = [];
    
    switch (event.type) {
      case 'assessment':
        // Trace grade lineage
        const grade = await db('grades')
          .where({ grade_id: event.id })
          .first();
        
        lineage.push({
          step: 'grade_recorded',
          timestamp: grade.created_at,
          recorded_by: grade.recorded_by,
          source: 'manual_entry'
        });
        
        if (grade.modified_at) {
          lineage.push({
            step: 'grade_modified',
            timestamp: grade.modified_at,
            modified_by: grade.modified_by,
            reason: grade.modification_reason
          });
        }
        
        if (grade.finalized_at) {
          lineage.push({
            step: 'grade_finalized',
            timestamp: grade.finalized_at,
            finalized_by: grade.finalized_by,
            signature: grade.signature
          });
        }
        break;
      
      case 'enrollment':
        // Trace enrollment lineage
        const enrollment = await db('enrollments')
          .where({ enrollment_id: event.id })
          .first();
        
        lineage.push({
          step: 'enrollment_created',
          timestamp: enrollment.enrolled_at,
          created_by: enrollment.created_by
        });
        break;
    }
    
    return lineage;
  }
}
```

---

#### 3.5.2 Portable Student Records (JSON-LD Export)

**JSON-LD Export Format:**

```javascript
class StudentRecordExporter {
  async exportToJSONLD(studentId) {
    const student = await db('students')
      .where({ student_id: studentId })
      .first();
    
    const timeline = new StudentTimeline();
    const events = await timeline.getTimeline(studentId);
    
    // Generate JSON-LD document
    const jsonLD = {
      "@context": "https://schema.org/",
      "@type": "Person",
      "@id": `urn:uuid:${studentId}`,
      "identifier": studentId,
      "givenName": student.first_name,
      "familyName": student.last_name,
      "birthDate": student.date_of_birth,
      "educationalCredential": [],
      "hasCredential": []
    };
    
    // Add enrollments
    const enrollments = events.filter(e => e.type === 'enrollment');
    jsonLD.educationalCredential = enrollments.map(e => ({
      "@type": "EducationalOccupationalCredential",
      "credentialCategory": "enrollment",
      "dateCreated": e.timestamp,
      "educationalLevel": e.data.program_id
    }));
    
    // Add certificates
    const certificates = events.filter(e => e.type === 'certificate');
    jsonLD.hasCredential = certificates.map(c => ({
      "@type": "EducationalOccupationalCredential",
      "credentialCategory": c.data.certificate_type,
      "dateCreated": c.timestamp,
      "proof": {
        "@type": "CryptographicSignature",
        "signatureValue": c.data.signature
      }
    }));
    
    // Add assessments
    const assessments = events.filter(e => e.type === 'assessment');
    jsonLD.hasCredential.push(...assessments.map(a => ({
      "@type": "EducationalOccupationalCredential",
      "credentialCategory": "assessment",
      "dateCreated": a.timestamp,
      "educationalLevel": a.data.assessment_id,
      "value": a.data.score
    })));
    
    return jsonLD;
  }
  
  async exportForTransfer(studentId, targetInstitution) {
    const jsonLD = await this.exportToJSONLD(studentId);
    
    // Create transfer package
    const transferPackage = {
      format: "JSON-LD",
      version: "1.0",
      exported_at: new Date().toISOString(),
      source_institution: process.env.INSTITUTION_ID,
      target_institution: targetInstitution,
      student_record: jsonLD,
      verification_url: `${process.env.BASE_URL}/verify/${studentId}`
    };
    
    // Sign the package
    const signature = crypto
      .createSign('RSA-SHA256')
      .update(JSON.stringify(transferPackage))
      .sign(process.env.PRIVATE_KEY, 'base64');
    
    transferPackage.signature = signature;
    
    return transferPackage;
  }
}
```

---

#### 3.5.3 Cryptographic Credential Verification

**Certificate Signing:**

```javascript
class CredentialVerification {
  async issueCertificate(studentId, certificateType, metadata) {
    const certificate = {
      certificate_id: uuidv4(),
      student_id: studentId,
      certificate_type: certificateType,
      issued_at: new Date(),
      metadata: metadata
    };
    
    // Generate cryptographic signature
    const dataToSign = JSON.stringify({
      certificate_id: certificate.certificate_id,
      student_id: studentId,
      certificate_type: certificateType,
      issued_at: certificate.issued_at,
      metadata: metadata
    });
    
    const signature = crypto
      .createSign('RSA-SHA256')
      .update(dataToSign)
      .sign(process.env.PRIVATE_KEY, 'base64');
    
    certificate.signature = signature;
    certificate.public_key_url = `${process.env.BASE_URL}/public-key`;
    
    // Store certificate
    await db('certificates').insert(certificate);
    
    return certificate;
  }
  
  async verifyCertificate(certificateId, providedSignature) {
    const certificate = await db('certificates')
      .where({ certificate_id: certificateId })
      .first();
    
    if (!certificate) {
      return { valid: false, reason: 'Certificate not found' };
    }
    
    // Reconstruct signed data
    const dataToVerify = JSON.stringify({
      certificate_id: certificate.certificate_id,
      student_id: certificate.student_id,
      certificate_type: certificate.certificate_type,
      issued_at: certificate.issued_at,
      metadata: certificate.metadata
    });
    
    // Verify signature
    const isValid = crypto
      .createVerify('RSA-SHA256')
      .update(dataToVerify)
      .verify(process.env.PUBLIC_KEY, providedSignature, 'base64');
    
    if (isValid) {
      return {
        valid: true,
        certificate: certificate,
        verified_at: new Date()
      };
    } else {
      return {
        valid: false,
        reason: 'Signature verification failed'
      };
    }
  }
}
```

---

### 3.6 Accessibility & Generative Assist (Requirement 28)

#### 3.6.1 WCAG 2.1 AA Compliance

**Accessibility Standards Implementation:**

```javascript
class AccessibilityManager {
  constructor() {
    this.wcagStandards = {
      perceivable: [
        'text_alternatives',
        'time_based_media',
        'adaptable',
        'distinguishable'
      ],
      operable: [
        'keyboard_accessible',
        'enough_time',
        'seizures_safe',
        'navigable'
      ],
      understandable: [
        'readable',
        'predictable',
        'input_assistance'
      ],
      robust: [
        'compatible'
      ]
    };
  }
  
  async validateAccessibility(pageContent) {
    const issues = [];
    
    // Check for alt text on images
    const images = pageContent.match(/<img[^>]*>/g) || [];
    for (const img of images) {
      if (!img.includes('alt=')) {
        issues.push({
          severity: 'error',
          guideline: 'WCAG 2.1 1.1.1',
          message: 'Image missing alt attribute',
          element: img
        });
      }
    }
    
    // Check for proper heading hierarchy
    const headings = pageContent.match(/<h[1-6][^>]*>/g) || [];
    // Validate heading levels don't skip (e.g., h1 -> h3)
    
    // Check for keyboard navigation
    const interactiveElements = pageContent.match(/<(button|a|input)[^>]*>/g) || [];
    for (const element of interactiveElements) {
      if (!element.includes('tabindex') && !element.includes('href')) {
        issues.push({
          severity: 'warning',
          guideline: 'WCAG 2.1 2.1.1',
          message: 'Interactive element may not be keyboard accessible',
          element: element
        });
      }
    }
    
    return {
      compliant: issues.filter(i => i.severity === 'error').length === 0,
      issues: issues
    };
  }
}
```

---

#### 3.6.2 Assistive Technology Support

**Screen Reader Optimization:**

```html
<!-- Semantic HTML with ARIA labels -->
<nav aria-label="Main navigation">
  <ul role="menubar">
    <li role="none">
      <a href="/dashboard" role="menuitem" aria-current="page">Dashboard</a>
    </li>
    <li role="none">
      <a href="/students" role="menuitem">Students</a>
    </li>
  </ul>
</nav>

<!-- Form with proper labels -->
<form aria-labelledby="student-form-title">
  <h2 id="student-form-title">Student Registration</h2>
  
  <label for="first-name">First Name</label>
  <input 
    type="text" 
    id="first-name" 
    name="first_name" 
    aria-required="true"
    aria-describedby="first-name-help"
  />
  <span id="first-name-help" class="help-text">Enter student's first name</span>
  
  <button type="submit" aria-label="Submit student registration form">
    Submit
  </button>
</form>

<!-- Live regions for dynamic content -->
<div aria-live="polite" aria-atomic="true" id="notification-area">
  <!-- Dynamic notifications appear here -->
</div>
```

**Keyboard Navigation:**

```javascript
class KeyboardNavigation {
  constructor() {
    this.focusableElements = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');
  }
  
  enableKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Skip to main content (Alt + M)
      if (e.altKey && e.key === 'm') {
        document.getElementById('main-content').focus();
        e.preventDefault();
      }
      
      // Skip to navigation (Alt + N)
      if (e.altKey && e.key === 'n') {
        document.getElementById('main-nav').focus();
        e.preventDefault();
      }
      
      // Escape key closes modals
      if (e.key === 'Escape') {
        this.closeActiveModal();
      }
    });
  }
  
  trapFocus(containerElement) {
    const focusable = containerElement.querySelectorAll(this.focusableElements);
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];
    
    containerElement.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstFocusable) {
          lastFocusable.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === lastFocusable) {
          firstFocusable.focus();
          e.preventDefault();
        }
      }
    });
  }
}
```

---

#### 3.6.3 Generative Alt-Text with Vision-Language Model

**VLM Integration for Image Descriptions:**

```python
# Python AI Service (FastAPI)
from fastapi import FastAPI, UploadFile
from transformers import VisionEncoderDecoderModel, ViTImageProcessor, AutoTokenizer
from PIL import Image
import io

app = FastAPI()

class AltTextGenerator:
    def __init__(self):
        # Load Vision-Language Model (e.g., ViT-GPT2)
        self.model = VisionEncoderDecoderModel.from_pretrained("nlpconnect/vit-gpt2-image-captioning")
        self.processor = ViTImageProcessor.from_pretrained("nlpconnect/vit-gpt2-image-captioning")
        self.tokenizer = AutoTokenizer.from_pretrained("nlpconnect/vit-gpt2-image-captioning")
    
    def generate_caption(self, image_bytes):
        # Load image
        image = Image.open(io.BytesIO(image_bytes))
        
        # Preprocess
        pixel_values = self.processor(images=image, return_tensors="pt").pixel_values
        
        # Generate caption
        output_ids = self.model.generate(pixel_values, max_length=50, num_beams=4)
        caption = self.tokenizer.decode(output_ids[0], skip_special_tokens=True)
        
        return caption

alt_text_generator = AltTextGenerator()

@app.post("/generate-alt-text")
async def generate_alt_text(file: UploadFile):
    # Read image
    image_bytes = await file.read()
    
    # Generate caption
    caption = alt_text_generator.generate_caption(image_bytes)
    
    return {
        "alt_text": caption,
        "source": "ai-generated",
        "model": "vit-gpt2-image-captioning",
        "confidence": 0.85
    }
```

**Node.js Integration:**

```javascript
class ImageAccessibility {
  async processImageUpload(imageFile, uploadedBy) {
    // Store image
    const imageUrl = await this.uploadToS3(imageFile);
    
    // Check if user provided alt text
    if (!imageFile.alt_text) {
      // Generate alt text using VLM
      const altTextResponse = await axios.post(
        `${process.env.AI_INFERENCE_URL}/generate-alt-text`,
        imageFile.buffer,
        {
          headers: { 'Content-Type': 'image/jpeg' }
        }
      );
      
      // Store with AI-generated tag
      await db('media').insert({
        media_id: uuidv4(),
        url: imageUrl,
        alt_text: altTextResponse.data.alt_text,
        alt_text_source: 'ai-generated',
        alt_text_model: altTextResponse.data.model,
        uploaded_by: uploadedBy,
        created_at: new Date()
      });
      
      return {
        url: imageUrl,
        alt_text: altTextResponse.data.alt_text,
        source: 'ai-generated'
      };
    } else {
      // User provided alt text
      await db('media').insert({
        media_id: uuidv4(),
        url: imageUrl,
        alt_text: imageFile.alt_text,
        alt_text_source: 'user-provided',
        uploaded_by: uploadedBy,
        created_at: new Date()
      });
      
      return {
        url: imageUrl,
        alt_text: imageFile.alt_text,
        source: 'user-provided'
      };
    }
  }
}
```

---

#### 3.6.4 Content Simplification with LLM

**Easy Read Text Generation:**

```python
# Python AI Service
from transformers import pipeline

class ContentSimplifier:
    def __init__(self):
        # Load text simplification model
        self.simplifier = pipeline("text2text-generation", model="facebook/bart-large-cnn")
    
    def simplify_text(self, complex_text, reading_level="easy"):
        # Simplification prompt
        prompt = f"Rewrite the following text in simple, easy-to-understand language suitable for readers with cognitive differences:\n\n{complex_text}"
        
        # Generate simplified version
        simplified = self.simplifier(
            prompt,
            max_length=200,
            min_length=50,
            do_sample=False
        )[0]['generated_text']
        
        return simplified

simplifier = ContentSimplifier()

@app.post("/simplify-text")
async def simplify_text(request: dict):
    complex_text = request['text']
    reading_level = request.get('reading_level', 'easy')
    
    simplified = simplifier.simplify_text(complex_text, reading_level)
    
    return {
        "original": complex_text,
        "simplified": simplified,
        "reading_level": reading_level,
        "source": "ai-generated"
    }
```

**Frontend Integration:**

```javascript
class AccessibilityFeatures {
  async simplifyContent(elementId) {
    const element = document.getElementById(elementId);
    const originalText = element.textContent;
    
    // Call simplification API
    const response = await fetch('/api/simplify-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: originalText,
        reading_level: 'easy'
      })
    });
    
    const data = await response.json();
    
    // Show simplified version
    element.innerHTML = `
      <div class="simplified-content">
        <p>${data.simplified}</p>
        <button onclick="showOriginal('${elementId}')">Show Original</button>
        <span class="badge">Simplified by AI</span>
      </div>
    `;
  }
}
```

---

#### 3.6.5 Accessibility Preferences Persistence

**User Preferences Storage:**

```javascript
class AccessibilityPreferences {
  async savePreferences(userId, preferences) {
    await db('user_accessibility_preferences').insert({
      user_id: userId,
      high_contrast: preferences.high_contrast || false,
      large_text: preferences.large_text || false,
      screen_reader_mode: preferences.screen_reader_mode || false,
      keyboard_only: preferences.keyboard_only || false,
      reduced_motion: preferences.reduced_motion || false,
      simplified_content: preferences.simplified_content || false,
      created_at: new Date()
    }).onConflict('user_id').merge();
  }
  
  async loadPreferences(userId) {
    const prefs = await db('user_accessibility_preferences')
      .where({ user_id: userId })
      .first();
    
    return prefs || this.getDefaultPreferences();
  }
  
  getDefaultPreferences() {
    return {
      high_contrast: false,
      large_text: false,
      screen_reader_mode: false,
      keyboard_only: false,
      reduced_motion: false,
      simplified_content: false
    };
  }
  
  async applyPreferences(userId) {
    const prefs = await this.loadPreferences(userId);
    
    // Apply CSS classes based on preferences
    const body = document.body;
    
    if (prefs.high_contrast) body.classList.add('high-contrast');
    if (prefs.large_text) body.classList.add('large-text');
    if (prefs.reduced_motion) body.classList.add('reduced-motion');
    if (prefs.simplified_content) body.classList.add('simplified-content');
    
    return prefs;
  }
}
```

---

### 3.7 Scheduling & AI Optimization Engine (Requirement 31)

#### 3.7.1 Conflict Detection System

**Real-Time Conflict Checking:**

```javascript
class ScheduleConflictDetector {
  async checkConflicts(scheduleEntry) {
    const conflicts = [];
    
    // Check room conflicts
    const roomConflict = await db('schedule_entries')
      .where({
        room_id: scheduleEntry.room_id,
        day_of_week: scheduleEntry.day_of_week
      })
      .where('start_time', '<', scheduleEntry.end_time)
      .where('end_time', '>', scheduleEntry.start_time)
      .whereNot({ entry_id: scheduleEntry.entry_id });
    
    if (roomConflict.length > 0) {
      conflicts.push({
        type: 'room',
        severity: 'hard',
        message: `Room ${scheduleEntry.room_id} is already booked`,
        conflicting_entries: roomConflict
      });
    }
    
    // Check teacher conflicts
    const teacherConflict = await db('schedule_entries')
      .where({
        teacher_id: scheduleEntry.teacher_id,
        day_of_week: scheduleEntry.day_of_week
      })
      .where('start_time', '<', scheduleEntry.end_time)
      .where('end_time', '>', scheduleEntry.start_time)
      .whereNot({ entry_id: scheduleEntry.entry_id });
    
    if (teacherConflict.length > 0) {
      conflicts.push({
        type: 'teacher',
        severity: 'hard',
        message: `Teacher ${scheduleEntry.teacher_id} is already assigned`,
        conflicting_entries: teacherConflict
      });
    }
    
    // Check batch conflicts
    const batchConflict = await db('schedule_entries')
      .where({
        batch_id: scheduleEntry.batch_id,
        day_of_week: scheduleEntry.day_of_week
      })
      .where('start_time', '<', scheduleEntry.end_time)
      .where('end_time', '>', scheduleEntry.start_time)
      .whereNot({ entry_id: scheduleEntry.entry_id });
    
    if (batchConflict.length > 0) {
      conflicts.push({
        type: 'batch',
        severity: 'hard',
        message: `Batch ${scheduleEntry.batch_id} already has a class`,
        conflicting_entries: batchConflict
      });
    }
    
    return {
      has_conflicts: conflicts.length > 0,
      conflicts: conflicts
    };
  }
  
  async validateScheduleEntry(scheduleEntry) {
    const conflictCheck = await this.checkConflicts(scheduleEntry);
    
    if (conflictCheck.has_conflicts) {
      throw new Error(`Cannot create schedule entry: ${conflictCheck.conflicts.map(c => c.message).join(', ')}`);
    }
    
    return { valid: true };
  }
}
```

---

#### 3.7.2 AI-Assisted Schedule Optimization

**Constraint Satisfaction Problem (CSP) Solver:**

```python
# Python AI Service
from ortools.sat.python import cp_model
import json

class ScheduleOptimizer:
    def __init__(self):
        self.model = cp_model.CpModel()
    
    def optimize_schedule(self, constraints):
        # Variables
        classes = constraints['classes']
        rooms = constraints['rooms']
        teachers = constraints['teachers']
        time_slots = constraints['time_slots']
        
        # Decision variables: class_assignments[c, r, t, s]
        # c = class, r = room, t = teacher, s = time_slot
        class_assignments = {}
        
        for c in classes:
            for r in rooms:
                for t in teachers:
                    for s in time_slots:
                        class_assignments[(c, r, t, s)] = self.model.NewBoolVar(
                            f'class_{c}_room_{r}_teacher_{t}_slot_{s}'
                        )
        
        # Constraint 1: Each class must be assigned exactly once
        for c in classes:
            self.model.Add(
                sum(class_assignments[(c, r, t, s)] 
                    for r in rooms 
                    for t in teachers 
                    for s in time_slots) == 1
            )
        
        # Constraint 2: No room double-booking
        for r in rooms:
            for s in time_slots:
                self.model.Add(
                    sum(class_assignments[(c, r, t, s)] 
                        for c in classes 
                        for t in teachers) <= 1
                )
        
        # Constraint 3: No teacher double-booking
        for t in teachers:
            for s in time_slots:
                self.model.Add(
                    sum(class_assignments[(c, r, t, s)] 
                        for c in classes 
                        for r in rooms) <= 1
                )
        
        # Objective: Minimize teacher gaps
        teacher_gaps = []
        for t in teachers:
            for day in range(5):  # Monday to Friday
                day_slots = [s for s in time_slots if s['day'] == day]
                # Calculate gaps between classes
                # (Implementation details omitted for brevity)
        
        self.model.Minimize(sum(teacher_gaps))
        
        # Solve
        solver = cp_model.CpSolver()
        status = solver.Solve(self.model)
        
        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            # Extract solution
            schedule = []
            for c in classes:
                for r in rooms:
                    for t in teachers:
                        for s in time_slots:
                            if solver.Value(class_assignments[(c, r, t, s)]) == 1:
                                schedule.append({
                                    'class': c,
                                    'room': r,
                                    'teacher': t,
                                    'time_slot': s
                                })
            
            return {
                'status': 'success',
                'schedule': schedule,
                'objective_value': solver.ObjectiveValue()
            }
        else:
            return {
                'status': 'failed',
                'message': 'No feasible solution found'
            }

optimizer = ScheduleOptimizer()

@app.post("/optimize-schedule")
async def optimize_schedule(request: dict):
    constraints = request['constraints']
    
    result = optimizer.optimize_schedule(constraints)
    
    return result
```

**Node.js Integration:**

```javascript
class AIScheduleOptimizer {
  async generateScheduleOptions(constraints) {
    // Call Python AI service
    const response = await axios.post(
      `${process.env.AI_INFERENCE_URL}/optimize-schedule`,
      { constraints: constraints }
    );
    
    if (response.data.status === 'success') {
      // Generate 3 alternative schedules
      const options = [];
      
      for (let i = 0; i < 3; i++) {
        // Slightly vary constraints to get different solutions
        const variedConstraints = this.varyConstraints(constraints, i);
        const variedResponse = await axios.post(
          `${process.env.AI_INFERENCE_URL}/optimize-schedule`,
          { constraints: variedConstraints }
        );
        
        options.push({
          option_id: uuidv4(),
          schedule: variedResponse.data.schedule,
          score: variedResponse.data.objective_value,
          metrics: this.calculateMetrics(variedResponse.data.schedule)
        });
      }
      
      // Store as AI recommendations (pending human approval)
      for (const option of options) {
        await db('schedule_recommendations').insert({
          recommendation_id: option.option_id,
          schedule_data: option.schedule,
          score: option.score,
          metrics: option.metrics,
          status: 'pending_review',
          created_at: new Date()
        });
      }
      
      return options;
    } else {
      throw new Error('Schedule optimization failed');
    }
  }
  
  calculateMetrics(schedule) {
    // Calculate schedule quality metrics
    const metrics = {
      room_utilization: 0,
      teacher_gaps: 0,
      student_gaps: 0,
      back_to_back_classes: 0
    };
    
    // Room utilization
    const totalSlots = 5 * 8; // 5 days * 8 slots per day
    const usedSlots = schedule.length;
    metrics.room_utilization = (usedSlots / totalSlots) * 100;
    
    // Teacher gaps (count empty slots between classes)
    const teacherSchedules = {};
    for (const entry of schedule) {
      if (!teacherSchedules[entry.teacher]) {
        teacherSchedules[entry.teacher] = [];
      }
      teacherSchedules[entry.teacher].push(entry.time_slot);
    }
    
    for (const teacher in teacherSchedules) {
      const slots = teacherSchedules[teacher].sort((a, b) => a.start - b.start);
      for (let i = 0; i < slots.length - 1; i++) {
        const gap = slots[i + 1].start - slots[i].end;
        if (gap > 0) {
          metrics.teacher_gaps += gap;
        }
      }
    }
    
    return metrics;
  }
  
  async publishSchedule(recommendationId, publishedBy) {
    const recommendation = await db('schedule_recommendations')
      .where({ recommendation_id: recommendationId })
      .first();
    
    if (!recommendation) {
      throw new Error('Recommendation not found');
    }
    
    // Human approval required - cannot auto-publish
    if (recommendation.status !== 'pending_review') {
      throw new Error('Recommendation already processed');
    }
    
    const transaction = await db.transaction();
    
    try {
      // Clear existing schedule
      await transaction('schedule_entries')
        .where({ status: 'draft' })
        .delete();
      
      // Insert new schedule
      for (const entry of recommendation.schedule_data) {
        await transaction('schedule_entries').insert({
          entry_id: uuidv4(),
          class_id: entry.class,
          room_id: entry.room,
          teacher_id: entry.teacher,
          day_of_week: entry.time_slot.day,
          start_time: entry.time_slot.start,
          end_time: entry.time_slot.end,
          status: 'published',
          published_by: publishedBy,
          published_at: new Date()
        });
      }
      
      // Update recommendation status
      await transaction('schedule_recommendations')
        .where({ recommendation_id: recommendationId })
        .update({
          status: 'published',
          published_by: publishedBy,
          published_at: new Date()
        });
      
      await transaction.commit();
      
      // Notify affected stakeholders
      await this.notifyStakeholders(recommendation.schedule_data);
      
      return { success: true, message: 'Schedule published successfully' };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
```

---

#### 3.7.3 Change Propagation and Notifications

**Stakeholder Notification System:**

```javascript
class ScheduleNotificationManager {
  async notifyStakeholders(scheduleChanges) {
    // Identify affected stakeholders
    const affectedTeachers = new Set();
    const affectedBatches = new Set();
    
    for (const change of scheduleChanges) {
      affectedTeachers.add(change.teacher);
      affectedBatches.add(change.batch);
    }
    
    // Notify teachers
    for (const teacherId of affectedTeachers) {
      await this.notifyTeacher(teacherId, scheduleChanges);
    }
    
    // Notify students in affected batches
    for (const batchId of affectedBatches) {
      await this.notifyBatch(batchId, scheduleChanges);
    }
  }
  
  async notifyTeacher(teacherId, changes) {
    const teacher = await db('users')
      .where({ user_id: teacherId })
      .first();
    
    const teacherChanges = changes.filter(c => c.teacher === teacherId);
    
    await sendEmail({
      to: teacher.email,
      subject: 'Schedule Update',
      body: `
        Your schedule has been updated:
        
        ${teacherChanges.map(c => 
          `- ${c.class} on ${c.day} at ${c.start_time}`
        ).join('\n')}
      `
    });
    
    // Also send push notification
    await sendPushNotification({
      user_id: teacherId,
      title: 'Schedule Update',
      body: `Your schedule has been updated with ${teacherChanges.length} changes`
    });
  }
}
```

---

#### 3.7.4 Temporary Schedule Overrides

**Substitute Teacher Management:**

```javascript
class ScheduleOverrideManager {
  async createTemporaryOverride(entryId, overrideData) {
    // Create temporary override (e.g., substitute teacher)
    const override = await db('schedule_overrides').insert({
      override_id: uuidv4(),
      schedule_entry_id: entryId,
      override_type: overrideData.type, // 'substitute_teacher', 'room_change', 'time_change'
      original_value: overrideData.original_value,
      override_value: overrideData.override_value,
      effective_date: overrideData.date,
      reason: overrideData.reason,
      created_by: overrideData.created_by,
      created_at: new Date()
    });
    
    // Notify affected parties
    await this.notifyOverride(override);
    
    return override;
  }
  
  async getEffectiveSchedule(date) {
    // Get base schedule
    const baseSchedule = await db('schedule_entries')
      .where({ status: 'published' });
    
    // Apply overrides for the specific date
    const overrides = await db('schedule_overrides')
      .where({ effective_date: date });
    
    const effectiveSchedule = baseSchedule.map(entry => {
      const override = overrides.find(o => o.schedule_entry_id === entry.entry_id);
      
      if (override) {
        return {
          ...entry,
          [override.override_type]: override.override_value,
          is_override: true,
          override_reason: override.reason
        };
      }
      
      return entry;
    });
    
    return effectiveSchedule;
  }
}
```

---


---


#### 3.2.1.1 Keyboard-Only Navigation & Assistive Technology Support

**WCAG 2.1 AA Compliance Implementation:**

**Keyboard Navigation:**
- All interactive elements (buttons, links, form fields) are accessible via keyboard.
- Tab order follows logical reading order.
- Focus indicators are clearly visible (2px solid border with high contrast).
- Keyboard shortcuts are provided for common actions:
  - `Alt + S`: Submit form
  - `Alt + C`: Cancel/Close dialog
  - `Esc`: Close modal/dropdown
  - `Arrow keys`: Navigate through lists and menus

**Implementation:**
```html
<!-- All interactive elements have tabindex -->
<button tabindex="0" aria-label="Submit attendance">Submit</button>

<!-- Skip navigation link for screen readers -->
<a href="#main-content" class="skip-link">Skip to main content</a>

<!-- ARIA landmarks for screen reader navigation -->
<nav role="navigation" aria-label="Main navigation">
  <!-- Navigation items -->
</nav>

<main id="main-content" role="main">
  <!-- Main content -->
</main>
```

**Screen Reader Support:**
- All images have descriptive alt-text (user-provided or AI-generated).
- Form fields have associated `<label>` elements or `aria-label` attributes.
- Dynamic content changes are announced via `aria-live` regions.
- Complex widgets (date pickers, autocomplete) use appropriate ARIA roles.

**Testing:**
- Automated accessibility testing using axe-core or Pa11y.
- Manual testing with NVDA (Windows) and VoiceOver (macOS/iOS).
- Keyboard-only navigation testing (no mouse usage).

#### 3.3.1.1 Localization Support for Dynamic Forms

**Multi-Language Field Configuration:**

Fields support localization for labels, help text, and validation messages.

**Localized Field Schema:**
```json
{
  "field_id": "first_name",
  "field_type": "text",
  "labels": {
    "en": "First Name",
    "hi": "पहला नाम",
    "bn": "প্রথম নাম",
    "ta": "முதல் பெயர்",
    "te": "మొదటి పేరు",
    "mr": "पहिले नाव",
    "gu": "પ્રથમ નામ",
    "kn": "ಮೊದಲ ಹೆಸರು",
    "ml": "ആദ്യ പേര്",
    "pa": "ਪਹਿਲਾ ਨਾਮ"
  },
  "help_text": {
    "en": "Enter your legal first name as it appears on official documents",
    "hi": "आधिकारिक दस्तावेजों में दिखाई देने वाला अपना कानूनी पहला नाम दर्ज करें",
    "bn": "সরকারী নথিতে যেমন দেখা যায় তেমন আপনার আইনি প্রথম নাম লিখুন",
    "ta": "அதிகாரப்பூர்வ ஆவணங்களில் தோன்றும் உங்கள் சட்டப்பூர்வ முதல் பெயரை உள்ளிடவும்",
    "te": "అధికారిక పత్రాలలో కనిపించే విధంగా మీ చట్టబద్ధమైన మొదటి పేరును నమోదు చేయండి",
    "mr": "अधिकृत कागदपत्रांवर दिसल्याप्रमाणे तुमचे कायदेशीर पहिले नाव प्रविष्ट करा",
    "gu": "સત્તાવાર દસ્તાવેજોમાં દેખાય તેમ તમારું કાનૂની પ્રથમ નામ દાખલ કરો",
    "kn": "ಅಧಿಕೃತ ದಾಖಲೆಗಳಲ್ಲಿ ಕಾಣಿಸಿಕೊಳ್ಳುವಂತೆ ನಿಮ್ಮ ಕಾನೂನು ಮೊದಲ ಹೆಸರನ್ನು ನಮೂದಿಸಿ",
    "ml": "ഔദ്യോഗിക രേഖകളിൽ കാണുന്നതുപോലെ നിങ്ങളുടെ നിയമപരമായ ആദ്യ പേര് നൽകുക",
    "pa": "ਅਧਿਕਾਰਤ ਦਸਤਾਵੇਜ਼ਾਂ ਵਿੱਚ ਦਿਖਾਈ ਦੇਣ ਵਾਲਾ ਆਪਣਾ ਕਾਨੂੰਨੀ ਪਹਿਲਾ ਨਾਮ ਦਰਜ ਕਰੋ"
  },
  "validation_messages": {
    "required": {
      "en": "First name is required",
      "hi": "पहला नाम आवश्यक है",
      "bn": "প্রথম নাম আবশ্যক",
      "ta": "முதல் பெயர் தேவை",
      "te": "మొదటి పేరు అవసరం",
      "mr": "पहिले नाव आवश्यक आहे",
      "gu": "પ્રથમ નામ જરૂરી છે",
      "kn": "ಮೊದಲ ಹೆಸರು ಅಗತ್ಯವಿದೆ",
      "ml": "ആദ്യ പേര് ആവശ്യമാണ്",
      "pa": "ਪਹਿਲਾ ਨਾਮ ਲੋੜੀਂਦਾ ਹੈ"
    },
    "max_length": {
      "en": "First name must be less than 50 characters",
      "hi": "पहला नाम 50 वर्णों से कम होना चाहिए",
      "bn": "প্রথম নাম ৫০টি অক্ষরের কম হতে হবে",
      "ta": "முதல் பெயர் 50 எழுத்துகளுக்கு குறைவாக இருக்க வேண்டும்",
      "te": "మొదటి పేరు 50 అక్షరాల కంటే తక్కువగా ఉండాలి",
      "mr": "पहिले नाव 50 वर्णांपेक्षा कमी असावे",
      "gu": "પ્રથમ નામ 50 અક્ષરો કરતાં ઓછું હોવું જોઈએ",
      "kn": "ಮೊದಲ ಹೆಸರು 50 ಅಕ್ಷರಗಳಿಗಿಂತ ಕಡಿಮೆ ಇರಬೇಕು",
      "ml": "ആദ്യ പേര് 50 അക്ഷരങ്ങളിൽ കുറവായിരിക്കണം",
      "pa": "ਪਹਿਲਾ ਨਾਮ 50 ਅੱਖਰਾਂ ਤੋਂ ਘੱਟ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ"
    }
  }
}
```

**Locale Resolution:**
```javascript
function getLocalizedField(field, userLocale) {
  const locale = userLocale || 'en';  // Default to English
  
  return {
    field_id: field.field_id,
    label: field.labels[locale] || field.labels['en'],
    help_text: field.help_text[locale] || field.help_text['en'],
    validation_messages: field.validation_messages[locale] || field.validation_messages['en']
  };
}
```

**User Locale Preference:**
- Users can set their preferred language in profile settings.
- Locale preference is stored: `user_preferences.locale = 'hi'` (or 'en', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa').
- **Supported Languages (Indian Languages):**
  - **English (en)** - Primary language
  - **Hindi (hi)** - हिन्दी
  - **Bengali (bn)** - বাংলা
  - **Tamil (ta)** - தமிழ்
  - **Telugu (te)** - తెలుగు
  - **Marathi (mr)** - मराठी
  - **Gujarati (gu)** - ગુજરાતી
  - **Kannada (kn)** - ಕನ್ನಡ
  - **Malayalam (ml)** - മലയാളം
  - **Punjabi (pa)** - ਪੰਜਾਬੀ
- All forms, labels, and messages are rendered in the user's preferred language.
- If a translation is missing, the system falls back to English.

**Right-to-Left (RTL) Language Support:**
- UI automatically switches to RTL layout for Urdu (ur) if added in future.
- CSS uses logical properties (`margin-inline-start` instead of `margin-left`).
- Text alignment and reading order are reversed for RTL languages.

**Indian Language-Specific Features:**

**Bengali (বাংলা):**
- Full Unicode support for Bengali script (Bangla).
- Proper rendering of Bengali conjunct characters and diacritics.
- Bengali numerals (০১২৩৪৫৬৭৮৯) supported in addition to Western numerals.
- Date and time formatting follows Bengali locale conventions.

**Hindi (हिन्दी):**
- Full Unicode support for Devanagari script.
- Proper rendering of conjunct characters and matras.
- Hindi numerals supported.

**Tamil (தமிழ்):**
- Full Unicode support for Tamil script.
- Proper rendering of Tamil characters and diacritics.
- Tamil numerals (௧௨௩௪௫௬௭௮௯௦) supported.

**Telugu (తెలుగు), Kannada (ಕನ್ನಡ), Malayalam (മലയാളം):**
- Full Unicode support for respective Dravidian scripts.
- Proper rendering of complex character combinations.
- Script-specific numerals supported.

**Gujarati (ગુજરાતી), Marathi (मराठी), Punjabi (ਪੰਜਾਬੀ):**
- Full Unicode support for respective scripts.
- Proper rendering of script-specific characters.

**Common Features for All Indian Languages:**
- Currency formatting: ₹ (Indian Rupee) for all financial transactions.
- Date formats follow Indian conventions (DD/MM/YYYY).
- Number formatting with Indian numbering system (lakhs, crores).

---

## 4. Module C: Financial & Operational Resilience

### 4.1 Payment Processing and Financial Management (Requirement 6)

#### 4.1.1 Webhook Idempotency Logic

**Problem:** Payment gateway webhooks may be delivered multiple times due to network retries, causing duplicate payment records and double-billing.

**Solution:** Use `webhook_id + tenant_id` as a composite idempotency key.

**Implementation:**

```javascript
async function processPaymentWebhook(webhookPayload, headers) {
  const webhookId = headers['x-webhook-id'];
  const signature = headers['x-signature'];
  const tenantId = webhookPayload.tenant_id;
  
  // Step 1: Verify HMAC signature
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(webhookPayload))
    .digest('hex');
  
  if (signature !== expectedSignature) {
    throw new UnauthorizedError('Invalid webhook signature');
  }
  
  // Step 2: Check idempotency (Redis cache for fast lookup)
  const idempotencyKey = `webhook:${webhookId}:${tenantId}`;
  const existingRecord = await redis.get(idempotencyKey);
  
  if (existingRecord) {
    // Webhook already processed - return success without re-processing
    return {
      status: 'success',
      message: 'Webhook already processed',
      payment_id: existingRecord
    };
  }
  
  // Step 3: Process payment in database transaction
  const paymentId = await db.transaction(async (trx) => {
    // Insert payment record
    const payment = await trx('payments').insert({
      payment_id: uuidv4(),
      tenant_id: tenantId,
      webhook_id: webhookId,
      amount: webhookPayload.amount,
      currency: 'INR',
      status: webhookPayload.status,
      gateway_transaction_id: webhookPayload.transaction_id,
      created_at: new Date()
    }).returning('payment_id');
    
    // Update student balance
    await trx('student_accounts').where({
      student_id: webhookPayload.student_id,
      tenant_id: tenantId
    }).decrement('outstanding_balance', webhookPayload.amount);
    
    return payment[0].payment_id;
  });
  
  // Step 4: Store idempotency key in Redis (TTL: 7 days)
  await redis.setex(idempotencyKey, 7 * 24 * 60 * 60, paymentId);
  
  // Step 5: Store in database for long-term audit
  await db('webhook_log').insert({
    webhook_id: webhookId,
    tenant_id: tenantId,
    payment_id: paymentId,
    processed_at: new Date()
  });
  
  return {
    status: 'success',
    payment_id: paymentId
  };
}
```

**Database Schema:**

```sql
CREATE TABLE payments (
  payment_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  webhook_id VARCHAR(255) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  currency CHAR(3) DEFAULT 'INR',
  status VARCHAR(50) NOT NULL,
  gateway_transaction_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (webhook_id, tenant_id)  -- Enforce idempotency at DB level
);

CREATE TABLE webhook_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id VARCHAR(255) NOT NULL,
  tenant_id UUID NOT NULL,
  payment_id UUID REFERENCES payments(payment_id),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (webhook_id, tenant_id)
);

CREATE INDEX idx_webhook_tenant ON webhook_log(webhook_id, tenant_id);
```

#### 4.1.2 Sequential Invoice Numbering with Gap Detection

**Requirement:** Invoices must use tenant-unique sequential numbering to comply with tax regulations and detect missing invoices.

**Implementation:**

**Invoice Number Format:** `{TENANT_PREFIX}-{YEAR}-{SEQUENCE}`
- Example: `INST001-2026-00001`, `INST001-2026-00002`

**Sequence Generation (Database-Level):**

```sql
CREATE TABLE invoice_sequences (
  tenant_id UUID PRIMARY KEY,
  current_year INT NOT NULL,
  current_sequence INT NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Function to get next invoice number
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_tenant_id UUID, p_year INT)
RETURNS TEXT AS $$
DECLARE
  v_sequence INT;
  v_tenant_prefix TEXT;
  v_invoice_number TEXT;
BEGIN
  -- Get tenant prefix
  SELECT tenant_prefix INTO v_tenant_prefix
  FROM tenants WHERE tenant_id = p_tenant_id;
  
  -- Increment sequence (atomic operation)
  UPDATE invoice_sequences
  SET current_sequence = current_sequence + 1,
      last_updated = NOW()
  WHERE tenant_id = p_tenant_id AND current_year = p_year
  RETURNING current_sequence INTO v_sequence;
  
  -- If no row exists for this year, create one
  IF v_sequence IS NULL THEN
    INSERT INTO invoice_sequences (tenant_id, current_year, current_sequence)
    VALUES (p_tenant_id, p_year, 1)
    RETURNING current_sequence INTO v_sequence;
  END IF;
  
  -- Format invoice number
  v_invoice_number := v_tenant_prefix || '-' || p_year || '-' || LPAD(v_sequence::TEXT, 5, '0');
  
  RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql;
```

**Gap Detection:**

```javascript
async function detectInvoiceGaps(tenantId, year) {
  // Get all invoice numbers for the tenant and year
  const invoices = await db('invoices')
    .where({ tenant_id: tenantId })
    .where('invoice_number', 'like', `%-${year}-%`)
    .orderBy('invoice_number')
    .select('invoice_number');
  
  const gaps = [];
  let expectedSequence = 1;
  
  for (const invoice of invoices) {
    // Extract sequence number from invoice_number
    const parts = invoice.invoice_number.split('-');
    const actualSequence = parseInt(parts[2], 10);
    
    if (actualSequence !== expectedSequence) {
      gaps.push({
        expected: expectedSequence,
        actual: actualSequence,
        missing_range: `${expectedSequence} to ${actualSequence - 1}`
      });
    }
    
    expectedSequence = actualSequence + 1;
  }
  
  if (gaps.length > 0) {
    // Alert admins about gaps
    await sendAlert({
      type: 'invoice_gap_detected',
      tenant_id: tenantId,
      year: year,
      gaps: gaps,
      severity: 'high'
    });
  }
  
  return gaps;
}

// Run gap detection nightly
cron.schedule('0 2 * * *', async () => {
  const tenants = await db('tenants').select('tenant_id');
  const currentYear = new Date().getFullYear();
  
  for (const tenant of tenants) {
    await detectInvoiceGaps(tenant.tenant_id, currentYear);
  }
});
```

#### 4.1.3 Bank Reconciliation Workflow

**Purpose:** Match bank statement entries against system payment records to detect discrepancies.

**Reconciliation UI Workflow:**

1. **Upload Bank Statement:**
   ```javascript
   POST /api/v1/finance/reconciliation/upload
   Content-Type: multipart/form-data
   
   {
     "file": <bank-statement.csv>,
     "bank_account_id": "account-uuid",
     "statement_date": "2026-02-04"
   }
   ```

2. **Parse and Match:**
   ```javascript
   async function reconcileBankStatement(statementFile, bankAccountId, statementDate) {
     // Parse CSV
     const bankTransactions = await parseBankStatement(statementFile);
     
     const reconciliationResults = {
       matched: [],
       unmatched_bank: [],
       unmatched_system: [],
       discrepancies: []
     };
     
     for (const bankTxn of bankTransactions) {
       // Try to match by transaction reference
       const systemPayment = await db('payments')
         .where({
           gateway_transaction_id: bankTxn.reference,
           tenant_id: getTenantId()
         })
         .first();
       
       if (systemPayment) {
         // Check if amounts match
         if (Math.abs(systemPayment.amount - bankTxn.amount) < 0.01) {
           reconciliationResults.matched.push({
             bank_txn: bankTxn,
             system_payment: systemPayment,
             status: 'matched'
           });
           
           // Mark as reconciled
           await db('payments')
             .where({ payment_id: systemPayment.payment_id })
             .update({
               reconciled: true,
               reconciled_at: new Date(),
               bank_transaction_id: bankTxn.id
             });
         } else {
           // Amount mismatch
           reconciliationResults.discrepancies.push({
             bank_txn: bankTxn,
             system_payment: systemPayment,
             issue: 'amount_mismatch',
             bank_amount: bankTxn.amount,
             system_amount: systemPayment.amount,
             difference: bankTxn.amount - systemPayment.amount
           });
         }
       } else {
         // No matching system payment
         reconciliationResults.unmatched_bank.push(bankTxn);
       }
     }
     
     // Find system payments not in bank statement
     const systemPayments = await db('payments')
       .where({
         tenant_id: getTenantId(),
         created_at: statementDate,
         reconciled: false
       });
     
     for (const payment of systemPayments) {
       const bankMatch = bankTransactions.find(
         txn => txn.reference === payment.gateway_transaction_id
       );
       
       if (!bankMatch) {
         reconciliationResults.unmatched_system.push(payment);
       }
     }
     
     return reconciliationResults;
   }
   ```

3. **Discrepancy Alerts:**
   ```javascript
   async function triggerDiscrepancyAlerts(reconciliationResults, tier) {
     const alertTimeframes = {
       'basic': 15 * 60 * 1000,      // 15 minutes
       'business': 5 * 60 * 1000,    // 5 minutes
       'enterprise': 1 * 60 * 1000   // 1 minute
     };
     
     if (reconciliationResults.discrepancies.length > 0) {
       const alert = {
         type: 'payment_discrepancy',
         severity: 'high',
         discrepancies: reconciliationResults.discrepancies,
         unmatched_bank: reconciliationResults.unmatched_bank.length,
         unmatched_system: reconciliationResults.unmatched_system.length,
         created_at: new Date()
       };
       
       // Send alert within guaranteed timeframe
       setTimeout(async () => {
         await sendAlert(alert);
       }, alertTimeframes[tier]);
     }
   }
   ```

4. **Manual Resolution:**
   ```javascript
   POST /api/v1/finance/reconciliation/resolve
   
   {
     "discrepancy_id": "uuid",
     "resolution_type": "manual_match | refund | error_correction",
     "bank_transaction_id": "bank-txn-id",
     "system_payment_id": "payment-uuid",
     "notes": "Customer paid via different account",
     "resolved_by": "admin-uuid"
   }
   ```

#### 4.1.4 Refund Workflow with Approval

**Refund Process:**

```javascript
// Step 1: Initiate refund request
POST /api/v1/finance/refunds/request

{
  "payment_id": "payment-uuid",
  "refund_amount": 5000.00,
  "refund_reason": "Course cancellation",
  "requested_by": "admin-uuid"
}

// Step 2: Create approval workflow
async function createRefundApproval(refundRequest) {
  const refundId = uuidv4();
  
  await db('refund_requests').insert({
    refund_id: refundId,
    payment_id: refundRequest.payment_id,
    refund_amount: refundRequest.refund_amount,
    refund_reason: refundRequest.refund_reason,
    requested_by: refundRequest.requested_by,
    status: 'pending_approval',
    created_at: new Date()
  });
  
  // Create approval workflow
  await db('approval_workflows').insert({
    workflow_id: uuidv4(),
    workflow_type: 'refund_approval',
    entity_id: refundId,
    approver_role: 'finance_manager',
    status: 'pending',
    created_at: new Date()
  });
  
  return refundId;
}

// Step 3: Approve refund
POST /api/v1/finance/refunds/:refundId/approve

{
  "approved_by": "finance-manager-uuid",
  "approval_notes": "Verified course cancellation policy"
}

// Step 4: Process refund and generate credit note
async function processRefund(refundId, approvedBy) {
  const refund = await db('refund_requests')
    .where({ refund_id: refundId })
    .first();
  
  const payment = await db('payments')
    .where({ payment_id: refund.payment_id })
    .first();
  
  await db.transaction(async (trx) => {
    // Update refund status
    await trx('refund_requests')
      .where({ refund_id: refundId })
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date()
      });
    
    // Generate credit note
    const creditNoteNumber = await getCreditNoteNumber(payment.tenant_id);
    
    await trx('credit_notes').insert({
      credit_note_id: uuidv4(),
      credit_note_number: creditNoteNumber,
      tenant_id: payment.tenant_id,
      original_invoice_id: payment.invoice_id,
      refund_id: refundId,
      amount: refund.refund_amount,
      currency: 'INR',
      reason: refund.refund_reason,
      created_at: new Date()
    });
    
    // Update student balance
    await trx('student_accounts')
      .where({ student_id: payment.student_id })
      .increment('outstanding_balance', refund.refund_amount);
    
    // Initiate gateway refund
    await initiateGatewayRefund({
      transaction_id: payment.gateway_transaction_id,
      amount: refund.refund_amount
    });
  });
}
```

**Credit Note Schema:**

```sql
CREATE TABLE credit_notes (
  credit_note_id UUID PRIMARY KEY,
  credit_note_number VARCHAR(50) UNIQUE NOT NULL,
  tenant_id UUID NOT NULL,
  original_invoice_id UUID REFERENCES invoices(invoice_id),
  refund_id UUID REFERENCES refund_requests(refund_id),
  amount DECIMAL(15, 2) NOT NULL,
  currency CHAR(3) DEFAULT 'INR',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 4.2 Tiered Infrastructure & Performance (Requirements 11, 15)

#### 4.2.1 Architecture per Tier

**Basic Tier:**
- **Infrastructure:** Single Region, 2 Availability Zones
- **Database:** PostgreSQL with RLS, Daily backups
- **Compute:** 2 vCPUs, 4GB RAM per service
- **Connection Pool:** 100 connections
- **Latency SLO:** Sub-500ms for 95% of requests
- **Availability SLO:** 99.5% uptime

**Business Tier:**
- **Infrastructure:** Multi-AZ, Read Replicas, Secondary Region (standby)
- **Database:** PostgreSQL with RLS, Hourly backups
- **Compute:** 4 vCPUs, 8GB RAM per service
- **Connection Pool:** 500 connections
- **Latency SLO:** Sub-200ms for 95% of requests
- **Availability SLO:** 99.9% uptime

**Enterprise Tier:**
- **Infrastructure:** Multi-Region (Active-Active), Real-time replication
- **Database:** Dedicated PostgreSQL instance per tenant, PITR enabled
- **Compute:** 8 vCPUs, 16GB RAM per service, Auto-scaling
- **Connection Pool:** 2000 connections
- **Latency SLO:** Sub-100ms for 95% of requests
- **Availability SLO:** 99.95% uptime

#### 4.2.2 Rate Limiting Implementation (Redis Sliding Window)

**Algorithm:** Token Bucket with Sliding Window

**Implementation:**

```javascript
class RateLimiter {
  constructor(redis) {
    this.redis = redis;
  }
  
  async checkRateLimit(tenantId, userId, tier) {
    const limits = this.getTierLimits(tier);
    
    // Check tenant-level rate limit
    const tenantAllowed = await this.checkLimit(
      `ratelimit:tenant:${tenantId}`,
      limits.tenant.requests,
      limits.tenant.window
    );
    
    if (!tenantAllowed) {
      throw new RateLimitError('Tenant rate limit exceeded', 429);
    }
    
    // Check user-level rate limit
    const userAllowed = await this.checkLimit(
      `ratelimit:user:${userId}`,
      limits.user.requests,
      limits.user.window
    );
    
    if (!userAllowed) {
      throw new RateLimitError('User rate limit exceeded', 429);
    }
    
    return true;
  }
  
  async checkLimit(key, maxRequests, windowSeconds) {
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);
    
    // Use Redis sorted set for sliding window
    const pipeline = this.redis.pipeline();
    
    // Remove old entries outside the window
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // Count requests in current window
    pipeline.zcard(key);
    
    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiry
    pipeline.expire(key, windowSeconds);
    
    const results = await pipeline.exec();
    const currentCount = results[1][1];
    
    return currentCount < maxRequests;
  }
  
  getTierLimits(tier) {
    const limits = {
      'basic': {
        tenant: { requests: 10000, window: 3600 },  // 10K per hour
        user: { requests: 100, window: 60 }         // 100 per minute
      },
      'business': {
        tenant: { requests: 50000, window: 3600 },  // 50K per hour
        user: { requests: 500, window: 60 }         // 500 per minute
      },
      'enterprise': {
        tenant: { requests: 200000, window: 3600 }, // 200K per hour
        user: { requests: 2000, window: 60 }        // 2000 per minute
      }
    };
    
    return limits[tier] || limits['basic'];
  }
}

// Middleware
async function rateLimitMiddleware(req, res, next) {
  const tenantId = req.user.tenant_id;
  const userId = req.user.user_id;
  const tier = req.user.tier;
  
  try {
    await rateLimiter.checkRateLimit(tenantId, userId, tier);
    next();
  } catch (error) {
    if (error instanceof RateLimitError) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: error.message,
        retry_after: 60  // seconds
      });
    } else {
      next(error);
    }
  }
}
```

**Burst Handling:**

```javascript
// Allow burst traffic with token bucket
async function checkBurstLimit(key, maxBurst, refillRate) {
  const now = Date.now();
  const tokenKey = `tokens:${key}`;
  const lastRefillKey = `lastrefill:${key}`;
  
  // Get current tokens and last refill time
  const [tokens, lastRefill] = await redis.mget(tokenKey, lastRefillKey);
  
  let currentTokens = parseFloat(tokens) || maxBurst;
  const lastRefillTime = parseInt(lastRefill) || now;
  
  // Refill tokens based on time elapsed
  const elapsedSeconds = (now - lastRefillTime) / 1000;
  const tokensToAdd = elapsedSeconds * refillRate;
  currentTokens = Math.min(maxBurst, currentTokens + tokensToAdd);
  
  if (currentTokens >= 1) {
    // Consume one token
    currentTokens -= 1;
    
    await redis.mset(
      tokenKey, currentTokens.toString(),
      lastRefillKey, now.toString()
    );
    
    return true;
  }
  
  return false;
}
```

#### 4.2.3 Resource Quotas Enforcement

**Quota Types:**

```javascript
const TIER_QUOTAS = {
  'basic': {
    storage_gb: 10,
    api_calls_per_day: 100000,
    concurrent_users: 100,
    db_connections: 100
  },
  'business': {
    storage_gb: 100,
    api_calls_per_day: 500000,
    concurrent_users: 500,
    db_connections: 500
  },
  'enterprise': {
    storage_gb: 1000,
    api_calls_per_day: 2000000,
    concurrent_users: 5000,
    db_connections: 2000
  }
};
```

**Storage Quota Enforcement:**

```javascript
async function checkStorageQuota(tenantId, fileSize) {
  const tenant = await db('tenants')
    .where({ tenant_id: tenantId })
    .first();
  
  const quota = TIER_QUOTAS[tenant.tier].storage_gb * 1024 * 1024 * 1024; // Convert to bytes
  
  // Get current usage
  const currentUsage = await db('media_files')
    .where({ tenant_id: tenantId })
    .sum('file_size as total')
    .first();
  
  const totalUsage = (currentUsage.total || 0) + fileSize;
  
  if (totalUsage > quota) {
    // Send alert at 80%, 90%, 100%
    const usagePercent = (totalUsage / quota) * 100;
    
    if (usagePercent >= 80) {
      await sendQuotaAlert(tenantId, 'storage', usagePercent);
    }
    
    throw new QuotaExceededError(
      `Storage quota exceeded. Used: ${formatBytes(totalUsage)}, Limit: ${formatBytes(quota)}`
    );
  }
  
  return true;
}
```

**API Call Quota Enforcement:**

```javascript
async function trackApiCall(tenantId) {
  const today = new Date().toISOString().split('T')[0];
  const key = `api_calls:${tenantId}:${today}`;
  
  // Increment counter
  const count = await redis.incr(key);
  
  // Set expiry to end of day
  if (count === 1) {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const ttl = Math.floor((endOfDay - new Date()) / 1000);
    await redis.expire(key, ttl);
  }
  
  // Check quota
  const tenant = await getTenant(tenantId);
  const quota = TIER_QUOTAS[tenant.tier].api_calls_per_day;
  
  if (count > quota) {
    throw new QuotaExceededError(
      `Daily API call quota exceeded. Used: ${count}, Limit: ${quota}`
    );
  }
  
  // Alert at thresholds
  const usagePercent = (count / quota) * 100;
  if ([80, 90, 100].includes(Math.floor(usagePercent))) {
    await sendQuotaAlert(tenantId, 'api_calls', usagePercent);
  }
  
  return count;
}
```

**Concurrent Users Enforcement:**

```javascript
async function checkConcurrentUsers(tenantId) {
  const activeSessionsKey = `active_sessions:${tenantId}`;
  
  // Count active sessions (sessions with activity in last 5 minutes)
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  const activeSessions = await redis.zcount(activeSessionsKey, fiveMinutesAgo, '+inf');
  
  const tenant = await getTenant(tenantId);
  const quota = TIER_QUOTAS[tenant.tier].concurrent_users;
  
  if (activeSessions >= quota) {
    throw new QuotaExceededError(
      `Concurrent user limit reached. Active: ${activeSessions}, Limit: ${quota}`
    );
  }
  
  return true;
}
```

**Database Connection Pool per Tenant:**

```javascript
class TenantConnectionPool {
  constructor() {
    this.pools = new Map();
  }
  
  getPool(tenantId, tier) {
    if (!this.pools.has(tenantId)) {
      const maxConnections = TIER_QUOTAS[tier].db_connections;
      
      const pool = new Pool({
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        max: maxConnections,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      });
      
      this.pools.set(tenantId, pool);
    }
    
    return this.pools.get(tenantId);
  }
  
  async getConnection(tenantId, tier) {
    const pool = this.getPool(tenantId, tier);
    
    try {
      const client = await pool.connect();
      
      // Set tenant context
      await client.query(`SET app.current_tenant_id = '${tenantId}'`);
      
      return client;
    } catch (error) {
      if (error.message.includes('timeout')) {
        throw new QuotaExceededError(
          'Database connection pool exhausted. Please try again later.'
        );
      }
      throw error;
    }
  }
}
```
---

#### 4.2.4 Automated Root Cause Analysis (RCA) on SLO Breaches

**Purpose:** Automatically generate RCA reports when SLO breaches occur to identify root causes quickly.

**Implementation:**

```javascript
class SLOMonitor {
  constructor() {
    this.sloThresholds = {
      'basic': { latency_p95: 500, error_rate: 0.01 },
      'business': { latency_p95: 200, error_rate: 0.005 },
      'enterprise': { latency_p95: 100, error_rate: 0.001 }
    };
  }
  
  async monitorSLOs() {
    setInterval(async () => {
      const tenants = await db('tenants').select('*');
      
      for (const tenant of tenants) {
        const metrics = await this.collectMetrics(tenant.tenant_id);
        const threshold = this.sloThresholds[tenant.tier];
        
        // Check latency SLO
        if (metrics.latency_p95 > threshold.latency_p95) {
          await this.triggerRCA(tenant, 'latency_breach', metrics);
        }
        
        // Check error rate SLO
        if (metrics.error_rate > threshold.error_rate) {
          await this.triggerRCA(tenant, 'error_rate_breach', metrics);
        }
      }
    }, 60000); // Check every minute
  }
  
  async collectMetrics(tenantId) {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    
    // Get latency metrics from Prometheus
    const latencyMetrics = await prometheus.query(`
      histogram_quantile(0.95, 
        rate(http_request_duration_seconds_bucket{tenant_id="${tenantId}"}[5m])
      )
    `);
    
    // Get error rate
    const errorRate = await prometheus.query(`
      rate(http_requests_total{tenant_id="${tenantId}",status=~"5.."}[5m]) /
      rate(http_requests_total{tenant_id="${tenantId}"}[5m])
    `);
    
    // Get infrastructure metrics
    const cpuUsage = await prometheus.query(`
      avg(rate(container_cpu_usage_seconds_total{tenant_id="${tenantId}"}[5m]))
    `);
    
    const memoryUsage = await prometheus.query(`
      avg(container_memory_usage_bytes{tenant_id="${tenantId}"})
    `);
    
    const dbConnections = await prometheus.query(`
      pg_stat_database_numbackends{tenant_id="${tenantId}"}
    `);
    
    return {
      latency_p95: latencyMetrics.value * 1000, // Convert to ms
      error_rate: errorRate.value,
      cpu_usage_percent: cpuUsage.value * 100,
      memory_usage_mb: memoryUsage.value / (1024 * 1024),
      db_connections: dbConnections.value,
      timestamp: new Date()
    };
  }
  
  async triggerRCA(tenant, breachType, metrics) {
    console.log(`SLO breach detected for tenant ${tenant.tenant_id}: ${breachType}`);
    
    // Generate RCA report
    const rca = await this.generateRCA(tenant, breachType, metrics);
    
    // Store RCA report
    await db('rca_reports').insert({
      rca_id: uuidv4(),
      tenant_id: tenant.tenant_id,
      breach_type: breachType,
      metrics: metrics,
      root_causes: rca.root_causes,
      recommendations: rca.recommendations,
      created_at: new Date()
    });
    
    // Send alert to ops team
    await sendAlert({
      type: 'slo_breach',
      tenant_id: tenant.tenant_id,
      breach_type: breachType,
      rca_summary: rca.summary,
      severity: 'high'
    });
  }
  
  async generateRCA(tenant, breachType, metrics) {
    const rootCauses = [];
    const recommendations = [];
    
    // Analyze CPU usage
    if (metrics.cpu_usage_percent > 80) {
      rootCauses.push({
        category: 'infrastructure',
        issue: 'High CPU usage',
        value: `${metrics.cpu_usage_percent.toFixed(2)}%`,
        threshold: '80%'
      });
      recommendations.push('Scale up compute resources or optimize CPU-intensive operations');
    }
    
    // Analyze memory usage
    if (metrics.memory_usage_mb > 3500) { // Assuming 4GB limit
      rootCauses.push({
        category: 'infrastructure',
        issue: 'High memory usage',
        value: `${metrics.memory_usage_mb.toFixed(2)} MB`,
        threshold: '3500 MB'
      });
      recommendations.push('Increase memory allocation or investigate memory leaks');
    }
    
    // Analyze database connections
    const maxConnections = this.sloThresholds[tenant.tier].max_connections || 100;
    if (metrics.db_connections > maxConnections * 0.9) {
      rootCauses.push({
        category: 'database',
        issue: 'High database connection usage',
        value: metrics.db_connections,
        threshold: maxConnections
      });
      recommendations.push('Optimize connection pooling or increase connection limit');
    }
    
    // Analyze slow queries (if latency breach)
    if (breachType === 'latency_breach') {
      const slowQueries = await this.getSlowQueries(tenant.tenant_id);
      
      if (slowQueries.length > 0) {
        rootCauses.push({
          category: 'database',
          issue: 'Slow database queries detected',
          value: `${slowQueries.length} queries > 1s`,
          queries: slowQueries.slice(0, 5) // Top 5 slow queries
        });
        recommendations.push('Optimize slow queries or add database indexes');
      }
    }
    
    // Analyze error patterns (if error rate breach)
    if (breachType === 'error_rate_breach') {
      const errorPatterns = await this.getErrorPatterns(tenant.tenant_id);
      
      rootCauses.push({
        category: 'application',
        issue: 'High error rate',
        patterns: errorPatterns
      });
      recommendations.push('Investigate and fix application errors');
    }
    
    // Generate summary
    const summary = `SLO breach: ${breachType}. Identified ${rootCauses.length} root causes. ` +
                   `Primary issue: ${rootCauses[0]?.issue || 'Unknown'}`;
    
    return {
      summary,
      root_causes: rootCauses,
      recommendations,
      metrics
    };
  }
  
  async getSlowQueries(tenantId) {
    // Query PostgreSQL pg_stat_statements for slow queries
    const result = await db.raw(`
      SELECT 
        query,
        mean_exec_time,
        calls,
        total_exec_time
      FROM pg_stat_statements
      WHERE query LIKE '%tenant_id = ''${tenantId}''%'
        AND mean_exec_time > 1000
      ORDER BY mean_exec_time DESC
      LIMIT 10
    `);
    
    return result.rows;
  }
  
  async getErrorPatterns(tenantId) {
    // Analyze error logs from last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const errors = await db('error_logs')
      .where({ tenant_id: tenantId })
      .where('created_at', '>', fiveMinutesAgo)
      .select('error_type', 'error_message')
      .groupBy('error_type', 'error_message')
      .count('* as count')
      .orderBy('count', 'desc')
      .limit(5);
    
    return errors;
  }
}

// Start SLO monitoring
const sloMonitor = new SLOMonitor();
sloMonitor.monitorSLOs();
```

**RCA Report Schema:**

```sql
CREATE TABLE rca_reports (
  rca_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  breach_type VARCHAR(50) NOT NULL,
  metrics JSONB NOT NULL,
  root_causes JSONB NOT NULL,
  recommendations JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rca_tenant_date ON rca_reports(tenant_id, created_at DESC);
```

**RCA Report Example:**

```json
{
  "rca_id": "uuid-v4",
  "tenant_id": "tenant-uuid",
  "breach_type": "latency_breach",
  "metrics": {
    "latency_p95": 650,
    "error_rate": 0.008,
    "cpu_usage_percent": 85.3,
    "memory_usage_mb": 3200,
    "db_connections": 95
  },
  "root_causes": [
    {
      "category": "infrastructure",
      "issue": "High CPU usage",
      "value": "85.30%",
      "threshold": "80%"
    },
    {
      "category": "database",
      "issue": "Slow database queries detected",
      "value": "12 queries > 1s",
      "queries": [
        {
          "query": "SELECT * FROM students WHERE...",
          "mean_exec_time": 2500,
          "calls": 450
        }
      ]
    }
  ],
  "recommendations": [
    "Scale up compute resources or optimize CPU-intensive operations",
    "Optimize slow queries or add database indexes"
  ],
  "created_at": "2026-02-04T10:30:00Z"
}
```

---

### 4.3 Disaster Recovery & Business Continuity (Requirement 12)

#### 4.3.1 RTO/RPO Strategies per Tier

**Basic Tier:**
- **RTO (Recovery Time Objective):** 4 hours
- **RPO (Recovery Point Objective):** 1 hour
- **Backup Strategy:** Daily full backups at 2:00 AM UTC
- **Storage:** Single region, 2 availability zones
- **Recovery Process:** Manual restore from backup

**Implementation:**
```bash
# Daily backup script
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="eduos_backup_${TIMESTAMP}.sql"

# Full database dump
pg_dump -h $DB_HOST -U $DB_USER -d eduos_db > /backups/${BACKUP_FILE}

# Compress
gzip /backups/${BACKUP_FILE}

# Upload to S3
aws s3 cp /backups/${BACKUP_FILE}.gz s3://eduos-backups/basic/${BACKUP_FILE}.gz

# Retain for 30 days
aws s3 ls s3://eduos-backups/basic/ | \
  awk '{if ($1 < "'$(date -d '30 days ago' +%Y-%m-%d)'") print $4}' | \
  xargs -I {} aws s3 rm s3://eduos-backups/basic/{}
```

**Business Tier:**
- **RTO:** 1 hour
- **RPO:** 15 minutes
- **Backup Strategy:** Hourly incremental backups + Secondary region (standby)
- **Storage:** Multi-AZ with read replicas
- **Recovery Process:** Automated failover to secondary region

**Implementation:**
```javascript
// Hourly incremental backup
cron.schedule('0 * * * *', async () => {
  const timestamp = new Date().toISOString();
  
  // WAL (Write-Ahead Log) archiving for point-in-time recovery
  await executeCommand(`
    pg_basebackup -h ${DB_HOST} -U ${DB_USER} -D /backups/incremental/${timestamp} -Ft -z -P
  `);
  
  // Sync to secondary region
  await syncToSecondaryRegion('/backups/incremental/', 's3://eduos-backups-secondary/');
});

// Automated failover monitoring
async function monitorPrimaryHealth() {
  setInterval(async () => {
    const isHealthy = await checkDatabaseHealth(PRIMARY_DB);
    
    if (!isHealthy) {
      console.log('Primary database unhealthy. Initiating failover...');
      await initiateFailover();
    }
  }, 30000); // Check every 30 seconds
}

async function initiateFailover() {
  // Promote read replica to primary
  await promoteReadReplica(SECONDARY_DB);
  
  // Update DNS to point to new primary
  await updateDNS('db.eduos.com', SECONDARY_DB_IP);
  
  // Notify admins
  await sendAlert({
    type: 'failover_initiated',
    from: PRIMARY_DB,
    to: SECONDARY_DB,
    timestamp: new Date()
  });
}
```

**Enterprise Tier:**
- **RTO:** 15 minutes
- **RPO:** 5 minutes
- **Backup Strategy:** Real-time replication (Active-Active Multi-Region)
- **Storage:** Dedicated database instance per tenant
- **Recovery Process:** Automatic failover with zero data loss

**Implementation:**
```javascript
// PostgreSQL Streaming Replication Configuration
// postgresql.conf on primary
/*
wal_level = replica
max_wal_senders = 10
wal_keep_segments = 64
synchronous_commit = remote_apply
synchronous_standby_names = 'standby1,standby2'
*/

// Automatic failover with Patroni
const patroniConfig = {
  scope: 'eduos-cluster',
  name: 'node1',
  restapi: {
    listen: '0.0.0.0:8008',
    connect_address: 'node1:8008'
  },
  postgresql: {
    listen: '0.0.0.0:5432',
    connect_address: 'node1:5432',
    data_dir: '/var/lib/postgresql/data',
    parameters: {
      max_connections: 2000,
      shared_buffers: '4GB',
      effective_cache_size: '12GB'
    }
  },
  bootstrap: {
    dcs: {
      ttl: 30,
      loop_wait: 10,
      retry_timeout: 10,
      maximum_lag_on_failover: 1048576,
      synchronous_mode: true
    }
  }
};

// Point-in-Time Recovery (PITR)
async function performPITR(tenantId, targetTimestamp) {
  console.log(`Initiating PITR for tenant ${tenantId} to ${targetTimestamp}`);
  
  // Stop application writes
  await setTenantReadOnly(tenantId);
  
  // Restore from base backup
  await restoreBaseBackup(tenantId);
  
  // Replay WAL logs up to target timestamp
  await executeCommand(`
    pg_restore -h ${DB_HOST} -U ${DB_USER} -d ${tenantId}_db \
    --target-time='${targetTimestamp}' \
    /backups/base/${tenantId}/
  `);
  
  // Verify data integrity
  const isValid = await verifyDataIntegrity(tenantId);
  
  if (isValid) {
    await setTenantReadWrite(tenantId);
    console.log(`PITR completed successfully for tenant ${tenantId}`);
  } else {
    throw new Error('PITR verification failed');
  }
}
```

#### 4.3.2 DR Testing Cadence

**Basic Tier:**
- **Annual Tabletop Exercise:** Simulate disaster scenarios with stakeholders
- **Quarterly Restore Test:** Restore backup to test environment and verify data integrity

```javascript
// Quarterly restore test automation
cron.schedule('0 0 1 */3 *', async () => {
  console.log('Starting quarterly restore test for Basic tier tenants');
  
  const basicTenants = await db('tenants').where({ tier: 'basic' });
  
  for (const tenant of basicTenants) {
    try {
      // Get latest backup
      const latestBackup = await getLatestBackup(tenant.tenant_id);
      
      // Restore to test environment
      await restoreToTestEnv(latestBackup, tenant.tenant_id);
      
      // Run validation queries
      const validationResults = await runValidationQueries(tenant.tenant_id);
      
      // Log results
      await db('dr_test_log').insert({
        test_id: uuidv4(),
        tenant_id: tenant.tenant_id,
        test_type: 'restore_test',
        test_date: new Date(),
        status: validationResults.success ? 'passed' : 'failed',
        details: validationResults
      });
      
    } catch (error) {
      console.error(`Restore test failed for tenant ${tenant.tenant_id}:`, error);
    }
  }
});
```

**Business Tier:**
- **Quarterly Partial Failover Test:** Test failover to secondary region with subset of traffic

```javascript
// Quarterly partial failover test
async function performPartialFailoverTest(tenantId) {
  console.log(`Starting partial failover test for tenant ${tenantId}`);
  
  // Route 10% of traffic to secondary region
  await updateLoadBalancer({
    primary_weight: 90,
    secondary_weight: 10
  });
  
  // Monitor for 1 hour
  const startTime = Date.now();
  const testDuration = 60 * 60 * 1000; // 1 hour
  
  const metrics = {
    primary_latency: [],
    secondary_latency: [],
    error_rate: []
  };
  
  while (Date.now() - startTime < testDuration) {
    const primaryMetrics = await getRegionMetrics('primary');
    const secondaryMetrics = await getRegionMetrics('secondary');
    
    metrics.primary_latency.push(primaryMetrics.avg_latency);
    metrics.secondary_latency.push(secondaryMetrics.avg_latency);
    metrics.error_rate.push(secondaryMetrics.error_rate);
    
    await sleep(60000); // Check every minute
  }
  
  // Restore normal routing
  await updateLoadBalancer({
    primary_weight: 100,
    secondary_weight: 0
  });
  
  // Generate report
  const report = {
    test_date: new Date(),
    tenant_id: tenantId,
    avg_primary_latency: average(metrics.primary_latency),
    avg_secondary_latency: average(metrics.secondary_latency),
    max_error_rate: Math.max(...metrics.error_rate),
    status: Math.max(...metrics.error_rate) < 0.01 ? 'passed' : 'failed'
  };
  
  await db('dr_test_log').insert(report);
  
  return report;
}
```

**Enterprise Tier:**
- **Quarterly Full Failover Test:** Complete failover to secondary region with all traffic

```javascript
// Quarterly full failover test
async function performFullFailoverTest(tenantId) {
  console.log(`Starting full failover test for tenant ${tenantId}`);
  
  // Step 1: Announce maintenance window
  await sendMaintenanceNotification(tenantId, {
    start_time: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours notice
    duration: '30 minutes',
    reason: 'Scheduled DR test'
  });
  
  // Step 2: Initiate full failover
  const failoverStart = Date.now();
  
  // Promote secondary to primary
  await promoteSecondaryToPrimary(tenantId);
  
  // Update DNS
  await updateDNS(`${tenantId}.eduos.com`, SECONDARY_REGION_IP);
  
  // Wait for DNS propagation
  await sleep(60000);
  
  // Step 3: Verify all services
  const healthChecks = await runHealthChecks(tenantId);
  
  const failoverDuration = Date.now() - failoverStart;
  
  // Step 4: Monitor for 15 minutes
  const monitoringResults = await monitorFailoverPerformance(tenantId, 15);
  
  // Step 5: Failback to primary
  await failbackToPrimary(tenantId);
  
  // Step 6: Generate report
  const report = {
    test_date: new Date(),
    tenant_id: tenantId,
    failover_duration_ms: failoverDuration,
    rto_met: failoverDuration < 15 * 60 * 1000, // 15 minutes
    health_checks: healthChecks,
    monitoring_results: monitoringResults,
    status: failoverDuration < 15 * 60 * 1000 ? 'passed' : 'failed'
  };
  
  await db('dr_test_log').insert(report);
  
  return report;
}
```

---

### 4.4 Graceful Degradation & Failure Mode Handling (Requirement 23)

#### 4.4.1 Circuit Breaker Pattern

**Purpose:** Prevent cascading failures by detecting service failures and temporarily blocking requests.

**Implementation:**

```javascript
class CircuitBreaker {
  constructor(service, options = {}) {
    this.service = service;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    
    this.threshold = options.threshold || 5;
    this.timeout = options.timeout || 60000; // 1 minute
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
  }
  
  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new CircuitBreakerOpenError(
          `Circuit breaker is OPEN for ${this.service}. Try again later.`
        );
      }
      // Try to recover
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await Promise.race([
        operation(),
        this.timeout(this.timeout)
      ]);
      
      this.onSuccess();
      return result;
      
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      
      if (this.successCount >= 3) {
        this.state = 'CLOSED';
        this.successCount = 0;
        console.log(`Circuit breaker CLOSED for ${this.service}`);
      }
    }
  }
  
  onFailure() {
    this.failureCount++;
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      
      console.log(`Circuit breaker OPEN for ${this.service}`);
      
      // Send alert
      sendAlert({
        type: 'circuit_breaker_open',
        service: this.service,
        failure_count: this.failureCount
      });
    }
  }
  
  timeout(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), ms);
    });
  }
}

// Usage
const paymentGatewayBreaker = new CircuitBreaker('payment_gateway', {
  threshold: 5,
  timeout: 5000,
  resetTimeout: 60000
});

async function processPayment(paymentData) {
  try {
    return await paymentGatewayBreaker.execute(async () => {
      return await paymentGateway.charge(paymentData);
    });
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      // Queue payment for later processing
      await queuePayment(paymentData);
      
      return {
        status: 'queued',
        message: 'Payment gateway temporarily unavailable. Your payment has been queued.'
      };
    }
    throw error;
  }
}
```

#### 4.4.2 Payment Gateway Failure - Queueing Strategy

**Scenario:** Payment gateway is down or unresponsive.

**Fallback Strategy:**

```javascript
async function handlePaymentGatewayFailure(paymentData) {
  // Step 1: Queue payment for retry
  const queuedPayment = await db('payment_queue').insert({
    queue_id: uuidv4(),
    tenant_id: paymentData.tenant_id,
    student_id: paymentData.student_id,
    amount: paymentData.amount,
    currency: 'INR',
    payment_method: paymentData.payment_method,
    status: 'queued',
    retry_count: 0,
    max_retries: 5,
    created_at: new Date()
  }).returning('*');
  
  // Step 2: Provide manual recording option
  await sendNotification({
    to: 'finance_team',
    subject: 'Payment Gateway Failure - Manual Recording Required',
    body: `Payment gateway is unavailable. Payment of ₹${paymentData.amount} for student ${paymentData.student_id} has been queued. You can manually record this payment if needed.`,
    action_url: `/finance/manual-payment/${queuedPayment[0].queue_id}`
  });
  
  // Step 3: Retry with exponential backoff
  scheduleRetry(queuedPayment[0].queue_id, 1);
  
  return {
    status: 'queued',
    queue_id: queuedPayment[0].queue_id,
    message: 'Payment gateway temporarily unavailable. Your payment will be processed automatically when the service is restored.'
  };
}

async function scheduleRetry(queueId, attemptNumber) {
  // Exponential backoff: 1min, 2min, 4min, 8min, 16min
  const delayMs = Math.min(Math.pow(2, attemptNumber) * 60 * 1000, 16 * 60 * 1000);
  
  setTimeout(async () => {
    const queuedPayment = await db('payment_queue')
      .where({ queue_id: queueId })
      .first();
    
    if (queuedPayment.status !== 'queued') {
      return; // Already processed
    }
    
    try {
      // Attempt to process payment
      const result = await paymentGateway.charge({
        amount: queuedPayment.amount,
        currency: queuedPayment.currency,
        student_id: queuedPayment.student_id
      });
      
      // Success - update queue status
      await db('payment_queue')
        .where({ queue_id: queueId })
        .update({
          status: 'processed',
          processed_at: new Date(),
          gateway_transaction_id: result.transaction_id
        });
      
      // Create payment record
      await createPaymentRecord(queuedPayment, result);
      
    } catch (error) {
      // Retry failed
      const newRetryCount = queuedPayment.retry_count + 1;
      
      await db('payment_queue')
        .where({ queue_id: queueId })
        .update({
          retry_count: newRetryCount,
          last_retry_at: new Date(),
          last_error: error.message
        });
      
      if (newRetryCount < queuedPayment.max_retries) {
        // Schedule next retry
        scheduleRetry(queueId, attemptNumber + 1);
      } else {
        // Max retries exceeded - require manual intervention
        await db('payment_queue')
          .where({ queue_id: queueId })
          .update({ status: 'failed' });
        
        await sendAlert({
          type: 'payment_retry_exhausted',
          queue_id: queueId,
          student_id: queuedPayment.student_id,
          amount: queuedPayment.amount
        });
      }
    }
  }, delayMs);
}
```

#### 4.4.3 Read-Only Mode (Database Overload)

**Scenario:** Primary database is overloaded or experiencing high latency.

**Fallback Strategy:**

```javascript
class DatabaseHealthMonitor {
  constructor() {
    this.isReadOnly = false;
    this.healthCheckInterval = 30000; // 30 seconds
    this.latencyThreshold = 1000; // 1 second
    this.errorRateThreshold = 0.05; // 5%
  }
  
  async startMonitoring() {
    setInterval(async () => {
      const health = await this.checkDatabaseHealth();
      
      if (!health.isHealthy && !this.isReadOnly) {
        await this.enableReadOnlyMode();
      } else if (health.isHealthy && this.isReadOnly) {
        await this.disableReadOnlyMode();
      }
    }, this.healthCheckInterval);
  }
  
  async checkDatabaseHealth() {
    try {
      // Check query latency
      const start = Date.now();
      await db.raw('SELECT 1');
      const latency = Date.now() - start;
      
      // Check connection pool
      const poolStats = db.client.pool;
      const utilizationRate = poolStats.numUsed() / poolStats.size;
      
      // Check error rate (from last 5 minutes)
      const errorRate = await this.getRecentErrorRate();
      
      const isHealthy = 
        latency < this.latencyThreshold &&
        utilizationRate < 0.9 &&
        errorRate < this.errorRateThreshold;
      
      return {
        isHealthy,
        latency,
        utilizationRate,
        errorRate
      };
      
    } catch (error) {
      return {
        isHealthy: false,
        error: error.message
      };
    }
  }
  
  async enableReadOnlyMode() {
    console.log('Enabling READ-ONLY mode due to database overload');
    
    this.isReadOnly = true;
    
    // Update application state
    await redis.set('system:read_only', 'true');
    
    // Send alert
    await sendAlert({
      type: 'read_only_mode_enabled',
      reason: 'Database overload detected',
      timestamp: new Date()
    });
    
    // Display banner to users
    await broadcastMessage({
      type: 'system_status',
      message: 'System is temporarily in read-only mode. You can view data but cannot make changes.',
      severity: 'warning'
    });
  }
  
  async disableReadOnlyMode() {
    console.log('Disabling READ-ONLY mode - database health restored');
    
    this.isReadOnly = false;
    
    await redis.del('system:read_only');
    
    await sendAlert({
      type: 'read_only_mode_disabled',
      timestamp: new Date()
    });
    
    await broadcastMessage({
      type: 'system_status',
      message: 'System is back to normal operation.',
      severity: 'info'
    });
  }
  
  async getRecentErrorRate() {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    
    const stats = await redis.hgetall('db_stats:errors');
    const totalRequests = parseInt(stats.total_requests || 0);
    const totalErrors = parseInt(stats.total_errors || 0);
    
    return totalRequests > 0 ? totalErrors / totalRequests : 0;
  }
}

// Middleware to enforce read-only mode
async function readOnlyMiddleware(req, res, next) {
  const isReadOnly = await redis.get('system:read_only');
  
  if (isReadOnly === 'true' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'System is temporarily in read-only mode. Please try again later.',
      read_only: true
    });
  }
  
  next();
}

// Use read replicas for queries in read-only mode
async function executeQuery(query, params) {
  const isReadOnly = await redis.get('system:read_only');
  
  if (isReadOnly === 'true') {
    // Route to read replica
    return await readReplicaDb.query(query, params);
  } else {
    // Route to primary
    return await primaryDb.query(query, params);
  }
}
```

#### 4.4.4 Notification Redundancy (Fallback Chain)

**Scenario:** Primary notification channel fails.

**Fallback Strategy:** Push → SMS → Email

```javascript
class NotificationService {
  constructor() {
    this.channels = ['push', 'sms', 'email'];
    this.circuitBreakers = {
      push: new CircuitBreaker('push_notification'),
      sms: new CircuitBreaker('sms_gateway'),
      email: new CircuitBreaker('email_service')
    };
  }
  
  async sendNotification(notification) {
    const { user_id, message, priority } = notification;
    
    // Get user preferences
    const user = await db('users').where({ user_id }).first();
    const preferredChannels = this.getPreferredChannels(user, priority);
    
    for (const channel of preferredChannels) {
      try {
        const result = await this.sendViaChannel(channel, notification);
        
        if (result.success) {
          // Log successful delivery
          await this.logDelivery(notification, channel, 'success');
          return result;
        }
        
      } catch (error) {
        console.log(`Failed to send via ${channel}:`, error.message);
        
        // Log failed attempt
        await this.logDelivery(notification, channel, 'failed', error.message);
        
        // Continue to next channel
        continue;
      }
    }
    
    // All channels failed
    throw new Error('All notification channels failed');
  }
  
  getPreferredChannels(user, priority) {
    // Critical alerts override user preferences
    if (priority === 'critical') {
      return ['push', 'sms', 'email'];
    }
    
    // Use user preferences
    const channels = [];
    
    if (user.push_enabled) channels.push('push');
    if (user.sms_enabled) channels.push('sms');
    if (user.email_enabled) channels.push('email');
    
    // Fallback to email if no preferences set
    if (channels.length === 0) {
      channels.push('email');
    }
    
    return channels;
  }
  
  async sendViaChannel(channel, notification) {
    const breaker = this.circuitBreakers[channel];
    
    return await breaker.execute(async () => {
      switch (channel) {
        case 'push':
          return await this.sendPushNotification(notification);
        case 'sms':
          return await this.sendSMS(notification);
        case 'email':
          return await this.sendEmail(notification);
        default:
          throw new Error(`Unknown channel: ${channel}`);
      }
    });
  }
  
  async sendPushNotification(notification) {
    // Implementation using FCM or similar
    const result = await fcm.send({
      token: notification.device_token,
      notification: {
        title: notification.title,
        body: notification.message
      }
    });
    
    return { success: true, channel: 'push', message_id: result.messageId };
  }
  
  async sendSMS(notification) {
    // Implementation using Twilio or similar
    const result = await twilioClient.messages.create({
      to: notification.phone_number,
      from: process.env.TWILIO_PHONE,
      body: notification.message
    });
    
    return { success: true, channel: 'sms', message_id: result.sid };
  }
  
  async sendEmail(notification) {
    // Implementation using SendGrid or similar
    const result = await sendgridClient.send({
      to: notification.email,
      from: 'noreply@eduos.com',
      subject: notification.title,
      text: notification.message,
      html: notification.html_message
    });
    
    return { success: true, channel: 'email', message_id: result[0].messageId };
  }
  
  async logDelivery(notification, channel, status, error = null) {
    await db('notification_log').insert({
      log_id: uuidv4(),
      notification_id: notification.notification_id,
      user_id: notification.user_id,
      channel: channel,
      status: status,
      error_message: error,
      attempted_at: new Date()
    });
  }
}
```


---

## 5. Module D: Security, Compliance & Governance

### 5.1 Audit and Compliance (Requirement 13)

#### 5.1.1 Tamper-Evident Logging with SHA-256 Hash Chaining

**Purpose:** Create an immutable audit trail where any modification to historical logs can be detected.

**Hash Chaining Mechanism:**

Each audit log entry contains a hash of the previous entry, creating a blockchain-like chain that makes tampering detectable.

**Implementation:**

```javascript
class TamperEvidentAuditLog {
  constructor() {
    this.previousHash = null;
  }
  
  async createAuditEntry(auditData) {
    // Get the hash of the previous entry
    if (!this.previousHash) {
      const lastEntry = await db('audit_log')
        .where({ tenant_id: auditData.tenant_id })
        .orderBy('created_at', 'desc')
        .first();
      
      this.previousHash = lastEntry?.entry_hash || '0'.repeat(64); // Genesis hash
    }
    
    // Create audit entry
    const entry = {
      entry_id: uuidv4(),
      tenant_id: auditData.tenant_id,
      user_id: auditData.user_id,
      action: auditData.action,
      entity_type: auditData.entity_type,
      entity_id: auditData.entity_id,
      changes: auditData.changes,
      ip_address: auditData.ip_address,
      user_agent: auditData.user_agent,
      created_at: new Date(),
      previous_hash: this.previousHash
    };
    
    // Compute hash of current entry
    const entryString = JSON.stringify({
      entry_id: entry.entry_id,
      tenant_id: entry.tenant_id,
      user_id: entry.user_id,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      changes: entry.changes,
      created_at: entry.created_at.toISOString(),
      previous_hash: entry.previous_hash
    });
    
    entry.entry_hash = crypto
      .createHash('sha256')
      .update(entryString)
      .digest('hex');
    
    // Store in database
    await db('audit_log').insert(entry);
    
    // Update previous hash for next entry
    this.previousHash = entry.entry_hash;
    
    return entry;
  }
  
  async verifyAuditChain(tenantId, startDate, endDate) {
    const entries = await db('audit_log')
      .where({ tenant_id: tenantId })
      .whereBetween('created_at', [startDate, endDate])
      .orderBy('created_at', 'asc');
    
    const violations = [];
    let expectedPreviousHash = null;
    
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      
      // Verify previous hash matches
      if (i > 0 && entry.previous_hash !== expectedPreviousHash) {
        violations.push({
          entry_id: entry.entry_id,
          issue: 'broken_chain',
          expected_previous_hash: expectedPreviousHash,
          actual_previous_hash: entry.previous_hash
        });
      }
      
      // Recompute hash and verify
      const entryString = JSON.stringify({
        entry_id: entry.entry_id,
        tenant_id: entry.tenant_id,
        user_id: entry.user_id,
        action: entry.action,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        changes: entry.changes,
        created_at: entry.created_at.toISOString(),
        previous_hash: entry.previous_hash
      });
      
      const computedHash = crypto
        .createHash('sha256')
        .update(entryString)
        .digest('hex');
      
      if (computedHash !== entry.entry_hash) {
        violations.push({
          entry_id: entry.entry_id,
          issue: 'tampered_entry',
          expected_hash: computedHash,
          actual_hash: entry.entry_hash
        });
      }
      
      expectedPreviousHash = entry.entry_hash;
    }
    
    return {
      verified: violations.length === 0,
      total_entries: entries.length,
      violations: violations
    };
  }
}
```

**Database Schema:**

```sql
CREATE TABLE audit_log (
  entry_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_hash CHAR(64) NOT NULL,
  entry_hash CHAR(64) NOT NULL,
  CONSTRAINT no_update_or_delete CHECK (false)  -- Append-only
);

CREATE INDEX idx_audit_tenant_date ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
```

**Nightly Integrity Verification:**

```javascript
// Run nightly to verify audit chain integrity
cron.schedule('0 3 * * *', async () => {
  console.log('Starting nightly audit chain verification');
  
  const tenants = await db('tenants').select('tenant_id');
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const today = new Date();
  
  for (const tenant of tenants) {
    const auditLog = new TamperEvidentAuditLog();
    const result = await auditLog.verifyAuditChain(
      tenant.tenant_id,
      yesterday,
      today
    );
    
    if (!result.verified) {
      // Alert security team immediately
      await sendSecurityAlert({
        type: 'audit_chain_violation',
        tenant_id: tenant.tenant_id,
        violations: result.violations,
        severity: 'critical'
      });
    }
    
    // Log verification result
    await db('audit_verification_log').insert({
      verification_id: uuidv4(),
      tenant_id: tenant.tenant_id,
      verification_date: new Date(),
      entries_verified: result.total_entries,
      violations_found: result.violations.length,
      status: result.verified ? 'passed' : 'failed'
    });
  }
});
```

#### 5.1.2 Audit Export Security (Digital Signatures)

**Purpose:** Ensure exported audit logs cannot be tampered with after export.

**Implementation:**

```javascript
async function exportAuditLogs(tenantId, startDate, endDate, exportedBy) {
  // Step 1: Fetch audit logs
  const auditEntries = await db('audit_log')
    .where({ tenant_id: tenantId })
    .whereBetween('created_at', [startDate, endDate])
    .orderBy('created_at', 'asc');
  
  // Step 2: Create export package
  const exportData = {
    export_id: uuidv4(),
    tenant_id: tenantId,
    start_date: startDate,
    end_date: endDate,
    total_entries: auditEntries.length,
    entries: auditEntries,
    exported_by: exportedBy,
    exported_at: new Date()
  };
  
  // Step 3: Compute SHA-256 hash of export data
  const exportString = JSON.stringify(exportData);
  const exportHash = crypto
    .createHash('sha256')
    .update(exportString)
    .digest('hex');
  
  // Step 4: Sign the hash with institution's private key
  const privateKey = await getInstitutionPrivateKey(tenantId);
  const signature = crypto.sign(
    'sha256',
    Buffer.from(exportHash),
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING
    }
  );
  
  // Step 5: Create signed export package
  const signedExport = {
    ...exportData,
    export_hash: exportHash,
    signature: signature.toString('base64'),
    public_key_url: `https://eduos.com/keys/${tenantId}/public-key.pem`
  };
  
  // Step 6: Store export metadata
  await db('audit_exports').insert({
    export_id: exportData.export_id,
    tenant_id: tenantId,
    start_date: startDate,
    end_date: endDate,
    total_entries: auditEntries.length,
    export_hash: exportHash,
    signature: signature.toString('base64'),
    exported_by: exportedBy,
    exported_at: new Date()
  });
  
  // Step 7: Generate downloadable file
  const exportFile = JSON.stringify(signedExport, null, 2);
  const filePath = `/exports/audit_${exportData.export_id}.json`;
  
  await fs.writeFile(filePath, exportFile);
  
  return {
    export_id: exportData.export_id,
    file_path: filePath,
    download_url: `/api/v1/audit/exports/${exportData.export_id}/download`
  };
}

// Verify exported audit log
async function verifyAuditExport(exportFile) {
  const exportData = JSON.parse(exportFile);
  
  // Step 1: Recompute hash
  const { export_hash, signature, public_key_url, ...dataToHash } = exportData;
  const computedHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(dataToHash))
    .digest('hex');
  
  if (computedHash !== export_hash) {
    return {
      verified: false,
      reason: 'Hash mismatch - data has been tampered with'
    };
  }
  
  // Step 2: Verify signature
  const publicKey = await fetchPublicKey(public_key_url);
  const isValid = crypto.verify(
    'sha256',
    Buffer.from(export_hash),
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING
    },
    Buffer.from(signature, 'base64')
  );
  
  if (!isValid) {
    return {
      verified: false,
      reason: 'Invalid signature - export authenticity cannot be verified'
    };
  }
  
  return {
    verified: true,
    export_id: exportData.export_id,
    tenant_id: exportData.tenant_id,
    total_entries: exportData.total_entries,
    exported_at: exportData.exported_at
  };
}
```

#### 5.1.3 Audit Retention Policies

**Retention Periods:**
- **Basic Tier:** 7 years
- **Business Tier:** 10 years
- **Enterprise Tier:** 99 years

**Implementation:**

```javascript
// Automated retention policy enforcement
cron.schedule('0 4 * * 0', async () => {
  console.log('Starting weekly audit retention policy enforcement');
  
  const tenants = await db('tenants').select('tenant_id', 'tier');
  
  for (const tenant of tenants) {
    const retentionYears = {
      'basic': 7,
      'business': 10,
      'enterprise': 99
    }[tenant.tier];
    
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionYears);
    
    // Archive old logs to cold storage before deletion
    const oldLogs = await db('audit_log')
      .where({ tenant_id: tenant.tenant_id })
      .where('created_at', '<', cutoffDate);
    
    if (oldLogs.length > 0) {
      // Export to cold storage (S3 Glacier)
      await archiveToGlacier(tenant.tenant_id, oldLogs);
      
      // Delete from active database
      await db('audit_log')
        .where({ tenant_id: tenant.tenant_id })
        .where('created_at', '<', cutoffDate)
        .delete();
      
      console.log(`Archived ${oldLogs.length} audit logs for tenant ${tenant.tenant_id}`);
    }
  }
});
```

#### 5.1.4 Legal Hold Mechanisms

**Purpose:** Prevent deletion of data during litigation or regulatory investigations.

**Legal Hold Workflow:**

1. **Initiate Legal Hold:**
   - Legal team or compliance officer creates a legal hold request.
   - Specifies scope: tenant, date range, entity types (students, payments, etc.).
   - Provides case reference number and justification.

2. **Apply Hold Flag:**
   ```sql
   -- Mark affected records with legal hold flag
   UPDATE students
   SET legal_hold_status = 'active',
       legal_hold_case_id = 'case-2026-001',
       legal_hold_applied_at = NOW(),
       legal_hold_applied_by = 'legal-officer-uuid'
   WHERE tenant_id = 'tenant-uuid'
     AND created_at BETWEEN '2025-01-01' AND '2025-12-31';
   
   -- Prevent deletion via database constraint
   ALTER TABLE students ADD CONSTRAINT prevent_legal_hold_deletion
   CHECK (legal_hold_status IS NULL OR legal_hold_status != 'active');
   ```

3. **Automated Retention Override:**
   - Records under legal hold are exempt from automated deletion policies.
   - Retention policy engine checks `legal_hold_status` before deletion.


4. **Audit Trail:**
   ```javascript
   await createAuditEntry({
     action: 'legal_hold_applied',
     entity_type: 'students',
     affected_count: 1250,
     case_id: 'case-2026-001',
     justification: 'Ongoing investigation into enrollment fraud allegations',
     applied_by: 'legal-officer-uuid',
     applied_at: new Date()
   });
   ```

5. **Release Legal Hold:**
   - Once case is resolved, legal team releases the hold.
   - Records return to normal retention policy lifecycle.
   ```sql
   UPDATE students
   SET legal_hold_status = 'released',
       legal_hold_released_at = NOW(),
       legal_hold_released_by = 'legal-officer-uuid'
   WHERE legal_hold_case_id = 'case-2026-001';
   ```

**Database Schema:**
```sql
CREATE TABLE legal_holds (
  hold_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  case_id VARCHAR(100) NOT NULL,
  case_description TEXT,
  scope_entity_types TEXT[] NOT NULL,
  scope_date_start DATE,
  scope_date_end DATE,
  status VARCHAR(20) NOT NULL, -- 'active', 'released'
  applied_by UUID NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_by UUID,
  released_at TIMESTAMPTZ
);
```


---

### 5.2 Security and Access Control (Requirement 14)

#### 5.2.1 Authentication Mechanisms

**Multi-Factor Authentication (MFA):**

EduOS supports multiple MFA methods for enhanced security.

**Supported MFA Methods:**
1. **Time-Based One-Time Password (TOTP):** Google Authenticator, Authy
2. **SMS-Based OTP:** 6-digit code sent via SMS
3. **Email-Based OTP:** 6-digit code sent via email
4. **Hardware Security Keys:** FIDO2/WebAuthn (YubiKey, Titan Key)

**MFA Enrollment Workflow:**

```javascript
async function enrollMFA(userId, method, credentials) {
  // Step 1: Verify user identity (require current password)
  await verifyPassword(userId, credentials.current_password);
  
  // Step 2: Generate MFA secret based on method
  let mfaSecret;
  
  switch (method) {
    case 'totp':
      mfaSecret = speakeasy.generateSecret({ length: 32 });
      break;
    case 'sms':
      mfaSecret = await generateSMSSecret(credentials.phone_number);
      break;
    case 'email':
      mfaSecret = await generateEmailSecret(credentials.email);
      break;
    case 'fido2':
      mfaSecret = await registerFIDO2Device(userId, credentials.device_name);
      break;
  }
  
  // Step 3: Store MFA configuration
  await db('user_mfa').insert({
    mfa_id: uuidv4(),
    user_id: userId,
    method: method,
    secret: encrypt(mfaSecret),
    status: 'pending_verification',
    enrolled_at: new Date()
  });
  
  // Step 4: Send verification challenge
  return {
    mfa_id: mfaSecret.mfa_id,
    qr_code: method === 'totp' ? mfaSecret.otpauth_url : null,
    verification_required: true
  };
}
```


**Single Sign-On (SSO) Integration:**

EduOS supports enterprise SSO via SAML 2.0 and OpenID Connect (OIDC).

**SAML 2.0 Configuration:**

```javascript
const samlStrategy = new SamlStrategy({
  entryPoint: 'https://idp.institution.edu/saml/sso',
  issuer: 'eduos-platform',
  callbackUrl: 'https://eduos.com/auth/saml/callback',
  cert: fs.readFileSync('/path/to/idp-cert.pem', 'utf-8'),
  identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'
}, async (profile, done) => {
  // Map SAML attributes to EduOS user
  const user = await findOrCreateUser({
    email: profile.email,
    first_name: profile.firstName,
    last_name: profile.lastName,
    tenant_id: profile.tenantId,
    sso_provider: 'saml',
    sso_subject_id: profile.nameID
  });
  
  return done(null, user);
});
```

**Adaptive Authentication:**

The system adjusts authentication requirements based on risk signals.

**Risk Factors:**
- **Impossible Travel:** Login from geographically distant location within short time
- **New Device:** First-time login from unrecognized device
- **Unusual Time:** Login outside normal hours (e.g., 3 AM)
- **Failed Attempts:** Multiple failed login attempts recently
- **Suspicious IP:** IP address flagged in threat intelligence feeds


**Adaptive Authentication Logic:**

```javascript
async function calculateAuthRiskScore(loginAttempt) {
  let riskScore = 0;
  
  // Check impossible travel
  const lastLogin = await getLastSuccessfulLogin(loginAttempt.user_id);
  if (lastLogin) {
    const distance = calculateDistance(lastLogin.location, loginAttempt.location);
    const timeDiff = (loginAttempt.timestamp - lastLogin.timestamp) / 3600000; // hours
    const speed = distance / timeDiff;
    
    if (speed > 800) { // km/h - impossible for ground travel
      riskScore += 40;
    }
  }
  
  // Check device fingerprint
  const knownDevice = await isKnownDevice(loginAttempt.user_id, loginAttempt.device_fingerprint);
  if (!knownDevice) {
    riskScore += 20;
  }
  
  // Check login time
  const hour = new Date(loginAttempt.timestamp).getHours();
  if (hour < 6 || hour > 22) {
    riskScore += 10;
  }
  
  // Check failed attempts
  const recentFailures = await countRecentFailedAttempts(loginAttempt.user_id, 24);
  riskScore += Math.min(recentFailures * 5, 30);
  
  return riskScore;
}

async function enforceAdaptiveAuth(loginAttempt) {
  const riskScore = await calculateAuthRiskScore(loginAttempt);
  
  if (riskScore >= 50) {
    // High risk: Require MFA + Email verification
    return { mfa_required: true, email_verification_required: true };
  } else if (riskScore >= 30) {
    // Medium risk: Require MFA
    return { mfa_required: true };
  } else {
    // Low risk: Standard authentication
    return { mfa_required: false };
  }
}
```


#### 5.2.2 Encryption Standards

**Data at Rest Encryption:**

All sensitive data is encrypted using AES-256 encryption.

**Implementation:**

```javascript
const crypto = require('crypto');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16;  // 128 bits
    this.tagLength = 16; // 128 bits
  }
  
  async encrypt(plaintext, dataEncryptionKey) {
    // Generate random initialization vector
    const iv = crypto.randomBytes(this.ivLength);
    
    // Create cipher
    const cipher = crypto.createCipheriv(
      this.algorithm,
      Buffer.from(dataEncryptionKey, 'hex'),
      iv
    );
    
    // Encrypt data
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag
    const tag = cipher.getAuthTag();
    
    // Return encrypted data with IV and tag
    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }
  
  async decrypt(encryptedData, dataEncryptionKey) {
    // Create decipher
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      Buffer.from(dataEncryptionKey, 'hex'),
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    // Set authentication tag
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    // Decrypt data
    let decrypted = decipher.update(encryptedData.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```


**Database Column Encryption:**

Sensitive fields are encrypted at the application layer before storage.

```sql
-- Encrypted fields in database
CREATE TABLE students (
  student_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  
  -- Encrypted fields (stored as TEXT with IV and tag)
  national_id_encrypted TEXT,
  national_id_iv TEXT,
  national_id_tag TEXT,
  
  medical_history_encrypted TEXT,
  medical_history_iv TEXT,
  medical_history_tag TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Data in Transit Encryption:**

All network communication uses TLS 1.3 with strong cipher suites.

**TLS Configuration:**

```nginx
# Nginx TLS configuration
ssl_protocols TLSv1.3;
ssl_ciphers 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256';
ssl_prefer_server_ciphers on;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_stapling on;
ssl_stapling_verify on;

# HSTS header (force HTTPS)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```


#### 5.2.3 Key Management

**Key Hierarchy:**

EduOS uses a three-tier key hierarchy for encryption key management.

**Key Hierarchy Structure:**

1. **Master Encryption Key (MEK):**
   - Stored in AWS KMS or Azure Key Vault (Enterprise tier only)
   - Never leaves the HSM (Hardware Security Module)
   - Used to encrypt Data Encryption Keys (DEKs)
   - Rotated annually

2. **Data Encryption Keys (DEKs):**
   - Generated per tenant
   - Encrypted by MEK and stored in database
   - Used to encrypt actual data fields
   - Rotated quarterly

3. **Field-Level Keys:**
   - Derived from DEK using HKDF (HMAC-based Key Derivation Function)
   - Used for specific sensitive fields
   - Rotated on-demand

**Key Generation and Storage:**

```javascript
async function generateTenantDEK(tenantId) {
  // Step 1: Generate random 256-bit DEK
  const dek = crypto.randomBytes(32);
  
  // Step 2: Encrypt DEK with MEK (via KMS)
  const encryptedDEK = await kms.encrypt({
    KeyId: process.env.MASTER_KEY_ID,
    Plaintext: dek
  });
  
  // Step 3: Store encrypted DEK in database
  await db('encryption_keys').insert({
    key_id: uuidv4(),
    tenant_id: tenantId,
    key_type: 'dek',
    encrypted_key: encryptedDEK.CiphertextBlob.toString('base64'),
    created_at: new Date(),
    status: 'active'
  });
  
  return dek.toString('hex');
}
```


**Key Rotation:**

```javascript
async function rotateTenantDEK(tenantId) {
  // Step 1: Generate new DEK
  const newDEK = await generateTenantDEK(tenantId);
  
  // Step 2: Get old DEK
  const oldKeyRecord = await db('encryption_keys')
    .where({ tenant_id: tenantId, status: 'active' })
    .first();
  
  const oldDEK = await decryptDEK(oldKeyRecord.encrypted_key);
  
  // Step 3: Re-encrypt all data with new DEK
  const encryptionService = new EncryptionService();
  
  const students = await db('students')
    .where({ tenant_id: tenantId })
    .whereNotNull('national_id_encrypted');
  
  for (const student of students) {
    // Decrypt with old key
    const decrypted = await encryptionService.decrypt({
      ciphertext: student.national_id_encrypted,
      iv: student.national_id_iv,
      tag: student.national_id_tag
    }, oldDEK);
    
    // Re-encrypt with new key
    const reencrypted = await encryptionService.encrypt(decrypted, newDEK);
    
    // Update database
    await db('students')
      .where({ student_id: student.student_id })
      .update({
        national_id_encrypted: reencrypted.ciphertext,
        national_id_iv: reencrypted.iv,
        national_id_tag: reencrypted.tag
      });
  }
  
  // Step 4: Mark old key as rotated
  await db('encryption_keys')
    .where({ key_id: oldKeyRecord.key_id })
    .update({ status: 'rotated', rotated_at: new Date() });
}
```


#### 5.2.4 Real-Time Threat Detection

**Anomaly Detection System:**

EduOS monitors user behavior in real-time to detect security threats.

**Detection Patterns:**

1. **Brute Force Attack Detection:**
   ```javascript
   async function detectBruteForce(userId, ipAddress) {
     const failedAttempts = await redis.get(`failed_login:${userId}:${ipAddress}`);
     
     if (failedAttempts >= 5) {
       // Lock account temporarily
       await lockAccount(userId, '15 minutes');
       
       // Alert security team
       await sendSecurityAlert({
         type: 'brute_force_detected',
         user_id: userId,
         ip_address: ipAddress,
         failed_attempts: failedAttempts
       });
       
       return { blocked: true, reason: 'Too many failed attempts' };
     }
     
     return { blocked: false };
   }
   ```

2. **Impossible Travel Detection:**
   - Already implemented in Adaptive Authentication (Section 5.2.1)
   - Detects logins from geographically distant locations within short time

3. **Privilege Escalation Detection:**
   ```javascript
   async function detectPrivilegeEscalation(userId, requestedAction) {
     const user = await getUserById(userId);
     const recentRoleChanges = await db('role_changes')
       .where({ user_id: userId })
       .where('changed_at', '>', new Date(Date.now() - 3600000)) // Last hour
       .count();
     
     if (recentRoleChanges > 0 && isHighPrivilegeAction(requestedAction)) {
       // Flag for review
       await createSecurityFlag({
         type: 'potential_privilege_escalation',
         user_id: userId,
         action: requestedAction,
         reason: 'High-privilege action attempted shortly after role change'
       });
     }
   }
   ```


4. **Data Exfiltration Detection:**
   ```javascript
   async function detectDataExfiltration(userId, exportRequest) {
     const recentExports = await db('data_exports')
       .where({ user_id: userId })
       .where('created_at', '>', new Date(Date.now() - 86400000)) // Last 24h
       .sum('record_count as total');
     
     if (total > 10000) {
       // Unusual volume of exports
       await createSecurityFlag({
         type: 'potential_data_exfiltration',
         user_id: userId,
         total_records_exported: total,
         reason: 'Unusually high volume of data exports in 24 hours'
       });
       
       // Require additional approval
       return { requires_approval: true };
     }
     
     return { requires_approval: false };
   }
   ```

**Automated Response Actions:**

```javascript
const securityPlaybooks = {
  'brute_force_detected': async (alert) => {
    await lockAccount(alert.user_id, '15 minutes');
    await blockIP(alert.ip_address, '1 hour');
    await notifySecurityTeam(alert);
  },
  
  'impossible_travel': async (alert) => {
    await requireMFAVerification(alert.user_id);
    await notifyUser(alert.user_id, 'suspicious_login_detected');
    await notifySecurityTeam(alert);
  },
  
  'potential_privilege_escalation': async (alert) => {
    await flagForManualReview(alert);
    await notifySecurityTeam(alert);
  }
};
```


#### 5.2.5 Vulnerability Scanning and Security Testing

**Automated Security Scanning:**

EduOS performs regular security scans to identify vulnerabilities.

**Scanning Schedule:**
- **Dependency Scanning:** Daily (npm audit, Snyk)
- **Static Application Security Testing (SAST):** On every commit (SonarQube, Semgrep)
- **Dynamic Application Security Testing (DAST):** Weekly (OWASP ZAP, Burp Suite)
- **Container Scanning:** On every Docker image build (Trivy, Clair)
- **Infrastructure Scanning:** Weekly (AWS Inspector, Azure Security Center)

**CI/CD Security Pipeline:**

```yaml
# GitHub Actions workflow
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Dependency Audit
        run: npm audit --audit-level=high
      
      - name: SAST Scan
        uses: returntocorp/semgrep-action@v1
        with:
          config: p/security-audit
      
      - name: Container Scan
        run: |
          docker build -t eduos:${{ github.sha }} .
          trivy image --severity HIGH,CRITICAL eduos:${{ github.sha }}
      
      - name: Fail on Critical Vulnerabilities
        run: |
          if [ $? -ne 0 ]; then
            echo "Critical vulnerabilities found. Blocking deployment."
            exit 1
          fi
```


---

### 5.3 Data Privacy and Governance

#### 5.3.1 Granular Consent Management (Requirement 18)

**Consent Purpose Taxonomy:**

EduOS defines specific purposes for data processing, each requiring explicit consent.

**Consent Purposes:**
- `academic_records_storage`: Store and process academic performance data
- `medical_records_storage`: Store and process medical/health information
- `marketing_communications`: Send promotional emails and notifications
- `data_analytics`: Use data for institutional analytics and reporting
- `third_party_sharing`: Share data with external partners (LMS, assessment tools)
- `ai_model_training`: Use data to train AI models (duplicate detection, risk prediction)

**Consent Record Schema:**

```json
{
  "consent_id": "uuid-v4",
  "user_id": "student-uuid",
  "guardian_id": "guardian-uuid",  // Required for minors
  "purpose": "medical_records_storage",
  "status": "granted | withdrawn | expired",
  "consent_version": "v1.2",
  "consent_text": "I consent to EduOS storing and processing my medical records...",
  "granted_at": "2026-01-15T09:00:00Z",
  "granted_via": "web_form | mobile_app | paper_form",
  "expires_at": "2027-01-15T09:00:00Z",
  "withdrawn_at": null,
  "withdrawal_reason": null
}
```


**Consent Enforcement:**

```javascript
async function enforceConsent(userId, purpose) {
  const consent = await db('user_consents')
    .where({ user_id: userId, purpose: purpose })
    .where('status', 'granted')
    .where('expires_at', '>', new Date())
    .first();
  
  if (!consent) {
    throw new ConsentRequiredError({
      purpose: purpose,
      message: `User has not granted consent for: ${purpose}`,
      consent_url: `/consent/request?purpose=${purpose}`
    });
  }
  
  // Log consent verification
  await db('consent_verifications').insert({
    verification_id: uuidv4(),
    consent_id: consent.consent_id,
    verified_at: new Date(),
    verified_for_action: 'data_access'
  });
  
  return consent;
}

// Example usage in API endpoint
app.get('/api/v1/students/:studentId/medical-history', async (req, res) => {
  try {
    // Enforce consent before accessing medical data
    await enforceConsent(req.params.studentId, 'medical_records_storage');
    
    const medicalHistory = await getMedicalHistory(req.params.studentId);
    res.json(medicalHistory);
  } catch (error) {
    if (error instanceof ConsentRequiredError) {
      res.status(403).json({
        error: 'Consent Required',
        message: error.message,
        consent_url: error.consent_url
      });
    } else {
      throw error;
    }
  }
});
```


**Consent Withdrawal:**

Users can withdraw consent at any time. The system must stop processing affected data within 72 hours.

```javascript
async function withdrawConsent(userId, purpose, reason) {
  // Step 1: Update consent record
  await db('user_consents')
    .where({ user_id: userId, purpose: purpose, status: 'granted' })
    .update({
      status: 'withdrawn',
      withdrawn_at: new Date(),
      withdrawal_reason: reason
    });
  
  // Step 2: Queue data processing stop
  await queue.add('stop-data-processing', {
    user_id: userId,
    purpose: purpose,
    deadline: new Date(Date.now() + 72 * 3600000) // 72 hours
  });
  
  // Step 3: Notify affected systems
  await notifyDataProcessors({
    user_id: userId,
    purpose: purpose,
    action: 'stop_processing',
    deadline: '72 hours'
  });
  
  // Step 4: Create audit record
  await createAuditEntry({
    action: 'consent_withdrawn',
    user_id: userId,
    purpose: purpose,
    reason: reason
  });
  
  return {
    success: true,
    message: 'Consent withdrawn. Data processing will stop within 72 hours.',
    withdrawal_id: uuidv4()
  };
}
```

**Parental Consent for Minors:**

For users under the age of majority (18 in most jurisdictions), parental consent is required.

```javascript
async function requestParentalConsent(studentId, guardianId, purpose) {
  // Step 1: Create pending consent request
  const consentRequest = await db('consent_requests').insert({
    request_id: uuidv4(),
    student_id: studentId,
    guardian_id: guardianId,
    purpose: purpose,
    status: 'pending',
    created_at: new Date(),
    expires_at: new Date(Date.now() + 30 * 86400000) // 30 days
  });
  
  // Step 2: Send notification to guardian
  await sendEmail({
    to: guardian.email,
    subject: 'Parental Consent Required',
    template: 'parental_consent_request',
    data: {
      student_name: student.name,
      purpose: purpose,
      consent_url: `https://eduos.com/consent/${consentRequest.request_id}`
    }
  });
  
  return consentRequest;
}
```


#### 5.3.2 Data Subject Rights (GDPR/FERPA Compliance)

**Right to Access (Data Subject Access Request - DSAR):**

Users can request a complete copy of their personal data.

```javascript
async function processDSAR(userId, requestedBy) {
  // Step 1: Verify identity
  await verifyIdentity(userId, requestedBy);
  
  // Step 2: Collect all personal data
  const personalData = {
    profile: await db('students').where({ student_id: userId }).first(),
    enrollments: await db('enrollments').where({ student_id: userId }),
    attendance: await db('attendance_records').where({ student_id: userId }),
    grades: await db('grade_records').where({ student_id: userId }),
    payments: await db('payment_records').where({ student_id: userId }),
    consents: await db('user_consents').where({ user_id: userId }),
    audit_logs: await db('audit_log').where({ user_id: userId })
  };
  
  // Step 3: Decrypt sensitive fields
  const encryptionService = new EncryptionService();
  const dek = await getTenantDEK(personalData.profile.tenant_id);
  
  if (personalData.profile.national_id_encrypted) {
    personalData.profile.national_id = await encryptionService.decrypt({
      ciphertext: personalData.profile.national_id_encrypted,
      iv: personalData.profile.national_id_iv,
      tag: personalData.profile.national_id_tag
    }, dek);
  }
  
  // Step 4: Generate export package
  const exportPackage = {
    export_id: uuidv4(),
    user_id: userId,
    exported_at: new Date(),
    data: personalData
  };
  
  const exportFile = JSON.stringify(exportPackage, null, 2);
  const filePath = `/exports/dsar_${exportPackage.export_id}.json`;
  
  await fs.writeFile(filePath, exportFile);
  
  // Step 5: Create audit record
  await createAuditEntry({
    action: 'dsar_processed',
    user_id: userId,
    export_id: exportPackage.export_id
  });
  
  return {
    export_id: exportPackage.export_id,
    download_url: `/api/v1/privacy/dsar/${exportPackage.export_id}/download`,
    expires_at: new Date(Date.now() + 7 * 86400000) // 7 days
  };
}
```


**Right to be Forgotten (Data Erasure):**

Users can request deletion of their personal data, subject to legal retention requirements.

```javascript
async function processRightToBeForgotten(userId, requestedBy, reason) {
  // Step 1: Verify identity and authorization
  await verifyIdentity(userId, requestedBy);
  
  // Step 2: Check legal retention requirements
  const retentionChecks = await checkRetentionRequirements(userId);
  
  if (retentionChecks.has_active_legal_hold) {
    throw new Error('Cannot delete data: Active legal hold exists');
  }
  
  if (retentionChecks.has_pending_financial_obligations) {
    throw new Error('Cannot delete data: Pending financial obligations exist');
  }
  
  // Step 3: Create pre-deletion snapshot (for potential restoration)
  const snapshot = await createDeletionSnapshot(userId);
  
  // Step 4: Anonymize data (instead of hard delete)
  await db.transaction(async (trx) => {
    // Anonymize student profile
    await trx('students')
      .where({ student_id: userId })
      .update({
        first_name: 'DELETED',
        last_name: 'USER',
        email: `deleted_${userId}@anonymized.local`,
        phone: null,
        national_id_encrypted: null,
        medical_history_encrypted: null,
        status: 'anonymized',
        anonymized_at: new Date(),
        anonymization_reason: reason
      });
    
    // Anonymize related records
    await trx('attendance_records')
      .where({ student_id: userId })
      .update({ anonymized: true });
    
    await trx('grade_records')
      .where({ student_id: userId })
      .update({ anonymized: true });
  });
  
  // Step 5: Create audit record
  await createAuditEntry({
    action: 'right_to_be_forgotten_processed',
    user_id: userId,
    snapshot_id: snapshot.snapshot_id,
    reason: reason
  });
  
  return {
    success: true,
    message: 'Personal data has been anonymized',
    snapshot_id: snapshot.snapshot_id,
    restoration_deadline: new Date(Date.now() + 30 * 86400000) // 30 days
  };
}
```


**Data Minimization:**

The system automatically identifies and removes unnecessary data.

```javascript
// Automated data minimization job
cron.schedule('0 2 * * 0', async () => {
  console.log('Starting weekly data minimization scan');
  
  // Identify unused fields
  const unusedFields = await db('field_usage_stats')
    .where('last_accessed_at', '<', new Date(Date.now() - 365 * 86400000)) // 1 year
    .where('access_count', '<', 10);
  
  for (const field of unusedFields) {
    // Flag for review
    await db('data_minimization_candidates').insert({
      candidate_id: uuidv4(),
      field_id: field.field_id,
      reason: 'Low usage: accessed less than 10 times in past year',
      identified_at: new Date(),
      status: 'pending_review'
    });
  }
  
  // Identify duplicate records
  const duplicates = await findDuplicateRecords();
  
  for (const duplicate of duplicates) {
    await db('data_minimization_candidates').insert({
      candidate_id: uuidv4(),
      record_type: duplicate.record_type,
      record_ids: duplicate.record_ids,
      reason: 'Duplicate record detected',
      identified_at: new Date(),
      status: 'pending_review'
    });
  }
  
  console.log(`Identified ${unusedFields.length + duplicates.length} data minimization candidates`);
});
```


#### 5.3.3 SuperAdmin Impersonation and Privileged Access (Requirement 25)

**Impersonation Workflow:**

SuperAdmins can impersonate users for support purposes, but with strict controls.

**Step 1: Request Impersonation**

```javascript
async function requestImpersonation(adminId, targetUserId, justification) {
  // Verify admin has SuperAdmin role
  const admin = await getUserById(adminId);
  if (admin.role !== 'superadmin') {
    throw new ForbiddenError('Only SuperAdmins can request impersonation');
  }
  
  // Create impersonation request
  const request = await db('impersonation_requests').insert({
    request_id: uuidv4(),
    admin_id: adminId,
    target_user_id: targetUserId,
    justification: justification,
    status: 'pending_approval',
    created_at: new Date()
  });
  
  // Notify second approver
  const secondApprover = await getRandomSuperAdmin(adminId); // Different from requester
  await sendNotification({
    to: secondApprover.id,
    type: 'impersonation_approval_required',
    data: {
      request_id: request.request_id,
      requester: admin.name,
      target_user: targetUserId,
      justification: justification
    }
  });
  
  return request;
}
```

**Step 2: Approve Impersonation**

```javascript
async function approveImpersonation(approverId, requestId) {
  const request = await db('impersonation_requests')
    .where({ request_id: requestId })
    .first();
  
  if (request.admin_id === approverId) {
    throw new Error('Cannot approve your own impersonation request');
  }
  
  // Update request status
  await db('impersonation_requests')
    .where({ request_id: requestId })
    .update({
      status: 'approved',
      approved_by: approverId,
      approved_at: new Date()
    });
  
  // Generate time-limited impersonation token
  const token = jwt.sign({
    admin_id: request.admin_id,
    target_user_id: request.target_user_id,
    request_id: requestId,
    expires_at: new Date(Date.now() + 4 * 3600000) // 4 hours
  }, process.env.IMPERSONATION_SECRET);
  
  return { token: token, expires_in: '4 hours' };
}
```


**Step 3: Execute Impersonation Session**

```javascript
async function startImpersonationSession(token) {
  // Verify token
  const payload = jwt.verify(token, process.env.IMPERSONATION_SECRET);
  
  if (new Date(payload.expires_at) < new Date()) {
    throw new Error('Impersonation token has expired');
  }
  
  // Create session
  const session = await db('impersonation_sessions').insert({
    session_id: uuidv4(),
    request_id: payload.request_id,
    admin_id: payload.admin_id,
    target_user_id: payload.target_user_id,
    started_at: new Date(),
    expires_at: payload.expires_at,
    status: 'active'
  });
  
  // Create audit entry
  await createAuditEntry({
    action: 'impersonation_session_started',
    user_id: payload.admin_id,
    target_user_id: payload.target_user_id,
    session_id: session.session_id
  });
  
  return session;
}

// Middleware to track impersonation actions
async function impersonationAuditMiddleware(req, res, next) {
  if (req.session.impersonation_session_id) {
    // Log every action during impersonation
    await createAuditEntry({
      action: req.method + ' ' + req.path,
      user_id: req.session.admin_id,
      target_user_id: req.session.target_user_id,
      impersonation_session_id: req.session.impersonation_session_id,
      request_body: req.body,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });
  }
  
  next();
}
```


**Step 4: Automatic Session Termination**

```javascript
// Automatically terminate expired impersonation sessions
cron.schedule('*/5 * * * *', async () => {
  const expiredSessions = await db('impersonation_sessions')
    .where('status', 'active')
    .where('expires_at', '<', new Date());
  
  for (const session of expiredSessions) {
    await db('impersonation_sessions')
      .where({ session_id: session.session_id })
      .update({
        status: 'expired',
        ended_at: new Date()
      });
    
    await createAuditEntry({
      action: 'impersonation_session_expired',
      user_id: session.admin_id,
      target_user_id: session.target_user_id,
      session_id: session.session_id
    });
  }
});
```

**Impersonation Audit Report:**

```javascript
async function generateImpersonationAuditReport(tenantId, startDate, endDate) {
  const sessions = await db('impersonation_sessions')
    .join('impersonation_requests', 'impersonation_sessions.request_id', 'impersonation_requests.request_id')
    .join('users as admins', 'impersonation_sessions.admin_id', 'admins.user_id')
    .join('users as targets', 'impersonation_sessions.target_user_id', 'targets.user_id')
    .where('impersonation_sessions.started_at', '>=', startDate)
    .where('impersonation_sessions.started_at', '<=', endDate)
    .select(
      'impersonation_sessions.session_id',
      'admins.name as admin_name',
      'targets.name as target_user_name',
      'impersonation_requests.justification',
      'impersonation_sessions.started_at',
      'impersonation_sessions.ended_at',
      'impersonation_sessions.status'
    );
  
  // Get action count for each session
  for (const session of sessions) {
    const actionCount = await db('audit_log')
      .where({ impersonation_session_id: session.session_id })
      .count('* as total');
    
    session.actions_performed = actionCount[0].total;
  }
  
  return {
    report_id: uuidv4(),
    generated_at: new Date(),
    period: { start: startDate, end: endDate },
    total_sessions: sessions.length,
    sessions: sessions
  };
}
```

---



### 5.4 Data Retention and Lifecycle Management (Requirement 16)

#### 5.4.1 Retention Policy Engine

**Purpose:** Automate data lifecycle management based on configurable retention policies.

**Policy Configuration:**

```json
{
  "policy_id": "uuid-v4",
  "tenant_id": "uuid-v4",
  "data_type": "student_data | financial_records | audit_logs | medical_records",
  "retention_period_years": 7,
  "transition_rules": [
    {
      "from_state": "active",
      "to_state": "archived",
      "after_days": 365,
      "condition": "graduation_date + 1 year"
    },
    {
      "from_state": "archived",
      "to_state": "deleted",
      "after_days": 2555,
      "condition": "graduation_date + 7 years"
    }
  ],
  "exceptions": [
    "legal_hold_active",
    "pending_financial_obligations"
  ]
}
```

**Policy Enforcement Engine:**

```javascript
class RetentionPolicyEngine {
  async evaluatePolicies() {
    const policies = await db('retention_policies')
      .where({ status: 'active' });
    
    for (const policy of policies) {
      await this.applyPolicy(policy);
    }
  }
  
  async applyPolicy(policy) {
    for (const rule of policy.transition_rules) {
      // Find records eligible for transition
      const eligibleRecords = await this.findEligibleRecords(
        policy.data_type,
        rule.from_state,
        rule.after_days,
        rule.condition
      );
      
      for (const record of eligibleRecords) {
        // Check exceptions
        if (await this.hasExceptions(record, policy.exceptions)) {
          continue;
        }
        
        // Execute transition
        await this.transitionRecord(record, rule.to_state);
      }
    }
  }
}
```


#### 5.4.2 Automated State Transitions

**Lifecycle States:**
- **Active:** Currently in use, full access
- **Archived:** Read-only, moved to cold storage
- **Deleted:** Cryptographically erased, unrecoverable

**Transition Workflow:**

```javascript
async function archiveRecord(record) {
  // Step 1: Export to cold storage (S3 Glacier)
  const archiveLocation = await exportToGlacier({
    record_id: record.id,
    data: record,
    tenant_id: record.tenant_id
  });
  
  // Step 2: Update record status
  await db('students')
    .where({ student_id: record.id })
    .update({
      status: 'archived',
      archived_at: new Date(),
      archive_location: archiveLocation,
      data: null // Clear active data
    });
  
  // Step 3: Create audit entry
  await createAuditEntry({
    action: 'record_archived',
    entity_type: 'student',
    entity_id: record.id,
    archive_location: archiveLocation
  });
}
```

#### 5.4.3 Secure Deletion with Cryptographic Verification

**Deletion Verification:**

```javascript
async function verifySecureDeletion(recordId) {
  // Verify record is anonymized
  const record = await db('students')
    .where({ student_id: recordId })
    .first();
  
  if (record.status !== 'deleted') {
    return { verified: false, reason: 'Record not marked as deleted' };
  }
  
  // Verify sensitive fields are cleared
  const sensitiveFields = [
    'national_id_encrypted',
    'medical_history_encrypted',
    'phone',
    'address'
  ];
  
  for (const field of sensitiveFields) {
    if (record[field] !== null) {
      return {
        verified: false,
        reason: `Sensitive field '${field}' not cleared`
      };
    }
  }
  
  return { verified: true };
}
```


---

### 5.5 Configuration Governance & Approval System (Requirement 19)

#### 5.5.1 Configuration Lifecycle Management

**Configuration States:**
- **Draft:** Initial creation, editable
- **Review:** Submitted for review, read-only
- **Approved:** Approved by authorized users, ready to publish
- **Published:** Active in production
- **Archived:** Superseded by newer version

**Configuration Workflow:**

```javascript
class ConfigurationGovernance {
  async createDraft(configType, configData, createdBy) {
    const config = await db('configurations').insert({
      config_id: uuidv4(),
      config_type: configType,
      config_data: configData,
      version: 1,
      status: 'draft',
      created_by: createdBy,
      created_at: new Date()
    });
    
    return config;
  }
  
  async submitForReview(configId, submittedBy) {
    // Validate configuration
    const config = await db('configurations')
      .where({ config_id: configId })
      .first();
    
    if (config.status !== 'draft') {
      throw new Error('Only draft configurations can be submitted for review');
    }
    
    // Generate impact analysis
    const impact = await this.analyzeImpact(config);
    
    // Update status
    await db('configurations')
      .where({ config_id: configId })
      .update({
        status: 'review',
        submitted_for_review_at: new Date(),
        submitted_by: submittedBy,
        impact_analysis: impact
      });
    
    return { config_id: configId, impact: impact };
  }
}
```


#### 5.5.2 Impact Analysis Display

**Impact Summary Example:**

```json
{
  "config_id": "uuid-v4",
  "config_type": "schema_change",
  "impact_summary": {
    "affected_users": 1250,
    "affected_records": 5430,
    "breaking_changes": [
      "Removing 'legacy_id' field",
      "Changing 'date_of_birth' from string to date type"
    ],
    "warnings": [
      "500 records will require manual review",
      "Migration estimated to take 45 minutes"
    ],
    "estimated_downtime": "0 minutes (zero-downtime migration)"
  }
}
```

#### 5.5.3 Configuration Versioning and Rollback

**Rollback Implementation:**

```javascript
async function rollbackConfiguration(configId, rolledBackBy, reason) {
  const config = await db('configurations')
    .where({ config_id: configId })
    .first();
  
  if (config.status !== 'published') {
    throw new Error('Can only rollback published configurations');
  }
  
  // Find previous version
  const previousVersion = await db('configurations')
    .where({
      config_type: config.config_type,
      tenant_id: config.tenant_id,
      status: 'archived'
    })
    .orderBy('archived_at', 'desc')
    .first();
  
  if (!previousVersion) {
    throw new Error('No previous version available for rollback');
  }
  
  // Archive current configuration
  await db('configurations')
    .where({ config_id: configId })
    .update({
      status: 'archived',
      archived_at: new Date(),
      rollback_reason: reason
    });
  
  // Restore previous version
  await db('configurations')
    .where({ config_id: previousVersion.config_id })
    .update({
      status: 'published',
      published_at: new Date(),
      published_by: rolledBackBy
    });
  
  // Create audit entry
  await createAuditEntry({
    action: 'configuration_rolled_back',
    entity_id: configId,
    previous_version_id: previousVersion.config_id,
    reason: reason
  });
  
  return {
    rolled_back_config_id: configId,
    restored_config_id: previousVersion.config_id
  };
}
```


#### 5.5.4 Emergency Override Mechanism

**Emergency Change Workflow:**

```javascript
async function createEmergencyOverride(configData, requestedBy, justification) {
  // Verify requester has emergency override permission
  const requester = await getUserById(requestedBy);
  if (!requester.permissions.includes('emergency_override')) {
    throw new Error('User does not have emergency override permission');
  }
  
  // Require dual approval
  const secondApprover = await getRandomSuperAdmin(requestedBy);
  
  const override = await db('emergency_overrides').insert({
    override_id: uuidv4(),
    config_data: configData,
    requested_by: requestedBy,
    justification: justification,
    status: 'pending_approval',
    created_at: new Date(),
    requires_approval_from: secondApprover.user_id
  });
  
  // Notify second approver (urgent)
  await sendUrgentNotification({
    to: secondApprover.user_id,
    type: 'emergency_override_approval_required',
    data: {
      override_id: override.override_id,
      requester: requester.name,
      justification: justification
    }
  });
  
  return override;
}

async function approveEmergencyOverride(overrideId, approverId) {
  const override = await db('emergency_overrides')
    .where({ override_id: overrideId })
    .first();
  
  if (override.requested_by === approverId) {
    throw new Error('Cannot approve your own emergency override');
  }
  
  // Apply configuration immediately
  await applyConfiguration(override.config_data);
  
  // Update override status
  await db('emergency_overrides')
    .where({ override_id: overrideId })
    .update({
      status: 'approved',
      approved_by: approverId,
      approved_at: new Date(),
      applied_at: new Date()
    });
  
  // Schedule post-incident review (mandatory within 24 hours)
  await schedulePostIncidentReview({
    override_id: overrideId,
    review_deadline: new Date(Date.now() + 24 * 3600000)
  });
  
  return { override_id: overrideId, status: 'applied' };
}
```


---

### 5.6 Human-Readable Decision Explanations (Requirement 22)

#### 5.6.1 Explanation Generation Engine

**Purpose:** Generate plain-language explanations for automated system decisions.

**Explanation Template System:**

```javascript
class ExplanationEngine {
  constructor() {
    this.templates = {
      'attendance_marked_absent': {
        template: 'Student marked absent because {reason}. {additional_context}',
        variables: ['reason', 'additional_context']
      },
      'grade_calculated': {
        template: 'Final grade of {grade} calculated based on: {breakdown}. {policy_reference}',
        variables: ['grade', 'breakdown', 'policy_reference']
      },
      'payment_declined': {
        template: 'Payment declined due to {reason}. {resolution_steps}',
        variables: ['reason', 'resolution_steps']
      },
      'access_denied': {
        template: 'Access denied because {reason}. Required permission: {required_permission}',
        variables: ['reason', 'required_permission']
      }
    };
  }
  
  async generateExplanation(decisionType, context) {
    const template = this.templates[decisionType];
    
    if (!template) {
      throw new Error(`No template found for decision type: ${decisionType}`);
    }
    
    // Generate explanation text
    let explanation = template.template;
    
    for (const variable of template.variables) {
      const value = await this.resolveVariable(variable, context);
      explanation = explanation.replace(`{${variable}}`, value);
    }
    
    // Collect evidence
    const evidence = await this.collectEvidence(decisionType, context);
    
    // Store explanation
    const explanationRecord = await db('decision_explanations').insert({
      explanation_id: uuidv4(),
      decision_type: decisionType,
      entity_type: context.entity_type,
      entity_id: context.entity_id,
      explanation_text: explanation,
      evidence: evidence,
      generated_at: new Date()
    });
    
    return {
      explanation_id: explanationRecord.explanation_id,
      explanation: explanation,
      evidence: evidence
    };
  }
}
```


#### 5.6.2 Evidence-Based Explanations

**Example: Attendance Decision Explanation**

```javascript
async function explainAttendanceDecision(attendanceRecordId) {
  const record = await db('attendance_records')
    .where({ record_id: attendanceRecordId })
    .first();
  
  const explanationEngine = new ExplanationEngine();
  
  const context = {
    entity_type: 'attendance',
    entity_id: attendanceRecordId,
    reason: 'no check-in recorded within required timeframe',
    additional_context: `Session started at ${record.session_start_time}. Check-in deadline was ${record.checkin_deadline}.`,
    policy_id: record.policy_id,
    policy_name: 'Standard Attendance Policy',
    policy_version: '2.1'
  };
  
  const explanation = await explanationEngine.generateExplanation(
    'attendance_marked_absent',
    context
  );
  
  return explanation;
}
```

**Example Output:**

```json
{
  "explanation_id": "uuid-v4",
  "explanation": "Student marked absent because no check-in recorded within required timeframe. Session started at 09:00 AM. Check-in deadline was 09:15 AM.",
  "evidence": [
    {
      "type": "rule",
      "description": "Attendance policy requires check-in within 15 minutes",
      "reference": "policy-uuid"
    },
    {
      "type": "data_point",
      "description": "Last check-in: 2026-02-03T08:45:00Z",
      "timestamp": "2026-02-03T08:45:00Z"
    }
  ]
}
```


#### 5.6.3 PDF Export for Official Communication

**Export Implementation:**

```javascript
const PDFDocument = require('pdfkit');

async function exportExplanationToPDF(explanationId) {
  const explanation = await db('decision_explanations')
    .where({ explanation_id: explanationId })
    .first();
  
  // Create PDF document
  const doc = new PDFDocument();
  const filePath = `/exports/explanation_${explanationId}.pdf`;
  const stream = fs.createWriteStream(filePath);
  
  doc.pipe(stream);
  
  // Header
  doc.fontSize(20).text('Decision Explanation', { align: 'center' });
  doc.moveDown();
  
  // Explanation ID and timestamp
  doc.fontSize(10).text(`Explanation ID: ${explanation.explanation_id}`);
  doc.text(`Generated: ${explanation.generated_at.toISOString()}`);
  doc.moveDown();
  
  // Decision type
  doc.fontSize(14).text('Decision Type:', { underline: true });
  doc.fontSize(12).text(explanation.decision_type);
  doc.moveDown();
  
  // Explanation text
  doc.fontSize(14).text('Explanation:', { underline: true });
  doc.fontSize(12).text(explanation.explanation_text);
  doc.moveDown();
  
  // Evidence
  doc.fontSize(14).text('Supporting Evidence:', { underline: true });
  for (const evidence of explanation.evidence) {
    doc.fontSize(10).text(`• ${evidence.description}`, { indent: 20 });
  }
  doc.moveDown();
  
  // Digital signature
  doc.fontSize(8).text('This document is digitally signed and tamper-evident.');
  doc.text(`Signature: ${await generateDocumentSignature(explanation)}`);
  
  // Finalize PDF
  doc.end();
  
  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      resolve({
        explanation_id: explanationId,
        file_path: filePath,
        download_url: `/api/v1/explanations/${explanationId}/download`
      });
    });
    
    stream.on('error', reject);
  });
}

async function generateDocumentSignature(explanation) {
  const dataToSign = JSON.stringify({
    explanation_id: explanation.explanation_id,
    explanation_text: explanation.explanation_text,
    generated_at: explanation.generated_at
  });
  
  return crypto
    .createHash('sha256')
    .update(dataToSign)
    .digest('hex');
}
```

---


## 6. Module E: Integration, Interfaces & User Experience

### 6.1 API and Integration Framework (Requirements 10, 32)

#### 6.1.1 OpenAPI 3.0 Documentation

**Purpose:** Provide comprehensive, machine-readable API documentation for all endpoints.

**OpenAPI Specification Structure:**

```yaml
openapi: 3.0.3
info:
  title: EduOS Platform API
  version: 2.1.0
  description: |
    Production-grade educational management system API with multi-tenant support.
    
    **Base URL:** https://api.eduos.com/v2
    
    **Authentication:** OAuth 2.0 Bearer Token
    
    **Rate Limiting:** 1000 requests/hour per tenant
  contact:
    name: EduOS API Support
    email: api-support@eduos.com
  license:
    name: Proprietary
    url: https://eduos.com/license

servers:
  - url: https://api.eduos.com/v2
    description: Production
  - url: https://api-staging.eduos.com/v2
    description: Staging

security:
  - OAuth2: []

paths:
  /students:
    get:
      summary: List students
      description: Retrieve a paginated list of students with optional filtering
      operationId: listStudents
      tags:
        - Students
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
            maximum: 100
        - name: status
          in: query
          schema:
            type: string
            enum: [active, suspended, archived]
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/StudentList'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '429':
          $ref: '#/components/responses/RateLimitExceeded'

components:
  securitySchemes:
    OAuth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://auth.eduos.com/oauth/authorize
          tokenUrl: https://auth.eduos.com/oauth/token
          scopes:
            read:students: Read student data
            write:students: Create and update students
            read:grades: Read grade records
            write:grades: Create and update grades

  schemas:
    Student:
      type: object
      required:
        - student_id
        - first_name
        - last_name
        - date_of_birth
      properties:
        student_id:
          type: string
          format: uuid
          description: Globally unique student identifier
        first_name:
          type: string
          maxLength: 100
        last_name:
          type: string
          maxLength: 100
        date_of_birth:
          type: string
          format: date
        status:
          type: string
          enum: [active, suspended, archived]
        created_at:
          type: string
          format: date-time
          readOnly: true
```


#### 6.1.2 API Versioning Strategy

**Header-Based Versioning:**

EduOS uses the `Accept-Version` header for API versioning to maintain clean URLs.

**Implementation:**

```javascript
// API versioning middleware
app.use((req, res, next) => {
  const requestedVersion = req.headers['accept-version'] || '2.1';
  const supportedVersions = ['1.0', '2.0', '2.1'];
  
  if (!supportedVersions.includes(requestedVersion)) {
    return res.status(400).json({
      error: 'Unsupported API Version',
      message: `Version ${requestedVersion} is not supported`,
      supported_versions: supportedVersions,
      deprecation_notice: 'Version 1.0 will be deprecated on 2027-02-04'
    });
  }
  
  req.apiVersion = requestedVersion;
  next();
});

// Version-specific route handling
app.get('/students/:studentId', async (req, res) => {
  const student = await getStudent(req.params.studentId);
  
  // Transform response based on API version
  if (req.apiVersion === '1.0') {
    // Legacy format
    res.json(transformToV1Format(student));
  } else if (req.apiVersion === '2.0' || req.apiVersion === '2.1') {
    // Current format
    res.json(student);
  }
});
```

**Deprecation Policy:**

- **Minimum Support Period:** 24 months after new version release
- **Deprecation Notice:** 6 months before end-of-life
- **Sunset Header:** Deprecated versions include `Sunset` header with EOL date

```javascript
// Deprecation warning middleware
app.use((req, res, next) => {
  if (req.apiVersion === '1.0') {
    res.set('Sunset', 'Sat, 04 Feb 2027 00:00:00 GMT');
    res.set('Deprecation', 'true');
    res.set('Link', '<https://docs.eduos.com/migration/v1-to-v2>; rel="deprecation"');
  }
  next();
});
```


#### 6.1.3 OAuth 2.0 Authentication and Request Signing

**OAuth 2.0 Flow:**

```javascript
// OAuth 2.0 Authorization Code Flow
app.get('/oauth/authorize', async (req, res) => {
  const {
    client_id,
    redirect_uri,
    response_type,
    scope,
    state
  } = req.query;
  
  // Validate client
  const client = await db('oauth_clients')
    .where({ client_id: client_id })
    .first();
  
  if (!client) {
    return res.status(400).json({ error: 'invalid_client' });
  }
  
  // Validate redirect URI
  if (!client.redirect_uris.includes(redirect_uri)) {
    return res.status(400).json({ error: 'invalid_redirect_uri' });
  }
  
  // Generate authorization code
  const authCode = crypto.randomBytes(32).toString('hex');
  
  await redis.setex(`auth_code:${authCode}`, 600, JSON.stringify({
    client_id: client_id,
    redirect_uri: redirect_uri,
    scope: scope,
    user_id: req.user.id
  }));
  
  // Redirect with authorization code
  res.redirect(`${redirect_uri}?code=${authCode}&state=${state}`);
});

app.post('/oauth/token', async (req, res) => {
  const {
    grant_type,
    code,
    redirect_uri,
    client_id,
    client_secret
  } = req.body;
  
  // Validate client credentials
  const client = await db('oauth_clients')
    .where({ client_id: client_id, client_secret: client_secret })
    .first();
  
  if (!client) {
    return res.status(401).json({ error: 'invalid_client' });
  }
  
  // Validate authorization code
  const authData = await redis.get(`auth_code:${code}`);
  if (!authData) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  
  const auth = JSON.parse(authData);
  
  // Generate access token
  const accessToken = jwt.sign({
    user_id: auth.user_id,
    client_id: client_id,
    scope: auth.scope
  }, process.env.JWT_SECRET, { expiresIn: '1h' });
  
  // Generate refresh token
  const refreshToken = crypto.randomBytes(32).toString('hex');
  
  await redis.setex(`refresh_token:${refreshToken}`, 2592000, JSON.stringify({
    user_id: auth.user_id,
    client_id: client_id,
    scope: auth.scope
  }));
  
  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: refreshToken,
    scope: auth.scope
  });
});
```

**Request Signing (HMAC-SHA256):**

```javascript
// Request signing for sensitive operations
function signRequest(method, path, body, timestamp, secret) {
  const payload = `${method}\n${path}\n${timestamp}\n${JSON.stringify(body)}`;
  
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

// Signature verification middleware
app.use((req, res, next) => {
  const signature = req.headers['x-eduos-signature'];
  const timestamp = req.headers['x-eduos-timestamp'];
  
  if (!signature || !timestamp) {
    return res.status(401).json({ error: 'Missing signature headers' });
  }
  
  // Check timestamp freshness (5 minute window)
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  
  if (Math.abs(now - requestTime) > 300000) {
    return res.status(401).json({ error: 'Request timestamp expired' });
  }
  
  // Verify signature
  const expectedSignature = signRequest(
    req.method,
    req.path,
    req.body,
    timestamp,
    req.client.api_secret
  );
  
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
});
```


#### 6.1.4 Webhook System with Retry Logic

**Webhook Configuration:**

```json
{
  "webhook_id": "uuid-v4",
  "tenant_id": "uuid-v4",
  "event_types": [
    "student.created",
    "student.updated",
    "grade.finalized",
    "payment.completed"
  ],
  "url": "https://external-system.com/webhooks/eduos",
  "secret": "webhook-signing-secret",
  "status": "active",
  "retry_policy": {
    "max_attempts": 5,
    "backoff_strategy": "exponential",
    "initial_delay_seconds": 60
  }
}
```

**Webhook Delivery Implementation:**

```javascript
class WebhookDeliveryService {
  async deliverWebhook(event) {
    const webhooks = await db('webhooks')
      .where({ tenant_id: event.tenant_id, status: 'active' })
      .whereRaw("? = ANY(event_types)", [event.event_type]);
    
    for (const webhook of webhooks) {
      await this.sendWebhook(webhook, event);
    }
  }
  
  async sendWebhook(webhook, event, attempt = 1) {
    const payload = {
      webhook_id: webhook.webhook_id,
      event_id: event.event_id,
      event_type: event.event_type,
      timestamp: new Date().toISOString(),
      data: event.data
    };
    
    // Sign payload
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    try {
      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-EduOS-Signature': signature,
          'X-EduOS-Event-Type': event.event_type,
          'X-EduOS-Delivery-Attempt': attempt
        },
        timeout: 30000
      });
      
      // Log successful delivery
      await db('webhook_deliveries').insert({
        delivery_id: uuidv4(),
        webhook_id: webhook.webhook_id,
        event_id: event.event_id,
        attempt: attempt,
        status: 'success',
        response_code: response.status,
        delivered_at: new Date()
      });
      
    } catch (error) {
      // Log failed delivery
      await db('webhook_deliveries').insert({
        delivery_id: uuidv4(),
        webhook_id: webhook.webhook_id,
        event_id: event.event_id,
        attempt: attempt,
        status: 'failed',
        error_message: error.message,
        response_code: error.response?.status,
        failed_at: new Date()
      });
      
      // Retry with exponential backoff
      if (attempt < webhook.retry_policy.max_attempts) {
        const delay = webhook.retry_policy.initial_delay_seconds * Math.pow(2, attempt - 1);
        
        await queue.add('webhook-retry', {
          webhook: webhook,
          event: event,
          attempt: attempt + 1
        }, {
          delay: delay * 1000
        });
      } else {
        // Max retries exceeded, notify admin
        await notifyWebhookFailure(webhook, event);
      }
    }
  }
}
```


#### 6.1.5 LTI 1.3 Integration (Learning Tools Interoperability)

**LTI 1.3 Launch Flow:**

LTI 1.3 uses OpenID Connect (OIDC) for secure tool launches from Learning Management Systems.

**Step 1: OIDC Login Initiation**

```javascript
// LTI 1.3 Login endpoint
app.post('/lti/login', async (req, res) => {
  const {
    iss,
    login_hint,
    target_link_uri,
    lti_message_hint,
    client_id
  } = req.body;
  
  // Validate issuer (LMS platform)
  const platform = await db('lti_platforms')
    .where({ issuer: iss, client_id: client_id })
    .first();
  
  if (!platform) {
    return res.status(400).json({ error: 'Unknown platform' });
  }
  
  // Generate state and nonce
  const state = crypto.randomBytes(16).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');
  
  // Store state for validation
  await redis.setex(`lti_state:${state}`, 600, JSON.stringify({
    nonce: nonce,
    target_link_uri: target_link_uri
  }));
  
  // Redirect to platform's authorization endpoint
  const authUrl = new URL(platform.auth_endpoint);
  authUrl.searchParams.set('response_type', 'id_token');
  authUrl.searchParams.set('scope', 'openid');
  authUrl.searchParams.set('client_id', client_id);
  authUrl.searchParams.set('redirect_uri', 'https://eduos.com/lti/launch');
  authUrl.searchParams.set('login_hint', login_hint);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', nonce);
  authUrl.searchParams.set('prompt', 'none');
  authUrl.searchParams.set('lti_message_hint', lti_message_hint);
  
  res.redirect(authUrl.toString());
});
```

**Step 2: LTI Launch (ID Token Validation)**

```javascript
app.post('/lti/launch', async (req, res) => {
  const { id_token, state } = req.body;
  
  // Validate state
  const stateData = await redis.get(`lti_state:${state}`);
  if (!stateData) {
    return res.status(400).json({ error: 'Invalid state' });
  }
  
  const { nonce, target_link_uri } = JSON.parse(stateData);
  
  // Decode and validate ID token
  const decoded = jwt.decode(id_token, { complete: true });
  
  // Fetch platform's public key
  const platform = await db('lti_platforms')
    .where({ issuer: decoded.payload.iss })
    .first();
  
  const publicKey = await fetchJWKS(platform.jwks_uri, decoded.header.kid);
  
  // Verify token signature
  const verified = jwt.verify(id_token, publicKey, {
    algorithms: ['RS256'],
    audience: platform.client_id,
    issuer: platform.issuer
  });
  
  // Validate nonce
  if (verified.nonce !== nonce) {
    return res.status(400).json({ error: 'Invalid nonce' });
  }
  
  // Validate LTI claims
  if (verified['https://purl.imsglobal.org/spec/lti/claim/message_type'] !== 'LtiResourceLinkRequest') {
    return res.status(400).json({ error: 'Invalid message type' });
  }
  
  // Extract user and context information
  const ltiContext = {
    user_id: verified.sub,
    user_name: verified.name,
    user_email: verified.email,
    roles: verified['https://purl.imsglobal.org/spec/lti/claim/roles'],
    context_id: verified['https://purl.imsglobal.org/spec/lti/claim/context'].id,
    context_title: verified['https://purl.imsglobal.org/spec/lti/claim/context'].title,
    resource_link_id: verified['https://purl.imsglobal.org/spec/lti/claim/resource_link'].id
  };
  
  // Create or update user session
  const session = await createLTISession(ltiContext);
  
  // Redirect to target resource
  res.redirect(`${target_link_uri}?session=${session.session_id}`);
});
```


**Step 3: LTI Deep Linking**

```javascript
// Deep linking request handler
app.post('/lti/deep-link', async (req, res) => {
  const { id_token } = req.body;
  
  // Validate token (similar to launch)
  const verified = jwt.verify(id_token, publicKey);
  
  // Validate deep linking claim
  const deepLinkClaim = verified['https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings'];
  
  if (!deepLinkClaim) {
    return res.status(400).json({ error: 'Not a deep linking request' });
  }
  
  // Display content selection UI
  res.render('deep-link-selector', {
    return_url: deepLinkClaim.deep_link_return_url,
    accept_types: deepLinkClaim.accept_types,
    accept_presentation_document_targets: deepLinkClaim.accept_presentation_document_targets
  });
});

// Deep linking response
app.post('/lti/deep-link/response', async (req, res) => {
  const { selected_resources, return_url, platform_id } = req.body;
  
  const platform = await db('lti_platforms')
    .where({ platform_id: platform_id })
    .first();
  
  // Create deep linking response JWT
  const responseToken = jwt.sign({
    iss: 'https://eduos.com',
    aud: platform.client_id,
    exp: Math.floor(Date.now() / 1000) + 600,
    iat: Math.floor(Date.now() / 1000),
    nonce: crypto.randomBytes(16).toString('hex'),
    'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiDeepLinkingResponse',
    'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
    'https://purl.imsglobal.org/spec/lti-dl/claim/content_items': selected_resources.map(r => ({
      type: 'ltiResourceLink',
      title: r.title,
      url: r.url,
      custom: r.custom_parameters
    }))
  }, platform.private_key, { algorithm: 'RS256' });
  
  // Return to platform
  res.render('deep-link-return', {
    return_url: return_url,
    jwt: responseToken
  });
});
```

**Step 4: LTI Grade Passback (Assignment and Grade Service)**

```javascript
// Grade passback endpoint
app.post('/lti/grades/:lineItemId', async (req, res) => {
  const { lineItemId } = req.params;
  const { userId, scoreGiven, scoreMaximum, comment } = req.body;
  
  // Validate OAuth 2.0 token with LTI AGS scope
  const token = req.headers.authorization?.replace('Bearer ', '');
  const verified = jwt.verify(token, publicKey);
  
  if (!verified.scope.includes('https://purl.imsglobal.org/spec/lti-ags/scope/score')) {
    return res.status(403).json({ error: 'Insufficient scope' });
  }
  
  // Store grade in EduOS
  await db('grades').insert({
    grade_id: uuidv4(),
    student_id: userId,
    line_item_id: lineItemId,
    score_given: scoreGiven,
    score_maximum: scoreMaximum,
    comment: comment,
    graded_at: new Date(),
    source: 'lti_passback'
  });
  
  res.status(200).json({ success: true });
});
```


#### 6.1.6 OneRoster v1.1 Export

**OneRoster CSV Export:**

```javascript
async function generateOneRosterExport(tenantId, format = 'csv') {
  const exportId = uuidv4();
  
  // Fetch data
  const orgs = await db('institutions').where({ tenant_id: tenantId });
  const users = await db('users').where({ tenant_id: tenantId });
  const courses = await db('courses').where({ tenant_id: tenantId });
  const classes = await db('classes').where({ tenant_id: tenantId });
  const enrollments = await db('enrollments').where({ tenant_id: tenantId });
  
  if (format === 'csv') {
    // Generate CSV files
    const files = {
      'orgs.csv': generateOrgsCSV(orgs),
      'users.csv': generateUsersCSV(users),
      'courses.csv': generateCoursesCSV(courses),
      'classes.csv': generateClassesCSV(classes),
      'enrollments.csv': generateEnrollmentsCSV(enrollments),
      'manifest.csv': generateManifest()
    };
    
    // Create ZIP archive
    const archive = archiver('zip');
    const outputPath = `/exports/oneroster_${exportId}.zip`;
    const output = fs.createWriteStream(outputPath);
    
    archive.pipe(output);
    
    for (const [filename, content] of Object.entries(files)) {
      archive.append(content, { name: filename });
    }
    
    await archive.finalize();
    
    return {
      export_id: exportId,
      format: 'csv',
      file_path: outputPath,
      download_url: `/api/v1/oneroster/exports/${exportId}/download`
    };
  }
  
  if (format === 'json') {
    // Generate JSON export
    const jsonExport = {
      orgs: orgs.map(transformToOneRosterOrg),
      users: users.map(transformToOneRosterUser),
      courses: courses.map(transformToOneRosterCourse),
      classes: classes.map(transformToOneRosterClass),
      enrollments: enrollments.map(transformToOneRosterEnrollment)
    };
    
    const outputPath = `/exports/oneroster_${exportId}.json`;
    await fs.writeFile(outputPath, JSON.stringify(jsonExport, null, 2));
    
    return {
      export_id: exportId,
      format: 'json',
      file_path: outputPath,
      download_url: `/api/v1/oneroster/exports/${exportId}/download`
    };
  }
}

function generateUsersCSV(users) {
  const csv = new ObjectsToCsv(users.map(u => ({
    sourcedId: u.user_id,
    status: u.status === 'active' ? 'active' : 'tobedeleted',
    dateLastModified: u.updated_at.toISOString(),
    enabledUser: u.status === 'active' ? 'true' : 'false',
    orgSourcedIds: u.institution_id,
    role: mapRoleToOneRoster(u.role),
    username: u.username,
    userIds: u.external_id || '',
    givenName: u.first_name,
    familyName: u.last_name,
    middleName: u.middle_name || '',
    identifier: u.national_id || '',
    email: u.email,
    sms: u.phone || '',
    phone: u.phone || '',
    agentSourcedIds: u.guardian_ids?.join(',') || '',
    grades: u.grade_level || ''
  })));
  
  return csv.toString();
}

function mapRoleToOneRoster(role) {
  const roleMap = {
    'student': 'student',
    'teacher': 'teacher',
    'admin': 'administrator',
    'guardian': 'parent',
    'counselor': 'aide'
  };
  
  return roleMap[role] || 'student';
}
```


---

### 6.2 Assessment and Examination System (Requirement 7)

#### 6.2.1 Secure Exam Environment with Browser Lockdown

**Browser Lockdown Integration:**

EduOS integrates with browser lockdown solutions (e.g., Respondus LockDown Browser, Safe Exam Browser) to prevent cheating.

**Exam Configuration:**

```json
{
  "exam_id": "uuid-v4",
  "title": "Midterm Examination - Mathematics",
  "course_id": "course-uuid",
  "lockdown_settings": {
    "enabled": true,
    "allowed_browsers": ["lockdown_browser", "safe_exam_browser"],
    "disable_copy_paste": true,
    "disable_printing": true,
    "disable_right_click": true,
    "block_external_urls": true,
    "require_webcam": true,
    "require_screen_recording": false
  },
  "time_limit_minutes": 120,
  "start_time": "2026-02-10T09:00:00Z",
  "end_time": "2026-02-10T11:00:00Z",
  "late_submission_penalty": 10,
  "max_attempts": 1
}
```

**Lockdown Verification:**

```javascript
// Exam access middleware
app.get('/exams/:examId/start', async (req, res) => {
  const exam = await db('exams')
    .where({ exam_id: req.params.examId })
    .first();
  
  if (!exam) {
    return res.status(404).json({ error: 'Exam not found' });
  }
  
  // Check if lockdown is required
  if (exam.lockdown_settings.enabled) {
    const userAgent = req.headers['user-agent'];
    const isLockdownBrowser = checkLockdownBrowser(userAgent);
    
    if (!isLockdownBrowser) {
      return res.status(403).json({
        error: 'Lockdown browser required',
        message: 'This exam requires a secure browser. Please use Respondus LockDown Browser or Safe Exam Browser.',
        download_links: {
          windows: 'https://eduos.com/downloads/lockdown-browser-windows',
          mac: 'https://eduos.com/downloads/lockdown-browser-mac'
        }
      });
    }
  }
  
  // Check time window
  const now = new Date();
  if (now < new Date(exam.start_time)) {
    return res.status(403).json({
      error: 'Exam not started',
      start_time: exam.start_time
    });
  }
  
  if (now > new Date(exam.end_time)) {
    return res.status(403).json({
      error: 'Exam ended',
      end_time: exam.end_time
    });
  }
  
  // Check attempts
  const attempts = await db('exam_attempts')
    .where({
      exam_id: exam.exam_id,
      student_id: req.user.id
    })
    .count();
  
  if (attempts[0].count >= exam.max_attempts) {
    return res.status(403).json({
      error: 'Maximum attempts exceeded',
      max_attempts: exam.max_attempts
    });
  }
  
  // Create exam session
  const session = await db('exam_sessions').insert({
    session_id: uuidv4(),
    exam_id: exam.exam_id,
    student_id: req.user.id,
    started_at: new Date(),
    expires_at: new Date(Date.now() + exam.time_limit_minutes * 60000),
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
    status: 'in_progress'
  });
  
  res.json({
    session_id: session.session_id,
    time_limit_minutes: exam.time_limit_minutes,
    expires_at: session.expires_at
  });
});

function checkLockdownBrowser(userAgent) {
  const lockdownPatterns = [
    /Respondus LockDown Browser/i,
    /Safe Exam Browser/i,
    /EduOS Secure Browser/i
  ];
  
  return lockdownPatterns.some(pattern => pattern.test(userAgent));
}
```


#### 6.2.2 Immutable Grade Recording with Cryptographic Signing

**Grade Finalization Workflow:**

```javascript
async function finalizeGrade(gradeId, finalizedBy) {
  const grade = await db('grades')
    .where({ grade_id: gradeId })
    .first();
  
  if (grade.status === 'finalized') {
    throw new Error('Grade is already finalized');
  }
  
  // Create canonical grade record
  const canonicalGrade = {
    grade_id: grade.grade_id,
    student_id: grade.student_id,
    course_id: grade.course_id,
    assessment_id: grade.assessment_id,
    score: grade.score,
    max_score: grade.max_score,
    percentage: (grade.score / grade.max_score) * 100,
    letter_grade: calculateLetterGrade(grade.score, grade.max_score),
    graded_by: grade.graded_by,
    graded_at: grade.graded_at,
    finalized_by: finalizedBy,
    finalized_at: new Date()
  };
  
  // Compute cryptographic signature
  const gradeString = JSON.stringify(canonicalGrade, Object.keys(canonicalGrade).sort());
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(gradeString)
    .sign(await getInstitutionPrivateKey(grade.tenant_id), 'hex');
  
  // Store finalized grade
  await db('grades')
    .where({ grade_id: gradeId })
    .update({
      status: 'finalized',
      finalized_by: finalizedBy,
      finalized_at: canonicalGrade.finalized_at,
      grade_signature: signature,
      canonical_data: canonicalGrade
    });
  
  // Create audit entry
  await createAuditEntry({
    action: 'grade_finalized',
    entity_type: 'grade',
    entity_id: gradeId,
    finalized_by: finalizedBy,
    signature: signature
  });
  
  return {
    grade_id: gradeId,
    status: 'finalized',
    signature: signature,
    verification_url: `https://eduos.com/verify/grade/${gradeId}`
  };
}

// Grade verification endpoint
app.get('/verify/grade/:gradeId', async (req, res) => {
  const grade = await db('grades')
    .where({ grade_id: req.params.gradeId })
    .first();
  
  if (!grade || grade.status !== 'finalized') {
    return res.status(404).json({ error: 'Grade not found or not finalized' });
  }
  
  // Verify signature
  const gradeString = JSON.stringify(grade.canonical_data, Object.keys(grade.canonical_data).sort());
  const publicKey = await getInstitutionPublicKey(grade.tenant_id);
  
  const isValid = crypto
    .createVerify('RSA-SHA256')
    .update(gradeString)
    .verify(publicKey, grade.grade_signature, 'hex');
  
  res.json({
    grade_id: grade.grade_id,
    student_id: grade.student_id,
    score: grade.canonical_data.score,
    max_score: grade.canonical_data.max_score,
    letter_grade: grade.canonical_data.letter_grade,
    finalized_at: grade.canonical_data.finalized_at,
    signature_valid: isValid,
    tampered: !isValid
  });
});
```


#### 6.2.3 Grade Appeals Workflow

**Appeal Submission:**

```javascript
async function submitGradeAppeal(gradeId, studentId, reason, evidence) {
  const grade = await db('grades')
    .where({ grade_id: gradeId, student_id: studentId })
    .first();
  
  if (!grade) {
    throw new Error('Grade not found');
  }
  
  if (grade.status !== 'finalized') {
    throw new Error('Can only appeal finalized grades');
  }
  
  // Create appeal
  const appeal = await db('grade_appeals').insert({
    appeal_id: uuidv4(),
    grade_id: gradeId,
    student_id: studentId,
    original_score: grade.score,
    reason: reason,
    evidence: evidence,
    status: 'pending',
    submitted_at: new Date()
  });
  
  // Notify instructor
  await sendNotification({
    to: grade.graded_by,
    type: 'grade_appeal_submitted',
    data: {
      appeal_id: appeal.appeal_id,
      student_name: await getStudentName(studentId),
      course: await getCourseName(grade.course_id)
    }
  });
  
  return appeal;
}

async function resolveGradeAppeal(appealId, resolvedBy, decision, newScore = null) {
  const appeal = await db('grade_appeals')
    .where({ appeal_id: appealId })
    .first();
  
  if (appeal.status !== 'pending') {
    throw new Error('Appeal already resolved');
  }
  
  const grade = await db('grades')
    .where({ grade_id: appeal.grade_id })
    .first();
  
  if (decision === 'approved' && newScore !== null) {
    // Create new version of grade record
    const newGradeVersion = {
      grade_id: uuidv4(),
      student_id: grade.student_id,
      course_id: grade.course_id,
      assessment_id: grade.assessment_id,
      score: newScore,
      max_score: grade.max_score,
      percentage: (newScore / grade.max_score) * 100,
      letter_grade: calculateLetterGrade(newScore, grade.max_score),
      graded_by: resolvedBy,
      graded_at: new Date(),
      version: (grade.version || 1) + 1,
      previous_grade_id: grade.grade_id,
      appeal_id: appealId
    };
    
    // Sign new grade version
    const gradeString = JSON.stringify(newGradeVersion, Object.keys(newGradeVersion).sort());
    const signature = crypto
      .createSign('RSA-SHA256')
      .update(gradeString)
      .sign(await getInstitutionPrivateKey(grade.tenant_id), 'hex');
    
    newGradeVersion.grade_signature = signature;
    newGradeVersion.status = 'finalized';
    newGradeVersion.canonical_data = newGradeVersion;
    
    // Insert new grade version
    await db('grades').insert(newGradeVersion);
    
    // Mark original grade as superseded
    await db('grades')
      .where({ grade_id: grade.grade_id })
      .update({
        status: 'superseded',
        superseded_by: newGradeVersion.grade_id,
        superseded_at: new Date()
      });
  }
  
  // Update appeal status
  await db('grade_appeals')
    .where({ appeal_id: appealId })
    .update({
      status: decision,
      resolved_by: resolvedBy,
      resolved_at: new Date(),
      new_score: newScore,
      resolution_notes: `Appeal ${decision}. ${newScore ? `New score: ${newScore}` : 'Original score maintained.'}`
    });
  
  // Notify student
  await sendNotification({
    to: appeal.student_id,
    type: 'grade_appeal_resolved',
    data: {
      appeal_id: appealId,
      decision: decision,
      new_score: newScore
    }
  });
  
  return {
    appeal_id: appealId,
    decision: decision,
    new_score: newScore
  };
}
```


#### 6.2.4 Versioned Question Banks

**Question Bank Management:**

```javascript
// Create question bank
async function createQuestionBank(tenantId, name, subject, createdBy) {
  const bank = await db('question_banks').insert({
    bank_id: uuidv4(),
    tenant_id: tenantId,
    name: name,
    subject: subject,
    version: 1,
    status: 'draft',
    created_by: createdBy,
    created_at: new Date()
  });
  
  return bank;
}

// Add question to bank
async function addQuestion(bankId, questionData) {
  const question = await db('questions').insert({
    question_id: uuidv4(),
    bank_id: bankId,
    question_type: questionData.type, // 'multiple_choice', 'essay', 'true_false', 'short_answer'
    question_text: questionData.text,
    options: questionData.options, // For multiple choice
    correct_answer: questionData.correct_answer,
    points: questionData.points,
    difficulty: questionData.difficulty, // 'easy', 'medium', 'hard'
    tags: questionData.tags,
    version: 1,
    created_at: new Date()
  });
  
  return question;
}

// Publish question bank version
async function publishQuestionBank(bankId, publishedBy) {
  const bank = await db('question_banks')
    .where({ bank_id: bankId })
    .first();
  
  if (bank.status === 'published') {
    // Create new version
    const newVersion = bank.version + 1;
    
    await db('question_banks')
      .where({ bank_id: bankId })
      .update({
        version: newVersion,
        status: 'published',
        published_by: publishedBy,
        published_at: new Date()
      });
  } else {
    await db('question_banks')
      .where({ bank_id: bankId })
      .update({
        status: 'published',
        published_by: publishedBy,
        published_at: new Date()
      });
  }
  
  return { bank_id: bankId, version: bank.version };
}

// Question usage analytics
async function getQuestionAnalytics(questionId) {
  const usage = await db('exam_questions')
    .where({ question_id: questionId })
    .count('* as times_used');
  
  const responses = await db('exam_responses')
    .where({ question_id: questionId });
  
  const correctCount = responses.filter(r => r.is_correct).length;
  const totalResponses = responses.length;
  
  return {
    question_id: questionId,
    times_used: usage[0].times_used,
    total_responses: totalResponses,
    correct_responses: correctCount,
    difficulty_score: totalResponses > 0 ? (correctCount / totalResponses) : null,
    avg_time_seconds: responses.reduce((sum, r) => sum + r.time_spent_seconds, 0) / totalResponses
  };
}
```


---

### 6.3 Communication and Engagement Platform (Requirements 8, 33)

#### 6.3.1 Intelligent Notification Routing with Fallback Logic

**Multi-Channel Notification System:**

```javascript
class NotificationRouter {
  constructor() {
    this.channels = {
      'push': { priority: 1, provider: 'firebase' },
      'sms': { priority: 2, provider: 'twilio' },
      'email': { priority: 3, provider: 'sendgrid' },
      'in_app': { priority: 4, provider: 'internal' }
    };
  }
  
  async sendNotification(notification) {
    const {
      recipient_id,
      type,
      priority,
      message,
      data
    } = notification;
    
    // Get user preferences
    const user = await db('users')
      .where({ user_id: recipient_id })
      .first();
    
    const preferences = user.notification_preferences || {
      push: true,
      sms: true,
      email: true,
      in_app: true,
      do_not_disturb: {
        enabled: false,
        start_hour: 22,
        end_hour: 8
      }
    };
    
    // Check Do Not Disturb (unless critical)
    if (priority !== 'critical' && this.isDoNotDisturbActive(preferences.do_not_disturb)) {
      // Queue for later delivery
      await this.queueForLater(notification);
      return { status: 'queued', reason: 'do_not_disturb' };
    }
    
    // Check opt-out status
    if (await this.isOptedOut(recipient_id, type)) {
      return { status: 'skipped', reason: 'opted_out' };
    }
    
    // Determine channel order based on priority
    let channelOrder = ['push', 'sms', 'email', 'in_app'];
    
    if (priority === 'critical') {
      // Critical alerts override user preferences
      channelOrder = ['push', 'sms', 'email'];
    } else {
      // Filter by user preferences
      channelOrder = channelOrder.filter(ch => preferences[ch]);
    }
    
    // Attempt delivery with fallback
    return await this.deliverWithFallback(notification, channelOrder);
  }
  
  async deliverWithFallback(notification, channelOrder, attempt = 1) {
    const deliveryLog = {
      notification_id: uuidv4(),
      recipient_id: notification.recipient_id,
      type: notification.type,
      attempts: []
    };
    
    for (const channel of channelOrder) {
      try {
        const result = await this.deliverViaChannel(notification, channel);
        
        deliveryLog.attempts.push({
          channel: channel,
          attempt: attempt,
          status: 'success',
          delivered_at: new Date(),
          provider_response: result
        });
        
        // Success - stop trying other channels
        await this.logDelivery(deliveryLog);
        return { status: 'delivered', channel: channel };
        
      } catch (error) {
        deliveryLog.attempts.push({
          channel: channel,
          attempt: attempt,
          status: 'failed',
          error: error.message,
          failed_at: new Date()
        });
        
        // Continue to next channel
        continue;
      }
    }
    
    // All channels failed
    deliveryLog.final_status = 'failed';
    await this.logDelivery(deliveryLog);
    
    // Retry with exponential backoff
    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 60000; // 2min, 4min, 8min
      
      await queue.add('notification-retry', {
        notification: notification,
        channelOrder: channelOrder,
        attempt: attempt + 1
      }, { delay: delay });
      
      return { status: 'retry_scheduled', attempt: attempt + 1 };
    }
    
    return { status: 'failed', attempts: deliveryLog.attempts };
  }
  
  async deliverViaChannel(notification, channel) {
    switch (channel) {
      case 'push':
        return await this.sendPushNotification(notification);
      case 'sms':
        return await this.sendSMS(notification);
      case 'email':
        return await this.sendEmail(notification);
      case 'in_app':
        return await this.createInAppNotification(notification);
      default:
        throw new Error(`Unknown channel: ${channel}`);
    }
  }
  
  isDoNotDisturbActive(dndSettings) {
    if (!dndSettings.enabled) return false;
    
    const now = new Date();
    const currentHour = now.getHours();
    
    if (dndSettings.start_hour < dndSettings.end_hour) {
      return currentHour >= dndSettings.start_hour && currentHour < dndSettings.end_hour;
    } else {
      // Overnight DND (e.g., 22:00 - 08:00)
      return currentHour >= dndSettings.start_hour || currentHour < dndSettings.end_hour;
    }
  }
}
```


#### 6.3.2 Template Engine with Variable Sanitization

**Template Management:**

```javascript
class NotificationTemplateEngine {
  async createTemplate(templateData) {
    const template = await db('notification_templates').insert({
      template_id: uuidv4(),
      name: templateData.name,
      type: templateData.type,
      subject: templateData.subject,
      body: templateData.body,
      variables: templateData.variables, // ['student_name', 'course_name', 'due_date']
      version: 1,
      status: 'draft',
      created_at: new Date()
    });
    
    return template;
  }
  
  async renderTemplate(templateId, variables) {
    const template = await db('notification_templates')
      .where({ template_id: templateId, status: 'published' })
      .first();
    
    if (!template) {
      throw new Error('Template not found or not published');
    }
    
    // Sanitize variables
    const sanitizedVars = {};
    for (const [key, value] of Object.entries(variables)) {
      if (template.variables.includes(key)) {
        sanitizedVars[key] = this.sanitizeVariable(value);
      }
    }
    
    // Render subject
    let subject = template.subject;
    for (const [key, value] of Object.entries(sanitizedVars)) {
      subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    
    // Render body
    let body = template.body;
    for (const [key, value] of Object.entries(sanitizedVars)) {
      body = body.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    
    return {
      subject: subject,
      body: body,
      template_id: templateId,
      template_version: template.version
    };
  }
  
  sanitizeVariable(value) {
    if (typeof value === 'string') {
      // Remove HTML tags
      value = value.replace(/<[^>]*>/g, '');
      
      // Escape special characters
      value = value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
      
      // Limit length
      if (value.length > 500) {
        value = value.substring(0, 500) + '...';
      }
    }
    
    return value;
  }
}

// Example template
const assignmentDueTemplate = {
  name: 'Assignment Due Reminder',
  type: 'assignment_reminder',
  subject: 'Reminder: {{assignment_name}} due {{due_date}}',
  body: `
    Dear {{student_name}},
    
    This is a reminder that your assignment "{{assignment_name}}" for {{course_name}} is due on {{due_date}}.
    
    Current status: {{submission_status}}
    
    Please submit your work before the deadline to avoid late penalties.
    
    Best regards,
    EduOS Team
  `,
  variables: [
    'student_name',
    'assignment_name',
    'course_name',
    'due_date',
    'submission_status'
  ]
};
```


#### 6.3.3 Compliance and Opt-Out Management

**CAN-SPAM and GDPR Compliance:**

```javascript
// Opt-out management
async function handleOptOut(userId, channel, reason = null) {
  await db('notification_opt_outs').insert({
    opt_out_id: uuidv4(),
    user_id: userId,
    channel: channel, // 'email', 'sms', 'push', 'all'
    reason: reason,
    opted_out_at: new Date()
  });
  
  // Update user preferences
  await db('users')
    .where({ user_id: userId })
    .update({
      [`notification_preferences.${channel}`]: false
    });
  
  // Create audit entry
  await createAuditEntry({
    action: 'notification_opt_out',
    user_id: userId,
    channel: channel,
    reason: reason
  });
  
  return { success: true, channel: channel };
}

// Check opt-out status
async function isOptedOut(userId, notificationType) {
  const optOuts = await db('notification_opt_outs')
    .where({ user_id: userId })
    .whereIn('channel', ['all', getChannelForType(notificationType)]);
  
  return optOuts.length > 0;
}

// Add unsubscribe link to emails
function addUnsubscribeLink(emailBody, userId, notificationType) {
  const unsubscribeUrl = `https://eduos.com/unsubscribe?user=${userId}&type=${notificationType}&token=${generateUnsubscribeToken(userId)}`;
  
  const footer = `
    <hr>
    <p style="font-size: 12px; color: #666;">
      If you no longer wish to receive these notifications, you can 
      <a href="${unsubscribeUrl}">unsubscribe here</a>.
    </p>
  `;
  
  return emailBody + footer;
}
```

#### 6.3.4 Notification Analytics

**Tracking Delivery and Engagement:**

```javascript
async function trackNotificationEngagement(notificationId, event, metadata = {}) {
  await db('notification_analytics').insert({
    analytics_id: uuidv4(),
    notification_id: notificationId,
    event: event, // 'sent', 'delivered', 'opened', 'clicked', 'bounced'
    metadata: metadata,
    timestamp: new Date()
  });
}

// Get notification metrics
async function getNotificationMetrics(tenantId, startDate, endDate) {
  const metrics = await db('notification_analytics')
    .join('notifications', 'notification_analytics.notification_id', 'notifications.notification_id')
    .where('notifications.tenant_id', tenantId)
    .whereBetween('notification_analytics.timestamp', [startDate, endDate])
    .select(
      db.raw('COUNT(CASE WHEN event = \'sent\' THEN 1 END) as total_sent'),
      db.raw('COUNT(CASE WHEN event = \'delivered\' THEN 1 END) as total_delivered'),
      db.raw('COUNT(CASE WHEN event = \'opened\' THEN 1 END) as total_opened'),
      db.raw('COUNT(CASE WHEN event = \'clicked\' THEN 1 END) as total_clicked'),
      db.raw('COUNT(CASE WHEN event = \'bounced\' THEN 1 END) as total_bounced')
    )
    .first();
  
  return {
    total_sent: metrics.total_sent,
    delivery_rate: (metrics.total_delivered / metrics.total_sent) * 100,
    open_rate: (metrics.total_opened / metrics.total_delivered) * 100,
    click_rate: (metrics.total_clicked / metrics.total_delivered) * 100,
    bounce_rate: (metrics.total_bounced / metrics.total_sent) * 100
  };
}
```


---

### 6.4 Secure Media Pipeline & Storage Lifecycle (Requirement 29)

#### 6.4.1 Secure Upload Pipeline with Malware Scanning

**Upload Workflow:**

```javascript
class SecureMediaPipeline {
  async uploadFile(file, uploadedBy, tenantId) {
    const uploadId = uuidv4();
    
    // Step 1: Validate file
    const validation = await this.validateFile(file);
    if (!validation.valid) {
      throw new Error(`File validation failed: ${validation.reason}`);
    }
    
    // Step 2: Quarantine upload
    const quarantinePath = `/quarantine/${tenantId}/${uploadId}`;
    await this.moveToQuarantine(file, quarantinePath);
    
    // Step 3: Malware scan
    const scanResult = await this.scanForMalware(quarantinePath);
    
    if (scanResult.infected) {
      // Delete infected file
      await fs.unlink(quarantinePath);
      
      // Log security incident
      await this.logSecurityIncident({
        type: 'malware_detected',
        file_name: file.originalname,
        uploaded_by: uploadedBy,
        scan_result: scanResult
      });
      
      throw new Error('File contains malware and has been rejected');
    }
    
    // Step 4: Move to hot storage
    const fileId = uuidv4();
    const storagePath = `${tenantId}/${new Date().getFullYear()}/${fileId}`;
    const s3Key = await this.uploadToS3(quarantinePath, storagePath, 'hot');
    
    // Step 5: Create media record
    const media = await db('media_files').insert({
      file_id: fileId,
      tenant_id: tenantId,
      original_name: file.originalname,
      mime_type: file.mimetype,
      size_bytes: file.size,
      storage_tier: 'hot',
      s3_key: s3Key,
      uploaded_by: uploadedBy,
      uploaded_at: new Date(),
      scan_status: 'clean',
      scan_timestamp: scanResult.timestamp
    });
    
    // Step 6: Clean up quarantine
    await fs.unlink(quarantinePath);
    
    return {
      file_id: fileId,
      access_url: await this.generateSignedURL(fileId, 3600)
    };
  }
  
  async validateFile(file) {
    // Check file size
    const maxSize = 100 * 1024 * 1024; // 100 MB
    if (file.size > maxSize) {
      return { valid: false, reason: 'File size exceeds 100 MB limit' };
    }
    
    // Check file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'video/mp4',
      'audio/mpeg'
    ];
    
    if (!allowedTypes.includes(file.mimetype)) {
      return { valid: false, reason: `File type ${file.mimetype} not allowed` };
    }
    
    // Check file extension matches MIME type
    const ext = path.extname(file.originalname).toLowerCase();
    const expectedExt = mime.extension(file.mimetype);
    
    if (ext !== `.${expectedExt}`) {
      return { valid: false, reason: 'File extension does not match MIME type' };
    }
    
    return { valid: true };
  }
  
  async scanForMalware(filePath) {
    // Integration with ClamAV or similar
    const { stdout } = await exec(`clamscan --no-summary ${filePath}`);
    
    const infected = stdout.includes('FOUND');
    
    return {
      infected: infected,
      scanner: 'ClamAV',
      timestamp: new Date(),
      details: stdout
    };
  }
}
```


#### 6.4.2 Tiered Storage Lifecycle Management

**Storage Tiers:**
- **Hot:** Frequently accessed files (S3 Standard)
- **Warm:** Occasionally accessed files (S3 Infrequent Access)
- **Cold:** Rarely accessed files (S3 Glacier)

**Automated Tier Transition:**

```javascript
// Daily job to transition files between storage tiers
cron.schedule('0 3 * * *', async () => {
  console.log('Starting storage tier transition job');
  
  const now = new Date();
  
  // Hot → Warm (after 30 days of no access)
  const hotToWarm = await db('media_files')
    .where({ storage_tier: 'hot' })
    .where('last_accessed_at', '<', new Date(now - 30 * 86400000))
    .orWhereNull('last_accessed_at')
    .where('uploaded_at', '<', new Date(now - 30 * 86400000));
  
  for (const file of hotToWarm) {
    await transitionStorageTier(file.file_id, 'warm');
  }
  
  // Warm → Cold (after 90 days of no access)
  const warmToCold = await db('media_files')
    .where({ storage_tier: 'warm' })
    .where('last_accessed_at', '<', new Date(now - 90 * 86400000))
    .orWhereNull('last_accessed_at')
    .where('uploaded_at', '<', new Date(now - 90 * 86400000));
  
  for (const file of warmToCold) {
    await transitionStorageTier(file.file_id, 'cold');
  }
  
  console.log(`Transitioned ${hotToWarm.length} files to warm, ${warmToCold.length} files to cold`);
});

async function transitionStorageTier(fileId, targetTier) {
  const file = await db('media_files')
    .where({ file_id: fileId })
    .first();
  
  // Copy to new storage class
  const storageClass = {
    'hot': 'STANDARD',
    'warm': 'STANDARD_IA',
    'cold': 'GLACIER'
  }[targetTier];
  
  await s3.copyObject({
    Bucket: process.env.S3_BUCKET,
    CopySource: `${process.env.S3_BUCKET}/${file.s3_key}`,
    Key: file.s3_key,
    StorageClass: storageClass
  }).promise();
  
  // Update database
  await db('media_files')
    .where({ file_id: fileId })
    .update({
      storage_tier: targetTier,
      tier_transitioned_at: new Date()
    });
  
  // Create audit entry
  await createAuditEntry({
    action: 'storage_tier_transition',
    entity_type: 'media_file',
    entity_id: fileId,
    from_tier: file.storage_tier,
    to_tier: targetTier
  });
}
```


#### 6.4.3 Signed URL Access Control

**Time-Limited Access URLs:**

```javascript
async function generateSignedURL(fileId, expiresInSeconds = 3600) {
  const file = await db('media_files')
    .where({ file_id: fileId })
    .first();
  
  if (!file) {
    throw new Error('File not found');
  }
  
  // Check if file is in cold storage
  if (file.storage_tier === 'cold') {
    // Initiate Glacier retrieval if not already in progress
    const retrieval = await checkGlacierRetrieval(file.s3_key);
    
    if (!retrieval.available) {
      return {
        status: 'retrieving',
        message: 'File is in cold storage. Retrieval in progress.',
        estimated_time: '3-5 hours'
      };
    }
  }
  
  // Generate signed URL
  const signedUrl = s3.getSignedUrl('getObject', {
    Bucket: process.env.S3_BUCKET,
    Key: file.s3_key,
    Expires: expiresInSeconds,
    ResponseContentDisposition: `attachment; filename="${file.original_name}"`,
    ResponseContentType: file.mime_type
  });
  
  // Update last accessed timestamp
  await db('media_files')
    .where({ file_id: fileId })
    .update({ last_accessed_at: new Date() });
  
  // Log access
  await db('media_access_log').insert({
    access_id: uuidv4(),
    file_id: fileId,
    accessed_by: req.user.id,
    accessed_at: new Date(),
    ip_address: req.ip
  });
  
  return {
    status: 'available',
    url: signedUrl,
    expires_at: new Date(Date.now() + expiresInSeconds * 1000)
  };
}

// API endpoint for file access
app.get('/api/v1/media/:fileId', async (req, res) => {
  const { fileId } = req.params;
  
  // Check permissions
  const file = await db('media_files')
    .where({ file_id: fileId })
    .first();
  
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  // Verify user has access to this file
  const hasAccess = await checkFileAccess(req.user.id, file.tenant_id, fileId);
  
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Generate signed URL
  const result = await generateSignedURL(fileId, 3600);
  
  res.json(result);
});

async function checkFileAccess(userId, tenantId, fileId) {
  // Check if user belongs to the same tenant
  const user = await db('users')
    .where({ user_id: userId })
    .first();
  
  if (user.tenant_id !== tenantId) {
    return false;
  }
  
  // Check file-specific permissions
  const filePermissions = await db('file_permissions')
    .where({ file_id: fileId })
    .first();
  
  if (filePermissions) {
    // Check if user's role is in allowed roles
    return filePermissions.allowed_roles.includes(user.role);
  }
  
  // Default: allow access for same tenant
  return true;
}
```

---


### 6.5 Analytics and Reporting System (Requirement 9)

#### 6.5.1 Real-Time Analytics with Freshness Indicators

**Purpose:** Provide accurate, timely analytics with clear indicators of data freshness.

**Analytics Architecture:**

```javascript
class AnalyticsEngine {
  async getStudentEnrollmentMetrics(tenantId, dateRange) {
    // Query from read replica
    const metrics = await readReplica('analytics_db')
      .select(
        db.raw('COUNT(*) as total_students'),
        db.raw('COUNT(CASE WHEN status = \'active\' THEN 1 END) as active_students'),
        db.raw('COUNT(CASE WHEN status = \'suspended\' THEN 1 END) as suspended_students'),
        db.raw('MAX(updated_at) as last_updated')
      )
      .from('students')
      .where({ tenant_id: tenantId })
      .whereBetween('created_at', [dateRange.start, dateRange.end])
      .first();
    
    // Calculate freshness
    const now = new Date();
    const lastUpdated = new Date(metrics.last_updated);
    const freshnessMinutes = Math.floor((now - lastUpdated) / 60000);
    
    return {
      metrics: {
        total_students: metrics.total_students,
        active_students: metrics.active_students,
        suspended_students: metrics.suspended_students
      },
      freshness: {
        last_updated: lastUpdated,
        age_minutes: freshnessMinutes,
        status: this.getFreshnessStatus(freshnessMinutes)
      },
      generated_at: now
    };
  }
  
  getFreshnessStatus(ageMinutes) {
    if (ageMinutes < 5) return 'real-time';
    if (ageMinutes < 30) return 'fresh';
    if (ageMinutes < 120) return 'recent';
    return 'stale';
  }
}

// Freshness indicator in UI
const FreshnessIndicator = ({ freshness }) => {
  const colors = {
    'real-time': 'green',
    'fresh': 'blue',
    'recent': 'yellow',
    'stale': 'red'
  };
  
  return (
    <div className={`freshness-indicator ${colors[freshness.status]}`}>
      <span>Data as of {freshness.last_updated.toLocaleString()}</span>
      <span>({freshness.age_minutes} minutes ago)</span>
    </div>
  );
};
```


#### 6.5.2 Custom Report Builder

**Drag-and-Drop Report Builder:**

```javascript
class ReportBuilder {
  async createReport(reportConfig) {
    const report = await db('custom_reports').insert({
      report_id: uuidv4(),
      tenant_id: reportConfig.tenant_id,
      name: reportConfig.name,
      description: reportConfig.description,
      data_source: reportConfig.data_source, // 'students', 'grades', 'attendance'
      columns: reportConfig.columns,
      filters: reportConfig.filters,
      aggregations: reportConfig.aggregations,
      sort_by: reportConfig.sort_by,
      created_by: reportConfig.created_by,
      created_at: new Date()
    });
    
    return report;
  }
  
  async executeReport(reportId, parameters = {}) {
    const report = await db('custom_reports')
      .where({ report_id: reportId })
      .first();
    
    if (!report) {
      throw new Error('Report not found');
    }
    
    // Build query dynamically
    let query = db(report.data_source)
      .where({ tenant_id: report.tenant_id });
    
    // Apply filters
    for (const filter of report.filters) {
      query = this.applyFilter(query, filter, parameters);
    }
    
    // Select columns
    query = query.select(report.columns);
    
    // Apply aggregations
    if (report.aggregations) {
      for (const agg of report.aggregations) {
        query = query.select(db.raw(`${agg.function}(${agg.column}) as ${agg.alias}`));
      }
      
      if (report.group_by) {
        query = query.groupBy(report.group_by);
      }
    }
    
    // Apply sorting
    if (report.sort_by) {
      query = query.orderBy(report.sort_by.column, report.sort_by.direction);
    }
    
    // Execute query
    const results = await query;
    
    return {
      report_id: reportId,
      report_name: report.name,
      executed_at: new Date(),
      row_count: results.length,
      data: results
    };
  }
  
  applyFilter(query, filter, parameters) {
    const { column, operator, value } = filter;
    
    // Support parameter substitution
    const filterValue = value.startsWith('$') 
      ? parameters[value.substring(1)] 
      : value;
    
    switch (operator) {
      case 'equals':
        return query.where(column, filterValue);
      case 'not_equals':
        return query.whereNot(column, filterValue);
      case 'greater_than':
        return query.where(column, '>', filterValue);
      case 'less_than':
        return query.where(column, '<', filterValue);
      case 'contains':
        return query.where(column, 'like', `%${filterValue}%`);
      case 'in':
        return query.whereIn(column, filterValue);
      case 'between':
        return query.whereBetween(column, filterValue);
      default:
        return query;
    }
  }
}

// Example report configuration
const studentPerformanceReport = {
  tenant_id: 'tenant-uuid',
  name: 'Student Performance Summary',
  description: 'Summary of student grades by course',
  data_source: 'grades',
  columns: ['student_id', 'course_id', 'score', 'letter_grade'],
  filters: [
    { column: 'graded_at', operator: 'between', value: '$date_range' },
    { column: 'status', operator: 'equals', value: 'finalized' }
  ],
  aggregations: [
    { function: 'AVG', column: 'score', alias: 'average_score' },
    { function: 'COUNT', column: '*', alias: 'total_grades' }
  ],
  group_by: ['student_id', 'course_id'],
  sort_by: { column: 'average_score', direction: 'desc' },
  created_by: 'admin-uuid'
};
```


**SQL Mode for Power Users:**

```javascript
async function executeCustomSQL(tenantId, sqlQuery, userId) {
  // Validate user has SQL access permission
  const user = await db('users').where({ user_id: userId }).first();
  
  if (!user.permissions.includes('sql_reports')) {
    throw new Error('User does not have SQL report permissions');
  }
  
  // Parse and validate SQL (prevent destructive operations)
  const parsed = sqlParser.parse(sqlQuery);
  
  if (parsed.type !== 'select') {
    throw new Error('Only SELECT queries are allowed');
  }
  
  // Inject tenant filter automatically (Row-Level Security)
  const modifiedQuery = this.injectTenantFilter(sqlQuery, tenantId);
  
  // Execute with read-only connection
  const results = await readOnlyDb.raw(modifiedQuery);
  
  // Log SQL execution
  await db('sql_query_log').insert({
    log_id: uuidv4(),
    tenant_id: tenantId,
    user_id: userId,
    query: sqlQuery,
    row_count: results.rows.length,
    executed_at: new Date()
  });
  
  return {
    columns: results.fields.map(f => f.name),
    rows: results.rows,
    row_count: results.rows.length
  };
}

function injectTenantFilter(sqlQuery, tenantId) {
  // Simple injection for demonstration
  // Production would use proper SQL AST manipulation
  if (sqlQuery.toLowerCase().includes('where')) {
    return sqlQuery.replace(
      /where/i,
      `WHERE tenant_id = '${tenantId}' AND`
    );
  } else {
    return sqlQuery.replace(
      /from\s+(\w+)/i,
      `FROM $1 WHERE tenant_id = '${tenantId}'`
    );
  }
}
```

#### 6.5.3 Row-Level Security (RLS) Enforcement

**Automatic RLS for Reports:**

```javascript
// RLS middleware for analytics queries
class RLSEnforcer {
  async enforceRLS(query, userId) {
    const user = await db('users').where({ user_id: userId }).first();
    
    // Always filter by tenant
    query = query.where('tenant_id', user.tenant_id);
    
    // Role-based filtering
    if (user.role === 'teacher') {
      // Teachers can only see their own classes
      const teacherClasses = await db('class_assignments')
        .where({ teacher_id: userId })
        .pluck('class_id');
      
      query = query.whereIn('class_id', teacherClasses);
    }
    
    if (user.role === 'student') {
      // Students can only see their own data
      query = query.where('student_id', userId);
    }
    
    // Admins see all data within tenant (no additional filter)
    
    return query;
  }
}

// Apply RLS to all report queries
app.get('/api/v1/reports/:reportId/execute', async (req, res) => {
  const report = await db('custom_reports')
    .where({ report_id: req.params.reportId })
    .first();
  
  let query = db(report.data_source);
  
  // Enforce RLS
  const rlsEnforcer = new RLSEnforcer();
  query = await rlsEnforcer.enforceRLS(query, req.user.id);
  
  // Execute report
  const results = await query;
  
  res.json({
    report_id: req.params.reportId,
    data: results,
    rls_applied: true
  });
});
```


#### 6.5.4 Report Export (PDF, Excel, CSV)

**Multi-Format Export:**

```javascript
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

class ReportExporter {
  async exportReport(reportId, format, userId) {
    // Execute report
    const reportBuilder = new ReportBuilder();
    const reportData = await reportBuilder.executeReport(reportId);
    
    switch (format) {
      case 'pdf':
        return await this.exportToPDF(reportData);
      case 'excel':
        return await this.exportToExcel(reportData);
      case 'csv':
        return await this.exportToCSV(reportData);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
  
  async exportToPDF(reportData) {
    const doc = new PDFDocument();
    const filePath = `/exports/report_${reportData.report_id}.pdf`;
    const stream = fs.createWriteStream(filePath);
    
    doc.pipe(stream);
    
    // Header
    doc.fontSize(20).text(reportData.report_name, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Generated: ${reportData.executed_at.toLocaleString()}`);
    doc.text(`Total Records: ${reportData.row_count}`);
    doc.moveDown();
    
    // Table
    const columns = Object.keys(reportData.data[0] || {});
    const columnWidth = 500 / columns.length;
    
    // Header row
    doc.fontSize(10).font('Helvetica-Bold');
    columns.forEach((col, i) => {
      doc.text(col, 50 + (i * columnWidth), doc.y, { width: columnWidth });
    });
    doc.moveDown();
    
    // Data rows
    doc.font('Helvetica');
    reportData.data.forEach(row => {
      const y = doc.y;
      columns.forEach((col, i) => {
        doc.text(String(row[col] || ''), 50 + (i * columnWidth), y, { width: columnWidth });
      });
      doc.moveDown(0.5);
    });
    
    doc.end();
    
    return new Promise((resolve) => {
      stream.on('finish', () => {
        resolve({
          format: 'pdf',
          file_path: filePath,
          download_url: `/api/v1/reports/${reportData.report_id}/download`
        });
      });
    });
  }
  
  async exportToExcel(reportData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(reportData.report_name);
    
    // Add header row
    const columns = Object.keys(reportData.data[0] || {});
    worksheet.columns = columns.map(col => ({
      header: col,
      key: col,
      width: 20
    }));
    
    // Add data rows
    reportData.data.forEach(row => {
      worksheet.addRow(row);
    });
    
    // Style header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Save file
    const filePath = `/exports/report_${reportData.report_id}.xlsx`;
    await workbook.xlsx.writeFile(filePath);
    
    return {
      format: 'excel',
      file_path: filePath,
      download_url: `/api/v1/reports/${reportData.report_id}/download`
    };
  }
  
  async exportToCSV(reportData) {
    const columns = Object.keys(reportData.data[0] || {});
    
    // Header row
    let csv = columns.join(',') + '\n';
    
    // Data rows
    reportData.data.forEach(row => {
      const values = columns.map(col => {
        const value = row[col];
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csv += values.join(',') + '\n';
    });
    
    const filePath = `/exports/report_${reportData.report_id}.csv`;
    await fs.writeFile(filePath, csv);
    
    return {
      format: 'csv',
      file_path: filePath,
      download_url: `/api/v1/reports/${reportData.report_id}/download`
    };
  }
}
```

---


### 6.6 Monitoring and Observability (Requirement 17)

#### 6.6.1 Metrics Collection (Prometheus + Grafana)

**Infrastructure Metrics:**

```javascript
const promClient = require('prom-client');

// Create a Registry
const register = new promClient.Registry();

// Add default metrics (CPU, Memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom application metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeUsers = new promClient.Gauge({
  name: 'active_users_total',
  help: 'Number of currently active users',
  labelNames: ['tenant_id']
});

const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1]
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(activeUsers);
register.registerMetric(dbQueryDuration);

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    
    httpRequestDuration.observe(
      { method: req.method, route: req.route?.path || req.path, status_code: res.statusCode },
      duration
    );
    
    httpRequestTotal.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode
    });
  });
  
  next();
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Update active users gauge periodically
setInterval(async () => {
  const tenants = await db('tenants').select('tenant_id');
  
  for (const tenant of tenants) {
    const count = await redis.scard(`active_users:${tenant.tenant_id}`);
    activeUsers.set({ tenant_id: tenant.tenant_id }, count);
  }
}, 30000); // Every 30 seconds
```

**Grafana Dashboard Configuration:**

```json
{
  "dashboard": {
    "title": "EduOS Platform Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "{{route}}"
          }
        ]
      },
      {
        "title": "Active Users by Tenant",
        "targets": [
          {
            "expr": "active_users_total",
            "legendFormat": "{{tenant_id}}"
          }
        ]
      },
      {
        "title": "Database Query Performance",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))",
            "legendFormat": "{{query_type}} - {{table}}"
          }
        ]
      }
    ]
  }
}
```


#### 6.6.2 Distributed Tracing (Jaeger)

**OpenTelemetry Integration:**

```javascript
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

// Initialize tracer
const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'eduos-api',
    [SemanticResourceAttributes.SERVICE_VERSION]: '2.1.0'
  })
});

const exporter = new JaegerExporter({
  endpoint: 'http://jaeger:14268/api/traces'
});

provider.addSpanProcessor(new BatchSpanProcessor(exporter));
provider.register();

const tracer = provider.getTracer('eduos-api');

// Tracing middleware
app.use((req, res, next) => {
  const span = tracer.startSpan(`${req.method} ${req.path}`, {
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.target': req.path,
      'http.user_agent': req.headers['user-agent'],
      'tenant.id': req.user?.tenant_id
    }
  });
  
  req.span = span;
  
  res.on('finish', () => {
    span.setAttribute('http.status_code', res.statusCode);
    span.end();
  });
  
  next();
});

// Example: Tracing database queries
async function getStudent(studentId, parentSpan) {
  const span = tracer.startSpan('db.query.students', {
    parent: parentSpan,
    attributes: {
      'db.system': 'postgresql',
      'db.operation': 'SELECT',
      'db.table': 'students'
    }
  });
  
  try {
    const student = await db('students')
      .where({ student_id: studentId })
      .first();
    
    span.setAttribute('db.rows_returned', student ? 1 : 0);
    return student;
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}

// Example: Tracing external API calls
async function sendNotification(notification, parentSpan) {
  const span = tracer.startSpan('external.twilio.sms', {
    parent: parentSpan,
    attributes: {
      'peer.service': 'twilio',
      'messaging.destination': notification.phone
    }
  });
  
  try {
    const result = await twilioClient.messages.create({
      to: notification.phone,
      from: process.env.TWILIO_PHONE,
      body: notification.message
    });
    
    span.setAttribute('messaging.message_id', result.sid);
    return result;
  } catch (error) {
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}
```


#### 6.6.3 Centralized Structured Logging (ELK Stack)

**Winston Logger Configuration:**

```javascript
const winston = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'eduos-api',
    environment: process.env.NODE_ENV
  },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // Elasticsearch
    new ElasticsearchTransport({
      level: 'info',
      clientOpts: {
        node: process.env.ELASTICSEARCH_URL,
        auth: {
          username: process.env.ELASTICSEARCH_USER,
          password: process.env.ELASTICSEARCH_PASSWORD
        }
      },
      index: 'eduos-logs'
    })
  ]
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status_code: res.statusCode,
      duration_ms: duration,
      user_id: req.user?.id,
      tenant_id: req.user?.tenant_id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });
  });
  
  next();
});

// Structured logging examples
logger.info('Student created', {
  event: 'student.created',
  student_id: 'uuid-123',
  tenant_id: 'tenant-uuid',
  created_by: 'admin-uuid'
});

logger.error('Database connection failed', {
  event: 'db.connection.error',
  error: error.message,
  stack: error.stack,
  database: 'postgresql'
});

logger.warn('Rate limit exceeded', {
  event: 'rate_limit.exceeded',
  user_id: 'user-uuid',
  endpoint: '/api/v1/students',
  limit: 1000,
  current: 1050
});
```

**Kibana Dashboard Queries:**

```json
{
  "queries": [
    {
      "name": "Error Rate by Service",
      "query": "level:error",
      "aggregation": {
        "terms": {
          "field": "service.keyword"
        }
      }
    },
    {
      "name": "Slow Requests (>2s)",
      "query": "duration_ms:>2000",
      "sort": {
        "duration_ms": "desc"
      }
    },
    {
      "name": "Failed Login Attempts",
      "query": "event:auth.login.failed",
      "aggregation": {
        "terms": {
          "field": "user_id.keyword"
        }
      }
    }
  ]
}
```


#### 6.6.4 Intelligent Alerting with Escalation Policies

**Alert Configuration:**

```javascript
class AlertingEngine {
  constructor() {
    this.rules = [
      {
        rule_id: 'high-error-rate',
        name: 'High Error Rate',
        condition: 'error_rate > 5%',
        severity: 'critical',
        escalation_policy: 'on-call-engineers'
      },
      {
        rule_id: 'slow-response-time',
        name: 'Slow Response Time',
        condition: 'p95_response_time > 2s',
        severity: 'warning',
        escalation_policy: 'platform-team'
      },
      {
        rule_id: 'database-connection-pool-exhausted',
        name: 'Database Connection Pool Exhausted',
        condition: 'db_connections_available < 10',
        severity: 'critical',
        escalation_policy: 'on-call-engineers'
      }
    ];
    
    this.escalationPolicies = {
      'on-call-engineers': {
        levels: [
          { delay: 0, notify: ['pagerduty', 'slack'] },
          { delay: 300, notify: ['phone_call'] }, // 5 minutes
          { delay: 900, notify: ['escalate_to_manager'] } // 15 minutes
        ]
      },
      'platform-team': {
        levels: [
          { delay: 0, notify: ['slack'] },
          { delay: 600, notify: ['email'] } // 10 minutes
        ]
      }
    };
  }
  
  async evaluateRules() {
    for (const rule of this.rules) {
      const triggered = await this.checkCondition(rule.condition);
      
      if (triggered) {
        await this.triggerAlert(rule);
      }
    }
  }
  
  async checkCondition(condition) {
    // Parse and evaluate condition
    if (condition.includes('error_rate')) {
      const errorRate = await this.getErrorRate();
      const threshold = parseFloat(condition.match(/>\s*(\d+)%/)[1]);
      return errorRate > threshold;
    }
    
    if (condition.includes('p95_response_time')) {
      const p95 = await this.getP95ResponseTime();
      const threshold = parseFloat(condition.match(/>\s*(\d+)s/)[1]);
      return p95 > threshold;
    }
    
    if (condition.includes('db_connections_available')) {
      const available = await this.getAvailableDBConnections();
      const threshold = parseInt(condition.match(/<\s*(\d+)/)[1]);
      return available < threshold;
    }
    
    return false;
  }
  
  async triggerAlert(rule) {
    // Check if alert already active
    const existingAlert = await db('active_alerts')
      .where({ rule_id: rule.rule_id, status: 'active' })
      .first();
    
    if (existingAlert) {
      // Update existing alert
      await db('active_alerts')
        .where({ alert_id: existingAlert.alert_id })
        .update({
          last_triggered_at: new Date(),
          trigger_count: existingAlert.trigger_count + 1
        });
      
      return;
    }
    
    // Create new alert
    const alert = await db('active_alerts').insert({
      alert_id: uuidv4(),
      rule_id: rule.rule_id,
      rule_name: rule.name,
      severity: rule.severity,
      status: 'active',
      triggered_at: new Date(),
      trigger_count: 1
    });
    
    // Execute escalation policy
    await this.executeEscalationPolicy(alert, rule.escalation_policy);
  }
  
  async executeEscalationPolicy(alert, policyName) {
    const policy = this.escalationPolicies[policyName];
    
    for (const level of policy.levels) {
      // Schedule notification
      setTimeout(async () => {
        // Check if alert still active
        const currentAlert = await db('active_alerts')
          .where({ alert_id: alert.alert_id })
          .first();
        
        if (currentAlert.status !== 'active') {
          return; // Alert resolved, stop escalation
        }
        
        // Send notifications
        for (const channel of level.notify) {
          await this.sendAlertNotification(alert, channel);
        }
      }, level.delay * 1000);
    }
  }
  
  async sendAlertNotification(alert, channel) {
    const message = `[${alert.severity.toUpperCase()}] ${alert.rule_name} - Triggered at ${alert.triggered_at}`;
    
    switch (channel) {
      case 'pagerduty':
        await pagerduty.trigger({
          routing_key: process.env.PAGERDUTY_KEY,
          event_action: 'trigger',
          payload: {
            summary: message,
            severity: alert.severity,
            source: 'eduos-monitoring'
          }
        });
        break;
      
      case 'slack':
        await slack.chat.postMessage({
          channel: '#alerts',
          text: message,
          attachments: [{
            color: alert.severity === 'critical' ? 'danger' : 'warning',
            fields: [
              { title: 'Alert ID', value: alert.alert_id, short: true },
              { title: 'Severity', value: alert.severity, short: true }
            ]
          }]
        });
        break;
      
      case 'email':
        await sendEmail({
          to: 'platform-team@eduos.com',
          subject: `Alert: ${alert.rule_name}`,
          body: message
        });
        break;
      
      case 'phone_call':
        await twilio.calls.create({
          to: process.env.ON_CALL_PHONE,
          from: process.env.TWILIO_PHONE,
          twiml: `<Response><Say>Critical alert: ${alert.rule_name}</Say></Response>`
        });
        break;
    }
  }
}

// Run alert evaluation every minute
cron.schedule('* * * * *', async () => {
  const alerting = new AlertingEngine();
  await alerting.evaluateRules();
});
```

---


### 6.7 Workflow Engine with Sandbox Testing (Requirement 27)

#### 6.7.1 Sandbox Environment Architecture

**Isolated Testing Environment:**

```javascript
class WorkflowSandbox {
  constructor() {
    this.sandboxDB = createSandboxDatabase(); // Separate DB instance
    this.testDataGenerator = new TestDataGenerator();
  }
  
  async createSandboxEnvironment(workflowId, userId) {
    // Create isolated sandbox instance
    const sandbox = await db('workflow_sandboxes').insert({
      sandbox_id: uuidv4(),
      workflow_id: workflowId,
      created_by: userId,
      created_at: new Date(),
      status: 'active',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
    
    // Clone workflow definition to sandbox
    const workflow = await db('workflow_definitions')
      .where({ workflow_id: workflowId })
      .first();
    
    await this.sandboxDB('workflow_definitions').insert({
      ...workflow,
      workflow_id: `sandbox_${workflowId}`,
      environment: 'sandbox'
    });
    
    // Generate dummy test data
    await this.testDataGenerator.generateTestData(sandbox.sandbox_id);
    
    return sandbox;
  }
  
  async executeWorkflowInSandbox(sandboxId, workflowId, testInput) {
    // Verify sandbox is active
    const sandbox = await db('workflow_sandboxes')
      .where({ sandbox_id: sandboxId, status: 'active' })
      .first();
    
    if (!sandbox) {
      throw new Error('Sandbox not found or expired');
    }
    
    // Execute workflow in isolated environment
    const execution = await this.sandboxDB('workflow_executions').insert({
      execution_id: uuidv4(),
      workflow_id: `sandbox_${workflowId}`,
      sandbox_id: sandboxId,
      input: testInput,
      started_at: new Date(),
      status: 'running'
    });
    
    try {
      // Run workflow steps
      const result = await this.runWorkflowSteps(execution.execution_id, testInput);
      
      // Record execution result
      await this.sandboxDB('workflow_executions')
        .where({ execution_id: execution.execution_id })
        .update({
          status: 'completed',
          output: result,
          completed_at: new Date()
        });
      
      return result;
    } catch (error) {
      // Record failure
      await this.sandboxDB('workflow_executions')
        .where({ execution_id: execution.execution_id })
        .update({
          status: 'failed',
          error: error.message,
          completed_at: new Date()
        });
      
      throw error;
    }
  }
  
  async promoteToProduction(sandboxId, workflowId) {
    // Verify all tests passed
    const executions = await this.sandboxDB('workflow_executions')
      .where({ sandbox_id: sandboxId });
    
    const failedTests = executions.filter(e => e.status === 'failed');
    
    if (failedTests.length > 0) {
      throw new Error(`Cannot promote: ${failedTests.length} tests failed`);
    }
    
    // Copy workflow definition to production
    const sandboxWorkflow = await this.sandboxDB('workflow_definitions')
      .where({ workflow_id: `sandbox_${workflowId}` })
      .first();
    
    await db('workflow_definitions')
      .where({ workflow_id: workflowId })
      .update({
        definition: sandboxWorkflow.definition,
        version: sandboxWorkflow.version,
        updated_at: new Date(),
        updated_by: sandboxWorkflow.updated_by
      });
    
    // Archive sandbox
    await db('workflow_sandboxes')
      .where({ sandbox_id: sandboxId })
      .update({ status: 'archived', archived_at: new Date() });
    
    return { success: true, message: 'Workflow promoted to production' };
  }
}
```

**Test Data Generator:**

```javascript
class TestDataGenerator {
  async generateTestData(sandboxId) {
    // Generate dummy students
    const students = [];
    for (let i = 0; i < 50; i++) {
      students.push({
        student_id: `test_student_${i}`,
        name: `Test Student ${i}`,
        email: `test${i}@sandbox.eduos.com`,
        sandbox_id: sandboxId
      });
    }
    
    await this.sandboxDB('students').insert(students);
    
    // Generate dummy courses
    const courses = [];
    for (let i = 0; i < 10; i++) {
      courses.push({
        course_id: `test_course_${i}`,
        name: `Test Course ${i}`,
        sandbox_id: sandboxId
      });
    }
    
    await this.sandboxDB('courses').insert(courses);
    
    // Generate enrollments
    const enrollments = [];
    students.forEach(student => {
      const numCourses = Math.floor(Math.random() * 5) + 1;
      const selectedCourses = courses.slice(0, numCourses);
      
      selectedCourses.forEach(course => {
        enrollments.push({
          enrollment_id: uuidv4(),
          student_id: student.student_id,
          course_id: course.course_id,
          sandbox_id: sandboxId
        });
      });
    });
    
    await this.sandboxDB('enrollments').insert(enrollments);
  }
}
```

---

#### 6.7.2 A/B Testing with Percentage Rollout

**Gradual Rollout Strategy:**

```javascript
class WorkflowABTesting {
  async createABTest(workflowId, variantA, variantB, rolloutPercentage) {
    const abTest = await db('workflow_ab_tests').insert({
      test_id: uuidv4(),
      workflow_id: workflowId,
      variant_a: variantA, // Original workflow definition
      variant_b: variantB, // New workflow definition
      rollout_percentage: rolloutPercentage, // % of users getting variant B
      status: 'active',
      started_at: new Date()
    });
    
    return abTest;
  }
  
  async selectVariant(testId, userId) {
    const test = await db('workflow_ab_tests')
      .where({ test_id: testId, status: 'active' })
      .first();
    
    if (!test) {
      throw new Error('A/B test not found or inactive');
    }
    
    // Consistent hashing to ensure same user always gets same variant
    const hash = crypto.createHash('sha256')
      .update(`${userId}_${testId}`)
      .digest('hex');
    
    const hashValue = parseInt(hash.substring(0, 8), 16);
    const percentage = (hashValue % 100);
    
    // Assign variant based on rollout percentage
    const variant = percentage < test.rollout_percentage ? 'B' : 'A';
    
    // Record assignment
    await db('workflow_variant_assignments').insert({
      assignment_id: uuidv4(),
      test_id: testId,
      user_id: userId,
      variant: variant,
      assigned_at: new Date()
    });
    
    return variant === 'A' ? test.variant_a : test.variant_b;
  }
  
  async collectMetrics(testId) {
    // Collect performance metrics for both variants
    const variantAMetrics = await db('workflow_executions')
      .join('workflow_variant_assignments', 'workflow_executions.user_id', 'workflow_variant_assignments.user_id')
      .where({ 
        'workflow_variant_assignments.test_id': testId,
        'workflow_variant_assignments.variant': 'A'
      })
      .select(
        db.raw('AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration'),
        db.raw('COUNT(*) as total_executions'),
        db.raw('SUM(CASE WHEN status = \'failed\' THEN 1 ELSE 0 END) as failures')
      )
      .first();
    
    const variantBMetrics = await db('workflow_executions')
      .join('workflow_variant_assignments', 'workflow_executions.user_id', 'workflow_variant_assignments.user_id')
      .where({ 
        'workflow_variant_assignments.test_id': testId,
        'workflow_variant_assignments.variant': 'B'
      })
      .select(
        db.raw('AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration'),
        db.raw('COUNT(*) as total_executions'),
        db.raw('SUM(CASE WHEN status = \'failed\' THEN 1 ELSE 0 END) as failures')
      )
      .first();
    
    return {
      variant_a: {
        avg_duration: variantAMetrics.avg_duration,
        total_executions: variantAMetrics.total_executions,
        failure_rate: variantAMetrics.failures / variantAMetrics.total_executions
      },
      variant_b: {
        avg_duration: variantBMetrics.avg_duration,
        total_executions: variantBMetrics.total_executions,
        failure_rate: variantBMetrics.failures / variantBMetrics.total_executions
      }
    };
  }
  
  async promoteWinner(testId, winningVariant) {
    const test = await db('workflow_ab_tests')
      .where({ test_id: testId })
      .first();
    
    const winnerDefinition = winningVariant === 'A' ? test.variant_a : test.variant_b;
    
    // Update production workflow
    await db('workflow_definitions')
      .where({ workflow_id: test.workflow_id })
      .update({
        definition: winnerDefinition,
        updated_at: new Date()
      });
    
    // Mark test as completed
    await db('workflow_ab_tests')
      .where({ test_id: testId })
      .update({
        status: 'completed',
        winner: winningVariant,
        completed_at: new Date()
      });
  }
}
```

---

#### 6.7.3 Blue/Green Deployment for Workflow Definitions

**Zero-Downtime Deployment:**

```javascript
class WorkflowBlueGreenDeployment {
  async createGreenDeployment(workflowId, newDefinition) {
    // Current production is "blue"
    const blueWorkflow = await db('workflow_definitions')
      .where({ workflow_id: workflowId, environment: 'production' })
      .first();
    
    // Create "green" deployment (new version)
    const greenWorkflow = await db('workflow_definitions').insert({
      workflow_id: `${workflowId}_green`,
      definition: newDefinition,
      version: blueWorkflow.version + 1,
      environment: 'green',
      status: 'standby',
      created_at: new Date()
    });
    
    return greenWorkflow;
  }
  
  async switchToGreen(workflowId) {
    const transaction = await db.transaction();
    
    try {
      // Mark blue as standby
      await transaction('workflow_definitions')
        .where({ workflow_id: workflowId, environment: 'production' })
        .update({
          environment: 'blue',
          status: 'standby'
        });
      
      // Promote green to production
      await transaction('workflow_definitions')
        .where({ workflow_id: `${workflowId}_green` })
        .update({
          workflow_id: workflowId,
          environment: 'production',
          status: 'active'
        });
      
      await transaction.commit();
      
      return { success: true, message: 'Switched to green deployment' };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  async rollbackToBlue(workflowId) {
    const transaction = await db.transaction();
    
    try {
      // Find blue deployment
      const blueWorkflow = await transaction('workflow_definitions')
        .where({ environment: 'blue', status: 'standby' })
        .orderBy('created_at', 'desc')
        .first();
      
      if (!blueWorkflow) {
        throw new Error('No blue deployment found for rollback');
      }
      
      // Mark current production as failed
      await transaction('workflow_definitions')
        .where({ workflow_id: workflowId, environment: 'production' })
        .update({
          environment: 'green',
          status: 'failed'
        });
      
      // Restore blue to production
      await transaction('workflow_definitions')
        .where({ workflow_id: blueWorkflow.workflow_id })
        .update({
          workflow_id: workflowId,
          environment: 'production',
          status: 'active'
        });
      
      await transaction.commit();
      
      return { success: true, message: 'Rolled back to blue deployment' };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  async healthCheck(workflowId) {
    // Run health checks on production workflow
    const workflow = await db('workflow_definitions')
      .where({ workflow_id: workflowId, environment: 'production' })
      .first();
    
    // Check recent execution success rate
    const recentExecutions = await db('workflow_executions')
      .where({ workflow_id: workflowId })
      .where('started_at', '>', new Date(Date.now() - 5 * 60 * 1000)) // Last 5 minutes
      .select('status');
    
    const totalExecutions = recentExecutions.length;
    const failedExecutions = recentExecutions.filter(e => e.status === 'failed').length;
    const successRate = totalExecutions > 0 ? (totalExecutions - failedExecutions) / totalExecutions : 1;
    
    // Auto-rollback if success rate drops below 90%
    if (successRate < 0.9) {
      await this.rollbackToBlue(workflowId);
      
      return {
        healthy: false,
        success_rate: successRate,
        action: 'auto_rollback_triggered'
      };
    }
    
    return {
      healthy: true,
      success_rate: successRate
    };
  }
}

// Automated health monitoring
cron.schedule('*/5 * * * *', async () => { // Every 5 minutes
  const deployment = new WorkflowBlueGreenDeployment();
  
  const activeWorkflows = await db('workflow_definitions')
    .where({ environment: 'production', status: 'active' });
  
  for (const workflow of activeWorkflows) {
    await deployment.healthCheck(workflow.workflow_id);
  }
});
```

---


### 6.8 Guardian & Family Relationship Management (Requirement 30)

#### 6.8.1 Many-to-Many Relationship Schema

**Database Schema:**

```sql
-- Guardians table
CREATE TABLE guardians (
  guardian_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  address JSONB, -- { street, city, state, postal_code, country }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT guardians_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- Student-Guardian relationship (many-to-many)
CREATE TABLE student_guardians (
  relationship_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(student_id),
  guardian_id UUID NOT NULL REFERENCES guardians(guardian_id),
  relationship_type VARCHAR(50) NOT NULL, -- 'parent', 'legal_guardian', 'foster_parent', 'grandparent', 'other'
  is_primary BOOLEAN DEFAULT FALSE, -- Primary guardian for communications
  custody_status VARCHAR(50) DEFAULT 'full', -- 'full', 'joint', 'none', 'restricted'
  can_pickup BOOLEAN DEFAULT TRUE, -- Authorized to pick up student
  can_view_grades BOOLEAN DEFAULT TRUE,
  can_view_attendance BOOLEAN DEFAULT TRUE,
  can_view_financial BOOLEAN DEFAULT TRUE,
  can_authorize_medical BOOLEAN DEFAULT FALSE,
  legal_restrictions TEXT, -- Free-text field for court orders, etc.
  effective_from DATE NOT NULL,
  effective_until DATE, -- NULL means indefinite
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT student_guardians_student_fk FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  CONSTRAINT student_guardians_guardian_fk FOREIGN KEY (guardian_id) REFERENCES guardians(guardian_id) ON DELETE CASCADE,
  CONSTRAINT student_guardians_unique UNIQUE (student_id, guardian_id)
);

CREATE INDEX idx_student_guardians_student ON student_guardians(student_id);
CREATE INDEX idx_student_guardians_guardian ON student_guardians(guardian_id);
CREATE INDEX idx_student_guardians_primary ON student_guardians(student_id, is_primary);
```

---

#### 6.8.2 Custody Flags and Access Control

**Guardian Access Control Logic:**

```javascript
class GuardianAccessControl {
  async checkAccess(guardianId, studentId, resourceType) {
    // Fetch relationship
    const relationship = await db('student_guardians')
      .where({ 
        guardian_id: guardianId, 
        student_id: studentId 
      })
      .where('effective_from', '<=', new Date())
      .where(function() {
        this.whereNull('effective_until')
          .orWhere('effective_until', '>=', new Date());
      })
      .first();
    
    if (!relationship) {
      return { 
        allowed: false, 
        reason: 'No active guardian relationship found' 
      };
    }
    
    // Check custody status
    if (relationship.custody_status === 'none' || relationship.custody_status === 'restricted') {
      return { 
        allowed: false, 
        reason: `Custody status: ${relationship.custody_status}`,
        legal_restrictions: relationship.legal_restrictions
      };
    }
    
    // Check resource-specific permissions
    const permissionMap = {
      'grades': relationship.can_view_grades,
      'attendance': relationship.can_view_attendance,
      'financial': relationship.can_view_financial,
      'medical': relationship.can_authorize_medical,
      'pickup': relationship.can_pickup
    };
    
    const hasPermission = permissionMap[resourceType];
    
    if (hasPermission === undefined) {
      return { 
        allowed: false, 
        reason: `Unknown resource type: ${resourceType}` 
      };
    }
    
    if (!hasPermission) {
      return { 
        allowed: false, 
        reason: `Guardian does not have permission to access ${resourceType}` 
      };
    }
    
    return { 
      allowed: true, 
      relationship_type: relationship.relationship_type,
      is_primary: relationship.is_primary
    };
  }
  
  async getAuthorizedGuardians(studentId, resourceType) {
    // Get all guardians with access to specific resource
    const guardians = await db('student_guardians')
      .join('guardians', 'student_guardians.guardian_id', 'guardians.guardian_id')
      .where({ 'student_guardians.student_id': studentId })
      .where('student_guardians.effective_from', '<=', new Date())
      .where(function() {
        this.whereNull('student_guardians.effective_until')
          .orWhere('student_guardians.effective_until', '>=', new Date());
      })
      .whereIn('student_guardians.custody_status', ['full', 'joint'])
      .select(
        'guardians.*',
        'student_guardians.relationship_type',
        'student_guardians.is_primary',
        'student_guardians.can_view_grades',
        'student_guardians.can_view_attendance',
        'student_guardians.can_view_financial',
        'student_guardians.can_authorize_medical',
        'student_guardians.can_pickup'
      );
    
    // Filter by resource type
    const permissionField = `can_view_${resourceType}`;
    return guardians.filter(g => g[permissionField] === true);
  }
  
  async updateCustodyStatus(relationshipId, newStatus, legalRestrictions, updatedBy) {
    // Audit custody changes
    const relationship = await db('student_guardians')
      .where({ relationship_id: relationshipId })
      .first();
    
    // Log custody change
    await db('custody_change_audit').insert({
      audit_id: uuidv4(),
      relationship_id: relationshipId,
      student_id: relationship.student_id,
      guardian_id: relationship.guardian_id,
      old_custody_status: relationship.custody_status,
      new_custody_status: newStatus,
      old_legal_restrictions: relationship.legal_restrictions,
      new_legal_restrictions: legalRestrictions,
      changed_by: updatedBy,
      changed_at: new Date()
    });
    
    // Update custody status
    await db('student_guardians')
      .where({ relationship_id: relationshipId })
      .update({
        custody_status: newStatus,
        legal_restrictions: legalRestrictions,
        updated_at: new Date()
      });
  }
}
```

---

#### 6.8.3 Emergency Contacts with Prioritization

**Emergency Contact Schema:**

```sql
-- Emergency contacts table
CREATE TABLE emergency_contacts (
  contact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(student_id),
  guardian_id UUID REFERENCES guardians(guardian_id), -- NULL if not a guardian
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  relationship VARCHAR(50) NOT NULL, -- 'parent', 'guardian', 'family_friend', 'neighbor', 'doctor', etc.
  phone_primary VARCHAR(20) NOT NULL,
  phone_secondary VARCHAR(20),
  email VARCHAR(255),
  priority_order INT NOT NULL, -- 1 = first contact, 2 = second, etc.
  can_pickup BOOLEAN DEFAULT FALSE,
  notes TEXT, -- Special instructions (e.g., "Call only after 6 PM")
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT emergency_contacts_student_fk FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  CONSTRAINT emergency_contacts_guardian_fk FOREIGN KEY (guardian_id) REFERENCES guardians(guardian_id) ON DELETE SET NULL,
  CONSTRAINT emergency_contacts_priority_unique UNIQUE (student_id, priority_order)
);

CREATE INDEX idx_emergency_contacts_student ON emergency_contacts(student_id);
CREATE INDEX idx_emergency_contacts_priority ON emergency_contacts(student_id, priority_order);
```

**Emergency Contact Management:**

```javascript
class EmergencyContactManager {
  async getEmergencyContacts(studentId) {
    // Get all emergency contacts ordered by priority
    const contacts = await db('emergency_contacts')
      .where({ student_id: studentId })
      .orderBy('priority_order', 'asc')
      .select('*');
    
    return contacts;
  }
  
  async addEmergencyContact(studentId, contactData) {
    // Validate priority order
    const existingContacts = await this.getEmergencyContacts(studentId);
    
    if (contactData.priority_order <= 0) {
      throw new Error('Priority order must be positive');
    }
    
    // Shift priorities if needed
    if (contactData.priority_order <= existingContacts.length) {
      await db('emergency_contacts')
        .where({ student_id: studentId })
        .where('priority_order', '>=', contactData.priority_order)
        .increment('priority_order', 1);
    }
    
    // Insert new contact
    const contact = await db('emergency_contacts').insert({
      contact_id: uuidv4(),
      student_id: studentId,
      ...contactData,
      created_at: new Date(),
      updated_at: new Date()
    });
    
    return contact;
  }
  
  async reorderContacts(studentId, newOrder) {
    // newOrder is an array of contact_ids in desired priority order
    const transaction = await db.transaction();
    
    try {
      for (let i = 0; i < newOrder.length; i++) {
        await transaction('emergency_contacts')
          .where({ 
            contact_id: newOrder[i], 
            student_id: studentId 
          })
          .update({ 
            priority_order: i + 1,
            updated_at: new Date()
          });
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  async notifyEmergencyContacts(studentId, emergencyType, message) {
    const contacts = await this.getEmergencyContacts(studentId);
    
    // Notify contacts in priority order
    for (const contact of contacts) {
      try {
        // Try primary phone first
        await this.sendSMS(contact.phone_primary, message);
        
        // Log successful notification
        await db('emergency_notifications').insert({
          notification_id: uuidv4(),
          student_id: studentId,
          contact_id: contact.contact_id,
          emergency_type: emergencyType,
          channel: 'sms',
          phone: contact.phone_primary,
          status: 'delivered',
          sent_at: new Date()
        });
        
        // If critical emergency, notify all contacts simultaneously
        if (emergencyType === 'critical') {
          continue; // Don't break, notify all
        } else {
          break; // For non-critical, stop after first successful contact
        }
      } catch (error) {
        // Try secondary phone
        if (contact.phone_secondary) {
          try {
            await this.sendSMS(contact.phone_secondary, message);
            
            await db('emergency_notifications').insert({
              notification_id: uuidv4(),
              student_id: studentId,
              contact_id: contact.contact_id,
              emergency_type: emergencyType,
              channel: 'sms',
              phone: contact.phone_secondary,
              status: 'delivered',
              sent_at: new Date()
            });
            
            if (emergencyType !== 'critical') {
              break;
            }
          } catch (secondaryError) {
            // Log failure
            await db('emergency_notifications').insert({
              notification_id: uuidv4(),
              student_id: studentId,
              contact_id: contact.contact_id,
              emergency_type: emergencyType,
              channel: 'sms',
              status: 'failed',
              error: secondaryError.message,
              sent_at: new Date()
            });
          }
        }
      }
    }
  }
  
  async sendSMS(phone, message) {
    // Integration with SMS provider (e.g., Twilio)
    return await twilio.messages.create({
      to: phone,
      from: process.env.TWILIO_PHONE,
      body: message
    });
  }
}
```

**Guardian Portal Access:**

```javascript
class GuardianPortal {
  async getStudentsByGuardian(guardianId) {
    // Get all students associated with this guardian
    const students = await db('student_guardians')
      .join('students', 'student_guardians.student_id', 'students.student_id')
      .where({ 'student_guardians.guardian_id': guardianId })
      .where('student_guardians.effective_from', '<=', new Date())
      .where(function() {
        this.whereNull('student_guardians.effective_until')
          .orWhere('student_guardians.effective_until', '>=', new Date());
      })
      .whereIn('student_guardians.custody_status', ['full', 'joint'])
      .select(
        'students.*',
        'student_guardians.relationship_type',
        'student_guardians.is_primary',
        'student_guardians.can_view_grades',
        'student_guardians.can_view_attendance',
        'student_guardians.can_view_financial'
      );
    
    return students;
  }
  
  async getStudentData(guardianId, studentId, dataType) {
    // Check access
    const accessControl = new GuardianAccessControl();
    const access = await accessControl.checkAccess(guardianId, studentId, dataType);
    
    if (!access.allowed) {
      throw new Error(`Access denied: ${access.reason}`);
    }
    
    // Fetch requested data based on type
    switch (dataType) {
      case 'grades':
        return await db('grades')
          .where({ student_id: studentId })
          .orderBy('created_at', 'desc');
      
      case 'attendance':
        return await db('attendance_records')
          .where({ student_id: studentId })
          .orderBy('date', 'desc');
      
      case 'financial':
        return await db('fee_transactions')
          .where({ student_id: studentId })
          .orderBy('transaction_date', 'desc');
      
      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }
  }
}
```

---


## 7. Module F: AI Governance & Ethical Intelligence

### 7.1 AI Governance Framework (Requirement 35)

#### 7.1.1 Human-in-the-Loop (HITL) Architecture

**Core Principle:** AI systems operate in **advisory mode only**. No AI algorithm may execute write operations on critical entities (Identity, Grade, Attendance) without explicit human approval.

**HITL Workflow:**

```javascript
class AIAdvisorySystem {
  async generateRecommendation(entityType, data, aiModel) {
    // Step 1: AI generates recommendation
    const aiResult = await this.callAIInferenceService(aiModel, data);
    
    // Step 2: Store as "Draft" with explainability metadata
    const recommendation = await db('ai_recommendations').insert({
      recommendation_id: uuidv4(),
      entity_type: entityType, // 'student_identity', 'grade', 'attendance'
      entity_id: data.entity_id,
      ai_model: aiModel,
      ai_version: aiResult.model_version,
      recommendation: aiResult.prediction,
      confidence_score: aiResult.confidence,
      reason_codes: aiResult.explainability, // SHAP values, feature importance
      status: 'pending_review', // NOT 'approved'
      created_at: new Date(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
    
    // Step 3: Notify human reviewer
    await this.notifyReviewer(recommendation);
    
    return recommendation;
  }
  
  async approveRecommendation(recommendationId, approverId, approvalToken) {
    // Verify approval token
    if (!this.verifyApprovalToken(approvalToken, approverId)) {
      throw new Error('Invalid approval token');
    }
    
    const recommendation = await db('ai_recommendations')
      .where({ recommendation_id: recommendationId })
      .first();
    
    if (!recommendation) {
      throw new Error('Recommendation not found');
    }
    
    if (recommendation.status !== 'pending_review') {
      throw new Error('Recommendation already processed');
    }
    
    // Step 4: Human approves -> Execute write operation
    const transaction = await db.transaction();
    
    try {
      // Apply the AI recommendation to the actual entity
      await this.applyRecommendation(transaction, recommendation);
      
      // Update recommendation status
      await transaction('ai_recommendations')
        .where({ recommendation_id: recommendationId })
        .update({
          status: 'approved',
          approved_by: approverId,
          approved_at: new Date()
        });
      
      // Audit trail
      await transaction('ai_approval_audit').insert({
        audit_id: uuidv4(),
        recommendation_id: recommendationId,
        entity_type: recommendation.entity_type,
        entity_id: recommendation.entity_id,
        approved_by: approverId,
        approval_token: approvalToken,
        approved_at: new Date()
      });
      
      await transaction.commit();
      
      return { success: true, message: 'Recommendation approved and applied' };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  async rejectRecommendation(recommendationId, reviewerId, rejectionReason) {
    await db('ai_recommendations')
      .where({ recommendation_id: recommendationId })
      .update({
        status: 'rejected',
        rejected_by: reviewerId,
        rejection_reason: rejectionReason,
        rejected_at: new Date()
      });
    
    // Feed rejection back to model for retraining
    await this.logRejectionForRetraining(recommendationId, rejectionReason);
  }
  
  async applyRecommendation(transaction, recommendation) {
    switch (recommendation.entity_type) {
      case 'student_identity':
        // AI suggested a merge
        await transaction('students')
          .where({ student_id: recommendation.recommendation.secondary_id })
          .update({
            status: 'merged',
            merged_into: recommendation.recommendation.primary_id,
            merged_at: new Date()
          });
        break;
      
      case 'attendance':
        // AI flagged anomaly
        await transaction('attendance_records')
          .where({ record_id: recommendation.entity_id })
          .update({
            verification_status: 'flagged',
            flag_reason: recommendation.reason_codes
          });
        break;
      
      case 'grade':
        // AI suggested grade adjustment (rare)
        await transaction('grades')
          .where({ grade_id: recommendation.entity_id })
          .update({
            adjusted_grade: recommendation.recommendation.suggested_grade,
            adjustment_reason: recommendation.reason_codes
          });
        break;
      
      default:
        throw new Error(`Unknown entity type: ${recommendation.entity_type}`);
    }
  }
  
  verifyApprovalToken(token, userId) {
    // Approval tokens are time-limited, single-use tokens
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    return decoded.user_id === userId && 
           decoded.purpose === 'ai_approval' &&
           decoded.exp > Date.now() / 1000;
  }
}
```

**Database Schema:**

```sql
CREATE TABLE ai_recommendations (
  recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  entity_type VARCHAR(50) NOT NULL, -- 'student_identity', 'grade', 'attendance'
  entity_id UUID NOT NULL,
  ai_model VARCHAR(100) NOT NULL, -- 'duplicate-detector-v2.1'
  ai_version VARCHAR(20) NOT NULL,
  recommendation JSONB NOT NULL, -- AI's suggested action
  confidence_score FLOAT NOT NULL,
  reason_codes JSONB NOT NULL, -- Explainability metadata (SHAP values)
  status VARCHAR(20) NOT NULL DEFAULT 'pending_review', -- 'pending_review', 'approved', 'rejected'
  approved_by UUID REFERENCES users(user_id),
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES users(user_id),
  rejection_reason TEXT,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_ai_recommendations_status ON ai_recommendations(status);
CREATE INDEX idx_ai_recommendations_entity ON ai_recommendations(entity_type, entity_id);
```

---

#### 7.1.2 Global AI Kill Switch

**Redis-Based Kill Switch:**

```javascript
class AIKillSwitch {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.killSwitchKey = 'global:ai:kill_switch';
  }
  
  async isAIEnabled() {
    // Check Redis flag
    const killSwitchActive = await this.redis.get(this.killSwitchKey);
    
    // If kill switch is active (value = '1'), AI is DISABLED
    return killSwitchActive !== '1';
  }
  
  async activateKillSwitch(adminId, reason) {
    // Verify admin has SuperAdmin role
    const admin = await db('users')
      .where({ user_id: adminId, role: 'superadmin' })
      .first();
    
    if (!admin) {
      throw new Error('Only SuperAdmins can activate the AI Kill Switch');
    }
    
    // Set kill switch flag
    await this.redis.set(this.killSwitchKey, '1');
    
    // Audit log
    await db('ai_kill_switch_audit').insert({
      audit_id: uuidv4(),
      action: 'activated',
      activated_by: adminId,
      reason: reason,
      activated_at: new Date()
    });
    
    // Broadcast to all services
    await this.redis.publish('ai:kill_switch', JSON.stringify({
      action: 'disable',
      timestamp: new Date().toISOString()
    }));
    
    return { success: true, message: 'AI Kill Switch activated. All AI inference disabled.' };
  }
  
  async deactivateKillSwitch(adminId) {
    // Verify admin has SuperAdmin role
    const admin = await db('users')
      .where({ user_id: adminId, role: 'superadmin' })
      .first();
    
    if (!admin) {
      throw new Error('Only SuperAdmins can deactivate the AI Kill Switch');
    }
    
    // Remove kill switch flag
    await this.redis.del(this.killSwitchKey);
    
    // Audit log
    await db('ai_kill_switch_audit').insert({
      audit_id: uuidv4(),
      action: 'deactivated',
      deactivated_by: adminId,
      deactivated_at: new Date()
    });
    
    // Broadcast to all services
    await this.redis.publish('ai:kill_switch', JSON.stringify({
      action: 'enable',
      timestamp: new Date().toISOString()
    }));
    
    return { success: true, message: 'AI Kill Switch deactivated. AI inference re-enabled.' };
  }
}
```


**AI Service Integration:**

```javascript
class AIInferenceService {
  constructor() {
    this.killSwitch = new AIKillSwitch();
    this.pythonServiceURL = process.env.AI_INFERENCE_URL;
  }
  
  async predict(modelName, inputData) {
    // Check kill switch BEFORE every inference call
    const aiEnabled = await this.killSwitch.isAIEnabled();
    
    if (!aiEnabled) {
      // AI is disabled, return deterministic fallback
      return this.deterministicFallback(modelName, inputData);
    }
    
    // AI is enabled, proceed with inference
    try {
      const response = await axios.post(`${this.pythonServiceURL}/predict`, {
        model: modelName,
        data: inputData
      });
      
      return response.data;
    } catch (error) {
      // If AI service fails, fallback to deterministic logic
      console.error('AI inference failed, using deterministic fallback:', error);
      return this.deterministicFallback(modelName, inputData);
    }
  }
  
  deterministicFallback(modelName, inputData) {
    // Fallback to rule-based logic when AI is disabled
    switch (modelName) {
      case 'duplicate-detector':
        // Use simple Levenshtein distance
        return this.levenshteinDuplicateDetection(inputData);
      
      case 'attendance-anomaly':
        // Use simple threshold-based detection
        return this.thresholdAnomalyDetection(inputData);
      
      case 'risk-predictor':
        // Use simple rule-based risk scoring
        return this.ruleBasedRiskScoring(inputData);
      
      default:
        throw new Error(`No deterministic fallback for model: ${modelName}`);
    }
  }
  
  levenshteinDuplicateDetection(inputData) {
    // Simple string similarity
    const similarity = this.calculateLevenshtein(
      inputData.name1, 
      inputData.name2
    );
    
    return {
      prediction: similarity > 0.8 ? 'duplicate' : 'not_duplicate',
      confidence: similarity,
      explainability: {
        method: 'deterministic_levenshtein',
        similarity_score: similarity
      }
    };
  }
}
```

---

#### 7.1.3 Bias Monitoring and Fairness Dashboard

**Demographic Tracking:**

```javascript
class FairnessMonitor {
  async trackPrediction(recommendationId, demographics) {
    // Store demographic metadata (anonymized)
    await db('ai_fairness_metrics').insert({
      metric_id: uuidv4(),
      recommendation_id: recommendationId,
      demographic_group: demographics.group, // 'gender', 'age_group', 'region'
      demographic_value: demographics.value, // 'male', '18-25', 'north'
      prediction_outcome: demographics.outcome, // 'approved', 'rejected'
      confidence_score: demographics.confidence,
      created_at: new Date()
    });
  }
  
  async generateFairnessDashboard(modelName, timeRange) {
    // Calculate accuracy rates across demographics
    const metrics = await db('ai_fairness_metrics')
      .join('ai_recommendations', 'ai_fairness_metrics.recommendation_id', 'ai_recommendations.recommendation_id')
      .where({ 'ai_recommendations.ai_model': modelName })
      .where('ai_fairness_metrics.created_at', '>=', timeRange.start)
      .where('ai_fairness_metrics.created_at', '<=', timeRange.end)
      .select(
        'ai_fairness_metrics.demographic_group',
        'ai_fairness_metrics.demographic_value',
        db.raw('COUNT(*) as total_predictions'),
        db.raw('SUM(CASE WHEN prediction_outcome = \'approved\' THEN 1 ELSE 0 END) as approved_count'),
        db.raw('AVG(confidence_score) as avg_confidence')
      )
      .groupBy('demographic_group', 'demographic_value');
    
    // Calculate approval rates
    const dashboard = metrics.map(m => ({
      demographic_group: m.demographic_group,
      demographic_value: m.demographic_value,
      total_predictions: m.total_predictions,
      approval_rate: m.approved_count / m.total_predictions,
      avg_confidence: m.avg_confidence
    }));
    
    // Detect bias (approval rate variance > 10%)
    const approvalRates = dashboard.map(d => d.approval_rate);
    const avgApprovalRate = approvalRates.reduce((a, b) => a + b, 0) / approvalRates.length;
    const maxDeviation = Math.max(...approvalRates.map(r => Math.abs(r - avgApprovalRate)));
    
    const biasDetected = maxDeviation > 0.1; // 10% threshold
    
    return {
      model: modelName,
      time_range: timeRange,
      metrics: dashboard,
      bias_detected: biasDetected,
      max_deviation: maxDeviation,
      recommendation: biasDetected 
        ? 'Bias detected. Review model training data and feature engineering.'
        : 'No significant bias detected.'
    };
  }
  
  async alertOnBias(modelName, dashboard) {
    if (dashboard.bias_detected) {
      // Send alert to Data Protection Officer
      await sendEmail({
        to: 'dpo@eduos.com',
        subject: `Bias Alert: ${modelName}`,
        body: `
          Algorithmic bias detected in model: ${modelName}
          
          Max deviation from average approval rate: ${(dashboard.max_deviation * 100).toFixed(2)}%
          
          Affected demographics:
          ${dashboard.metrics.map(m => 
            `- ${m.demographic_group}: ${m.demographic_value} (Approval Rate: ${(m.approval_rate * 100).toFixed(2)}%)`
          ).join('\n')}
          
          Recommendation: ${dashboard.recommendation}
        `
      });
      
      // Log alert
      await db('ai_bias_alerts').insert({
        alert_id: uuidv4(),
        model_name: modelName,
        max_deviation: dashboard.max_deviation,
        metrics: dashboard.metrics,
        alerted_at: new Date()
      });
    }
  }
}

// Scheduled bias monitoring (daily)
cron.schedule('0 2 * * *', async () => { // 2 AM daily
  const fairness = new FairnessMonitor();
  
  const models = ['duplicate-detector', 'attendance-anomaly', 'risk-predictor'];
  const timeRange = {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    end: new Date()
  };
  
  for (const model of models) {
    const dashboard = await fairness.generateFairnessDashboard(model, timeRange);
    await fairness.alertOnBias(model, dashboard);
  }
});
```

---


### 7.2 AI Model Lifecycle & Data Safety (Requirement 36)

#### 7.2.1 Model Versioning Strategy

**Version Management:**

```javascript
class AIModelRegistry {
  async registerModel(modelName, version, metadata) {
    // Register new model version
    const model = await db('ai_model_registry').insert({
      model_id: uuidv4(),
      model_name: modelName,
      version: version, // e.g., 'v2.1'
      training_data_range: metadata.training_data_range, // { start: '2024-01-01', end: '2024-12-31' }
      training_metrics: metadata.metrics, // { accuracy: 0.95, precision: 0.92, recall: 0.89 }
      feature_list: metadata.features, // ['name_similarity', 'dob_match', 'address_similarity']
      model_artifact_url: metadata.artifact_url, // S3 URL to model file
      status: 'staging', // 'staging', 'production', 'deprecated'
      created_at: new Date()
    });
    
    return model;
  }
  
  async validateModel(modelId, holdoutDataset) {
    // Run validation on holdout dataset
    const model = await db('ai_model_registry')
      .where({ model_id: modelId })
      .first();
    
    if (!model) {
      throw new Error('Model not found');
    }
    
    // Load model and run predictions on holdout data
    const predictions = await this.runPredictions(model, holdoutDataset);
    
    // Calculate validation metrics
    const validationMetrics = this.calculateMetrics(predictions, holdoutDataset.labels);
    
    // Store validation results
    await db('ai_model_validations').insert({
      validation_id: uuidv4(),
      model_id: modelId,
      holdout_dataset_size: holdoutDataset.size,
      validation_metrics: validationMetrics,
      passed: validationMetrics.accuracy >= 0.90, // 90% threshold
      validated_at: new Date()
    });
    
    return validationMetrics;
  }
  
  async promoteToProduction(modelId) {
    // Check validation passed
    const validation = await db('ai_model_validations')
      .where({ model_id: modelId })
      .orderBy('validated_at', 'desc')
      .first();
    
    if (!validation || !validation.passed) {
      throw new Error('Model validation failed or not found');
    }
    
    const model = await db('ai_model_registry')
      .where({ model_id: modelId })
      .first();
    
    // Demote current production model
    await db('ai_model_registry')
      .where({ 
        model_name: model.model_name, 
        status: 'production' 
      })
      .update({ 
        status: 'deprecated',
        deprecated_at: new Date()
      });
    
    // Promote new model
    await db('ai_model_registry')
      .where({ model_id: modelId })
      .update({ 
        status: 'production',
        promoted_at: new Date()
      });
    
    // Update Redis cache
    await this.redis.set(
      `ai:model:${model.model_name}:production`, 
      JSON.stringify(model)
    );
    
    return { success: true, message: `Model ${model.version} promoted to production` };
  }
  
  async rollbackModel(modelName) {
    // Find previous production model
    const previousModel = await db('ai_model_registry')
      .where({ 
        model_name: modelName, 
        status: 'deprecated' 
      })
      .orderBy('deprecated_at', 'desc')
      .first();
    
    if (!previousModel) {
      throw new Error('No previous model version found for rollback');
    }
    
    // Demote current production
    await db('ai_model_registry')
      .where({ 
        model_name: modelName, 
        status: 'production' 
      })
      .update({ 
        status: 'failed',
        failed_at: new Date()
      });
    
    // Restore previous model
    await db('ai_model_registry')
      .where({ model_id: previousModel.model_id })
      .update({ 
        status: 'production',
        restored_at: new Date()
      });
    
    // Update Redis cache
    await this.redis.set(
      `ai:model:${modelName}:production`, 
      JSON.stringify(previousModel)
    );
    
    return { success: true, message: `Rolled back to model ${previousModel.version}` };
  }
}
```

---

#### 7.2.2 Data Boundaries and Sanitization

**Strict Input Validation:**

```javascript
class AIDataBoundary {
  async sanitizeInput(entityType, rawData) {
    // Define allowed fields per entity type
    const allowedFields = {
      'student_identity': ['first_name', 'last_name', 'date_of_birth', 'email'],
      'attendance': ['student_id', 'date', 'status', 'location'],
      'risk_prediction': ['attendance_rate', 'assignment_completion_rate', 'login_frequency']
    };
    
    const allowed = allowedFields[entityType];
    
    if (!allowed) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }
    
    // Filter to only allowed fields
    const sanitized = {};
    for (const field of allowed) {
      if (rawData[field] !== undefined) {
        sanitized[field] = this.sanitizeField(field, rawData[field]);
      }
    }
    
    return sanitized;
  }
  
  sanitizeField(fieldName, value) {
    // Remove any HTML/script tags
    if (typeof value === 'string') {
      value = value.replace(/<[^>]*>/g, '');
      value = value.trim();
    }
    
    // Validate data types
    switch (fieldName) {
      case 'date_of_birth':
      case 'date':
        // Ensure valid date format
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date: ${value}`);
        }
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      case 'email':
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          throw new Error(`Invalid email: ${value}`);
        }
        return value.toLowerCase();
      
      case 'attendance_rate':
      case 'assignment_completion_rate':
      case 'login_frequency':
        // Ensure numeric
        const num = parseFloat(value);
        if (isNaN(num)) {
          throw new Error(`Invalid number: ${value}`);
        }
        return num;
      
      default:
        return value;
    }
  }
  
  async validateConsent(userId, dataType) {
    // Check if user has consented to AI processing
    const consent = await db('ai_data_consent')
      .where({ 
        user_id: userId, 
        data_type: dataType,
        status: 'active'
      })
      .first();
    
    if (!consent) {
      throw new Error(`User has not consented to AI processing of ${dataType}`);
    }
    
    return true;
  }
  
  async sendToAIService(entityType, sanitizedData) {
    // Final validation before sending to Python inference service
    const validated = await this.sanitizeInput(entityType, sanitizedData);
    
    // Log data transfer
    await db('ai_data_transfers').insert({
      transfer_id: uuidv4(),
      entity_type: entityType,
      data_hash: crypto.createHash('sha256').update(JSON.stringify(validated)).digest('hex'),
      transferred_at: new Date()
    });
    
    // Send to AI service
    const response = await axios.post(`${process.env.AI_INFERENCE_URL}/predict`, {
      entity_type: entityType,
      data: validated
    });
    
    return response.data;
  }
}
```

**User-Generated Content Restrictions:**

```javascript
class AIContentPolicy {
  async checkContentEligibility(content, contentType) {
    // NO user-generated free-text allowed in decision models
    const restrictedTypes = ['free_text', 'essay', 'comment', 'feedback'];
    
    if (restrictedTypes.includes(contentType)) {
      return {
        eligible: false,
        reason: 'User-generated free-text is not permitted in AI decision models'
      };
    }
    
    // Only structured, system-approved data
    const approvedTypes = ['structured_field', 'enum_value', 'numeric_metric'];
    
    if (!approvedTypes.includes(contentType)) {
      return {
        eligible: false,
        reason: `Content type ${contentType} is not approved for AI processing`
      };
    }
    
    return { eligible: true };
  }
}
```

---

#### 7.2.3 Explainability with SHAP Values

**SHAP Integration:**

```python
# Python AI Inference Service (FastAPI)
from fastapi import FastAPI
import shap
import joblib
import numpy as np

app = FastAPI()

class ExplainableModel:
    def __init__(self, model_path):
        self.model = joblib.load(model_path)
        self.explainer = shap.TreeExplainer(self.model)  # For tree-based models
    
    def predict_with_explanation(self, input_data):
        # Convert input to numpy array
        X = np.array([list(input_data.values())])
        
        # Make prediction
        prediction = self.model.predict(X)[0]
        confidence = self.model.predict_proba(X)[0].max()
        
        # Generate SHAP values
        shap_values = self.explainer.shap_values(X)
        
        # Extract feature importance
        feature_names = list(input_data.keys())
        feature_importance = {}
        
        for i, feature in enumerate(feature_names):
            feature_importance[feature] = float(shap_values[0][i])
        
        # Sort by absolute importance
        sorted_features = sorted(
            feature_importance.items(), 
            key=lambda x: abs(x[1]), 
            reverse=True
        )
        
        # Generate human-readable explanation
        explanation = self.generate_explanation(sorted_features, prediction)
        
        return {
            'prediction': prediction,
            'confidence': float(confidence),
            'shap_values': feature_importance,
            'top_features': sorted_features[:3],  # Top 3 features
            'explanation': explanation,
            'model_version': 'v2.1'
        }
    
    def generate_explanation(self, sorted_features, prediction):
        # Generate natural language explanation
        top_feature = sorted_features[0]
        
        if prediction == 'duplicate':
            return f"Flagged as potential duplicate primarily due to {top_feature[0]} " \
                   f"(importance: {abs(top_feature[1]):.2f}). " \
                   f"Other contributing factors: {sorted_features[1][0]}, {sorted_features[2][0]}."
        elif prediction == 'anomaly':
            return f"Attendance anomaly detected. Primary factor: {top_feature[0]} " \
                   f"(importance: {abs(top_feature[1]):.2f})."
        elif prediction == 'high_risk':
            return f"Student flagged as high risk. Main concern: {top_feature[0]} " \
                   f"(importance: {abs(top_feature[1]):.2f})."
        else:
            return f"Prediction: {prediction}. Key factor: {top_feature[0]}."

@app.post("/predict")
async def predict(request: dict):
    model_name = request['model']
    input_data = request['data']
    
    # Load model
    model = ExplainableModel(f'/models/{model_name}.pkl')
    
    # Predict with explanation
    result = model.predict_with_explanation(input_data)
    
    return result
```

**Storing Explainability Metadata:**

```javascript
// Node.js backend
class ExplainabilityStorage {
  async storeExplanation(recommendationId, shapValues, explanation) {
    await db('ai_explainability').insert({
      explainability_id: uuidv4(),
      recommendation_id: recommendationId,
      shap_values: shapValues, // JSONB
      top_features: shapValues.top_features,
      natural_language_explanation: explanation,
      created_at: new Date()
    });
  }
  
  async getExplanation(recommendationId) {
    const explanation = await db('ai_explainability')
      .where({ recommendation_id: recommendationId })
      .first();
    
    return explanation;
  }
}
```

---


### 7.3 Data Models and Entity Relationships

#### 7.3.1 Core Entity Relationship Diagram (ERD)

**Conceptual ERD:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EDUOS PLATFORM - CORE DATA MODEL                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│    TENANTS       │
│──────────────────│
│ tenant_id (PK)   │
│ name             │
│ tier             │
│ created_at       │
└────────┬─────────┘
         │
         │ 1:N
         │
         ├─────────────────────────────────────────────────────────────┐
         │                                                             │
         ▼                                                             ▼
┌──────────────────┐                                         ┌──────────────────┐
│    STUDENTS      │                                         │    GUARDIANS     │
│──────────────────│                                         │──────────────────│
│ student_id (PK)  │◄────────────────────────────────────────┤ guardian_id (PK) │
│ tenant_id (FK)   │         N:M (student_guardians)         │ tenant_id (FK)   │
│ first_name       │                                         │ first_name       │
│ last_name        │                                         │ last_name        │
│ date_of_birth    │                                         │ email            │
│ snapshot_id (FK) │                                         │ phone            │
│ created_at       │                                         │ created_at       │
└────────┬─────────┘                                         └──────────────────┘
         │
         │ 1:N
         │
         ├──────────────────┬──────────────────┬──────────────────┐
         │                  │                  │                  │
         ▼                  ▼                  ▼                  ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   ENROLLMENTS    │ │ ATTENDANCE_REC   │ │  FEE_TRANS       │ │     GRADES       │
│──────────────────│ │──────────────────│ │──────────────────│ │──────────────────│
│ enrollment_id    │ │ record_id (PK)   │ │ transaction_id   │ │ grade_id (PK)    │
│ student_id (FK)  │ │ student_id (FK)  │ │ student_id (FK)  │ │ student_id (FK)  │
│ program_id (FK)  │ │ date             │ │ amount           │ │ assessment_id    │
│ batch_id (FK)    │ │ status           │ │ payment_method   │ │ score            │
│ status           │ │ location         │ │ status           │ │ grade_letter     │
│ enrolled_at      │ │ created_at       │ │ created_at       │ │ finalized_at     │
└──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘


┌──────────────────┐
│ SCHEMA_SNAPSHOTS │
│──────────────────│
│ snapshot_id (PK) │◄─────────────────────────────────────────┐
│ tenant_id (FK)   │                                          │
│ form_type        │                                          │
│ semantic_version │                                          │
│ schema_hash      │                                          │
│ schema_def (JSON)│                                          │
│ created_at       │                                          │
└──────────────────┘                                          │
                                                              │
                                                              │ References
                                                              │
                                                    ┌─────────┴─────────┐
                                                    │    STUDENTS       │
                                                    │ snapshot_id (FK)  │
                                                    └───────────────────┘



┌──────────────────────────────────────────────────────────────────────────────┐
│                    GUARDIAN & EMERGENCY CONTACT RELATIONSHIPS                 │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐                    ┌──────────────────────┐
│    STUDENTS      │                    │  STUDENT_GUARDIANS   │
│──────────────────│                    │──────────────────────│
│ student_id (PK)  │◄───────────────────┤ relationship_id (PK) │
└──────────────────┘         1:N        │ student_id (FK)      │
                                        │ guardian_id (FK)     │
┌──────────────────┐                    │ relationship_type    │
│    GUARDIANS     │                    │ custody_status       │
│──────────────────│                    │ can_pickup           │
│ guardian_id (PK) │◄───────────────────┤ can_view_grades      │
└──────────────────┘         1:N        │ effective_from       │
                                        │ effective_until      │
                                        └──────────────────────┘

┌──────────────────┐                    ┌──────────────────────┐
│    STUDENTS      │                    │ EMERGENCY_CONTACTS   │
│──────────────────│                    │──────────────────────│
│ student_id (PK)  │◄───────────────────┤ contact_id (PK)      │
└──────────────────┘         1:N        │ student_id (FK)      │
                                        │ guardian_id (FK)     │
                                        │ first_name           │
                                        │ phone_primary        │
                                        │ priority_order       │
                                        │ can_pickup           │
                                        └──────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────┐
│                         AI GOVERNANCE & RECOMMENDATIONS                       │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐                    ┌──────────────────────┐
│ AI_RECOMMEND     │                    │ AI_EXPLAINABILITY    │
│──────────────────│                    │──────────────────────│
│ recommend_id(PK) │◄───────────────────┤ explainability_id    │
│ entity_type      │         1:1        │ recommendation_id(FK)│
│ entity_id        │                    │ shap_values (JSON)   │
│ ai_model         │                    │ top_features         │
│ recommendation   │                    │ nl_explanation       │
│ confidence_score │                    └──────────────────────┘
│ status           │
│ approved_by      │
│ approved_at      │
└──────────────────┘

┌──────────────────┐                    ┌──────────────────────┐
│ AI_MODEL_REG     │                    │ AI_MODEL_VALIDATIONS │
│──────────────────│                    │──────────────────────│
│ model_id (PK)    │◄───────────────────┤ validation_id (PK)   │
│ model_name       │         1:N        │ model_id (FK)        │
│ version          │                    │ holdout_dataset_size │
│ training_data    │                    │ validation_metrics   │
│ status           │                    │ passed               │
│ created_at       │                    │ validated_at         │
└──────────────────┘                    └──────────────────────┘
```

---

#### 7.3.2 Key Entity Descriptions

**1. Tenants**
- Root entity for multi-tenancy
- Each institution is a separate tenant
- Enforces data isolation via Row-Level Security (RLS)
- Stores tier information (Basic, Business, Enterprise)

**2. Students**
- Canonical student identity with immutable UUID
- References `snapshot_id` to preserve schema version at creation time
- Supports merge operations with audit trail
- Core entity for all academic and financial transactions

**3. Guardians**
- Represents parents, legal guardians, or authorized adults
- Many-to-many relationship with students via `student_guardians`
- Supports complex custody arrangements and access control

**4. Student_Guardians (Junction Table)**
- Manages many-to-many relationships between students and guardians
- Stores granular permissions (can_view_grades, can_pickup, etc.)
- Tracks custody status (full, joint, none, restricted)
- Time-bound relationships with `effective_from` and `effective_until`

**5. Emergency_Contacts**
- Prioritized list of contacts for emergencies
- Can reference guardians or be standalone contacts
- Supports intelligent notification cascading based on priority

**6. Enrollments**
- Links students to programs, classes, and batches
- Tracks enrollment status and dates
- Foundation for academic record keeping

**7. Attendance_Records**
- Offline-first design with sync support
- Stores location and timestamp data
- Integrates with AI anomaly detection

**8. Fee_Transactions**
- Financial records with idempotent processing
- Links to payment gateway webhooks
- Supports refunds and reconciliation

**9. Grades**
- Cryptographically signed immutable records
- Supports appeals workflow with versioning
- Links to assessments and students

**10. Schema_Snapshots**
- Immutable form schema versions
- SHA-256 hashed for integrity verification
- Enables historic rendering of records

**11. AI_Recommendations**
- Stores AI-generated suggestions in "pending_review" status
- Requires human approval before execution
- Links to explainability metadata

**12. AI_Explainability**
- Stores SHAP values and feature importance
- Provides natural language explanations
- Enables transparency and auditability

**13. AI_Model_Registry**
- Tracks all AI model versions
- Stores training metadata and metrics
- Supports promotion, rollback, and deprecation

**14. AI_Model_Validations**
- Records validation results on holdout datasets
- Gates model promotion to production
- Ensures quality control

---



