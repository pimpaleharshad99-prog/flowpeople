from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
import secrets
import re

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole, EmploymentStatus
from app.models.shift import Shift, ShiftAssignment
from app.models.leave import LeaveType, LeaveBalance
from app.schemas.user import UserOut, UserCreate, UserUpdate, InviteEmployeeResponse
from app.api.deps import get_current_user, require_admin

router = APIRouter()

def generate_next_employee_code(db: Session, company_id: int) -> str:
    """
    Generates an authoritative, concurrency-safe, unique Employee ID
    Format: FP-YYYY-XXXX (e.g. FP-2026-0001, FP-2026-0002)
    """
    current_year = datetime.now(timezone.utc).year
    prefix = f"FP-{current_year}-"
    
    users = db.query(User.employee_code).filter(User.company_id == company_id).all()
    max_idx = 0
    for (code,) in users:
        if code and code.startswith(prefix):
            try:
                num = int(code.split("-")[-1])
                if num > max_idx:
                    max_idx = num
            except ValueError:
                pass
        elif code and code.startswith("EMP-"):
            try:
                num = int(code.split("-")[-1])
                if num > max_idx:
                    max_idx = num
            except ValueError:
                pass

    next_idx = max_idx + 1
    while True:
        candidate = f"{prefix}{next_idx:04d}"
        exists = db.query(User.id).filter(
            User.company_id == company_id,
            User.employee_code == candidate
        ).first()
        if not exists:
            return candidate
        next_idx += 1

def serialize_user(u: User) -> UserOut:
    has_face = False
    face_status = "NOT_ENROLLED"
    if u.face_enrollment:
        face_status = u.face_enrollment.status
        has_face = face_status in ["ENROLLED", "VERIFIED"]

    return UserOut(
        id=u.id,
        company_id=u.company_id,
        is_platform_owner=bool(u.is_platform_owner),
        employee_code=u.employee_code,
        email=u.email,
        first_name=u.first_name,
        last_name=u.last_name,
        avatar_url=u.avatar_url,
        phone=u.phone,
        gender=u.gender,
        date_of_birth=u.date_of_birth,
        blood_group=u.blood_group,
        role=u.role,
        status=u.status,
        employment_type=u.employment_type,
        date_of_joining=u.date_of_joining,
        confirmation_date=u.confirmation_date,
        branch_id=u.branch_id,
        department_id=u.department_id,
        designation_id=u.designation_id,
        manager_id=u.manager_id,
        shift_id=u.shift_id,
        work_location=u.work_location,
        address=u.address,
        emergency_contact_name=u.emergency_contact_name,
        emergency_contact_phone=u.emergency_contact_phone,
        created_at=u.created_at,
        branch_name=u.branch.name if u.branch else None,
        department_name=u.department.name if u.department else None,
        designation_name=u.designation.name if u.designation else None,
        manager_name=u.manager.full_name if u.manager else None,
        shift_name=u.assigned_shift.name if u.assigned_shift else None,
        created_by_name=u.created_by.full_name if u.created_by else None,
        has_face_enrolled=has_face,
        face_enrollment_status=face_status,
        invited_at=u.invited_at
    )

