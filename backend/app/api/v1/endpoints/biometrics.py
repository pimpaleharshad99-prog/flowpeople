from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.biometrics import FaceEnrollment, FaceVerificationLog, BiometricEnrollmentStatus
from app.models.attendance import AttendanceRecord, AttendancePunch, AttendanceStatus
from app.models.user import User
from app.api.deps import get_current_user, require_admin
from app.services.biometric_service import BiometricService, APPROVED_MODEL_VERSION
from app.services.shift_service import get_employee_shift_for_date
from app.services.attendance_calculator import recalculate_attendance_record
from app.schemas.attendance import AttendanceRecordOut, AttendancePunchOut

router = APIRouter()

class FaceEnrollRequest(BaseModel):
    face_vector: str
    consent_given: bool
    quality_score: Optional[float] = 0.95
    liveness_data: Optional[Dict[str, Any]] = None
    target_user_id: Optional[int] = None
    model_version: Optional[str] = APPROVED_MODEL_VERSION

class FaceTestRequest(BaseModel):
    face_data: str
    liveness_data: Dict[str, Any]
    target_user_id: Optional[int] = None
    device: Optional[str] = "Face ID Camera Diagnostics"
    model_version: Optional[str] = APPROVED_MODEL_VERSION

class FacePunchRequest(BaseModel):
    punch_type: str # "IN" or "OUT"
    face_data: str
    liveness_data: Dict[str, Any]
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_note: Optional[str] = None
    device: Optional[str] = "Face ID Camera Terminal"
    model_version: Optional[str] = APPROVED_MODEL_VERSION

class FallbackPunchRequest(BaseModel):
    punch_type: str # "IN" or "OUT"
    reason: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    device: Optional[str] = "Manual Fallback Punch"

class KioskScanPunchRequest(BaseModel):
    face_data: str
    liveness_data: Optional[Dict[str, Any]] = None
    target_user_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    device: Optional[str] = "Entrance Face Recognition Kiosk"
    model_version: Optional[str] = APPROVED_MODEL_VERSION

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
def get_face_enrollment_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    enrollment = BiometricService.get_enrollment(db, current_user.id)
    if not enrollment:
        return {
            "enrolled": False,
            "status": "not_registered",
            "template_version": APPROVED_MODEL_VERSION,
            "is_model_compatible": True,
            "quality_score": 0.0,
            "liveness_verified": False,
            "enrolled_at": None
        }
    is_compatible = (enrollment.template_version in ["v2.0-facenet-norm", "facenet-v1-128"])
    return {
        "enrolled": enrollment.status in [BiometricEnrollmentStatus.VERIFIED.value, "VERIFIED", "ENROLLED"],
        "status": enrollment.status.lower() if enrollment.status else "not_registered",
        "template_version": enrollment.template_version or APPROVED_MODEL_VERSION,
        "is_model_compatible": is_compatible,
        "quality_score": enrollment.quality_score,
        "liveness_verified": enrollment.liveness_verified,
        "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None
    }

