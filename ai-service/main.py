"""
EduOS AI Inference Service
FastAPI microservice for AI-powered advisory features
Isolated from System of Record - Advisory mode only
"""

from fastapi import FastAPI, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
import logging
from datetime import datetime, timezone

# Import governance framework
from models import (
    AIRecommendation,
    ApprovalRequest,
    ApprovalResponse,
    AIKillSwitchStatus,
    AIKillSwitchToggle,
    AuditLogEntry,
    RecommendationType
)
from governance import governance_manager

# Import semantic matching
from semantic_matching import get_semantic_matcher

# Import explainability dashboard
from explainability import get_explainability_dashboard

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Lifespan context manager for startup/shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("EduOS AI Inference Service starting up...")
    logger.info("Service is isolated from System of Record - Advisory mode only")
    logger.info("No direct database write access")
    
    # Initialize SBERT model on startup
    try:
        logger.info("Loading Sentence-BERT model...")
        semantic_matcher = get_semantic_matcher()
        logger.info(f"SBERT model loaded successfully: {semantic_matcher.model_name}")
        logger.info(f"Embedding dimension: {semantic_matcher.embedding_dimension}")
    except Exception as e:
        logger.error(f"Failed to load SBERT model: {str(e)}")
        logger.warning("Semantic matching features will be unavailable")
    
    yield
    # Shutdown
    logger.info("EduOS AI Inference Service shutting down...")


# Initialize FastAPI app
app = FastAPI(
    title="EduOS AI Inference Service",
    description="AI-powered advisory service for duplicate detection, risk scoring, and anomaly detection",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check models
class HealthResponse(BaseModel):
    status: str = Field(..., description="Service health status")
    timestamp: str = Field(..., description="Current server timestamp")
    version: str = Field(..., description="Service version")
    dependencies: Dict[str, str] = Field(..., description="Status of dependencies")


# Health check endpoint
@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Health check endpoint for service monitoring
    Returns service status and dependency health
    """
    try:
        # Check dependencies
        dependencies = {
            "scikit-learn": "available",
            "xgboost": "available",
            "sentence-transformers": "available"
        }
        
        # Try importing key dependencies
        try:
            import sklearn
            dependencies["scikit-learn"] = f"v{sklearn.__version__}"
        except ImportError:
            dependencies["scikit-learn"] = "unavailable"
            
        try:
            import xgboost
            dependencies["xgboost"] = f"v{xgboost.__version__}"
        except ImportError:
            dependencies["xgboost"] = "unavailable"
            
        try:
            import sentence_transformers
            dependencies["sentence-transformers"] = f"v{sentence_transformers.__version__}"
        except ImportError:
            dependencies["sentence-transformers"] = "unavailable"
        
        return HealthResponse(
            status="healthy",
            timestamp=datetime.now(timezone.utc).isoformat(),
            version="1.0.0",
            dependencies=dependencies
        )
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail="Service unhealthy")


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint with service information
    """
    return {
        "service": "EduOS AI Inference Service",
        "version": "1.0.0",
        "status": "running",
        "documentation": "/docs",
        "health": "/health"
    }


# ============================================================================
# GOVERNANCE ENDPOINTS
# ============================================================================

class RecommendationRequest(BaseModel):
    """Request to create an AI recommendation"""
    recommendation_type: RecommendationType
    recommendation_text: str
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    reason_codes: List[str]
    shap_values: Optional[Dict[str, float]] = None
    feature_importance: Optional[Dict[str, float]] = None
    model_version: str = "v1.0.0"


@app.post("/api/v1/recommendations", response_model=AIRecommendation, tags=["Governance"])
async def create_recommendation(request: RecommendationRequest):
    """
    Create an AI recommendation with governance metadata
    
    All AI outputs are tagged with:
    - Confidence scores (0.0 - 1.0)
    - Explainability metadata (SHAP values, reason codes)
    - Human-in-the-Loop (HITL) approval requirement
    - Advisory-only flag
    """
    try:
        recommendation = governance_manager.create_recommendation(
            recommendation_type=request.recommendation_type,
            recommendation_text=request.recommendation_text,
            confidence_score=request.confidence_score,
            reason_codes=request.reason_codes,
            shap_values=request.shap_values,
            feature_importance=request.feature_importance,
            model_version=request.model_version
        )
        return recommendation
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating recommendation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create recommendation: {str(e)}"
        )


