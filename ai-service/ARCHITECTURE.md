# AI Inference Service Architecture

## Overview

The EduOS AI Inference Service is a Python FastAPI microservice that provides AI-powered advisory capabilities for the EduOS platform. It operates in **advisory mode only** and is completely isolated from the System of Record.

## Core Principles

### 1. Isolation from System of Record

```
┌─────────────────────────────────────────┐
│     System of Record (Node.js/Go)      │
│                                         │
│  • Authoritative Data Source            │
│  • ACID Transactions                    │
│  • Direct Database Access               │
│  • Write Operations                     │
└──────────────┬──────────────────────────┘
               │
               │ HTTP API (Read-Only Requests)
               │ No Database Credentials
               ▼
┌─────────────────────────────────────────┐
│   AI Inference Service (Python)         │
│                                         │
│  • Advisory Recommendations Only        │
│  • No Database Write Access             │
│  • Stateless Operations                 │
│  • Confidence Scores + Explainability   │
└─────────────────────────────────────────┘
```

**Key Points:**
- No database credentials configured
- Cannot perform write operations
- All outputs are recommendations
- Requires human approval for actions

### 2. Human-in-the-Loop (HITL) Architecture

```
User Action → System of Record → AI Service → Advisory Output
                     ↓                              ↓
              Validation Check              Confidence Score
                     ↓                              ↓
              AI Advisory Request           Explainability Data
                     ↓                              ↓
              Review Queue ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                     ↓
              Human Decision
                     ↓
         ┌───────────┴───────────┐
         ▼                       ▼
    Approve                  Reject
         ↓                       ↓
    Execute Action         No Action
```

### 3. Advisory Output Format

All AI outputs follow this structure:

```json
{
  "recommendation": "...",
  "confidence_score": 0.85,
  "explainability": {
    "reason_codes": ["high_similarity", "matching_dob"],
    "shap_values": {...},
    "feature_importance": {...}
  },
  "requires_human_approval": true,
  "advisory_only": true
}
```

## Service Capabilities

### 1. Duplicate Student Detection
- **Method:** Semantic embeddings using Sentence-BERT
- **Output:** Similarity scores with explainability
- **Threshold:** > 0.85 for flagging
- **Human Decision:** Required for merge operations

### 2. Academic Risk Prediction
- **Method:** XGBoost or Logistic Regression
- **Features:** Attendance, assignment latency, LMS activity
- **Output:** Risk score (0-100) with reason codes
- **Human Decision:** Required for interventions

### 3. Attendance Anomaly Detection
- **Method:** Isolation Forest
- **Detects:** Impossible travel, pattern breaks
- **Output:** Anomaly flags with explanations
- **Human Decision:** Required for record rejection

### 4. Schedule Optimization
- **Method:** Constraint Satisfaction Problem (CSP)
- **Output:** 3 valid schedule options
- **Human Decision:** Admin must select and publish

## Technology Stack

### Core Framework
- **FastAPI:** Modern, fast web framework
- **Uvicorn:** ASGI server
- **Pydantic:** Data validation

### Machine Learning
- **scikit-learn:** Classical ML algorithms
- **XGBoost:** Gradient boosting
- **sentence-transformers:** Semantic embeddings
- **SHAP:** Model explainability

### Infrastructure
- **Docker:** Containerization
- **Python 3.11+:** Runtime environment

## API Design

### Health Check
```
GET /health
Response: 200 OK
{
  "status": "healthy",
  "timestamp": "2026-02-07T...",
  "version": "1.0.0",
  "dependencies": {
    "scikit-learn": "v1.4.0",
    "xgboost": "v2.0.3",
    "sentence-transformers": "v2.3.1"
  }
}
```

### OpenAPI Documentation
- **Swagger UI:** `/docs`
- **ReDoc:** `/redoc`
- **OpenAPI JSON:** `/openapi.json`

## Security & Governance

### 1. No Database Access
- Service has no database credentials
- Cannot read or write to System of Record
- Receives data via API requests only

### 2. Advisory Mode Only
- All outputs are recommendations
- No automatic execution of actions
- Human approval required for all operations

### 3. Explainability
- All predictions include confidence scores
- SHAP values for feature importance
- Natural language explanations

### 4. AI Kill Switch
- SuperAdmin can disable service globally
- System reverts to deterministic logic
- Graceful degradation

### 5. Audit Trail
- All AI requests logged
- Human decisions recorded
- Full traceability

## Deployment

### Docker Deployment
```bash
docker-compose up -d
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-service
  template:
    metadata:
      labels:
        app: ai-service
    spec:
      containers:
      - name: ai-service
        image: eduos-ai-service:1.0.0
        ports:
        - containerPort: 8000
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
```

## Monitoring

### Health Checks
- Endpoint: `/health`
- Interval: 30 seconds
- Timeout: 10 seconds

### Metrics
- Request latency
- Prediction accuracy
- Model performance
- Error rates

### Logging
- Structured JSON logs
- Request/response logging
- Error tracking
- Audit trail

## Future Enhancements

1. **Model Versioning:** Track and rollback models
2. **A/B Testing:** Compare model versions
3. **Batch Processing:** Async inference for large datasets
4. **Model Registry:** Centralized model management
5. **Feature Store:** Cached feature computations

## Compliance

### Data Privacy
- No PII stored in service
- Data received via API only
- No persistent storage

### GDPR/FERPA
- No data retention
- Stateless operations
- Audit logging

### Bias Monitoring
- Fairness dashboard
- Demographic accuracy tracking
- Regular bias audits
