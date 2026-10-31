from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel

from app.core.database import get_db
from app.models.payroll import (
    PayrollPeriod,
    Payslip,
    EmployeeSalaryStructure,
    PayrollPeriodStatus,
    PayslipPaymentStatus
)
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_admin
from app.services.payroll_engine import run_payroll_calculation, get_or_create_default_salary_structure

router = APIRouter()

# Schemas
class PayrollRunRequest(BaseModel):
    month: str # YYYY-MM
    period_start: str # YYYY-MM-DD
    period_end: str # YYYY-MM-DD
    notes: Optional[str] = None

class SalaryStructureCreate(BaseModel):
    user_id: int
    ctc_annual: float
    basic_monthly: float
    hra_monthly: float
    allowances_monthly: Optional[float] = 0.0
    pf_deduction_monthly: Optional[float] = 0.0
    professional_tax_monthly: Optional[float] = 0.0
    effective_from: Optional[str] = None

class PayslipOut(BaseModel):
    id: int
    user_id: int
    employee_code: Optional[str]
    employee_name: str
    department: Optional[str]
    designation: Optional[str]
    working_days: float
    days_present: float
    paid_leaves: float
    unpaid_leaves: float
    payable_days: float
    overtime_hours: float
    overtime_pay: float
    basic_salary: float
    hra: float
    allowances: float
    gross_earnings: float
    pf_deduction: float
    tax_deduction: float
    other_deductions: float
    total_deductions: float
    net_salary: float
    payment_status: str
    payment_date: Optional[str]
    created_at: Optional[str]

class PayrollPeriodOut(BaseModel):
    id: int
    month: str
    period_start: str
    period_end: str
    status: str
    total_gross: float
    total_deductions: float
    total_net: float
    employee_count: int
    notes: Optional[str]
    processed_by: Optional[str]
    approved_by: Optional[str]
    created_at: Optional[str]

def format_payslip(p: Payslip) -> dict:
    emp = p.user
    return {
        "id": p.id,
        "user_id": p.user_id,
        "employee_code": emp.employee_code if emp else None,
        "employee_name": emp.full_name if emp else "Unknown",
        "department": emp.department.name if emp and emp.department else "General",
        "designation": emp.designation.name if emp and emp.designation else "Staff",
        "month": p.payroll_period.month if p.payroll_period else "",
        "period_start": p.payroll_period.period_start if p.payroll_period else "",
        "period_end": p.payroll_period.period_end if p.payroll_period else "",
        "working_days": p.working_days,
        "days_present": p.days_present,
        "paid_leaves": p.paid_leaves,
        "unpaid_leaves": p.unpaid_leaves,
        "payable_days": p.payable_days,
        "overtime_hours": p.overtime_hours,
        "overtime_pay": p.overtime_pay,
        "basic_salary": p.basic_salary,
        "hra": p.hra,
        "allowances": p.allowances,
        "gross_earnings": p.gross_earnings,
        "pf_deduction": p.pf_deduction,
        "tax_deduction": p.tax_deduction,
        "other_deductions": p.other_deductions,
        "total_deductions": p.total_deductions,
        "net_salary": p.net_salary,
        "payment_status": p.payment_status,
        "payment_date": p.payment_date,
        "created_at": p.created_at.isoformat() if p.created_at else None
    }

# Endpoints

