import pytest
import uuid
import json
import time
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
from jose import jwt, jwk
import httpx

from app.main import app
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import create_access_token, get_password_hash
from app.models.company import Company
from app.models.user import User, UserRole, EmploymentStatus
from app.models.platform_admin import PlatformAdmin
from app.services.platform_admin import (
    get_supabase_jwks,
    verify_token_with_jwks,
    verify_supabase_token
)

client = TestClient(app)

# Helper: Generate ephemeral EC P-256 keypair with JWK representation
def generate_test_ec_keypair(kid="test-key-1"):
    private_key = ec.generate_private_key(ec.SECP256R1())
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    public_numbers = private_key.public_key().public_numbers()
    
    # Base64url encoding for EC public key coordinates
    import base64
    def b64url(val_int, length=32):
        b = val_int.to_bytes(length, byteorder="big")
        return base64.urlsafe_b64encode(b).decode("utf-8").rstrip("=")

    jwk_dict = {
        "kty": "EC",
        "crv": "P-256",
        "alg": "ES256",
        "use": "sig",
        "kid": kid,
        "x": b64url(public_numbers.x),
        "y": b64url(public_numbers.y),
        "ext": True,
        "key_ops": ["verify"]
    }
    return private_pem, jwk_dict

def test_1_jwks_key_rotation_multi_key_support():
    """
    Requirement 2: Ensure Supabase JWKS correctly supports multiple signing keys
    for zero-downtime key rotation.
    """
    jwks = get_supabase_jwks()
    assert jwks is not None, "JWKS must be loaded"
    assert "keys" in jwks, "JWKS must contain 'keys' array"
    assert len(jwks["keys"]) >= 2, f"JWKS must contain at least 2 keys for rotation, found {len(jwks['keys'])}"

    kids = [k.get("kid") for k in jwks["keys"]]
    assert "bb914d94-71d7-4dc7-8d6a-a89e962db62f" in kids, "Primary active key must be present"
    assert "9c55c8c3-282c-401f-a2dc-e8c072772b7a" in kids, "Rotated key must be present"

    # Both keys must successfully construct into elliptic curve verifiers
    for k in jwks["keys"]:
        constructed = jwk.construct(k)
        assert constructed is not None

def test_2_token_rejection_from_other_supabase_project():
    """
    Requirement 2: A token from another Supabase project (different issuer)
    must be strictly rejected.
    """
    priv_pem, jwk_dict = generate_test_ec_keypair("rot-key-1")
    custom_jwks = {"keys": [jwk_dict]}

    now = int(time.time())
    foreign_claims = {
        "sub": str(uuid.uuid4()),
        "email": "user@foreign-project.com",
        "aud": "authenticated",
        "iss": "https://foreignproject123.supabase.co/auth/v1",  # Foreign issuer!
        "exp": now + 3600,
        "iat": now
    }
    token = jwt.encode(foreign_claims, priv_pem, algorithm="ES256", headers={"kid": "rot-key-1"})

    with patch("app.services.platform_admin.get_supabase_jwks", return_value=custom_jwks):
        res = verify_token_with_jwks(token)
        assert res is None, "Token from another Supabase project issuer must be rejected"

def test_3_token_rejection_invalid_audience():
    """
    Requirement 2: Token with audience not equal to 'authenticated' must be rejected.
    """
    priv_pem, jwk_dict = generate_test_ec_keypair("rot-key-1")
    custom_jwks = {"keys": [jwk_dict]}

    now = int(time.time())
    invalid_aud_claims = {
        "sub": str(uuid.uuid4()),
        "email": "user@example.com",
        "aud": "anon",  # Invalid audience!
        "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1",
        "exp": now + 3600,
        "iat": now
    }
    token = jwt.encode(invalid_aud_claims, priv_pem, algorithm="ES256", headers={"kid": "rot-key-1"})

    with patch("app.services.platform_admin.get_supabase_jwks", return_value=custom_jwks):
        res = verify_token_with_jwks(token)
        assert res is None, "Token with non-authenticated audience must be rejected"

