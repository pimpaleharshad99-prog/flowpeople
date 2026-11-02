import math
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token, get_password_hash
from app.models.user import User
from app.models.biometrics import FaceEnrollment, FaceVerificationLog
from app.models.attendance import AttendanceRecord, AttendancePunch
from app.services.biometric_service import (
    APPROVED_MODEL_VERSION,
    APPROVED_VECTOR_DIM,
    SUPPORTED_MODEL_VERSIONS
)

client = TestClient(app)

def make_normalized_vector(dim: int = 128, seed: float = 1.0) -> list[float]:
    raw = [math.sin(seed + i * 0.3) for i in range(dim)]
    norm = math.sqrt(sum(x * x for x in raw))
    return [round(x / norm, 6) for x in raw]

@pytest.fixture(scope="module")
def test_employee():
    """Create an isolated test employee for biometric consistency verification."""
    db = SessionLocal()
    user = db.query(User).filter(User.email == "test.model.audit@flowcraft.corp").first()
    if not user:
        user = User(
            company_id=1,
            employee_code="FP-TEST-001",
            email="test.model.audit@flowcraft.corp",
            hashed_password=get_password_hash("TestPass123!"),
            first_name="Test",
            last_name="BiometricUser",
            role="EMPLOYEE",
            status="ACTIVE",
            employment_type="FULL_TIME",
            date_of_joining="2026-10-31"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    user_id = user.id
    db.close()

    yield user_id

    # Cleanup after test suite
    clean_db = SessionLocal()
    clean_db.query(FaceVerificationLog).filter(FaceVerificationLog.user_id == user_id).delete()
    clean_db.query(FaceEnrollment).filter(FaceEnrollment.user_id == user_id).delete()
    records = clean_db.query(AttendanceRecord).filter(AttendanceRecord.user_id == user_id).all()
    for r in records:
        clean_db.query(AttendancePunch).filter(AttendancePunch.attendance_record_id == r.id).delete()
        clean_db.delete(r)
    u = clean_db.query(User).filter(User.id == user_id).first()
    if u:
        clean_db.delete(u)
    clean_db.commit()
    clean_db.close()

@pytest.fixture(autouse=True)
def clean_today_punches(test_employee):
    """Clean today's punches before each test."""
    db = SessionLocal()
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == test_employee,
        AttendanceRecord.date == today_str
    ).all()
    for r in records:
        db.query(AttendancePunch).filter(AttendancePunch.attendance_record_id == r.id).delete()
        db.delete(r)
    db.commit()
    db.close()
    yield

def test_approved_model_enrollment(test_employee):
    """Test 1: Enroll face with approved model v2.0-facenet-norm (128-D) -> 200 OK."""
    token = create_access_token(test_employee, "EMPLOYEE")
    headers = {"Authorization": f"Bearer {token}"}

    vec128 = make_normalized_vector(128, seed=2.5)

    res = client.post("/api/v1/biometrics/enroll", json={
        "face_vector": str(vec128),
        "consent_given": True,
        "quality_score": 0.98,
        "model_version": APPROVED_MODEL_VERSION,
        "liveness_data": {"motion_score": 0.96, "blink_detected": True}
    }, headers=headers)

    assert res.status_code == 200, f"Enrollment failed: {res.text}"
    data = res.json()
    assert data["success"] is True

    # Check biometric status endpoint returns approved model metadata
    res_status = client.get("/api/v1/biometrics/status", headers=headers)
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert status_data["enrolled"] is True
    assert status_data["status"] == "verified"  # Lowercase per backend audit
    assert status_data["template_version"] == APPROVED_MODEL_VERSION
    assert status_data["is_model_compatible"] is True

def test_reject_incompatible_model_version(test_employee):
    """Test 2: Prevent enrollment with incompatible model version string -> 400 Bad Request."""
    token = create_access_token(test_employee, "EMPLOYEE")
    headers = {"Authorization": f"Bearer {token}"}

    vec128 = make_normalized_vector(128, seed=3.0)

    res = client.post("/api/v1/biometrics/enroll", json={
        "face_vector": str(vec128),
        "consent_given": True,
        "quality_score": 0.95,
        "model_version": "arcface-resnet100-v1",  # INCOMPATIBLE MODEL
        "liveness_data": {"motion_score": 0.92, "blink_detected": True}
    }, headers=headers)

    assert res.status_code == 400
    assert "INCOMPATIBLE_MODEL_VERSION" in res.json()["detail"] or "Incompatible model version" in res.json()["detail"]

