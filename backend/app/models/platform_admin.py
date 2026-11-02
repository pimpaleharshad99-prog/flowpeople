from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime, timezone
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class PlatformAdmin(Base):
    __tablename__ = "platform_admins"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(64), unique=True, index=True, nullable=False) # Supabase auth user UUID
    role = Column(String(50), default="SUPER_ADMIN", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

