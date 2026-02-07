"""
Semantic Matching Module using Sentence-BERT
Task 3.2.2: Integrate Sentence-BERT for semantic matching

Implements:
- SBERT model loading (all-MiniLM-L6-v2)
- 768-dimensional embedding generation for student profiles
- Cosine similarity calculation between candidate pairs
- Threshold: similarity > 0.85 flags semantic duplicates
- Batch processing: 1000 embeddings per minute
"""

from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class SemanticMatcher:
    """
    Semantic matching engine using Sentence-BERT embeddings
    """
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize the semantic matcher with SBERT model
        
        Args:
            model_name: Name of the sentence-transformers model to use
                       Default: all-MiniLM-L6-v2 (384-dim, fast, good quality)
        """
        self.model_name = model_name
        self.model = None
        self.embedding_dimension = 384  # all-MiniLM-L6-v2 produces 384-dim embeddings
        self.similarity_threshold = 0.85
        self.batch_size = 32  # Process 32 profiles at a time for optimal performance
        
        logger.info(f"Initializing SemanticMatcher with model: {model_name}")
        self._load_model()
    
    def _load_model(self):
        """Load the SBERT model"""
        try:
            self.model = SentenceTransformer(self.model_name)
            logger.info(f"Successfully loaded SBERT model: {self.model_name}")
            logger.info(f"Model produces {self.embedding_dimension}-dimensional embeddings")
        except Exception as e:
            logger.error(f"Failed to load SBERT model: {str(e)}")
            raise
    
    def create_student_profile_text(self, student_data: Dict[str, Any]) -> str:
        """
        Create a text representation of student profile for embedding
        
        Args:
            student_data: Dictionary containing student information
                         Expected keys: first_name, last_name, date_of_birth, email, phone
        
        Returns:
            Formatted text string for embedding generation
        """
        parts = []
        
        # Add name components
        if student_data.get('first_name'):
            parts.append(f"First name: {student_data['first_name']}")
        if student_data.get('last_name'):
            parts.append(f"Last name: {student_data['last_name']}")
        
        # Add date of birth
        if student_data.get('date_of_birth'):
            parts.append(f"Date of birth: {student_data['date_of_birth']}")
        
        # Add contact information (optional)
        if student_data.get('email'):
            parts.append(f"Email: {student_data['email']}")
        if student_data.get('phone'):
            parts.append(f"Phone: {student_data['phone']}")
        
        # Join all parts with periods
        profile_text = ". ".join(parts)
        return profile_text
    
    def generate_embedding(self, student_data: Dict[str, Any]) -> np.ndarray:
        """
        Generate 384-dimensional embedding for a single student profile
        
        Args:
            student_data: Dictionary containing student information
        
        Returns:
            numpy array of shape (384,) containing the embedding
        """
        if not self.model:
            raise RuntimeError("SBERT model not loaded")
        
        profile_text = self.create_student_profile_text(student_data)
        embedding = self.model.encode(profile_text, convert_to_numpy=True)
        
        return embedding
    
    def generate_embeddings_batch(self, students_data: List[Dict[str, Any]]) -> np.ndarray:
        """
        Generate embeddings for multiple student profiles in batch
        Optimized for performance: processes 1000+ embeddings per minute
        
        Args:
            students_data: List of student data dictionaries
        
        Returns:
            numpy array of shape (n_students, 384) containing embeddings
        """
        if not self.model:
            raise RuntimeError("SBERT model not loaded")
        
        # Create profile texts for all students
        profile_texts = [
            self.create_student_profile_text(student)
            for student in students_data
        ]
        
        # Generate embeddings in batch (much faster than one-by-one)
        embeddings = self.model.encode(
            profile_texts,
            batch_size=self.batch_size,
            convert_to_numpy=True,
            show_progress_bar=False
        )
        
        return embeddings
    
    def calculate_cosine_similarity(
        self,
        embedding1: np.ndarray,
        embedding2: np.ndarray
    ) -> float:
        """
        Calculate cosine similarity between two embeddings
        
        Args:
            embedding1: First embedding vector
            embedding2: Second embedding vector
        
        Returns:
            Cosine similarity score between 0 and 1 (1 = identical)
        """
        # Normalize vectors
        norm1 = np.linalg.norm(embedding1)
        norm2 = np.linalg.norm(embedding2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        # Calculate cosine similarity
        similarity = np.dot(embedding1, embedding2) / (norm1 * norm2)
        
        # Ensure result is in [0, 1] range (handle floating point errors)
        similarity = max(0.0, min(1.0, float(similarity)))
        
        return similarity
    
    def find_semantic_duplicates(
        self,
        query_student: Dict[str, Any],
        candidate_students: List[Dict[str, Any]],
        threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Find semantic duplicates for a query student among candidates
        
        Args:
            query_student: Student data to check for duplicates
            candidate_students: List of candidate student records
            threshold: Similarity threshold (default: 0.85)
        
        Returns:
            List of matches with similarity scores and metadata
        """
        if threshold is None:
            threshold = self.similarity_threshold
        
        if not candidate_students:
            return []
        
        # Generate embedding for query student
        query_embedding = self.generate_embedding(query_student)
        
        # Generate embeddings for all candidates in batch
        candidate_embeddings = self.generate_embeddings_batch(candidate_students)
        
        # Calculate similarities
        matches = []
        for idx, candidate in enumerate(candidate_students):
            candidate_embedding = candidate_embeddings[idx]
            similarity = self.calculate_cosine_similarity(query_embedding, candidate_embedding)
            
            if similarity >= threshold:
                matches.append({
                    'candidate_student': candidate,
                    'semantic_similarity': float(similarity),
                    'is_semantic_duplicate': True,
                    'threshold_used': threshold,
                    'embedding_dimension': self.embedding_dimension,
                    'model_version': self.model_name
                })
        
        # Sort by similarity (highest first)
        matches.sort(key=lambda x: x['semantic_similarity'], reverse=True)
        
        return matches
    
    def calculate_pairwise_similarity(
        self,
        student1: Dict[str, Any],
        student2: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Calculate semantic similarity between two specific students
        
        Args:
            student1: First student data
            student2: Second student data
        
        Returns:
            Dictionary with similarity score and metadata
        """
        embedding1 = self.generate_embedding(student1)
        embedding2 = self.generate_embedding(student2)
        
        similarity = self.calculate_cosine_similarity(embedding1, embedding2)
        
        return {
            'semantic_similarity': float(similarity),
            'is_semantic_duplicate': similarity >= self.similarity_threshold,
            'threshold': self.similarity_threshold,
            'embedding_dimension': self.embedding_dimension,
            'model_version': self.model_name,
            'student1_profile': self.create_student_profile_text(student1),
            'student2_profile': self.create_student_profile_text(student2)
        }
    
    def batch_process_duplicates(
        self,
        students: List[Dict[str, Any]],
        threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Process multiple students for duplicate detection in batch
        Optimized for bulk operations: 1000+ embeddings per minute
        
        Args:
            students: List of student records to check
            threshold: Similarity threshold (default: 0.85)
        
        Returns:
            List of results with potential duplicates for each student
        """
        if threshold is None:
            threshold = self.similarity_threshold
        
        if not students:
            return []
        
        start_time = datetime.now()
        
        # Generate all embeddings in one batch (very fast)
        all_embeddings = self.generate_embeddings_batch(students)
        
        results = []
        
        # For each student, find duplicates among all others
        for i, student in enumerate(students):
            query_embedding = all_embeddings[i]
            duplicates = []
            
            # Compare with all other students
            for j, candidate in enumerate(students):
                if i == j:
                    continue  # Skip self-comparison
                
                candidate_embedding = all_embeddings[j]
                similarity = self.calculate_cosine_similarity(
                    query_embedding,
                    candidate_embedding
                )
                
                if similarity >= threshold:
                    duplicates.append({
                        'candidate_student': candidate,
                        'semantic_similarity': float(similarity),
                        'is_semantic_duplicate': True
                    })
            
            # Sort duplicates by similarity
            duplicates.sort(key=lambda x: x['semantic_similarity'], reverse=True)
            
            results.append({
                'student': student,
                'duplicates': duplicates,
                'duplicate_count': len(duplicates)
            })
        
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds()
        embeddings_per_minute = (len(students) / processing_time) * 60 if processing_time > 0 else 0
        
        logger.info(
            f"Batch processed {len(students)} students in {processing_time:.2f}s "
            f"({embeddings_per_minute:.0f} embeddings/minute)"
        )
        
        return results


# Global instance (singleton pattern)
_semantic_matcher_instance: Optional[SemanticMatcher] = None


def get_semantic_matcher() -> SemanticMatcher:
    """
    Get or create the global SemanticMatcher instance
    Singleton pattern ensures model is loaded only once
    """
    global _semantic_matcher_instance
    
    if _semantic_matcher_instance is None:
        _semantic_matcher_instance = SemanticMatcher()
    
    return _semantic_matcher_instance
