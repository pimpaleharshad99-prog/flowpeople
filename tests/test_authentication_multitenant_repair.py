import pytest
import time
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, UserRole, EmploymentStatus
from app.models.company import Company, Branch, OrganizationMember
from app.core.security import get_password_hash, create_access_token

client = TestClient(app)

def test_1_backdoor_passwords_strictly_rejected():
    """Verify that universal passwords (password123, admin123, etc.) and role shortcuts are rejected."""
    # Attempt login with backdoor password
    res = client.post("/api/v1/auth/login", json={
        "email": "admin@acme.corp",
        "password": "password123"
    })
    assert res.status_code == 401, "Backdoor password123 must be rejected"
    assert "Incorrect" in res.json()["detail"]

    # Attempt role shortcut 'admin'
    res_shortcut = client.post("/api/v1/auth/login", json={
        "email": "admin",
        "password": "password123"
    })
    assert res_shortcut.status_code == 401, "Role shortcuts without valid credentials must be rejected"

def test_2_authentic_credentials_login_succeeds():
    """Verify that authentic bcrypt-hashed credentials login successfully."""
    res = client.post("/api/v1/auth/login", json={
        "email": "admin@acme.corp",
        "password": "Admin@EMP001"
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "admin@acme.corp"
    assert data["user"]["company_id"] is not None

def test_3_supabase_sync_tamper_protection():
    """Verify that /supabase-sync rejects unauthenticated or spoofed requests when Supabase is configured."""
    res = client.post("/api/v1/auth/supabase-sync", json={
        "email": "victim@company.com",
        "auth_user_id": str(uuid.uuid4()),
        "first_name": "Spoofed",
        "last_name": "User"
    })
    # If Supabase is configured, token is required and verified
    from app.services.platform_admin import is_supabase_configured
    if is_supabase_configured():
        assert res.status_code == 401, "Unverified sync without token must be rejected"

def test_4_organization_registration_full_user_payload():
    """Verify that organization registration returns complete user object with company_id, role, name."""
    uid = int(time.time() * 1000) % 100000
    comp_code = f"FIX{uid % 1000:03d}"
    contact_email = f"owner.{uid}@repairtest.com"
    supabase_cid = str(uuid.uuid4())

    reg_payload = {
        "company_name": f"Repair Corp {uid}",
        "company_code": comp_code,
        "contact_email": contact_email,
        "owner_first_name": "Alice",
        "owner_last_name": "Founder",
        "owner_password": "SecurePassword2026!",
        "owner_phone": "+1 555-0199",
        "plan_id": "trial",
        "billing_cycle": "MONTHLY",
        "country": "India",
        "currency": "INR",
        "timezone": "Asia/Kolkata",
        "supabase_company_id": supabase_cid,
        "supabase_slug": f"repair-corp-{uid}",
        "supabase_request_key": f"key-{uid}"
    }

    res = client.post("/api/v1/billing/register-organization", json=reg_payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["success"] is True
    assert "access_token" in data
    assert data["organization"]["code"] == comp_code
    assert data["organization"]["slug"] == f"repair-corp-{uid}"

    # Critical check: User payload MUST contain company_id and complete profile fields
    user_data = data["user"]
    assert "company_id" in user_data and user_data["company_id"] is not None
    assert user_data["first_name"] == "Alice"
    assert user_data["last_name"] == "Founder"
    assert user_data["role"] == UserRole.ORGANIZATION_OWNER.value
    assert user_data["is_platform_owner"] is False
    assert user_data["company_id"] == data["organization"]["id"]

    # Verify duplicate retry idempotency returns 200 with matching payload
    res_retry = client.post("/api/v1/billing/register-organization", json=reg_payload)
    assert res_retry.status_code == 200
    retry_data = res_retry.json()
    assert retry_data["user"]["company_id"] == data["organization"]["id"]
    assert "idempotent retry" in retry_data["message"]

def test_5_multi_tenant_isolation_enforced():
    """Verify that tenant employees, documents, and settings are strictly isolated between organizations."""
    db = SessionLocal()
    # Find two distinct companies
    companies = db.query(Company).all()
    assert len(companies) >= 2, "Need at least 2 companies for multi-tenant isolation test"
    comp_a = companies[0]
    comp_b = companies[1]

    # Find or create user in Company A and User in Company B
    user_a = db.query(User).filter(User.company_id == comp_a.id, User.is_platform_owner == False).first()
    user_b = db.query(User).filter(User.company_id == comp_b.id, User.is_platform_owner == False).first()
    db.close()

    assert user_a is not None and user_b is not None
    assert user_a.company_id != user_b.company_id

    token_b = create_access_token(subject=user_b.id, role=user_b.role)
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User B lists employees -> MUST ONLY return Company B employees
    emp_res = client.get("/api/v1/employees", headers=headers_b)
    assert emp_res.status_code == 200
    employees = emp_res.json()
    assert all(e["company_id"] == comp_b.id for e in employees)
    assert not any(e["id"] == user_a.id for e in employees)

def test_6_platform_admin_strict_authorization():
    """Verify Super Admin portal denies organization owners and only permits platform owners."""
    db = SessionLocal()
    org_owner = db.query(User).filter(
        User.role == UserRole.ORGANIZATION_OWNER.value,
        User.is_platform_owner == False
    ).first()
    db.close()

    if org_owner:
        owner_token = create_access_token(subject=org_owner.id, role=org_owner.role)
        res = client.get("/api/v1/superadmin/overview", headers={"Authorization": f"Bearer {owner_token}"})
        assert res.status_code == 403, "Organization Owner must not access platform Super Admin overview"
        assert "Forbidden" in res.json()["detail"] or "restricted" in res.json()["detail"].lower()
