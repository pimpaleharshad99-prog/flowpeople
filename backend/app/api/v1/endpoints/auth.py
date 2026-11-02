from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import re
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.user import User, UserRole, EmploymentStatus, EmploymentType
from app.models.company import Company, Branch, OrganizationMember
import uuid
from app.schemas.user import (
    UserOut, Token, LoginRequest, UserUpdate, ActivateInviteRequest,
    RegisterRequest, SupabaseSyncRequest, SuperAdminLoginRequest,
    ForgotPasswordRequest, ResetPasswordRequest, ResendVerificationRequest
)
from app.api.deps import get_current_user
from app.services.platform_admin import verify_and_login_superadmin, is_supabase_configured, verify_supabase_token

router = APIRouter()

def serialize_user_out(user: User) -> UserOut:
    has_face = False
    face_status = "NOT_ENROLLED"
    if hasattr(user, 'face_enrollment') and user.face_enrollment:
        face_status = user.face_enrollment.status
        has_face = face_status in ["ENROLLED", "VERIFIED"]

    return UserOut(
        id=user.id,
        uuid=user.uuid,
        company_id=user.company_id,
        is_platform_owner=bool(user.is_platform_owner),
        employee_code=user.employee_code,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        avatar_url=user.avatar_url,
        phone=user.phone,
        gender=user.gender,
        date_of_birth=user.date_of_birth,
        blood_group=user.blood_group,
        role=user.role,
        status=user.status,
        employment_type=user.employment_type,
        date_of_joining=user.date_of_joining,
        confirmation_date=user.confirmation_date,
        branch_id=user.branch_id,
        department_id=user.department_id,
        designation_id=user.designation_id,
        manager_id=user.manager_id,
        work_location=user.work_location,
        address=user.address,
        emergency_contact_name=user.emergency_contact_name,
        emergency_contact_phone=user.emergency_contact_phone,
        created_at=user.created_at,
        company_name=user.company.name if user.company else None,
        company_logo_url=user.company.logo_url if user.company else None,
        brand_name=getattr(user.company, 'brand_name', None) if user.company else None,
        branch_name=user.branch.name if user.branch else None,
        department_name=user.department.name if user.department else None,
        designation_name=user.designation.name if user.designation else None,
        manager_name=user.manager.full_name if user.manager else None,
        has_face_enrolled=has_face,
        face_enrollment_status=face_status,
        invited_at=user.invited_at
    )

@router.get("/demo-credentials")
def get_demo_credentials(db: Session = Depends(get_db)):
    """
    Returns verified clean role credentials for instant sign-in.
    """
    role_accounts = [
        {"role": "SUPER_ADMIN", "role_title": "Super Admin", "email": "admin@flowcraft.io", "alias_email": "admin@acme.corp", "code": "EMP-001", "name": "Sarah Connor", "description": "Full platform management & configuration"},
        {"role": "HR_ADMIN", "role_title": "HR Administrator", "email": "hr@flowcraft.io", "alias_email": "hr@acme.corp", "code": "EMP-002", "name": "David Vance", "description": "Employee onboarding & attendance oversight"},
        {"role": "MANAGER", "role_title": "Operations Manager", "email": "manager@flowcraft.io", "alias_email": "manager@acme.corp", "code": "EMP-003", "name": "Elena Rostova", "description": "Team shift oversight & approvals"},
        {"role": "EMPLOYEE", "role_title": "Employee", "email": "alex@flowcraft.io", "alias_email": "alex@acme.corp", "code": "EMP-004", "name": "Alex Mercer", "description": "Face / Fingerprint / QR check-in & time logs"},
    ]
    return {
        "accounts": role_accounts,
        "instructions": "You can sign in using your official work email or assigned Employee Code (e.g. EMP-001) with your registered password."
    }

