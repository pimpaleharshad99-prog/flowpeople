import pytest
import time
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.attendance import AttendanceRecord, AttendancePunch
from app.models.biometrics import FaceEnrollment, FingerprintEnrollment
from app.services.qr_service import generate_kiosk_qr_payload, verify_kiosk_qr_payload

client = TestClient(app)

def get_auth_token(email: str, password: str) -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]

@pytest.fixture(autouse=True)
def clean_today_attendance():
    """Cleans up today's attendance for test user 4 (Alex) before running tests."""
    db = SessionLocal()
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    records = db.query(AttendanceRecord).filter(AttendanceRecord.date == today_str).all()
    for r in records:
        db.query(AttendancePunch).filter(AttendancePunch.attendance_record_id == r.id).delete()
        db.delete(r)
    db.commit()
    db.close()
    yield

def test_face_recognition_workflow():
    alex_token = get_auth_token("alex@acme.corp", "Alex@EMP004")
    alex_headers = {"Authorization": f"Bearer {alex_token}"}

    # 1. Enroll Face
    dummy_vector = [round(0.05 * ((i % 17) - 8), 4) for i in range(128)]
    res_enroll = client.post("/api/v1/biometrics/enroll", json={
        "face_vector": str(dummy_vector),
        "consent_given": True,
        "quality_score": 0.98,
        "liveness_data": {"timestamp": int(time.time() * 1000), "motion_score": 0.95, "blink_detected": True, "frame_variance": 0.9}
    }, headers=alex_headers)
    assert res_enroll.status_code == 200
    assert res_enroll.json()["success"] is True

    # 2. Test Face Verification Diagnostics (no attendance punch)
    res_test = client.post("/api/v1/biometrics/verify-test", json={
        "face_data": str(dummy_vector),
        "liveness_data": {"timestamp": int(time.time() * 1000), "motion_score": 0.95, "blink_detected": True, "frame_variance": 0.9}
    }, headers=alex_headers)
    assert res_test.status_code == 200
    test_data = res_test.json()
    assert test_data["success"] is True
    assert test_data["confidence"] >= 0.82

    # 3. Face ID Check-In
    res_in = client.post("/api/v1/biometrics/verify-punch", json={
        "punch_type": "IN",
        "face_data": str(dummy_vector),
        "liveness_data": {"timestamp": int(time.time() * 1000), "motion_score": 0.95, "blink_detected": True, "frame_variance": 0.9},
        "device": "Test Face Scanner Terminal"
    }, headers=alex_headers)
    assert res_in.status_code == 200
    in_data = res_in.json()
    assert in_data["success"] is True
    assert in_data["verification_method"] == "FACE"
    assert in_data["punch_type"] == "IN"

    # 4. Duplicate Check-In Prevention (Strict State Machine)
    res_dup = client.post("/api/v1/biometrics/verify-punch", json={
        "punch_type": "IN",
        "face_data": str(dummy_vector),
        "liveness_data": {"timestamp": int(time.time() * 1000), "motion_score": 0.95, "blink_detected": True, "frame_variance": 0.9}
    }, headers=alex_headers)
    assert res_dup.status_code == 400
    assert "Active check-in session already in progress" in res_dup.json()["detail"]

    # 5. Face ID Check-Out
    res_out = client.post("/api/v1/biometrics/verify-punch", json={
        "punch_type": "OUT",
        "face_data": str(dummy_vector),
        "liveness_data": {"timestamp": int(time.time() * 1000), "motion_score": 0.95, "blink_detected": True, "frame_variance": 0.9}
    }, headers=alex_headers)
    assert res_out.status_code == 200
    out_data = res_out.json()
    assert out_data["success"] is True
    assert out_data["punch_type"] == "OUT"