@app.get("/api/v1/recommendations/{recommendation_id}", response_model=AIRecommendation, tags=["Governance"])
async def get_recommendation(recommendation_id: str):
    """
    Get a specific AI recommendation by ID
    """
    recommendation = governance_manager.get_recommendation(recommendation_id)
    if not recommendation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recommendation {recommendation_id} not found"
        )
    return recommendation


@app.post("/api/v1/approvals", response_model=ApprovalResponse, tags=["Governance"])
async def approve_recommendation(approval_request: ApprovalRequest):
    """
    Human-in-the-Loop (HITL) approval endpoint
    
    Allows humans to:
    - Approve AI recommendations (generates approval token)
    - Reject AI recommendations
    - Request more information
    
    Critical operations require human approval before execution.
    """
    try:
        approval = governance_manager.approve_recommendation(approval_request)
        return approval
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing approval: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process approval: {str(e)}"
        )


@app.get("/api/v1/approvals/{approval_id}", response_model=ApprovalResponse, tags=["Governance"])
async def get_approval(approval_id: str):
    """
    Get approval details by ID
    """
    approval = governance_manager.get_approval(approval_id)
    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Approval {approval_id} not found"
        )
    return approval


@app.get("/api/v1/kill-switch", response_model=AIKillSwitchStatus, tags=["Governance"])
async def get_kill_switch_status():
    """
    Get AI Kill Switch status
    
    SuperAdmin can check if AI services are enabled or disabled.
    """
    return governance_manager.get_kill_switch_status()


@app.post("/api/v1/kill-switch", response_model=AIKillSwitchStatus, tags=["Governance"])
async def toggle_kill_switch(toggle_request: AIKillSwitchToggle):
    """
    Toggle AI Kill Switch (SuperAdmin only)
    
    When disabled:
    - All AI inference requests are blocked
    - System reverts to deterministic logic only
    - All admins are notified
    - Event is logged to audit trail
    
    This is a critical safety mechanism for:
    - Security incidents
    - Model performance issues
    - Compliance requirements
    """
    try:
        status = governance_manager.toggle_kill_switch(toggle_request)
        return status
    except Exception as e:
        logger.error(f"Error toggling kill switch: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to toggle kill switch: {str(e)}"
        )


@app.get("/api/v1/audit-logs", response_model=List[AuditLogEntry], tags=["Governance"])
async def get_audit_logs(
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of logs to return"),
    recommendation_type: Optional[RecommendationType] = Query(None, description="Filter by recommendation type")
):
    """
    Get audit logs for AI predictions and human decisions
    
    Audit logs include:
    - All AI recommendations
    - Human approval decisions
    - Kill switch events
    - Confidence scores
    - Explainability metadata
    """
    try:
        logs = governance_manager.get_audit_logs(
            limit=limit,
            recommendation_type=recommendation_type
        )
        return logs
    except Exception as e:
        logger.error(f"Error retrieving audit logs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve audit logs: {str(e)}"
        )


# ============================================================================
# SEMANTIC MATCHING ENDPOINTS (Task 3.2.2)
# ============================================================================

class StudentProfile(BaseModel):
    """Student profile for semantic matching"""
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "student_id": "student_123",
            "first_name": "John",
            "last_name": "Doe",
            "date_of_birth": "2005-03-15",
            "email": "john.doe@example.com",
            "phone": "+1234567890"
        }
    })
    
    student_id: Optional[str] = None
    first_name: str
    last_name: str
    date_of_birth: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class SemanticMatchRequest(BaseModel):
    """Request for semantic duplicate detection"""
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "query_student": {
                "first_name": "John",
                "last_name": "Doe",
                "date_of_birth": "2005-03-15"
            },
            "candidate_students": [
                {
                    "student_id": "student_456",
                    "first_name": "Jon",
                    "last_name": "Doe",
                    "date_of_birth": "2005-03-15"
                }
            ],
            "threshold": 0.85
        }
    })
    
    query_student: StudentProfile
    candidate_students: List[StudentProfile]
    threshold: Optional[float] = Field(0.85, ge=0.0, le=1.0, description="Similarity threshold")


