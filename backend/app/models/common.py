from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class TicketStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"

class TicketPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class EmployeeDocument(Base):
    __tablename__ = "employee_documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category = Column(String(100), nullable=False) # "Government ID", "Contract", "Degree Certificate", "Offer Letter"
    title = Column(String(200), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size_kb = Column(Integer, default=0)
    uploaded_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="documents")

class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    priority = Column(String(20), default="NORMAL") # "NORMAL", "URGENT", "IMPORTANT"
    published_at = Column(DateTime(timezone=True), default=utcnow)

    company = relationship("Company", back_populates="announcements")
    author = relationship("User")

class HRTicket(Base):
    __tablename__ = "hr_tickets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category = Column(String(100), nullable=False) # "Payroll", "Benefits", "Workplace", "Policy", "IT Equipment"
    subject = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String(20), default=TicketPriority.MEDIUM.value)
    status = Column(String(20), default=TicketStatus.OPEN.value)
    assigned_to_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", foreign_keys=[user_id], back_populates="tickets")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), default="INFO") # "LEAVE_APPROVAL", "ATTENDANCE_ALERT", "TIMESHEET_STATUS", "GENERAL"
    link = Column(String(255), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="notifications")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False)
    user_id = Column(Integer, nullable=True)
    entity_name = Column(String(100), nullable=False) # "User", "LeaveRequest", "AttendanceRecord"
    entity_id = Column(Integer, nullable=False)
    action = Column(String(50), nullable=False) # "CREATE", "UPDATE", "APPROVE", "REJECT", "DELETE"
    details = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

