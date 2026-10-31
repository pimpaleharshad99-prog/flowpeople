from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class ProjectStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    ON_HOLD = "ON_HOLD"

class TaskStatus(str, enum.Enum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"

class TimesheetStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(150), nullable=False)
    code = Column(String(50), nullable=False)
    client_name = Column(String(150), nullable=True)
    description = Column(Text, nullable=True)
    budget_hours = Column(Float, default=0.0)
    status = Column(String(30), default=ProjectStatus.ACTIVE.value)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    company = relationship("Company", back_populates="projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    time_logs = relationship("TimeLog", back_populates="project", cascade="all, delete-orphan")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    billable = Column(Boolean, default=True)
    estimated_hours = Column(Float, default=0.0)
    status = Column(String(30), default=TaskStatus.IN_PROGRESS.value)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    project = relationship("Project", back_populates="tasks")
    time_logs = relationship("TimeLog", back_populates="task", cascade="all, delete-orphan")

class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_in_project = Column(String(100), default="Team Member")
    assigned_at = Column(DateTime(timezone=True), default=utcnow)

    project = relationship("Project", back_populates="members")
    user = relationship("User")

class Timesheet(Base):
    __tablename__ = "timesheets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    period_start = Column(String(20), nullable=False) # YYYY-MM-DD (e.g. Monday)
    period_end = Column(String(20), nullable=False)   # YYYY-MM-DD (e.g. Sunday)
    total_hours = Column(Float, default=0.0)
    status = Column(String(30), default=TimesheetStatus.DRAFT.value)
    approver_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_comments = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", foreign_keys=[user_id], back_populates="timesheets")
    approver = relationship("User", foreign_keys=[approver_id])
    time_logs = relationship("TimeLog", back_populates="timesheet")

class TimeLog(Base):
    __tablename__ = "time_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    timesheet_id = Column(Integer, ForeignKey("timesheets.id", ondelete="SET NULL"), nullable=True)
    
    log_date = Column(String(20), nullable=False) # YYYY-MM-DD
    hours = Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    is_billable = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="time_logs")
    project = relationship("Project", back_populates="time_logs")
    task = relationship("Task", back_populates="time_logs")
    timesheet = relationship("Timesheet", back_populates="time_logs")

