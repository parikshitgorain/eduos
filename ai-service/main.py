"""
EduOS AI Inference Service
FastAPI microservice for AI-powered advisory features
Isolated from System of Record - Advisory mode only
"""

from fastapi import FastAPI, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
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
    student_id: Optional[str] = None
    first_name: str
    last_name: str
    date_of_birth: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "student_id": "student_123",
                "first_name": "John",
                "last_name": "Doe",
                "date_of_birth": "2005-03-15",
                "email": "john.doe@example.com",
                "phone": "+1234567890"
            }
        }


class SemanticMatchRequest(BaseModel):
    """Request for semantic duplicate detection"""
    query_student: StudentProfile
    candidate_students: List[StudentProfile]
    threshold: Optional[float] = Field(0.85, ge=0.0, le=1.0, description="Similarity threshold")
    
    class Config:
        json_schema_extra = {
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
        }


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
    matches: List[SemanticMatchResult]
    total_matches: int
    query_student: StudentProfile
    processing_time_ms: float
    
    class Config:
        json_schema_extra = {
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
        }


class PairwiseSimilarityRequest(BaseModel):
    """Request for pairwise similarity calculation"""
    student1: StudentProfile
    student2: StudentProfile
    
    class Config:
        json_schema_extra = {
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
        }


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
    
    @validator('students')
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
