import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"
    assert "FlowPeople" in res.json()["service"]

def test_login_success():
    res = client.post("/api/v1/auth/login", json={
        "email": "admin@acme.corp",
        "password": "password123"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "admin@acme.corp"
    assert data["user"]["role"] in ["SUPER_ADMIN", "ADMIN"]

def test_attendance_status():
    # Login as Alex
    login_res = client.post("/api/v1/auth/login", json={
        "email": "alex@acme.corp",
        "password": "password123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/attendance/status", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "is_checked_in" in data
    assert "total_work_minutes" in data

def test_leave_balances():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "alex@acme.corp",
        "password": "password123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/leaves/my-balances", headers=headers)
    assert res.status_code == 200
    balances = res.json()
    assert len(balances) >= 3
    cl = next((b for b in balances if b["leave_type_code"] == "CL"), None)
    assert cl is not None
    assert cl["allocated"] == 12.0

def test_projects_and_timetracker():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "alex@acme.corp",
        "password": "password123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/timetracker/projects", headers=headers)
    assert res.status_code == 200
    projects = res.json()
    assert len(projects) >= 2
    assert any(p["code"] in ["FLOW-2026", "HRMS-2026"] for p in projects)