@router.post("/enroll")
def enroll_face(
    req: FaceEnrollRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not req.consent_given:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Biometric consent is mandatory to store facial template data"
        )
    target_id = current_user.id
    if req.target_user_id and current_user.role in ["ADMIN", "SUPER_ADMIN", "HR_ADMIN", "COMPANY_ADMIN", "HR_MANAGER"]:
        target_user = db.query(User).filter(User.id == req.target_user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Target employee not found")
        target_id = req.target_user_id

    try:
        enrollment = BiometricService.enroll_face(
            db=db,
            user_id=target_id,
            raw_face_vector=req.face_vector,
            consent_given=req.consent_given,
            quality_score=req.quality_score or 0.95,
            liveness_data=req.liveness_data,
            model_version=req.model_version
        )
        return {
            "success": True,
            "message": f"Face ID successfully enrolled and verified with model '{enrollment.template_version}'",
            "status": "verified",
            "template_version": enrollment.template_version,
            "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/verify-test")
def test_face_verification(
    req: FaceTestRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_id = current_user.id
    if req.target_user_id and current_user.role in ["ADMIN", "SUPER_ADMIN", "HR_ADMIN", "COMPANY_ADMIN", "HR_MANAGER"]:
        target_id = req.target_user_id

    target_user = db.query(User).filter(User.id == target_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Employee not found")

    enrollment = BiometricService.get_enrollment(db, target_id)
    if not enrollment or enrollment.status not in ["ENROLLED", "VERIFIED"]:
        return {
            "success": False,
            "enrolled": False,
            "employee_name": target_user.full_name,
            "message": f"Face ID is not registered for {target_user.full_name}. Please enroll face template first.",
            "confidence": 0.0,
            "liveness": 0.0
        }

    client_ip = request.client.host if request.client else "127.0.0.1"
    matched, confidence, liveness, err = BiometricService.verify_and_match(
        db=db,
        user_id=target_id,
        attempt_type="VERIFY",
        live_face_data=req.face_data,
        liveness_data=req.liveness_data,
        ip_address=client_ip,
        device_info=req.device or "Face ID Camera Diagnostics",
        model_version=req.model_version
    )

    if err and "INCOMPATIBLE_MODEL_VERSION" in err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err
        )

    return {
        "success": matched,
        "enrolled": True,
        "employee_name": target_user.full_name,
        "employee_code": target_user.employee_code,
        "confidence": confidence,
        "liveness": liveness,
        "quality_score": enrollment.quality_score,
        "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None,
        "message": f"Identity match confirmed for {target_user.full_name} ({confidence * 100:.1f}% match confidence)" if matched else (err or "Face verification test failed")
    }

@router.post("/verify-punch")
def verify_face_and_punch(
    punch_req: FacePunchRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Biometric attendance is restricted to active employee accounts."
        )

    enrollment = BiometricService.get_enrollment(db, current_user.id)
    if not enrollment or enrollment.status not in ["ENROLLED", "VERIFIED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Face ID enrollment required before biometric attendance can be used."
        )

    requested_type = punch_req.punch_type.upper()
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

    client_ip = request.client.host if request.client else None
    matched, confidence, liveness, err = BiometricService.verify_and_match(
        db=db,
        user_id=current_user.id,
        attempt_type=requested_type,
        live_face_data=punch_req.face_data,
        liveness_data=punch_req.liveness_data,
        ip_address=client_ip,
        device_info=punch_req.device,
        model_version=punch_req.model_version
    )

    if not matched:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Face verification rejected: {err}"
        )

    # Perform clock punch
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
        latitude=punch_req.latitude,
        longitude=punch_req.longitude,
        location_note=punch_req.location_note or f"Face ID Verified (Conf: {confidence:.2f}, Live: {liveness:.2f})",
        device=punch_req.device or "Face ID Terminal",
        verification_method="FACE"
    )
    db.add(punch)
    db.commit()
    db.refresh(record)

    recalculate_attendance_record(db, record)

    return {
        "success": True,
        "message": f"Face ID {requested_type} recorded successfully",
        "employee_name": current_user.full_name,
        "employee_code": current_user.employee_code,
        "department": current_user.department.name if current_user.department else "General",
        "verification_method": "FACE",
        "punch_type": requested_type,
        "punch_time": now.isoformat(),
        "attendance_status": record.status,
        "total_work_minutes": record.total_work_minutes,
        "confidence": confidence,
        "liveness": liveness,
        "record": serialize_record(record)
    }

@router.post("/fallback-punch")
def fallback_attendance_punch(
    req: FallbackPunchRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    client_ip = request.client.host if request.client else "127.0.0.1"

    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == current_user.id,
        AttendanceRecord.date == today_str
    ).first()

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
        punch_type=req.punch_type.upper(),
        ip_address=client_ip,
        latitude=req.latitude,
        longitude=req.longitude,
        location_note=f"Manual Fallback: {req.reason}",
        device=req.device or "Fallback Punch"
    )
    db.add(punch)

    # Log fallback
    log = FaceVerificationLog(
        user_id=current_user.id,
        attempt_type=req.punch_type.upper(),
        status="FALLBACK_USED",
        confidence_score=0.0,
        liveness_score=0.0,
        failure_reason=req.reason,
        ip_address=client_ip,
        device_info=req.device
    )
    db.add(log)
    db.commit()
    db.refresh(record)

    recalculate_attendance_record(db, record)

    return {
        "success": True,
        "message": f"Fallback {req.punch_type.upper()} recorded with reason",
        "record": serialize_record(record)
    }

