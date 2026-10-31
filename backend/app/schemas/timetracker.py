from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class TaskOut(BaseModel):
    id: int
    project_id: int
    name: str
    description: Optional[str] = None
    billable: bool
    estimated_hours: float
    status: str

    class Config:
        from_attributes = True

class ProjectOut(BaseModel):
    id: int
    name: str
    code: str
    client_name: Optional[str] = None
    description: Optional[str] = None
    budget_hours: float
    status: str
    tasks: List[TaskOut] = []

    class Config:
        from_attributes = True

class TimeLogCreate(BaseModel):
    project_id: int
    task_id: int
    log_date: str # YYYY-MM-DD
    hours: float
    description: Optional[str] = None
    is_billable: bool = True

class TimeLogOut(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    project_id: int
    project_name: Optional[str] = None
    task_id: int
    task_name: Optional[str] = None
    timesheet_id: Optional[int] = None
    log_date: str
    hours: float
    description: Optional[str] = None
    is_billable: bool
    created_at: datetime

    class Config:
        from_attributes = True

class TimesheetSubmitRequest(BaseModel):
    period_start: str # YYYY-MM-DD
    period_end: str   # YYYY-MM-DD

class TimesheetAction(BaseModel):
    status: str # "APPROVED" or "REJECTED"
    review_comments: Optional[str] = None

class TimesheetOut(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    period_start: str
    period_end: str
    total_hours: float
    status: str
    approver_id: Optional[int] = None
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    review_comments: Optional[str] = None

    class Config:
        from_attributes = True

