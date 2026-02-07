"""
Tests for AI Governance Framework
"""

import pytest
from fastapi.testclient import TestClient
from main import app
from models import RecommendationType, ApprovalStatus
from governance import governance_manager

client = TestClient(app)


# Reset governance manager before each test
@pytest.fixture(autouse=True)
def reset_governance():
    governance_manager.recommendations.clear()
    governance_manager.approvals.clear()
    governance_manager.audit_logs.clear()
    governance_manager.kill_switch_status.enabled = True
    governance_manager.kill_switch_status.disabled_at = None
    governance_manager.kill_switch_status.disabled_by = None
    governance_manager.kill_switch_status.reason = None


def test_create_recommendation():
    """Test creating an AI recommendation with governance metadata"""
    response = client.post(
        "/api/v1/recommendations",
        json={
            "recommendation_type": "duplicate_detection",
            "recommendation_text": "Potential duplicate detected",
            "confidence_score": 0.87,
            "reason_codes": ["high_similarity", "matching_dob"],
            "model_version": "v1.0.0"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # Verify governance metadata
    assert "recommendation_id" in data
    assert data["recommendation_type"] == "duplicate_detection"
    assert data["confidence_score"] == 0.87
    assert data["requires_human_approval"] is True
    assert data["advisory_only"] is True
    
    # Verify explainability
    assert "explainability" in data
    assert data["explainability"]["reason_codes"] == ["high_similarity", "matching_dob"]
    assert data["explainability"]["model_version"] == "v1.0.0"


def test_confidence_score_validation():
    """Test confidence score must be between 0.0 and 1.0"""
    # Test invalid confidence score > 1.0
    response = client.post(
        "/api/v1/recommendations",
        json={
            "recommendation_type": "duplicate_detection",
            "recommendation_text": "Test",
            "confidence_score": 1.5,
            "reason_codes": ["test"],
            "model_version": "v1.0.0"
        }
    )
    assert response.status_code == 422  # Validation error


def test_get_recommendation():
    """Test retrieving a recommendation by ID"""
    # Create recommendation
    create_response = client.post(
        "/api/v1/recommendations",
        json={
            "recommendation_type": "risk_prediction",
            "recommendation_text": "High risk student identified",
            "confidence_score": 0.92,
            "reason_codes": ["low_attendance", "missed_assignments"],
            "model_version": "v1.0.0"
        }
    )
    recommendation_id = create_response.json()["recommendation_id"]
    
    # Get recommendation
    response = client.get(f"/api/v1/recommendations/{recommendation_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["recommendation_id"] == recommendation_id
    assert data["confidence_score"] == 0.92


def test_get_nonexistent_recommendation():
    """Test getting a recommendation that doesn't exist"""
    response = client.get("/api/v1/recommendations/nonexistent_id")
    assert response.status_code == 404


def test_approve_recommendation():
    """Test human approval of AI recommendation"""
    # Create recommendation
    create_response = client.post(
        "/api/v1/recommendations",
        json={
            "recommendation_type": "duplicate_detection",
            "recommendation_text": "Merge recommended",
            "confidence_score": 0.95,
            "reason_codes": ["exact_match"],
            "model_version": "v1.0.0"
        }
    )
    recommendation_id = create_response.json()["recommendation_id"]
    
    # Approve recommendation
    approval_response = client.post(
        "/api/v1/approvals",
        json={
            "recommendation_id": recommendation_id,
            "action": "approve",
            "reason": "Verified through manual review",
            "approved_by": "user_123"
        }
    )
    
    assert approval_response.status_code == 200
    approval_data = approval_response.json()
    
    # Verify approval response
    assert "approval_id" in approval_data
    assert approval_data["recommendation_id"] == recommendation_id
    assert approval_data["status"] == "approved"
    assert "approval_token" in approval_data
    assert approval_data["approval_token"] is not None
    assert approval_data["approved_by"] == "user_123"


def test_reject_recommendation():
    """Test rejecting an AI recommendation"""
    # Create recommendation
    create_response = client.post(
        "/api/v1/recommendations",
        json={
            "recommendation_type": "duplicate_detection",
            "recommendation_text": "Potential duplicate",
            "confidence_score": 0.76,
            "reason_codes": ["similar_name"],
            "model_version": "v1.0.0"
        }
    )
    recommendation_id = create_response.json()["recommendation_id"]
    
    # Reject recommendation
    approval_response = client.post(
        "/api/v1/approvals",
        json={
            "recommendation_id": recommendation_id,
            "action": "reject",
            "reason": "Not a duplicate after manual review",
            "approved_by": "user_456"
        }
    )
    
    assert approval_response.status_code == 200
    approval_data = approval_response.json()
    assert approval_data["status"] == "rejected"
    assert approval_data["approval_token"] is None  # No token for rejected


def test_request_more_info():
    """Test requesting more information for a recommendation"""
    # Create recommendation
    create_response = client.post(
        "/api/v1/recommendations",
        json={
            "recommendation_type": "anomaly_detection",
            "recommendation_text": "Unusual attendance pattern",
            "confidence_score": 0.68,
            "reason_codes": ["pattern_break"],
            "model_version": "v1.0.0"
        }
    )
    recommendation_id = create_response.json()["recommendation_id"]
    
    # Request more info
    approval_response = client.post(
        "/api/v1/approvals",
        json={
            "recommendation_id": recommendation_id,
            "action": "request_more_info",
            "reason": "Need additional context",
            "approved_by": "user_789"
        }
    )
    
    assert approval_response.status_code == 200
    approval_data = approval_response.json()
    assert approval_data["status"] == "more_info_requested"


def test_approve_nonexistent_recommendation():
    """Test approving a recommendation that doesn't exist"""
    response = client.post(
        "/api/v1/approvals",
        json={
            "recommendation_id": "nonexistent_id",
            "action": "approve",
            "reason": "Test",
            "approved_by": "user_123"
        }
    )
    assert response.status_code == 404


def test_get_approval():
    """Test retrieving approval details"""
    # Create and approve recommendation
    create_response = client.post(
        "/api/v1/recommendations",
        json={
            "recommendation_type": "duplicate_detection",
            "recommendation_text": "Test",
            "confidence_score": 0.85,
            "reason_codes": ["test"],
            "model_version": "v1.0.0"
        }
    )
    recommendation_id = create_response.json()["recommendation_id"]
    
    approval_response = client.post(
        "/api/v1/approvals",
        json={
            "recommendation_id": recommendation_id,
            "action": "approve",
            "reason": "Test approval",
            "approved_by": "user_123"
        }
    )
    approval_id = approval_response.json()["approval_id"]
    
    # Get approval
    response = client.get(f"/api/v1/approvals/{approval_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["approval_id"] == approval_id


def test_kill_switch_status():
    """Test getting AI Kill Switch status"""
    response = client.get("/api/v1/kill-switch")
    assert response.status_code == 200
    data = response.json()
    assert "enabled" in data
    assert data["enabled"] is True


def test_disable_kill_switch():
    """Test disabling AI services via Kill Switch"""
    response = client.post(
        "/api/v1/kill-switch",
        json={
            "enable": False,
            "reason": "Security incident",
            "toggled_by": "superadmin_001"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["enabled"] is False
    assert data["disabled_by"] == "superadmin_001"
    assert data["reason"] == "Security incident"


def test_kill_switch_blocks_recommendations():
    """Test that Kill Switch blocks AI recommendations"""
    # Disable AI
    client.post(
        "/api/v1/kill-switch",
        json={
            "enable": False,
            "reason": "Testing",
            "toggled_by": "superadmin_001"
        }
    )
    
    # Try to create recommendation
    response = client.post(
        "/api/v1/recommendations",
        json={
            "recommendation_type": "duplicate_detection",
            "recommendation_text": "Test",
            "confidence_score": 0.85,
            "reason_codes": ["test"],
            "model_version": "v1.0.0"
        }
    )
    
    assert response.status_code == 503  # Service unavailable
    data = response.json()
    assert "AI services are currently disabled" in data["detail"]["error"]


def test_enable_kill_switch():
    """Test re-enabling AI services"""
    # Disable first
    client.post(
        "/api/v1/kill-switch",
        json={
            "enable": False,
            "reason": "Testing",
            "toggled_by": "superadmin_001"
        }
    )
    
    # Re-enable
    response = client.post(
        "/api/v1/kill-switch",
        json={
            "enable": True,
            "reason": "Issue resolved",
            "toggled_by": "superadmin_001"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["enabled"] is True


def test_audit_logs():
    """Test retrieving audit logs"""
    # Create some recommendations and approvals
    for i in range(3):
        create_response = client.post(
            "/api/v1/recommendations",
            json={
                "recommendation_type": "duplicate_detection",
                "recommendation_text": f"Test {i}",
                "confidence_score": 0.8 + (i * 0.05),
                "reason_codes": ["test"],
                "model_version": "v1.0.0"
            }
        )
        recommendation_id = create_response.json()["recommendation_id"]
        
        # Approve one
        if i == 0:
            client.post(
                "/api/v1/approvals",
                json={
                    "recommendation_id": recommendation_id,
                    "action": "approve",
                    "reason": "Test",
                    "approved_by": "user_123"
                }
            )
    
    # Get audit logs
    response = client.get("/api/v1/audit-logs")
    assert response.status_code == 200
    logs = response.json()
    
    # Should have logs for 3 recommendations + 1 approval = 4 entries
    assert len(logs) >= 4
    
    # Verify log structure
    assert "log_id" in logs[0]
    assert "recommendation_id" in logs[0]
    assert "confidence_score" in logs[0]
    assert "timestamp" in logs[0]


def test_audit_logs_with_filter():
    """Test filtering audit logs by recommendation type"""
    # Create different types of recommendations
    client.post(
        "/api/v1/recommendations",
        json={
            "recommendation_type": "duplicate_detection",
            "recommendation_text": "Duplicate",
            "confidence_score": 0.85,
            "reason_codes": ["test"],
            "model_version": "v1.0.0"
        }
    )
    
    client.post(
        "/api/v1/recommendations",
        json={
            "recommendation_type": "risk_prediction",
            "recommendation_text": "Risk",
            "confidence_score": 0.90,
            "reason_codes": ["test"],
            "model_version": "v1.0.0"
        }
    )
    
    # Filter by duplicate_detection
    response = client.get("/api/v1/audit-logs?recommendation_type=duplicate_detection")
    assert response.status_code == 200
    logs = response.json()
    
    # All logs should be duplicate_detection type
    for log in logs:
        assert log["recommendation_type"] == "duplicate_detection"


def test_audit_logs_limit():
    """Test limiting number of audit logs returned"""
    # Create multiple recommendations
    for i in range(10):
        client.post(
            "/api/v1/recommendations",
            json={
                "recommendation_type": "duplicate_detection",
                "recommendation_text": f"Test {i}",
                "confidence_score": 0.85,
                "reason_codes": ["test"],
                "model_version": "v1.0.0"
            }
        )
    
    # Get limited logs
    response = client.get("/api/v1/audit-logs?limit=5")
    assert response.status_code == 200
    logs = response.json()
    assert len(logs) == 5

