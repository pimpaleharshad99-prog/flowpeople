import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import uuid
import httpx

from app.main import app
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import create_access_token, get_password_hash
from app.models.company import Company
from app.models.user import User, UserRole
from app.models.platform_admin import PlatformAdmin

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_test_data():
    db = SessionLocal()
    # Ensure a base company exists
    company = db.query(Company).filter(Company.code == "GATEKEEPER_TEST_CO").first()
    if not company:
        company = Company(
            name="Gatekeeper Test Corp",
            code="GATEKEEPER_TEST_CO",
            slug="gatekeeper-test-corp",
            status="ACTIVE"
        )
        db.add(company)
        db.commit()
        db.refresh(company)

    # 1. Normal Employee
    emp = db.query(User).filter(User.email == "emp.regular@gatekeeper.test").first()
    if not emp:
        emp = User(
            company_id=company.id,
            email="emp.regular@gatekeeper.test",
            first_name="Regular",
            last_name="Employee",
            employee_code="REG-001",
            hashed_password=get_password_hash("Employee@123"),
            role=UserRole.EMPLOYEE.value,
            is_platform_owner=False,
            status="ACTIVE",
            employment_type="FULL_TIME",
            date_of_joining="2026-01-01"
        )
        db.add(emp)
        db.commit()
        db.refresh(emp)

    # 2. HR Admin
    hr_admin = db.query(User).filter(User.email == "hr.admin@gatekeeper.test").first()
    if not hr_admin:
        hr_admin = User(
            company_id=company.id,
            email="hr.admin@gatekeeper.test",
            first_name="HR",
            last_name="Manager",
            employee_code="HR-001",
            hashed_password=get_password_hash("HRAdmin@123"),
            role=UserRole.HR_ADMIN.value,
            is_platform_owner=False,
            status="ACTIVE",
            employment_type="FULL_TIME",
            date_of_joining="2026-01-01"
        )
        db.add(hr_admin)
        db.commit()
        db.refresh(hr_admin)

    # Convert to primitives
    data = {
        "company_id": company.id,
        "emp_id": emp.id,
        "emp_email": emp.email,
        "hr_id": hr_admin.id,
        "hr_email": hr_admin.email,
    }
    db.close()
    return data

def test_1_missing_backend_config_rejection():
    """If SUPABASE_SERVICE_ROLE_KEY and JWKS are not configured, return 503 Service Unavailable."""
    with patch.object(settings, "SUPABASE_SERVICE_ROLE_KEY", ""), \
         patch.object(settings, "SUPABASE_JWKS", ""), \
         patch.object(settings, "_TEST_DISABLE_BUNDLED_JWKS", True, create=True):
        res = client.post("/api/v1/superadmin/login", json={"supabase_token": "some-token"})
        assert res.status_code == 503
        assert "SUPABASE_SERVICE_ROLE_KEY" in res.json()["detail"]

def test_2_invalid_or_expired_token_rejected():
    """If Supabase Auth rejects the access token, return 401 Unauthorized."""
    with patch.object(settings, "SUPABASE_SERVICE_ROLE_KEY", "sb_test_service_key"):
        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_resp.json.return_value = {"message": "Invalid JWT"}

        with patch("httpx.Client.get", return_value=mock_resp):
            res = client.post("/api/v1/superadmin/login", json={"supabase_token": "invalid_or_expired_token"})
            assert res.status_code == 401
            assert "Invalid or expired Supabase authentication token" in res.json()["detail"] or "Supabase auth rejected" in res.json()["detail"]

def test_3_non_admin_user_rejected_with_403():
    """A valid Supabase authenticated user who is NOT in public.platform_admins must receive 403 Forbidden."""
    test_uuid = str(uuid.uuid4())
    test_email = "regular.user@supabase.test"

    with patch.object(settings, "SUPABASE_SERVICE_ROLE_KEY", "sb_test_service_key"):
        # Mock auth token verification: valid user
        auth_resp = MagicMock()
        auth_resp.status_code = 200
        auth_resp.json.return_value = {
            "id": test_uuid,
            "email": test_email,
            "user_metadata": {"first_name": "Test", "last_name": "User"}
        }

        # Mock platform_admins query: empty list (not an admin)
        admin_resp = MagicMock()
        admin_resp.status_code = 200
        admin_resp.json.return_value = []

        def mock_get(url, *args, **kwargs):
            if "auth/v1/user" in str(url):
                return auth_resp
            return admin_resp

        with patch("httpx.Client.get", side_effect=mock_get):
            res = client.post("/api/v1/superadmin/login", json={"supabase_token": "valid_supabase_token"})
            assert res.status_code == 403
            assert "Access Denied" in res.json()["detail"]
            assert "platform_admins" in res.json()["detail"]