class SemanticMatchResult(BaseModel):
    """Result of semantic matching"""
    candidate_student: StudentProfile
    semantic_similarity: float = Field(..., ge=0.0, le=1.0)
    is_semantic_duplicate: bool
    threshold_used: float
    embedding_dimension: int
    model_version: str


class SemanticMatchResponse(BaseModel):
    """Response for semantic duplicate detection"""
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "matches": [
                {
                    "candidate_student": {
                        "student_id": "student_456",
                        "first_name": "Jon",
                        "last_name": "Doe",
                        "date_of_birth": "2005-03-15"
                    },
                    "semantic_similarity": 0.92,
                    "is_semantic_duplicate": True,
                    "threshold_used": 0.85,
                    "embedding_dimension": 384,
                    "model_version": "all-MiniLM-L6-v2"
                }
            ],
            "total_matches": 1,
            "query_student": {
                "first_name": "John",
                "last_name": "Doe",
                "date_of_birth": "2005-03-15"
            },
            "processing_time_ms": 45.2
        }
    })
    
    matches: List[SemanticMatchResult]
    total_matches: int
    query_student: StudentProfile
    processing_time_ms: float


class PairwiseSimilarityRequest(BaseModel):
    """Request for pairwise similarity calculation"""
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "student1": {
                "first_name": "John",
                "last_name": "Doe",
                "date_of_birth": "2005-03-15"
            },
            "student2": {
                "first_name": "Jon",
                "last_name": "Doe",
                "date_of_birth": "2005-03-15"
            }
        }
    })
    
    student1: StudentProfile
    student2: StudentProfile


class PairwiseSimilarityResponse(BaseModel):
    """Response for pairwise similarity"""
    semantic_similarity: float = Field(..., ge=0.0, le=1.0)
    is_semantic_duplicate: bool
    threshold: float
    embedding_dimension: int
    model_version: str
    student1_profile: str
    student2_profile: str
    processing_time_ms: float


class BatchProcessRequest(BaseModel):
    """Request for batch duplicate processing"""
    students: List[StudentProfile]
    threshold: Optional[float] = Field(0.85, ge=0.0, le=1.0)
    
    @field_validator('students')
    @classmethod
    def validate_students_count(cls, v):
        if len(v) > 1000:
            raise ValueError('Maximum 1000 students per batch')
        return v


class BatchProcessResult(BaseModel):
    """Result for a single student in batch processing"""
    student: StudentProfile
    duplicates: List[Dict[str, Any]]
    duplicate_count: int


class BatchProcessResponse(BaseModel):
    """Response for batch processing"""
    results: List[BatchProcessResult]
    total_students: int
    total_duplicates_found: int
    processing_time_ms: float
    embeddings_per_minute: float


@app.post("/api/v1/semantic/find-duplicates", response_model=SemanticMatchResponse, tags=["Semantic Matching"])
async def find_semantic_duplicates(request: SemanticMatchRequest):
    """
    Find semantic duplicates using Sentence-BERT embeddings
    
    Task 3.2.2: Integrate Sentence-BERT for semantic matching
    
    Features:
    - SBERT model: all-MiniLM-L6-v2 (384-dimensional embeddings)
    - Cosine similarity calculation between candidate pairs
    - Threshold: similarity > 0.85 flags semantic duplicates
    - Captures phonetic and contextual matches (e.g., "Robert" vs "Bob")
    
    This is an ADVISORY endpoint - results require human approval before merge.
    """
    try:
        start_time = datetime.now(timezone.utc)
        
        # Check AI Kill Switch
        kill_switch_status = governance_manager.get_kill_switch_status()
        if not kill_switch_status.enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI services are currently disabled via Kill Switch"
            )
        
        # Get semantic matcher
        semantic_matcher = get_semantic_matcher()
        
        # Convert Pydantic models to dicts
        query_student_dict = request.query_student.model_dump()
        candidate_students_dicts = [
            student.model_dump() for student in request.candidate_students
        ]
        
        # Find semantic duplicates
        matches = semantic_matcher.find_semantic_duplicates(
            query_student=query_student_dict,
            candidate_students=candidate_students_dicts,
            threshold=request.threshold
        )
        
        end_time = datetime.now(timezone.utc)
        processing_time_ms = (end_time - start_time).total_seconds() * 1000
        
        # Convert matches to response format
        match_results = []
        for match in matches:
            match_results.append(SemanticMatchResult(
                candidate_student=StudentProfile(**match['candidate_student']),
                semantic_similarity=match['semantic_similarity'],
                is_semantic_duplicate=match['is_semantic_duplicate'],
                threshold_used=match['threshold_used'],
                embedding_dimension=match['embedding_dimension'],
                model_version=match['model_version']
            ))
        
        return SemanticMatchResponse(
            matches=match_results,
            total_matches=len(match_results),
            query_student=request.query_student,
            processing_time_ms=processing_time_ms
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in semantic duplicate detection: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Semantic matching failed: {str(e)}"
        )