def test_fingerprint_scanner_workflow():
    alex_token = get_auth_token("alex@acme.corp", "Alex@EMP004")
    alex_headers = {"Authorization": f"Bearer {alex_token}"}

    # 1. Fetch challenge & status
    res_status = client.get("/api/v1/attendance/fingerprint/status", headers=alex_headers)
    assert res_status.status_code == 200

    res_ch = client.get("/api/v1/attendance/fingerprint/challenge", headers=alex_headers)
    assert res_ch.status_code == 200
    challenge = res_ch.json()["challenge"]
    assert len(challenge) > 10

    # 2. Enroll Fingerprint credential
    dummy_cred_id = "fprint_cred_alex_token_9981"
    res_enroll = client.post("/api/v1/attendance/fingerprint/enroll", json={
        "credential_id": dummy_cred_id,
        "public_key": "dummy_secp256r1_pubkey",
        "device_name": "DigitalPersona U.are.U 4500"
    }, headers=alex_headers)
    assert res_enroll.status_code == 200
    assert res_enroll.json()["success"] is True

    # 3. Fingerprint Check-In
    res_punch_in = client.post("/api/v1/attendance/fingerprint/verify-punch", json={
        "punch_type": "IN",
        "credential_id": dummy_cred_id,
        "challenge": challenge,
        "device": "SecuGen Hamster Pro 20"
    }, headers=alex_headers)
    assert res_punch_in.status_code == 200
    in_data = res_punch_in.json()
    assert in_data["success"] is True
    assert in_data["verification_method"] == "FINGERPRINT"
    assert in_data["punch_type"] == "IN"

    # 4. Fingerprint Check-Out
    # Generate new challenge for checkout
    res_ch2 = client.get("/api/v1/attendance/fingerprint/challenge", headers=alex_headers)
    ch2 = res_ch2.json()["challenge"]

    res_punch_out = client.post("/api/v1/attendance/fingerprint/verify-punch", json={
        "punch_type": "OUT",
        "credential_id": dummy_cred_id,
        "challenge": ch2,
        "device": "SecuGen Hamster Pro 20"
    }, headers=alex_headers)
    assert res_punch_out.status_code == 200
    out_data = res_punch_out.json()
    assert out_data["success"] is True
    assert out_data["punch_type"] == "OUT"

def test_qr_code_attendance_and_anti_replay():
    admin_token = get_auth_token("admin@acme.corp", "Admin@EMP001")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    alex_token = get_auth_token("alex@acme.corp", "Alex@EMP004")
    alex_headers = {"Authorization": f"Bearer {alex_token}"}

    # 1. Admin / Kiosk generates live rotating QR token
    res_kiosk = client.get("/api/v1/attendance/qr/active-kiosk-token?kiosk_id=KIOSK-MAIN-01", headers=admin_headers)
    assert res_kiosk.status_code == 200
    kiosk_data = res_kiosk.json()
    qr_token = kiosk_data["qr_token"]
    assert qr_token.startswith("FPQR:1:1:KIOSK-MAIN-01:")

    # 2. Employee scans QR code to Check-In
    res_scan_in = client.post("/api/v1/attendance/qr/scan-punch", json={
        "qr_token": qr_token,
        "punch_type": "IN",
        "device": "Employee Mobile iOS"
    }, headers=alex_headers)
    assert res_scan_in.status_code == 200
    in_data = res_scan_in.json()
    assert in_data["success"] is True
    assert in_data["verification_method"] == "QR_CODE"
    assert in_data["punch_type"] == "IN"
    assert in_data["kiosk_id"] == "KIOSK-MAIN-01"

    # 3. Anti-Replay: Attempt to re-use the exact same consumed QR token -> must fail
    res_replay = client.post("/api/v1/attendance/qr/scan-punch", json={
        "qr_token": qr_token,
        "punch_type": "OUT"
    }, headers=alex_headers)
    assert res_replay.status_code == 400
    assert "replay attack detected" in res_replay.json()["detail"].lower()

    # 4. Generate fresh rotating QR token for Check-Out
    res_kiosk2 = client.get("/api/v1/attendance/qr/active-kiosk-token?kiosk_id=KIOSK-MAIN-01", headers=admin_headers)
    fresh_qr_token = res_kiosk2.json()["qr_token"]
    assert fresh_qr_token != qr_token

    res_scan_out = client.post("/api/v1/attendance/qr/scan-punch", json={
        "qr_token": fresh_qr_token,
        "punch_type": "OUT"
    }, headers=alex_headers)
    assert res_scan_out.status_code == 200
    assert res_scan_out.json()["punch_type"] == "OUT"

def test_invalid_qr_and_expired_token_rejection():
    alex_token = get_auth_token("alex@acme.corp", "Alex@EMP004")
    alex_headers = {"Authorization": f"Bearer {alex_token}"}

    # Malformed token
    res_fake = client.post("/api/v1/attendance/qr/scan-punch", json={
        "qr_token": "FAKE-QR-TOKEN-12345",
        "punch_type": "IN"
    }, headers=alex_headers)
    assert res_fake.status_code == 400

    # Expired token simulated: timestamp 100 seconds ago
    old_ts = int(time.time()) - 100
    expired_payload = generate_kiosk_qr_payload(company_id=1, kiosk_id="KIOSK-01")
    # Tampered timestamp
    parts = expired_payload["qr_token"].split(":")
    parts[4] = str(old_ts)
    tampered_token = ":".join(parts)

    res_expired = client.post("/api/v1/attendance/qr/scan-punch", json={
        "qr_token": tampered_token,
        "punch_type": "IN"
    }, headers=alex_headers)
    assert res_expired.status_code == 400

