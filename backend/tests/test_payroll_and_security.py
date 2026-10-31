import pytest
import time
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, EmploymentStatus
from app.core.security import get_password_hash

client = TestClient(app)

def get_auth_token(email: str, password: str) -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]

def test_multi_tenant_company_isolation():
    super_token = get_auth_token("admin@acme.corp", "Admin@EMP001")
    super_headers = {"Authorization": f"Bearer {super_token}"}

    uid = int(time.time() * 1000) % 100000

    # 1. Create a second independent company: Beta Dynamics
    comp_res = client.post("/api/v1/superadmin/companies", json={
        "name": f"Beta Dynamics {uid}",
        "code": f"BETA{uid % 1000}",
        "contact_email": f"corp.{uid}@betadynamics.com",
        "domain": f"beta{uid}.com",
        "country": "United States",
        "currency": "USD",
        "timezone": "America/New_York"
    }, headers=super_headers)
    assert comp_res.status_code == 200, comp_res.text
    beta_company_id = comp_res.json()["company_id"]

    # 2. Provision Tenant B HR Administrator
    hr_res = client.post("/api/v1/superadmin/create-hr-admin", json={
        "company_id": beta_company_id,
        "first_name": "Marcus",
        "last_name": "Brody",
        "email": f"marcus.{uid}@betadynamics.com",
        "password": "Password@123!",
        "employee_code": f"BD-001-{uid % 100}"
    }, headers=super_headers)
    assert hr_res.status_code == 200, hr_res.text

    # 3. Log in as Tenant B HR Administrator
    beta_token = get_auth_token(f"marcus.{uid}@betadynamics.com", "Password@123!")
    beta_headers = {"Authorization": f"Bearer {beta_token}"}

    # 4. Attempt to access Acme Corp (Tenant A) employees -> Should only see Tenant B employees
    emp_res = client.get("/api/v1/employees", headers=beta_headers)
    assert emp_res.status_code == 200
    beta_employees = emp_res.json()
    assert all(e["company_id"] == beta_company_id for e in beta_employees)
    # Ensure Acme employees (e.g. Alex Mercer, David Vance) are not visible
    acme_emails = [e["email"] for e in beta_employees]
    assert "alex@acme.corp" not in acme_emails
    assert "admin@acme.corp" not in acme_emails

    # 5. Attempt to access Acme Corp documents -> Should return empty or 404
    doc_res = client.get("/api/v1/documents/user/3", headers=beta_headers)
    assert doc_res.status_code == 404 # Tenant B cannot access Tenant A user document

def test_inactive_and_suspended_user_rejection():
    admin_token = get_auth_token("admin@acme.corp", "Admin@EMP001")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    uid = int(time.time() * 1000) % 100000

    # 1. Create a user to suspend
    res_create = client.post("/api/v1/employees", json={
        "first_name": "Suspended",
        "last_name": "Worker",
        "email": f"suspended.{uid}@acme.corp",
        "role": "EMPLOYEE",
        "employment_type": "FULL_TIME",
        "date_of_joining": "2026-01-01",
        "password": "Password@123!"
    }, headers=admin_headers)
    assert res_create.status_code == 201
    user_id = res_create.json()["id"]

    # In DB, update user status to SUSPENDED and assign password hash
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        user.status = EmploymentStatus.SUSPENDED.value
        user.hashed_password = get_password_hash("Password@123!")
        db.commit()
    finally:
        db.close()

    # 2. Attempt login as suspended user
    res_login = client.post("/api/v1/auth/login", json={
        "email": f"suspended.{uid}@acme.corp",
        "password": "Password@123!"
    })
    # If login issues token, subsequent API call must return 403 Forbidden
    if res_login.status_code == 200:
        suspended_token = res_login.json()["access_token"]
        suspended_headers = {"Authorization": f"Bearer {suspended_token}"}
        res_op = client.get("/api/v1/auth/me", headers=suspended_headers)
        assert res_op.status_code == 403
        assert "suspended" in res_op.json()["detail"].lower()
    else:
        assert res_login.status_code in [400, 401, 403]

