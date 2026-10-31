from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Time
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False) # e.g. "General Day Shift", "Morning Shift"
    code = Column(String(50), nullable=False) # e.g. "GEN-01"
    start_time = Column(String(10), nullable=False) # "09:00"
    end_time = Column(String(10), nullable=False)   # "18:00"
    expected_work_hours = Column(Integer, default=480) # 8 hours in minutes (480 mins)
    break_duration_mins = Column(Integer, default=60)
    grace_period_mins = Column(Integer, default=15)
    early_exit_allowance_mins = Column(Integer, default=15)
    half_day_threshold_mins = Column(Integer, default=240) # 4 hours
    is_night_shift = Column(Boolean, default=False)
    is_default = Column(Boolean, default=False)
    color = Column(String(20), default="#3B82F6") # For roster calendar
    created_at = Column(DateTime(timezone=True), default=utcnow)

    company = relationship("Company", back_populates="shifts")
    assignments = relationship("ShiftAssignment", back_populates="shift", cascade="all, delete-orphan")
    attendance_records = relationship("AttendanceRecord", back_populates="shift")

class ShiftAssignment(Base):
    __tablename__ = "shift_assignments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    shift_id = Column(Integer, ForeignKey("shifts.id", ondelete="CASCADE"), nullable=False)
    start_date = Column(String(20), nullable=False) # YYYY-MM-DD
    end_date = Column(String(20), nullable=True)   # NULL means ongoing
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="shift_assignments")
    shift = relationship("Shift", back_populates="assignments")

