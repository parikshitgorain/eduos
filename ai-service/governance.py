"""
AI Governance Framework
Handles confidence scoring, explainability, HITL approval, and audit logging
"""

import uuid
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import HTTPException, status
import logging

from models import (
    AIRecommendation,
    ApprovalRequest,
    ApprovalResponse,
    ApprovalStatus,
    AuditLogEntry,
    AIKillSwitchStatus,
    AIKillSwitchToggle,
    RecommendationType
)

logger = logging.getLogger(__name__)


class GovernanceManager:
    """
    Manages AI governance including:
    - Confidence scoring
    - Explainability metadata
    - Human-in-the-Loop (HITL) approval
    - Audit logging
    - AI Kill Switch
    """
    
    def __init__(self, redis_client=None):
        """
        Initialize governance manager
        
        Args:
            redis_client: Redis client for storing state (optional for now)
        """
        self.redis_client = redis_client
        # In-memory storage for demo (replace with Redis/DB in production)
        self.recommendations: Dict[str, AIRecommendation] = {}
        self.approvals: Dict[str, ApprovalResponse] = {}
        self.audit_logs: List[AuditLogEntry] = []
        self.kill_switch_status = AIKillSwitchStatus(enabled=True)
    
    def check_kill_switch(self) -> bool:
        """
        Check if AI services are enabled
        
        Returns:
            bool: True if AI is enabled, False if disabled
        
        Raises:
            HTTPException: If AI services are disabled
        """
        if not self.kill_switch_status.enabled:
            logger.warning("AI services are disabled via Kill Switch")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "error": "AI services are currently disabled",
                    "disabled_at": self.kill_switch_status.disabled_at.isoformat() if self.kill_switch_status.disabled_at else None,
                    "disabled_by": self.kill_switch_status.disabled_by,
                    "reason": self.kill_switch_status.reason,
                    "fallback": "System has reverted to deterministic logic only"
                }
            )
        return True
    
    def create_recommendation(
        self,
        recommendation_type: RecommendationType,
        recommendation_text: str,
        confidence_score: float,
        reason_codes: List[str],
        shap_values: Optional[Dict[str, float]] = None,
        feature_importance: Optional[Dict[str, float]] = None,
        model_version: str = "v1.0.0",
        requires_approval: bool = True
    ) -> AIRecommendation:
        """
        Create an AI recommendation with governance metadata
        
        Args:
            recommendation_type: Type of recommendation
            recommendation_text: Human-readable recommendation
            confidence_score: Confidence score (0.0 - 1.0)
            reason_codes: List of reason codes
            shap_values: SHAP feature importance values
            feature_importance: Feature importance scores
            model_version: Version of the model
            requires_approval: Whether human approval is required
        
        Returns:
            AIRecommendation: The created recommendation
        """
        # Check kill switch
        self.check_kill_switch()
        
        # Generate unique ID
        recommendation_id = f"rec_{uuid.uuid4().hex[:12]}"
        
        # Create explainability metadata
        from models import ExplainabilityMetadata
        explainability = ExplainabilityMetadata(
            reason_codes=reason_codes,
            shap_values=shap_values,
            feature_importance=feature_importance,
            model_version=model_version
        )
        
        # Create recommendation
        recommendation = AIRecommendation(
            recommendation_id=recommendation_id,
            recommendation_type=recommendation_type,
            recommendation=recommendation_text,
            confidence_score=confidence_score,
            explainability=explainability,
            requires_human_approval=requires_approval,
            advisory_only=True,
            timestamp=datetime.now(timezone.utc)
        )
        
        # Store recommendation
        self.recommendations[recommendation_id] = recommendation
        
        # Log to audit trail
        self._log_recommendation(recommendation)
        
        logger.info(f"Created recommendation {recommendation_id} with confidence {confidence_score}")
        
        return recommendation
    
    def approve_recommendation(
        self,
        approval_request: ApprovalRequest
    ) -> ApprovalResponse:
        """
        Process human approval of AI recommendation
        
        Args:
            approval_request: Approval request details
        
        Returns:
            ApprovalResponse: Approval response with token
        
        Raises:
            HTTPException: If recommendation not found
        """
        recommendation_id = approval_request.recommendation_id
        
        # Check if recommendation exists
        if recommendation_id not in self.recommendations:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recommendation {recommendation_id} not found"
            )
        
        recommendation = self.recommendations[recommendation_id]
        
        # Generate approval ID and token
        approval_id = f"appr_{uuid.uuid4().hex[:12]}"
        approval_token = None
        
        # Map action to status
        status_map = {
            "approve": ApprovalStatus.APPROVED,
            "reject": ApprovalStatus.REJECTED,
            "request_more_info": ApprovalStatus.MORE_INFO_REQUESTED
        }
        approval_status = status_map[approval_request.action]
        
        # Generate approval token only for approved actions
        if approval_status == ApprovalStatus.APPROVED:
            approval_token = f"tok_{uuid.uuid4().hex[:16]}"
        
        # Create approval response
        approval = ApprovalResponse(
            approval_id=approval_id,
            recommendation_id=recommendation_id,
            status=approval_status,
            approval_token=approval_token,
            approved_by=approval_request.approved_by,
            approved_at=datetime.now(timezone.utc)
        )
        
        # Store approval
        self.approvals[approval_id] = approval
        
        # Log to audit trail
        self._log_approval(recommendation, approval, approval_request.reason)
        
        logger.info(f"Processed approval {approval_id} for recommendation {recommendation_id}: {approval_status}")
        
        return approval
    
    def toggle_kill_switch(
        self,
        toggle_request: AIKillSwitchToggle
    ) -> AIKillSwitchStatus:
        """
        Toggle AI Kill Switch
        
        Args:
            toggle_request: Kill switch toggle request
        
        Returns:
            AIKillSwitchStatus: Updated kill switch status
        """
        # Update kill switch status
        self.kill_switch_status.enabled = toggle_request.enable
        
        if not toggle_request.enable:
            # AI is being disabled
            self.kill_switch_status.disabled_at = datetime.now(timezone.utc)
            self.kill_switch_status.disabled_by = toggle_request.toggled_by
            self.kill_switch_status.reason = toggle_request.reason
            logger.warning(f"AI Kill Switch ACTIVATED by {toggle_request.toggled_by}: {toggle_request.reason}")
        else:
            # AI is being enabled
            logger.info(f"AI Kill Switch DEACTIVATED by {toggle_request.toggled_by}")
        
        # Log to audit trail
        self._log_kill_switch_toggle(toggle_request)
        
        return self.kill_switch_status
    
    def get_kill_switch_status(self) -> AIKillSwitchStatus:
        """Get current AI Kill Switch status"""
        return self.kill_switch_status
    
    def get_recommendation(self, recommendation_id: str) -> Optional[AIRecommendation]:
        """Get recommendation by ID"""
        return self.recommendations.get(recommendation_id)
    
    def get_approval(self, approval_id: str) -> Optional[ApprovalResponse]:
        """Get approval by ID"""
        return self.approvals.get(approval_id)
    
    def get_audit_logs(
        self,
        limit: int = 100,
        recommendation_type: Optional[RecommendationType] = None
    ) -> List[AuditLogEntry]:
        """
        Get audit logs
        
        Args:
            limit: Maximum number of logs to return
            recommendation_type: Filter by recommendation type
        
        Returns:
            List of audit log entries
        """
        logs = self.audit_logs
        
        # Filter by type if specified
        if recommendation_type:
            logs = [log for log in logs if log.recommendation_type == recommendation_type]
        
        # Return most recent logs
        return sorted(logs, key=lambda x: x.timestamp, reverse=True)[:limit]
    
    def _log_recommendation(self, recommendation: AIRecommendation):
        """Log recommendation to audit trail"""
        log_entry = AuditLogEntry(
            log_id=f"log_{uuid.uuid4().hex[:12]}",
            recommendation_id=recommendation.recommendation_id,
            recommendation_type=recommendation.recommendation_type,
            confidence_score=recommendation.confidence_score,
            human_decision=None,
            decided_by=None,
            timestamp=datetime.now(timezone.utc),
            metadata={
                "reason_codes": recommendation.explainability.reason_codes,
                "model_version": recommendation.explainability.model_version
            }
        )
        self.audit_logs.append(log_entry)
    
    def _log_approval(
        self,
        recommendation: AIRecommendation,
        approval: ApprovalResponse,
        reason: Optional[str]
    ):
        """Log approval decision to audit trail"""
        log_entry = AuditLogEntry(
            log_id=f"log_{uuid.uuid4().hex[:12]}",
            recommendation_id=recommendation.recommendation_id,
            recommendation_type=recommendation.recommendation_type,
            confidence_score=recommendation.confidence_score,
            human_decision=approval.status,
            decided_by=approval.approved_by,
            timestamp=datetime.now(timezone.utc),
            metadata={
                "approval_id": approval.approval_id,
                "reason": reason,
                "approval_token": approval.approval_token
            }
        )
        self.audit_logs.append(log_entry)
    
    def _log_kill_switch_toggle(self, toggle_request: AIKillSwitchToggle):
        """Log kill switch toggle to audit trail"""
        log_entry = AuditLogEntry(
            log_id=f"log_{uuid.uuid4().hex[:12]}",
            recommendation_id="kill_switch",
            recommendation_type=RecommendationType.DUPLICATE_DETECTION,  # Placeholder
            confidence_score=1.0,
            human_decision=ApprovalStatus.APPROVED if toggle_request.enable else ApprovalStatus.REJECTED,
            decided_by=toggle_request.toggled_by,
            timestamp=datetime.now(timezone.utc),
            metadata={
                "action": "enable" if toggle_request.enable else "disable",
                "reason": toggle_request.reason,
                "kill_switch_event": True
            }
        )
        self.audit_logs.append(log_entry)


# Global governance manager instance
governance_manager = GovernanceManager()