def test_payroll_authoritative_calculation_and_workflow():
    from app.models.payroll import PayrollPeriod, Payslip
    db = SessionLocal()
    existing_periods = db.query(PayrollPeriod).filter(PayrollPeriod.month == "2026-10").all()
    for ep in existing_periods:
        db.query(Payslip).filter(Payslip.payroll_period_id == ep.id).delete()
        db.delete(ep)
    db.commit()
    db.close()

    admin_token = get_auth_token("admin@acme.corp", "Admin@EMP001")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    alex_token = get_auth_token("alex@acme.corp", "Alex@EMP004")
    alex_headers = {"Authorization": f"Bearer {alex_token}"}

    month_str = "2026-10"
    start_str = "2026-10-01"
    end_str = "2026-10-31"

    # 1. Standard employee cannot execute payroll run -> 403 Forbidden
    res_unauth = client.post("/api/v1/payroll/periods", json={
        "month": month_str,
        "period_start": start_str,
        "period_end": end_str
    }, headers=alex_headers)
    assert res_unauth.status_code == 403

    # 2. Admin executes payroll run
    res_run = client.post("/api/v1/payroll/periods", json={
        "month": month_str,
        "period_start": start_str,
        "period_end": end_str,
        "notes": "Q4 Monthly Payroll Calculation"
    }, headers=admin_headers)
    assert res_run.status_code == 200, res_run.text
    run_data = res_run.json()
    assert run_data["success"] is True
    period_id = run_data["period_id"]
    assert run_data["employee_count"] > 0
    assert run_data["total_net"] > 0

    # 3. Admin inspects payroll period detail
    res_detail = client.get(f"/api/v1/payroll/periods/{period_id}", headers=admin_headers)
    assert res_detail.status_code == 200
    period_data = res_detail.json()
    payslips = period_data["payslips"]
    assert len(payslips) == period_data["period"]["employee_count"]

    # Verify mathematical accuracy: net_salary = gross_earnings - total_deductions
    for ps in payslips:
        assert ps["working_days"] > 0
        expected_net = round(ps["gross_earnings"] - ps["total_deductions"], 2)
        assert abs(ps["net_salary"] - expected_net) <= 0.05
        assert ps["basic_salary"] > 0

    # 4. Employee views their own payslip archive
    res_my_slips = client.get("/api/v1/payroll/my-payslips", headers=alex_headers)
    assert res_my_slips.status_code == 200
    my_slips = res_my_slips.json()
    assert len(my_slips) >= 1
    my_slip = my_slips[0]
    assert my_slip["user_id"] == 4 or "alex" in my_slip["employee_name"].lower()

    # 5. Security: Standard employee cannot inspect another employee's payslip directly
    # Find a payslip belonging to someone else
    other_slip = next(p for p in payslips if p["user_id"] != my_slip["user_id"])
    res_forbidden = client.get(f"/api/v1/payroll/payslips/{other_slip['id']}", headers=alex_headers)
    assert res_forbidden.status_code == 403
    assert "Cannot access payslip of another employee" in res_forbidden.json()["detail"]

    # 6. Admin approves payroll period
    res_approve = client.post(f"/api/v1/payroll/periods/{period_id}/approve", headers=admin_headers)
    assert res_approve.status_code == 200
    assert res_approve.json()["status"] == "APPROVED"

    # 7. Admin marks payroll period as disbursed (PAID)
    res_paid = client.post(f"/api/v1/payroll/periods/{period_id}/mark-paid", headers=admin_headers)
    assert res_paid.status_code == 200
    assert res_paid.json()["status"] == "PAID"

    # 8. Employee verifies payslip is marked as PAID
    res_my_slips_after = client.get("/api/v1/payroll/my-payslips", headers=alex_headers)
    assert res_my_slips_after.status_code == 200
    updated_slip = next(p for p in res_my_slips_after.json() if p["id"] == my_slip["id"])
    assert updated_slip["payment_status"] == "PAID"

def test_helpdesk_resolution_security():
    alex_token = get_auth_token("alex@acme.corp", "Alex@EMP004")
    alex_headers = {"Authorization": f"Bearer {alex_token}"}
    hr_token = get_auth_token("hr@acme.corp", "HR@EMP002")
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    # 1. Employee creates a helpdesk ticket
    res_create = client.post("/api/v1/helpdesk/tickets", json={
        "category": "IT Equipment",
        "subject": "Dual Monitor Setup Request",
        "description": "Requesting a secondary 27-inch 4K monitor for development workstation.",
        "priority": "MEDIUM"
    }, headers=alex_headers)
    assert res_create.status_code == 200
    ticket_id = res_create.json()["ticket_id"]

    # 2. Employee attempts to mark ticket as resolved -> 403 Forbidden
    res_resolve_unauth = client.put(f"/api/v1/helpdesk/tickets/{ticket_id}/status", json={
        "status": "RESOLVED",
        "resolution_notes": "Self resolved"
    }, headers=alex_headers)
    assert res_resolve_unauth.status_code == 403
    assert "Employees cannot resolve tickets" in res_resolve_unauth.json()["detail"]

    # 3. HR Admin resolves ticket -> 200 OK
    res_resolve_auth = client.put(f"/api/v1/helpdesk/tickets/{ticket_id}/status", json={
        "status": "RESOLVED",
        "resolution_notes": "Monitor approved and dispatched by IT procurement."
    }, headers=hr_headers)
    assert res_resolve_auth.status_code == 200
    assert res_resolve_auth.json()["status"] == "RESOLVED"

def test_lifecycle_access_security():
    alex_token = get_auth_token("alex@acme.corp", "Alex@EMP004")
    alex_headers = {"Authorization": f"Bearer {alex_token}"}
    admin_token = get_auth_token("admin@acme.corp", "Admin@EMP001")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Alex Mercer has user_id = 4
    # Sarah Connor (Admin) has user_id = 1

    # 1. Alex views own history -> 200 OK
    res_own = client.get("/api/v1/lifecycle/history/4", headers=alex_headers)
    assert res_own.status_code == 200

    # 2. Alex attempts to view Admin's history (user_id = 1) -> 403 Forbidden
    res_forbidden = client.get("/api/v1/lifecycle/history/1", headers=alex_headers)
    assert res_forbidden.status_code == 403
    assert "Cannot view lifecycle history of other employees" in res_forbidden.json()["detail"]

    # 3. Admin views Alex's history -> 200 OK
    res_admin = client.get("/api/v1/lifecycle/history/4", headers=admin_headers)
    assert res_admin.status_code == 200
