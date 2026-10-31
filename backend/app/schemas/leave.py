from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class LeaveTypeOut(BaseModel):
    id: int
    name: str
    code: str
    annual_quota: float
    accrual_frequency: str
    carry_forward_limit: float
    allow_negative: bool
    requires_approval: bool
    color: str
    description: Optional[str] = None

    class Config:
        from_attributes = True

class LeaveBalanceOut(BaseModel):
    id: int
    leave_type_id: int
    leave_type_name: str
    leave_type_code: str
    color: str
    year: int
    allocated: float
    used: float
    pending_approval: float
    balance: float

    class Config:
        from_attributes = True

class LeaveApplyRequest(BaseModel):
    leave_type_id: int
    from_date: str # YYYY-MM-DD
    to_date: str   # YYYY-MM-DD
    is_half_day: bool = False
    half_day_session: str = "NONE" # "NONE", "FIRST_HALF", "SECOND_HALF"
    reason: str
    document_url: Optional[str] = None

class LeaveApprovalAction(BaseModel):
    status: str # "APPROVED" or "REJECTED"
    comments: Optional[str] = None

class LeaveRequestOut(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    employee_code: Optional[str] = None
    department_name: Optional[str] = None
    leave_type_id: int
    leave_type_name: str
    leave_type_code: str
    color: str
    from_date: str
    to_date: str
    day_count: float
    is_half_day: bool
    half_day_session: str
    reason: str
    status: str
    document_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