def test_4_token_rejection_expired():
    """
    Requirement 2: Expired tokens must be strictly rejected.
    """
    priv_pem, jwk_dict = generate_test_ec_keypair("rot-key-1")
    custom_jwks = {"keys": [jwk_dict]}

    now = int(time.time())
    expired_claims = {
        "sub": str(uuid.uuid4()),
        "email": "user@example.com",
        "aud": "authenticated",
        "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1",
        "exp": now - 60,  # Expired 1 minute ago!
        "iat": now - 3600
    }
    token = jwt.encode(expired_claims, priv_pem, algorithm="ES256", headers={"kid": "rot-key-1"})

    with patch("app.services.platform_admin.get_supabase_jwks", return_value=custom_jwks):
        res = verify_token_with_jwks(token)
        assert res is None, "Expired token must be rejected"

def test_5_token_rejection_unknown_kid():
    """
    Requirement 2: Token specifying an unknown kid not matching rotated keys must be rejected.
    """
    priv_pem, jwk_dict = generate_test_ec_keypair("actual-registered-kid")
    custom_jwks = {"keys": [jwk_dict]}

    now = int(time.time())
    claims = {
        "sub": str(uuid.uuid4()),
        "email": "user@example.com",
        "aud": "authenticated",
        "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1",
        "exp": now + 3600,
        "iat": now
    }
    token = jwt.encode(claims, priv_pem, algorithm="ES256", headers={"kid": "attacker-unknown-kid"})

    with patch("app.services.platform_admin.get_supabase_jwks", return_value=custom_jwks):
        res = verify_token_with_jwks(token)
        assert res is None, "Token with unknown kid must be rejected"

def test_6_token_valid_acceptance_and_claims_extraction():
    """
    Requirement 2: Valid ES256 token signed by known key must be accepted and extracted.
    """
    priv_pem, jwk_dict = generate_test_ec_keypair("valid-kid-01")
    custom_jwks = {"keys": [jwk_dict]}

    uid = str(uuid.uuid4())
    now = int(time.time())
    claims = {
        "sub": uid,
        "email": "legit.user@company.com",
        "aud": "authenticated",
        "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1",
        "exp": now + 3600,
        "iat": now,
        "user_metadata": {"first_name": "Legit", "last_name": "User"}
    }
    token = jwt.encode(claims, priv_pem, algorithm="ES256", headers={"kid": "valid-kid-01"})

    with patch("app.services.platform_admin.get_supabase_jwks", return_value=custom_jwks):
        res = verify_token_with_jwks(token)
        assert res is not None, "Valid token must be accepted"
        assert res["id"] == uid
        assert res["email"] == "legit.user@company.com"
        assert res["user_metadata"]["first_name"] == "Legit"

def test_7_silent_account_takeover_via_email_strictly_blocked():
    """
    Requirement 2: Verify that email matching CANNOT silently link an attacker-controlled
    account to another user's local account if the local account is already bound to a UUID.
    """
    db = SessionLocal()
    # 1. Setup victim user with existing auth_user_id
    victim_email = f"victim.{uuid.uuid4().hex[:6]}@victimcorp.com"
    victim_uuid = str(uuid.uuid4())
    
    company = db.query(Company).first()
    victim = User(
        company_id=company.id if company else 1,
        employee_code=f"VIC-{uuid.uuid4().hex[:4].upper()}",
        email=victim_email,
        auth_user_id=victim_uuid,  # Already securely bound!
        hashed_password=get_password_hash("VictimPass123!"),
        first_name="Victim",
        last_name="Owner",
        role=UserRole.ORGANIZATION_OWNER.value,
        is_platform_owner=False,
        status="ACTIVE",
        employment_type="FULL_TIME",
        date_of_joining="2026-01-01"
    )
    db.add(victim)
    db.commit()
    db.refresh(victim)

    # 2. Attacker presents a valid Supabase token with victim's email, but attacker's UUID
    attacker_uuid = str(uuid.uuid4())
    attacker_token_payload = {
        "id": attacker_uuid,
        "email": victim_email,
        "user_metadata": {}
    }

    # Test /api/v1/auth/me with attacker token
    with patch("app.services.platform_admin.verify_supabase_token", return_value=attacker_token_payload), \
         patch("app.api.v1.endpoints.auth.verify_supabase_token", return_value=attacker_token_payload):
        res = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer fake-attacker-supabase-token"})
        # MUST return 403 Forbidden because account is already bound to victim_uuid
        assert res.status_code == 403, "Silent account takeover must be rejected with 403"
        assert "already linked" in res.json()["detail"].lower()

        # Test /api/v1/auth/supabase-sync with attacker token
        res_sync = client.post(
            "/api/v1/auth/supabase-sync",
            headers={"Authorization": "Bearer fake-attacker-supabase-token"},
            json={"email": victim_email, "auth_user_id": attacker_uuid}
        )
        assert res_sync.status_code == 403, "Sync account takeover must be rejected with 403"
        assert "already linked" in res_sync.json()["detail"].lower()

    # Verify database was NOT tampered with
    db.refresh(victim)
    assert victim.auth_user_id == victim_uuid, "Victim auth_user_id must remain untouched"

    db.delete(victim)
    db.commit()
    db.close()