@router.get("/summary")
def get_payroll_summary(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    periods = db.query(PayrollPeriod).filter(
        PayrollPeriod.company_id == current_user.company_id
    ).order_by(PayrollPeriod.month.desc()).all()

    latest = periods[0] if periods else None
    total_paid_year = sum(p.total_net for p in periods if p.status == PayrollPeriodStatus.PAID.value)

    return {
        "latest_month": latest.month if latest else None,
        "latest_status": latest.status if latest else "NO_RUNS",
        "latest_net_payroll": latest.total_net if latest else 0.0,
        "latest_employee_count": latest.employee_count if latest else 0,
        "total_periods": len(periods),
        "total_paid_ytd": round(total_paid_year, 2)
    }

@router.get("/periods")
def list_payroll_periods(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    periods = db.query(PayrollPeriod).filter(
        PayrollPeriod.company_id == current_user.company_id
    ).order_by(PayrollPeriod.month.desc()).all()

    return [
        {
            "id": p.id,
            "month": p.month,
            "period_start": p.period_start,
            "period_end": p.period_end,
            "status": p.status,
            "total_gross": p.total_gross,
            "total_deductions": p.total_deductions,
            "total_net": p.total_net,
            "employee_count": p.employee_count,
            "notes": p.notes,
            "processed_by": p.processed_by.full_name if p.processed_by else "System",
            "approved_by": p.approved_by.full_name if p.approved_by else None,
            "created_at": p.created_at.isoformat() if p.created_at else None
        }
        for p in periods
    ]

@router.post("/periods")
def run_payroll(
    req: PayrollRunRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    try:
        period = run_payroll_calculation(
            db=db,
            company_id=current_user.company_id,
            month=req.month,
            period_start=req.period_start,
            period_end=req.period_end,
            processed_by_id=current_user.id,
            notes=req.notes
        )
        return {
            "success": True,
            "message": f"Payroll period {period.month} successfully calculated",
            "period_id": period.id,
            "total_net": period.total_net,
            "employee_count": period.employee_count
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/periods/{period_id}")
def get_payroll_period_detail(
    period_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    period = db.query(PayrollPeriod).filter(
        PayrollPeriod.id == period_id,
        PayrollPeriod.company_id == current_user.company_id
    ).first()
    if not period:
        raise HTTPException(status_code=404, detail="Payroll period not found")

    payslips = db.query(Payslip).filter(
        Payslip.payroll_period_id == period.id,
        Payslip.company_id == current_user.company_id
    ).all()

    return {
        "period": {
            "id": period.id,
            "month": period.month,
            "period_start": period.period_start,
            "period_end": period.period_end,
            "status": period.status,
            "total_gross": period.total_gross,
            "total_deductions": period.total_deductions,
            "total_net": period.total_net,
            "employee_count": period.employee_count,
            "notes": period.notes,
            "processed_by": period.processed_by.full_name if period.processed_by else None,
            "approved_by": period.approved_by.full_name if period.approved_by else None,
        },
        "payslips": [format_payslip(p) for p in payslips]
    }

@router.post("/periods/{period_id}/approve")
def approve_payroll_period(
    period_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    period = db.query(PayrollPeriod).filter(
        PayrollPeriod.id == period_id,
        PayrollPeriod.company_id == current_user.company_id
    ).first()
    if not period:
        raise HTTPException(status_code=404, detail="Payroll period not found")

    if period.status == PayrollPeriodStatus.APPROVED.value:
        return {"success": True, "message": "Period already approved"}

    period.status = PayrollPeriodStatus.APPROVED.value
    period.approved_by_id = current_user.id
    db.commit()
    return {"success": True, "status": period.status}

@router.post("/periods/{period_id}/mark-paid")
def mark_payroll_period_paid(
    period_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    period = db.query(PayrollPeriod).filter(
        PayrollPeriod.id == period_id,
        PayrollPeriod.company_id == current_user.company_id
    ).first()
    if not period:
        raise HTTPException(status_code=404, detail="Payroll period not found")

    today_str = datetime.now().strftime("%Y-%m-%d")
    period.status = PayrollPeriodStatus.PAID.value

    # Mark all associated payslips as PAID
    payslips = db.query(Payslip).filter(
        Payslip.payroll_period_id == period.id,
        Payslip.company_id == current_user.company_id
    ).all()

    for p in payslips:
        p.payment_status = PayslipPaymentStatus.PAID.value
        p.payment_date = today_str

    db.commit()
    return {"success": True, "status": period.status, "payslips_updated": len(payslips)}

@router.get("/my-payslips")
def get_my_payslips(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    payslips = db.query(Payslip).filter(
        Payslip.user_id == current_user.id,
        Payslip.company_id == current_user.company_id
    ).order_by(Payslip.created_at.desc()).all()

    return [format_payslip(p) for p in payslips]

@router.get("/payslips/{payslip_id}")
def get_payslip_detail(
    payslip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    admin_roles = [
        UserRole.SUPER_ADMIN.value,
        UserRole.HR_ADMIN.value,
        UserRole.ADMIN.value,
        UserRole.HR_MANAGER.value,
        UserRole.HR_EXECUTIVE.value,
        "COMPANY_ADMIN"
    ]

    payslip = db.query(Payslip).filter(
        Payslip.id == payslip_id,
        Payslip.company_id == current_user.company_id
    ).first()
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")

    # Security check: standard employee can only view their own payslip
    if current_user.role == UserRole.EMPLOYEE.value and payslip.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access payslip of another employee")

    return format_payslip(payslip)

@router.get("/salary-structures")
def list_salary_structures(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    employees = db.query(User).filter(
        User.company_id == current_user.company_id
    ).all()

    results = []
    for emp in employees:
        struct = get_or_create_default_salary_structure(db, emp)
        results.append({
            "id": struct.id,
            "user_id": emp.id,
            "employee_code": emp.employee_code,
            "employee_name": emp.full_name,
            "department": emp.department.name if emp.department else "General",
            "designation": emp.designation.name if emp.designation else "Staff",
            "ctc_annual": struct.ctc_annual,
            "basic_monthly": struct.basic_monthly,
            "hra_monthly": struct.hra_monthly,
            "allowances_monthly": struct.allowances_monthly,
            "pf_deduction_monthly": struct.pf_deduction_monthly,
            "professional_tax_monthly": struct.professional_tax_monthly,
            "net_monthly_base": struct.net_monthly_base,
            "effective_from": struct.effective_from,
            "is_active": struct.is_active
        })

    return results

@router.post("/salary-structures")
def create_or_update_salary_structure(
    req: SalaryStructureCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    target = db.query(User).filter(
        User.id == req.user_id,
        User.company_id == current_user.company_id
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Employee not found")

    struct = db.query(EmployeeSalaryStructure).filter(
        EmployeeSalaryStructure.user_id == target.id,
        EmployeeSalaryStructure.company_id == current_user.company_id
    ).first()

    gross_monthly = req.basic_monthly + req.hra_monthly + (req.allowances_monthly or 0.0)
    deductions_monthly = (req.pf_deduction_monthly or 0.0) + (req.professional_tax_monthly or 0.0)
    net_monthly = max(0.0, gross_monthly - deductions_monthly)

    if not struct:
        struct = EmployeeSalaryStructure(
            company_id=current_user.company_id,
            user_id=target.id,
            ctc_annual=req.ctc_annual,
            basic_monthly=req.basic_monthly,
            hra_monthly=req.hra_monthly,
            allowances_monthly=req.allowances_monthly or 0.0,
            pf_deduction_monthly=req.pf_deduction_monthly or 0.0,
            professional_tax_monthly=req.professional_tax_monthly or 0.0,
            net_monthly_base=net_monthly,
            effective_from=req.effective_from or datetime.now().strftime("%Y-%m-%d"),
            is_active=True
        )
        db.add(struct)
    else:
        struct.ctc_annual = req.ctc_annual
        struct.basic_monthly = req.basic_monthly
        struct.hra_monthly = req.hra_monthly
        struct.allowances_monthly = req.allowances_monthly or 0.0
        struct.pf_deduction_monthly = req.pf_deduction_monthly or 0.0
        struct.professional_tax_monthly = req.professional_tax_monthly or 0.0
        struct.net_monthly_base = net_monthly
        if req.effective_from:
            struct.effective_from = req.effective_from
        struct.is_active = True

    db.commit()
    db.refresh(struct)
    return {
        "success": True,
        "structure_id": struct.id,
        "net_monthly_base": struct.net_monthly_base
    }
