import pytest
import time
import json
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def get_auth_token(email: str, password: str) -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]

def test_auto_employee_id_generation():
    admin_token = get_auth_token("admin@acme.corp", "Admin@EMP001")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Preview Next Code
    res_code = client.get("/api/v1/employees/next-code", headers=headers)
    assert res_code.status_code == 200
    next_code = res_code.json()["next_code"]
    assert next_code.startswith("FP-")

    # 2. Create Employee with empty code -> should auto-generate
    uid = int(time.time() * 1000) % 100000
    res_create = client.post("/api/v1/employees", json={
        "first_name": "Jonathan",
        "last_name": "Sterling",
        "email": f"jonathan.{uid}@acme.corp",
        "phone": "+1 (555) 011-8822",
        "role": "EMPLOYEE",
        "employment_type": "FULL_TIME",
        "date_of_joining": "2026-03-01",
        "work_location": "Headquarters",
        "employee_code": None
    }, headers=headers)
    assert res_create.status_code == 201, res_create.text
    emp_data = res_create.json()
    assert emp_data["employee_code"].startswith("FP-")
    assert emp_data["email"] == f"jonathan.{uid}@acme.corp"
    assert emp_data["status"] == "PENDING_INVITATION"

def test_role_assignment_security():
    hr_token = get_auth_token("hr@acme.corp", "HR@EMP002")
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    # HR Admin cannot create Super Admin
    res_forbidden = client.post("/api/v1/employees", json={
        "first_name": "Rogue",
        "last_name": "Admin",
        "email": "rogue@acme.corp",
        "role": "SUPER_ADMIN",
        "employment_type": "FULL_TIME",
        "date_of_joining": "2026-03-01"
    }, headers=hr_headers)
    assert res_forbidden.status_code == 403
    assert "HR administrators cannot assign Super Admin" in res_forbidden.json()["detail"]

def test_duplicate_employee_prevention():
    admin_token = get_auth_token("admin@acme.corp", "Admin@EMP001")
    headers = {"Authorization": f"Bearer {admin_token}"}

    res_dup = client.post("/api/v1/employees", json={
        "first_name": "Duplicate",
        "last_name": "User",
        "email": "admin@acme.corp", # Existing email
        "role": "EMPLOYEE",
        "employment_type": "FULL_TIME",
        "date_of_joining": "2026-03-01"
    }, headers=headers)
    assert res_dup.status_code == 400
    assert "already exists" in res_dup.json()["detail"]

def test_invitation_and_account_activation_workflow():
    admin_token = get_auth_token("admin@acme.corp", "Admin@EMP001")
    headers = {"Authorization": f"Bearer {admin_token}"}
    uid = int(time.time() * 1000) % 100000

    # 1. Create a draft employee
    res_create = client.post("/api/v1/employees", json={
        "first_name": "Lucas",
        "last_name": "Scott",
        "email": f"lucas.{uid}@acme.corp",
        "role": "EMPLOYEE",
        "employment_type": "FULL_TIME",
        "date_of_joining": "2026-03-01",
        "status": "DRAFT"
    }, headers=headers)
    assert res_create.status_code == 201
    emp_id = res_create.json()["id"]

    # 2. Invite Employee
    res_invite = client.post(f"/api/v1/employees/{emp_id}/invite", headers=headers)
    assert res_invite.status_code == 200
    invite_data = res_invite.json()
    token = invite_data["invitation_token"]
    assert token is not None
    assert invite_data["status"] == "INVITED"

    # 3. Employee activates account with their invitation token
    res_act = client.post("/api/v1/auth/activate-invite", json={
        "token": token,
        "password": "LucasPassword2026!",
        "auth_user_id": f"supabase-auth-uuid-lucas-{uid}"
    })
    assert res_act.status_code == 200
    auth_data = res_act.json()
    assert "access_token" in auth_data
    assert auth_data["user"]["status"] == "ACTIVE"

    # 4. Token cannot be reused (one-time activation)
    res_reuse = client.post("/api/v1/auth/activate-invite", json={
        "token": token,
        "password": "HackedPassword123"
    })
    assert res_reuse.status_code == 400