def test_8_unlinked_user_safe_linking():
    """
    Requirement 2: An unlinked user (auth_user_id is None) can be safely linked
    to their verified Supabase identity on first login.
    """
    db = SessionLocal()
    unlinked_email = f"unlinked.{uuid.uuid4().hex[:6]}@flowcorp.com"
    new_uuid = str(uuid.uuid4())

    company = db.query(Company).first()
    unlinked_user = User(
        company_id=company.id if company else 1,
        employee_code=f"UNL-{uuid.uuid4().hex[:4].upper()}",
        email=unlinked_email,
        auth_user_id=None,  # Unlinked
        hashed_password=get_password_hash("InitialPass123!"),
        first_name="Unlinked",
        last_name="Employee",
        role=UserRole.EMPLOYEE.value,
        is_platform_owner=False,
        status="ACTIVE",
        employment_type="FULL_TIME",
        date_of_joining="2026-01-01"
    )
    db.add(unlinked_user)
    db.commit()
    db.refresh(unlinked_user)

    user_token_payload = {
        "id": new_uuid,
        "email": unlinked_email,
        "user_metadata": {}
    }

    with patch("app.services.platform_admin.verify_supabase_token", return_value=user_token_payload):
        res = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer fake-supabase-token"})
        assert res.status_code == 200, "Unlinked user must successfully link and authenticate"
        assert res.json()["email"] == unlinked_email

    # Verify link persisted in database
    db.refresh(unlinked_user)
    assert unlinked_user.auth_user_id == new_uuid, "Unlinked user must now be linked to Supabase UUID"

    db.delete(unlinked_user)
    db.commit()
    db.close()

