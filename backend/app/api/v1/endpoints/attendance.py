from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Optional
from app.core.database import get_db
from app.models.attendance import (
    AttendanceRecord, AttendancePunch, AttendanceRegularization,
    AttendanceStatus, PunchType, RegularizationStatus
)
from app.models.user import User
from app.schemas.attendance import (
    PunchRequest, AttendanceRecordOut, AttendancePunchOut,
    RegularizationRequestCreate, RegularizationAction, RegularizationOut
)
from app.services.attendance_calculator import recalculate_attendance_record
from app.services.shift_service import get_employee_shift_for_date
from app.api.deps import get_current_user, require_manager_or_above

router = APIRouter()

def serialize_record(r: AttendanceRecord) -> AttendanceRecordOut:
    return AttendanceRecordOut(
        id=r.id,
        user_id=r.user_id,
        date=r.date,
        shift_id=r.shift_id,
        first_check_in=r.first_check_in,
        last_check_out=r.last_check_out,
        total_work_minutes=r.total_work_minutes,
        total_break_minutes=r.total_break_minutes,
        overtime_minutes=r.overtime_minutes,
        late_in_minutes=r.late_in_minutes,
        early_out_minutes=r.early_out_minutes,
        status=r.status,
        is_regularized=r.is_regularized,
        remarks=r.remarks,
        punches=[AttendancePunchOut.from_orm(p) for p in r.punches]
    )

@router.post("/punch", response_model=AttendanceRecordOut)
def record_punch(
    punch_req: PunchRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")

    if current_user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Attendance operations are restricted to active employee accounts."
        )

    requested_type = punch_req.punch_type.upper()
    if requested_type not in ["IN", "OUT"]:
        raise HTTPException(status_code=400, detail="Invalid punch type. Must be IN or OUT.")

    # Find or create today's record
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == current_user.id,
        AttendanceRecord.date == today_str
    ).first()

    # Strict attendance state transition validation
    if record and record.punches:
        last_punch = sorted(record.punches, key=lambda p: p.punch_time)[-1]
        last_type = last_punch.punch_type.upper()
        if requested_type == "IN" and last_type == "IN":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Active check-in session already in progress. Please check out first."
            )
        if requested_type == "OUT" and last_type == "OUT":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Already checked out. Please check in before checking out again."
            )
    else:
        # No punches today yet
        if requested_type == "OUT":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot check out without an active check-in session."
            )

    if not record:
        shift = get_employee_shift_for_date(db, current_user.id, today_str)
        record = AttendanceRecord(
            user_id=current_user.id,
            date=today_str,
            shift_id=shift.id if shift else None,
            status=AttendanceStatus.PRESENT.value
        )
        db.add(record)
        db.flush()

    # Determine IP
    client_ip = request.client.host if request.client else "127.0.0.1"

    punch = AttendancePunch(
        attendance_record_id=record.id,
        punch_time=now,
        punch_type=punch_req.punch_type.upper(),
        ip_address=client_ip,
        latitude=punch_req.latitude,
        longitude=punch_req.longitude,
        location_note=punch_req.location_note,
        device=punch_req.device or "Web Browser"
    )
    db.add(punch)
    db.commit()
    db.refresh(record)

    # Recalculate working duration, breaks, late in, overtime
    recalculate_attendance_record(db, record)
    return serialize_record(record)

@router.get("/status")
def get_today_punch_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == current_user.id,
        AttendanceRecord.date == today_str
    ).first()

    if not record or not record.punches:
        return {
            "is_checked_in": False,
            "first_check_in": None,
            "last_check_out": None,
            "total_work_minutes": 0,
            "status": "NOT_PUNCHED_YET"
        }

    recalculate_attendance_record(db, record)
    last_punch = sorted(record.punches, key=lambda p: p.punch_time)[-1]
    is_checked_in = (last_punch.punch_type == PunchType.IN.value)

    return {
        "is_checked_in": is_checked_in,
        "first_check_in": record.first_check_in,
        "last_check_out": record.last_check_out,
        "total_work_minutes": record.total_work_minutes,
        "total_break_minutes": record.total_break_minutes,
        "late_in_minutes": record.late_in_minutes,
        "overtime_minutes": record.overtime_minutes,
        "status": record.status
    }

