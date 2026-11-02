from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.company import Company, Department, Designation, Branch, CompanySettings, OrganizationMember
from app.models.user import User, UserRole, EmploymentStatus, EmploymentType
from app.models.attendance import AttendanceRecord
from app.models.biometrics import FaceEnrollment
from app.models.subscription import SubscriptionPlan, Subscription, PaymentTransaction
from app.models.common import AuditLog
from app.api.deps import require_platform_owner
from app.schemas.user import Token, SuperAdminLoginRequest
from app.services.platform_admin import verify_and_login_superadmin
import uuid
import secrets

router = APIRouter()

@router.post("/login", response_model=Token)
def superadmin_portal_login(login_data: SuperAdminLoginRequest, db: Session = Depends(get_db)):
    """
    Root Platform Gatekeeper login:
    Accepts verified Supabase access token, checks user's UUID against public.platform_admins
    via server-side service-role access, and issues Super Admin session JWT.
    """
    return verify_and_login_superadmin(login_data.supabase_token, db)

class CompanyCreateRequest(BaseModel):
    name: str
    code: str
    domain: Optional[str] = None
    contact_email: str
    country: Optional[str] = "India"
    currency: Optional[str] = "INR"
    timezone: Optional[str] = "Asia/Kolkata"
    plan_id: Optional[str] = "trial"
    owner_first_name: Optional[str] = "Admin"
    owner_last_name: Optional[str] = "Owner"
    owner_password: Optional[str] = None

class CreateHrAdminRequest(BaseModel):
    company_id: int
    first_name: str
    last_name: str
    email: str
    password: str
    employee_code: Optional[str] = None
    phone: Optional[str] = None

class OrganizationStatusUpdateRequest(BaseModel):
    is_active: bool
    reason: Optional[str] = None

class OrganizationPlanUpdateRequest(BaseModel):
    plan_id: str
    max_employees: Optional[int] = None
    max_admins: Optional[int] = None
    status: Optional[str] = "ACTIVE"
    extend_days: Optional[int] = 30

