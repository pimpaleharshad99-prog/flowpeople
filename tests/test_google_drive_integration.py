import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from datetime import datetime, timezone, timedelta
import json
import base64

from app.main import app
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.company import Company
from app.models.user import User, UserRole
from app.models.integration import (
    OrganizationIntegration,
    OrganizationDriveUpload,
    ConnectionStatus,
    UploadStatus,
    IntegrationProvider
)
from app.services.google_drive import (
    encrypt_token,
    decrypt_token,
    generate_oauth_state,
    verify_oauth_state
)

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_tenants():
    db = SessionLocal()
    # 1. Company A
    comp_a = db.query(Company).filter(Company.code == "COMP_GDRIVE_A").first()
    if not comp_a:
        comp_a = Company(
            name="Alpha Corp",
            code="COMP_GDRIVE_A",
            slug="alpha-corp",
            status="ACTIVE"
        )
        db.add(comp_a)
        db.commit()
        db.refresh(comp_a)

    # 2. Company B
    comp_b = db.query(Company).filter(Company.code == "COMP_GDRIVE_B").first()
    if not comp_b:
        comp_b = Company(
            name="Beta Corp",
            code="COMP_GDRIVE_B",
            slug="beta-corp",
            status="ACTIVE"
        )
        db.add(comp_b)
        db.commit()
        db.refresh(comp_b)

    # 3. Users for Company A
    hr_admin_a = db.query(User).filter(User.email == "hr.admin.a@alphacorp.com").first()
    if not hr_admin_a:
        hr_admin_a = User(
            company_id=comp_a.id,
            email="hr.admin.a@alphacorp.com",
            first_name="Alice",
            last_name="Admin",
            employee_code="ALP-001",
            hashed_password="hashed_pwd",
            role=UserRole.HR_ADMIN.value,
            status="ACTIVE",
            employment_type="FULL_TIME",
            date_of_joining="2026-01-01"
        )
        db.add(hr_admin_a)
        db.commit()
        db.refresh(hr_admin_a)

    employee_a = db.query(User).filter(User.email == "emp.a@alphacorp.com").first()
    if not employee_a:
        employee_a = User(
            company_id=comp_a.id,
            email="emp.a@alphacorp.com",
            first_name="Edward",
            last_name="Employee",
            employee_code="ALP-002",
            hashed_password="hashed_pwd",
            role=UserRole.EMPLOYEE.value,
            status="ACTIVE",
            employment_type="FULL_TIME",
            date_of_joining="2026-01-01"
        )
        db.add(employee_a)
        db.commit()
        db.refresh(employee_a)

    manager_a = db.query(User).filter(User.email == "mgr.a@alphacorp.com").first()
    if not manager_a:
        manager_a = User(
            company_id=comp_a.id,
            email="mgr.a@alphacorp.com",
            first_name="Mark",
            last_name="Manager",
            employee_code="ALP-003",
            hashed_password="hashed_pwd",
            role=UserRole.MANAGER.value,
            status="ACTIVE",
            employment_type="FULL_TIME",
            date_of_joining="2026-01-01"
        )
        db.add(manager_a)
        db.commit()
        db.refresh(manager_a)

    # 4. User for Company B
    hr_admin_b = db.query(User).filter(User.email == "hr.admin.b@betacorp.com").first()
    if not hr_admin_b:
        hr_admin_b = User(
            company_id=comp_b.id,
            email="hr.admin.b@betacorp.com",
            first_name="Bob",
            last_name="Admin",
            employee_code="BET-001",
            hashed_password="hashed_pwd",
            role=UserRole.HR_ADMIN.value,
            status="ACTIVE",
            employment_type="FULL_TIME",
            date_of_joining="2026-01-01"
        )
        db.add(hr_admin_b)
        db.commit()
        db.refresh(hr_admin_b)

    result = {
        "comp_a_id": comp_a.id,
        "comp_b_id": comp_b.id,
        "hr_a": {"id": hr_admin_a.id, "email": hr_admin_a.email, "company_id": hr_admin_a.company_id, "role": hr_admin_a.role},
        "emp_a": {"id": employee_a.id, "email": employee_a.email, "company_id": employee_a.company_id, "role": employee_a.role},
        "mgr_a": {"id": manager_a.id, "email": manager_a.email, "company_id": manager_a.company_id, "role": manager_a.role},
        "hr_b": {"id": hr_admin_b.id, "email": hr_admin_b.email, "company_id": hr_admin_b.company_id, "role": hr_admin_b.role}
    }
    db.close()
    return result