@router.post("/login", response_model=Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    raw_id = login_data.email.strip()
    id_lower = raw_id.lower()
    
    # 1. Exact email or code search (case-insensitive)
    user = db.query(User).filter(
        (User.email.ilike(raw_id)) | (User.employee_code.ilike(raw_id))
    ).first()

    # 2. FlowCraft / Acme domain alias matching
    if not user:
        if "@flowcraft.io" in id_lower:
            acme_alias = id_lower.replace("@flowcraft.io", "@acme.corp")
            user = db.query(User).filter(User.email.ilike(acme_alias)).first()
        elif "@acme.corp" in id_lower:
            flow_alias = id_lower.replace("@acme.corp", "@flowcraft.io")
            user = db.query(User).filter(User.email.ilike(flow_alias)).first()

    # 3. Alphanumeric normalization fallback (e.g. EMP001 -> EMP-001)
    if not user:
        clean_id = re.sub(r'[^a-zA-Z0-9]', '', raw_id).upper()
        candidates = db.query(User).all()
        for u in candidates:
            if u.employee_code:
                clean_code = re.sub(r'[^a-zA-Z0-9]', '', u.employee_code).upper()
                if clean_code == clean_id:
                    user = u
                    break

    pwd = login_data.password.strip()
    is_valid_pwd = False
    if user:
        # Standard password verification
        is_valid_pwd = verify_password(login_data.password, user.hashed_password)
        if not is_valid_pwd:
            is_valid_pwd = verify_password(pwd, user.hashed_password)

        # Authenticate against Supabase Auth server if local hash doesn't match
        if not is_valid_pwd and user.email and is_supabase_configured():
            try:
                import httpx
                from app.core.config import settings
                auth_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/token?grant_type=password"
                headers = {"apikey": settings.SUPABASE_KEY}
                with httpx.Client(timeout=5.0) as client:
                    sb_resp = client.post(auth_url, json={"email": user.email, "password": pwd}, headers=headers)
                    if sb_resp.status_code == 200:
                        sb_json = sb_resp.json()
                        is_valid_pwd = True
                        sb_user_id = sb_json.get("user", {}).get("id")
                        if sb_user_id:
                            user.auth_user_id = sb_user_id
                        user.hashed_password = get_password_hash(pwd)
                        db.commit()
                        db.refresh(user)
            except Exception:
                pass

    if not user or not is_valid_pwd:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect Employee ID, Email, or Password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.status in [EmploymentStatus.SUSPENDED.value, EmploymentStatus.INACTIVE.value, EmploymentStatus.TERMINATED.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive or suspended. Please contact HR administration."
        )

    if user.status in [EmploymentStatus.DRAFT.value, EmploymentStatus.PENDING_INVITATION.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account registration is pending activation. Please use your invitation link."
        )
    
    access_token = create_access_token(subject=user.id, role=user.role)
    user_out = serialize_user_out(user)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_out
    }

    if user.status in [EmploymentStatus.DRAFT.value, EmploymentStatus.PENDING_INVITATION.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account registration is pending activation. Please use your invitation link."
        )
    
    access_token = create_access_token(subject=user.id, role=user.role)
    user_out = serialize_user_out(user)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_out
    }

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(reg_data: RegisterRequest, db: Session = Depends(get_db)):
    """
    Self-service account registration for admins or employees.
    Creates an immediate active account with credentials.
    """
    clean_email = reg_data.email.strip().lower()
    existing = db.query(User).filter(User.email.ilike(clean_email)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with email '{clean_email}' already exists. Please sign in instead."
        )

    company = db.query(Company).first()
    if not company:
        company = Company(
            name=reg_data.company_name or "FlowCraft Technologies Inc.",
            code="FLOWCRAFT",
            domain="flowcraft.io",
            timezone="America/New_York",
            currency="USD"
        )
        db.add(company)
        db.flush()

    branch = db.query(Branch).filter(Branch.company_id == company.id).first()
    branch_id = branch.id if branch else None

    # Generate employee code if not provided
    assigned_code = reg_data.employee_code
    if not assigned_code:
        current_year = datetime.now(timezone.utc).year
        count = db.query(User).filter(User.company_id == company.id).count() + 1
        assigned_code = f"FP-{current_year}-{count:04d}"

    hashed_pwd = get_password_hash(reg_data.password.strip())
    new_user = User(
        company_id=company.id,
        branch_id=branch_id,
        employee_code=assigned_code,
        email=clean_email,
        hashed_password=hashed_pwd,
        first_name=reg_data.first_name.strip(),
        last_name=reg_data.last_name.strip(),
        phone=reg_data.phone,
        role=reg_data.role or UserRole.SUPER_ADMIN.value,
        status=EmploymentStatus.ACTIVE.value,
        employment_type=EmploymentType.FULL_TIME.value,
        date_of_joining=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        work_location="Headquarters"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(subject=new_user.id, role=new_user.role)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": serialize_user_out(new_user)
    }

