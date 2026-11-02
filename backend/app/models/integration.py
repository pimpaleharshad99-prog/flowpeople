from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
import enum
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

def gen_uuid():
    return str(uuid.uuid4())

class IntegrationProvider(str, enum.Enum):
    GOOGLE_DRIVE = "google_drive"

class ConnectionStatus(str, enum.Enum):
    NOT_CONNECTED = "NOT_CONNECTED"
    CONNECTING = "CONNECTING"
    CONNECTED = "CONNECTED"
    SYNCING = "SYNCING"
    SYNC_FAILED = "SYNC_FAILED"
    REAUTH_REQUIRED = "REAUTH_REQUIRED"
    CONFIG_UNAVAILABLE = "CONFIG_UNAVAILABLE"

class UploadStatus(str, enum.Enum):
    PENDING = "PENDING"
    UPLOADING = "UPLOADING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    RETRYING = "RETRYING"

class OrganizationIntegration(Base):
    __tablename__ = "organization_integrations"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, index=True, default=gen_uuid)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_uuid = Column(String(36), index=True, nullable=True)
    provider = Column(String(50), default=IntegrationProvider.GOOGLE_DRIVE.value, nullable=False, index=True)
    connected_account_email = Column(String(255), nullable=True)
    encrypted_refresh_token = Column(Text, nullable=True)
    access_token = Column(Text, nullable=True)
    access_token_expiry = Column(DateTime(timezone=True), nullable=True)

    # Dedicated Google Drive Folder IDs
    drive_root_folder_id = Column(String(255), nullable=True)       # Root "FlowPeople" folder
    drive_company_folder_id = Column(String(255), nullable=True)    # "Company_Name" folder
    drive_attendance_folder_id = Column(String(255), nullable=True) # "Attendance"
    drive_employees_folder_id = Column(String(255), nullable=True)  # "Employees"
    drive_payroll_folder_id = Column(String(255), nullable=True)    # "Payroll"
    drive_leave_folder_id = Column(String(255), nullable=True)      # "Leave"

    connection_status = Column(String(50), default=ConnectionStatus.NOT_CONNECTED.value, nullable=False)
    auto_attendance_reports = Column(Boolean, default=True)
    auto_monthly_reports = Column(Boolean, default=True)
    last_successful_sync = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (
        UniqueConstraint("company_id", "provider", name="uq_org_integration_provider"),
    )

    company = relationship("Company")

class OrganizationDriveUpload(Base):
    __tablename__ = "organization_drive_uploads"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, index=True, default=gen_uuid)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_uuid = Column(String(36), index=True, nullable=True)
    report_type = Column(String(100), nullable=False) # e.g. "DAILY_ATTENDANCE", "MONTHLY_ATTENDANCE", "LEAVE_SUMMARY", "PAYSLIP", "MANUAL_UPLOAD"
    file_name = Column(String(255), nullable=False)
    file_size_bytes = Column(Integer, default=0)
    mime_type = Column(String(100), default="application/pdf")
    drive_file_id = Column(String(255), nullable=True)
    drive_folder_id = Column(String(255), nullable=True)
    drive_web_view_link = Column(String(1000), nullable=True)
    upload_status = Column(String(50), default=UploadStatus.PENDING.value)
    retry_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    company = relationship("Company")
