from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class PunchRequest(BaseModel):
    punch_type: str # "IN" or "OUT"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_note: Optional[str] = None
    device: Optional[str] = "Web Browser"

class AttendancePunchOut(BaseModel):
    id: int
    punch_time: datetime
    punch_type: str
    ip_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_note: Optional[str] = None
    device: Optional[str] = None
    verification_method: Optional[str] = "FACE"

    class Config:
        from_attributes = True

class AttendanceRecordOut(BaseModel):
    id: int
    user_id: int
    date: str
    shift_id: Optional[int] = None
    first_check_in: Optional[datetime] = None
    last_check_out: Optional[datetime] = None
    total_work_minutes: int
    total_break_minutes: int
    overtime_minutes: int
    late_in_minutes: int
    early_out_minutes: int
    status: str
    is_regularized: bool
    remarks: Optional[str] = None
    punches: List[AttendancePunchOut] = []

    class Config:
        from_attributes = True

class RegularizationRequestCreate(BaseModel):
    attendance_record_id: int
    requested_first_in: datetime
    requested_last_out: datetime
    reason: str

class RegularizationAction(BaseModel):
    status: str # "APPROVED" or "REJECTED"
    review_comments: Optional[str] = None

class RegularizationOut(BaseModel):
    id: int
    attendance_record_id: int
    user_id: int
    user_name: Optional[str] = None
    requested_first_in: datetime
    requested_last_out: datetime
    reason: str
    status: str
    approver_id: Optional[int] = None
    review_comments: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

