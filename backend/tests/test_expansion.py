import pytest
import json
import time
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def get_auth_token(email: str = "alex@acme.corp", password: str = "Alex@EMP004") -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]

def test_biometric_enrollment_status():
    token = get_auth_token("alex@acme.corp")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/biometrics/status", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "enrolled" in data
    assert data["enrolled"] is True
    assert data["status"].upper() == "VERIFIED"

def test_biometric_verify_punch_and_anti_spoof():
    token = get_auth_token("alex@acme.corp")
    headers = {"Authorization": f"Bearer {token}"}

    res_me = client.get("/api/v1/auth/me", headers=headers)
    assert res_me.status_code == 200
    user_id = res_me.json()["id"]

    from app.core.database import SessionLocal
    from app.models.attendance import AttendanceRecord, AttendancePunch
    from datetime import datetime, timezone
    db = SessionLocal()
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    rec = db.query(AttendanceRecord).filter(AttendanceRecord.user_id == user_id, AttendanceRecord.date == today_str).first()
    if rec:
        db.query(AttendancePunch).filter(AttendancePunch.attendance_record_id == rec.id).delete()
        db.delete(rec)
        db.commit()
    db.close()

    from update_face_templates import gen_vec_py
    mock_vector = json.dumps(gen_vec_py(user_id))

    # Re-enroll with mock_vector to guarantee template match
    client.post("/api/v1/biometrics/enroll", json={
        "consent_given": True,
        "face_vector": mock_vector,
        "quality_score": 0.98,
        "liveness_data": {
            "timestamp": int(time.time() * 1000),
            "motion_score": 0.95,
            "blink_detected": True,
            "frame_variance": 0.92
        }
    }, headers=headers)

    # 1. Anti-spoof replay detection test: Old timestamp (>30 mins) should fail
    old_ts = int((time.time() - 3600) * 1000)

    res_replay = client.post("/api/v1/biometrics/verify-punch", json={
        "punch_type": "IN",
        "face_data": mock_vector,
        "liveness_data": {
            "timestamp": old_ts,
            "motion_score": 0.9,
            "blink_detected": True,
            "frame_variance": 0.9
        }
    }, headers=headers)
    assert res_replay.status_code == 400
    assert "Replay attack detected" in res_replay.json()["detail"]

    # 2. Legitimate Punch with current fresh timestamp
    fresh_ts = int(time.time() * 1000)
    res_punch = client.post("/api/v1/biometrics/verify-punch", json={
        "punch_type": "IN",
        "face_data": mock_vector,
        "liveness_data": {
            "timestamp": fresh_ts,
            "motion_score": 0.95,
            "blink_detected": True,
            "frame_variance": 0.92
        },
        "device": "Biometric Test Suite"
    }, headers=headers)
    assert res_punch.status_code == 200, f"Punch failed: {res_punch.text}"
    pdata = res_punch.json()
    assert pdata["success"] is True
    assert pdata["confidence"] >= 0.85
    assert "record" in pdata

def test_fallback_punch():
    token = get_auth_token("alex@acme.corp")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/v1/biometrics/fallback-punch", json={
        "punch_type": "OUT",
        "reason": "Camera lens obstructed during evening punch"
    }, headers=headers)
    assert res.status_code == 200
    assert res.json()["success"] is True

def test_superadmin_system_health():
    token = get_auth_token("admin@acme.corp", "Admin@EMP001")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/superadmin/system-health", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "HEALTHY"
    assert data["metrics"]["total_companies"] >= 1
    assert data["metrics"]["face_id_enrolled_users"] >= 4

def test_performance_goals_and_reviews():
    token = get_auth_token("alex@acme.corp")
    headers = {"Authorization": f"Bearer {token}"}

    res_goals = client.get("/api/v1/performance/goals", headers=headers)
    assert res_goals.status_code == 200
    goals = res_goals.json()
    assert len(goals) >= 1

    res_revs = client.get("/api/v1/performance/reviews", headers=headers)
    assert res_revs.status_code == 200
    revs = res_revs.json()
    assert len(revs) >= 1

def test_lifecycle_tasks_and_helpdesk():
    token = get_auth_token("alex@acme.corp")
    headers = {"Authorization": f"Bearer {token}"}

    # Onboarding tasks
    res_tasks = client.get("/api/v1/lifecycle/tasks", headers=headers)
    assert res_tasks.status_code == 200
    tasks = res_tasks.json()
    assert len(tasks) >= 3

    # Toggle task
    t_id = tasks[0]["id"]
    res_toggle = client.put(f"/api/v1/lifecycle/tasks/{t_id}/toggle", headers=headers)
    assert res_toggle.status_code == 200
    assert res_toggle.json()["success"] is True

    # Helpdesk tickets
    res_tickets = client.get("/api/v1/helpdesk/tickets", headers=headers)
    assert res_tickets.status_code == 200
    tickets = res_tickets.json()
    assert len(tickets) >= 1

