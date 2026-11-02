import httpx
import json
from pathlib import Path
from typing import Dict, Any, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from jose import jwk, jwt

from app.core.config import settings
from app.core.security import get_password_hash, create_access_token
from app.models.platform_admin import PlatformAdmin
from app.models.user import User, UserRole, EmploymentStatus, EmploymentType
from app.models.company import Company

_REMOTE_JWKS_CACHE: Optional[Dict[str, Any]] = None

def fetch_remote_jwks() -> Optional[Dict[str, Any]]:
    """Fetches the latest official JWKS from Supabase Auth .well-known endpoint to support key rotation."""
    global _REMOTE_JWKS_CACHE
    if not settings.SUPABASE_URL:
        return None
    try:
        url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        headers = {}
        if settings.SUPABASE_KEY:
            headers["apikey"] = settings.SUPABASE_KEY
        with httpx.Client(timeout=4.0) as client:
            resp = client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, dict) and "keys" in data and len(data["keys"]) > 0:
                    _REMOTE_JWKS_CACHE = data
                    return data
    except Exception:
        pass
    return None

def get_supabase_jwks(refresh: bool = False) -> Optional[Dict[str, Any]]:
    """Loads Supabase JWKS from environment variable, bundled file, or dynamic remote endpoint."""
    global _REMOTE_JWKS_CACHE
    if refresh:
        remote = fetch_remote_jwks()
        if remote:
            return remote

    if settings.SUPABASE_JWKS and settings.SUPABASE_JWKS.strip():
        try:
            return json.loads(settings.SUPABASE_JWKS)
        except Exception:
            pass

    if getattr(settings, "_TEST_DISABLE_BUNDLED_JWKS", False):
        return None

    bundled = Path(__file__).resolve().parent.parent / "core" / "supabase_jwks.json"
    if bundled.exists():
        try:
            with open(bundled, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    if _REMOTE_JWKS_CACHE:
        return _REMOTE_JWKS_CACHE

    return fetch_remote_jwks()

def verify_token_with_jwks(token: str) -> Optional[Dict[str, Any]]:
    """
    Cryptographically verifies a Supabase JWT locally using the project's official ES256 JWKS public key.
    Enforces asymmetric elliptic-curve validation (P-256), strict kid matching, key rotation,
    audience validation ('authenticated'), project issuer matching, and expiration.
    """
    jwks = get_supabase_jwks()
    if not jwks or "keys" not in jwks:
        return None

    try:
        unverified_header = jwt.get_unverified_header(token)
        target_kid = unverified_header.get("kid")

        matching_key = None
        for k in jwks["keys"]:
            if target_kid and k.get("kid") == target_kid:
                matching_key = k
                break

        # If kid is specified but not in current JWKS, attempt key-rotation refresh
        if not matching_key and target_kid:
            refreshed_jwks = get_supabase_jwks(refresh=True)
            if refreshed_jwks and "keys" in refreshed_jwks:
                for k in refreshed_jwks["keys"]:
                    if k.get("kid") == target_kid:
                        matching_key = k
                        break

        # If kid is absent and there is exactly one key, allow it
        if not matching_key and not target_kid and len(jwks["keys"]) == 1:
            matching_key = jwks["keys"][0]

        if not matching_key:
            return None

        key = jwk.construct(matching_key)
        claims = jwt.decode(
            token,
            key,
            algorithms=["ES256"],
            options={
                "verify_aud": False,  # Verified manually below to support list/string formats
                "verify_sub": True,
                "verify_exp": True
            }
        )

        user_id = claims.get("sub")
        email = claims.get("email")
        if not user_id or not isinstance(user_id, str) or not user_id.strip():
            return None
        if not email or not isinstance(email, str) or not email.strip():
            return None

        # Verify Audience: Supabase user access tokens must have audience 'authenticated'
        aud = claims.get("aud")
        if isinstance(aud, list):
            if "authenticated" not in aud:
                return None
        elif isinstance(aud, str):
            if aud != "authenticated":
                return None
        else:
            return None

        # Verify Issuer: Reject tokens from other Supabase projects
        if settings.SUPABASE_URL:
            expected_iss = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1"
            token_iss = claims.get("iss", "").rstrip("/")
            if token_iss and token_iss != expected_iss:
                return None

        return {
            "id": user_id,
            "email": email,
            "user_metadata": claims.get("user_metadata", {}),
            "app_metadata": claims.get("app_metadata", {}),
            "claims": claims
        }
    except Exception:
        return None

def is_supabase_configured() -> bool:
    """Returns True if Supabase URL and (Service Role Key or JWKS) are configured."""
    has_jwks = bool(get_supabase_jwks())
    return bool(settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or has_jwks))

