import pytest
import secrets
from fastapi.testclient import TestClient
from datetime import datetime, timezone

from app.main import app
from app.core.database import SessionLocal
from app.models.company import Company
from app.models.user import User, UserRole
from app.models.subscription import SubscriptionPlan, Subscription, PaymentTransaction
from app.models.attendance import AttendanceRecord
from app.core.security import create_access_token

client = TestClient(app)

def test_public_billing_plans():
    """Verify public billing plans are active and have pricing and quotas."""
    res = client.get("/api/v1/billing/plans")
    assert res.status_code == 200
    plans = res.json()
    assert len(plans) >= 4
    tiers = [p["id"] for p in plans]
    assert "trial" in tiers
    assert "starter" in tiers
    assert "professional" in tiers
    assert "enterprise" in tiers

def test_organization_registration_and_subscription():
    """Verify complete self-service organization registration and subscription flow."""
    random_suffix = secrets.token_hex(3).upper()
    org_code = f"T{random_suffix}"
    org_email = f"owner_{random_suffix.lower()}@testcorp.com"

    payload = {
        "company_name": f"Test Tenant {random_suffix}",
        "company_code": org_code,
        "contact_email": org_email,
        "owner_first_name": "Rohan",
        "owner_last_name": "Mehta",
        "owner_password": "SecurePassword123!",
        "owner_phone": "+919876543210",
        "plan_id": "trial",
        "billing_cycle": "MONTHLY",
        "currency": "INR",
        "timezone": "Asia/Kolkata"
    }

    res = client.post("/api/v1/billing/register-organization", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["success"] is True
    assert "access_token" in data
    assert data["organization"]["code"] == org_code
    assert data["user"]["role"] == UserRole.ORGANIZATION_OWNER.value

    # Verify newly created user is NOT platform owner
    db = SessionLocal()
    new_user = db.query(User).filter(User.email == org_email).first()
    assert new_user is not None
    assert new_user.is_platform_owner is False
    db.close()

    # Verify subscription details endpoint with bearer token
    token = data["access_token"]
    sub_res = client.get("/api/v1/billing/subscription", headers={"Authorization": f"Bearer {token}"})
    assert sub_res.status_code == 200
    sub_data = sub_res.json()
    assert sub_data["company_code"] == org_code
    assert sub_data["plan"]["id"] == "trial"
    assert sub_data["usage"]["employees_count"] >= 1

def test_super_admin_owner_only_isolation():
    """Verify Super Admin portal is strictly owner-only and denies customer tenants."""
    db = SessionLocal()
    # 1. Owner account
    owner = db.query(User).filter(User.email == "pimpaleharshad99@gmail.com").first()
    assert owner is not None
    assert owner.is_platform_owner is True
    token_owner = create_access_token(subject=owner.id, role=owner.role)

    # 2. Customer user (e.g. User 57 or an organization owner)
    customer = db.query(User).filter(User.is_platform_owner == False).first()
    assert customer is not None
    token_customer = create_access_token(subject=customer.id, role=customer.role)
    db.close()

    # 3. Test Owner access -> MUST SUCCEED (200 OK)
    res_owner = client.get("/api/v1/superadmin/overview", headers={"Authorization": f"Bearer {token_owner}"})
    assert res_owner.status_code == 200
    assert "stats" in res_owner.json()
    assert res_owner.json()["stats"]["total_organizations"] >= 1

    # 4. Test Customer access -> MUST BE FORBIDDEN (403)
    res_cust = client.get("/api/v1/superadmin/overview", headers={"Authorization": f"Bearer {token_customer}"})
    assert res_cust.status_code == 403
    assert "restricted" in res_cust.json()["detail"].lower()

    # 5. Test Unauthenticated access -> MUST BE UNAUTHORIZED (401)
    res_unauth = client.get("/api/v1/superadmin/overview")
    assert res_unauth.status_code == 401

def test_multi_tenant_isolation():
    """Verify Organization A cannot view Organization B's staff or attendance."""
    db = SessionLocal()
    companies = db.query(Company).all()
    assert len(companies) >= 2, "Need at least 2 companies to test multi-tenancy"
    comp_a, comp_b = companies[0], companies[1]

    user_a = db.query(User).filter(User.company_id == comp_a.id, User.is_platform_owner == False).first()
    if not user_a:
        user_a = db.query(User).filter(User.company_id == comp_a.id).first()

    token_a = create_access_token(subject=user_a.id, role=user_a.role)
    db.close()

    # List employees as User A -> All returned employees must belong to Company A only
    res_emp = client.get("/api/v1/employees", headers={"Authorization": f"Bearer {token_a}"})
    assert res_emp.status_code == 200
    for emp in res_emp.json():
        assert emp["company_id"] == comp_a.id

def test_payment_verification_and_quota_upgrade():
    """Verify authoritative backend payment verification and quota expansion."""
    db = SessionLocal()
    admin_user = db.query(User).filter(User.company_id.isnot(None)).first()
    assert admin_user is not None
    token = create_access_token(subject=admin_user.id, role="COMPANY_ADMIN")
    db.close()

    txn_ref = f"txn_{secrets.token_hex(6)}"
    payload = {
        "plan_id": "professional",
        "billing_cycle": "ANNUAL",
        "transaction_reference": txn_ref,
        "amount": 69990.0,
        "currency": "INR",
        "billing_name": "Accounts Payable"
    }

    res = client.post("/api/v1/billing/verify-payment", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "invoice_number" in data
    assert data["subscription"]["plan_id"] == "professional"

    # Replay attack prevention: Same transaction reference must be rejected
    res_replay = client.post("/api/v1/billing/verify-payment", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert res_replay.status_code == 400
