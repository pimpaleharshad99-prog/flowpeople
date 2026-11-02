from pydantic_settings import BaseSettings
from typing import List
from pathlib import Path
import os

_BASE_DIR = Path(__file__).resolve().parent.parent.parent
_DEFAULT_DB_FILE = (_BASE_DIR / "hrms.db").as_posix()

class Settings(BaseSettings):
    PROJECT_NAME: str = "FlowPeople — Complete Workforce Management (FlowCraft)"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "dev-super-secret-jwt-key-flowpeople-flowcraft-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    
    # Database (always anchor to backend root unless overridden)
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{_DEFAULT_DB_FILE}")
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]
    
    # Company Default Settings
    DEFAULT_WORK_HOURS_PER_DAY: float = 8.0
    DEFAULT_GRACE_PERIOD_MINS: int = 15
    DEFAULT_BREAK_DURATION_MINS: int = 60

    model_config = {"env_file": ".env", "case_sensitive": True, "extra": "ignore"}

settings = Settings()