@app.post("/api/v1/semantic/pairwise-similarity", response_model=PairwiseSimilarityResponse, tags=["Semantic Matching"])
async def calculate_pairwise_similarity(request: PairwiseSimilarityRequest):
    """
    Calculate semantic similarity between two specific students
    
    Returns cosine similarity score and duplicate flag based on threshold (0.85)
    """
    try:
        start_time = datetime.now(timezone.utc)
        
        # Check AI Kill Switch
        kill_switch_status = governance_manager.get_kill_switch_status()
        if not kill_switch_status.enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI services are currently disabled via Kill Switch"
            )
        
        # Get semantic matcher
        semantic_matcher = get_semantic_matcher()
        
        # Convert Pydantic models to dicts
        student1_dict = request.student1.model_dump()
        student2_dict = request.student2.model_dump()
        
        # Calculate similarity
        result = semantic_matcher.calculate_pairwise_similarity(
            student1=student1_dict,
            student2=student2_dict
        )
        
        end_time = datetime.now(timezone.utc)
        processing_time_ms = (end_time - start_time).total_seconds() * 1000
        
        return PairwiseSimilarityResponse(
            semantic_similarity=result['semantic_similarity'],
            is_semantic_duplicate=result['is_semantic_duplicate'],
            threshold=result['threshold'],
            embedding_dimension=result['embedding_dimension'],
            model_version=result['model_version'],
            student1_profile=result['student1_profile'],
            student2_profile=result['student2_profile'],
            processing_time_ms=processing_time_ms
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in pairwise similarity calculation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pairwise similarity calculation failed: {str(e)}"
        )


@app.post("/api/v1/semantic/batch-process", response_model=BatchProcessResponse, tags=["Semantic Matching"])
async def batch_process_duplicates(request: BatchProcessRequest):
    """
    Batch process multiple students for duplicate detection
    
    Optimized for bulk operations:
    - Processes 1000+ embeddings per minute
    - Batch size limit: 1000 students
    - Generates embeddings for all students in one pass
    - Compares each student against all others
    
    Returns potential duplicates for each student in the batch.
    """
    try:
        start_time = datetime.now(timezone.utc)
        
        # Check AI Kill Switch
        kill_switch_status = governance_manager.get_kill_switch_status()
        if not kill_switch_status.enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI services are currently disabled via Kill Switch"
            )
        
        # Get semantic matcher
        semantic_matcher = get_semantic_matcher()
        
        # Convert Pydantic models to dicts
        students_dicts = [student.model_dump() for student in request.students]
        
        # Batch process
        results = semantic_matcher.batch_process_duplicates(
            students=students_dicts,
            threshold=request.threshold
        )
        
        end_time = datetime.now(timezone.utc)
        processing_time_ms = (end_time - start_time).total_seconds() * 1000
        processing_time_s = processing_time_ms / 1000
        embeddings_per_minute = (len(request.students) / processing_time_s) * 60 if processing_time_s > 0 else 0
        
        # Convert results to response format
        batch_results = []
        total_duplicates = 0
        
        for result in results:
            batch_results.append(BatchProcessResult(
                student=StudentProfile(**result['student']),
                duplicates=result['duplicates'],
                duplicate_count=result['duplicate_count']
            ))
            total_duplicates += result['duplicate_count']
        
        return BatchProcessResponse(
            results=batch_results,
            total_students=len(request.students),
            total_duplicates_found=total_duplicates,
            processing_time_ms=processing_time_ms,
            embeddings_per_minute=embeddings_per_minute
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch processing: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch processing failed: {str(e)}"
        )