def test_biometric_face_enrollment_and_revocation():
    admin_token = get_auth_token("admin@acme.corp", "Admin@EMP001")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    uid = int(time.time() * 1000) % 100000

    # 1. Create and activate a new employee for biometric testing
    res_create = client.post("/api/v1/employees", json={
        "first_name": "Maya",
        "last_name": "Lin",
        "email": f"maya.{uid}@acme.corp",
        "password": "MayaPassword2026!",
        "status": "ACTIVE",
        "role": "EMPLOYEE",
        "employment_type": "FULL_TIME",
        "date_of_joining": "2026-03-01"
    }, headers=admin_headers)
    assert res_create.status_code == 201
    maya_id = res_create.json()["id"]

    maya_token = get_auth_token(f"maya.{uid}@acme.corp", "MayaPassword2026!")
    maya_headers = {"Authorization": f"Bearer {maya_token}"}

    # 2. Consent required for enrollment
    mock_vector = json.dumps([0.05 * (i % 10) for i in range(128)])
    res_no_consent = client.post("/api/v1/biometrics/enroll", json={
        "face_vector": mock_vector,
        "consent_given": False
    }, headers=maya_headers)
    assert res_no_consent.status_code == 400
    assert "Biometric consent is mandatory" in res_no_consent.json()["detail"]

    # 3. Successful enrollment with consent
    res_enroll = client.post("/api/v1/biometrics/enroll", json={
        "face_vector": mock_vector,
        "consent_given": True,
        "quality_score": 0.98,
        "liveness_data": {"motion_score": 0.95, "blink_detected": True}
    }, headers=maya_headers)
    assert res_enroll.status_code == 200
    assert res_enroll.json()["success"] is True

    # 4. Verify enrollment status
    res_status = client.get("/api/v1/biometrics/status", headers=maya_headers)
    assert res_status.status_code == 200
    assert res_status.json()["enrolled"] is True

    # 5. Revocation by Administrator
    res_revoke = client.post(f"/api/v1/biometrics/admin/reset/{maya_id}", headers=admin_headers)
    assert res_revoke.status_code == 200
    assert res_revoke.json()["success"] is True

    # Status should now reflect not enrolled
    res_after_revoke = client.get("/api/v1/biometrics/status", headers=maya_headers)
    assert res_after_revoke.status_code == 200
    assert res_after_revoke.json()["enrolled"] is False

def test_attendance_state_machine_strictness():
    admin_token = get_auth_token("admin@acme.corp", "Admin@EMP001")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    uid = int(time.time() * 1000) % 100000

    # Create fresh active employee
    res_create = client.post("/api/v1/employees", json={
        "first_name": "Daniel",
        "last_name": "Craig",
        "email": f"daniel.{uid}@acme.corp",
        "password": "DanielPassword2026!",
        "status": "ACTIVE",
        "role": "EMPLOYEE",
        "employment_type": "FULL_TIME",
        "date_of_joining": "2026-03-01"
    }, headers=admin_headers)
    assert res_create.status_code == 201

    daniel_token = get_auth_token(f"daniel.{uid}@acme.corp", "DanielPassword2026!")
    daniel_headers = {"Authorization": f"Bearer {daniel_token}"}

    # 1. Attempt Check-Out WITHOUT Check-In -> Must fail
    res_invalid_out = client.post("/api/v1/attendance/punch", json={
        "punch_type": "OUT"
    }, headers=daniel_headers)
    assert res_invalid_out.status_code == 400
    assert "Cannot check out without an active check-in session" in res_invalid_out.json()["detail"]

    # 2. First Check-In -> Must succeed
    res_in = client.post("/api/v1/attendance/punch", json={
        "punch_type": "IN",
        "location_note": "HQ Main Entrance"
    }, headers=daniel_headers)
    assert res_in.status_code == 200
    assert len(res_in.json()["punches"]) == 1

    # 3. Duplicate Check-In -> Must fail
    res_dup_in = client.post("/api/v1/attendance/punch", json={
        "punch_type": "IN"
    }, headers=daniel_headers)
    assert res_dup_in.status_code == 400
    assert "Active check-in session already in progress" in res_dup_in.json()["detail"]

    # 4. Check-Out -> Must succeed
    res_out = client.post("/api/v1/attendance/punch", json={
        "punch_type": "OUT"
    }, headers=daniel_headers)
    assert res_out.status_code == 200
    assert len(res_out.json()["punches"]) == 2

    # 5. Duplicate Check-Out -> Must fail
    res_dup_out = client.post("/api/v1/attendance/punch", json={
        "punch_type": "OUT"
    }, headers=daniel_headers)
    assert res_dup_out.status_code == 400
    assert "Already checked out" in res_dup_out.json()["detail"]

def test_hr_attendance_dashboard_aggregation():
    admin_token = get_auth_token("admin@acme.corp", "Admin@EMP001")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    res_dash = client.get("/api/v1/attendance/hr-dashboard", headers=admin_headers)
    assert res_dash.status_code == 200
    data = res_dash.json()
    assert "total_employees" in data
    assert "present_today" in data
    assert "absent_today" in data
    assert "currently_checked_in" in data
    assert "checked_out_today" in data
    assert "employees" in data
    assert isinstance(data["employees"], list)

    # Verification failures review
    res_failures = client.get("/api/v1/biometrics/verification-failures", headers=admin_headers)
    assert res_failures.status_code == 200
    assert isinstance(res_failures.json(), list)