def verify_supabase_token(supabase_token: str) -> Dict[str, Any]:
    """
    Cryptographically verifies the Supabase access token via ES256 JWKS or Supabase Auth server.
    Ensures that the token is authentic, unexpired, and retrieves the verified user UUID.
    """
    if not supabase_token or not supabase_token.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supabase authentication access token is required."
        )

    if not is_supabase_configured() or (not settings.SUPABASE_SERVICE_ROLE_KEY and not get_supabase_jwks()):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Backend configuration error: SUPABASE_SERVICE_ROLE_KEY is not configured in backend environment."
        )

    # 1. First attempt: Asymmetric cryptographic verification via Supabase ES256 JWKS
    jwks_user = verify_token_with_jwks(supabase_token.strip())
    if jwks_user:
        return jwks_user

    # 2. Second attempt: Direct verification via Supabase Auth server
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Backend configuration error: SUPABASE_SERVICE_ROLE_KEY is not configured in backend environment."
        )

    url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/user"
    headers = {
        "Authorization": f"Bearer {supabase_token.strip()}",
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, headers=headers)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Unable to reach Supabase Auth server: {str(e)}"
        )

    if resp.status_code != 200:
        err_msg = "Invalid or expired Supabase authentication token."
        try:
            err_data = resp.json()
            if "message" in err_data:
                err_msg = f"Supabase auth rejected: {err_data['message']}"
            elif "msg" in err_data:
                err_msg = f"Supabase auth rejected: {err_data['msg']}"
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err_msg
        )

    user_data = resp.json()
    user_id = user_data.get("id")
    email = user_data.get("email")

    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Supabase user payload does not contain required user ID or email."
        )

    return user_data

def check_platform_admin_membership(user_uuid: str, db: Session) -> Optional[Dict[str, Any]]:
    """
    Checks if user UUID is registered in public.platform_admins using server-side service-role access.
    Also falls back to local database platform_admins table for offline/test environments.
    """
    if is_supabase_configured():
        rest_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/platform_admins"
        headers = {
            "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"
        }
        params = {"user_id": f"eq.{user_uuid}", "select": "*"}

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(rest_url, headers=headers, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, list) and len(data) > 0:
                        return data[0]
        except Exception:
            pass

    # Check local SQLite/PostgreSQL platform_admins table
    try:
        local_admin = db.query(PlatformAdmin).filter(PlatformAdmin.user_id == user_uuid).first()
        if local_admin:
            return {
                "id": local_admin.id,
                "user_id": local_admin.user_id,
                "role": local_admin.role
            }
    except Exception:
        pass

    return None

def verify_and_login_superadmin(supabase_token: str, db: Session) -> Dict[str, Any]:
    """
    Verifies Supabase access token, checks user UUID against public.platform_admins,
    provisions or links the real Platform Owner user (without fake employee data),
    and issues an authenticated Super Admin session JWT.
    """
    # 1. Verify token with Supabase Auth
    user_data = verify_supabase_token(supabase_token)
    user_uuid = user_data["id"]
    email = user_data.get("email", "").strip().lower()

    # 2. Check public.platform_admins membership
    membership = check_platform_admin_membership(user_uuid, db)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Authenticated account is not registered in platform_admins."
        )

    # 3. Synchronize local platform_admins record
    try:
        local_admin = db.query(PlatformAdmin).filter(PlatformAdmin.user_id == user_uuid).first()
        if not local_admin:
            local_admin = PlatformAdmin(
                user_id=user_uuid,
                role=membership.get("role", "SUPER_ADMIN")
            )
            db.add(local_admin)
            db.commit()
    except Exception:
        pass

    # 4. Find or link root platform user
    platform_user = db.query(User).filter(
        (User.auth_user_id == user_uuid) | (User.email.ilike(email))
    ).first()

    meta = user_data.get("user_metadata") or {}
    first_name = meta.get("first_name") or meta.get("full_name", "").split(" ")[0] or "Platform"
    last_name = meta.get("last_name") or "Owner"

    if not platform_user:
        company = db.query(Company).first()
        company_id = company.id if company else 1

        platform_user = User(
            company_id=company_id,
            employee_code="ROOT-PLATFORM-OWNER",
            email=email,
            auth_user_id=user_uuid,
            hashed_password=get_password_hash("SupabaseServiceLinked!"),
            first_name=first_name,
            last_name=last_name,
            role=UserRole.PLATFORM_OWNER.value,
            is_platform_owner=True,
            status=EmploymentStatus.ACTIVE.value,
            employment_type=EmploymentType.FULL_TIME.value,
            date_of_joining=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            work_location="Platform Control Center"
        )
        db.add(platform_user)
        db.commit()
        db.refresh(platform_user)
    else:
        platform_user.is_platform_owner = True
        platform_user.role = UserRole.PLATFORM_OWNER.value
        platform_user.auth_user_id = user_uuid
        platform_user.status = EmploymentStatus.ACTIVE.value
        db.commit()
        db.refresh(platform_user)

    # 5. Issue backend session token
    access_token = create_access_token(
        subject=platform_user.id,
        role=UserRole.PLATFORM_OWNER.value
    )

    from app.api.v1.endpoints.auth import serialize_user_out
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": serialize_user_out(platform_user)
    }

