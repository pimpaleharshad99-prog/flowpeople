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
    try:
        payload = decode_token(raw_token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token payload.",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid credentials. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Fetch user and verify active status
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Employee account not found or has been removed.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status in ["TERMINATED", "SUSPENDED", "INACTIVE"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User account is {user.status.lower()} and cannot access workspace."
        )

    return user

def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in [UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation requires Super Administrator privileges"
        )
    return current_user

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    allowed = [
        UserRole.SUPER_ADMIN.value,
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
        UserRole.SUPER_ADMIN.value,
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
