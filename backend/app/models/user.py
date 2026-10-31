from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Enum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    HR_ADMIN = "HR_ADMIN"
    ADMIN = "ADMIN"
    HR_MANAGER = "HR_MANAGER"
    HR_EXECUTIVE = "HR_EXECUTIVE"
    MANAGER = "MANAGER"
    PAYROLL_ADMIN = "PAYROLL_ADMIN"
    EMPLOYEE = "EMPLOYEE"
    AUDITOR = "AUDITOR"

class EmploymentStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_INVITATION = "PENDING_INVITATION"
    INVITED = "INVITED"
    ACTIVE = "ACTIVE"
    PROBATION = "PROBATION"
    ON_LEAVE = "ON_LEAVE"
    NOTICE_PERIOD = "NOTICE_PERIOD"
    SUSPENDED = "SUSPENDED"
    INACTIVE = "INACTIVE"
    TERMINATED = "TERMINATED"

class EmploymentType(str, enum.Enum):
    FULL_TIME = "FULL_TIME"
    PART_TIME = "PART_TIME"
    CONTRACT = "CONTRACT"
    INTERN = "INTERN"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    employee_code = Column(String(50), index=True, nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    
    # Personal Info
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    phone = Column(String(30), nullable=True)
    gender = Column(String(20), nullable=True)
    date_of_birth = Column(String(20), nullable=True)
    blood_group = Column(String(10), nullable=True)
    
    # Employment Info
    role = Column(String(50), default=UserRole.EMPLOYEE.value, nullable=False)
    status = Column(String(50), default=EmploymentStatus.ACTIVE.value, nullable=False)
    employment_type = Column(String(50), default=EmploymentType.FULL_TIME.value, nullable=False)
    date_of_joining = Column(String(20), nullable=False)
    confirmation_date = Column(String(20), nullable=True)
    
    # Hierarchy & Shift Assignment
    branch_id = Column(Integer, ForeignKey("branches.id", ondelete="SET NULL"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    designation_id = Column(Integer, ForeignKey("designations.id", ondelete="SET NULL"), nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    shift_id = Column(Integer, ForeignKey("shifts.id", ondelete="SET NULL"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Auth & Invitation Lifecycle
    auth_user_id = Column(String(255), nullable=True) # Linked Supabase Auth UID
    invitation_token = Column(String(255), nullable=True)
    invited_at = Column(DateTime(timezone=True), nullable=True)
    
    # Location & Contact Details
    work_location = Column(String(150), default="Headquarters")
    address = Column(Text, nullable=True)
    emergency_contact_name = Column(String(100), nullable=True)
    emergency_contact_phone = Column(String(50), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    company = relationship("Company", back_populates="users")
    branch = relationship("Branch", back_populates="users")
    department = relationship("Department", back_populates="users")
    designation = relationship("Designation", back_populates="users")
    
    manager = relationship("User", remote_side=[id], foreign_keys=[manager_id], backref="direct_reports")
    created_by = relationship("User", remote_side=[id], foreign_keys=[created_by_id])
    assigned_shift = relationship("Shift", foreign_keys=[shift_id])
    attendance_records = relationship("AttendanceRecord", back_populates="user", cascade="all, delete-orphan")
    shift_assignments = relationship("ShiftAssignment", back_populates="user", cascade="all, delete-orphan")
    leave_balances = relationship("LeaveBalance", back_populates="user", cascade="all, delete-orphan")
    leave_requests = relationship("LeaveRequest", foreign_keys="[LeaveRequest.user_id]", back_populates="user", cascade="all, delete-orphan")
    time_logs = relationship("TimeLog", back_populates="user", cascade="all, delete-orphan")
    timesheets = relationship("Timesheet", foreign_keys="[Timesheet.user_id]", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("EmployeeDocument", back_populates="user", cascade="all, delete-orphan")
    tickets = relationship("HRTicket", foreign_keys="[HRTicket.user_id]", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    face_enrollment = relationship("FaceEnrollment", foreign_keys="[FaceEnrollment.user_id]", back_populates="user", uselist=False, cascade="all, delete-orphan")
    face_logs = relationship("FaceVerificationLog", back_populates="user", cascade="all, delete-orphan")
    goals = relationship("Goal", back_populates="user", cascade="all, delete-orphan")
    performance_reviews = relationship("PerformanceReview", foreign_keys="[PerformanceReview.user_id]", back_populates="user", cascade="all, delete-orphan")
    onboarding_tasks = relationship("OnboardingTask", back_populates="user", cascade="all, delete-orphan")
    lifecycle_records = relationship("LifecycleRecord", foreign_keys="[LifecycleRecord.user_id]", back_populates="user", cascade="all, delete-orphan")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

