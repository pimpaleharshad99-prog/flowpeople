"""
FlowPeople by FlowCraft - Enterprise Report Generation Engine
Generates official attendance rosters, monthly summaries, leave reports, and payroll records in CSV and PDF formats.
Pure Python implementation with zero binary dependencies.
"""

from typing import Tuple, Optional, List
import io
import csv
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.company import Company, Department, Branch
from app.models.user import User, EmploymentStatus
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.leave import LeaveRequest, LeaveStatus
from app.models.payroll import Payslip

def _escape_pdf_str(text: str) -> str:
    if not text:
        return ""
    clean = str(text).encode("latin-1", "replace").decode("latin-1")
    return clean.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

def _build_pdf_document(title: str, subtitle: str, company_name: str, kpis: List[Tuple[str, str]], headers: List[str], rows: List[List[str]]) -> bytes:
    """
    Builds a standards-compliant PDF 1.4 document in A4 landscape mode (842 x 595 pt).
    Features FlowPeople Burgundy (#590907) branding, summary KPIs, and tabular layout.
    """
    page_width = 842
    page_height = 595
    margin_x = 40
    margin_top = 40

    # Calculate pages needed
    row_height = 18
    header_y = page_height - margin_top - 120
    rows_per_page = int((header_y - 50) / row_height)
    total_rows = len(rows)
    num_pages = max(1, (total_rows + rows_per_page - 1) // rows_per_page) if total_rows > 0 else 1

    page_objs = []
    content_objs = []

    # Column widths for 842 pt page (usable width = 762 pt)
    # Total width: 762 pt
    col_widths = [80, 150, 110, 80, 70, 70, 70, 60, 72]
    # Adjust to number of headers
    if len(headers) != len(col_widths):
        col_w = int(762 / max(1, len(headers)))
        col_widths = [col_w] * len(headers)

    for p in range(num_pages):
        page_rows = rows[p * rows_per_page : (p + 1) * rows_per_page]
        stream_cmds = []

        # 1. Header Burgundy Banner (Top Accent Bar)
        # Deep Burgundy #590907 -> (0.349, 0.035, 0.027)
        stream_cmds.append("0.349 0.035 0.027 rg")
        stream_cmds.append(f"{margin_x} {page_height - margin_top} 762 4 re f")

        # 2. Brand & Title Text
        stream_cmds.append("0.1 0.1 0.1 rg")
        stream_cmds.append("BT /F2 16 Tf")
        stream_cmds.append(f"{margin_x} {page_height - margin_top - 24} Td ({_escape_pdf_str(title)}) Tj ET")

        stream_cmds.append("0.4 0.4 0.4 rg")
        stream_cmds.append("BT /F1 10 Tf")
        stream_cmds.append(f"{margin_x} {page_height - margin_top - 38} Td ({_escape_pdf_str(subtitle)} | Organization: {_escape_pdf_str(company_name)}) Tj ET")

        # 3. KPI Summary Bar (Page 1 only)
        if p == 0 and kpis:
            kpi_x = margin_x
            kpi_y = page_height - margin_top - 76
            # Background box: Warm Cream Beige #E8D2B5 tint -> (0.95, 0.92, 0.88)
            stream_cmds.append("0.96 0.94 0.91 rg")
            stream_cmds.append(f"{margin_x} {kpi_y} 762 26 re f")
            stream_cmds.append("0.8 0.75 0.7 rg 1 w")
            stream_cmds.append(f"{margin_x} {kpi_y} 762 26 re S")

            stream_cmds.append("0.349 0.035 0.027 rg")
            stream_cmds.append("BT /F2 9 Tf")
            for label, val in kpis:
                stream_cmds.append(f"{kpi_x + 12} {kpi_y + 8} Td ({_escape_pdf_str(label)}: {_escape_pdf_str(val)}) Tj ET")
                stream_cmds.append("BT /F2 9 Tf")
                kpi_x += 140

        # 4. Table Column Headers
        current_y = header_y
        stream_cmds.append("0.92 0.93 0.90 rg")
        stream_cmds.append(f"{margin_x} {current_y - 4} 762 20 re f")
        stream_cmds.append("0.7 0.7 0.7 rg 0.5 w")
        stream_cmds.append(f"{margin_x} {current_y - 4} 762 20 re S")

        stream_cmds.append("0.2 0.2 0.2 rg")
        stream_cmds.append("BT /F2 9 Tf")
        cx = margin_x + 6
        for i, h in enumerate(headers):
            stream_cmds.append(f"{cx} {current_y + 2} Td ({_escape_pdf_str(h)}) Tj ET")
            stream_cmds.append("BT /F2 9 Tf")
            cx += col_widths[i]

        current_y -= row_height

        # 5. Table Rows
        for r_idx, r in enumerate(page_rows):
            # Alternating background row tint
            if r_idx % 2 == 1:
                stream_cmds.append("0.98 0.98 0.97 rg")
                stream_cmds.append(f"{margin_x} {current_y - 3} 762 {row_height} re f")

            # Border line under row
            stream_cmds.append("0.88 0.88 0.88 rg 0.5 w")
            stream_cmds.append(f"{margin_x} {current_y - 3} m {margin_x + 762} {current_y - 3} l S")

            stream_cmds.append("0.15 0.15 0.15 rg")
            stream_cmds.append("BT /F1 8 Tf")
            cx = margin_x + 6
            for i, cell in enumerate(r):
                # Truncate text if too long
                c_str = _escape_pdf_str(str(cell))[:32]
                stream_cmds.append(f"{cx} {current_y + 2} Td ({c_str}) Tj ET")
                stream_cmds.append("BT /F1 8 Tf")
                if i < len(col_widths):
                    cx += col_widths[i]

            current_y -= row_height

        # 6. Footer
        stream_cmds.append("0.5 0.5 0.5 rg")
        stream_cmds.append("BT /F1 8 Tf")
        footer_text = f"FlowPeople by FlowCraft - Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} - Page {p + 1} of {num_pages} - Confidential"
        stream_cmds.append(f"{margin_x} 25 Td ({_escape_pdf_str(footer_text)}) Tj ET")

        content_bytes = "\n".join(stream_cmds).encode("latin-1")
        content_objs.append(content_bytes)

    # Assemble PDF Catalog, Pages, Resources, Streams
    objects = []
    # 1: Catalog
    # 2: Pages
    # 3: Helvetica
    # 4: Helvetica-Bold
    # Pages will be indexed dynamically

    total_objs_count = 4 + (num_pages * 2)
    catalog_obj = b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj"
    f1_obj = b"3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj"
    f2_obj = b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj"

    page_refs = []
    for p in range(num_pages):
        page_obj_id = 5 + (p * 2)
        content_obj_id = page_obj_id + 1
        page_refs.append(f"{page_obj_id} 0 R")

    pages_kids_str = " ".join(page_refs)
    pages_obj = f"2 0 obj\n<< /Type /Pages /Kids [{pages_kids_str}] /Count {num_pages} >>\nendobj".encode("latin-1")

    all_raw_objs = [catalog_obj, pages_obj, f1_obj, f2_obj]

    for p in range(num_pages):
        page_obj_id = 5 + (p * 2)
        content_obj_id = page_obj_id + 1

        p_obj = (
            f"{page_obj_id} 0 obj\n"
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_width} {page_height}] "
            f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> "
            f"/Contents {content_obj_id} 0 R >>\nendobj"
        ).encode("latin-1")

        c_bytes = content_objs[p]
        stream_obj = (
            f"{content_obj_id} 0 obj\n"
            f"<< /Length {len(c_bytes)} >>\nstream\n"
        ).encode("latin-1") + c_bytes + b"\nendstream\nendobj"

        all_raw_objs.append(p_obj)
        all_raw_objs.append(stream_obj)

    # Build Cross-Reference Table
    out = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    xref = [0]
    for o in all_raw_objs:
        xref.append(len(out))
        out += o + b"\n"

    startxref = len(out)
    out += b"xref\n0 " + str(len(all_raw_objs) + 1).encode("latin-1") + b"\n0000000000 65535 f \n"
    for x in xref[1:]:
        out += f"{x:010d} 00000 n \n".encode("latin-1")

    out += (
        b"trailer\n<< /Size " + str(len(all_raw_objs) + 1).encode("latin-1") +
        b" /Root 1 0 R >>\nstartxref\n" + str(startxref).encode("latin-1") + b"\n%%EOF"
    )
    return out