@router.get("/my-records", response_model=List[AttendanceRecordOut])
def get_my_records(
    month: Optional[str] = None, # YYYY-MM
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(AttendanceRecord).filter(AttendanceRecord.user_id == current_user.id)
    if month:
        query = query.filter(AttendanceRecord.date.like(f"{month}%"))
    records = query.order_by(AttendanceRecord.date.desc()).all()
    return [serialize_record(r) for r in records]

@router.get("/employee-history/{user_id}", response_model=List[AttendanceRecordOut])
def get_employee_history(
    user_id: int,
    month: Optional[str] = None,
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Employee not found")

    query = db.query(AttendanceRecord).filter(AttendanceRecord.user_id == user_id)
    if month:
        query = query.filter(AttendanceRecord.date.like(f"{month}%"))
    records = query.order_by(AttendanceRecord.date.desc()).limit(60).all()
    return [serialize_record(r) for r in records]

@router.get("/daily-matrix", response_model=List[AttendanceRecordOut])
def get_daily_attendance_matrix(
    date: str = Query(..., description="YYYY-MM-DD"),
    department_id: Optional[int] = None,
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    query = db.query(AttendanceRecord).join(User).filter(
        User.company_id == current_user.company_id,
        AttendanceRecord.date == date
    )
    if department_id:
        query = query.filter(User.department_id == department_id)
        
    records = query.all()
    return [serialize_record(r) for r in records]

@router.post("/regularize", response_model=RegularizationOut)
def request_regularization(
    req: RegularizationRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.id == req.attendance_record_id,
        AttendanceRecord.user_id == current_user.id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    reg = AttendanceRegularization(
        attendance_record_id=record.id,
        user_id=current_user.id,
        requested_first_in=req.requested_first_in,
        requested_last_out=req.requested_last_out,
        reason=req.reason,
        status=RegularizationStatus.PENDING.value
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return RegularizationOut(
        id=reg.id,
        attendance_record_id=reg.attendance_record_id,
        user_id=reg.user_id,
        user_name=current_user.full_name,
        requested_first_in=reg.requested_first_in,
        requested_last_out=reg.requested_last_out,
        reason=reg.reason,
        status=reg.status,
        created_at=reg.created_at
    )

@router.get("/regularizations", response_model=List[RegularizationOut])
def list_pending_regularizations(
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    admin_roles = ["SUPER_ADMIN", "ADMIN", "HR_ADMIN", "HR_MANAGER", "HR_EXECUTIVE", "COMPANY_ADMIN"]
    query = db.query(AttendanceRegularization).join(User, AttendanceRegularization.user_id == User.id).filter(
        User.company_id == current_user.company_id,
        AttendanceRegularization.status == RegularizationStatus.PENDING.value
    )
    if current_user.role not in admin_roles:
        query = query.filter(User.manager_id == current_user.id)
    regs = query.all()

    return [
        RegularizationOut(
            id=r.id,
            attendance_record_id=r.attendance_record_id,
            user_id=r.user_id,
            user_name=r.user.full_name if r.user else None,
            requested_first_in=r.requested_first_in,
            requested_last_out=r.requested_last_out,
            reason=r.reason,
            status=r.status,
            approver_id=r.approver_id,
            review_comments=r.review_comments,
            reviewed_at=r.reviewed_at,
            created_at=r.created_at
        )
        for r in regs
    ]

@router.put("/regularizations/{id}", response_model=RegularizationOut)
def review_regularization(
    id: int,
    action: RegularizationAction,
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    reg = db.query(AttendanceRegularization).join(User, AttendanceRegularization.user_id == User.id).filter(
        AttendanceRegularization.id == id,
        User.company_id == current_user.company_id
    ).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Regularization request not found in your company")

    admin_roles = ["SUPER_ADMIN", "ADMIN", "HR_ADMIN", "HR_MANAGER", "HR_EXECUTIVE", "COMPANY_ADMIN"]
    if current_user.role not in admin_roles and reg.user.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to review regularizations for this employee")

    reg.status = action.status.upper()
    reg.approver_id = current_user.id
    reg.review_comments = action.review_comments
    reg.reviewed_at = datetime.now(timezone.utc)

    if reg.status == RegularizationStatus.APPROVED.value:
        record = reg.attendance_record
        record.first_check_in = reg.requested_first_in
        record.last_check_out = reg.requested_last_out
        record.is_regularized = True
        record.status = AttendanceStatus.PRESENT.value
        # Recompute hours from requested times
        duration_secs = (reg.requested_last_out - reg.requested_first_in).total_seconds()
        record.total_work_minutes = max(0, int(duration_secs // 60))

    db.commit()
    db.refresh(reg)

    return RegularizationOut(
        id=reg.id,
        attendance_record_id=reg.attendance_record_id,
        user_id=reg.user_id,
        user_name=reg.user.full_name if reg.user else None,
        requested_first_in=reg.requested_first_in,
        requested_last_out=reg.requested_last_out,
        reason=reg.reason,
        status=reg.status,
        approver_id=reg.approver_id,
        review_comments=reg.review_comments,
        reviewed_at=reg.reviewed_at,
        created_at=reg.created_at
    )

@router.get("/hr-dashboard")
def get_hr_attendance_dashboard(
    date: Optional[str] = None, # Defaults to today YYYY-MM-DD
    branch_id: Optional[int] = None,
    department_id: Optional[int] = None,
    search: Optional[str] = None,
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    """
    Comprehensive real-time HR Attendance Dashboard KPI metrics and roster.
    """
    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    user_query = db.query(User).filter(
        User.company_id == current_user.company_id,
        User.status == "ACTIVE"
    )
    if branch_id:
        user_query = user_query.filter(User.branch_id == branch_id)
    if department_id:
        user_query = user_query.filter(User.department_id == department_id)
    if search:
        s = f"%{search}%"
        user_query = user_query.filter(
            (User.first_name.ilike(s)) | (User.last_name.ilike(s)) | (User.employee_code.ilike(s))
        )

    active_users = user_query.order_by(User.first_name.asc()).all()
    total_active_employees = len(active_users)
    user_ids = [u.id for u in active_users]

    from app.models.biometrics import FaceEnrollment, BiometricEnrollmentStatus
    enrolled_user_ids = set(
        r[0] for r in db.query(FaceEnrollment.user_id).filter(
            FaceEnrollment.status == BiometricEnrollmentStatus.VERIFIED.value
        ).all()
    )

    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id.in_(user_ids),
        AttendanceRecord.date == target_date
    ).all() if user_ids else []

    records_by_user = {r.user_id: r for r in records}

    present_count = 0
    late_count = 0
    currently_checked_in = 0
    checked_out_today = 0
    employee_attendance_list = []

    for u in active_users:
        rec = records_by_user.get(u.id)
        has_face = u.id in enrolled_user_ids
        if rec and rec.punches:
            present_count += 1
            if rec.late_in_minutes > 0:
                late_count += 1
            last_p = sorted(rec.punches, key=lambda p: p.punch_time)[-1]
            is_in = (last_p.punch_type == "IN")
            if is_in:
                currently_checked_in += 1
            else:
                checked_out_today += 1

            employee_attendance_list.append({
                "user_id": u.id,
                "employee_code": u.employee_code,
                "full_name": u.full_name,
                "avatar_url": u.avatar_url,
                "role": u.role,
                "role_title": u.designation.name if u.designation else u.role,
                "department_name": u.department.name if u.department else "—",
                "branch_name": u.branch.name if u.branch else "—",
                "status": "CHECKED_IN" if is_in else "PRESENT",
                "first_check_in": rec.first_check_in.isoformat() if rec.first_check_in else None,
                "last_check_out": rec.last_check_out.isoformat() if rec.last_check_out else None,
                "total_work_minutes": rec.total_work_minutes,
                "late_in_minutes": rec.late_in_minutes,
                "is_regularized": rec.is_regularized,
                "punch_count": len(rec.punches),
                "last_punch_type": last_p.punch_type,
                "verification_method": last_p.verification_method or "FACE",
                "has_face_enrolled": has_face
            })
        else:
            employee_attendance_list.append({
                "user_id": u.id,
                "employee_code": u.employee_code,
                "full_name": u.full_name,
                "avatar_url": u.avatar_url,
                "role": u.role,
                "role_title": u.designation.name if u.designation else u.role,
                "department_name": u.department.name if u.department else "—",
                "branch_name": u.branch.name if u.branch else "—",
                "status": "ABSENT",
                "first_check_in": None,
                "last_check_out": None,
                "total_work_minutes": 0,
                "late_in_minutes": 0,
                "is_regularized": False,
                "punch_count": 0,
                "last_punch_type": None,
                "verification_method": None,
                "has_face_enrolled": has_face
            })

    absent_count = max(0, total_active_employees - present_count)

    pending_regs = db.query(AttendanceRegularization).join(
        User, AttendanceRegularization.user_id == User.id
    ).filter(
        User.company_id == current_user.company_id,
        AttendanceRegularization.status == "PENDING"
    ).count()

    from app.models.biometrics import FaceVerificationLog
    failed_logs = db.query(FaceVerificationLog).join(
        User, FaceVerificationLog.user_id == User.id
    ).filter(
        User.company_id == current_user.company_id,
        FaceVerificationLog.status != "SUCCESS"
    ).count()

    return {
        "date": target_date,
        "total_employees": total_active_employees,
        "present_today": present_count,
        "absent_today": absent_count,
        "late_arrivals": late_count,
        "currently_checked_in": currently_checked_in,
        "checked_out_today": checked_out_today,
        "incomplete_attendance": currently_checked_in,
        "pending_regularizations": pending_regs,
        "failed_verifications_count": failed_logs,
        "employees": employee_attendance_list
    }


