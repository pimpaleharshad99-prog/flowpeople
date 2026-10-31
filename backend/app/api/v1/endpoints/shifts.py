from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.core.database import get_db
from app.models.shift import Shift, ShiftAssignment
from app.models.user import User
from app.api.deps import get_current_user, require_admin

router = APIRouter()

class ShiftBase(BaseModel):
    name: str
    code: str
    start_time: str
    end_time: str
    expected_work_hours: int = 480
    break_duration_mins: int = 60
    grace_period_mins: int = 15
    early_exit_allowance_mins: int = 15
    half_day_threshold_mins: int = 240
    is_night_shift: bool = False
    is_default: bool = False
    color: str = "#3B82F6"

class ShiftCreate(ShiftBase):
    pass

class ShiftOut(ShiftBase):
    id: int
    company_id: int

    class Config:
        from_attributes = True

class ShiftAssignRequest(BaseModel):
    user_id: int
    shift_id: int
    start_date: str # YYYY-MM-DD
    end_date: Optional[str] = None

@router.get("", response_model=List[ShiftOut])
def list_shifts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Shift).filter(Shift.company_id == current_user.company_id).all()

@router.post("", response_model=ShiftOut)
def create_shift(
    shift_in: ShiftCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    if shift_in.is_default:
        # unset previous default
        db.query(Shift).filter(Shift.company_id == current_user.company_id, Shift.is_default == True).update({"is_default": False})

    shift = Shift(
        company_id=current_user.company_id,
        name=shift_in.name,
        code=shift_in.code,
        start_time=shift_in.start_time,
        end_time=shift_in.end_time,
        expected_work_hours=shift_in.expected_work_hours,
        break_duration_mins=shift_in.break_duration_mins,
        grace_period_mins=shift_in.grace_period_mins,
        early_exit_allowance_mins=shift_in.early_exit_allowance_mins,
        half_day_threshold_mins=shift_in.half_day_threshold_mins,
        is_night_shift=shift_in.is_night_shift,
        is_default=shift_in.is_default,
        color=shift_in.color
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift

@router.post("/assign")
def assign_shift(
    assign_in: ShiftAssignRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    assignment = ShiftAssignment(
        user_id=assign_in.user_id,
        shift_id=assign_in.shift_id,
        start_date=assign_in.start_date,
        end_date=assign_in.end_date
    )
    db.add(assignment)
    db.commit()
    return {"message": "Shift assigned successfully"}

