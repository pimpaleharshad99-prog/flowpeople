"""
FlowPeople by FlowCraft - Google Drive OAuth 2.0 & Cloud Storage Service
Handles Google OAuth token exchange, Fernet symmetric encryption,
token refresh, folder hierarchy management, and background report uploads.
"""

from typing import Optional, Dict, Any, Tuple
import os
import time
import base64
import hashlib
import json
import secrets
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode
import httpx
from jose import jwt, JWTError
from cryptography.fernet import Fernet
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.company import Company
from app.models.integration import (
    OrganizationIntegration,
    OrganizationDriveUpload,
    ConnectionStatus,
    UploadStatus,
    IntegrationProvider
)
from app.services.report_generator import (
    generate_attendance_pdf,
    generate_attendance_csv,
    generate_monthly_attendance_csv,
    generate_leave_report_csv,
    generate_payroll_report_csv
)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GOOGLE_DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"
GOOGLE_DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3"

def _get_cipher() -> Fernet:
    """Derives a deterministic 32-byte URL-safe base64 key from settings.SECRET_KEY."""
    raw_key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(raw_key))

def encrypt_token(plain_text: str) -> str:
    """Encrypts sensitive OAuth tokens using AES-128-CBC + HMAC-SHA256 authenticated encryption."""
    if not plain_text:
        return ""
    cipher = _get_cipher()
    return cipher.encrypt(plain_text.encode("utf-8")).decode("utf-8")

def decrypt_token(cipher_text: str) -> str:
    """Decrypts encrypted OAuth token."""
    if not cipher_text:
        return ""
    try:
        cipher = _get_cipher()
        return cipher.decrypt(cipher_text.encode("utf-8")).decode("utf-8")
    except Exception:
        return ""

def generate_oauth_state(company_id: int, user_id: int, role: str) -> str:
    """Generates a tamper-proof signed JWT state parameter with 15-minute expiry."""
    payload = {
        "company_id": company_id,
        "user_id": user_id,
        "role": role,
        "nonce": secrets.token_hex(16),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15)
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def verify_oauth_state(state_token: str) -> Dict[str, Any]:
    """Verifies the state JWT token signature and expiry. Raises ValueError if invalid."""
    try:
        payload = jwt.decode(state_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if "company_id" not in payload or "user_id" not in payload:
            raise ValueError("Invalid OAuth state payload format")
        return payload
    except JWTError as e:
        raise ValueError(f"OAuth state verification failed: {str(e)}")

def is_google_oauth_configured() -> bool:
    """Returns True if Google OAuth Client ID and Secret are configured."""
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)

def build_authorization_url(state: str) -> str:
    """Builds the official Google OAuth 2.0 Web Server authorization URL."""
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": settings.GOOGLE_DRIVE_SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
        "include_granted_scopes": "true"
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

def exchange_code_for_tokens(code: str) -> Dict[str, Any]:
    """Exchanges Google authorization code for access and refresh tokens."""
    data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code"
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}

    with httpx.Client(timeout=20.0) as client:
        resp = client.post(GOOGLE_TOKEN_URL, data=data, headers=headers)
        if resp.status_code != 200:
            err_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"error": resp.text}
            raise ValueError(f"Google token exchange failed ({resp.status_code}): {err_data.get('error_description', err_data.get('error', resp.text))}")
        return resp.json()

def get_user_email(access_token: str) -> Optional[str]:
    """Fetches the connected Google user account email."""
    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(GOOGLE_USERINFO_URL, headers=headers)
            if resp.status_code == 200:
                email = resp.json().get("email")
                if email:
                    return email
    except Exception:
        pass

    # Fallback to Google Drive about API which is always available with drive.file scope
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get("https://www.googleapis.com/drive/v3/about?fields=user", headers=headers)
            if resp.status_code == 200:
                user_info = resp.json().get("user", {})
                return user_info.get("emailAddress") or user_info.get("displayName")
    except Exception:
        pass

    return None

def revoke_token(token: str) -> bool:
    """Revokes token authorization with Google on disconnect."""
    if not token:
        return False
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(GOOGLE_REVOKE_URL, params={"token": token}, headers={"Content-Type": "application/x-www-form-urlencoded"})
            return resp.status_code == 200
    except Exception:
        return False

