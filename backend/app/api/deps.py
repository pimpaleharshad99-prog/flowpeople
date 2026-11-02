from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    # 1. Resolve bearer token from header or cookie
    raw_token = token
    if not raw_token:
        auth_hdr = request.headers.get("Authorization") or request.headers.get("authorization")
        if auth_hdr and auth_hdr.lower().startswith("bearer "):
            raw_token = auth_hdr[7:].strip()
        elif "access_token" in request.cookies:
            raw_token = request.cookies.get("access_token")

    if not raw_token or raw_token in ["null", "undefined", ""]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Decode and validate JWT
    user = None
    try:
        payload = decode_token(raw_token)
        user_id: str = payload.get("sub")
        if user_id is not None:
            user = db.query(User).filter(User.id == int(user_id)).first()
    except Exception:
        pass

    # 2b. If local JWT decoding didn't find user, check if raw_token is a verified Supabase access token
    if user is None:
        try:
            from app.services.platform_admin import verify_supabase_token, check_platform_admin_membership
            user_data = verify_supabase_token(raw_token)
            user_uuid = user_data.get("id")
            user_email = user_data.get("email")
            if user_uuid:
                # 1. Check platform admin membership
                membership = check_platform_admin_membership(user_uuid, db)
                if membership:
                    user = db.query(User).filter(User.auth_user_id == user_uuid).first()
                    if not user and user_email:
                        candidate = db.query(User).filter(User.email.ilike(user_email.strip())).first()
                        if candidate:
                            if candidate.auth_user_id and candidate.auth_user_id != user_uuid:
                                raise HTTPException(
                                    status_code=status.HTTP_403_FORBIDDEN,
                                    detail="Security violation: Account is already linked to another identity."
                                )
                            user = candidate
                    if not user:
                        # Auto-provision platform owner without fake employee data
                        from app.models.company import Company
                        company = db.query(Company).first()
                        company_id = company.id if company else 1
                        meta = user_data.get("user_metadata") or {}
                        first_name = meta.get("first_name") or meta.get("full_name", "").split(" ")[0] or "Platform"
                        last_name = meta.get("last_name") or "Owner"
                        user = User(
                            company_id=company_id,
                            employee_code="ROOT-PLATFORM-OWNER",
                            email=user_email,
                            auth_user_id=user_uuid,
                            hashed_password="SupabaseServiceLinked!",
                            first_name=first_name,
                            last_name=last_name,
                            role=UserRole.PLATFORM_OWNER.value,
                            is_platform_owner=True,
                            status="ACTIVE",
                            employment_type="FULL_TIME",
                            date_of_joining=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                            work_location="Platform Control Center"
                        )
                        db.add(user)
                        db.commit()
                        db.refresh(user)
                    else:
                        if not user.is_platform_owner or user.auth_user_id != user_uuid:
                            user.is_platform_owner = True
                            user.role = UserRole.PLATFORM_OWNER.value
                            user.auth_user_id = user_uuid
                            db.commit()
                            db.refresh(user)
                else:
                    # 2. General tenant user lookup (Organization Owner, HR Admin, Manager, Employee)
                    # Primary check: strictly by auth_user_id
                    user = db.query(User).filter(User.auth_user_id == user_uuid).first()
                    if not user and user_email:
                        candidate = db.query(User).filter(User.email.ilike(user_email.strip())).first()
                        if candidate:
                            if candidate.auth_user_id and candidate.auth_user_id != user_uuid:
                                # PREVENT SILENT ACCOUNT TAKEOVER:
                                # Candidate user is already bound to a different Supabase UUID!
                                raise HTTPException(
                                    status_code=status.HTTP_403_FORBIDDEN,
                                    detail="Security violation: Local account is already linked to another identity."
                                )
                            # Unlinked user: link safely to verified Supabase identity
                            candidate.auth_user_id = user_uuid
                            db.commit()
                            db.refresh(candidate)
                            user = candidate
        except HTTPException:
            raise
        except Exception:
            pass

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid credentials. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status in ["TERMINATED", "SUSPENDED", "INACTIVE"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User account is {user.status.lower()} and cannot access workspace."
        )

    return user

def require_platform_owner(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    """
    Owner-Only Platform Authorization:
    Restricted strictly to verified platform owners registered in public.platform_admins.
    Normal Organization Owners, HR Admins, Managers, and Employees are unconditionally blocked.
    """
    is_owner = (
        bool(current_user.is_platform_owner) or
        current_user.role in [UserRole.PLATFORM_OWNER.value, UserRole.SUPER_ADMIN.value]
    )
    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Super Admin access is restricted exclusively to authorized platform admins."
        )

    # Server-side verification against platform_admins
    if current_user.auth_user_id:
        from app.models.platform_admin import PlatformAdmin
        membership = db.query(PlatformAdmin).filter(
            PlatformAdmin.user_id == current_user.auth_user_id
        ).first()
        if not membership and not current_user.is_platform_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Account is not registered in platform_admins."
            )

    return current_user

# Alias require_super_admin to require_platform_owner for strict platform security
require_super_admin = require_platform_owner

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    allowed = [
        UserRole.PLATFORM_OWNER.value,
        UserRole.SUPER_ADMIN.value,
        UserRole.ORGANIZATION_OWNER.value,
        UserRole.HR_ADMIN.value,
        UserRole.ADMIN.value,
        UserRole.HR_MANAGER.value,
        UserRole.HR_EXECUTIVE.value,
        "COMPANY_ADMIN"
    ]
    if current_user.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation requires Administrator or HR Manager privileges"
        )
    return current_user

def require_manager_or_above(current_user: User = Depends(get_current_user)) -> User:
    allowed = [
        UserRole.PLATFORM_OWNER.value,
        UserRole.SUPER_ADMIN.value,
        UserRole.ORGANIZATION_OWNER.value,
        UserRole.HR_ADMIN.value,
        UserRole.ADMIN.value,
        UserRole.HR_MANAGER.value,
        UserRole.HR_EXECUTIVE.value,
        "COMPANY_ADMIN",
        UserRole.MANAGER.value
    ]
    if current_user.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation requires Manager or higher privileges"
        )
    return current_user
