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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
