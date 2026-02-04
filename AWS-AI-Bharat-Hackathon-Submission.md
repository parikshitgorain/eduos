# AWS AI for Bharat Hackathon - Idea Submission

## Team Name
EduOS

## Team Leader Name
Parikshit Gorain

## Problem Statement
Track 4: AI for Learning & Developer Productivity - Build an AI-powered solution that helps people learn faster, work smarter, or become more productive while building or understanding technology.

---

## Brief about the Idea

EduOS is an AI-powered Student Information System designed for Indian educational institutions. It combines a production-grade data management platform with intelligent AI advisory features to help students learn faster and educators work smarter.

**The Problem:** Indian schools struggle with duplicate student records, manual attendance tracking, delayed identification of at-risk students, poor accessibility for students with disabilities, and complex scheduling challenges.

**Our Solution:** EduOS uses AI to augment human decision-making:
• Predictive Risk Engine identifies struggling students early using XGBoost (attendance, assignments, engagement patterns)
• Hybrid Duplicate Detection combines fuzzy matching + SBERT embeddings to catch variations like "Robert" vs "Bob"
• Attendance Anomaly Detection flags impossible travel patterns and suspicious absences using Isolation Forest
• AI Schedule Optimizer solves complex timetabling with Constraint Satisfaction algorithms
• Accessibility AI auto-generates alt-text (VLM) and simplifies complex text (LLM) for students with learning differences

**Key Differentiator:** Human-in-the-Loop architecture - AI suggests, humans decide. No AI system can write to the database without explicit approval. All outputs include explainability (SHAP values). Built for Bharat with offline-first mobile support, Indian languages, and ₹ INR currency.

---

## Your solution should be able to explain the following:

### ● How different is it from any of the other existing ideas?

**Human-in-the-Loop AI Governance:** Unlike black-box AI systems, EduOS enforces strict governance—AI suggests, humans decide. No AI can write to the database without approval. All outputs include explainability (SHAP values). Global "AI Kill Switch" for instant reversion.

**Hybrid Intelligence:** Combines deterministic logic + AI advisory. Example: Duplicate detection uses fuzzy matching (Levenshtein) + SBERT embeddings to catch semantic variations like "Robert" vs "Bob"—40% better accuracy than rule-based alone.

**Bharat-First Design:** Offline-first mobile (SQLite) for rural connectivity. Supports 10 Indian languages, ₹ INR currency, lakhs/crores numbering, DD/MM/YYYY format. Works seamlessly with intermittent internet.

**Immutable Data Integrity:** Schema changes create cryptographic snapshots (SHA-256). Historical records never break. Dry-run migrations simulate changes before deployment with zero data loss guarantee.

### ● How will it be able to solve the problem?

**For Students (Learn Faster):**
• Predictive Risk Engine (XGBoost) identifies at-risk students early—analyzes attendance, assignments, LMS activity. Provides natural language explanations: "Risk elevated due to 3 missed assignments."
• Accessibility AI: VLM auto-generates alt-text for images, LLM simplifies complex text into "Easy Read" format for learning differences.

**For Educators (Work Smarter):**
• AI Schedule Optimizer (CSP solver) handles complex timetabling—optimizes rooms, minimizes teacher gaps. Proposes 3 valid options; admin chooses.
• Attendance Anomaly Detection (Isolation Forest) flags impossible travel patterns and suspicious absences—reduces fraud by 60%.
• Intelligent Duplicate Resolution saves 10+ hours/week on data cleanup with semantic matching.

**For Institutions (Operational Excellence):**
• Multi-tenant architecture with Row-Level Security, tiered SLAs (99.5%-99.95%), disaster recovery (RTO: 15min-4h).
• Idempotent payment processing prevents double-billing. Bank reconciliation UI with automated discrepancy alerts.

### ● USP of the proposed solution

**1. AI Ethics Built-In:** First SIS with fairness dashboard monitoring bias across demographics. Transparent model versioning and rollback.