def generate_attendance_csv(db: Session, company_id: int, date_str: str) -> Tuple[str, str]:
    """Generates a CSV attendance roster for the specified company and date."""
    company = db.query(Company).filter(Company.id == company_id).first()
    company_name = company.name if company else "Company"

    records = (
        db.query(AttendanceRecord, User)
        .join(User, AttendanceRecord.user_id == User.id)
        .filter(User.company_id == company_id, AttendanceRecord.date == date_str)
        .order_by(User.employee_code.asc())
        .all()
    )

    output = io.StringIO()
    output.write(f"# FlowPeople by FlowCraft - Official Attendance Roster\n")
    output.write(f"# Organization: {company_name}\n")
    output.write(f"# Date: {date_str}\n")
    output.write(f"# Generated At: {datetime.now(timezone.utc).isoformat()}\n\n")

    writer = csv.writer(output)
    writer.writerow([
        "Employee Code", "Full Name", "Department", "Status",
        "First Check-In", "Last Check-Out", "Work Minutes", "Late Minutes", "Verification Method"
    ])

    for att, user in records:
        writer.writerow([
            user.employee_code,
            f"{user.first_name} {user.last_name}",
            user.department.name if user.department else "General",
            att.status,
            att.first_check_in.strftime("%H:%M:%S") if att.first_check_in else "--",
            att.last_check_out.strftime("%H:%M:%S") if att.last_check_out else "--",
            att.total_work_minutes or 0,
            att.late_in_minutes or 0,
            getattr(att, "verification_method", "FACE") or "FACE"
        ])

    file_name = f"Attendance_Roster_{date_str}.csv"
    return file_name, output.getvalue()


