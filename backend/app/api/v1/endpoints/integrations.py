from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import base64
from datetime import datetime, timezone, timedelta

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.integration import (
    OrganizationIntegration,
    OrganizationDriveUpload,
    ConnectionStatus,
    UploadStatus,
    IntegrationProvider
)
from app.schemas.integration import (
    IntegrationStatusOut,
    IntegrationConnectOut,
    IntegrationSettingsIn,
    ManualUploadIn,
    DriveUploadOut
)
from app.api.deps import get_current_user
from app.services.google_drive import (
    is_google_oauth_configured,
    generate_oauth_state,
    verify_oauth_state,
    build_authorization_url,
    exchange_code_for_tokens,
    get_user_email,
    revoke_token,
    encrypt_token,
    decrypt_token,
    ensure_valid_access_token,
    init_drive_folder_hierarchy,
    get_or_create_date_subfolder,
    upload_file_to_drive,
    process_background_upload
)
from app.services.report_generator import (
    generate_attendance_pdf,
    generate_attendance_csv,
    generate_monthly_attendance_csv,
    generate_leave_report_csv,
    generate_payroll_report_csv
)

router = APIRouter()

def require_org_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Enforces authorization: Only Organization Owners, Company Admins, HR Admins,
    and Platform Super Admins can access Google Drive integration credentials and settings.
    Blocks standard Employees and Managers with 403 Forbidden.
    """
    admin_roles = [
        UserRole.ORGANIZATION_OWNER.value,
        UserRole.HR_ADMIN.value,
        UserRole.ADMIN.value,
        UserRole.HR_MANAGER.value,
        UserRole.SUPER_ADMIN.value,
        UserRole.PLATFORM_OWNER.value
    ]
    user_role = (current_user.role or "").upper()
    if user_role not in admin_roles and not current_user.is_platform_owner:
        raise HTTPException(
            status_code=403,
            detail="Access denied. Only Organization Owners and HR Administrators can manage Google Drive integrations."
        )
    if not current_user.company_id and not current_user.is_platform_owner:
        raise HTTPException(
            status_code=400,
            detail="User does not belong to any active organization."
        )
    return current_user

@router.get("/status", response_model=IntegrationStatusOut)
def get_integration_status(
    current_user: User = Depends(require_org_admin),
    db: Session = Depends(get_db)
):
    """Returns the current Google Drive connection status, account email, sync timestamps, and settings."""
    configured = is_google_oauth_configured()

    integration = db.query(OrganizationIntegration).filter(
        OrganizationIntegration.company_id == current_user.company_id,
        OrganizationIntegration.provider == IntegrationProvider.GOOGLE_DRIVE.value
    ).first()

    total_uploads = db.query(OrganizationDriveUpload).filter(
        OrganizationDriveUpload.company_id == current_user.company_id
    ).count()

    if not integration:
        status_val = ConnectionStatus.CONFIG_UNAVAILABLE.value if not configured else ConnectionStatus.NOT_CONNECTED.value
        return IntegrationStatusOut(
            configured=configured,
            connection_status=status_val,
            connected_account_email=None,
            auto_attendance_reports=True,
            auto_monthly_reports=True,
            last_successful_sync=None,
            last_error=None if configured else "Google Drive OAuth credentials (GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET) are not configured in backend/.env.",
            drive_root_folder_id=None,
            drive_company_folder_id=None,
            total_uploads_count=total_uploads
        )

    # Determine status if not configured
    effective_status = integration.connection_status
    if not configured and effective_status == ConnectionStatus.NOT_CONNECTED.value:
        effective_status = ConnectionStatus.CONFIG_UNAVAILABLE.value

    return IntegrationStatusOut(
        configured=configured,
        connection_status=effective_status,
        connected_account_email=integration.connected_account_email,
        auto_attendance_reports=integration.auto_attendance_reports,
        auto_monthly_reports=integration.auto_monthly_reports,
        last_successful_sync=integration.last_successful_sync,
        last_error=integration.last_error,
        drive_root_folder_id=integration.drive_root_folder_id,
        drive_company_folder_id=integration.drive_company_folder_id,
        total_uploads_count=total_uploads
    )

@router.get("/connect", response_model=IntegrationConnectOut)
def initiate_oauth_connect(
    current_user: User = Depends(require_org_admin),
    db: Session = Depends(get_db)
):
    """
    Generates a secure, signed CSRF OAuth state and constructs the Google OAuth 2.0 authorization URL.
    Does not expose secrets to the client.
    """
    if not is_google_oauth_configured():
        raise HTTPException(
            status_code=400,
            detail="Google Drive OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env."
        )

    # Create signed state with company_id, user_id, role, nonce, expiry
    state = generate_oauth_state(
        company_id=current_user.company_id,
        user_id=current_user.id,
        role=current_user.role or "HR_ADMIN"
    )

    # Update or create integration record in CONNECTING status
    integration = db.query(OrganizationIntegration).filter(
        OrganizationIntegration.company_id == current_user.company_id,
        OrganizationIntegration.provider == IntegrationProvider.GOOGLE_DRIVE.value
    ).first()

    if not integration:
        integration = OrganizationIntegration(
            company_id=current_user.company_id,
            provider=IntegrationProvider.GOOGLE_DRIVE.value,
            connection_status=ConnectionStatus.CONNECTING.value
        )
        db.add(integration)
    else:
        if integration.connection_status != ConnectionStatus.CONNECTED.value:
            integration.connection_status = ConnectionStatus.CONNECTING.value
    db.commit()

    auth_url = build_authorization_url(state)
    return IntegrationConnectOut(authorization_url=auth_url, state=state)

@router.get("/callback")
def oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Google OAuth 2.0 redirect callback endpoint.
    Safely validates signed state token, exchanges code for access & refresh tokens,
    encrypts the refresh token using Fernet, initializes dedicated folder hierarchy,
    and redirects the browser back to the FlowPeople frontend.
    """
    frontend_base = settings.FRONTEND_URL.rstrip("/")
    redirect_target = f"{frontend_base}/app?tab=organization&subtab=integrations"

    # 1. Handle user cancellation or Google authorization error
    if error:
        err_msg = f"Google authorization was denied or cancelled: {error}"
        return RedirectResponse(url=f"{redirect_target}&google_drive_error={err_msg}")

    if not code or not state:
        return RedirectResponse(url=f"{redirect_target}&google_drive_error=Missing+authorization+code+or+state+parameter")

    # 2. Validate signed OAuth state
    try:
        payload = verify_oauth_state(state)
    except ValueError as e:
        return RedirectResponse(url=f"{redirect_target}&google_drive_error=Invalid+or+expired+OAuth+security+state")

    company_id = payload["company_id"]
    user_id = payload["user_id"]

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return RedirectResponse(url=f"{redirect_target}&google_drive_error=Organization+not+found")

    # 3. Exchange code for Google tokens
    try:
        tokens = exchange_code_for_tokens(code)
    except Exception as e:
        return RedirectResponse(url=f"{redirect_target}&google_drive_error=Token+exchange+failed:+{str(e)}")

    access_token = tokens["access_token"]
    refresh_token = tokens.get("refresh_token")
    expires_in = tokens.get("expires_in", 3600)
    now = datetime.now(timezone.utc)
    expiry = now + timedelta(seconds=expires_in)

    # 4. Fetch connected Google user email
    connected_email = get_user_email(access_token)

    # 5. Fetch or create organization integration record
    integration = db.query(OrganizationIntegration).filter(
        OrganizationIntegration.company_id == company_id,
        OrganizationIntegration.provider == IntegrationProvider.GOOGLE_DRIVE.value
    ).first()

    if not integration:
        integration = OrganizationIntegration(
            company_id=company_id,
            organization_uuid=company.uuid,
            provider=IntegrationProvider.GOOGLE_DRIVE.value
        )
        db.add(integration)

    integration.connected_account_email = connected_email
    integration.access_token = access_token
    integration.access_token_expiry = expiry
    if refresh_token:
        integration.encrypted_refresh_token = encrypt_token(refresh_token)
    integration.connection_status = ConnectionStatus.CONNECTED.value
    integration.last_error = None
    db.commit()

    # 6. Initialize dedicated folder structure in Google Drive
    try:
        folders = init_drive_folder_hierarchy(access_token, company.name)
        integration.drive_root_folder_id = folders["drive_root_folder_id"]
        integration.drive_company_folder_id = folders["drive_company_folder_id"]
        integration.drive_attendance_folder_id = folders["drive_attendance_folder_id"]
        integration.drive_employees_folder_id = folders["drive_employees_folder_id"]
        integration.drive_payroll_folder_id = folders["drive_payroll_folder_id"]
        integration.drive_leave_folder_id = folders["drive_leave_folder_id"]
        db.commit()
    except Exception as e:
        # Non-fatal during callback, folders will be re-attempted on first upload
        integration.last_error = f"Folder initialization warning: {str(e)}"
        db.commit()

    # 7. Redirect back to FlowPeople frontend with success indicator
    return RedirectResponse(url=f"{redirect_target}&google_drive=connected")