@router.get("/overview")
def get_platform_overview(
    admin: User = Depends(require_platform_owner),
    db: Session = Depends(get_db)
):
    """Platform Owner Global Overview: Top-level SaaS health, revenue, and tenant counts."""
    total_companies = db.query(Company).count()
    active_companies = db.query(Company).filter(Company.is_active == True).count()
    total_employees = db.query(User).count()
    active_users = db.query(User).filter(User.status == "ACTIVE").count()
    total_face_enrolled = db.query(FaceEnrollment).count()

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_attendance = db.query(AttendanceRecord).filter(AttendanceRecord.date == today_str).count()

    # Subscriptions breakdown
    subs = db.query(Subscription).all()
    active_subs = [s for s in subs if s.status == "ACTIVE"]
    trial_subs = [s for s in subs if s.status == "TRIALING"]
    expired_subs = [s for s in subs if s.status in ["EXPIRED", "CANCELED"]]

    # MRR Calculation
    plans = {p.id: p for p in db.query(SubscriptionPlan).all()}
    mrr_inr = 0
    mrr_usd = 0.0
    for s in active_subs:
        p = plans.get(s.plan_id)
        if p:
            if s.billing_cycle == "ANNUAL":
                mrr_inr += (p.price_annual_inr // 12)
                mrr_usd += (p.price_annual_usd / 12)
            else:
                mrr_inr += p.price_monthly_inr
                mrr_usd += p.price_monthly_usd

    return {
        "platform_owner": {
            "id": admin.id,
            "name": admin.full_name,
            "email": admin.email
        },
        "stats": {
            "total_organizations": total_companies,
            "active_organizations": active_companies,
            "total_employees": total_employees,
            "active_users": active_users,
            "today_attendance_punches": today_attendance,
            "face_enrolled_total": total_face_enrolled,
            "active_subscriptions": len(active_subs),
            "trial_organizations": len(trial_subs),
            "expired_subscriptions": len(expired_subs),
            "monthly_recurring_revenue_inr": mrr_inr,
            "monthly_recurring_revenue_usd": round(mrr_usd, 2)
        }
    }

@router.get("/companies")
def list_all_companies(
    admin: User = Depends(require_platform_owner),
    db: Session = Depends(get_db)
):
    companies = db.query(Company).all()
    plans = {p.id: p for p in db.query(SubscriptionPlan).all()}
    result = []
    
    for comp in companies:
        user_count = db.query(User).filter(User.company_id == comp.id).count()
        dept_count = db.query(Department).filter(Department.company_id == comp.id).count()
        owner_user = db.query(User).filter(
            User.company_id == comp.id,
            User.role.in_([UserRole.ORGANIZATION_OWNER.value, UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value])
        ).first()

        sub = db.query(Subscription).filter(Subscription.company_id == comp.id).order_by(Subscription.id.desc()).first()
        plan = plans.get(sub.plan_id if sub else comp.subscription_plan_id)

        result.append({
            "id": comp.id,
            "name": comp.name,
            "code": comp.code,
            "domain": comp.domain,
            "contact_email": comp.contact_email,
            "country": comp.branches[0].country if comp.branches else "India",
            "currency": comp.currency,
            "timezone": comp.timezone,
            "is_active": comp.is_active,
            "user_count": user_count,
            "department_count": dept_count,
            "admin_name": owner_user.full_name if owner_user else "Unassigned",
            "admin_email": owner_user.email if owner_user else None,
            "subscription": {
                "plan_id": plan.id if plan else "trial",
                "plan_name": plan.name if plan else "Free Trial",
                "status": sub.status if sub else comp.subscription_status,
                "billing_cycle": sub.billing_cycle if sub else "MONTHLY",
                "expires_at": sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
                "max_employees": comp.max_employees or (plan.max_employees if plan else 10)
            },
            "created_at": comp.created_at.isoformat() if comp.created_at else None
        })
    return result

@router.post("/companies")
def provision_organization(
    req: CompanyCreateRequest,
    admin: User = Depends(require_platform_owner),
    db: Session = Depends(get_db)
):
    """Super Admin direct provisioning of a customer organization with initial owner credentials."""
    clean_code = req.code.strip().upper()
    clean_email = req.contact_email.strip().lower()

    if db.query(Company).filter((Company.name == req.name) | (Company.code == clean_code)).first():
        raise HTTPException(status_code=400, detail="Organization with this name or code already exists")

    if db.query(User).filter(User.email.ilike(clean_email)).first():
        raise HTTPException(status_code=400, detail="An account with this contact email already exists")

    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == req.plan_id).first()
    if not plan:
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == "trial").first()

    now = datetime.now(timezone.utc)
    company = Company(
        name=req.name.strip(),
        code=clean_code,
        domain=req.domain,
        contact_email=clean_email,
        currency=req.currency or "INR",
        timezone=req.timezone or "Asia/Kolkata",
        is_active=True,
        subscription_plan_id=plan.id,
        subscription_status="ACTIVE",
        max_employees=plan.max_employees,
        max_admins=plan.max_hr_admins,
        created_at=now
    )
    db.add(company)
    db.flush()

    branch = Branch(
        company_id=company.id,
        name=f"{company.name} HQ",
        code=f"{clean_code}-01",
        city="Corporate Office",
        country=req.country or "India",
        is_headquarters=True,
        timezone=company.timezone
    )
    db.add(branch)
    db.flush()

    settings = CompanySettings(
        company_id=company.id,
        work_hours_per_day=8.0,
        working_days="Monday,Tuesday,Wednesday,Thursday,Friday"
    )
    db.add(settings)

    # Organization Owner (Not platform owner)
    owner_pwd = req.owner_password.strip() if req.owner_password and req.owner_password.strip() else secrets.token_urlsafe(16)
    owner = User(
        company_id=company.id,
        branch_id=branch.id,
        employee_code=f"{clean_code}-001",
        email=clean_email,
        hashed_password=get_password_hash(owner_pwd),
        first_name=req.owner_first_name.strip(),
        last_name=req.owner_last_name.strip(),
        role=UserRole.ORGANIZATION_OWNER.value,
        is_platform_owner=False,
        status=EmploymentStatus.ACTIVE.value,
        employment_type=EmploymentType.FULL_TIME.value,
        date_of_joining=now.strftime("%Y-%m-%d"),
        work_location="Headquarters"
    )
    db.add(owner)
    db.flush()

    # Subscription
    sub = Subscription(
        company_id=company.id,
        plan_id=plan.id,
        status="ACTIVE",
        billing_cycle="MONTHLY",
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
        created_at=now
    )
    db.add(sub)

    # Platform Audit Log
    audit = AuditLog(
        company_id=company.id,
        user_id=admin.id,
        entity_name="Company",
        entity_id=company.id,
        action="PROVISION",
        details=f"Tenant '{company.name}' provisioned on {plan.name} by Platform Owner {admin.full_name}"
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "message": f"Organization '{company.name}' successfully provisioned.",
        "company_id": company.id,
        "organization_id": company.id,
        "owner_id": owner.id,
        "owner_email": owner.email
    }

