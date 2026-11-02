import pytest
import secrets
import uuid
from fastapi.testclient import TestClient
from datetime import datetime, timezone

from app.main import app
from app.core.database import SessionLocal
from app.models.company import Company, Branch, OrganizationMember
from app.models.user import User, UserRole, EmploymentStatus
from app.models.subscription import SubscriptionPlan, Subscription
from app.models.attendance import AttendanceRecord
from app.core.security import create_access_token

client = TestClient(app)

def test_1_organization_registration_abc():
    """TEST 1: Register ABC Technologies and verify tenant, owner, membership and UUID."""
    code = f"ABC{secrets.token_hex(2).upper()}"
    email = f"owner_{code.lower()}@abctech.com"
    payload = {
        "company_name": f"ABC Technologies {code}",
        "company_code": code,
        "contact_email": email,
        "owner_first_name": "Rahul",
        "owner_last_name": "Sharma",
        "owner_password": "SecurePassword123!",
        "owner_phone": "+919876543210",
        "plan_id": "trial",
        "billing_cycle": "MONTHLY"
    }

    res = client.post("/api/v1/billing/register-organization", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["success"] is True
    assert "access_token" in data
    assert data["organization"]["code"] == code
    assert "uuid" in data["organization"]
    assert len(data["organization"]["uuid"]) == 36 # Valid UUID4 format
    assert data["user"]["role"] == UserRole.ORGANIZATION_OWNER.value

    db = SessionLocal()
    org = db.query(Company).filter(Company.code == code).first()
    assert org is not None
    assert org.uuid is not None

    member = db.query(OrganizationMember).filter(
        OrganizationMember.company_id == org.id,
        OrganizationMember.user_id == data["user"]["id"]
    ).first()
    assert member is not None
    assert member.role == UserRole.ORGANIZATION_OWNER.value
    assert member.status == "ACTIVE"
    db.close()

def test_2_second_organization_registration_xyz():
    """TEST 2: Register XYZ Solutions and verify separate UUID and tenant isolation."""
    code_xyz = f"XYZ{secrets.token_hex(2).upper()}"
    email_xyz = f"owner_{code_xyz.lower()}@xyzsol.com"
    payload = {
        "company_name": f"XYZ Solutions {code_xyz}",
        "company_code": code_xyz,
        "contact_email": email_xyz,
        "owner_first_name": "Sagar",
        "owner_last_name": "Patil",
        "owner_password": "SecurePassword123!",
        "owner_phone": "+919876543211",
        "plan_id": "starter",
        "billing_cycle": "ANNUAL"
    }

    res = client.post("/api/v1/billing/register-organization", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["organization"]["code"] == code_xyz
    assert "uuid" in data["organization"]

    db = SessionLocal()
    org_xyz = db.query(Company).filter(Company.code == code_xyz).first()
    assert org_xyz is not None
    assert org_xyz.owner_user_id is not None
    db.close()

def test_3_employee_registration_and_automated_counts():
    """TEST 3: Create employees under ABC and XYZ and verify automated employee counts."""
    db = SessionLocal()
    # Create two test companies
    c1 = Company(
        uuid=str(uuid.uuid4()),
        name="Org A Test Corp",
        code=f"ORGA{secrets.token_hex(2).upper()}",
        max_employees=50,
        status="ACTIVE"
    )
    c2 = Company(
        uuid=str(uuid.uuid4()),
        name="Org B Test Corp",
        code=f"ORGB{secrets.token_hex(2).upper()}",
        max_employees=50,
        status="ACTIVE"
    )
    db.add(c1)
    db.add(c2)
    db.flush()

    # Owner for Org A
    owner_a = User(
        company_id=c1.id,
        uuid=str(uuid.uuid4()),
        employee_code=f"{c1.code}-001",
        email=f"owner_{c1.code.lower()}@test.com",
        hashed_password="hash",
        first_name="Owner",
        last_name="A",
        role=UserRole.ORGANIZATION_OWNER.value,
        status=EmploymentStatus.ACTIVE.value,
        date_of_joining="2026-01-01"
    )
    # Owner for Org B
    owner_b = User(
        company_id=c2.id,
        uuid=str(uuid.uuid4()),
        employee_code=f"{c2.code}-001",
        email=f"owner_{c2.code.lower()}@test.com",
        hashed_password="hash",
        first_name="Owner",
        last_name="B",
        role=UserRole.ORGANIZATION_OWNER.value,
        status=EmploymentStatus.ACTIVE.value,
        date_of_joining="2026-01-01"
    )
    db.add(owner_a)
    db.add(owner_b)
    db.commit()
    db.refresh(c1)
    db.refresh(c2)
    db.refresh(owner_a)
    db.refresh(owner_b)

    token_a = create_access_token(subject=owner_a.id, role=owner_a.role)
    token_b = create_access_token(subject=owner_b.id, role=owner_b.role)
    db.close()

    # Create 3 employees under Org A
    for i in range(3):
        emp_res = client.post(
            "/api/v1/employees",
            json={
                "first_name": f"EmpA{i}",
                "last_name": "Test",
                "email": f"empa_{i}_{secrets.token_hex(2)}@test.com",
                "role": "EMPLOYEE",
                "status": "ACTIVE"
            },
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert emp_res.status_code == 201, emp_res.text
        assert emp_res.json()["company_id"] == c1.id

    # Create 2 employees under Org B
    for i in range(2):
        emp_res = client.post(
            "/api/v1/employees",
            json={
                "first_name": f"EmpB{i}",
                "last_name": "Test",
                "email": f"empb_{i}_{secrets.token_hex(2)}@test.com",
                "role": "EMPLOYEE",
                "status": "ACTIVE"
            },
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert emp_res.status_code == 201
        assert emp_res.json()["company_id"] == c2.id

    # Verify Automated Employee Counts for Org A (1 owner + 3 employees = 4 total)
    counts_a = client.get("/api/v1/organization/employee-counts", headers={"Authorization": f"Bearer {token_a}"})
    assert counts_a.status_code == 200
    data_a = counts_a.json()
    assert data_a["total_employees"] == 4
    assert data_a["active_employees"] == 4
    assert data_a["organization_id"] == c1.id

    # Verify Automated Employee Counts for Org B (1 owner + 2 employees = 3 total)
    counts_b = client.get("/api/v1/organization/employee-counts", headers={"Authorization": f"Bearer {token_b}"})
    assert counts_b.status_code == 200
    data_b = counts_b.json()
    assert data_b["total_employees"] == 3
    assert data_b["active_employees"] == 3
    assert data_b["organization_id"] == c2.id

def test_4_cross_tenant_isolation_and_reassignment_rejection():
    """TEST 4: Ensure Org A cannot view or reassign Org B employees."""
    db = SessionLocal()
    c1 = db.query(Company).filter(Company.name == "Org A Test Corp").first()
    c2 = db.query(Company).filter(Company.name == "Org B Test Corp").first()
    assert c1 and c2

    owner_a = db.query(User).filter(User.company_id == c1.id, User.role == UserRole.ORGANIZATION_OWNER.value).first()
    emp_b = db.query(User).filter(User.company_id == c2.id, User.role == UserRole.EMPLOYEE.value).first()
    token_a = create_access_token(subject=owner_a.id, role=owner_a.role)
    db.close()

    # 1. Listing employees as Org A must return ZERO employees from Org B
    res_list = client.get("/api/v1/employees", headers={"Authorization": f"Bearer {token_a}"})
    assert res_list.status_code == 200
    for emp in res_list.json():
        assert emp["company_id"] == c1.id
        assert emp["company_id"] != c2.id

    # 2. Org A attempting to access Org B employee profile must return 404
    res_get = client.get(f"/api/v1/employees/{emp_b.id}", headers={"Authorization": f"Bearer {token_a}"})
    assert res_get.status_code == 404

    # 3. Org A attempting to modify Org B employee must return 404
    res_put = client.put(
        f"/api/v1/employees/{emp_b.id}",
        json={"first_name": "Hacked"},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert res_put.status_code == 404

    # 4. Org A attempting to reassign own employee to Org B must be REJECTED (403 Forbidden)
    emp_a = db.query(User).filter(User.company_id == c1.id, User.role == UserRole.EMPLOYEE.value).first()
    res_reassign = client.put(
        f"/api/v1/employees/{emp_a.id}",
        json={"company_id": c2.id, "first_name": "Reassigned"},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert res_reassign.status_code == 403
    assert "prohibited" in res_reassign.json()["detail"].lower()

def test_5_employee_invitation_lifecycle():
    """TEST 5: Verify invitation token generation and acceptance flow."""
    db = SessionLocal()
    c1 = db.query(Company).filter(Company.name == "Org A Test Corp").first()
    owner_a = db.query(User).filter(User.company_id == c1.id, User.role == UserRole.ORGANIZATION_OWNER.value).first()
    token_a = create_access_token(subject=owner_a.id, role=owner_a.role)
    db.close()

    # Create employee in DRAFT status
    inv_email = f"invited_{secrets.token_hex(3)}@test.com"
    create_res = client.post(
        "/api/v1/employees",
        json={
            "first_name": "Priya",
            "last_name": "Verma",
            "email": inv_email,
            "role": "EMPLOYEE",
            "status": "DRAFT"
        },
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert create_res.status_code == 201
    emp_id = create_res.json()["id"]

    # Trigger invitation
    inv_res = client.post(f"/api/v1/employees/{emp_id}/invite", headers={"Authorization": f"Bearer {token_a}"})
    assert inv_res.status_code == 200
    inv_token = inv_res.json()["invitation_token"]
    assert len(inv_token) > 10

    # Accept invitation
    act_res = client.post(
        "/api/v1/auth/activate-invite",
        json={"token": inv_token, "password": "NewEmployeePassword2026!"}
    )
    assert act_res.status_code == 200
    act_data = act_res.json()
    assert "access_token" in act_data
    assert act_data["user"]["status"] == "ACTIVE"
    assert act_data["user"]["company_id"] == c1.id

    # Verify token cannot be re-used (one-time token)
    replay_res = client.post(
        "/api/v1/auth/activate-invite",
        json={"token": inv_token, "password": "NewEmployeePassword2026!"}
    )
    assert replay_res.status_code == 400

def test_6_capacity_limit_and_quota_enforcement():
    """TEST 6: Ensure tenant cannot exceed subscription plan max_employees quota."""
    db = SessionLocal()
    # Create tenant with quota = 2
    c_quota = Company(
        uuid=str(uuid.uuid4()),
        name="Small Firm Corp",
        code=f"SML{secrets.token_hex(2).upper()}",
        max_employees=2,
        status="ACTIVE"
    )
    db.add(c_quota)
    db.flush()

    owner = User(
        company_id=c_quota.id,
        uuid=str(uuid.uuid4()),
        employee_code=f"{c_quota.code}-001",
        email=f"owner_{c_quota.code.lower()}@smallfirm.com",
        hashed_password="hash",
        first_name="Owner",
        last_name="Small",
        role=UserRole.ORGANIZATION_OWNER.value,
        status=EmploymentStatus.ACTIVE.value,
        date_of_joining="2026-01-01"
    )
    db.add(owner)
    db.commit()
    token = create_access_token(subject=owner.id, role=owner.role)
    db.close()

    # Employee 1 (Total active = 1 owner + 1 employee = 2 / 2 capacity reached)
    res_1 = client.post(
        "/api/v1/employees",
        json={"first_name": "Worker", "last_name": "One", "email": f"w1_{secrets.token_hex(2)}@small.com", "role": "EMPLOYEE"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res_1.status_code == 201
    w1_id = res_1.json()["id"]

    # Employee 2 (Would be 3rd -> Exceeds max_employees: 2 -> MUST BE REJECTED)
    res_2 = client.post(
        "/api/v1/employees",
        json={"first_name": "Worker", "last_name": "Two", "email": f"w2_{secrets.token_hex(2)}@small.com", "role": "EMPLOYEE"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res_2.status_code == 400
    assert "limit reached" in res_2.json()["detail"].lower()

    # Deactivate Worker One -> frees capacity
    deact_res = client.put(f"/api/v1/employees/{w1_id}/deactivate", headers={"Authorization": f"Bearer {token}"})
    assert deact_res.status_code == 200
    assert deact_res.json()["status"] == "INACTIVE"

    # Now Employee 2 succeeds!
    res_2_retry = client.post(
        "/api/v1/employees",
        json={"first_name": "Worker", "last_name": "Two", "email": f"w2_{secrets.token_hex(2)}@small.com", "role": "EMPLOYEE"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res_2_retry.status_code == 201