def test_reject_incompatible_vector_dimension(test_employee):
    """Test 3: Prevent enrollment with incompatible vector dimensionality (e.g. 512-D) -> 400 Bad Request."""
    token = create_access_token(test_employee, "EMPLOYEE")
    headers = {"Authorization": f"Bearer {token}"}

    vec512 = make_normalized_vector(512, seed=4.0)

    res = client.post("/api/v1/biometrics/enroll", json={
        "face_vector": str(vec512),
        "consent_given": True,
        "quality_score": 0.95,
        "model_version": APPROVED_MODEL_VERSION,
        "liveness_data": {"motion_score": 0.92, "blink_detected": True}
    }, headers=headers)

    assert res.status_code == 400
    assert "INCOMPATIBLE_VECTOR_DIMENSION" in res.json()["detail"] or "128" in res.json()["detail"]

def test_verification_rejects_incompatible_model_probe(test_employee):
    """Test 4: Verification test with probe from incompatible model version is rejected."""
    token = create_access_token(test_employee, "EMPLOYEE")
    headers = {"Authorization": f"Bearer {token}"}

    vec128 = make_normalized_vector(128, seed=5.0)
    # Ensure enrolled
    client.post("/api/v1/biometrics/enroll", json={
        "face_vector": str(vec128),
        "consent_given": True,
        "quality_score": 0.98,
        "model_version": APPROVED_MODEL_VERSION,
        "liveness_data": {"motion_score": 0.96, "blink_detected": True}
    }, headers=headers)

    # Attempt verification using probe claiming an incompatible model
    res_test = client.post("/api/v1/biometrics/verify-test", json={
        "face_data": str(vec128),
        "model_version": "arcface-512",
        "liveness_data": {"motion_score": 0.95, "blink_detected": True}
    }, headers=headers)

    assert res_test.status_code == 400
    assert "INCOMPATIBLE_MODEL_VERSION" in res_test.json()["detail"]

def test_kiosk_1_to_n_filters_only_compatible_templates(test_employee):
    """Test 5: Kiosk 1:N punch compares only compatible templates with approved model."""
    token = create_access_token(test_employee, "EMPLOYEE")
    headers = {"Authorization": f"Bearer {token}"}

    vec128 = make_normalized_vector(128, seed=6.0)
    client.post("/api/v1/biometrics/enroll", json={
        "face_vector": str(vec128),
        "consent_given": True,
        "quality_score": 0.98,
        "model_version": APPROVED_MODEL_VERSION,
        "liveness_data": {"motion_score": 0.96, "blink_detected": True}
    }, headers=headers)

    # 1. Compatible probe with matching model -> successfully verifies and punches
    res_kiosk = client.post("/api/v1/biometrics/kiosk-scan-punch", json={
        "face_data": str(vec128),
        "model_version": APPROVED_MODEL_VERSION,
        "device": "Reception Kiosk Alpha",
        "liveness_data": {"motion_score": 0.95, "blink_detected": True}
    }, headers=headers)

    assert res_kiosk.status_code == 200
    data = res_kiosk.json()
    assert data["success"] is True
    assert data["employee"]["id"] == test_employee
    assert data["punch_type"] in ["IN", "OUT", "COMPLETED", "IGNORED"]

    # 2. Incompatible model version in kiosk probe -> rejected
    res_incompatible = client.post("/api/v1/biometrics/kiosk-scan-punch", json={
        "face_data": str(vec128),
        "model_version": "incompatible-facenet-v99",
        "device": "Reception Kiosk Alpha"
    }, headers=headers)

    assert res_incompatible.status_code == 400
    assert "MODEL_VERSION_INCOMPATIBLE" in res_incompatible.json()["detail"] or "incompatible" in res_incompatible.json()["detail"].lower()

def test_biometric_audit_logs_casing_and_sanitization():
    """Test 6: Audit logs return lowercase status and authentic device strings without fake IPs."""
    db = SessionLocal()
    admin = db.query(User).filter(User.role.in_(["SUPER_ADMIN", "HR_ADMIN"])).first()
    admin_id = admin.id if admin else 1
    db.close()
    hr_token = create_access_token(admin_id, "SUPER_ADMIN")
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    res = client.get("/api/v1/biometrics/logs", headers=hr_headers)
    assert res.status_code == 200
    logs = res.json()
    assert isinstance(logs, list)

    for log in logs:
        # Verify lowercase status
        assert log["status"] == log["status"].lower(), f"Status not lowercase: {log['status']}"
        # Verify no fabricated fallback IP
        assert log.get("device_ip") != "127.0.0.1 (Kiosk Terminal)"
        assert log.get("device_info") is not None
