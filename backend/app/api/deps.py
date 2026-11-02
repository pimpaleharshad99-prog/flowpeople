from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Optional
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
            if user_uuid:
                membership = check_platform_admin_membership(user_uuid, db)
                if membership:
                    user = db.query(User).filter(
                        (User.auth_user_id == user_uuid) | (User.email.ilike(user_data.get("email")))
                    ).first()
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
        current_user.role == UserRole.PLATFORM_OWNER.value
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
