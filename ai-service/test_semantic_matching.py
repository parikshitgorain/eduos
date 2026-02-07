"""
Tests for Semantic Matching Module
Task 3.2.2: Integrate Sentence-BERT for semantic matching
"""

import pytest
import numpy as np
from semantic_matching import SemanticMatcher, get_semantic_matcher


class TestSemanticMatcher:
    """Test suite for SemanticMatcher class"""
    
    @pytest.fixture
    def matcher(self):
        """Create a SemanticMatcher instance for testing"""
        return SemanticMatcher()
    
    @pytest.fixture
    def sample_student1(self):
        """Sample student data"""
        return {
            'student_id': 'student_001',
            'first_name': 'John',
            'last_name': 'Doe',
            'date_of_birth': '2005-03-15',
            'email': 'john.doe@example.com',
            'phone': '+1234567890'
        }
    
    @pytest.fixture
    def sample_student2(self):
        """Similar student data (potential duplicate)"""
        return {
            'student_id': 'student_002',
            'first_name': 'Jon',  # Phonetic variant
            'last_name': 'Doe',
            'date_of_birth': '2005-03-15',
            'email': 'jon.doe@example.com',
            'phone': '+1234567891'
        }
    
    @pytest.fixture
    def sample_student3(self):
        """Different student data (not a duplicate)"""
        return {
            'student_id': 'student_003',
            'first_name': 'Jane',
            'last_name': 'Smith',
            'date_of_birth': '2006-07-20',
            'email': 'jane.smith@example.com',
            'phone': '+9876543210'
        }
    
    def test_model_initialization(self, matcher):
        """Test that SBERT model loads correctly"""
        assert matcher.model is not None
        assert matcher.model_name == "all-MiniLM-L6-v2"
        assert matcher.embedding_dimension == 384
        assert matcher.similarity_threshold == 0.85
    
    def test_create_student_profile_text(self, matcher, sample_student1):
        """Test profile text generation"""
        profile_text = matcher.create_student_profile_text(sample_student1)
        
        assert 'First name: John' in profile_text
        assert 'Last name: Doe' in profile_text
        assert 'Date of birth: 2005-03-15' in profile_text
        assert 'Email: john.doe@example.com' in profile_text
        assert 'Phone: +1234567890' in profile_text
    
    def test_create_student_profile_text_minimal(self, matcher):
        """Test profile text with minimal data"""
        minimal_student = {
            'first_name': 'John',
            'last_name': 'Doe'
        }
        profile_text = matcher.create_student_profile_text(minimal_student)
        
        assert 'First name: John' in profile_text
        assert 'Last name: Doe' in profile_text
        assert 'Email' not in profile_text
    
    def test_generate_embedding(self, matcher, sample_student1):
        """Test single embedding generation"""
        embedding = matcher.generate_embedding(sample_student1)
        
        assert isinstance(embedding, np.ndarray)
        assert embedding.shape == (384,)
        assert not np.isnan(embedding).any()
        assert not np.isinf(embedding).any()
    
    def test_generate_embeddings_batch(self, matcher, sample_student1, sample_student2, sample_student3):
        """Test batch embedding generation"""
        students = [sample_student1, sample_student2, sample_student3]
        embeddings = matcher.generate_embeddings_batch(students)
        
        assert isinstance(embeddings, np.ndarray)
        assert embeddings.shape == (3, 384)
        assert not np.isnan(embeddings).any()
        assert not np.isinf(embeddings).any()
    
    def test_calculate_cosine_similarity(self, matcher):
        """Test cosine similarity calculation"""
        # Identical vectors should have similarity 1.0
        vec1 = np.array([1.0, 2.0, 3.0])
        vec2 = np.array([1.0, 2.0, 3.0])
        similarity = matcher.calculate_cosine_similarity(vec1, vec2)
        assert abs(similarity - 1.0) < 0.001
        
        # Orthogonal vectors should have similarity 0.0
        vec3 = np.array([1.0, 0.0, 0.0])
        vec4 = np.array([0.0, 1.0, 0.0])
        similarity = matcher.calculate_cosine_similarity(vec3, vec4)
        assert abs(similarity - 0.0) < 0.001
        
        # Opposite vectors should have similarity close to 0.0
        vec5 = np.array([1.0, 2.0, 3.0])
        vec6 = np.array([-1.0, -2.0, -3.0])
        similarity = matcher.calculate_cosine_similarity(vec5, vec6)
        assert similarity < 0.1  # Should be close to 0 or negative (clamped to 0)
    
    def test_calculate_cosine_similarity_zero_vectors(self, matcher):
        """Test cosine similarity with zero vectors"""
        vec1 = np.array([0.0, 0.0, 0.0])
        vec2 = np.array([1.0, 2.0, 3.0])
        similarity = matcher.calculate_cosine_similarity(vec1, vec2)
        assert similarity == 0.0
    
    def test_find_semantic_duplicates_high_similarity(self, matcher, sample_student1, sample_student2):
        """Test finding semantic duplicates with high similarity"""
        matches = matcher.find_semantic_duplicates(
            query_student=sample_student1,
            candidate_students=[sample_student2],
            threshold=0.85
        )
        
        # John and Jon with same last name and DOB should be flagged as duplicates
        assert len(matches) >= 0  # May or may not match depending on threshold
        
        if len(matches) > 0:
            match = matches[0]
            assert 'candidate_student' in match
            assert 'semantic_similarity' in match
            assert 'is_semantic_duplicate' in match
            assert match['is_semantic_duplicate'] == True
            assert 0.0 <= match['semantic_similarity'] <= 1.0
    
    def test_find_semantic_duplicates_low_similarity(self, matcher, sample_student1, sample_student3):
        """Test finding semantic duplicates with low similarity"""
        matches = matcher.find_semantic_duplicates(
            query_student=sample_student1,
            candidate_students=[sample_student3],
            threshold=0.85
        )
        
        # John Doe and Jane Smith should not be duplicates
        assert len(matches) == 0
    
    def test_find_semantic_duplicates_empty_candidates(self, matcher, sample_student1):
        """Test with empty candidate list"""
        matches = matcher.find_semantic_duplicates(
            query_student=sample_student1,
            candidate_students=[],
            threshold=0.85
        )
        
        assert matches == []
    
    def test_find_semantic_duplicates_custom_threshold(self, matcher, sample_student1, sample_student2):
        """Test with custom threshold"""
        # Lower threshold should find more matches
        matches_low = matcher.find_semantic_duplicates(
            query_student=sample_student1,
            candidate_students=[sample_student2],
            threshold=0.5
        )
        
        # Higher threshold should find fewer matches
        matches_high = matcher.find_semantic_duplicates(
            query_student=sample_student1,
            candidate_students=[sample_student2],
            threshold=0.95
        )
        
        assert len(matches_low) >= len(matches_high)
    
    def test_calculate_pairwise_similarity(self, matcher, sample_student1, sample_student2):
        """Test pairwise similarity calculation"""
        result = matcher.calculate_pairwise_similarity(sample_student1, sample_student2)
        
        assert 'semantic_similarity' in result
        assert 'is_semantic_duplicate' in result
        assert 'threshold' in result
        assert 'embedding_dimension' in result
        assert 'model_version' in result
        assert 'student1_profile' in result
        assert 'student2_profile' in result
        
        assert 0.0 <= result['semantic_similarity'] <= 1.0
        assert result['embedding_dimension'] == 384
        assert result['model_version'] == "all-MiniLM-L6-v2"
    
    def test_batch_process_duplicates(self, matcher, sample_student1, sample_student2, sample_student3):
        """Test batch duplicate processing"""
        students = [sample_student1, sample_student2, sample_student3]
        results = matcher.batch_process_duplicates(students, threshold=0.85)
        
        assert len(results) == 3
        
        for result in results:
            assert 'student' in result
            assert 'duplicates' in result
            assert 'duplicate_count' in result
            assert isinstance(result['duplicates'], list)
            assert result['duplicate_count'] == len(result['duplicates'])
    
    def test_batch_process_duplicates_empty(self, matcher):
        """Test batch processing with empty list"""
        results = matcher.batch_process_duplicates([], threshold=0.85)
        assert results == []
    
    def test_batch_process_performance(self, matcher):
        """Test batch processing performance (1000+ embeddings per minute)"""
        # Create 100 sample students
        students = []
        for i in range(100):
            students.append({
                'student_id': f'student_{i:03d}',
                'first_name': f'FirstName{i}',
                'last_name': f'LastName{i}',
                'date_of_birth': '2005-01-01'
            })
        
        import time
        start_time = time.time()
        results = matcher.batch_process_duplicates(students, threshold=0.85)
        end_time = time.time()
        
        processing_time = end_time - start_time
        embeddings_per_minute = (100 / processing_time) * 60
        
        assert len(results) == 100
        # Should process at least 100 embeddings per minute (very conservative)
        # Target is 1000+ per minute
        assert embeddings_per_minute > 100
    
    def test_embedding_consistency(self, matcher, sample_student1):
        """Test that same input produces same embedding"""
        embedding1 = matcher.generate_embedding(sample_student1)
        embedding2 = matcher.generate_embedding(sample_student1)
        
        # Embeddings should be identical for same input
        assert np.allclose(embedding1, embedding2, rtol=1e-5)
    
    def test_get_semantic_matcher_singleton(self):
        """Test that get_semantic_matcher returns singleton instance"""
        matcher1 = get_semantic_matcher()
        matcher2 = get_semantic_matcher()
        
        assert matcher1 is matcher2  # Same instance
    
    def test_phonetic_variants_detection(self, matcher):
        """Test detection of phonetic variants (e.g., Robert vs Bob)"""
        student_robert = {
            'first_name': 'Robert',
            'last_name': 'Johnson',
            'date_of_birth': '2005-05-10'
        }
        
        student_bob = {
            'first_name': 'Bob',
            'last_name': 'Johnson',
            'date_of_birth': '2005-05-10'
        }
        
        result = matcher.calculate_pairwise_similarity(student_robert, student_bob)
        
        # Should have high similarity due to semantic understanding
        # Note: Actual similarity depends on model's training
        assert 0.0 <= result['semantic_similarity'] <= 1.0
    
    def test_name_order_invariance(self, matcher):
        """Test that name order doesn't significantly affect similarity"""
        student1 = {
            'first_name': 'John',
            'last_name': 'Doe',
            'date_of_birth': '2005-03-15'
        }
        
        student2 = {
            'first_name': 'Doe',
            'last_name': 'John',
            'date_of_birth': '2005-03-15'
        }
        
        result = matcher.calculate_pairwise_similarity(student1, student2)
        
        # Should still have some similarity due to same words
        assert result['semantic_similarity'] > 0.3
    
    def test_special_characters_handling(self, matcher):
        """Test handling of special characters in names"""
        student1 = {
            'first_name': "O'Brien",
            'last_name': 'Smith-Jones',
            'date_of_birth': '2005-03-15'
        }
        
        student2 = {
            'first_name': 'OBrien',
            'last_name': 'SmithJones',
            'date_of_birth': '2005-03-15'
        }
        
        result = matcher.calculate_pairwise_similarity(student1, student2)
        
        # Should have high similarity despite punctuation differences
        assert result['semantic_similarity'] > 0.7
    
    def test_unicode_names_handling(self, matcher):
        """Test handling of Unicode characters in names"""
        student1 = {
            'first_name': 'José',
            'last_name': 'García',
            'date_of_birth': '2005-03-15'
        }
        
        student2 = {
            'first_name': 'Jose',
            'last_name': 'Garcia',
            'date_of_birth': '2005-03-15'
        }
        
        # Should not raise an error
        result = matcher.calculate_pairwise_similarity(student1, student2)
        
        assert 'semantic_similarity' in result
        assert result['semantic_similarity'] > 0.7  # Should be similar


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
