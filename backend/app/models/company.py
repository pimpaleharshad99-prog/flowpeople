from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, Time
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    brand_name = Column(String(200), nullable=True) # Custom software/brand title
    logo_url = Column(String(500), nullable=True)
    domain = Column(String(100), nullable=True)
    timezone = Column(String(50), default="UTC")
    currency = Column(String(10), default="USD")
    contact_email = Column(String(150), nullable=True)
    is_active = Column(Boolean, default=True)
    subscription_plan_id = Column(String(50), default="free_trial")
    subscription_status = Column(String(50), default="TRIALING")
    max_employees = Column(Integer, default=10)
    max_admins = Column(Integer, default=1)
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Relationships
    subscriptions = relationship("Subscription", back_populates="company", cascade="all, delete-orphan")
    branches = relationship("Branch", back_populates="company", cascade="all, delete-orphan")
    departments = relationship("Department", back_populates="company", cascade="all, delete-orphan")
    designations = relationship("Designation", back_populates="company", cascade="all, delete-orphan")
    users = relationship("User", back_populates="company", cascade="all, delete-orphan")
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