def test_4_verified_super_admin_login():
    """A user registered in public.platform_admins receives a PLATFORM_OWNER JWT token and active session."""
    test_uuid = str(uuid.uuid4())
    test_email = "superadmin.master@flowcraft.io"

    with patch.object(settings, "SUPABASE_SERVICE_ROLE_KEY", "sb_test_service_key"):
        # Mock auth token verification
        auth_resp = MagicMock()
        auth_resp.status_code = 200
        auth_resp.json.return_value = {
            "id": test_uuid,
            "email": test_email,
            "user_metadata": {"first_name": "Root", "last_name": "Gatekeeper"}
        }

        # Mock platform_admins query: found!
        admin_resp = MagicMock()
        admin_resp.status_code = 200
        admin_resp.json.return_value = [
            {"id": str(uuid.uuid4()), "user_id": test_uuid, "role": "SUPER_ADMIN"}
        ]

        def mock_get(url, *args, **kwargs):
            if "auth/v1/user" in str(url):
                return auth_resp
            return admin_resp

        with patch("httpx.Client.get", side_effect=mock_get):
            res = client.post("/api/v1/superadmin/login", json={"supabase_token": "valid_admin_supabase_token"})
            assert res.status_code == 200
            data = res.json()
            assert "access_token" in data
            assert data["user"]["role"] == "PLATFORM_OWNER"
            assert data["user"]["is_platform_owner"] is True
            assert data["user"]["email"] == test_email

            # Clean up db
            db = SessionLocal()
            u = db.query(User).filter(User.auth_user_id == test_uuid).first()
            if u:
                db.delete(u)
            pa = db.query(PlatformAdmin).filter(PlatformAdmin.user_id == test_uuid).first()
            if pa:
                db.delete(pa)
            db.commit()
            db.close()

def test_5_superadmin_protected_routes_authorized(setup_test_data):
    """Verified platform owner token can successfully access Super Admin endpoints."""
    db = SessionLocal()
    # Create platform owner user
    po_user = User(
        company_id=setup_test_data["company_id"],
        email="platform.lead@root.test",
        first_name="Platform",
        last_name="Lead",
        employee_code="ROOT-001",
        hashed_password=get_password_hash("SecretRoot123"),
        role=UserRole.PLATFORM_OWNER.value,
        is_platform_owner=True,
        status="ACTIVE",
        employment_type="FULL_TIME",
        date_of_joining="2026-01-01"
    )
    db.add(po_user)
    db.commit()
    db.refresh(po_user)

    token = create_access_token(subject=po_user.id, role=UserRole.PLATFORM_OWNER.value)

    res = client.get(
        "/api/v1/superadmin/overview",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "platform_owner" in data
    assert "stats" in data
    assert "total_organizations" in data["stats"]

    # Also test /companies and /system-health
    res_comp = client.get("/api/v1/superadmin/companies", headers={"Authorization": f"Bearer {token}"})
    assert res_comp.status_code == 200

    res_health = client.get("/api/v1/superadmin/system-health", headers={"Authorization": f"Bearer {token}"})
    assert res_health.status_code == 200

    db.delete(po_user)
    db.commit()
    db.close()

def test_6_normal_employee_blocked_from_superadmin_routes(setup_test_data):
    """Normal Employee token must be strictly rejected with 403 Forbidden from all superadmin routes."""
    emp_token = create_access_token(subject=setup_test_data["emp_id"], role=UserRole.EMPLOYEE.value)

    routes = [
        "/api/v1/superadmin/overview",
        "/api/v1/superadmin/companies",
        "/api/v1/superadmin/system-health",
        "/api/v1/superadmin/subscriptions",
        "/api/v1/superadmin/audit-logs"
    ]

    for route in routes:
        res = client.get(route, headers={"Authorization": f"Bearer {emp_token}"})
        assert res.status_code == 403
        assert "Forbidden" in res.json()["detail"] or "Super Admin access is restricted" in res.json()["detail"]

def test_7_hr_admin_blocked_from_superadmin_routes(setup_test_data):
    """HR Admin / Organization Owner must also be strictly blocked from platform fleet management with 403."""
    hr_token = create_access_token(subject=setup_test_data["hr_id"], role=UserRole.HR_ADMIN.value)

    res = client.get("/api/v1/superadmin/overview", headers={"Authorization": f"Bearer {hr_token}"})
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]

