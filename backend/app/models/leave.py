from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class LeaveStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"

class AccrualFrequency(str, enum.Enum):
    ANNUAL = "ANNUAL"
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"

class HalfDaySession(str, enum.Enum):
    NONE = "NONE"
    FIRST_HALF = "FIRST_HALF"
    SECOND_HALF = "SECOND_HALF"

class LeaveType(Base):
    __tablename__ = "leave_types"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False) # e.g. "Casual Leave", "Sick Leave", "Paid Time Off"
    code = Column(String(50), nullable=False) # "CL", "SL", "PTO"
    annual_quota = Column(Float, default=12.0)
    accrual_frequency = Column(String(30), default=AccrualFrequency.ANNUAL.value)
    carry_forward_limit = Column(Float, default=5.0)
    allow_negative = Column(Boolean, default=False)
    requires_approval = Column(Boolean, default=True)
    color = Column(String(20), default="#10B981")
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    company = relationship("Company", back_populates="leave_types")
    balances = relationship("LeaveBalance", back_populates="leave_type", cascade="all, delete-orphan")
    requests = relationship("LeaveRequest", back_populates="leave_type", cascade="all, delete-orphan")

class LeaveBalance(Base):
    __tablename__ = "leave_balances"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id", ondelete="CASCADE"), nullable=False)
    year = Column(Integer, nullable=False)
    
    allocated = Column(Float, default=0.0)
    used = Column(Float, default=0.0)
    pending_approval = Column(Float, default=0.0)
    balance = Column(Float, default=0.0)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="leave_balances")
    leave_type = relationship("LeaveType", back_populates="balances")

class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id", ondelete="CASCADE"), nullable=False)
    
    from_date = Column(String(20), nullable=False) # YYYY-MM-DD
    to_date = Column(String(20), nullable=False)   # YYYY-MM-DD
    day_count = Column(Float, nullable=False)      # e.g. 0.5, 1.0, 3.0
    
    is_half_day = Column(Boolean, default=False)
    half_day_session = Column(String(20), default=HalfDaySession.NONE.value)
    reason = Column(Text, nullable=False)
    status = Column(String(30), default=LeaveStatus.PENDING.value, nullable=False)
    
    document_url = Column(String(500), nullable=True) # Medical cert or proof
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", foreign_keys=[user_id], back_populates="leave_requests")
    leave_type = relationship("LeaveType", back_populates="requests")
    approvals = relationship("LeaveApproval", back_populates="leave_request", cascade="all, delete-orphan")

class LeaveApproval(Base):
    __tablename__ = "leave_approvals"

    id = Column(Integer, primary_key=True, index=True)
    leave_request_id = Column(Integer, ForeignKey("leave_requests.id", ondelete="CASCADE"), nullable=False)
    approver_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    tier_level = Column(Integer, default=1) # 1 = Direct Manager, 2 = HR
    status = Column(String(30), default=LeaveStatus.PENDING.value, nullable=False)
    comments = Column(Text, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    leave_request = relationship("LeaveRequest", back_populates="approvals")
    approver = relationship("User", foreign_keys=[approver_id])

