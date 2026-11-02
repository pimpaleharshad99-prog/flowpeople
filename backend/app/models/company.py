from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, Time, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

def gen_uuid():
    return str(uuid.uuid4())

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, index=True, default=gen_uuid)
    name = Column(String(200), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=True)
    brand_name = Column(String(200), nullable=True) # Custom software/brand title
    owner_user_id = Column(Integer, nullable=True) # Organization Owner User ID
    logo_url = Column(String(500), nullable=True)
    domain = Column(String(100), nullable=True)
    timezone = Column(String(50), default="UTC")
    currency = Column(String(10), default="USD")
    contact_email = Column(String(150), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    industry = Column(String(100), nullable=True)
    company_size = Column(String(50), nullable=True)
    status = Column(String(50), default="ACTIVE")
    is_active = Column(Boolean, default=True)
    subscription_plan_id = Column(String(50), default="free_trial")
    subscription_status = Column(String(50), default="TRIALING")
    max_employees = Column(Integer, default=10)
    max_admins = Column(Integer, default=1)
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    subscriptions = relationship("Subscription", back_populates="company", cascade="all, delete-orphan")
    branches = relationship("Branch", back_populates="company", cascade="all, delete-orphan")
    departments = relationship("Department", back_populates="company", cascade="all, delete-orphan")
    designations = relationship("Designation", back_populates="company", cascade="all, delete-orphan")
    users = relationship("User", back_populates="company", cascade="all, delete-orphan")
    members = relationship("OrganizationMember", back_populates="company", cascade="all, delete-orphan")
    shifts = relationship("Shift", back_populates="company", cascade="all, delete-orphan")
    holidays = relationship("Holiday", back_populates="company", cascade="all, delete-orphan")
    leave_types = relationship("LeaveType", back_populates="company", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="company", cascade="all, delete-orphan")
    announcements = relationship("Announcement", back_populates="company", cascade="all, delete-orphan")

class Branch(Base):
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(150), nullable=False) # e.g. "San Francisco HQ", "London Tech Hub"
    code = Column(String(50), nullable=False) # e.g. "SF-HQ", "LDN-01"
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), default="United States")
    postal_code = Column(String(30), nullable=True)
    timezone = Column(String(50), default="UTC")
    
    # Geofencing coordinates for mobile/biometric punch enforcement
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    geofence_radius_meters = Column(Integer, default=150) # In meters
    is_geofence_enforced = Column(Boolean, default=True)
    is_headquarters = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    company = relationship("Company", back_populates="branches")
    users = relationship("User", back_populates="branch")

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(150), nullable=False)
    code = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    parent_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    head_user_id = Column(Integer, nullable=True) # User ID of department head
    created_at = Column(DateTime(timezone=True), default=utcnow)

    company = relationship("Company", back_populates="departments")
    designations = relationship("Designation", back_populates="department", cascade="all, delete-orphan")
    users = relationship("User", back_populates="department")

class Designation(Base):
    __tablename__ = "designations"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=True)
    name = Column(String(150), nullable=False)
    code = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    company = relationship("Company", back_populates="designations")
    department = relationship("Department", back_populates="designations")
    users = relationship("User", back_populates="designation")

class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(150), nullable=False)
    holiday_date = Column(String(20), nullable=False) # Format: YYYY-MM-DD
    is_optional = Column(Boolean, default=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    company = relationship("Company", back_populates="holidays")

class CompanySettings(Base):
    __tablename__ = "company_settings"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), unique=True, nullable=False)
    work_hours_per_day = Column(Float, default=8.0)
    working_days = Column(String(100), default="Monday,Tuesday,Wednesday,Thursday,Friday")
    leave_year_start_month = Column(Integer, default=1) # 1 = January
    auto_approval_regularization = Column(Boolean, default=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, index=True, default=gen_uuid)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), default="EMPLOYEE", nullable=False) # ORGANIZATION_OWNER, HR_ADMIN, MANAGER, EMPLOYEE
    status = Column(String(50), default="ACTIVE", nullable=False) # ACTIVE, PENDING, INVITED, INACTIVE
    joined_at = Column(DateTime(timezone=True), default=utcnow)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (
        UniqueConstraint('company_id', 'user_id', name='uq_company_user_member'),
    )

    company = relationship("Company", back_populates="members")
    user = relationship("User", back_populates="memberships")