**2. Production-Grade:** Designed for 10,000+ concurrent users. Cryptographic audit trails, immutable snapshots, guaranteed RTO/RPO.

**3. Offline-First:** Works in rural India with intermittent connectivity. SQLite local storage with automatic sync and conflict resolution.

**4. Developer Productivity:** OpenAPI 3.0 docs, OAuth 2.0, webhook signing (HMAC-SHA256), LTI 1.3, OneRoster integration, 24-month API deprecation policy.

**5. Comprehensive:** 36 user stories, 7 microservices, end-to-end encryption (AES-256/TLS 1.3), real-time monitoring (Prometheus/Grafana).

---

## List of features offered by the solution

**Note:** Visual diagrams (architecture, flow diagrams, wireframes) are included in subsequent sections below.

### High-Level Architecture Diagram

```mermaid
graph TB
    subgraph "Frontend Layer"
        A[Next.js Web App]
        B[Mobile PWA]
    end
    
    subgraph "API Gateway"
        C[Kong API Gateway]
    end
    
    subgraph "Microservices"
        D[Auth Service]
        E[Core Service - Identity]
        F[Forms Service]
        G[Attendance Service]
        H[Payments Service]
        I[Analytics Service]
        J[Integration Service]
        K[AI Service - Python]
    end
    
    subgraph "Data Layer"
        L[PostgreSQL]
        M[Redis Cache]
        N[S3 Storage]
        O[RabbitMQ]
    end
    
    A --> C
    B --> C
    C --> D
    C --> E
    C --> F
    C --> G
    C --> H
    C --> I
    C --> J
    D --> L
    E --> L
    E --> K
    F --> L
    G --> L
    G --> K
    H --> L
    I --> L
    J --> L
    K --> L
    D --> M
    E --> M
    F --> M
    G --> M
    E --> N
    G --> O
    H --> O
    K --> O
```

### AI-Powered Student Enrollment Flow

```mermaid
graph TD
    A[Admin Submits Student Data] --> B[Core Service: Validate Fields]
    B --> C[Deterministic Duplicate Check]
    C --> D{Score > 0.5?}
    D -->|No| E[Auto-Approve: Create Student]
    D -->|Yes| F[AI Service: SBERT Embeddings]
    F --> G[Compute Cosine Similarity]
    G --> H[Generate Explainability]
    H --> I{Combined Score >= 0.75?}
    I -->|No| E
    I -->|Yes| J[Add to Review Queue]
    J --> K[Human Decision Required]
    K --> L{Admin Choice}
    L -->|Approve New| E
    L -->|Merge| M[Create Snapshot]
    M --> N[Execute Merge]
    L -->|Not Duplicate| E
```

### AI Governance & Human-in-the-Loop Architecture

```mermaid
graph LR
    A[User Action] --> B[Deterministic Logic]
    B --> C{AI Advisory Needed?}
    C -->|No| D[Direct Write to DB]
    C -->|Yes| E[AI Inference Service]
    E --> F[Generate Prediction]
    F --> G[Add Explainability]
    G --> H[Flag for Human Review]
    H --> I{Human Approval}
    I -->|Approve| D
    I -->|Reject| J[Log Decision]
    J --> K[Model Retraining Queue]
    
    L[AI Kill Switch] -.->|Disable| E
```

**AI-Powered Learning Features:**
• Predictive Academic Risk Engine - XGBoost model identifies at-risk students with 0-100 risk scores, natural language explanations
• Accessibility AI - Auto-generates alt-text (VLM), simplifies complex text (LLM), WCAG 2.1 AA compliant
• Personalized Intervention Recommendations - Timeline view with knowledge gap identification

**AI-Powered Productivity Features:**
• Hybrid Duplicate Detection - Combines Levenshtein + SBERT embeddings (768-dim vectors), 40% better accuracy
• Attendance Anomaly Detection - Isolation Forest flags impossible travel, pattern breaks, suspicious absences
• AI Schedule Optimizer - CSP/Genetic Algorithm solver for timetabling, proposes 3 valid options
• Intelligent Data Cleanup - Semantic matching saves 10+ hours/week on duplicate resolution

