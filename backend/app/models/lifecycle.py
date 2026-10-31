from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class OnboardingCategory(str, enum.Enum):
    DOCUMENTS = "DOCUMENTS"
    IT_SETUP = "IT_SETUP"
    TRAINING = "TRAINING"
    ORIENTATION = "ORIENTATION"

class LifecycleStage(str, enum.Enum):
    ONBOARDING = "ONBOARDING"
    PROBATION = "PROBATION"
    CONFIRMED = "CONFIRMED"
    PROMOTED = "PROMOTED"
    TRANSFER = "TRANSFER"
    RESIGNED = "RESIGNED"
    EXIT_INTERVIEW = "EXIT_INTERVIEW"
    OFFBOARDED = "OFFBOARDED"

class OnboardingTask(Base):
    __tablename__ = "onboarding_tasks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    category = Column(String(100), default=OnboardingCategory.DOCUMENTS.value, nullable=False)
    is_completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(String(20), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    company = relationship("Company")
    user = relationship("User", back_populates="onboarding_tasks")

class LifecycleRecord(Base):
    __tablename__ = "lifecycle_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    stage = Column(String(50), default=LifecycleStage.ONBOARDING.value, nullable=False)
    effective_date = Column(String(20), nullable=False)
    notes = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", foreign_keys=[user_id], back_populates="lifecycle_records")
    created_by = relationship("User", foreign_keys=[created_by_id])

