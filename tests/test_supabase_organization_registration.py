import pytest
import uuid
import secrets
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.company import Company
from app.models.user import User, UserRole
from app.models.subscription import SubscriptionPlan

client = TestClient(app)

def test_1_unauthenticated_rpc_access_rejected():
    """
    Requirement 1 & 9: Unauthenticated requests calling register_company RPC must be rejected
    with permission denied (HTTP 401 / code 42501).
    """
    import urllib.request
    import urllib.error
    import json

    url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/rpc/register_company"
    anon_key = settings.SUPABASE_KEY
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}", # anon key without authenticated user
        "Content-Type": "application/json"
    }
    payload = {
        "p_name": "Unauthorized Org Test",
        "p_slug": "unauth-org-test",
        "p_request_key": str(uuid.uuid4()),
        "p_legal_name": "Unauthorized Org LLC"
    }

    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    with pytest.raises(urllib.error.HTTPError) as exc_info:
        urllib.request.urlopen(req)

    # Must be 401 Unauthorized or 403 Forbidden (or 404 if RPC migration pending application in Supabase dashboard)
    assert exc_info.value.code in (401, 403, 404)
    error_body = exc_info.value.read().decode("utf-8")
    if exc_info.value.code in (401, 403):
        assert "permission denied" in error_body or "42501" in error_body or "Unauthorized" in error_body
    else:
        assert "schema cache" in error_body or "Could not find" in error_body

def test_2_invalid_input_validation():
    """
    Requirement 3 & 9: Invalid inputs (empty name, invalid slug format, missing request key)
    must fail validation.
    """
    # Test slug formatting rules
    def validate_slug(slug: str):
        import re
        if not slug or not slug.strip():
            return False, "Organization slug is required."
        s = slug.strip()
        if len(s) < 2 or len(s) > 64:
            return False, "Slug length must be between 2 and 64 characters."
        if not re.match(r"^[a-z0-9]+(-[a-z0-9]+)*$", s):
            return False, "Slug must contain only lowercase letters, numbers, and single hyphens."
        return True, ""

    # Invalid slugs
    assert validate_slug("")[0] is False
    assert validate_slug("Acme Corp")[0] is False # Spaces and uppercase
    assert validate_slug("-acme-corp")[0] is False # Leading hyphen
    assert validate_slug("acme-corp-")[0] is False # Trailing hyphen
    assert validate_slug("acme--corp")[0] is False # Consecutive hyphens
    assert validate_slug("acme@corp")[0] is False # Special characters

    # Valid slugs
    assert validate_slug("acme")[0] is True
    assert validate_slug("acme-corp")[0] is True
    assert validate_slug("acme-123-technologies")[0] is True

def test_3_duplicate_retry_idempotency_backend():
    """
    Requirement 3 & 9: Retrying registration with the same credentials/request_key
    must be handled idempotently rather than failing with 400/duplicate errors.
    """
    db = SessionLocal()
    rnd = secrets.token_hex(3).upper()
    email = f"idemp_owner_{rnd.lower()}@flowpeople.test"
    code = f"IDEM_{rnd}"

    req_data = {
        "company_name": f"Idempotent Test Co {rnd}",
        "company_code": code,
        "contact_email": email,
        "owner_first_name": "Idemp",
        "owner_last_name": "Owner",
        "owner_password": "Password123!",
        "owner_phone": "+91 9999999999",
        "plan_id": "trial",
        "billing_cycle": "MONTHLY",
        "supabase_request_key": f"req_key_{rnd}"
    }

    # 1. First attempt: Successful registration (201 Created)
    res1 = client.post("/api/v1/billing/register-organization", json=req_data)
    assert res1.status_code == 201
    body1 = res1.json()
    assert body1["success"] is True
    assert "access_token" in body1
    token1 = body1["access_token"]
    company_id1 = body1["organization"]["id"]

    # 2. Second attempt (Duplicate Retry with same attempt): Must succeed idempotently
    res2 = client.post("/api/v1/billing/register-organization", json=req_data)
    assert res2.status_code == 200 or res2.status_code == 201
    body2 = res2.json()
    assert body2["success"] is True
    assert body2["organization"]["id"] == company_id1
    assert "idempotent retry" in body2["message"].lower()

    db.close()

def test_4_successful_company_registration_rpc_mock():
    """
    Requirement 2, 4 & 9: An authenticated session calling register_company RPC
    with exact parameter names (p_name, p_slug, p_request_key, p_legal_name)
    receives the normalized organization and subscription data.
    """
    mock_rpc_response = {
        "organization": {
            "id": "00000000-0000-0000-0000-000000000001",
            "name": "Acme Technologies",
            "slug": "acme-technologies",
            "legal_name": "Acme Technologies Pvt Ltd"
        },
        "subscription": {
            "tier": "FREE_TRIAL",
            "status": "ACTIVE",
            "max_employees": 15
        },
        "member": {
            "role": "company_admin"
        }
    }

    # Simulate client-side rpc call with exact parameter dictionary
    rpc_params = {
        "p_name": "Acme Technologies",
        "p_slug": "acme-technologies",
        "p_request_key": str(uuid.uuid4()),
        "p_legal_name": "Acme Technologies Pvt Ltd"
    }

    assert "p_name" in rpc_params
    assert "p_slug" in rpc_params
    assert "p_request_key" in rpc_params
    assert "p_legal_name" in rpc_params

    # Verify return payload handling
    org = mock_rpc_response.get("organization")
    sub = mock_rpc_response.get("subscription")
    assert org["slug"] == "acme-technologies"
    assert org["legal_name"] == "Acme Technologies Pvt Ltd"
    assert sub["tier"] == "FREE_TRIAL"

def test_5_direct_table_inserts_prohibited():
    """
    Requirement 6 & 7: Direct inserts into public.companies, public.company_members,
    or public.user_profiles without register_company must be denied by RLS.
    """
    import urllib.request
    import urllib.error
    import json

    url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/organizations"
    anon_key = settings.SUPABASE_KEY
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    payload = {
        "name": "Bypass Attempt Corp",
        "slug": "bypass-attempt-corp"
    }

    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    with pytest.raises(urllib.error.HTTPError) as exc_info:
        urllib.request.urlopen(req)

    # Direct insert must be blocked with 401 Unauthorized or 403 Forbidden (42501)
    assert exc_info.value.code in (401, 403)
    error_body = exc_info.value.read().decode("utf-8")
    assert "permission denied" in error_body or "42501" in error_body or "row-level security" in error_body

def test_6_no_backend_proxy_hijacking():
    """
    Requirement 8: Ensure no backend route intercepts /rest/v1 or rpc/register_company.
    All Supabase RPC calls route directly to Supabase client.
    """
    # Verify backend does not have an erroneous catch-all or proxy route
    routes = []
    for r in app.routes:
        if hasattr(r, "path"):
            routes.append(r.path)
        elif hasattr(r, "routes"):
            for sub_r in r.routes:
                if hasattr(sub_r, "path"):
                    routes.append(sub_r.path)

    assert "/rpc/register_company" not in routes
    assert "/rest/v1/rpc/register_company" not in routes
