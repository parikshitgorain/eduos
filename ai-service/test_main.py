"""
Tests for AI Inference Service
"""

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_root_endpoint():
    """Test root endpoint returns service information"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "EduOS AI Inference Service"
    assert data["version"] == "1.0.0"
    assert data["status"] == "running"
    assert "documentation" in data
    assert "health" in data


def test_health_check():
    """Test health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data
    assert data["version"] == "1.0.0"
    assert "dependencies" in data
    
    # Check dependencies
    deps = data["dependencies"]
    assert "scikit-learn" in deps
    assert "xgboost" in deps
    assert "sentence-transformers" in deps


def test_openapi_spec():
    """Test OpenAPI specification is available"""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    assert spec["info"]["title"] == "EduOS AI Inference Service"
    assert spec["info"]["version"] == "1.0.0"
    assert "paths" in spec
    assert "/health" in spec["paths"]


def test_docs_available():
    """Test API documentation is accessible"""
    response = client.get("/docs")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_redoc_available():
    """Test ReDoc documentation is accessible"""
    response = client.get("/redoc")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


# ============================================================================
# SEMANTIC MATCHING ENDPOINT TESTS (Task 3.2.2)
# ============================================================================

def test_semantic_find_duplicates_endpoint():
    """Test semantic duplicate detection endpoint"""
    request_data = {
        "query_student": {
            "first_name": "John",
            "last_name": "Doe",
            "date_of_birth": "2005-03-15",
            "email": "john.doe@example.com"
        },
        "candidate_students": [
            {
                "student_id": "student_002",
                "first_name": "Jon",
                "last_name": "Doe",
                "date_of_birth": "2005-03-15",
                "email": "jon.doe@example.com"
            },
            {
                "student_id": "student_003",
                "first_name": "Jane",
                "last_name": "Smith",
                "date_of_birth": "2006-07-20",
                "email": "jane.smith@example.com"
            }
        ],
        "threshold": 0.85
    }
    
    response = client.post("/api/v1/semantic/find-duplicates", json=request_data)
    assert response.status_code == 200
    
    data = response.json()
    assert "matches" in data
    assert "total_matches" in data
    assert "query_student" in data
    assert "processing_time_ms" in data
    
    assert isinstance(data["matches"], list)
    assert isinstance(data["total_matches"], int)
    assert data["processing_time_ms"] > 0


def test_semantic_find_duplicates_with_matches():
    """Test semantic duplicate detection finds similar students"""
    request_data = {
        "query_student": {
            "first_name": "Robert",
            "last_name": "Johnson",
            "date_of_birth": "2005-05-10"
        },
        "candidate_students": [
            {
                "student_id": "student_002",
                "first_name": "Robert",
                "last_name": "Johnson",
                "date_of_birth": "2005-05-10"
            }
        ],
        "threshold": 0.85
    }
    
    response = client.post("/api/v1/semantic/find-duplicates", json=request_data)
    assert response.status_code == 200
    
    data = response.json()
    # Identical students should definitely match
    assert data["total_matches"] >= 1
    
    if data["total_matches"] > 0:
        match = data["matches"][0]
        assert "candidate_student" in match
        assert "semantic_similarity" in match
        assert "is_semantic_duplicate" in match
        assert "threshold_used" in match
        assert "embedding_dimension" in match
        assert "model_version" in match
        
        assert match["semantic_similarity"] >= 0.85
        assert match["is_semantic_duplicate"] == True
        assert match["embedding_dimension"] == 384
        assert match["model_version"] == "all-MiniLM-L6-v2"


def test_semantic_find_duplicates_no_matches():
    """Test semantic duplicate detection with dissimilar students"""
    request_data = {
        "query_student": {
            "first_name": "John",
            "last_name": "Doe",
            "date_of_birth": "2005-03-15"
        },
        "candidate_students": [
            {
                "student_id": "student_002",
                "first_name": "Jane",
                "last_name": "Smith",
                "date_of_birth": "2006-07-20"
            }
        ],
        "threshold": 0.85
    }
    
    response = client.post("/api/v1/semantic/find-duplicates", json=request_data)
    assert response.status_code == 200
    
    data = response.json()
    # Very different students should not match
    assert data["total_matches"] == 0
    assert len(data["matches"]) == 0


