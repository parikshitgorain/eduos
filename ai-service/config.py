"""
Configuration management for AI Inference Service
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """
    Application settings with environment variable support
    """
    # Environment
    environment: str = "development"
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    
    # Logging
    log_level: str = "info"
    
    # CORS
    allowed_origins: List[str] = ["*"]
    
    # Model Configuration
    model_cache_dir: str = "/app/models"
    
    # Service Metadata
    service_name: str = "EduOS AI Inference Service"
    service_version: str = "1.0.0"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()