def ensure_valid_access_token(integration: OrganizationIntegration, db: Session) -> str:
    """
    Ensures the integration has a valid Google Drive access token.
    Refreshes the token automatically if expired or expiring within 2 minutes.
    """
    now = datetime.now(timezone.utc)
    # Check if existing access token is still fresh
    if integration.access_token and integration.access_token_expiry:
        # Normalize expiry to timezone-aware UTC
        exp = integration.access_token_expiry
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp > now + timedelta(minutes=2):
            return integration.access_token

    # Need refresh: decrypt stored refresh token
    refresh_token = decrypt_token(integration.encrypted_refresh_token or "")
    if not refresh_token:
        integration.connection_status = ConnectionStatus.REAUTH_REQUIRED.value
        integration.last_error = "No refresh token available. Reauthorization required."
        db.commit()
        raise ValueError("No refresh token available. Please reconnect Google Drive.")

    data = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token"
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}

    with httpx.Client(timeout=20.0) as client:
        resp = client.post(GOOGLE_TOKEN_URL, data=data, headers=headers)
        if resp.status_code != 200:
            err_json = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            err_desc = err_json.get("error_description", resp.text)
            integration.connection_status = ConnectionStatus.REAUTH_REQUIRED.value
            integration.last_error = f"Token refresh failed: {err_desc}"
            db.commit()
            raise ValueError(f"Google token refresh failed: {err_desc}")

        res = resp.json()
        new_access_token = res["access_token"]
        expires_in = res.get("expires_in", 3600)

        integration.access_token = new_access_token
        integration.access_token_expiry = now + timedelta(seconds=expires_in)
        # If Google issued a new refresh token, update it
        if res.get("refresh_token"):
            integration.encrypted_refresh_token = encrypt_token(res["refresh_token"])
        integration.connection_status = ConnectionStatus.CONNECTED.value
        integration.last_error = None
        db.commit()
        return new_access_token

def get_or_create_folder(access_token: str, folder_name: str, parent_id: Optional[str] = None) -> str:
    """
    Locates an existing non-trashed folder with the given name, or creates it if not found.
    Prevents folder duplication across repeated operations.
    """
    clean_name = folder_name.replace("'", "\\'")
    query_parts = [
        f"mimeType = 'application/vnd.google-apps.folder'",
        f"name = '{clean_name}'",
        "trashed = false"
    ]
    if parent_id:
        query_parts.append(f"'{parent_id}' in parents")
    else:
        query_parts.append("'root' in parents")

    q = " and ".join(query_parts)
    headers = {"Authorization": f"Bearer {access_token}"}

    with httpx.Client(timeout=20.0) as client:
        # 1. Search for existing folder
        search_resp = client.get(
            f"{GOOGLE_DRIVE_API_BASE}/files",
            params={"q": q, "fields": "files(id, name)", "spaces": "drive"},
            headers=headers
        )
        if search_resp.status_code == 200:
            files = search_resp.json().get("files", [])
            if files:
                return files[0]["id"]

        # 2. Folder does not exist, create it
        payload: Dict[str, Any] = {
            "name": folder_name,
            "mimeType": "application/vnd.google-apps.folder"
        }
        if parent_id:
            payload["parents"] = [parent_id]

        create_resp = client.post(
            f"{GOOGLE_DRIVE_API_BASE}/files",
            json=payload,
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        )
        if create_resp.status_code not in (200, 201):
            raise ValueError(f"Failed to create Google Drive folder '{folder_name}': {create_resp.text}")

        return create_resp.json()["id"]

