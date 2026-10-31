from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class AttendanceStatus(str, enum.Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    HALF_DAY = "HALF_DAY"
    ON_LEAVE = "ON_LEAVE"
    WEEKEND = "WEEKEND"
    HOLIDAY = "HOLIDAY"

class PunchType(str, enum.Enum):
    IN = "IN"
    OUT = "OUT"

class RegularizationStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = Column(String(20), index=True, nullable=False) # YYYY-MM-DD
    shift_id = Column(Integer, ForeignKey("shifts.id", ondelete="SET NULL"), nullable=True)
    
    first_check_in = Column(DateTime(timezone=True), nullable=True)
    last_check_out = Column(DateTime(timezone=True), nullable=True)
    
    total_work_minutes = Column(Integer, default=0) # Effective work minutes
    total_break_minutes = Column(Integer, default=0)
    overtime_minutes = Column(Integer, default=0)
    
    late_in_minutes = Column(Integer, default=0)
    early_out_minutes = Column(Integer, default=0)
    
    status = Column(String(50), default=AttendanceStatus.ABSENT.value, nullable=False)
    is_regularized = Column(Boolean, default=False)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    user = relationship("User", back_populates="attendance_records")
    shift = relationship("Shift", back_populates="attendance_records")
    punches = relationship("AttendancePunch", back_populates="attendance_record", cascade="all, delete-orphan", order_by="AttendancePunch.punch_time")
    regularizations = relationship("AttendanceRegularization", back_populates="attendance_record", cascade="all, delete-orphan")

class AttendancePunch(Base):
    __tablename__ = "attendance_punches"

    id = Column(Integer, primary_key=True, index=True)
    attendance_record_id = Column(Integer, ForeignKey("attendance_records.id", ondelete="CASCADE"), nullable=False)
    punch_time = Column(DateTime(timezone=True), nullable=False)
    punch_type = Column(String(10), nullable=False) # "IN" or "OUT"
    ip_address = Column(String(50), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_note = Column(String(255), nullable=True)
    device = Column(String(100), default="Web Browser")
    verification_method = Column(String(50), default="FACE") # "FACE", "FINGERPRINT", "QR_CODE", "MANUAL"
    created_at = Column(DateTime(timezone=True), default=utcnow)

    attendance_record = relationship("AttendanceRecord", back_populates="punches")

class AttendanceRegularization(Base):
    __tablename__ = "attendance_regularizations"

    id = Column(Integer, primary_key=True, index=True)
    attendance_record_id = Column(Integer, ForeignKey("attendance_records.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    requested_first_in = Column(DateTime(timezone=True), nullable=False)
    requested_last_out = Column(DateTime(timezone=True), nullable=False)
    reason = Column(Text, nullable=False)
    
    status = Column(String(30), default=RegularizationStatus.PENDING.value, nullable=False)
    approver_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    review_comments = Column(Text, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    attendance_record = relationship("AttendanceRecord", back_populates="regularizations")
    user = relationship("User", foreign_keys=[user_id])
    approver = relationship("User", foreign_keys=[approver_id])

