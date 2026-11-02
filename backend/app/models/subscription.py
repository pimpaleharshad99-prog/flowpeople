from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, Enum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class PlanTier(str, enum.Enum):
    FREE_TRIAL = "FREE_TRIAL"
    STARTER = "STARTER"
    PROFESSIONAL = "PROFESSIONAL"
    ENTERPRISE = "ENTERPRISE"

class SubscriptionStatus(str, enum.Enum):
    TRIALING = "TRIALING"
    ACTIVE = "ACTIVE"
    PAST_DUE = "PAST_DUE"
    CANCELED = "CANCELED"
    EXPIRED = "EXPIRED"
    GRACE_PERIOD = "GRACE_PERIOD"

class BillingCycle(str, enum.Enum):
    MONTHLY = "MONTHLY"
    ANNUAL = "ANNUAL"

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id = Column(String(50), primary_key=True) # e.g. "free_trial", "starter", "professional", "enterprise"
    name = Column(String(100), nullable=False)
    tier = Column(String(50), default=PlanTier.FREE_TRIAL.value, nullable=False)
    description = Column(Text, nullable=True)
    
    # Pricing in INR and USD
    price_monthly_inr = Column(Integer, default=0) # In paise or flat rupees
    price_annual_inr = Column(Integer, default=0)
    price_monthly_usd = Column(Float, default=0.0)
    price_annual_usd = Column(Float, default=0.0)
    
    # Quotas and Feature Flags
    max_employees = Column(Integer, default=10)
    max_hr_admins = Column(Integer, default=1)
    face_attendance_enabled = Column(Boolean, default=True)
    fingerprint_enabled = Column(Boolean, default=False)
    payroll_enabled = Column(Boolean, default=False)
    advanced_reports_enabled = Column(Boolean, default=False)
    storage_limit_gb = Column(Integer, default=5)
    support_level = Column(String(50), default="Community / Email")
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    subscriptions = relationship("Subscription", back_populates="plan")

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(String(50), ForeignKey("subscription_plans.id"), nullable=False)
    
    status = Column(String(50), default=SubscriptionStatus.TRIALING.value, nullable=False)
    billing_cycle = Column(String(20), default=BillingCycle.MONTHLY.value, nullable=False)
    
    current_period_start = Column(DateTime(timezone=True), default=utcnow)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    grace_period_until = Column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    company = relationship("Company", back_populates="subscriptions")
    plan = relationship("SubscriptionPlan", back_populates="subscriptions")
    transactions = relationship("PaymentTransaction", back_populates="subscription", cascade="all, delete-orphan")

class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True)
    
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="INR")
    status = Column(String(30), default="SUCCESS", nullable=False) # SUCCESS, PENDING, FAILED
    provider = Column(String(50), default="MOCK_RAZORPAY") # RAZORPAY, STRIPE, MANUAL_INVOICE
    transaction_reference = Column(String(100), unique=True, index=True, nullable=False)
    invoice_number = Column(String(100), unique=True, index=True, nullable=False)
    
    billing_name = Column(String(150), nullable=True)
    billing_email = Column(String(150), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    company = relationship("Company")
    subscription = relationship("Subscription", back_populates="transactions")

