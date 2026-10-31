from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class GoalStatus(str, enum.Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    ACHIEVED = "ACHIEVED"
    OVERDUE = "OVERDUE"

class ReviewStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    COMPLETED = "COMPLETED"

class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    kpi_metric = Column(String(150), nullable=True)
    target_value = Column(Float, default=100.0)
    current_value = Column(Float, default=0.0)
    unit = Column(String(50), default="%")
    status = Column(String(50), default=GoalStatus.IN_PROGRESS.value, nullable=False)
    due_date = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    company = relationship("Company")
    user = relationship("User", back_populates="goals")

class PerformanceReview(Base):
    __tablename__ = "performance_reviews"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    cycle_name = Column(String(100), default="Q4 2026 Annual Appraisal", nullable=False)
    self_assessment = Column(Text, nullable=True)
    manager_feedback = Column(Text, nullable=True)
    rating = Column(Float, default=4.0) # 1.0 to 5.0
    status = Column(String(50), default=ReviewStatus.SUBMITTED.value, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    company = relationship("Company")
    user = relationship("User", foreign_keys=[user_id], back_populates="performance_reviews")
    reviewer = relationship("User", foreign_keys=[reviewer_id])

