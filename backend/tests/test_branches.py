import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def get_auth_token(email: str, password: str) -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]

def test_list_branches():
    token = get_auth_token("alex@acme.corp", "Alex@EMP004")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/organization/branches", headers=headers)
    assert res.status_code == 200
    branches = res.json()
    assert isinstance(branches, list)
    assert len(branches) >= 3
    
    # Check that HQ exists with geofence properties
    hq = next((b for b in branches if b["code"] == "SF-HQ"), None)
    assert hq is not None
    assert hq["is_headquarters"] is True
    assert hq["latitude"] is not None
    assert hq["geofence_radius_meters"] == 200

def test_create_and_update_branch():
    admin_token = get_auth_token("admin@acme.corp", "Admin@EMP001")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create a new branch office
    new_branch_payload = {
        "name": "Tokyo Tech Lab",
        "code": "TYO-01",
        "address": "Roppongi Hills Mori Tower",
        "city": "Tokyo",
        "country": "Japan",
        "timezone": "Asia/Tokyo",
        "latitude": 35.6605,
        "longitude": 139.7292,
        "geofence_radius_meters": 120,
        "is_geofence_enforced": True,
        "is_headquarters": False
    }

    res_create = client.post("/api/v1/organization/branches", json=new_branch_payload, headers=admin_headers)
    assert res_create.status_code == 201
    created_branch = res_create.json()
    branch_id = created_branch["id"]
    assert created_branch["name"] == "Tokyo Tech Lab"
    assert created_branch["geofence_radius_meters"] == 120

    # 2. Update the branch radius
    res_update = client.put(f"/api/v1/organization/branches/{branch_id}", json={
        "geofence_radius_meters": 250
    }, headers=admin_headers)
    assert res_update.status_code == 200
    assert res_update.json()["geofence_radius_meters"] == 250

    # 3. Clean up by deleting the branch
    res_delete = client.delete(f"/api/v1/organization/branches/{branch_id}", headers=admin_headers)
    assert res_delete.status_code == 204

def test_branch_rbac_enforcement():
    # Regular employee should NOT be able to create branches
    emp_token = get_auth_token("alex@acme.corp", "Alex@EMP004")
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    res = client.post("/api/v1/organization/branches", json={
        "name": "Unauthorized Office",
        "code": "BAD-01"
    }, headers=emp_headers)
    assert res.status_code in [401, 403]