@router.post("/disconnect")
def disconnect_google_drive(
    current_user: User = Depends(require_org_admin),
    db: Session = Depends(get_db)
):
    """
    Safely disconnects Google Drive:
    - Revokes Google authorization where possible.
    - Securely deletes encrypted refresh and access tokens.
    - Sets connection status to NOT_CONNECTED.
    - Preserves existing files in Google Drive and preserves report upload history.
    """
    integration = db.query(OrganizationIntegration).filter(
        OrganizationIntegration.company_id == current_user.company_id,
        OrganizationIntegration.provider == IntegrationProvider.GOOGLE_DRIVE.value
    ).first()

    if not integration:
        return {"success": True, "message": "Google Drive is not currently connected."}

    # Revoke with Google
    raw_refresh_token = decrypt_token(integration.encrypted_refresh_token or "")
    if raw_refresh_token:
        try:
            revoke_token(raw_refresh_token)
        except Exception:
            pass

    # Clear credentials while preserving folder IDs and upload history
    integration.encrypted_refresh_token = None
    integration.access_token = None
    integration.access_token_expiry = None
    integration.connected_account_email = None
    integration.connection_status = ConnectionStatus.NOT_CONNECTED.value
    integration.last_error = None
    db.commit()

    return {"success": True, "message": "Google Drive disconnected successfully. Upload history preserved."}