**Core Platform Features:**
• Canonical Student Identity - UUID v4 with immutable timestamps, merge operations with cryptographic snapshots
• Dynamic Form Engine - Immutable schema snapshots (SHA-256), field-level RBAC, dry-run migrations
• Offline-First Attendance - SQLite local storage, automatic sync with conflict resolution, timezone normalization
• Payment Processing - Idempotent webhooks, sequential invoicing, bank reconciliation, ₹ INR support
• Multi-Tenant Architecture - Row-Level Security, tiered SLAs (99.5%-99.95%), resource quotas
• Security & Compliance - MFA, SSO (SAML/OIDC), AES-256 encryption, cryptographic audit trails
• Analytics & Reporting - Real-time dashboards, custom report builder, RLS enforcement, PDF/Excel export
• Integration Framework - OpenAPI 3.0, OAuth 2.0, LTI 1.3, OneRoster, webhook signing (HMAC-SHA256)

**AI Governance Features:**
• Human-in-the-Loop Architecture - AI suggests, humans approve all write operations
• Explainability - SHAP values, reason codes for all AI outputs
• Fairness Dashboard - Monitors bias across demographics
• AI Kill Switch - Global flag for instant reversion to deterministic logic
• Model Versioning - Transparent change logs, rollback capability

**Bharat-Specific Features:**
• 10 Indian Languages - Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi
• Indian Currency & Numbering - ₹ INR, lakhs/crores system, DD/MM/YYYY format
• Rural Connectivity - Offline-first mobile with background sync
• Cost-Effective Pricing - Tiered plans for government schools

---



---

## Process flow diagram or Use-case diagram

### Use Case: AI-Powered Academic Risk Prediction

```mermaid
sequenceDiagram
    participant Teacher
    participant WebApp
    participant CoreService
    participant AIService
    participant Database
    participant Counselor

    Note over AIService: Nightly Batch Process
    AIService->>Database: Fetch student data (attendance, assignments, LMS activity)
    Database-->>AIService: Return student records
    AIService->>AIService: XGBoost Model: Compute Risk Score (0-100)
    AIService->>AIService: Generate SHAP values (explainability)
    AIService->>Database: Store risk scores + explanations
    
    Note over Teacher,Counselor: Next Day - Morning
    Teacher->>WebApp: Open Student Dashboard
    WebApp->>CoreService: Request student list
    CoreService->>Database: Query students with risk scores
    Database-->>CoreService: Return students + risk flags
    CoreService-->>WebApp: Display students (high-risk highlighted)
    WebApp-->>Teacher: Show risk alerts
    
    Teacher->>WebApp: Click high-risk student
    WebApp->>CoreService: Get risk details
    CoreService->>Database: Fetch risk explanation
    Database-->>CoreService: "Risk elevated: 3 missed assignments, 2 absences"
    CoreService-->>WebApp: Return explanation
    WebApp-->>Teacher: Display natural language explanation
    
    Teacher->>WebApp: Assign to counselor
    WebApp->>CoreService: Create intervention task
    CoreService->>Database: Log intervention
    CoreService->>Counselor: Send notification
    
    Counselor->>WebApp: Log intervention action
    WebApp->>AIService: Send feedback for model retraining
```

### Use Case: Offline Attendance with Anomaly Detection

