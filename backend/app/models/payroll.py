from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum

from app.core.database import Base

class PayrollPeriodStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PROCESSED = "PROCESSED"
    APPROVED = "APPROVED"
    PAID = "PAID"

class PayslipPaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"

class SalaryComponentType(str, enum.Enum):
    EARNING = "EARNING"
    DEDUCTION = "DEDUCTION"

class SalaryComponent(Base):
    __tablename__ = "salary_components"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    component_type = Column(String(20), default=SalaryComponentType.EARNING.value)
    is_taxable = Column(Boolean, default=True)
    is_statutory = Column(Boolean, default=False)
    default_amount = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    company = relationship("Company")

class EmployeeSalaryStructure(Base):
    __tablename__ = "employee_salary_structures"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    ctc_annual = Column(Float, nullable=False, default=0.0)
    basic_monthly = Column(Float, nullable=False, default=0.0)
    hra_monthly = Column(Float, nullable=False, default=0.0)
    allowances_monthly = Column(Float, default=0.0)
    pf_deduction_monthly = Column(Float, default=0.0)
    professional_tax_monthly = Column(Float, default=0.0)
    net_monthly_base = Column(Float, nullable=False, default=0.0)
    effective_from = Column(String(10), nullable=False) # YYYY-MM-DD
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    company = relationship("Company")
    user = relationship("User")

class PayrollPeriod(Base):
    __tablename__ = "payroll_periods"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    month = Column(String(7), nullable=False, index=True) # YYYY-MM (e.g. 2026-10)
    period_start = Column(String(10), nullable=False) # YYYY-MM-DD
    period_end = Column(String(10), nullable=False) # YYYY-MM-DD
    status = Column(String(20), default=PayrollPeriodStatus.DRAFT.value)
    total_gross = Column(Float, default=0.0)
    total_deductions = Column(Float, default=0.0)
    total_net = Column(Float, default=0.0)
    employee_count = Column(Integer, default=0)
    processed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    company = relationship("Company")
    processed_by = relationship("User", foreign_keys=[processed_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    payslips = relationship("Payslip", back_populates="payroll_period", cascade="all, delete-orphan")

class Payslip(Base):
    __tablename__ = "payslips"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    payroll_period_id = Column(Integer, ForeignKey("payroll_periods.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Working Days breakdown
    working_days = Column(Float, default=30.0)
    days_present = Column(Float, default=0.0)
    paid_leaves = Column(Float, default=0.0)
    unpaid_leaves = Column(Float, default=0.0)
    payable_days = Column(Float, default=0.0)
    
    # Overtime
    overtime_hours = Column(Float, default=0.0)
    overtime_pay = Column(Float, default=0.0)
    
    # Earnings breakdown
    basic_salary = Column(Float, default=0.0)
    hra = Column(Float, default=0.0)
    allowances = Column(Float, default=0.0)
    gross_earnings = Column(Float, default=0.0)
    
    # Deductions breakdown
    pf_deduction = Column(Float, default=0.0)
    tax_deduction = Column(Float, default=0.0)
    other_deductions = Column(Float, default=0.0)
    total_deductions = Column(Float, default=0.0)
    
    # Final Net
    net_salary = Column(Float, default=0.0)
    payment_status = Column(String(20), default=PayslipPaymentStatus.PENDING.value)
    payment_date = Column(String(10), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    company = relationship("Company")
    payroll_period = relationship("PayrollPeriod", back_populates="payslips")
    user = relationship("User")