def test_8_normal_employee_and_hr_login_preserved(setup_test_data):
    """Standard organization employee/HR login via /api/v1/auth/login remains 100% operational."""
    # Test Employee Login
    res_emp = client.post("/api/v1/auth/login", json={
        "email": setup_test_data["emp_email"],
        "password": "Employee@123"
    })
    assert res_emp.status_code == 200
    assert "access_token" in res_emp.json()
    assert res_emp.json()["user"]["role"] == "EMPLOYEE"
    assert res_emp.json()["user"]["is_platform_owner"] is False

    # Test HR Admin Login
    res_hr = client.post("/api/v1/auth/login", json={
        "email": setup_test_data["hr_email"],
        "password": "HRAdmin@123"
    })
    assert res_hr.status_code == 200
    assert "access_token" in res_hr.json()
    assert res_hr.json()["user"]["role"] == "HR_ADMIN"
    assert res_hr.json()["user"]["is_platform_owner"] is False

def test_9_no_hardcoded_email_reliance():
    """Verify that ANY email address in public.platform_admins is accepted, and any email NOT in platform_admins is rejected."""
    arbitrary_allowed_uuid = str(uuid.uuid4())
    arbitrary_allowed_email = "random.custom.owner@mycompany.com"

    arbitrary_denied_uuid = str(uuid.uuid4())
    arbitrary_denied_email = "pimpaleg80@gmail.com" # Even former allowlisted email without platform_admins membership must fail!

    with patch.object(settings, "SUPABASE_SERVICE_ROLE_KEY", "sb_test_service_key"):
        # 1. Custom arbitrary email with platform_admins record -> MUST SUCCEED
        def mock_get_allowed(url, *args, **kwargs):
            if "auth/v1/user" in str(url):
                r = MagicMock()
                r.status_code = 200
                r.json.return_value = {
                    "id": arbitrary_allowed_uuid,
                    "email": arbitrary_allowed_email,
                    "user_metadata": {}
                }
                return r
            r = MagicMock()
            r.status_code = 200
            r.json.return_value = [{"id": "pa-1", "user_id": arbitrary_allowed_uuid, "role": "SUPER_ADMIN"}]
            return r

        with patch("httpx.Client.get", side_effect=mock_get_allowed):
            res_allowed = client.post("/api/v1/superadmin/login", json={"supabase_token": "token-allowed"})
            assert res_allowed.status_code == 200
            assert res_allowed.json()["user"]["email"] == arbitrary_allowed_email
            assert res_allowed.json()["user"]["is_platform_owner"] is True

        # 2. Email NOT in platform_admins -> MUST FAIL WITH 403
        def mock_get_denied(url, *args, **kwargs):
            if "auth/v1/user" in str(url):
                r = MagicMock()
                r.status_code = 200
                r.json.return_value = {
                    "id": arbitrary_denied_uuid,
                    "email": arbitrary_denied_email,
                    "user_metadata": {}
                }
                return r
            r = MagicMock()
            r.status_code = 200
            r.json.return_value = [] # Empty -> Not in platform_admins!
            return r

        with patch("httpx.Client.get", side_effect=mock_get_denied):
            res_denied = client.post("/api/v1/superadmin/login", json={"supabase_token": "token-denied"})
            assert res_denied.status_code == 403
            assert "Access Denied" in res_denied.json()["detail"]

def test_10_jwks_asymmetric_validation():
    """Verify that Supabase ES256 Elliptic Curve JWKS key is properly loaded and parseable."""
    from app.services.platform_admin import get_supabase_jwks
    from jose import jwk

    jwks = get_supabase_jwks()
    assert jwks is not None
    assert "keys" in jwks
    assert len(jwks["keys"]) >= 1

    target_key = next((k for k in jwks["keys"] if k.get("kid") == "bb914d94-71d7-4dc7-8d6a-a89e962db62f"), None)
    assert target_key is not None
    assert target_key["alg"] == "ES256"
    assert target_key["crv"] == "P-256"
    assert target_key["kty"] == "EC"
    assert target_key["x"] == "cEKb14v9eMNrKMOlz_vTXQWrkORoKDHEF2hn7nmvWeI"
    assert target_key["y"] == "TZhmgoEU0GoIu_DvegsczAAn4kgUcy5Vj4OxAGnRvFE"

    # Verify key construction
    constructed = jwk.construct(target_key)
    assert constructed is not None