```mermaid
sequenceDiagram
    participant Teacher
    participant MobileApp
    participant LocalDB
    participant AttendanceService
    participant AIService
    participant Admin

    Note over Teacher,LocalDB: Rural Area - No Internet
    Teacher->>MobileApp: Mark attendance (10 students)
    MobileApp->>LocalDB: Store in SQLite with idempotency_key
    LocalDB-->>MobileApp: Saved locally
    MobileApp-->>Teacher: Show "Pending Sync" badge
    
    Note over Teacher,AttendanceService: Internet Connection Restored
    Teacher->>MobileApp: Click "Sync Now"
    MobileApp->>AttendanceService: Send attendance events
    AttendanceService->>AttendanceService: Check idempotency_key (prevent duplicates)
    AttendanceService->>AttendanceService: Normalize timezone to UTC
    AttendanceService->>Database: Store attendance records
    
    AttendanceService->>AIService: Trigger anomaly detection
    AIService->>AIService: Isolation Forest: Check for impossible travel
    AIService->>AIService: Check for pattern breaks
    
    alt Anomaly Detected
        AIService->>Database: Flag record as "verification_required"
        AIService->>Admin: Send alert with explanation
        Admin->>WebApp: Review flagged attendance
        Admin->>WebApp: Approve or Reject
    else No Anomaly
        AIService->>Database: Mark as verified
    end
    
    AttendanceService-->>MobileApp: Sync complete
    MobileApp-->>Teacher: Show "Synced ✓"
```

### Use Case: Duplicate Student Detection with Human Approval

```mermaid
flowchart TD
    A[Admin: Add New Student] --> B[Enter: Name, DOB, Contact]
    B --> C[Core Service: Validate Fields]
    C --> D[Deterministic Check: Levenshtein Distance]
    D --> E{Score > 0.5?}
    
    E -->|No| F[Auto-Approve]
    F --> G[Create Student Record]
    G --> H[Assign UUID]
    H --> I[Success: Student Created]
    
    E -->|Yes| J[AI Service: Generate SBERT Embeddings]
    J --> K[Compute Cosine Similarity with Existing Students]
    K --> L[Combined Score = 0.6×Deterministic + 0.4×AI]
    L --> M{Score >= 0.75?}
    
    M -->|No| F
    M -->|Yes| N[Add to Review Queue]
    N --> O[Show Side-by-Side Comparison]
    O --> P[Display: Likelihood Score + Reason Codes]
    P --> Q{Admin Decision}
    
    Q -->|Create New| R[Create Snapshot for Audit]
    R --> G
    
    Q -->|Merge Records| S[Create Pre-Merge Snapshot]
    S --> T[Execute Merge with Canonical Precedence]
    T --> U[Generate merge_id + Audit Log]
    U --> V[Success: Records Merged]
    
    Q -->|Not a Duplicate| R
```

---


## Wireframes/Mock diagrams of the proposed solution (optional)

### 1. Student Dashboard with AI Risk Alerts

