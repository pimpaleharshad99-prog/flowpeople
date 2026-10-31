from sqlalchemy.orm import Session
from app.models.shift import Shift, ShiftAssignment
from app.models.user import User
from typing import Optional

def get_employee_shift_for_date(db: Session, user_id: int, date_str: str) -> Optional[Shift]:
    """
    Finds the shift assigned to an employee on a specific date (YYYY-MM-DD).
    Falls back to company default shift if no specific assignment exists.
    """
    # 1. Check for specific date assignment
    assignment = (
        db.query(ShiftAssignment)
        .filter(
            ShiftAssignment.user_id == user_id,
            ShiftAssignment.start_date <= date_str,
            (ShiftAssignment.end_date.is_(None) | (ShiftAssignment.end_date >= date_str))
        )
        .order_by(ShiftAssignment.start_date.desc())
        .first()
    )
    if assignment:
        return assignment.shift

    # Find employee's company_id
    user = db.query(User).filter(User.id == user_id).first()
    company_id = user.company_id if user else None

    # 2. Fall back to company's default shift
    if company_id:
        default_shift = db.query(Shift).filter(
            Shift.company_id == company_id,
            Shift.is_default == True
        ).first()
        if default_shift:
            return default_shift
            
        # Fallback to any company shift
        company_shift = db.query(Shift).filter(Shift.company_id == company_id).first()
        if company_shift:
            return company_shift

    # 3. Fallback to any default shift or first shift
    default_shift = db.query(Shift).filter(Shift.is_default == True).first()
    if default_shift:
        return default_shift
        
    return db.query(Shift).first()