def init_drive_folder_hierarchy(access_token: str, company_name: str) -> Dict[str, str]:
    """
    Initializes the required FlowPeople folder structure inside the connected Google Drive:
    FlowPeople/
        Company_Name/
            Attendance/
            Employees/
                Employee_Reports/
            Payroll/
                Payslips/
            Leave/
                Leave_Reports/
    Returns a dictionary of all assigned folder IDs.
    """
    clean_company = "".join(c for c in company_name if c.isalnum() or c in (" ", "-", "_")).strip() or "Organization"

    # 1. Root FlowPeople folder
    root_id = get_or_create_folder(access_token, "FlowPeople", parent_id=None)

    # 2. Company folder
    company_id = get_or_create_folder(access_token, clean_company, parent_id=root_id)

    # 3. Main Functional Categories
    attendance_id = get_or_create_folder(access_token, "Attendance", parent_id=company_id)
    employees_id = get_or_create_folder(access_token, "Employees", parent_id=company_id)
    emp_reports_id = get_or_create_folder(access_token, "Employee_Reports", parent_id=employees_id)

    payroll_id = get_or_create_folder(access_token, "Payroll", parent_id=company_id)
    payslips_id = get_or_create_folder(access_token, "Payslips", parent_id=payroll_id)

    leave_id = get_or_create_folder(access_token, "Leave", parent_id=company_id)
    leave_reports_id = get_or_create_folder(access_token, "Leave_Reports", parent_id=leave_id)

    return {
        "drive_root_folder_id": root_id,
        "drive_company_folder_id": company_id,
        "drive_attendance_folder_id": attendance_id,
        "drive_employees_folder_id": employees_id,
        "drive_emp_reports_folder_id": emp_reports_id,
        "drive_payroll_folder_id": payroll_id,
        "drive_payslips_folder_id": payslips_id,
        "drive_leave_folder_id": leave_id,
        "drive_leave_reports_folder_id": leave_reports_id
    }

def get_or_create_date_subfolder(access_token: str, parent_folder_id: str, year: int, month_name: str) -> str:
    """Creates/locates dynamic Year/Month subfolders, e.g. Attendance/2026/November."""
    year_id = get_or_create_folder(access_token, str(year), parent_id=parent_folder_id)
    month_id = get_or_create_folder(access_token, month_name, parent_id=year_id)
    return month_id

def upload_file_to_drive(access_token: str, folder_id: str, file_name: str, file_bytes: bytes, mime_type: str = "application/pdf") -> Dict[str, Any]:
    """
    Uploads a file to Google Drive using the multipart/related upload protocol.
    Returns metadata dict containing file id, name, and webViewLink.
    """
    boundary = f"=====FlowPeopleBoundary{secrets.token_hex(12)}====="
    metadata = {
        "name": file_name,
        "parents": [folder_id],
        "mimeType": mime_type
    }

    body = (
        f"--{boundary}\r\n"
        f"Content-Type: application/json; charset=UTF-8\r\n\r\n"
        f"{json.dumps(metadata)}\r\n"
        f"--{boundary}\r\n"
        f"Content-Type: {mime_type}\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": f"multipart/related; boundary={boundary}",
        "Content-Length": str(len(body))
    }

    url = f"{GOOGLE_DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,size"

    with httpx.Client(timeout=60.0) as client:
        resp = client.post(url, content=body, headers=headers)
        if resp.status_code not in (200, 201):
            raise ValueError(f"Google Drive upload failed ({resp.status_code}): {resp.text}")
        return resp.json()