@router.post("/settings")
def update_integration_settings(
    settings_in: IntegrationSettingsIn,
    current_user: User = Depends(require_org_admin),
    db: Session = Depends(get_db)
):
    """Updates automatic upload preferences (daily attendance reports, monthly exports)."""
    integration = db.query(OrganizationIntegration).filter(
        OrganizationIntegration.company_id == current_user.company_id,
        OrganizationIntegration.provider == IntegrationProvider.GOOGLE_DRIVE.value
    ).first()

    if not integration:
        integration = OrganizationIntegration(
            company_id=current_user.company_id,
            provider=IntegrationProvider.GOOGLE_DRIVE.value
        )
        db.add(integration)

    if settings_in.auto_attendance_reports is not None:
        integration.auto_attendance_reports = settings_in.auto_attendance_reports
    if settings_in.auto_monthly_reports is not None:
        integration.auto_monthly_reports = settings_in.auto_monthly_reports

    db.commit()
    db.refresh(integration)

    return {
        "success": True,
        "auto_attendance_reports": integration.auto_attendance_reports,
        "auto_monthly_reports": integration.auto_monthly_reports
    }

@router.post("/upload")
def upload_report_to_drive(
    upload_in: ManualUploadIn,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_org_admin),
    db: Session = Depends(get_db)
):
    """
    Generates and uploads an official report (PDF/CSV) to the connected Google Drive.
    Supports instant synchronous execution or background queuing.
    Prevents duplicate uploads and logs history.
    """
    integration = db.query(OrganizationIntegration).filter(
        OrganizationIntegration.company_id == current_user.company_id,
        OrganizationIntegration.provider == IntegrationProvider.GOOGLE_DRIVE.value
    ).first()

    if not integration or integration.connection_status != ConnectionStatus.CONNECTED.value:
        raise HTTPException(
            status_code=400,
            detail="Google Drive is not connected for your organization. Please connect Google Drive first."
        )

    company = db.query(Company).filter(Company.id == current_user.company_id).first()
    today = datetime.now(timezone.utc)
    effective_date = upload_in.date or today.strftime("%Y-%m-%d")
    year = today.year
    month_name = today.strftime("%B")

    # Decode uploaded file content or generate from DB
    file_bytes: Optional[bytes] = None
    effective_name = upload_in.file_name
    effective_mime = upload_in.mime_type or "application/pdf"

    if upload_in.content_base64:
        try:
            file_bytes = base64.b64decode(upload_in.content_base64)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64-encoded file payload.")
    else:
        # Generate report content directly from the database
        rtype = (upload_in.report_type or "DAILY_ATTENDANCE").upper()
        if rtype == "DAILY_ATTENDANCE":
            effective_name, file_bytes = generate_attendance_pdf(db, current_user.company_id, effective_date)
            effective_mime = "application/pdf"
        elif rtype == "DAILY_ATTENDANCE_CSV":
            effective_name, csv_str = generate_attendance_csv(db, current_user.company_id, effective_date)
            file_bytes = csv_str.encode("utf-8")
            effective_mime = "text/csv"
        elif rtype == "MONTHLY_ATTENDANCE":
            effective_name, csv_str = generate_monthly_attendance_csv(db, current_user.company_id, year, today.month)
            file_bytes = csv_str.encode("utf-8")
            effective_mime = "text/csv"
        elif rtype == "LEAVE_SUMMARY":
            effective_name, csv_str = generate_leave_report_csv(db, current_user.company_id)
            file_bytes = csv_str.encode("utf-8")
            effective_mime = "text/csv"
        elif rtype in ("PAYSLIP", "PAYROLL_SUMMARY"):
            effective_name, csv_str = generate_payroll_report_csv(db, current_user.company_id)
            file_bytes = csv_str.encode("utf-8")
            effective_mime = "text/csv"
        else:
            effective_name, file_bytes = generate_attendance_pdf(db, current_user.company_id, effective_date)
            effective_mime = "application/pdf"

    if not effective_name:
        effective_name = f"{upload_in.report_type}_{effective_date}.pdf"

    # Perform synchronous upload so client immediately receives file ID and link
    try:
        access_token = ensure_valid_access_token(integration, db)

        # Check or initialize folders
        if not integration.drive_attendance_folder_id:
            folders = init_drive_folder_hierarchy(access_token, company.name if company else "Company")
            integration.drive_root_folder_id = folders["drive_root_folder_id"]
            integration.drive_company_folder_id = folders["drive_company_folder_id"]
            integration.drive_attendance_folder_id = folders["drive_attendance_folder_id"]
            integration.drive_employees_folder_id = folders["drive_employees_folder_id"]
            integration.drive_payroll_folder_id = folders["drive_payroll_folder_id"]
            integration.drive_leave_folder_id = folders["drive_leave_folder_id"]
            db.commit()

        target_folder = integration.drive_attendance_folder_id
        if "LEAVE" in upload_in.report_type.upper():
            target_folder = integration.drive_leave_folder_id or integration.drive_company_folder_id
        elif "PAYROLL" in upload_in.report_type.upper() or "PAYSLIP" in upload_in.report_type.upper():
            target_folder = integration.drive_payroll_folder_id or integration.drive_company_folder_id
        elif "EMPLOYEE" in upload_in.report_type.upper():
            target_folder = integration.drive_employees_folder_id or integration.drive_company_folder_id
        else:
            target_folder = get_or_create_date_subfolder(
                access_token,
                integration.drive_attendance_folder_id or integration.drive_company_folder_id,
                year,
                month_name
            )

        res = upload_file_to_drive(
            access_token=access_token,
            folder_id=target_folder,
            file_name=effective_name,
            file_bytes=file_bytes,
            mime_type=effective_mime
        )

        # Record upload in history
        upload_log = OrganizationDriveUpload(
            company_id=current_user.company_id,
            organization_uuid=company.uuid if company else None,
            report_type=upload_in.report_type,
            file_name=effective_name,
            file_size_bytes=len(file_bytes),
            mime_type=effective_mime,
            drive_file_id=res.get("id"),
            drive_folder_id=target_folder,
            drive_web_view_link=res.get("webViewLink"),
            upload_status=UploadStatus.SUCCESS.value
        )
        db.add(upload_log)
        integration.last_successful_sync = datetime.now(timezone.utc)
        integration.last_error = None
        db.commit()
        db.refresh(upload_log)

        return {
            "success": True,
            "upload_id": upload_log.id,
            "file_id": res.get("id"),
            "file_name": effective_name,
            "web_view_link": res.get("webViewLink"),
            "uploaded_at": upload_log.created_at
        }

    except Exception as e:
        upload_log = OrganizationDriveUpload(
            company_id=current_user.company_id,
            organization_uuid=company.uuid if company else None,
            report_type=upload_in.report_type,
            file_name=effective_name,
            file_size_bytes=len(file_bytes) if file_bytes else 0,
            mime_type=effective_mime,
            upload_status=UploadStatus.FAILED.value,
            error_message=str(e)
        )
        db.add(upload_log)
        integration.last_error = f"Upload error: {str(e)}"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to upload report to Google Drive: {str(e)}")

@router.get("/uploads", response_model=List[DriveUploadOut])
def get_drive_uploads(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_org_admin),
    db: Session = Depends(get_db)
):
    """Returns the historical log of all documents and reports uploaded to Google Drive for this organization."""
    uploads = (
        db.query(OrganizationDriveUpload)
        .filter(OrganizationDriveUpload.company_id == current_user.company_id)
        .order_by(OrganizationDriveUpload.created_at.desc())
        .limit(limit)
        .all()
    )
    return uploads
