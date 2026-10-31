from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class DepartmentBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    parent_id: Optional[int] = None
    head_user_id: Optional[int] = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentOut(DepartmentBase):
    id: int
    company_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class DesignationBase(BaseModel):
    name: str
    code: str
    department_id: Optional[int] = None
    description: Optional[str] = None

class DesignationCreate(DesignationBase):
    pass

class DesignationOut(DesignationBase):
    id: int
    company_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class HolidayBase(BaseModel):
    name: str
    holiday_date: str
    is_optional: bool = False
    description: Optional[str] = None

class HolidayCreate(HolidayBase):
    pass

class HolidayOut(HolidayBase):
    id: int
    company_id: int

    class Config:
        from_attributes = True

class CompanyOut(BaseModel):
    id: int
    name: str
    code: str
    logo_url: Optional[str] = None
    domain: Optional[str] = None
    timezone: str
    currency: str

    class Config:
        from_attributes = True

class BranchBase(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = "United States"
    postal_code: Optional[str] = None
    timezone: Optional[str] = "UTC"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geofence_radius_meters: Optional[int] = 150
    is_geofence_enforced: Optional[bool] = True
    is_headquarters: Optional[bool] = False

class BranchCreate(BranchBase):
    pass

class BranchUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    timezone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geofence_radius_meters: Optional[int] = None
    is_geofence_enforced: Optional[bool] = None
    is_headquarters: Optional[bool] = None

class BranchOut(BranchBase):
    id: int
    company_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


