from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class IntegrationStatusOut(BaseModel):
    configured: bool
    connection_status: str
    connected_account_email: Optional[str] = None
    auto_attendance_reports: bool = True
    auto_monthly_reports: bool = True
    last_successful_sync: Optional[datetime] = None
    last_error: Optional[str] = None
    drive_root_folder_id: Optional[str] = None
    drive_company_folder_id: Optional[str] = None
    total_uploads_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class IntegrationConnectOut(BaseModel):
    authorization_url: str
    state: str

class IntegrationSettingsIn(BaseModel):
    auto_attendance_reports: Optional[bool] = None
    auto_monthly_reports: Optional[bool] = None

class ManualUploadIn(BaseModel):
    report_type: str = "DAILY_ATTENDANCE" # DAILY_ATTENDANCE, DAILY_ATTENDANCE_CSV, MONTHLY_ATTENDANCE, LEAVE_SUMMARY, PAYROLL_SUMMARY, MANUAL_UPLOAD
    date: Optional[str] = None
    file_name: Optional[str] = None
    content_base64: Optional[str] = None
    mime_type: Optional[str] = None

class DriveUploadOut(BaseModel):
    id: int
    uuid: str
    report_type: str
    file_name: str
    file_size_bytes: int
    mime_type: str
    drive_file_id: Optional[str] = None
    drive_web_view_link: Optional[str] = None
    upload_status: str
    error_message: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
