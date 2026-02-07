"""
AI Kill Switch Tests

Task 3.4.3: Create AI Kill Switch mechanism
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone
import json

from main import app
from governance import governance_manager
from models import AIKillSwitchStatus, AIKillSwitchToggle, RecommendationType


client = TestClient(app)


class TestKillSwitchAPI:
    """Test AI Kill Switch API endpoints"""
    
    def setup_method(self):
        """Reset kill switch before each test"""
        governance_manager.kill_switch_status = AIKillSwitchStatus(enabled=True)
        governance_manager.audit_logs = []
    
    def test_get_kill_switch_status_enabled(self):
        """Test getting kill switch status when enabled"""
        response = client.get("/api/v1/kill-switch")
        
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is True
        assert data["disabled_at"] is None
        assert data["disabled_by"] is None
        assert data["reason"] is None
    
    def test_get_kill_switch_status_disabled(self):
        """Test getting kill switch status when disabled"""
        # Disable AI
        governance_manager.kill_switch_status.enabled = False
        governance_manager.kill_switch_status.disabled_at = datetime.now(timezone.utc)
        governance_manager.kill_switch_status.disabled_by = "superadmin_001"
        governance_manager.kill_switch_status.reason = "Security incident"
        
        response = client.get("/api/v1/kill-switch")
        
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is False
        assert data["disabled_by"] == "superadmin_001"
        assert data["reason"] == "Security incident"
        assert data["disabled_at"] is not None
    
    def test_toggle_kill_switch_disable(self):
        """Test disabling AI services via kill switch"""
        toggle_request = {
            "enable": False,
            "reason": "Security incident - disabling AI pending investigation",
            "toggled_by": "superadmin_001"
        }
        
        response = client.post("/api/v1/kill-switch", json=toggle_request)
        
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is False
        assert data["disabled_by"] == "superadmin_001"
        assert data["reason"] == toggle_request["reason"]
        assert data["disabled_at"] is not None
        
        # Verify kill switch is actually disabled
        assert governance_manager.kill_switch_status.enabled is False
    
    def test_toggle_kill_switch_enable(self):
        """Test enabling AI services via kill switch"""
        # First disable
        governance_manager.kill_switch_status.enabled = False
        governance_manager.kill_switch_status.disabled_by = "superadmin_001"
        
        # Then enable
        toggle_request = {
            "enable": True,
            "reason": "Security issue resolved - re-enabling AI",
            "toggled_by": "superadmin_001"
        }
        
        response = client.post("/api/v1/kill-switch", json=toggle_request)
        
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is True
        assert data["disabled_at"] is None
        assert data["disabled_by"] is None
        assert data["reason"] is None
        
        # Verify kill switch is actually enabled
        assert governance_manager.kill_switch_status.enabled is True
    
    def test_toggle_kill_switch_creates_audit_log(self):
        """Test that toggling kill switch creates audit log entry"""
        toggle_request = {
            "enable": False,
            "reason": "Testing audit log",
            "toggled_by": "superadmin_001"
        }
        
        initial_log_count = len(governance_manager.audit_logs)
        
        response = client.post("/api/v1/kill-switch", json=toggle_request)
        
        assert response.status_code == 200
        
        # Check audit log was created
        assert len(governance_manager.audit_logs) == initial_log_count + 1
        
        latest_log = governance_manager.audit_logs[-1]
        assert latest_log.recommendation_id == "kill_switch"
        assert latest_log.decided_by == "superadmin_001"
        assert latest_log.metadata["kill_switch_event"] is True
        assert latest_log.metadata["action"] == "disable"
        assert latest_log.metadata["reason"] == toggle_request["reason"]
    
    def test_ai_requests_blocked_when_disabled(self):
        """Test that AI requests are blocked when kill switch is disabled"""
        # Disable AI
        toggle_request = {
            "enable": False,
            "reason": "Testing request blocking",
            "toggled_by": "superadmin_001"
        }
        client.post("/api/v1/kill-switch", json=toggle_request)
        
        # Try to make a semantic matching request
        match_request = {
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
        
        response = client.post("/api/v1/semantic/find-duplicates", json=match_request)
        
        # Should be blocked with 503
        assert response.status_code == 503
        assert "AI services are currently disabled" in response.json()["detail"]
    
    def test_ai_requests_allowed_when_enabled(self):
        """Test that AI requests work when kill switch is enabled"""
        # Ensure AI is enabled
        governance_manager.kill_switch_status.enabled = True
        
        # Try to make a semantic matching request
        match_request = {
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
        
        response = client.post("/api/v1/semantic/find-duplicates", json=match_request)
        
        # Should succeed (200) or fail for other reasons, but not 503
        assert response.status_code != 503


class TestGovernanceManagerKillSwitch:
    """Test GovernanceManager kill switch functionality"""
    
    def setup_method(self):
        """Reset kill switch before each test"""
        governance_manager.kill_switch_status = AIKillSwitchStatus(enabled=True)
        governance_manager.audit_logs = []
    
    def test_check_kill_switch_when_enabled(self):
        """Test check_kill_switch passes when enabled"""
        governance_manager.kill_switch_status.enabled = True
        
        # Should not raise exception
        result = governance_manager.check_kill_switch()
        assert result is True
    
    def test_check_kill_switch_when_disabled(self):
        """Test check_kill_switch raises exception when disabled"""
        governance_manager.kill_switch_status.enabled = False
        governance_manager.kill_switch_status.disabled_by = "superadmin_001"
        governance_manager.kill_switch_status.reason = "Testing"
        
        # Should raise HTTPException
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            governance_manager.check_kill_switch()
        
        assert exc_info.value.status_code == 503
        assert "AI services are currently disabled" in str(exc_info.value.detail)
    
    def test_toggle_kill_switch_disable(self):
        """Test toggling kill switch to disabled"""
        toggle_request = AIKillSwitchToggle(
            enable=False,
            reason="Security incident",
            toggled_by="superadmin_001"
        )
        
        status = governance_manager.toggle_kill_switch(toggle_request)
        
        assert status.enabled is False
        assert status.disabled_by == "superadmin_001"
        assert status.reason == "Security incident"
        assert status.disabled_at is not None
    
    def test_toggle_kill_switch_enable(self):
        """Test toggling kill switch to enabled"""
        # First disable
        governance_manager.kill_switch_status.enabled = False
        governance_manager.kill_switch_status.disabled_by = "superadmin_001"
        governance_manager.kill_switch_status.reason = "Test"
        
        # Then enable
        toggle_request = AIKillSwitchToggle(
            enable=True,
            reason="Issue resolved",
            toggled_by="superadmin_001"
        )
        
        status = governance_manager.toggle_kill_switch(toggle_request)
        
        assert status.enabled is True
        assert status.disabled_at is None
        assert status.disabled_by is None
        assert status.reason is None
    
    def test_toggle_creates_audit_log(self):
        """Test that toggle creates audit log entry"""
        initial_count = len(governance_manager.audit_logs)
        
        toggle_request = AIKillSwitchToggle(
            enable=False,
            reason="Testing audit",
            toggled_by="superadmin_001"
        )
        
        governance_manager.toggle_kill_switch(toggle_request)
        
        assert len(governance_manager.audit_logs) == initial_count + 1
        
        log = governance_manager.audit_logs[-1]
        assert log.recommendation_id == "kill_switch"
        assert log.decided_by == "superadmin_001"
        assert log.metadata["kill_switch_event"] is True
    
    def test_get_kill_switch_status(self):
        """Test getting kill switch status"""
        status = governance_manager.get_kill_switch_status()
        
        assert isinstance(status, AIKillSwitchStatus)
        assert status.enabled is True


class TestKillSwitchIntegration:
    """Integration tests for kill switch with other AI features"""
    
    def setup_method(self):
        """Reset kill switch before each test"""
        governance_manager.kill_switch_status = AIKillSwitchStatus(enabled=True)
        governance_manager.recommendations = {}
        governance_manager.audit_logs = []
    
    def test_create_recommendation_blocked_when_disabled(self):
        """Test that creating recommendations is blocked when kill switch is disabled"""
        # Disable AI
        toggle_request = AIKillSwitchToggle(
            enable=False,
            reason="Testing",
            toggled_by="superadmin_001"
        )
        governance_manager.toggle_kill_switch(toggle_request)
        
        # Try to create recommendation
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            governance_manager.create_recommendation(
                recommendation_type=RecommendationType.DUPLICATE_DETECTION,
                recommendation_text="Test recommendation",
                confidence_score=0.85,
                reason_codes=["test"],
                model_version="v1.0.0"
            )
        
        assert exc_info.value.status_code == 503
    
    def test_create_recommendation_allowed_when_enabled(self):
        """Test that creating recommendations works when kill switch is enabled"""
        governance_manager.kill_switch_status.enabled = True
        
        recommendation = governance_manager.create_recommendation(
            recommendation_type=RecommendationType.DUPLICATE_DETECTION,
            recommendation_text="Test recommendation",
            confidence_score=0.85,
            reason_codes=["test"],
            model_version="v1.0.0"
        )
        
        assert recommendation is not None
        assert recommendation.confidence_score == 0.85
    
    def test_audit_logs_include_kill_switch_events(self):
        """Test that audit logs include kill switch events"""
        # Toggle kill switch multiple times
        governance_manager.toggle_kill_switch(AIKillSwitchToggle(
            enable=False,
            reason="Test disable",
            toggled_by="superadmin_001"
        ))
        
        governance_manager.toggle_kill_switch(AIKillSwitchToggle(
            enable=True,
            reason="Test enable",
            toggled_by="superadmin_001"
        ))
        
        # Get audit logs
        logs = governance_manager.get_audit_logs(limit=10)
        
        # Should have 2 kill switch events
        kill_switch_logs = [log for log in logs if log.metadata.get("kill_switch_event")]
        assert len(kill_switch_logs) == 2
        
        # Check actions
        actions = [log.metadata["action"] for log in kill_switch_logs]
        assert "disable" in actions
        assert "enable" in actions


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