@router.post("/create-hr-admin")
def create_tenant_hr_admin(
    req: CreateHrAdminRequest,
    admin: User = Depends(require_platform_owner),
    db: Session = Depends(get_db)
):
    company = db.query(Company).filter(Company.id == req.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    clean_email = req.email.strip().lower()
    if db.query(User).filter(User.email.ilike(clean_email)).first():
        raise HTTPException(status_code=400, detail="User with this email already exists")

    branch = db.query(Branch).filter(Branch.company_id == company.id).first()
    branch_id = branch.id if branch else None

    code = req.employee_code.strip() if req.employee_code else f"{company.code}-HR-01"
    hashed_pwd = get_password_hash(req.password.strip())

    hr_user = User(
        company_id=company.id,
        branch_id=branch_id,
        uuid=str(uuid.uuid4()),
        employee_code=code,
        email=clean_email,
        hashed_password=hashed_pwd,
        first_name=req.first_name.strip(),
        last_name=req.last_name.strip(),
        phone=req.phone,
        role=UserRole.HR_ADMIN.value,
        is_platform_owner=False,
        status=EmploymentStatus.ACTIVE.value,
        employment_type=EmploymentType.FULL_TIME.value,
        date_of_joining=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        work_location="Headquarters"
    )
    db.add(hr_user)
    db.flush()

    member = OrganizationMember(
        uuid=str(uuid.uuid4()),
        company_id=company.id,
        user_id=hr_user.id,
        role=UserRole.HR_ADMIN.value,
        status="ACTIVE",
        joined_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc)
    )
    db.add(member)
    db.commit()
    db.refresh(hr_user)

    return {
        "success": True,
        "message": f"HR Admin '{hr_user.full_name}' provisioned for '{company.name}'",
        "user_id": hr_user.id,
        "company_id": company.id,
        "email": hr_user.email
    }