def generate_attendance_pdf(db: Session, company_id: int, date_str: str) -> Tuple[str, bytes]:
    """Generates an official PDF attendance roster for the specified company and date."""
    company = db.query(Company).filter(Company.id == company_id).first()
    company_name = company.name if company else "FlowPeople Workspace"

    records = (
        db.query(AttendanceRecord, User)
        .join(User, AttendanceRecord.user_id == User.id)
        .filter(User.company_id == company_id, AttendanceRecord.date == date_str)
        .order_by(User.employee_code.asc())
        .all()
    )

    total_count = len(records)
    present_count = sum(1 for att, _ in records if att.status in [AttendanceStatus.PRESENT.value, AttendanceStatus.HALF_DAY.value])
    absent_count = sum(1 for att, _ in records if att.status == AttendanceStatus.ABSENT.value)
    late_count = sum(1 for att, _ in records if (att.late_in_minutes or 0) > 0)
    leave_count = sum(1 for att, _ in records if att.status == AttendanceStatus.ON_LEAVE.value)

    kpis = [
        ("Total Tracked", str(total_count)),
        ("Present", str(present_count)),
        ("On Leave", str(leave_count)),
        ("Absent", str(absent_count)),
        ("Late Arrivals", str(late_count))
    ]

    headers = [
        "Emp Code", "Full Name", "Department", "Date",
        "Clock In", "Clock Out", "Duration", "Status", "Biometric Method"
    ]

    rows = []
    for att, user in records:
        hrs = (att.total_work_minutes or 0) // 60
        mins = (att.total_work_minutes or 0) % 60
        rows.append([
            user.employee_code or "FP-EMP",
            f"{user.first_name} {user.last_name}",
            user.department.name if user.department else "General",
            att.date,
            att.first_check_in.strftime("%H:%M") if att.first_check_in else "--",
            att.last_check_out.strftime("%H:%M") if att.last_check_out else "--",
            f"{hrs}h {mins}m",
            att.status,
            getattr(att, "verification_method", "FACE") or "FACE"
        ])

    pdf_bytes = _build_pdf_document(
        title="Official Daily Attendance Roster",
        subtitle=f"Verification Report for {date_str}",
        company_name=company_name,
        kpis=kpis,
        headers=headers,
        rows=rows
    )
    file_name = f"Attendance_Report_{date_str}.pdf"
    return file_name, pdf_bytes