@router.post("/kiosk-scan-punch")
@router.post("/kiosk/scan")
def kiosk_scan_face_punch(
    req: KioskScanPunchRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    1:N Kiosk Automatic Face Attendance Terminal:
    1. Employee stands in front of camera.
    2. Camera captures face vector & matches against all enrolled company employees.
    3. Auto-determines whether to Punch IN (Arrival) or Punch OUT (Leaving for the day).
    4. Saves real attendance record & logs to database immediately.
    5. Returns recognized employee details, role, department, action, and timestamp.
    """
    client_ip = request.client.host if request.client else None
    matched_user, confidence, liveness, err = BiometricService.identify_1_to_n(
        db=db,
        live_face_data=req.face_data,
        liveness_data=req.liveness_data,
        ip_address=client_ip,
        device_info=req.device or "Office Entrance Face Kiosk",
        target_user_id=req.target_user_id,
        model_version=req.model_version
    )

    if not matched_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err or "Face Not Recognized. Please Contact HR."
        )

    now = datetime.now(timezone.utc)
    ist = timezone(timedelta(hours=5, minutes=30))
    now_ist = now.astimezone(ist)
    today_str = now_ist.strftime("%Y-%m-%d")
    display_time = now_ist.strftime("%I:%M %p")

    emp_dict = {
        "id": matched_user.id,
        "full_name": matched_user.full_name,
        "employee_code": matched_user.employee_code,
        "role": matched_user.role,
        "role_title": matched_user.designation.name if matched_user.designation else matched_user.role,
        "department": matched_user.department.name if matched_user.department else "General",
        "branch": matched_user.branch.name if matched_user.branch else "Headquarters",
        "avatar_url": matched_user.avatar_url
    }

    # Fetch employee's record for today
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == matched_user.id,
        AttendanceRecord.date == today_str
    ).first()

    # CRITICAL ATTENDANCE STATE MACHINE:
    # 1. No record or no punches today -> First scan = CHECK-IN
    # 2. Checked in (without check out) -> Second separate scan = CHECK-OUT
    #    (With debounce protection against continuous face detection)
    # 3. Already checked in and checked out -> Subsequent scan = IGNORE / COMPLETED
    punch_type = "IN"
    action_label = "CHECK-IN"

    def to_aware_utc(dt: datetime) -> datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    if record and record.punches:
        sorted_punches = sorted(record.punches, key=lambda p: to_aware_utc(p.punch_time))
        in_punches = [p for p in sorted_punches if p.punch_type.upper() == "IN"]
        out_punches = [p for p in sorted_punches if p.punch_type.upper() == "OUT"]

        # Case 3: Both CHECK-IN and CHECK-OUT exist -> Session already completed for today
        if len(in_punches) > 0 and len(out_punches) > 0:
            first_in = in_punches[0]
            last_out = out_punches[-1]
            in_str = to_aware_utc(first_in.punch_time).astimezone(ist).strftime("%I:%M %p")
            out_str = to_aware_utc(last_out.punch_time).astimezone(ist).strftime("%I:%M %p")
            hrs = record.total_work_minutes // 60
            mins = record.total_work_minutes % 60
            return {
                "success": True,
                "matched": True,
                "already_completed": True,
                "punch_type": "COMPLETED",
                "action_label": "ATTENDANCE COMPLETED",
                "punch_time": out_str,
                "timestamp": now.isoformat(),
                "confidence": confidence,
                "liveness": liveness,
                "employee": emp_dict,
                "attendance_status": record.status,
                "total_work_minutes": record.total_work_minutes,
                "working_hours_formatted": f"{hrs}h {mins}m",
                "message": f"Hello {matched_user.first_name}! You have already completed attendance for today (Check-In: {in_str}, Check-Out: {out_str}, Total: {hrs}h {mins}m)."
            }

        # Case 2: Only CHECK-IN exists -> Candidate for CHECK-OUT
        last_punch = sorted_punches[-1]
        if last_punch.punch_type.upper() == "IN":
            diff_secs = (now - to_aware_utc(last_punch.punch_time)).total_seconds()
            if diff_secs < 20:
                # Debounce protection against continuous detection of the same face
                return {
                    "success": True,
                    "matched": True,
                    "is_duplicate_cooldown": True,
                    "punch_type": "IGNORED",
                    "action_label": "DUPLICATE IGNORED",
                    "punch_time": display_time,
                    "timestamp": now.isoformat(),
                    "confidence": confidence,
                    "liveness": liveness,
                    "employee": emp_dict,
                    "attendance_status": record.status,
                    "total_work_minutes": record.total_work_minutes,
                    "message": f"Check-in registered {int(diff_secs)}s ago. Please step away for the next employee."
                }
            
            punch_type = "OUT"
            action_label = "CHECK-OUT"
        else:
            punch_type = "IN"
            action_label = "CHECK-IN"
    else:
        # Case 1: First scan -> CHECK-IN
        punch_type = "IN"
        action_label = "CHECK-IN"

    # Create record if first punch of the day
    if not record:
        shift = get_employee_shift_for_date(db, matched_user.id, today_str)
        record = AttendanceRecord(
            user_id=matched_user.id,
            date=today_str,
            shift_id=shift.id if shift else None,
            status=AttendanceStatus.PRESENT.value
        )
        db.add(record)
        db.flush()

    # Record punch
    punch = AttendancePunch(
        attendance_record_id=record.id,
        punch_time=now,
        punch_type=punch_type,
        ip_address=client_ip,
        latitude=req.latitude,
        longitude=req.longitude,
        location_note=f"Automatic Face Recognition Kiosk ({action_label}) - Conf: {confidence:.2f}",
        device=req.device or "Entrance Face Kiosk",
        verification_method="FACE"
    )
    db.add(punch)
    db.commit()
    db.refresh(record)

    recalculate_attendance_record(db, record)

    # Format success message
    if punch_type == "IN":
        user_msg = f"Welcome {matched_user.first_name}! Check-in successful."
    else:
        hrs = record.total_work_minutes // 60
        mins = record.total_work_minutes % 60
        user_msg = f"Goodbye {matched_user.first_name}! Check-out successful. Total Working Hours: {hrs}h {mins}m."

    hrs = record.total_work_minutes // 60
    mins = record.total_work_minutes % 60

    return {
        "success": True,
        "matched": True,
        "punch_type": punch_type,
        "action_label": f"{action_label} SUCCESSFUL — {display_time}",
        "raw_action": action_label,
        "punch_time": display_time,
        "timestamp": now.isoformat(),
        "confidence": confidence,
        "liveness": liveness,
        "employee": emp_dict,
        "attendance_status": record.status,
        "total_work_minutes": record.total_work_minutes,
        "working_hours_formatted": f"{hrs}h {mins}m",
        "message": user_msg
    }

@router.get("/logs")
def get_biometric_logs(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    # Retrieve logs for users belonging to admin's company
    logs = db.query(FaceVerificationLog).join(User, FaceVerificationLog.user_id == User.id)\
        .filter(User.company_id == current_user.company_id)\
        .order_by(FaceVerificationLog.timestamp.desc())\
        .limit(100)\
        .all()

    return [
        {
            "id": l.id,
            "user_id": l.user_id,
            "user_name": l.user.full_name if l.user else "Unknown",
            "attempt_type": l.attempt_type,
            "status": l.status.lower() if l.status else "unknown",
            "confidence_score": l.confidence_score,
            "liveness_score": l.liveness_score,
            "failure_reason": l.failure_reason,
            "ip_address": l.ip_address,
            "device_info": l.device_info,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None
        }
        for l in logs
    ]

@router.post("/admin/reset/{user_id}")
def reset_user_face_id(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    target_user = db.query(User).filter(User.id == user_id, User.company_id == current_user.company_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Employee not found in your organization")

    ok = BiometricService.reset_or_revoke(db, user_id=user_id, admin_id=current_user.id)
    if not ok:
        raise HTTPException(status_code=400, detail="Employee does not have an active Face ID enrollment")

    return {
        "success": True,
        "message": f"Face ID enrollment revoked for {target_user.full_name}. Employee can re-enroll."
    }

@router.get("/verification-failures")
def get_verification_failures(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List failed verification logs for HR review and auditing."""
    logs = db.query(FaceVerificationLog).join(User, FaceVerificationLog.user_id == User.id)\
        .filter(
            User.company_id == current_user.company_id,
            func.lower(FaceVerificationLog.status).not_in(["success", "verified"])
        )\
        .order_by(FaceVerificationLog.timestamp.desc())\
        .limit(50)\
        .all()

    return [
        {
            "id": l.id,
            "user_id": l.user_id,
            "user_name": l.user.full_name if l.user else "Unknown",
            "employee_code": l.user.employee_code if l.user else "—",
            "attempt_type": l.attempt_type,
            "status": l.status.lower() if l.status else "unknown",
            "confidence_score": l.confidence_score,
            "liveness_score": l.liveness_score,
            "failure_reason": l.failure_reason,
            "ip_address": l.ip_address,
            "device_info": l.device_info,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None
        }
        for l in logs
    ]

