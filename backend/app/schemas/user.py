from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.user import UserRole, EmploymentStatus, EmploymentType

class UserBase(BaseModel):
    employee_code: Optional[str] = None # Automatically generated if omitted
    email: str
    first_name: str
    last_name: str
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    blood_group: Optional[str] = None
    role: str = UserRole.EMPLOYEE.value
    status: Optional[str] = EmploymentStatus.PENDING_INVITATION.value
    employment_type: str = EmploymentType.FULL_TIME.value
    date_of_joining: Optional[str] = None
    confirmation_date: Optional[str] = None
    branch_id: Optional[int] = None
    department_id: Optional[int] = None
    designation_id: Optional[int] = None
    manager_id: Optional[int] = None
    shift_id: Optional[int] = None
    work_location: Optional[str] = "Headquarters"
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None

class UserCreate(UserBase):
    password: Optional[str] = "FlowPeople2026!" # Default or temporary password if invited

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    blood_group: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    employment_type: Optional[str] = None
    branch_id: Optional[int] = None
    department_id: Optional[int] = None
    designation_id: Optional[int] = None
    manager_id: Optional[int] = None
    shift_id: Optional[int] = None
    work_location: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None

class UserOut(UserBase):
    id: int
    company_id: int
    is_platform_owner: bool = False
    created_at: datetime
    branch_name: Optional[str] = None
    department_name: Optional[str] = None
    designation_name: Optional[str] = None
    manager_name: Optional[str] = None
    shift_name: Optional[str] = None
    created_by_name: Optional[str] = None
    has_face_enrolled: bool = False
    face_enrollment_status: Optional[str] = None
    invited_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class InviteEmployeeResponse(BaseModel):
    user_id: int
    email: str
    invitation_token: str
    invitation_url: str
    status: str
    invited_at: datetime

class ActivateInviteRequest(BaseModel):
    token: str
    password: str
    auth_user_id: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    company_name: Optional[str] = "FlowCraft Technologies"
    role: Optional[str] = "SUPER_ADMIN"
    employee_code: Optional[str] = None
    phone: Optional[str] = None

class SupabaseSyncRequest(BaseModel):
    email: str
    auth_user_id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
