from datetime import datetime, timedelta
from typing import Tuple, List
from sqlalchemy.orm import Session
from app.models.leave import LeaveType, LeaveBalance, LeaveRequest, LeaveStatus, LeaveApproval
from app.models.company import Holiday

def calculate_working_days(db: Session, company_id: int, from_date_str: str, to_date_str: str, is_half_day: bool) -> float:
    """
    Computes business days between two dates, excluding weekends (Sat/Sun) and company holidays.
    """
    if is_half_day:
        return 0.5

    d1 = datetime.strptime(from_date_str, "%Y-%m-%d").date()
    d2 = datetime.strptime(to_date_str, "%Y-%m-%d").date()
    if d2 < d1:
        raise ValueError("to_date cannot be earlier than from_date")

    # Fetch company holidays in range
    holidays = {
        h.holiday_date for h in db.query(Holiday).filter(
            Holiday.company_id == company_id,
            Holiday.holiday_date >= from_date_str,
            Holiday.holiday_date <= to_date_str
        ).all()
    }

    count = 0.0
    curr = d1
    while curr <= d2:
        # Check weekend: 5 = Saturday, 6 = Sunday
        if curr.weekday() not in (5, 6) and curr.strftime("%Y-%m-%d") not in holidays:
            count += 1.0
        curr += timedelta(days=1)

    return max(count, 0.5) if count > 0 else 1.0 # Minimum 0.5/1 day if selected

def check_and_deduct_leave(db: Session, user_id: int, leave_type_id: int, day_count: float, year: int) -> Tuple[bool, str, LeaveBalance]:
    """
    Validates that user has sufficient balance and marks it as pending approval.
    """
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.user_id == user_id,
        LeaveBalance.leave_type_id == leave_type_id,
        LeaveBalance.year == year
    ).first()

    if not balance:
        leave_type = db.query(LeaveType).filter(LeaveType.id == leave_type_id).first()
        if not leave_type:
            return False, "Invalid leave type", None
        # Auto-create balance for year with annual quota
        balance = LeaveBalance(
            user_id=user_id,
            leave_type_id=leave_type_id,
            year=year,
            allocated=leave_type.annual_quota,
            used=0.0,
            pending_approval=0.0,
            balance=leave_type.annual_quota
        )
        db.add(balance)
        db.flush()

    leave_type = db.query(LeaveType).filter(LeaveType.id == leave_type_id).first()
    if not leave_type.allow_negative and (balance.balance - balance.pending_approval) < day_count:
        return False, f"Insufficient leave balance. Available: {balance.balance - balance.pending_approval:.1f} days, Requested: {day_count:.1f} days", balance

    balance.pending_approval += day_count
    db.commit()
    db.refresh(balance)
    return True, "Balance reserved", balance

def finalize_leave_approval(db: Session, leave_request: LeaveRequest, approved: bool):
    """
    Updates leave balance when a request is approved or rejected.
    """
    year = int(leave_request.from_date.split("-")[0])
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.user_id == leave_request.user_id,
        LeaveBalance.leave_type_id == leave_request.leave_type_id,
        LeaveBalance.year == year
    ).first()

    if not balance:
        return

    if approved:
        # Transfer from pending to used
        balance.pending_approval = max(0.0, balance.pending_approval - leave_request.day_count)
        balance.used += leave_request.day_count
        balance.balance = max(0.0, balance.allocated - balance.used)
    else:
        # Release reserved pending balance
        balance.pending_approval = max(0.0, balance.pending_approval - leave_request.day_count)

    db.commit()

def refund_cancelled_leave(db: Session, leave_request: LeaveRequest):
    """
    Refunds used or pending leave when cancelled by user.
    """
    year = int(leave_request.from_date.split("-")[0])
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.user_id == leave_request.user_id,
        LeaveBalance.leave_type_id == leave_request.leave_type_id,
        LeaveBalance.year == year
    ).first()

    if not balance:
        return

    if leave_request.status == LeaveStatus.APPROVED.value:
        balance.used = max(0.0, balance.used - leave_request.day_count)
        balance.balance = balance.allocated - balance.used
    elif leave_request.status == LeaveStatus.PENDING.value:
        balance.pending_approval = max(0.0, balance.pending_approval - leave_request.day_count)

    leave_request.status = LeaveStatus.CANCELLED.value
    db.commit()

