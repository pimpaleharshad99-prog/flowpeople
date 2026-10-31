from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.core.database import get_db
from app.models.user import User, EmploymentStatus
from app.models.attendance import AttendanceRecord, AttendanceStatus, AttendanceRegularization, RegularizationStatus
from app.models.leave import LeaveRequest, LeaveStatus, LeaveType, LeaveBalance
from app.models.timetracker import Timesheet, TimesheetStatus, TimeLog
from app.models.company import Department
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/dashboard-stats")
def get_dashboard_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # 1. Employee headcount
    total_employees = db.query(User).filter(
        User.company_id == current_user.company_id,
        User.status == EmploymentStatus.ACTIVE.value
    ).count()

    # 2. Today's attendance
    today_records = db.query(AttendanceRecord).join(User, AttendanceRecord.user_id == User.id).filter(
        User.company_id == current_user.company_id,
        AttendanceRecord.date == today_str
    ).all()

    present_count = sum(1 for r in today_records if r.status in [AttendanceStatus.PRESENT.value, AttendanceStatus.HALF_DAY.value])
    late_count = sum(1 for r in today_records if r.late_in_minutes > 0)
    
    # 3. On leave today
    on_leave_today = db.query(LeaveRequest).join(User, LeaveRequest.user_id == User.id).filter(
        User.company_id == current_user.company_id,
        LeaveRequest.status == LeaveStatus.APPROVED.value,
        LeaveRequest.from_date <= today_str,
        LeaveRequest.to_date >= today_str
    ).count()

    # 4. Pending approvals
    pending_leaves = db.query(LeaveRequest).join(User, LeaveRequest.user_id == User.id).filter(
        User.company_id == current_user.company_id,
        LeaveRequest.status == LeaveStatus.PENDING.value
    ).count()

    pending_regularizations = db.query(AttendanceRegularization).join(User, AttendanceRegularization.user_id == User.id).filter(
        User.company_id == current_user.company_id,
        AttendanceRegularization.status == RegularizationStatus.PENDING.value
    ).count()

    pending_timesheets = db.query(Timesheet).join(User, Timesheet.user_id == User.id).filter(
        User.company_id == current_user.company_id,
        Timesheet.status == TimesheetStatus.SUBMITTED.value
    ).count()

    # 5. Department breakdown
    departments = db.query(Department).filter(Department.company_id == current_user.company_id).all()
    dept_distribution = []
    for d in departments:
        count = db.query(User).filter(User.department_id == d.id, User.status == EmploymentStatus.ACTIVE.value).count()
        dept_distribution.append({
            "department": d.name,
            "headcount": count
        })

    return {
        "total_employees": total_employees,
        "present_today": present_count,
        "late_today": late_count,
        "on_leave_today": on_leave_today,
        "pending_leave_approvals": pending_leaves,
        "pending_regularizations": pending_regularizations,
        "pending_timesheets": pending_timesheets,
        "department_distribution": dept_distribution
    }

