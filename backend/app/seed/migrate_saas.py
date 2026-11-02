import sys
import os
import secrets
from datetime import datetime, timezone, timedelta

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.core.database import engine, SessionLocal, Base
from sqlalchemy import text, inspect
from app.models.subscription import SubscriptionPlan, Subscription, PaymentTransaction, PlanTier, SubscriptionStatus, BillingCycle
from app.models.company import Company
from app.models.user import User, UserRole
from app.core.security import get_password_hash

def run_saas_migration():
    print("Beginning SaaS Schema & Subscription Database Migration...")
    
    # 1. Create all newly defined tables
    Base.metadata.create_all(bind=engine)
    print("Created any missing ORM tables (subscription_plans, subscriptions, payment_transactions).")

    with engine.connect() as conn:
        inspector = inspect(engine)
        company_cols = [c["name"] for c in inspector.get_columns("companies")]
        user_cols = [c["name"] for c in inspector.get_columns("users")]

        # Add missing columns to companies
        cols_to_add_company = [
            ("contact_email", "VARCHAR(150)"),
            ("is_active", "BOOLEAN DEFAULT 1"),
            ("subscription_plan_id", "VARCHAR(50) DEFAULT 'trial'"),
            ("subscription_status", "VARCHAR(50) DEFAULT 'TRIALING'"),
            ("max_employees", "INTEGER DEFAULT 10"),
            ("max_admins", "INTEGER DEFAULT 1"),
            ("trial_ends_at", "DATETIME")
        ]
        for col_name, col_type in cols_to_add_company:
            if col_name not in company_cols:
                try:
                    conn.execute(text(f"ALTER TABLE companies ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                    print(f"Added column '{col_name}' to companies table.")
                except Exception as e:
                    print(f"Note on companies.{col_name}: {e}")

        # Add missing columns to users
        if "is_platform_owner" not in user_cols:
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_platform_owner BOOLEAN DEFAULT 0"))
                conn.commit()
                print("Added column 'is_platform_owner' to users table.")
            except Exception as e:
                print(f"Note on users.is_platform_owner: {e}")

    # 2. Seed Default Subscription Plans
    db = SessionLocal()
    try:
        plans = [
            {
                "id": "trial",
                "name": "Free Trial (14 Days)",
                "tier": PlanTier.FREE_TRIAL.value,
                "description": "Full access to FlowPeople Face Attendance & HR features for 14 days.",
                "price_monthly_inr": 0,
                "price_annual_inr": 0,
                "price_monthly_usd": 0.0,
                "price_annual_usd": 0.0,
                "max_employees": 15,
                "max_hr_admins": 2,
                "face_attendance_enabled": True,
                "fingerprint_enabled": True,
                "payroll_enabled": True,
                "advanced_reports_enabled": True,
                "storage_limit_gb": 5,
                "support_level": "Standard Community"
            },
            {
                "id": "starter",
                "name": "Starter Plan",
                "tier": PlanTier.STARTER.value,
                "description": "Essential workforce management for growing businesses and modern offices.",
                "price_monthly_inr": 2499,
                "price_annual_inr": 24990,
                "price_monthly_usd": 29.0,
                "price_annual_usd": 290.0,
                "max_employees": 30,
                "max_hr_admins": 2,
                "face_attendance_enabled": True,
                "fingerprint_enabled": True,
                "payroll_enabled": False,
                "advanced_reports_enabled": True,
                "storage_limit_gb": 15,
                "support_level": "Standard Email"
            },
            {
                "id": "professional",
                "name": "Professional Plan",
                "tier": PlanTier.PROFESSIONAL.value,
                "description": "Complete all-in-one HRMS, Optical Face Attendance, USB Fingerprint & Payroll.",
                "price_monthly_inr": 6999,
                "price_annual_inr": 69990,
                "price_monthly_usd": 79.0,
                "price_annual_usd": 790.0,
                "max_employees": 100,
                "max_hr_admins": 5,
                "face_attendance_enabled": True,
                "fingerprint_enabled": True,
                "payroll_enabled": True,
                "advanced_reports_enabled": True,
                "storage_limit_gb": 50,
                "support_level": "Priority 24/7"
            },
            {
                "id": "enterprise",
                "name": "Enterprise Plan",
                "tier": PlanTier.ENTERPRISE.value,
                "description": "Unlimited scale, dedicated multi-kiosk hardware integration, and custom compliance.",
                "price_monthly_inr": 19999,
                "price_annual_inr": 199990,
                "price_monthly_usd": 249.0,
                "price_annual_usd": 2490.0,
                "max_employees": 10000,
                "max_hr_admins": 50,
                "face_attendance_enabled": True,
                "fingerprint_enabled": True,
                "payroll_enabled": True,
                "advanced_reports_enabled": True,
                "storage_limit_gb": 500,
                "support_level": "Dedicated Account Manager & SLA"
            }
        ]

        for p_data in plans:
            existing_p = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == p_data["id"]).first()
            if not existing_p:
                p = SubscriptionPlan(**p_data)
                db.add(p)
                print(f"Seeded plan: {p_data['name']}")
            else:
                for k, v in p_data.items():
                    setattr(existing_p, k, v)
        db.commit()

        # 3. Allowlist Platform Owner Identity
        owner_configs = [
            {"email": "pimpaleg80@gmail.com", "first_name": "Harsh", "last_name": "Pimpale", "password": "Harsh@9970"},
            {"email": "pimpaleharshad99@gmail.com", "first_name": "Harshad", "last_name": "Pimpale", "password": "Harsh@9970"},
            {"email": "admin@flowcraft.io", "first_name": "Platform", "last_name": "Owner", "password": "Harsh@9970"}
        ]
        primary_company = db.query(Company).first()
        for cfg in owner_configs:
            owner_user = db.query(User).filter(User.email.ilike(cfg["email"])).first()
            if owner_user:
                owner_user.is_platform_owner = True
                owner_user.role = "SUPER_ADMIN"
                owner_user.hashed_password = get_password_hash(cfg["password"])
                db.add(owner_user)
                print(f"Granted verified Platform Owner privileges & updated password for {owner_user.email} (ID: {owner_user.id}).")
            else:
                owner_user = User(
                    email=cfg["email"],
                    employee_code=f"OWNER-{secrets.token_hex(2).upper()}",
                    hashed_password=get_password_hash(cfg["password"]),
                    first_name=cfg["first_name"],
                    last_name=cfg["last_name"],
                    role="SUPER_ADMIN",
                    status="ACTIVE",
                    is_platform_owner=True,
                    date_of_joining="2026-01-01",
                    company_id=primary_company.id if primary_company else 1
                )
                db.add(owner_user)
                print(f"Created verified Platform Owner user {cfg['email']}.")
        db.commit()

        # 4. Attach active subscription to existing companies
        companies = db.query(Company).all()
        now = datetime.now(timezone.utc)
        valid_plan_ids = {p["id"] for p in plans}
        for comp in companies:
            if comp.subscription_plan_id == "free_trial" or comp.subscription_plan_id not in valid_plan_ids:
                comp.subscription_plan_id = "professional" if comp.code == "FLOWCRAFT" else "trial"
            if not comp.subscription_status:
                comp.subscription_status = "ACTIVE"
            if not comp.max_employees:
                comp.max_employees = 100
            if not comp.is_active:
                comp.is_active = True
            
            existing_sub = db.query(Subscription).filter(Subscription.company_id == comp.id).first()
            if not existing_sub:
                sub = Subscription(
                    company_id=comp.id,
                    plan_id=comp.subscription_plan_id or "professional",
                    status="ACTIVE",
                    billing_cycle="ANNUAL",
                    current_period_start=now,
                    current_period_end=now + timedelta(days=365),
                    trial_ends_at=now + timedelta(days=14)
                )
                db.add(sub)
                print(f"Activated subscription for company {comp.name} (Code: {comp.code}).")
        db.commit()
        print("SaaS migration and plan seeding completed successfully.")

    finally:
        db.close()

if __name__ == "__main__":
    run_saas_migration()

