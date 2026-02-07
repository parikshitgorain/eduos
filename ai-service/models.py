"""
Data models for AI Governance Framework
Pydantic models for request/response validation
"""

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from enum import Enum


class RecommendationType(str, Enum):
    """Types of AI recommendations"""
    DUPLICATE_DETECTION = "duplicate_detection"
    RISK_PREDICTION = "risk_prediction"
    ANOMALY_DETECTION = "anomaly_detection"
    SCHEDULE_OPTIMIZATION = "schedule_optimization"


class ApprovalStatus(str, Enum):
    """Status of approval requests"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    MORE_INFO_REQUESTED = "more_info_requested"


class ExplainabilityMetadata(BaseModel):
    """Explainability information for AI predictions"""
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "reason_codes": ["high_similarity", "matching_dob", "phonetic_match"],
            "shap_values": {"name_similarity": 0.45, "dob_match": 0.35, "address_similarity": 0.20},
            "feature_importance": {"name": 0.50, "dob": 0.30, "address": 0.20},
            "model_version": "duplicate-detection-v1.2.0"
        }
    })
    
    reason_codes: List[str] = Field(..., description="Human-readable reason codes")
    shap_values: Optional[Dict[str, float]] = Field(None, description="SHAP feature importance values")
    feature_importance: Optional[Dict[str, float]] = Field(None, description="Feature importance scores")
    model_version: str = Field(..., description="Version of the model used")


class AIRecommendation(BaseModel):
    """AI recommendation output with governance metadata"""
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "recommendation_id": "rec_abc123",
            "recommendation_type": "duplicate_detection",
            "recommendation": "Potential duplicate detected: Student A and Student B have 87% similarity",
            "confidence_score": 0.87,
            "explainability": {
                "reason_codes": ["high_similarity", "matching_dob"],
                "shap_values": {"name_similarity": 0.45, "dob_match": 0.42},
                "feature_importance": {"name": 0.52, "dob": 0.48},
                "model_version": "duplicate-detection-v1.2.0"
            },
            "requires_human_approval": True,
            "advisory_only": True,
            "timestamp": "2026-02-07T12:00:00Z"
        }
    })
    
    recommendation_id: str = Field(..., description="Unique identifier for this recommendation")
    recommendation_type: RecommendationType = Field(..., description="Type of recommendation")
    recommendation: str = Field(..., description="Human-readable recommendation text")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0.0 - 1.0)")
    explainability: ExplainabilityMetadata = Field(..., description="Explainability metadata")
    requires_human_approval: bool = Field(True, description="Whether human approval is required")
    advisory_only: bool = Field(True, description="Indicates this is advisory, not authoritative")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Timestamp of recommendation")
    
    @field_validator('confidence_score')
    @classmethod
    def validate_confidence(cls, v):
        if not 0.0 <= v <= 1.0:
            raise ValueError('Confidence score must be between 0.0 and 1.0')
        return v


class ApprovalRequest(BaseModel):
    """Request for human approval of AI recommendation"""
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "recommendation_id": "rec_abc123",
            "action": "approve",
            "reason": "Verified duplicate through manual review",
            "approved_by": "user_xyz789"
        }
    })
    
    recommendation_id: str = Field(..., description="ID of the recommendation to approve")
    action: Literal["approve", "reject", "request_more_info"] = Field(..., description="Approval action")
    reason: Optional[str] = Field(None, description="Reason for the decision")
    approved_by: str = Field(..., description="User ID of the approver")


class ApprovalResponse(BaseModel):
    """Response after approval action"""
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "approval_id": "appr_def456",
            "recommendation_id": "rec_abc123",
            "status": "approved",
            "approval_token": "tok_ghi789",
            "approved_by": "user_xyz789",
            "approved_at": "2026-02-07T12:05:00Z"
        }
    })
    
    approval_id: str = Field(..., description="Unique approval ID")
    recommendation_id: str = Field(..., description="ID of the recommendation")
    status: ApprovalStatus = Field(..., description="Approval status")
    approval_token: Optional[str] = Field(None, description="Token for executing approved action")
    approved_by: str = Field(..., description="User ID of the approver")
    approved_at: datetime = Field(default_factory=datetime.utcnow, description="Approval timestamp")


class AuditLogEntry(BaseModel):
    """Audit log entry for AI predictions and decisions"""
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "log_id": "log_jkl012",
            "recommendation_id": "rec_abc123",
            "recommendation_type": "duplicate_detection",
            "confidence_score": 0.87,
            "human_decision": "approved",
            "decided_by": "user_xyz789",
            "timestamp": "2026-02-07T12:05:00Z",
            "metadata": {"tenant_id": "tenant_123", "entity_ids": ["student_1", "student_2"]}
        }
    })
    
    log_id: str = Field(..., description="Unique log entry ID")
    recommendation_id: str = Field(..., description="ID of the recommendation")
    recommendation_type: RecommendationType = Field(..., description="Type of recommendation")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    human_decision: Optional[ApprovalStatus] = Field(None, description="Human decision if applicable")
    decided_by: Optional[str] = Field(None, description="User who made the decision")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Log timestamp")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class AIKillSwitchStatus(BaseModel):
    """AI Kill Switch status"""
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "enabled": True,
            "disabled_at": None,
            "disabled_by": None,
            "reason": None
        }
    })
    
    enabled: bool = Field(..., description="Whether AI services are enabled")
    disabled_at: Optional[datetime] = Field(None, description="When AI was disabled")
    disabled_by: Optional[str] = Field(None, description="User who disabled AI")
    reason: Optional[str] = Field(None, description="Reason for disabling")


class AIKillSwitchToggle(BaseModel):
    """Request to toggle AI Kill Switch"""
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "enable": False,
            "reason": "Security incident - disabling AI pending investigation",
            "toggled_by": "superadmin_001"
        }
    })
    
    enable: bool = Field(..., description="True to enable AI, False to disable")
    reason: str = Field(..., description="Reason for toggling")
    toggled_by: str = Field(..., description="SuperAdmin user ID")
