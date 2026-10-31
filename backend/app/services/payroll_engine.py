from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.models.company import Company, Holiday
from app.models.user import User, EmploymentStatus
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.leave import LeaveRequest, LeaveStatus
from app.models.payroll import (
    PayrollPeriod,
    Payslip,
    EmployeeSalaryStructure,
    PayrollPeriodStatus,
    PayslipPaymentStatus
)

def compute_working_days(db: Session, company_id: int, start_date_str: str, end_date_str: str) -> float:
    """
    Computes standard working days (Mon-Fri) excluding registered company holidays.
    """
    start_d = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    end_d = datetime.strptime(end_date_str, "%Y-%m-%d").date()

    # Query holidays in date range
    holidays = db.query(Holiday).filter(
        Holiday.company_id == company_id,
        Holiday.holiday_date >= start_date_str,
        Holiday.holiday_date <= end_date_str
    ).all()
    holiday_dates = {datetime.strptime(h.holiday_date, "%Y-%m-%d").date() for h in holidays}

    curr = start_d
    working_days = 0.0
    while curr <= end_d:
        # 0=Monday, 4=Friday, 5=Saturday, 6=Sunday
        if curr.weekday() < 5 and curr not in holiday_dates:
            working_days += 1.0
        curr += timedelta(days=1)

    return max(1.0, working_days)

def get_or_create_default_salary_structure(db: Session, user: User) -> EmployeeSalaryStructure:
    """
    Retrieves or establishes a baseline standard salary structure for an employee.
    """
    structure = db.query(EmployeeSalaryStructure).filter(
        EmployeeSalaryStructure.user_id == user.id,
        EmployeeSalaryStructure.is_active == True
    ).first()

    if not structure:
        # Create standard tier baseline: $60,000 CTC
        ctc_annual = 60000.0
        basic_monthly = 2500.0
        hra_monthly = 1250.0
        allowances_monthly = 750.0
        pf_deduction_monthly = 300.0
        professional_tax_monthly = 100.0
        net_monthly_base = 4100.0

        structure = EmployeeSalaryStructure(
            company_id=user.company_id,
            user_id=user.id,
            ctc_annual=ctc_annual,
            basic_monthly=basic_monthly,
            hra_monthly=hra_monthly,
            allowances_monthly=allowances_monthly,
            pf_deduction_monthly=pf_deduction_monthly,
            professional_tax_monthly=professional_tax_monthly,
            net_monthly_base=net_monthly_base,
            effective_from=datetime.now().strftime("%Y-01-01"),
            is_active=True
        )
        db.add(structure)
        db.commit()
        db.refresh(structure)

    return structure