# ============================================================================
# EXPLAINABILITY DASHBOARD ENDPOINTS (Task 3.4.2)
# ============================================================================

class DashboardRequest(BaseModel):
    """Request for dashboard data"""
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "model_name": "duplicate-detector",
            "time_range_days": 7
        }
    })
    
    model_name: str
    time_range_days: int = Field(7, ge=1, le=365, description="Number of days to analyze")


class AccuracyMetrics(BaseModel):
    """Model accuracy metrics"""
    model_name: str
    time_range_days: int
    total_predictions: int
    correct_predictions: Optional[int] = None
    accuracy: Optional[float] = None
    accuracy_percentage: Optional[float] = None
    message: Optional[str] = None


class ConfidenceDistribution(BaseModel):
    """Confidence score distribution"""
    model_name: str
    time_range_days: int
    total_predictions: int
    avg_confidence: Optional[float] = None
    median_confidence: Optional[float] = None
    min_confidence: Optional[float] = None
    max_confidence: Optional[float] = None
    distribution: List[Dict[str, Any]]
    message: Optional[str] = None


class BiasMetrics(BaseModel):
    """Bias and fairness metrics"""
    model_name: str
    time_range_days: int
    bias_detected: bool
    demographic_analysis: Optional[List[Dict[str, Any]]] = None
    total_predictions_analyzed: Optional[int] = None
    message: Optional[str] = None


class SHAPSummary(BaseModel):
    """SHAP values summary"""
    model_name: str
    time_range_days: int
    total_predictions_analyzed: Optional[int] = None
    top_features: Optional[List[Dict[str, Any]]] = None
    message: Optional[str] = None


class HistoricalTrends(BaseModel):
    """Historical performance trends"""
    model_name: str
    days: int
    interval_days: Optional[int] = None
    data_points: Optional[List[Dict[str, Any]]] = None
    message: Optional[str] = None


class DashboardSummary(BaseModel):
    """Complete dashboard summary"""
    model_name: str
    time_range_days: int
    generated_at: str
    accuracy_metrics: Dict[str, Any]
    confidence_distribution: Dict[str, Any]
    bias_metrics: Dict[str, Any]
    shap_summary: Dict[str, Any]
    historical_trends: Dict[str, Any]


@app.get("/api/v1/dashboard/accuracy/{model_name}", response_model=AccuracyMetrics, tags=["Explainability Dashboard"])
async def get_model_accuracy(
    model_name: str,
    time_range_days: int = Query(7, ge=1, le=365, description="Number of days to analyze")
):
    """
    Get model accuracy metrics
    
    Task 3.4.2: AI Explainability Dashboard
    
    Returns:
    - Total predictions
    - Correct predictions
    - Accuracy percentage
    - Time range analyzed
    """
    try:
        dashboard = get_explainability_dashboard()
        metrics = dashboard.get_model_accuracy(model_name, time_range_days)
        return AccuracyMetrics(**metrics)
    except Exception as e:
        logger.error(f"Error getting model accuracy: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get model accuracy: {str(e)}"
        )


@app.get("/api/v1/dashboard/confidence/{model_name}", response_model=ConfidenceDistribution, tags=["Explainability Dashboard"])
async def get_confidence_distribution(
    model_name: str,
    time_range_days: int = Query(7, ge=1, le=365, description="Number of days to analyze"),
    num_bins: int = Query(10, ge=5, le=20, description="Number of histogram bins")
):
    """
    Get confidence score distribution
    
    Task 3.4.2: AI Explainability Dashboard
    
    Returns:
    - Average confidence
    - Median confidence
    - Min/max confidence
    - Distribution histogram
    """
    try:
        dashboard = get_explainability_dashboard()
        distribution = dashboard.get_confidence_distribution(model_name, time_range_days, num_bins)
        return ConfidenceDistribution(**distribution)
    except Exception as e:
        logger.error(f"Error getting confidence distribution: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get confidence distribution: {str(e)}"
        )