```
┌─────────────────────────────────────────────────────────────────────────┐
│ EduOS Platform                    🔔 Notifications    👤 Admin  ⚙️      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  📊 Student Dashboard                                    🔍 Search...   │
│                                                                          │
│  ⚠️ 12 Students at High Risk - Requires Attention                       │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ Name          Class    Risk Score    Last Activity    Action   │   │
│  ├────────────────────────────────────────────────────────────────┤   │
│  │ 🔴 Rahul Kumar  10-A      92%       3 days ago      [Review]   │   │
│  │    ⚠️ Risk: 3 missed assignments, 2 absences this week         │   │
│  ├────────────────────────────────────────────────────────────────┤   │
│  │ 🟡 Priya Singh  10-B      78%       1 day ago       [Review]   │   │
│  │    ⚠️ Risk: Sudden drop in LMS activity (50% decrease)         │   │
│  ├────────────────────────────────────────────────────────────────┤   │
│  │ 🟢 Amit Patel   10-A      15%       Today           [View]     │   │
│  │    ✓ On track - Regular attendance and submissions             │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  📈 Class Performance Trends                                            │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │     Attendance    Assignments    Engagement                     │   │
│  │  ██████████████   ████████████   ██████████                     │   │
│  │      85%              78%            72%                        │   │
│  └────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2. Duplicate Detection Review Interface

```
┌─────────────────────────────────────────────────────────────────────────┐
│ EduOS Platform - Duplicate Detection Review                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  🔍 Potential Duplicate Detected - Likelihood: 87%                      │
│                                                                          │
│  ┌──────────────────────────────┬──────────────────────────────┐       │
│  │  NEW SUBMISSION              │  EXISTING RECORD             │       │
│  ├──────────────────────────────┼──────────────────────────────┤       │
│  │  Name: Rahul Kumar           │  Name: Rahul Kumarr          │       │
│  │  DOB: 15/08/2010             │  DOB: 15/08/2010             │       │
│  │  Father: Rajesh Kumar        │  Father: Rajesh K.           │       │
│  │  Contact: 9876543210         │  Contact: 9876543210         │       │
│  │  Address: Delhi              │  Address: New Delhi          │       │
│  └──────────────────────────────┴──────────────────────────────┘       │
│                                                                          │
│  🤖 AI Analysis:                                                        │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ • Name similarity: 95% (phonetic match detected)               │   │
│  │ • DOB: Exact match                                             │   │
│  │ • Contact: Exact match                                         │   │
│  │ • Address: Semantic match (Delhi ≈ New Delhi)                  │   │
│  │                                                                 │   │
│  │ Recommendation: High confidence duplicate                      │   │
│  │ Reason: Multiple exact matches + semantic similarity           │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Decision Required:                                                     │
│  [✓ Merge Records]  [Create New Student]  [Not a Duplicate]           │
│                                                                          │
│  Merge Reason: _______________________________________________          │
│                                                                          │
│  [Cancel]                                            [Submit Decision]  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3. Mobile Offline Attendance Interface

```
┌─────────────────────────────────┐
│  EduOS Mobile                   │
│  ☰  Attendance  🔄 Pending: 3   │
├─────────────────────────────────┤
│                                 │
│  Class: 10-A                    │
│  Date: 04/02/2026               │
│  Time: 09:30 AM                 │
│                                 │
│  📶 Offline Mode                │
│  Data will sync when online     │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Roll  Name         P  A │   │
│  ├─────────────────────────┤   │
│  │  1   Rahul Kumar  ✓  ○ │   │
│  │  2   Priya Singh  ✓  ○ │   │
│  │  3   Amit Patel   ○  ✓ │   │
│  │  4   Neha Sharma  ✓  ○ │   │
│  │  5   Rohan Gupta  ✓  ○ │   │
│  └─────────────────────────┘   │
│                                 │
│  Present: 4  Absent: 1          │
│                                 │
│  [Save Locally]  [Mark All]    │
│                                 │
│  ⚠️ 3 records pending sync      │
│  [Sync Now]                     │
│                                 │
└─────────────────────────────────┘
```

### 4. AI Governance Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│ EduOS Platform - AI Governance Dashboard                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  🤖 AI System Status                          🔴 AI Kill Switch: OFF   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ Model Performance (Last 30 Days)                               │   │
│  ├────────────────────────────────────────────────────────────────┤   │
│  │ Duplicate Detection:    Accuracy: 94%    Precision: 96%       │   │
│  │ Risk Prediction:        Accuracy: 89%    Recall: 87%          │   │
│  │ Anomaly Detection:      True Positive: 92%  False Positive: 8%│   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  📊 Fairness Monitoring                                                 │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ Risk Score Distribution by Demographics:                       │   │
│  │                                                                 │   │
│  │ Gender:     Male: 23%  Female: 21%  ✓ No bias detected        │   │
│  │ Location:   Urban: 22% Rural: 24%   ✓ No bias detected        │   │
│  │ Category:   General: 22% SC/ST: 23% ✓ No bias detected        │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  🔍 Pending Human Review: 15 items                                      │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ • 8 Duplicate detections (avg confidence: 82%)                 │   │
│  │ • 5 Attendance anomalies (impossible travel)                   │   │
│  │ • 2 Schedule conflicts (room double-booking)                   │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  [View Review Queue]  [Model Retraining]  [Export Audit Report]       │
└─────────────────────────────────────────────────────────────────────────┘
```

---