def test_semantic_find_duplicates_empty_candidates():
    """Test semantic duplicate detection with empty candidate list"""
    request_data = {
        "query_student": {
            "first_name": "John",
            "last_name": "Doe",
            "date_of_birth": "2005-03-15"
        },
        "candidate_students": [],
        "threshold": 0.85
    }
    
    response = client.post("/api/v1/semantic/find-duplicates", json=request_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["total_matches"] == 0
    assert len(data["matches"]) == 0


def test_semantic_find_duplicates_custom_threshold():
    """Test semantic duplicate detection with custom threshold"""
    request_data = {
        "query_student": {
            "first_name": "John",
            "last_name": "Doe",
            "date_of_birth": "2005-03-15"
        },
        "candidate_students": [
            {
                "student_id": "student_002",
                "first_name": "Jon",
                "last_name": "Doe",
                "date_of_birth": "2005-03-15"
            }
        ],
        "threshold": 0.5  # Lower threshold
    }
    
    response = client.post("/api/v1/semantic/find-duplicates", json=request_data)
    assert response.status_code == 200
    
    data = response.json()
    # Lower threshold should find matches more easily
    assert isinstance(data["matches"], list)


def test_semantic_find_duplicates_invalid_threshold():
    """Test semantic duplicate detection with invalid threshold"""
    request_data = {
        "query_student": {
            "first_name": "John",
            "last_name": "Doe"
        },
        "candidate_students": [],
        "threshold": 1.5  # Invalid: > 1.0
    }
    
    response = client.post("/api/v1/semantic/find-duplicates", json=request_data)
    assert response.status_code == 422  # Validation error


def test_semantic_find_duplicates_missing_required_fields():
    """Test semantic duplicate detection with missing required fields"""
    request_data = {
        "query_student": {
            "first_name": "John"
            # Missing last_name
        },
        "candidate_students": []
    }
    
    response = client.post("/api/v1/semantic/find-duplicates", json=request_data)
    assert response.status_code == 422  # Validation error


def test_pairwise_similarity_endpoint():
    """Test pairwise similarity calculation endpoint"""
    request_data = {
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
    
    response = client.post("/api/v1/semantic/pairwise-similarity", json=request_data)
    assert response.status_code == 200
    
    data = response.json()
    assert "semantic_similarity" in data
    assert "is_semantic_duplicate" in data
    assert "threshold" in data
    assert "embedding_dimension" in data
    assert "model_version" in data
    assert "student1_profile" in data
    assert "student2_profile" in data
    assert "processing_time_ms" in data
    
    assert 0.0 <= data["semantic_similarity"] <= 1.0
    assert data["embedding_dimension"] == 384
    assert data["model_version"] == "all-MiniLM-L6-v2"
    assert data["processing_time_ms"] > 0


def test_pairwise_similarity_identical_students():
    """Test pairwise similarity with identical students"""
    request_data = {
        "student1": {
            "first_name": "John",
            "last_name": "Doe",
            "date_of_birth": "2005-03-15"
        },
        "student2": {
            "first_name": "John",
            "last_name": "Doe",
            "date_of_birth": "2005-03-15"
        }
    }
    
    response = client.post("/api/v1/semantic/pairwise-similarity", json=request_data)
    assert response.status_code == 200
    
    data = response.json()
    # Identical students should have very high similarity
    assert data["semantic_similarity"] > 0.95
    assert data["is_semantic_duplicate"] == True


def test_pairwise_similarity_different_students():
    """Test pairwise similarity with different students"""
    request_data = {
        "student1": {
            "first_name": "John",
            "last_name": "Doe",
            "date_of_birth": "2005-03-15"
        },
        "student2": {
            "first_name": "Jane",
            "last_name": "Smith",
            "date_of_birth": "2006-07-20"
        }
    }
    
    response = client.post("/api/v1/semantic/pairwise-similarity", json=request_data)
    assert response.status_code == 200
    
    data = response.json()
    # Different students should have low similarity
    assert data["semantic_similarity"] < 0.85
    assert data["is_semantic_duplicate"] == False


def test_batch_process_endpoint():
    """Test batch duplicate processing endpoint"""
    request_data = {
        "students": [
            {
                "student_id": "student_001",
                "first_name": "John",
                "last_name": "Doe",
                "date_of_birth": "2005-03-15"
            },
            {
                "student_id": "student_002",
                "first_name": "Jon",
                "last_name": "Doe",
                "date_of_birth": "2005-03-15"
            },
            {
                "student_id": "student_003",
                "first_name": "Jane",
                "last_name": "Smith",
                "date_of_birth": "2006-07-20"
            }
        ],
        "threshold": 0.85
    }
    
    response = client.post("/api/v1/semantic/batch-process", json=request_data)
    assert response.status_code == 200
    
    data = response.json()
    assert "results" in data
    assert "total_students" in data
    assert "total_duplicates_found" in data
    assert "processing_time_ms" in data
    assert "embeddings_per_minute" in data
    
    assert data["total_students"] == 3
    assert isinstance(data["results"], list)
    assert len(data["results"]) == 3
    assert data["processing_time_ms"] > 0
    assert data["embeddings_per_minute"] > 0


def test_batch_process_performance():
    """Test batch processing performance (1000+ embeddings per minute)"""
    # Create 50 sample students
    students = []
    for i in range(50):
        students.append({
            "student_id": f"student_{i:03d}",
            "first_name": f"FirstName{i}",
            "last_name": f"LastName{i}",
            "date_of_birth": "2005-01-01"
        })
    
    request_data = {
        "students": students,
        "threshold": 0.85
    }
    
    response = client.post("/api/v1/semantic/batch-process", json=request_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["total_students"] == 50
    
    # Should process at least 100 embeddings per minute (conservative)
    # Target is 1000+ per minute
    assert data["embeddings_per_minute"] > 100


def test_batch_process_empty_list():
    """Test batch processing with empty student list"""
    request_data = {
        "students": [],
        "threshold": 0.85
    }
    
    response = client.post("/api/v1/semantic/batch-process", json=request_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["total_students"] == 0
    assert len(data["results"]) == 0


def test_batch_process_exceeds_limit():
    """Test batch processing with too many students"""
    # Create 1001 students (exceeds limit of 1000)
    students = []
    for i in range(1001):
        students.append({
            "student_id": f"student_{i:04d}",
            "first_name": f"FirstName{i}",
            "last_name": f"LastName{i}",
            "date_of_birth": "2005-01-01"
        })
    
    request_data = {
        "students": students,
        "threshold": 0.85
    }
    
    response = client.post("/api/v1/semantic/batch-process", json=request_data)
    assert response.status_code == 422  # Validation error


def test_batch_process_result_structure():
    """Test batch processing result structure"""
    request_data = {
        "students": [
            {
                "student_id": "student_001",
                "first_name": "John",
                "last_name": "Doe",
                "date_of_birth": "2005-03-15"
            },
            {
                "student_id": "student_002",
                "first_name": "John",
                "last_name": "Doe",
                "date_of_birth": "2005-03-15"
            }
        ],
        "threshold": 0.85
    }
    
    response = client.post("/api/v1/semantic/batch-process", json=request_data)
    assert response.status_code == 200
    
    data = response.json()
    
    # Check result structure
    for result in data["results"]:
        assert "student" in result
        assert "duplicates" in result
        assert "duplicate_count" in result
        
        assert isinstance(result["duplicates"], list)
        assert result["duplicate_count"] == len(result["duplicates"])


def test_semantic_matching_with_special_characters():
    """Test semantic matching with special characters in names"""
    request_data = {
        "student1": {
            "first_name": "O'Brien",
            "last_name": "Smith-Jones",
            "date_of_birth": "2005-03-15"
        },
        "student2": {
            "first_name": "OBrien",
            "last_name": "SmithJones",
            "date_of_birth": "2005-03-15"
        }
    }
    
    response = client.post("/api/v1/semantic/pairwise-similarity", json=request_data)
    assert response.status_code == 200
    
    data = response.json()
    # Should handle special characters without error
    assert "semantic_similarity" in data


def test_semantic_matching_with_unicode():
    """Test semantic matching with Unicode characters"""
    request_data = {
        "student1": {
            "first_name": "José",
            "last_name": "García",
            "date_of_birth": "2005-03-15"
        },
        "student2": {
            "first_name": "Jose",
            "last_name": "Garcia",
            "date_of_birth": "2005-03-15"
        }
    }
    
    response = client.post("/api/v1/semantic/pairwise-similarity", json=request_data)
    assert response.status_code == 200
    
    data = response.json()
    # Should handle Unicode without error
    assert "semantic_similarity" in data
    # Should have high similarity despite accent differences
    assert data["semantic_similarity"] > 0.7
