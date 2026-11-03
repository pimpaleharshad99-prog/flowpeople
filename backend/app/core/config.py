from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from typing import List
from pathlib import Path
import os
from dotenv import load_dotenv

_BASE_DIR = Path(__file__).resolve().parent.parent.parent
_DEFAULT_DB_FILE = (_BASE_DIR / "hrms.db").as_posix()

# Explicitly load .env from backend root and workspace root
load_dotenv(_BASE_DIR / ".env")
load_dotenv(Path.cwd() / ".env")

class Settings(BaseSettings):
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").lower()
    PROJECT_NAME: str = "FlowPeople — Complete Workforce Management (FlowCraft)"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-super-secret-jwt-key-flowpeople-flowcraft-2026")
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

    # Google Drive & OAuth 2.0 Integration
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "https://eqbrciupuhzwcmkarxqa.supabase.co/auth/v1/callback")
    GOOGLE_DRIVE_REDIRECT_URI: str = os.getenv("GOOGLE_DRIVE_REDIRECT_URI", "http://localhost:8000/api/integrations/google-drive/callback")
    GOOGLE_DRIVE_SCOPES: str = os.getenv("GOOGLE_DRIVE_SCOPES", "https://www.googleapis.com/auth/drive.file openid email profile")
    GOOGLE_OAUTH_ENABLED: bool = os.getenv("GOOGLE_OAUTH_ENABLED", "false").lower() in ("true", "1", "yes")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # Supabase Server-Side Admin & Auth Configuration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://eqbrciupuhzwcmkarxqa.supabase.co")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", os.getenv("SUPABASE_ANON_KEY", "sb_publishable_7qTDoq7eUjpiARmGvR6CIA_c4er5U3z"))
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")
    SUPABASE_JWKS: str = os.getenv("SUPABASE_JWKS", "")

    @model_validator(mode="after")
    def validate_production_configuration(self):
        if self.ENVIRONMENT == "production":
            if "sqlite" in self.DATABASE_URL.lower():
                raise ValueError("Production requires a persistent PostgreSQL DATABASE_URL; SQLite is development-only.")
            if len(self.SECRET_KEY) < 32 or self.SECRET_KEY.startswith("dev-"):
                raise ValueError("Production requires a strong SECRET_KEY of at least 32 characters.")
            if not self.SUPABASE_URL or not self.SUPABASE_KEY:
                raise ValueError("Production requires SUPABASE_URL and SUPABASE_KEY.")
            if not self.BACKEND_CORS_ORIGINS or "*" in self.BACKEND_CORS_ORIGINS:
                raise ValueError("Production CORS must contain explicit trusted origins; wildcard is forbidden.")
        return self

    model_config = SettingsConfigDict(
        env_file=[(_BASE_DIR / ".env").as_posix(), ".env"],
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