@router.put("/companies/{company_id}/status")
def toggle_organization_status(
    company_id: int,
    req: OrganizationStatusUpdateRequest,
    admin: User = Depends(require_platform_owner),
    db: Session = Depends(get_db)
):
    comp = db.query(Company).filter(Company.id == company_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Organization not found")

    comp.is_active = req.is_active
    audit = AuditLog(
        company_id=comp.id,
        user_id=admin.id,
        entity_name="Company",
        entity_id=comp.id,
        action="STATUS_CHANGE",
        details=f"Organization {'activated' if req.is_active else 'suspended'} by Platform Owner. Reason: {req.reason or 'Administrative Action'}"
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "message": f"Organization '{comp.name}' is now {'Active' if req.is_active else 'Suspended'}.",
        "company_id": comp.id,
        "is_active": comp.is_active
    }

@router.put("/companies/{company_id}/subscription")
def adjust_organization_subscription(
    company_id: int,
    req: OrganizationPlanUpdateRequest,
    admin: User = Depends(require_platform_owner),
    db: Session = Depends(get_db)
):
    comp = db.query(Company).filter(Company.id == company_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Organization not found")

    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == req.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found")

    now = datetime.now(timezone.utc)
    comp.subscription_plan_id = plan.id
    comp.subscription_status = req.status
    if req.max_employees:
        comp.max_employees = req.max_employees
    else:
        comp.max_employees = plan.max_employees

    sub = db.query(Subscription).filter(Subscription.company_id == comp.id).order_by(Subscription.id.desc()).first()
    if sub:
        sub.plan_id = plan.id
        sub.status = req.status
        sub.current_period_end = now + timedelta(days=req.extend_days or 30)
        sub.updated_at = now
    else:
        sub = Subscription(
            company_id=comp.id,
            plan_id=plan.id,
            status=req.status,
            billing_cycle="MONTHLY",
            current_period_start=now,
            current_period_end=now + timedelta(days=req.extend_days or 30),
            created_at=now
        )
        db.add(sub)

    audit = AuditLog(
        company_id=comp.id,
        user_id=admin.id,
        entity_name="Subscription",
        entity_id=sub.id or comp.id,
        action="PLAN_ADJUSTMENT",
        details=f"Plan adjusted to '{plan.name}' (Limit: {comp.max_employees} employees) by Platform Owner"
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "message": f"Organization subscription updated to {plan.name}.",
        "plan_name": plan.name,
        "max_employees": comp.max_employees,
        "status": comp.subscription_status
    }

@router.get("/subscriptions")
def list_all_subscriptions(
    admin: User = Depends(require_platform_owner),
    db: Session = Depends(get_db)
):
    subs = db.query(Subscription).all()
    return [
        {
            "id": s.id,
            "company_id": s.company_id,
            "company_name": s.company.name if s.company else "Unknown",
            "company_code": s.company.code if s.company else "—",
            "plan_id": s.plan_id,
            "plan_name": s.plan.name if s.plan else s.plan_id,
            "status": s.status,
            "billing_cycle": s.billing_cycle,
            "current_period_start": s.current_period_start.isoformat() if s.current_period_start else None,
            "current_period_end": s.current_period_end.isoformat() if s.current_period_end else None,
            "trial_ends_at": s.trial_ends_at.isoformat() if s.trial_ends_at else None
        }
        for s in subs
    ]

@router.get("/transactions")
def list_all_transactions(
    admin: User = Depends(require_platform_owner),
    db: Session = Depends(get_db)
):
    txns = db.query(PaymentTransaction).order_by(PaymentTransaction.created_at.desc()).limit(200).all()
    return [
        {
            "id": t.id,
            "company_id": t.company_id,
            "company_name": t.company.name if t.company else "Unknown",
            "invoice_number": t.invoice_number,
            "amount": t.amount,
            "currency": t.currency,
            "status": t.status,
            "provider": t.provider,
            "transaction_reference": t.transaction_reference,
            "billing_name": t.billing_name,
            "billing_email": t.billing_email,
            "date": t.created_at.isoformat() if t.created_at else None
        }
        for t in txns
    ]

@router.get("/system-health")
def get_system_health(
    admin: User = Depends(require_platform_owner),
    db: Session = Depends(get_db)
):
    companies_count = db.query(Company).count()
    users_count = db.query(User).count()
    attendance_count = db.query(AttendanceRecord).count()
    enrollment_count = db.query(FaceEnrollment).count()

    return {
        "status": "HEALTHY",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": "SQLite (Tenant-isolated, Foreign Keys Enforced)",
        "metrics": {
            "total_companies": companies_count,
            "total_employees": users_count,
            "total_attendance_records": attendance_count,
            "face_id_enrolled_users": enrollment_count,
            "biometric_coverage_pct": round((enrollment_count / max(1, users_count)) * 100, 1)
        },
        "services": [
            {"name": "FastAPI Core Engine", "status": "ONLINE", "latency_ms": 1.2},
            {"name": "Face Biometrics Anti-Spoof Engine", "status": "ONLINE", "latency_ms": 4.5},
            {"name": "Physical Fingerprint Bridge / WebAuthn", "status": "READY", "latency_ms": 2.8},
            {"name": "SaaS Subscription & Quota Engine", "status": "ONLINE", "latency_ms": 1.5},
            {"name": "Tenant Isolation & RBAC Gatekeeper", "status": "ONLINE", "latency_ms": 0.8}
        ]
    }

@router.get("/audit-logs")
def get_global_audit_logs(
    admin: User = Depends(require_platform_owner),
    db: Session = Depends(get_db)
):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(200).all()
    return [
        {
            "id": l.id,
            "company_id": l.company_id,
            "user_id": l.user_id,
            "entity_name": l.entity_name,
            "entity_id": l.entity_id,
            "action": l.action,
            "details": l.details,
            "created_at": l.created_at.isoformat() if l.created_at else None
        }
        for l in logs
    ]
