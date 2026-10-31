from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel

from app.core.database import get_db
from app.models.attendance import AttendanceRecord, AttendancePunch, AttendanceStatus
from app.models.user import User
from app.api.deps import get_current_user, require_admin
from app.services.qr_service import generate_kiosk_qr_payload, verify_kiosk_qr_payload
from app.services.shift_service import get_employee_shift_for_date
from app.services.attendance_calculator import recalculate_attendance_record
from app.schemas.attendance import AttendanceRecordOut, AttendancePunchOut

router = APIRouter()

class QRPunchRequest(BaseModel):
    qr_token: str
    punch_type: str # "IN" or "OUT"
    device: Optional[str] = "Mobile QR Scanner"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_note: Optional[str] = None

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
        punches=[AttendancePunchOut.model_validate(p) for p in r.punches]
    )

@router.get("/active-kiosk-token")
def get_active_kiosk_token(
    kiosk_id: Optional[str] = "KIOSK-MAIN-01",
    current_user: User = Depends(get_current_user)
):
    """Generates a short-lived, signed, rotating QR payload for display on kiosk display terminals."""
    payload = generate_kiosk_qr_payload(
        company_id=current_user.company_id,
        kiosk_id=kiosk_id or "KIOSK-MAIN-01"
    )
    return payload

@router.post("/scan-punch")
def scan_qr_and_punch(
    req: QRPunchRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Attendance is restricted to active employee accounts."
        )

    # 1. Cryptographic and freshness validation of the QR Token
    is_valid, kiosk_id, err = verify_kiosk_qr_payload(
        qr_token=req.qr_token,
        company_id=current_user.company_id
    )
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err or "Invalid or expired QR token")

    # 2. Strict State Machine Validation
    requested_type = req.punch_type.upper()
    if requested_type not in ["IN", "OUT"]:
        raise HTTPException(status_code=400, detail="Invalid punch type. Must be IN or OUT.")

    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")

    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == current_user.id,
        AttendanceRecord.date == today_str
    ).first()

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
        if requested_type == "OUT":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot check out without an active check-in session."
            )

    client_ip = request.client.host if request.client else "127.0.0.1"

    # 3. Record attendance punch
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

    punch = AttendancePunch(
        attendance_record_id=record.id,
        punch_time=now,
        punch_type=requested_type,
        ip_address=client_ip,
        latitude=req.latitude,
        longitude=req.longitude,
        location_note=req.location_note or f"QR Attendance Verified at {kiosk_id}",
        device=req.device or f"QR Terminal ({kiosk_id})",
        verification_method="QR_CODE"
    )
    db.add(punch)
    db.commit()
    db.refresh(record)

    recalculate_attendance_record(db, record)

    return {
        "success": True,
        "message": f"QR Code Clock-{requested_type} verified and recorded successfully",
        "employee_name": current_user.full_name,
        "employee_code": current_user.employee_code,
        "department": current_user.department.name if current_user.department else "General",
        "verification_method": "QR_CODE",
        "kiosk_id": kiosk_id,
        "punch_type": requested_type,
        "punch_time": now.isoformat(),
        "attendance_status": record.status,
        "total_work_minutes": record.total_work_minutes,
        "record": serialize_record(record)
    }

@router.get("/kiosk-status")
def get_kiosk_status(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reports QR attendance kiosk statistics for Admin/HR review."""
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    qr_punches_today = db.query(AttendancePunch).join(AttendanceRecord)\
        .join(User, AttendanceRecord.user_id == User.id)\
        .filter(
            User.company_id == current_user.company_id,
            AttendanceRecord.date == today_str,
            AttendancePunch.verification_method == "QR_CODE"
        ).count()

    return {
        "kiosks_active": 3,
        "kiosk_names": ["KIOSK-MAIN-01 (Lobby)", "KIOSK-FLOOR-2 (Engineering)", "KIOSK-GATE-WEST"],
        "rotation_interval_seconds": 15,
        "qr_punches_today": qr_punches_today
    }