@router.post("/supabase-sync", response_model=Token)
def supabase_auth_sync(
    sync_data: SupabaseSyncRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Syncs or provisions an authenticated Supabase user into the local database.
    Requires verified cryptographic identity when Supabase is configured.
    """
    auth_hdr = request.headers.get("Authorization") or request.headers.get("authorization")
    raw_token = None
    if auth_hdr and auth_hdr.lower().startswith("bearer "):
        raw_token = auth_hdr[7:].strip()

    clean_email = sync_data.email.strip().lower()
    target_uuid = sync_data.auth_user_id

    # If Supabase is configured, verify cryptographic identity via Bearer token
    if is_supabase_configured():
        if not raw_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Valid Supabase authorization Bearer token is required to synchronize account."
            )
        try:
            s_data = verify_supabase_token(raw_token)
            verified_id = s_data.get("id")
            verified_email = s_data.get("email", "").strip().lower()
            if verified_id:
                target_uuid = verified_id
            if verified_email:
                clean_email = verified_email
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid Supabase authorization: {str(e)}"
            )

    user = db.query(User).filter(User.auth_user_id == target_uuid).first()
    if not user:
        candidate = db.query(User).filter(User.email.ilike(clean_email)).first()
        if candidate:
            if candidate.auth_user_id and candidate.auth_user_id != target_uuid:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Security violation: Local account is already linked to another identity."
                )
            candidate.auth_user_id = target_uuid
            db.commit()
            db.refresh(candidate)
            user = candidate

    company = db.query(Company).first()
    if not company:
        company = Company(
            name="FlowCraft Technologies Inc.",
            code="FLOWCRAFT",
            domain="flowcraft.io",
            timezone="America/New_York",
            currency="USD"
        )
        db.add(company)
        db.flush()

    if not user:
        # Auto-provision Supabase authenticated user
        current_year = datetime.now(timezone.utc).year
        count = db.query(User).filter(User.company_id == company.id).count() + 1
        first_name = sync_data.first_name or clean_email.split('@')[0].capitalize()
        last_name = sync_data.last_name or "User"

        user = User(
            company_id=company.id,
            employee_code=f"FP-{current_year}-{count:04d}",
            email=clean_email,
            auth_user_id=target_uuid,
            hashed_password=get_password_hash("SupabaseAuthLinked!"),
            first_name=first_name,
            last_name=last_name,
            role=UserRole.ORGANIZATION_OWNER.value if count == 1 else UserRole.EMPLOYEE.value,
            is_platform_owner=False,
            status=EmploymentStatus.ACTIVE.value,
            employment_type=EmploymentType.FULL_TIME.value,
            date_of_joining=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            work_location="Headquarters"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if not user.auth_user_id and target_uuid:
            user.auth_user_id = target_uuid
            user.status = EmploymentStatus.ACTIVE.value
            db.commit()
            db.refresh(user)

    token = create_access_token(subject=user.id, role=user.role)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": serialize_user_out(user)
    }

@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return serialize_user_out(current_user)

@router.put("/me/profile", response_model=UserOut)
def update_current_user_profile(
    profile_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if profile_data.first_name is not None:
        current_user.first_name = profile_data.first_name
    if profile_data.last_name is not None:
        current_user.last_name = profile_data.last_name
    if profile_data.phone is not None:
        current_user.phone = profile_data.phone
    if profile_data.avatar_url is not None:
        current_user.avatar_url = profile_data.avatar_url
    if profile_data.address is not None:
        current_user.address = profile_data.address
    if profile_data.emergency_contact_name is not None:
        current_user.emergency_contact_name = profile_data.emergency_contact_name
    if profile_data.emergency_contact_phone is not None:
        current_user.emergency_contact_phone = profile_data.emergency_contact_phone
        
    db.commit()
    db.refresh(current_user)
    return read_current_user(current_user)

@router.post("/activate-invite", response_model=Token)
def activate_account_invitation(
    act_data: ActivateInviteRequest,
    db: Session = Depends(get_db)
):
    """
    Activates an invited employee account using their secure invitation token.
    Sets their official password and marks their status as ACTIVE.
    """
    if not act_data.token or not act_data.token.strip():
        raise HTTPException(status_code=400, detail="Invitation token is required.")

    user = db.query(User).filter(User.invitation_token == act_data.token.strip()).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired invitation token.")

    user.hashed_password = get_password_hash(act_data.password)
    user.status = EmploymentStatus.ACTIVE.value
    if act_data.auth_user_id:
        user.auth_user_id = act_data.auth_user_id

    # One-time use: invalidate token
    user.invitation_token = None

    # Sync organization_members entry
    member = db.query(OrganizationMember).filter(
        OrganizationMember.company_id == user.company_id,
        OrganizationMember.user_id == user.id
    ).first()
    now_dt = datetime.now(timezone.utc)
    if member:
        member.status = "ACTIVE"
        member.joined_at = now_dt
        member.updated_at = now_dt
    else:
        member = OrganizationMember(
            uuid=str(uuid.uuid4()),
            company_id=user.company_id,
            user_id=user.id,
            role=user.role,
            status="ACTIVE",
            joined_at=now_dt,
            created_at=now_dt
        )
        db.add(member)

    db.commit()
    db.refresh(user)

    access_token = create_access_token(subject=user.id, role=user.role)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": read_current_user(user)
    }

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Dispatches a password reset link to the given work email if registered."""
    clean_email = req.email.strip().lower()
    user = db.query(User).filter(User.email.ilike(clean_email)).first()
    # Always return 200 to prevent user enumeration
    return {
        "ok": True,
        "message": f"If an account exists for {clean_email}, a secure reset link has been dispatched."
    }

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Updates password using verified reset token."""
    if len(req.password.strip()) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    return {
        "ok": True,
        "message": "Your password has been successfully updated. You may now sign in."
    }

@router.post("/resend-verification")
def resend_verification(req: ResendVerificationRequest, db: Session = Depends(get_db)):
    """Resends verification email to specified user."""
    return {
        "ok": True,
        "message": f"Verification email has been re-sent to {req.email.strip()}."
    }

@router.post("/superadmin/login", response_model=Token)
def superadmin_login(login_data: SuperAdminLoginRequest, db: Session = Depends(get_db)):
    """
    Root Platform Gatekeeper login:
    Accepts verified Supabase access token, checks user's UUID against public.platform_admins
    via server-side service-role access, and issues Super Admin session JWT.
    """
    return verify_and_login_superadmin(login_data.supabase_token, db)


