from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1.router import api_router
from app.api.v1.endpoints.integrations import router as google_drive_router
from app.seed.demo_data import seed_database
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException
import os

# Development convenience only. Production schema must be deployed through reviewed Alembic migrations.
if settings.ENVIRONMENT != "production":
    Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Modern All-in-One Human Resource Management System under the FlowCraft ecosystem. People First. Work Smarter.",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs"
)

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(google_drive_router, prefix="/api/integrations/google-drive", tags=["Google Drive Integration"])

@app.on_event("startup")
def on_startup():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE attendance_punches ADD COLUMN verification_method VARCHAR(50) DEFAULT 'FACE'"))
            conn.commit()
        except Exception:
            pass

    # Demo seed data is development-only. Never seed production databases.
    if settings.ENVIRONMENT != "production" and "sqlite" in settings.DATABASE_URL.lower():
        db_file = "hrms.db"
        if not os.path.exists(db_file) or os.path.getsize(db_file) == 0:
            print("Development database not found or empty. Seeding demo data...")
            seed_database()

@app.get("/health")
def health_check():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {
        "status": "healthy",
        "service": "FlowPeople HRMS Engine (FlowCraft)",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)

