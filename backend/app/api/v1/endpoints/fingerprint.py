from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pydantic import BaseModel

from app.core.database import get_db
from app.models.attendance import AttendanceRecord, AttendancePunch, AttendanceStatus
from app.models.biometrics import FingerprintEnrollment, FaceVerificationLog
from app.models.user import User
from app.api.deps import get_current_user, require_admin
from app.services.fingerprint_service import FingerprintService, generate_challenge
from app.services.shift_service import get_employee_shift_for_date
from app.services.attendance_calculator import recalculate_attendance_record
from app.schemas.attendance import AttendanceRecordOut, AttendancePunchOut

router = APIRouter()

class FingerprintEnrollRequest(BaseModel):
    credential_id: str
    public_key: Optional[str] = None
    device_name: Optional[str] = "Platform Biometric / USB Scanner"
    target_user_id: Optional[int] = None

class FingerprintPunchRequest(BaseModel):
    punch_type: str # "IN" or "OUT"
    credential_id: str
    challenge: Optional[str] = None
    signature: Optional[str] = None
    device: Optional[str] = "USB Fingerprint Scanner / WebAuthn"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_note: Optional[str] = None
    target_user_id: Optional[int] = None

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

@router.get("/status")
def get_fingerprint_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    enrollment = FingerprintService.get_enrollment(db, current_user.id)
    return {
        "enrolled": enrollment is not None and enrollment.status == "VERIFIED",
        "credential_id": enrollment.credential_id if enrollment else None,
        "device_name": enrollment.device_name if enrollment else None,
        "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment and enrollment.enrolled_at else None,
        "hardware_support": {
            "webauthn_platform": "Supported natively in modern browsers (Windows Hello, Touch ID, Android Biometrics)",
            "usb_hardware_bridges": [
                "SecuGen WebAPI (Port 8443 / 8000)",
                "DigitalPersona U.are.U WebSDK (Port 11101)",
                "Mantra MFS100 RD Service (Port 11100)",
                "Morpho MSO 1300 Local Bridge"
            ]
        }
    }

@router.get("/challenge")
def get_fingerprint_challenge(
    current_user: User = Depends(get_current_user)
):
    challenge = generate_challenge(current_user.id)
    return {
        "challenge": challenge,
        "rp_name": "FlowPeople Biometric Workforce System",
        "user": {
            "id": str(current_user.id),
            "name": current_user.email,
            "displayName": current_user.full_name
        }
    }

@router.post("/enroll")
def enroll_fingerprint(
    req: FingerprintEnrollRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_id = current_user.id
    if req.target_user_id and current_user.role in ["ADMIN", "SUPER_ADMIN", "HR_ADMIN", "COMPANY_ADMIN", "HR_MANAGER"]:
        target_user = db.query(User).filter(User.id == req.target_user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Target employee not found")
        target_id = req.target_user_id

    try:
        enrollment = FingerprintService.enroll_fingerprint(
            db=db,
            user_id=target_id,
            credential_id=req.credential_id,
            public_key=req.public_key,
            device_name=req.device_name or "Biometric Scanner Terminal"
        )
        return {
            "success": True,
            "message": "Fingerprint credential successfully enrolled and verified.",
            "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None,
            "device": enrollment.device_name
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/verify-punch")
def verify_fingerprint_and_punch(
    req: FingerprintPunchRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Biometric attendance is restricted to active employee accounts."
        )

    target_id = current_user.id
    if req.target_user_id and current_user.role in ["ADMIN", "SUPER_ADMIN", "HR_ADMIN", "COMPANY_ADMIN", "HR_MANAGER"]:
        target_id = req.target_user_id

    target_user = db.query(User).filter(User.id == target_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Employee record not found")

    # 1. Verify biometric assertion
    matched, err = FingerprintService.verify_assertion(
        db=db,
        user_id=target_id,
        credential_id=req.credential_id,
        challenge=req.challenge,
        signature=req.signature,
        device_type=req.device or "Fingerprint Hardware Scanner"
    )
    if not matched:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err or "Fingerprint verification rejected")

    # 2. Strict State Machine Validation
    requested_type = req.punch_type.upper()
    if requested_type not in ["IN", "OUT"]:
        raise HTTPException(status_code=400, detail="Invalid punch type. Must be IN or OUT.")

    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")

    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == target_id,
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
        shift = get_employee_shift_for_date(db, target_id, today_str)
        record = AttendanceRecord(
            user_id=target_id,
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
        location_note=req.location_note or f"Fingerprint Scanner Verified ({req.device or 'Terminal'})",
        device=req.device or "Optical Fingerprint Terminal",
        verification_method="FINGERPRINT"
    )
    db.add(punch)
    db.commit()
    db.refresh(record)

    recalculate_attendance_record(db, record)

    return {
        "success": True,
        "message": f"Fingerprint Clock-{requested_type} recorded successfully",
        "employee_name": target_user.full_name,
        "employee_code": target_user.employee_code,
        "department": target_user.department.name if target_user.department else "General",
        "verification_method": "FINGERPRINT",
        "punch_type": requested_type,
        "punch_time": now.isoformat(),
        "attendance_status": record.status,
        "total_work_minutes": record.total_work_minutes,
        "record": serialize_record(record)
    }