def run_payroll_calculation(
    db: Session,
    company_id: int,
    month: str,
    period_start: str,
    period_end: str,
    processed_by_id: Optional[int] = None,
    notes: Optional[str] = None
) -> PayrollPeriod:
    """
    Authoritative server-side payroll calculation engine.
    Computes working days, attendance deductions, overtime pay, statutory deductions,
    and net pay for all active employees in the company.
    """
    # 1. Check existing payroll period
    period = db.query(PayrollPeriod).filter(
        PayrollPeriod.company_id == company_id,
        PayrollPeriod.month == month
    ).first()

    if period:
        if period.status in [PayrollPeriodStatus.APPROVED.value, PayrollPeriodStatus.PAID.value]:
            raise ValueError(f"Payroll period {month} is already {period.status} and cannot be recalculated.")
    else:
        period = PayrollPeriod(
            company_id=company_id,
            month=month,
            period_start=period_start,
            period_end=period_end,
            status=PayrollPeriodStatus.DRAFT.value,
            notes=notes
        )
        db.add(period)
        db.commit()
        db.refresh(period)

    working_days = compute_working_days(db, company_id, period_start, period_end)

    # 2. Query active employees in company
    employees = db.query(User).filter(
        User.company_id == company_id,
        User.status.in_([
            EmploymentStatus.ACTIVE.value,
            EmploymentStatus.PROBATION.value,
            "ACTIVE",
            "PROBATION"
        ])
    ).all()

    total_gross = 0.0
    total_deductions = 0.0
    total_net = 0.0

    for emp in employees:
        struct = get_or_create_default_salary_structure(db, emp)

        # 3. Attendance analysis
        attendance_records = db.query(AttendanceRecord).filter(
            AttendanceRecord.user_id == emp.id,
            AttendanceRecord.date >= period_start,
            AttendanceRecord.date <= period_end
        ).all()

        days_present = 0.0
        overtime_hours = 0.0

        for rec in attendance_records:
            if rec.status == AttendanceStatus.PRESENT.value:
                days_present += 1.0
            elif rec.status == AttendanceStatus.HALF_DAY.value:
                days_present += 0.5
            
            overtime_hours += ((rec.overtime_minutes or 0.0) / 60.0)

        # 4. Leave analysis
        approved_leaves = db.query(LeaveRequest).filter(
            LeaveRequest.user_id == emp.id,
            LeaveRequest.status == LeaveStatus.APPROVED.value,
            LeaveRequest.from_date <= period_end,
            LeaveRequest.to_date >= period_start
        ).all()

        paid_leaves = 0.0
        unpaid_leaves = 0.0

        for lv in approved_leaves:
            days = lv.day_count or 1.0
            if lv.leave_type and getattr(lv.leave_type, 'is_paid', True):
                paid_leaves += days
            else:
                unpaid_leaves += days

        # If employee has attendance records, use tracked attendance;
        # otherwise (e.g. system seed / newly registered), assume standard attendance
        if len(attendance_records) > 0:
            payable_days = min(working_days, days_present + paid_leaves)
            unpaid_absent_days = max(0.0, working_days - payable_days)
        else:
            payable_days = working_days
            days_present = working_days
            unpaid_absent_days = 0.0

        # 5. Financial rates
        daily_basic_rate = struct.basic_monthly / working_days
        hourly_rate = (struct.net_monthly_base / working_days) / 8.0

        # Overtime (1.5x multiplier)
        overtime_pay = round(overtime_hours * hourly_rate * 1.5, 2)

        # Attendance deduction
        attendance_deduction = round(unpaid_absent_days * daily_basic_rate, 2)
        basic_earned = max(0.0, round(struct.basic_monthly - attendance_deduction, 2))
        hra_earned = struct.hra_monthly
        allowances_earned = struct.allowances_monthly

        gross_earnings = round(basic_earned + hra_earned + allowances_earned + overtime_pay, 2)

        # Statutory deductions
        pf_ded = struct.pf_deduction_monthly
        tax_ded = struct.professional_tax_monthly
        emp_deductions = round(pf_ded + tax_ded, 2)

        net_salary = max(0.0, round(gross_earnings - emp_deductions, 2))

        # 6. Upsert Payslip
        payslip = db.query(Payslip).filter(
            Payslip.payroll_period_id == period.id,
            Payslip.user_id == emp.id
        ).first()

        if not payslip:
            payslip = Payslip(
                company_id=company_id,
                payroll_period_id=period.id,
                user_id=emp.id
            )
            db.add(payslip)

        payslip.working_days = working_days
        payslip.days_present = days_present
        payslip.paid_leaves = paid_leaves
        payslip.unpaid_leaves = unpaid_absent_days
        payslip.payable_days = payable_days
        payslip.overtime_hours = overtime_hours
        payslip.overtime_pay = overtime_pay
        payslip.basic_salary = basic_earned
        payslip.hra = hra_earned
        payslip.allowances = allowances_earned
        payslip.gross_earnings = gross_earnings
        payslip.pf_deduction = pf_ded
        payslip.tax_deduction = tax_ded
        payslip.other_deductions = 0.0
        payslip.total_deductions = emp_deductions
        payslip.net_salary = net_salary
        payslip.payment_status = PayslipPaymentStatus.PENDING.value

        total_gross += gross_earnings
        total_deductions += emp_deductions
        total_net += net_salary

    period.status = PayrollPeriodStatus.PROCESSED.value
    period.total_gross = round(total_gross, 2)
    period.total_deductions = round(total_deductions, 2)
    period.total_net = round(total_net, 2)
    period.employee_count = len(employees)
    period.processed_by_id = processed_by_id
    if notes:
        period.notes = notes

    db.commit()
    db.refresh(period)
    return period