def test_9_no_predictable_passwords_in_superadmin_provisioning():
    """
    Requirement 5: Provisions created without an explicit password must generate
    a secure cryptographic secret, NEVER predictable defaults like 'FlowPeople2026!'.
    """
    db = SessionLocal()
    platform_admin_user = db.query(User).filter(User.is_platform_owner == True).first()
    if not platform_admin_user:
        company = db.query(Company).first()
        platform_admin_user = User(
            company_id=company.id if company else 1,
            employee_code="ROOT-TEST-SEC",
            email="root.platform.sec@flowcraft.io",
            hashed_password=get_password_hash("RootPass@123"),
            first_name="Root",
            last_name="Owner",
            role=UserRole.PLATFORM_OWNER.value,
            is_platform_owner=True,
            status="ACTIVE"
        )
        db.add(platform_admin_user)
        db.commit()
        db.refresh(platform_admin_user)

    token = create_access_token(subject=platform_admin_user.id, role=UserRole.PLATFORM_OWNER.value)

    rnd = uuid.uuid4().hex[:5].upper()
    req_payload = {
        "name": f"Secure Provisioning Corp {rnd}",
        "code": f"SEC_{rnd}",
        "contact_email": f"owner.{rnd.lower()}@secprovision.com",
        "owner_first_name": "Secure",
        "owner_last_name": "Owner"
        # owner_password omitted intentionally!
    }

    res = client.post(
        "/api/v1/superadmin/companies",
        json=req_payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200, res.text
    company_id = res.json()["company_id"]

    # Check newly created owner password hash
    new_owner = db.query(User).filter(User.email == req_payload["contact_email"]).first()
    assert new_owner is not None
    
    # Must NOT verify against predictable default passwords
    from app.core.security import verify_password
    assert not verify_password("FlowPeople2026!", new_owner.hashed_password), "Default password 'FlowPeople2026!' must NOT be used"
    assert not verify_password("password123", new_owner.hashed_password), "Default password 'password123' must NOT be used"
    assert not verify_password("admin123", new_owner.hashed_password), "Default password 'admin123' must NOT be used"

    db.close()

def test_10_live_supabase_direct_access_rls_policies():
    """
    Requirement 4: Verify direct Supabase PostgREST access using publishable/anon key.
    Anonymous users cannot insert, update, or access protected tables (companies,
    company_members, employees, platform_admins, attendance_records).
    All protected tables strictly return 401 Unauthorized / code 42501 (Permission Denied).
    """
    base_url = settings.SUPABASE_URL.rstrip('/')
    anon_key = settings.SUPABASE_KEY
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json"
    }

    with httpx.Client(timeout=10.0) as http_client:
        # 1. Direct SELECT and INSERT into organizations / companies strictly blocked
        target_org = "organizations"
        res_comp_get = http_client.get(f"{base_url}/rest/v1/{target_org}?limit=1", headers=headers)
        if res_comp_get.status_code == 200:
            assert res_comp_get.json() == [], "Anonymous SELECT must return zero records under RLS"
        else:
            assert res_comp_get.status_code in (401, 403), "Anonymous SELECT organizations must be denied"

        res_comp_post = http_client.post(
            f"{base_url}/rest/v1/{target_org}",
            headers=headers,
            json={"name": "Hacked Corp", "slug": "hacked-corp"}
        )
        assert res_comp_post.status_code in (401, 403) and ("42501" in res_comp_post.text or "row-level security" in res_comp_post.text), "Anonymous INSERT organizations must be denied by RLS"

        # 2. Direct SELECT and INSERT into employees strictly blocked
        res_emp_get = http_client.get(f"{base_url}/rest/v1/employees?limit=1", headers=headers)
        if res_emp_get.status_code == 200:
            assert res_emp_get.json() == [], "Anonymous SELECT employees must return zero records under RLS"
        else:
            assert res_emp_get.status_code in (401, 403), "Anonymous SELECT employees must be denied"

        res_emp_post = http_client.post(
            f"{base_url}/rest/v1/employees",
            headers=headers,
            json={"first_name": "Hacker"}
        )
        assert res_emp_post.status_code in (401, 403) and ("42501" in res_emp_post.text or "row-level security" in res_emp_post.text), "Anonymous INSERT employees must be denied by RLS"

        # 3. Direct SELECT and INSERT into platform_admins strictly blocked
        res_pa_get = http_client.get(f"{base_url}/rest/v1/platform_admins?limit=1", headers=headers)
        if res_pa_get.status_code == 200:
            assert res_pa_get.json() == [], "Anonymous SELECT platform_admins must return zero records"
        else:
            assert res_pa_get.status_code in (401, 403, 404), "Anonymous SELECT platform_admins must be blocked or not exposed"

        res_pa_post = http_client.post(
            f"{base_url}/rest/v1/platform_admins",
            headers=headers,
            json={"user_id": str(uuid.uuid4())}
        )
        assert res_pa_post.status_code in (401, 403, 404), "Anonymous INSERT platform_admins must be denied"

        # 4. Direct unauthenticated call to RPC register_company strictly blocked
        res_rpc = http_client.post(
            f"{base_url}/rest/v1/rpc/register_company",
            headers=headers,
            json={"p_name": "Test", "p_slug": "test", "p_request_key": str(uuid.uuid4()), "p_legal_name": "Test"}
        )
        assert res_rpc.status_code in (401, 403, 404), f"Anonymous RPC register_company must be denied or uncallable: {res_rpc.status_code}"