def generate_monthly_attendance_csv(db: Session, company_id: int, year: int, month: int) -> Tuple[str, str]:
    """Generates a full monthly attendance summary in CSV format."""
    company = db.query(Company).filter(Company.id == company_id).first()
    company_name = company.name if company else "Company"

    prefix = f"{year}-{month:02d}"
    records = (
        db.query(AttendanceRecord, User)
        .join(User, AttendanceRecord.user_id == User.id)
        .filter(User.company_id == company_id, AttendanceRecord.date.like(f"{prefix}%"))
        .order_by(AttendanceRecord.date.asc(), User.employee_code.asc())
        .all()
    )

    output = io.StringIO()
    output.write(f"# FlowPeople by FlowCraft - Monthly Attendance Summary\n")
    output.write(f"# Organization: {company_name}\n")
    output.write(f"# Month: {prefix}\n\n")

    writer = csv.writer(output)
    writer.writerow(["Date", "Employee Code", "Full Name", "Department", "Status", "Total Minutes", "Late Minutes"])

    for att, user in records:
        writer.writerow([
            att.date,
            user.employee_code,
            f"{user.first_name} {user.last_name}",
            user.department.name if user.department else "General",
            att.status,
            att.total_work_minutes or 0,
            att.late_in_minutes or 0
        ])

    file_name = f"Monthly_Attendance_{prefix}.csv"
    return file_name, output.getvalue()


def generate_leave_report_csv(db: Session, company_id: int) -> Tuple[str, str]:
    """Generates leave requests summary CSV."""
    company = db.query(Company).filter(Company.id == company_id).first()
    company_name = company.name if company else "Company"

    leaves = (
        db.query(LeaveRequest, User)
        .join(User, LeaveRequest.user_id == User.id)
        .filter(User.company_id == company_id)
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )

    output = io.StringIO()
    output.write(f"# FlowPeople by FlowCraft - Leave Requests & Approvals\n")
    output.write(f"# Organization: {company_name}\n\n")

    writer = csv.writer(output)
    writer.writerow(["Request ID", "Employee Code", "Full Name", "From Date", "To Date", "Days", "Type", "Status", "Reason"])

    for req, user in leaves:
        writer.writerow([
            req.id,
            user.employee_code,
            f"{user.first_name} {user.last_name}",
            req.from_date,
            req.to_date,
            req.total_days,
            req.leave_type.name if req.leave_type else "Leave",
            req.status,
            req.reason or ""
        ])

    file_name = f"Leave_Summary_Report_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.csv"
    return file_name, output.getvalue()


def generate_payroll_report_csv(db: Session, company_id: int) -> Tuple[str, str]:
    """Generates payroll payslips summary CSV."""
    company = db.query(Company).filter(Company.id == company_id).first()
    company_name = company.name if company else "Company"

    payslips = (
        db.query(Payslip, User)
        .join(User, Payslip.user_id == User.id)
        .filter(User.company_id == company_id)
        .order_by(Payslip.created_at.desc())
        .all()
    )

    output = io.StringIO()
    output.write(f"# FlowPeople by FlowCraft - Payroll & Payslip Summary\n")
    output.write(f"# Organization: {company_name}\n\n")

    writer = csv.writer(output)
    writer.writerow(["Payslip ID", "Employee Code", "Full Name", "Gross Pay", "Deductions", "Net Pay", "Status"])

    for p, user in payslips:
        writer.writerow([
            p.id,
            user.employee_code,
            f"{user.first_name} {user.last_name}",
            p.gross_earnings or 0.0,
            p.total_deductions or 0.0,
            p.net_pay or 0.0,
            p.status
        ])

    file_name = f"Payroll_Summary_Report_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.csv"
    return file_name, output.getvalue()