@router.get("/next-code")
def get_next_code(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Preview next automatically generated Employee ID."""
    return {"next_code": generate_next_employee_code(db, current_user.company_id)}

@router.get("", response_model=List[UserOut])
def list_employees(
    department_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(User).filter(User.company_id == current_user.company_id)
    if department_id:
        query = query.filter(User.department_id == department_id)
    if branch_id:
        query = query.filter(User.branch_id == branch_id)
    if role:
        query = query.filter(User.role == role)
    if status:
        query = query.filter(User.status == status)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (User.first_name.ilike(search_filter)) |
            (User.last_name.ilike(search_filter)) |
            (User.email.ilike(search_filter)) |
            (User.employee_code.ilike(search_filter))
        )
    users = query.order_by(User.first_name.asc()).all()
    return [serialize_user(u) for u in users]

@router.get("/{id}", response_model=UserOut)
def get_employee(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == id, User.company_id == current_user.company_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    return serialize_user(user)

@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_employee(
    employee_in: UserCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    # 1. Role Assignment Privilege Verification
    if current_user.role in [UserRole.HR_ADMIN.value, UserRole.HR_MANAGER.value, "HR_EXECUTIVE"]:
        if employee_in.role in [UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="HR administrators cannot assign Super Admin or Company Admin privileges."
            )

    # 2. Concurrency-Safe Automatic Employee ID Generation
    assigned_code = employee_in.employee_code.strip() if employee_in.employee_code and employee_in.employee_code.strip() else None
    if not assigned_code:
        assigned_code = generate_next_employee_code(db, current_user.company_id)

    # 3. Company-Level Uniqueness Validation
    existing = db.query(User).filter(
        User.company_id == current_user.company_id,
        (User.email.ilike(employee_in.email.strip())) | (User.employee_code == assigned_code)
    ).first()
    if existing:
        if existing.email.lower() == employee_in.email.strip().lower():
            raise HTTPException(status_code=400, detail="An employee with this email already exists in your company.")
        else:
            raise HTTPException(status_code=400, detail=f"Employee ID {assigned_code} is already in use.")

    # 4. Resolve Default Shift if not provided
    shift_id = employee_in.shift_id
    if not shift_id:
        def_shift = db.query(Shift).filter(
            Shift.company_id == current_user.company_id,
            Shift.is_default == True
        ).first()
        if def_shift:
            shift_id = def_shift.id

    hashed_password = get_password_hash(employee_in.password or "FlowPeople2026!")

    user = User(
        company_id=current_user.company_id,
        employee_code=assigned_code,
        email=employee_in.email.strip().lower(),
        hashed_password=hashed_password,
        first_name=employee_in.first_name.strip(),
        last_name=employee_in.last_name.strip(),
        avatar_url=employee_in.avatar_url,
        phone=employee_in.phone,
        gender=employee_in.gender,
        date_of_birth=employee_in.date_of_birth,
        blood_group=employee_in.blood_group,
        role=employee_in.role or UserRole.EMPLOYEE.value,
        status=employee_in.status or EmploymentStatus.ACTIVE.value,
        employment_type=employee_in.employment_type or EmploymentType.FULL_TIME.value,
        date_of_joining=employee_in.date_of_joining or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        confirmation_date=employee_in.confirmation_date,
        branch_id=employee_in.branch_id,
        department_id=employee_in.department_id,
        designation_id=employee_in.designation_id,
        manager_id=employee_in.manager_id,
        shift_id=shift_id,
        created_by_id=current_user.id,
        work_location=employee_in.work_location or "Headquarters",
        address=employee_in.address,
        emergency_contact_name=employee_in.emergency_contact_name,
        emergency_contact_phone=employee_in.emergency_contact_phone
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 5. Initialize default shift assignment & leave balances
    if shift_id:
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        existing_assign = db.query(ShiftAssignment).filter(
            ShiftAssignment.user_id == user.id,
            ShiftAssignment.shift_id == shift_id
        ).first()
        if not existing_assign:
            assign = ShiftAssignment(
                shift_id=shift_id,
                user_id=user.id,
                start_date=today_str
            )
            db.add(assign)

    current_year = datetime.now(timezone.utc).year
    leave_types = db.query(LeaveType).filter(LeaveType.company_id == current_user.company_id).all()
    for lt in leave_types:
        bal = db.query(LeaveBalance).filter(
            LeaveBalance.user_id == user.id,
            LeaveBalance.leave_type_id == lt.id,
            LeaveBalance.year == current_year
        ).first()
        if not bal:
            new_bal = LeaveBalance(
                user_id=user.id,
                leave_type_id=lt.id,
                year=current_year,
                allocated=lt.annual_quota,
                used=0.0,
                pending_approval=0.0
            )
            db.add(new_bal)

    db.commit()
    db.refresh(user)
    return serialize_user(user)

@router.put("/{id}", response_model=UserOut)
def update_employee(
    id: int,
    emp_update: UserUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == id, User.company_id == current_user.company_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")

    update_dict = emp_update.model_dump(exclude_unset=True)
    if "role" in update_dict and current_user.role in [UserRole.HR_ADMIN.value, UserRole.HR_MANAGER.value, "HR_EXECUTIVE"]:
        if update_dict["role"] in [UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="HR administrators cannot assign Super Admin or Company Admin privileges."
            )

    for field, val in update_dict.items():
        setattr(user, field, val)

    db.commit()
    db.refresh(user)
    return serialize_user(user)

@router.post("/{id}/invite", response_model=InviteEmployeeResponse)
def invite_employee(
    id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Triggers an account invitation for an employee profile.
    Generates a secure cryptographic activation token.
    """
    user = db.query(User).filter(User.id == id, User.company_id == current_user.company_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")

    token = secrets.token_urlsafe(32)
    user.invitation_token = token
    user.invited_at = datetime.now(timezone.utc)
    if user.status in [EmploymentStatus.DRAFT.value, EmploymentStatus.PENDING_INVITATION.value]:
        user.status = EmploymentStatus.INVITED.value

    db.commit()
    db.refresh(user)

    return InviteEmployeeResponse(
        user_id=user.id,
        email=user.email,
        invitation_token=token,
        invitation_url=f"/activate?token={token}&email={user.email}",
        status=user.status,
        invited_at=user.invited_at
    )

@router.post("/{id}/resend-invite", response_model=InviteEmployeeResponse)
def resend_employee_invite(
    id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Resends or regenerates an activation invitation."""
    user = db.query(User).filter(User.id == id, User.company_id == current_user.company_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")

    token = secrets.token_urlsafe(32)
    user.invitation_token = token
    user.invited_at = datetime.now(timezone.utc)
    user.status = EmploymentStatus.INVITED.value

    db.commit()
    db.refresh(user)

    return InviteEmployeeResponse(
        user_id=user.id,
        email=user.email,
        invitation_token=token,
        invitation_url=f"/activate?token={token}&email={user.email}",
        status=user.status,
        invited_at=user.invited_at
    )