@app.get("/api/v1/dashboard/bias/{model_name}", response_model=BiasMetrics, tags=["Explainability Dashboard"])
async def get_bias_metrics(
    model_name: str,
    time_range_days: int = Query(7, ge=1, le=365, description="Number of days to analyze")
):
    """
    Get bias and fairness metrics
    
    Task 3.4.2: AI Explainability Dashboard
    
    Tracks AI accuracy across demographics to detect algorithmic bias:
    - Accuracy by demographic group
    - Confidence by demographic group
    - Bias detection (accuracy variance > 10%)
    - Recommendations for bias mitigation
    
    Critical for compliance and ethical AI governance.
    """
    try:
        dashboard = get_explainability_dashboard()
        metrics = dashboard.get_bias_metrics(model_name, time_range_days)
        return BiasMetrics(**metrics)
    except Exception as e:
        logger.error(f"Error getting bias metrics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get bias metrics: {str(e)}"
        )


@app.get("/api/v1/dashboard/shap/{model_name}", response_model=SHAPSummary, tags=["Explainability Dashboard"])
async def get_shap_summary(
    model_name: str,
    time_range_days: int = Query(7, ge=1, le=365, description="Number of days to analyze"),
    top_n: int = Query(10, ge=1, le=50, description="Number of top features to return")
):
    """
    Get SHAP values summary (feature importance)
    
    Task 3.4.2: AI Explainability Dashboard
    
    SHAP (SHapley Additive exPlanations) values explain:
    - Which features contribute most to predictions
    - Average importance of each feature
    - Feature ranking by impact
    
    Essential for model interpretability and debugging.
    """
    try:
        dashboard = get_explainability_dashboard()
        summary = dashboard.get_shap_summary(model_name, time_range_days, top_n)
        return SHAPSummary(**summary)
    except Exception as e:
        logger.error(f"Error getting SHAP summary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get SHAP summary: {str(e)}"
        )


@app.get("/api/v1/dashboard/trends/{model_name}", response_model=HistoricalTrends, tags=["Explainability Dashboard"])
async def get_historical_trends(
    model_name: str,
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    interval_days: int = Query(1, ge=1, le=30, description="Interval for data points")
):
    """
    Get historical performance trends
    
    Task 3.4.2: AI Explainability Dashboard
    
    Returns time-series data showing:
    - Model accuracy over time
    - Confidence scores over time
    - Prediction volume over time
    
    Useful for detecting model degradation and performance issues.
    """
    try:
        dashboard = get_explainability_dashboard()
        trends = dashboard.get_historical_trends(model_name, days, interval_days)
        return HistoricalTrends(**trends)
    except Exception as e:
        logger.error(f"Error getting historical trends: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get historical trends: {str(e)}"
        )


@app.post("/api/v1/dashboard/summary", response_model=DashboardSummary, tags=["Explainability Dashboard"])
async def get_dashboard_summary(request: DashboardRequest):
    """
    Get comprehensive dashboard summary
    
    Task 3.4.2: AI Explainability Dashboard
    
    Returns complete dashboard data including:
    - Model accuracy metrics
    - Confidence distribution
    - Bias and fairness metrics
    - SHAP value summary
    - Historical trends
    
    This is the primary endpoint for the explainability dashboard UI.
    """
    try:
        dashboard = get_explainability_dashboard()
        summary = dashboard.generate_dashboard_summary(
            request.model_name,
            request.time_range_days
        )
        return DashboardSummary(**summary)
    except Exception as e:
        logger.error(f"Error generating dashboard summary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate dashboard summary: {str(e)}"
        )


@app.get("/api/v1/dashboard/export/{model_name}", tags=["Explainability Dashboard"])
async def export_dashboard_report(
    model_name: str,
    time_range_days: int = Query(7, ge=1, le=365, description="Number of days to analyze"),
    format: str = Query("json", pattern="^(json|summary)$", description="Export format")
):
    """
    Export dashboard report for compliance audits
    
    Task 3.4.2: AI Explainability Dashboard
    
    Formats:
    - json: Complete data in JSON format
    - summary: Human-readable summary with full data
    
    Exported reports include:
    - Model performance metrics
    - Bias analysis
    - SHAP values
    - Historical trends
    - Timestamp and report ID
    
    Essential for SOC 2, GDPR, and AI governance compliance.
    """
    try:
        dashboard = get_explainability_dashboard()
        report = dashboard.export_dashboard_report(
            model_name,
            time_range_days,
            format
        )
        return report
    except Exception as e:
        logger.error(f"Error exporting dashboard report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export dashboard report: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