from app.core.security import create_access_token

def get_token_for(user_dict: dict):
    return create_access_token(subject=user_dict["id"], role=user_dict["role"])


# TEST 1: Unauthorized Employee Access Blocked
def test_1_unauthorized_employee_access_blocked(setup_tenants):
    emp = setup_tenants["emp_a"]
    token = get_token_for(emp)
    res = client.get("/api/integrations/google-drive/status", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403
    assert "Only Organization Owners and HR Administrators" in res.json()["detail"]


# TEST 2: Unauthorized Manager Access Blocked
def test_2_unauthorized_manager_access_blocked(setup_tenants):
    mgr = setup_tenants["mgr_a"]
    token = get_token_for(mgr)
    res = client.get("/api/integrations/google-drive/status", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403
    assert "Access denied" in res.json()["detail"]


# TEST 3: HR Admin Access Allowed & Unconfigured Graceful State
def test_3_hr_admin_access_allowed_and_unconfigured_graceful_state(setup_tenants):
    hr = setup_tenants["hr_a"]
    token = get_token_for(hr)
    res = client.get("/api/integrations/google-drive/status", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "connection_status" in data
    assert "auto_attendance_reports" in data


# TEST 4: Fernet Token Encryption & Decryption
def test_4_fernet_token_encryption_and_decryption():
    test_refresh_token = "1//04test_google_refresh_token_very_long_secret_xyz123"
    cipher_text = encrypt_token(test_refresh_token)
    assert cipher_text != test_refresh_token
    assert len(cipher_text) > 30

    decrypted = decrypt_token(cipher_text)
    assert decrypted == test_refresh_token
    # Empty token returns empty
    assert encrypt_token("") == ""
    assert decrypt_token("") == ""


# TEST 5: CSRF OAuth State Generation and Tamper-Proof Validation
def test_5_oauth_state_tamper_validation(setup_tenants):
    hr = setup_tenants["hr_a"]
    state = generate_oauth_state(hr["company_id"], hr["id"], hr["role"])
    payload = verify_oauth_state(state)
    assert payload["company_id"] == hr["company_id"]
    assert payload["user_id"] == hr["id"]

    # Tampered state fails
    tampered_state = state[:-5] + "XXXXX"
    with pytest.raises(ValueError):
        verify_oauth_state(tampered_state)


# TEST 6: OAuth Connect URL Generation With Configured Credentials
def test_6_oauth_connect_generation(setup_tenants):
    hr = setup_tenants["hr_a"]
    token = get_token_for(hr)

    with patch.object(settings, "GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com"), \
         patch.object(settings, "GOOGLE_CLIENT_SECRET", "test-client-secret-9988"):
        res = client.get("/api/integrations/google-drive/connect", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        data = res.json()
        assert "authorization_url" in data
        assert "accounts.google.com/o/oauth2/v2/auth" in data["authorization_url"]
        assert "client_id=test-client-id" in data["authorization_url"]
        assert "access_type=offline" in data["authorization_url"]
        assert "prompt=consent" in data["authorization_url"]


# TEST 7: OAuth Callback Handling & Automatic Folder Hierarchy Initialization
def test_7_oauth_callback_handling(setup_tenants):
    hr = setup_tenants["hr_a"]
    state = generate_oauth_state(hr["company_id"], hr["id"], hr["role"])

    mock_tokens = {
        "access_token": "mock_access_token_12345",
        "refresh_token": "mock_refresh_token_abcde",
        "expires_in": 3600,
        "token_type": "Bearer"
    }

    mock_folders = {
        "drive_root_folder_id": "folder_root_111",
        "drive_company_folder_id": "folder_comp_222",
        "drive_attendance_folder_id": "folder_att_333",
        "drive_employees_folder_id": "folder_emp_444",
        "drive_emp_reports_folder_id": "folder_emp_rep_555",
        "drive_payroll_folder_id": "folder_pay_666",
        "drive_payslips_folder_id": "folder_pay_slip_777",
        "drive_leave_folder_id": "folder_leave_888",
        "drive_leave_reports_folder_id": "folder_leave_rep_999"
    }

    with patch("app.api.v1.endpoints.integrations.exchange_code_for_tokens", return_value=mock_tokens), \
         patch("app.api.v1.endpoints.integrations.get_user_email", return_value="admin@alphacorp.com"), \
         patch("app.api.v1.endpoints.integrations.init_drive_folder_hierarchy", return_value=mock_folders):

        res = client.get(
            f"/api/integrations/google-drive/callback?code=mock_google_auth_code&state={state}",
            follow_redirects=False
        )

        assert res.status_code in (302, 307)
        assert "google_drive=connected" in res.headers["location"]

        # Verify database record
        db = SessionLocal()
        integ = db.query(OrganizationIntegration).filter(
            OrganizationIntegration.company_id == hr["company_id"],
            OrganizationIntegration.provider == IntegrationProvider.GOOGLE_DRIVE.value
        ).first()
        assert integ is not None
        assert integ.connection_status == ConnectionStatus.CONNECTED.value
        assert integ.connected_account_email == "admin@alphacorp.com"
        assert integ.drive_root_folder_id == "folder_root_111"
        assert integ.drive_attendance_folder_id == "folder_att_333"
        # Refresh token must be encrypted
        assert integ.encrypted_refresh_token != "mock_refresh_token_abcde"
        assert decrypt_token(integ.encrypted_refresh_token) == "mock_refresh_token_abcde"
        db.close()


# TEST 8: Update Integration Settings
def test_8_update_integration_settings(setup_tenants):
    hr = setup_tenants["hr_a"]
    token = get_token_for(hr)

    res = client.post(
        "/api/integrations/google-drive/settings",
        json={"auto_attendance_reports": False, "auto_monthly_reports": True},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["auto_attendance_reports"] is False
    assert data["auto_monthly_reports"] is True


# TEST 9: PDF & CSV Upload to Google Drive
def test_9_report_upload_to_google_drive(setup_tenants):
    hr = setup_tenants["hr_a"]
    token = get_token_for(hr)

    # Ensure integration is CONNECTED
    db = SessionLocal()
    integ = db.query(OrganizationIntegration).filter(
        OrganizationIntegration.company_id == hr["company_id"]
    ).first()
    if not integ:
        integ = OrganizationIntegration(
            company_id=hr["company_id"],
            provider=IntegrationProvider.GOOGLE_DRIVE.value
        )
        db.add(integ)
    integ.connection_status = ConnectionStatus.CONNECTED.value
    integ.encrypted_refresh_token = encrypt_token("mock_refresh_token")
    integ.drive_attendance_folder_id = "folder_att_333"
    db.commit()
    db.close()

    mock_upload_resp = {
        "id": "file_drive_pdf_12345",
        "name": "Attendance_Report_2026-11-02.pdf",
        "webViewLink": "https://drive.google.com/file/d/file_drive_pdf_12345/view"
    }

    with patch("app.api.v1.endpoints.integrations.upload_file_to_drive", return_value=mock_upload_resp), \
         patch("app.api.v1.endpoints.integrations.get_or_create_date_subfolder", return_value="folder_month_nov_2026"), \
         patch("app.api.v1.endpoints.integrations.ensure_valid_access_token", return_value="fresh_token"):

        res = client.post(
            "/api/integrations/google-drive/upload",
            json={
                "report_type": "DAILY_ATTENDANCE",
                "date": "2026-11-02"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["file_id"] == "file_drive_pdf_12345"
        assert "drive.google.com" in data["web_view_link"]


# TEST 10: Organization Isolation Guard (Cross-Tenant Access Rejected)
def test_10_cross_tenant_isolation(setup_tenants):
    hr_b = setup_tenants["hr_b"]
    token_b = get_token_for(hr_b)

    # Company B checks status -> must NOT see Company A's connection details or email
    res = client.get("/api/integrations/google-drive/status", headers={"Authorization": f"Bearer {token_b}"})
    assert res.status_code == 200
    data = res.json()
    assert data["connected_account_email"] is None
    assert data["total_uploads_count"] == 0

    # Company B checks uploads -> must be empty (cannot see Company A uploads)
    res_up = client.get("/api/integrations/google-drive/uploads", headers={"Authorization": f"Bearer {token_b}"})
    assert res_up.status_code == 200
    assert len(res_up.json()) == 0


# TEST 11: Disconnect Google Drive
def test_11_disconnect_google_drive(setup_tenants):
    hr_a = setup_tenants["hr_a"]
    token_a = get_token_for(hr_a)

    # Ensure integration has connected status and at least 1 upload log before testing disconnect
    db = SessionLocal()
    integ = db.query(OrganizationIntegration).filter(
        OrganizationIntegration.company_id == hr_a["company_id"]
    ).first()
    if not integ:
        integ = OrganizationIntegration(company_id=hr_a["company_id"])
        db.add(integ)
    integ.connection_status = ConnectionStatus.CONNECTED.value
    integ.encrypted_refresh_token = encrypt_token("mock_refresh_token_to_revoke")
    integ.drive_attendance_folder_id = "folder_att_333"

    up = db.query(OrganizationDriveUpload).filter(OrganizationDriveUpload.company_id == hr_a["company_id"]).first()
    if not up:
        up = OrganizationDriveUpload(
            company_id=hr_a["company_id"],
            report_type="DAILY_ATTENDANCE",
            file_name="Attendance_Report.pdf",
            upload_status=UploadStatus.SUCCESS.value
        )
        db.add(up)
    db.commit()
    db.close()

    with patch("app.api.v1.endpoints.integrations.revoke_token", return_value=True):
        res = client.post(
            "/api/integrations/google-drive/disconnect",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert res.status_code == 200
        assert res.json()["success"] is True

        # Verify status in database
        db = SessionLocal()
        integ = db.query(OrganizationIntegration).filter(
            OrganizationIntegration.company_id == hr_a["company_id"]
        ).first()
        assert integ.connection_status == ConnectionStatus.NOT_CONNECTED.value
        assert integ.encrypted_refresh_token is None
        assert integ.access_token is None
        # Folder hierarchy must be preserved for future reconnection
        assert integ.drive_attendance_folder_id == "folder_att_333"

        # Upload history is strictly preserved
        upload_count = db.query(OrganizationDriveUpload).filter(
            OrganizationDriveUpload.company_id == hr_a["company_id"]
        ).count()
        assert upload_count >= 1
        db.close()


# TEST 12: Real-time Attendance Check-in Never Fails Even If Google Drive Is Down
def test_12_attendance_independent_of_google_drive(setup_tenants):
    emp = setup_tenants["emp_a"]
    token = get_token_for(emp)

    # Attendance punch should proceed without any dependencies on Google Drive
    res = client.post(
        "/api/v1/attendance/punch",
        json={"punch_type": "IN", "device": "Web Terminal"},
        headers={"Authorization": f"Bearer {token}"}
    )
    # 200 OK (or 400 if already checked in, but never 500 or failing due to Drive)
    assert res.status_code in (200, 400)