def process_background_upload(
    company_id: int,
    report_type: str,
    date_str: Optional[str] = None,
    file_name: Optional[str] = None,
    content_bytes: Optional[bytes] = None,
    mime_type: Optional[str] = None
) -> None:
    """
    Robust background worker to generate and upload reports to Google Drive.
    Includes automatic retries (up to 3 attempts with exponential backoff)
    and updates upload history.
    NEVER raises unhandled exceptions to prevent crashing background threads.
    """
    db = SessionLocal()
    try:
        integration = db.query(OrganizationIntegration).filter(
            OrganizationIntegration.company_id == company_id,
            OrganizationIntegration.provider == IntegrationProvider.GOOGLE_DRIVE.value
        ).first()

        if not integration or integration.connection_status != ConnectionStatus.CONNECTED.value:
            return

        company = db.query(Company).filter(Company.id == company_id).first()
        if not company:
            return

        today = datetime.now(timezone.utc)
        effective_date = date_str or today.strftime("%Y-%m-%d")
        year = today.year
        month_name = today.strftime("%B")

        # 1. Determine or generate file content
        file_bytes = content_bytes
        generated_name = file_name
        effective_mime = mime_type or "application/pdf"

        if file_bytes is None:
            if report_type == "DAILY_ATTENDANCE":
                generated_name, file_bytes = generate_attendance_pdf(db, company_id, effective_date)
                effective_mime = "application/pdf"
            elif report_type == "DAILY_ATTENDANCE_CSV":
                generated_name, csv_str = generate_attendance_csv(db, company_id, effective_date)
                file_bytes = csv_str.encode("utf-8")
                effective_mime = "text/csv"
            elif report_type == "MONTHLY_ATTENDANCE":
                generated_name, csv_str = generate_monthly_attendance_csv(db, company_id, year, today.month)
                file_bytes = csv_str.encode("utf-8")
                effective_mime = "text/csv"
            elif report_type == "LEAVE_SUMMARY":
                generated_name, csv_str = generate_leave_report_csv(db, company_id)
                file_bytes = csv_str.encode("utf-8")
                effective_mime = "text/csv"
            elif report_type == "PAYSLIP" or report_type == "PAYROLL_SUMMARY":
                generated_name, csv_str = generate_payroll_report_csv(db, company_id)
                file_bytes = csv_str.encode("utf-8")
                effective_mime = "text/csv"
            else:
                generated_name, file_bytes = generate_attendance_pdf(db, company_id, effective_date)
                effective_mime = "application/pdf"

        if not generated_name:
            generated_name = f"{report_type}_{effective_date}.pdf"

        # Create upload record
        upload_record = OrganizationDriveUpload(
            company_id=company_id,
            organization_uuid=company.uuid,
            report_type=report_type,
            file_name=generated_name,
            file_size_bytes=len(file_bytes),
            mime_type=effective_mime,
            upload_status=UploadStatus.UPLOADING.value
        )
        db.add(upload_record)
        db.commit()
        db.refresh(upload_record)

        # Retry loop for Google Drive operations
        max_retries = 3
        success = False
        last_error_msg = ""

        for attempt in range(max_retries):
            try:
                # Refresh access token
                access_token = ensure_valid_access_token(integration, db)

                # Ensure folder hierarchy
                if not integration.drive_attendance_folder_id:
                    folders = init_drive_folder_hierarchy(access_token, company.name)
                    integration.drive_root_folder_id = folders["drive_root_folder_id"]
                    integration.drive_company_folder_id = folders["drive_company_folder_id"]
                    integration.drive_attendance_folder_id = folders["drive_attendance_folder_id"]
                    integration.drive_employees_folder_id = folders["drive_employees_folder_id"]
                    integration.drive_payroll_folder_id = folders["drive_payroll_folder_id"]
                    integration.drive_leave_folder_id = folders["drive_leave_folder_id"]
                    db.commit()

                # Choose appropriate folder
                target_folder_id = integration.drive_attendance_folder_id
                if "LEAVE" in report_type.upper():
                    target_folder_id = integration.drive_leave_folder_id or integration.drive_company_folder_id
                elif "PAYROLL" in report_type.upper() or "PAYSLIP" in report_type.upper():
                    target_folder_id = integration.drive_payroll_folder_id or integration.drive_company_folder_id
                elif "EMPLOYEE" in report_type.upper():
                    target_folder_id = integration.drive_employees_folder_id or integration.drive_company_folder_id
                else:
                    # Daily or Monthly attendance -> dynamic Year / Month folder
                    target_folder_id = get_or_create_date_subfolder(
                        access_token,
                        integration.drive_attendance_folder_id or integration.drive_company_folder_id,
                        year,
                        month_name
                    )

                # Execute upload
                result = upload_file_to_drive(
                    access_token=access_token,
                    folder_id=target_folder_id,
                    file_name=generated_name,
                    file_bytes=file_bytes,
                    mime_type=effective_mime
                )

                upload_record.drive_file_id = result.get("id")
                upload_record.drive_folder_id = target_folder_id
                upload_record.drive_web_view_link = result.get("webViewLink")
                upload_record.upload_status = UploadStatus.SUCCESS.value
                upload_record.error_message = None

                integration.last_successful_sync = datetime.now(timezone.utc)
                integration.last_error = None
                integration.connection_status = ConnectionStatus.CONNECTED.value
                db.commit()
                success = True
                break

            except Exception as e:
                last_error_msg = str(e)
                upload_record.retry_count = attempt + 1
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)

        if not success:
            upload_record.upload_status = UploadStatus.FAILED.value
            upload_record.error_message = last_error_msg
            integration.last_error = f"Upload failed after {max_retries} retries: {last_error_msg}"
            integration.connection_status = ConnectionStatus.SYNC_FAILED.value
            db.commit()

    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        db.close()

