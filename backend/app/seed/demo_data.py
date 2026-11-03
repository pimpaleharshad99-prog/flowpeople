import os
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.company import Company, Branch, Department, Designation, Holiday, CompanySettings
from app.models.user import User, UserRole, EmploymentStatus, EmploymentType
from app.models.shift import Shift, ShiftAssignment
from app.models.attendance import AttendanceRecord, AttendancePunch, AttendanceStatus, PunchType
from app.models.leave import LeaveType, LeaveBalance, LeaveRequest, LeaveStatus
from app.models.timetracker import Project, Task, ProjectMember, TimeLog, Timesheet, TimesheetStatus
from app.models.common import EmployeeDocument, Announcement, HRTicket, TicketStatus, TicketPriority
from app.models.biometrics import FaceEnrollment, FaceVerificationLog, BiometricEnrollmentStatus
from app.models.performance import Goal, PerformanceReview, GoalStatus, ReviewStatus
from app.models.lifecycle import OnboardingTask, LifecycleRecord, OnboardingCategory, LifecycleStage
import json

def seed_database():
    print("Dropping existing tables and recreating schema...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    try:
        print("1. Creating Company...")
        company = Company(
            name="FlowCraft Technologies Inc.",
            code="FLOWCRAFT",
            domain="flowcraft.io",
            timezone="America/New_York",
            currency="USD",
            logo_url="https://images.unsplash.com/photo-1542744094-24638eff58bb?w=128&auto=format&fit=crop&q=80"
        )
        db.add(company)
        db.flush()

        settings = CompanySettings(
            company_id=company.id,
            work_hours_per_day=8.0,
            working_days="Monday,Tuesday,Wednesday,Thursday,Friday"
        )
        db.add(settings)

        print("1b. Creating Office Branches with Geofencing...")
        branch_hq = Branch(
            company_id=company.id,
            name="San Francisco Headquarters",
            code="SF-HQ",
            address="500 Howard Street, Suite 400",
            city="San Francisco",
            state="CA",
            country="United States",
            postal_code="94105",
            timezone="America/Los_Angeles",
            latitude=37.7891,
            longitude=-122.3995,
            geofence_radius_meters=200,
            is_geofence_enforced=True,
            is_headquarters=True
        )
        branch_nyc = Branch(
            company_id=company.id,
            name="New York Innovation Center",
            code="NYC-01",
            address="1 World Trade Center, Floor 45",
            city="New York",
            state="NY",
            country="United States",
            postal_code="10007",
            timezone="America/New_York",
            latitude=40.7130,
            longitude=-74.0132,
            geofence_radius_meters=150,
            is_geofence_enforced=True,
            is_headquarters=False
        )
        branch_ldn = Branch(
            company_id=company.id,
            name="London Engineering Hub",
            code="LDN-01",
            address="100 Bishopsgate",
            city="London",
            state="Greater London",
            country="United Kingdom",
            postal_code="EC2N 4AG",
            timezone="Europe/London",
            latitude=51.5152,
            longitude=-0.0822,
            geofence_radius_meters=180,
            is_geofence_enforced=True,
            is_headquarters=False
        )
        db.add_all([branch_hq, branch_nyc, branch_ldn])
        db.flush()

        print("2. Creating Departments...")
        dept_eng = Department(company_id=company.id, name="Engineering", code="ENG", description="Software Engineering & Cloud Infrastructure")
        dept_hr = Department(company_id=company.id, name="People & Culture (HR)", code="HR", description="Talent Acquisition & Employee Happiness")
        dept_prod = Department(company_id=company.id, name="Product & Design", code="PROD", description="UI/UX & Product Strategy")
        dept_sales = Department(company_id=company.id, name="Sales & Growth", code="SALES", description="Global Enterprise Sales")
        
        db.add_all([dept_eng, dept_hr, dept_prod, dept_sales])
        db.flush()

        print("3. Creating Designations...")
        desig_vp = Designation(company_id=company.id, department_id=dept_eng.id, name="VP of Engineering", code="VP-ENG")
        desig_em = Designation(company_id=company.id, department_id=dept_eng.id, name="Engineering Manager", code="ENG-MGR")
        desig_sr_dev = Designation(company_id=company.id, department_id=dept_eng.id, name="Lead Fullstack Engineer", code="SR-ENG")
        desig_fe_dev = Designation(company_id=company.id, department_id=dept_eng.id, name="Senior Frontend Specialist", code="FE-ENG")
        desig_hr_dir = Designation(company_id=company.id, department_id=dept_hr.id, name="HR Director", code="HR-DIR")
        desig_lead_recruiter = Designation(company_id=company.id, department_id=dept_hr.id, name="People Operations Lead", code="PO-LEAD")
        desig_prod_lead = Designation(company_id=company.id, department_id=dept_prod.id, name="Principal Product Designer", code="PR-DES")
        desig_sales_lead = Designation(company_id=company.id, department_id=dept_sales.id, name="Enterprise Account Executive", code="SR-AE")

        db.add_all([
            desig_vp, desig_em, desig_sr_dev, desig_fe_dev,
            desig_hr_dir, desig_lead_recruiter, desig_prod_lead, desig_sales_lead
        ])
        db.flush()

        print("4. Creating Shifts...")
        shift_general = Shift(
            company_id=company.id,
            name="General Day Shift",
            code="GEN-01",
            start_time="09:00",
            end_time="18:00",
            expected_work_hours=480,
            break_duration_mins=60,
            grace_period_mins=15,
            early_exit_allowance_mins=15,
            half_day_threshold_mins=240,
            is_default=True,
            color="#3B82F6"
        )
        shift_morning = Shift(
            company_id=company.id,
            name="Early Bird Shift",
            code="EARLY-02",
            start_time="07:00",
            end_time="16:00",
            expected_work_hours=480,
            break_duration_mins=60,
            grace_period_mins=15,
            early_exit_allowance_mins=15,
            is_default=False,
            color="#10B981"
        )
        shift_night = Shift(
            company_id=company.id,
            name="Night Owl Shift",
            code="NIGHT-03",
            start_time="20:00",
            end_time="05:00",
            expected_work_hours=480,
            break_duration_mins=60,
            is_night_shift=True,
            is_default=False,
            color="#6366F1"
        )
        db.add_all([shift_general, shift_morning, shift_night])
        db.flush()

        print("5. Creating Holidays...")
        holidays = [
            Holiday(company_id=company.id, name="New Year's Day", holiday_date="2026-01-01", description="Global Holiday"),
            Holiday(company_id=company.id, name="Memorial Day", holiday_date="2026-05-25", description="Public Holiday"),
            Holiday(company_id=company.id, name="Independence Day", holiday_date="2026-07-04", description="National Holiday"),
            Holiday(company_id=company.id, name="Labor Day", holiday_date="2026-09-07", description="Federal Holiday"),
            Holiday(company_id=company.id, name="Thanksgiving Day", holiday_date="2026-11-26", description="Annual Celebration"),
            Holiday(company_id=company.id, name="Christmas Day", holiday_date="2026-12-25", description="Winter Holiday")
        ]
        db.add_all(holidays)

        print("6. Creating Leave Types...")
        lt_cl = LeaveType(company_id=company.id, name="Casual Leave", code="CL", annual_quota=12.0, color="#10B981", description="General planned leaves")
        lt_sl = LeaveType(company_id=company.id, name="Sick Leave", code="SL", annual_quota=10.0, color="#EF4444", description="Medical leave")
        lt_pl = LeaveType(company_id=company.id, name="Privilege / Earned Leave", code="PL", annual_quota=15.0, carry_forward_limit=10.0, color="#3B82F6", description="Annual paid vacation")
        lt_mat = LeaveType(company_id=company.id, name="Parental / Maternity Leave", code="PAR", annual_quota=30.0, color="#8B5CF6", description="Parental care leave")
        db.add_all([lt_cl, lt_sl, lt_pl, lt_mat])
        db.flush()

        print("7. Creating Users / Employees...")
        # Unique Passwords per Employee / Role
        pwd_admin = get_password_hash("Admin@EMP001")
        pwd_hr = get_password_hash("HR@EMP002")
        pwd_manager = get_password_hash("Manager@EMP003")
        pwd_alex = get_password_hash("Alex@EMP004")
        pwd_priya = get_password_hash("Priya@EMP005")
        pwd_marcus = get_password_hash("Marcus@EMP006")
        pwd_chloe = get_password_hash("Chloe@EMP007")

        # 1. Super Admin
        user_admin = User(
            company_id=company.id,
            branch_id=branch_hq.id,
            employee_code="EMP-001",
            email="admin@acme.corp",
            hashed_password=pwd_admin,
            first_name="Sarah",
            last_name="Connor",
            role=UserRole.SUPER_ADMIN.value,
            is_platform_owner=True,
            status=EmploymentStatus.ACTIVE.value,
            shift_id=shift_general.id,
            department_id=dept_hr.id,
            designation_id=desig_hr_dir.id,
            date_of_joining="2021-01-15",
            avatar_url="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
            phone="+1 (555) 019-2831",
            gender="Female"
        )
        db.add(user_admin)
        db.flush()

        # 2. HR Admin
        user_hr = User(
            company_id=company.id,
            branch_id=branch_hq.id,
            employee_code="EMP-002",
            email="hr@acme.corp",
            hashed_password=pwd_hr,
            first_name="David",
            last_name="Vance",
            role=UserRole.HR_ADMIN.value,
            status=EmploymentStatus.ACTIVE.value,
            shift_id=shift_general.id,
            department_id=dept_hr.id,
            designation_id=desig_lead_recruiter.id,
            manager_id=user_admin.id,
            date_of_joining="2022-08-01",
            avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
            phone="+1 (555) 012-4411",
            gender="Male"
        )
        db.add(user_hr)
        db.flush()

        # 3. Engineering Manager
        user_manager = User(
            company_id=company.id,
            branch_id=branch_hq.id,
            employee_code="EMP-003",
            email="manager@acme.corp",
            hashed_password=pwd_manager,
            first_name="Elena",
            last_name="Rostova",
            role=UserRole.MANAGER.value,
            status=EmploymentStatus.ACTIVE.value,
            shift_id=shift_general.id,
            department_id=dept_eng.id,
            designation_id=desig_em.id,
            manager_id=user_admin.id,
            date_of_joining="2022-03-01",
            avatar_url="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
            phone="+1 (555) 018-7294",
            gender="Female"
        )
        db.add(user_manager)
        db.flush()

        # 4. Employee: Alex Mercer (Lead Fullstack)
        user_alex = User(
            company_id=company.id,
            branch_id=branch_hq.id,
            employee_code="EMP-004",
            email="alex@acme.corp",
            hashed_password=pwd_alex,
            first_name="Alex",
            last_name="Mercer",
            role=UserRole.EMPLOYEE.value,
            status=EmploymentStatus.ACTIVE.value,
            shift_id=shift_general.id,
            department_id=dept_eng.id,
            designation_id=desig_sr_dev.id,
            manager_id=user_manager.id,
            date_of_joining="2023-06-15",
            avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
            phone="+1 (555) 014-9988",
            gender="Male"
        )

        # 5. Employee: Priya Sharma (Frontend Specialist)
        user_priya = User(
            company_id=company.id,
            branch_id=branch_ldn.id,
            employee_code="EMP-005",
            email="priya@acme.corp",
            hashed_password=pwd_priya,
            first_name="Priya",
            last_name="Sharma",
            role=UserRole.EMPLOYEE.value,
            status=EmploymentStatus.ACTIVE.value,
            shift_id=shift_general.id,
            department_id=dept_eng.id,
            designation_id=desig_fe_dev.id,
            manager_id=user_manager.id,
            date_of_joining="2024-02-10",
            avatar_url="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
            phone="+1 (555) 017-3321",
            gender="Female"
        )

        # 6. Employee: Marcus Vance (Enterprise Sales Lead)
        user_marcus = User(
            company_id=company.id,
            branch_id=branch_nyc.id,
            employee_code="EMP-006",
            email="marcus@acme.corp",
            hashed_password=pwd_marcus,
            first_name="Marcus",
            last_name="Vance",
            role=UserRole.EMPLOYEE.value,
            status=EmploymentStatus.ACTIVE.value,
            shift_id=shift_general.id,
            department_id=dept_sales.id,
            designation_id=desig_sales_lead.id,
            manager_id=user_admin.id,
            date_of_joining="2024-05-01",
            avatar_url="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
            phone="+1 (555) 019-8833",
            gender="Male"
        )

        # 7. Employee: Chloe Bennett (Principal Product Designer)
        user_chloe = User(
            company_id=company.id,
            branch_id=branch_hq.id,
            employee_code="EMP-007",
            email="chloe@acme.corp",
            hashed_password=pwd_chloe,
            first_name="Chloe",
            last_name="Bennett",
            role=UserRole.EMPLOYEE.value,
            status=EmploymentStatus.ACTIVE.value,
            shift_id=shift_general.id,
            department_id=dept_prod.id,
            designation_id=desig_prod_lead.id,
            manager_id=user_manager.id,
            date_of_joining="2024-07-15",
            avatar_url="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
            phone="+1 (555) 013-6622",
            gender="Female"
        )

        db.add_all([user_alex, user_priya, user_marcus, user_chloe])
        db.flush()

        all_users = [user_admin, user_hr, user_manager, user_alex, user_priya, user_marcus, user_chloe]

        print("8. Assigning Default Shifts & Leave Balances for 2026...")
        for u in all_users:
            # Shift assignment
            db.add(ShiftAssignment(user_id=u.id, shift_id=shift_general.id, start_date="2026-01-01"))
            # Leave Balances
            db.add(LeaveBalance(user_id=u.id, leave_type_id=lt_cl.id, year=2026, allocated=12.0, used=2.0, pending_approval=0.0, balance=10.0))
            db.add(LeaveBalance(user_id=u.id, leave_type_id=lt_sl.id, year=2026, allocated=10.0, used=1.0, pending_approval=0.0, balance=9.0))
            db.add(LeaveBalance(user_id=u.id, leave_type_id=lt_pl.id, year=2026, allocated=15.0, used=3.0, pending_approval=0.0, balance=12.0))

        db.flush()

        print("9. Creating Sample Attendance Records & Punches...")
        now = datetime.now(timezone.utc)
        today_str = now.strftime("%Y-%m-%d")

        # Today's punch for Elena Rostova (Checked In at 09:05 AM)
        elena_record = AttendanceRecord(
            user_id=user_manager.id,
            date=today_str,
            shift_id=shift_general.id,
            first_check_in=now.replace(hour=9, minute=5, second=0),
            status=AttendanceStatus.PRESENT.value,
            total_work_minutes=150,
            late_in_minutes=5
        )
        db.add(elena_record)
        db.flush()
        db.add(AttendancePunch(
            attendance_record_id=elena_record.id,
            punch_time=now.replace(hour=9, minute=5, second=0),
            punch_type=PunchType.IN.value,
            location_note="San Francisco HQ - Wi-Fi"
        ))

        # Yesterday's full day attendance for Priya
        yesterday_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        priya_yesterday = AttendanceRecord(
            user_id=user_priya.id,
            date=yesterday_str,
            shift_id=shift_general.id,
            first_check_in=(now - timedelta(days=1)).replace(hour=8, minute=55, second=0),
            last_check_out=(now - timedelta(days=1)).replace(hour=18, minute=10, second=0),
            total_work_minutes=495,
            total_break_minutes=60,
            overtime_minutes=15,
            status=AttendanceStatus.PRESENT.value
        )
        db.add(priya_yesterday)

        print("10. Creating Sample Leave Requests...")
        req1 = LeaveRequest(
            user_id=user_alex.id,
            leave_type_id=lt_cl.id,
            from_date=(now + timedelta(days=5)).strftime("%Y-%m-%d"),
            to_date=(now + timedelta(days=6)).strftime("%Y-%m-%d"),
            day_count=2.0,
            reason="Attending family gathering in Boston",
            status=LeaveStatus.PENDING.value
        )
        req2 = LeaveRequest(
            user_id=user_priya.id,
            leave_type_id=lt_pl.id,
            from_date=(now - timedelta(days=10)).strftime("%Y-%m-%d"),
            to_date=(now - timedelta(days=8)).strftime("%Y-%m-%d"),
            day_count=3.0,
            reason="Annual vacation trip",
            status=LeaveStatus.APPROVED.value
        )
        db.add_all([req1, req2])

        print("11. Creating Projects, Tasks & Time Logs...")
        proj1 = Project(
            company_id=company.id,
            name="FlowPeople Core Platform Launch",
            code="FLOW-2026",
            client_name="FlowCraft Ecosystem",
            budget_hours=500.0
        )
        proj2 = Project(
            company_id=company.id,
            name="Mobile Attendance & Geofencing Terminal",
            code="FLOW-MOB",
            client_name="FlowCraft Mobile Labs",
            budget_hours=350.0
        )
        db.add_all([proj1, proj2])
        db.flush()

        task1 = Task(project_id=proj1.id, name="Frontend UI & Component Library", billable=True, estimated_hours=120.0)
        task2 = Task(project_id=proj1.id, name="REST API & Database Engine", billable=True, estimated_hours=140.0)
        task3 = Task(project_id=proj2.id, name="GPS & Geofencing SDK", billable=True, estimated_hours=80.0)
        db.add_all([task1, task2, task3])
        db.flush()

        log1 = TimeLog(
            user_id=user_alex.id,
            project_id=proj1.id,
            task_id=task2.id,
            log_date=yesterday_str,
            hours=6.5,
            description="Implemented Attendance punch calculation service & shift matching"
        )
        log2 = TimeLog(
            user_id=user_alex.id,
            project_id=proj1.id,
            task_id=task1.id,
            log_date=yesterday_str,
            hours=2.0,
            description="Built live timer widget and attendance clock component"
        )
        db.add_all([log1, log2])

        print("12. Creating Announcements...")
        ann1 = Announcement(
            company_id=company.id,
            author_id=user_admin.id,
            title="FlowPeople Platform Launch & All-Hands Presentation",
            content="Welcome to FlowPeople by FlowCraft: People First. Work Smarter. Join us this Thursday at 3:00 PM EST for our quarterly company-wide presentation covering our new workforce management suite.",
            priority="IMPORTANT"
        )
        ann2 = Announcement(
            company_id=company.id,
            author_id=user_hr.id,
            title="FlowCraft Open Enrollment for Health Benefits",
            content="Health insurance open enrollment is now live on FlowPeople. Please review your plan selections before the end of the month.",
            priority="NORMAL"
        )
        db.add_all([ann1, ann2])

        print("13. Creating Biometric Face ID Enrollments & Audit Logs...")
        mock_vector = json.dumps([round(0.05 * ((i % 17) - 8), 4) for i in range(128)])
        now_dt = datetime.now(timezone.utc)
        
        for u in all_users:
            fe = FaceEnrollment(
                user_id=u.id,
                consent_given=True,
                consent_timestamp=now_dt - timedelta(days=60),
                face_template=mock_vector,
                template_version="v2.0-facenet-norm",
                status=BiometricEnrollmentStatus.VERIFIED.value,
                quality_score=0.96,
                liveness_verified=True,
                enrolled_at=now_dt - timedelta(days=60),
                updated_at=now_dt - timedelta(days=60)
            )
            db.add(fe)

            flog = FaceVerificationLog(
                user_id=u.id,
                attempt_type="CHECK_IN",
                status="SUCCESS",
                confidence_score=0.94,
                liveness_score=0.92,
                ip_address="127.0.0.1",
                device_info="FlowPeople Face ID Terminal",
                timestamp=now_dt - timedelta(hours=3)
            )
            db.add(flog)

        print("14. Creating Performance Goals & OKRs...")
        g1 = Goal(
            company_id=company.id,
            user_id=user_alex.id,
            title="Implement Face ID Anti-Spoof Biometric Pipeline",
            description="Build real-time camera capture, anti-spoof liveness challenge and server-side facial feature matching.",
            kpi_metric="Verification Accuracy & Latency",
            target_value=100.0,
            current_value=92.0,
            unit="%",
            status=GoalStatus.IN_PROGRESS.value,
            due_date="2026-11-30"
        )
        g2 = Goal(
            company_id=company.id,
            user_id=user_alex.id,
            title="Complete Super Admin & Multi-Tenant Portal Architecture",
            description="Provide company management, system health observability and cross-tenant auditing.",
            kpi_metric="Portals Delivered",
            target_value=100.0,
            current_value=100.0,
            unit="%",
            status=GoalStatus.ACHIEVED.value,
            due_date="2026-10-31"
        )
        g3 = Goal(
            company_id=company.id,
            user_id=user_manager.id,
            title="Maintain 99.5% Sprint Delivery & Zero High Severity Defects",
            description="Lead engineering team sprint planning, code review rigor, and architectural compliance.",
            kpi_metric="Sprint Velocity Index",
            target_value=100.0,
            current_value=96.0,
            unit="%",
            status=GoalStatus.IN_PROGRESS.value,
            due_date="2026-12-31"
        )
        db.add_all([g1, g2, g3])

        print("15. Creating Performance Reviews...")
        pr1 = PerformanceReview(
            company_id=company.id,
            user_id=user_alex.id,
            reviewer_id=user_manager.id,
            cycle_name="Q3-Q4 2026 Bi-Annual Appraisal",
            self_assessment="Delivered core HRMS modules, time tracker, and designed the real-time biometric verification pipeline ahead of schedule.",
            manager_feedback="Exceptional work quality, technical autonomy, and leadership across frontend and backend implementations.",
            rating=4.9,
            status=ReviewStatus.COMPLETED.value,
            completed_at=now_dt - timedelta(days=5)
        )
        db.add(pr1)

        print("16. Creating Onboarding Tasks & Lifecycle Records...")
        tasks = [
            OnboardingTask(
                company_id=company.id,
                user_id=user_alex.id,
                title="Verify National Identity and Tax Documents",
                category=OnboardingCategory.DOCUMENTS.value,
                is_completed=True,
                completed_at=now_dt - timedelta(days=200),
                due_date="2025-01-20"
            ),
            OnboardingTask(
                company_id=company.id,
                user_id=user_alex.id,
                title="Biometric Face ID Enrollment & Camera Test",
                category=OnboardingCategory.IT_SETUP.value,
                is_completed=True,
                completed_at=now_dt - timedelta(days=199),
                due_date="2025-01-22"
            ),
            OnboardingTask(
                company_id=company.id,
                user_id=user_alex.id,
                title="Engineering Security & GDPR Compliance Orientation",
                category=OnboardingCategory.TRAINING.value,
                is_completed=True,
                completed_at=now_dt - timedelta(days=190),
                due_date="2025-01-30"
            ),
            OnboardingTask(
                company_id=company.id,
                user_id=user_alex.id,
                title="Quarterly Mentorship Sync & 360 Feedback",
                category=OnboardingCategory.ORIENTATION.value,
                is_completed=False,
                due_date="2026-12-15",
                notes="Scheduled with Elena Rostova"
            )
        ]
        db.add_all(tasks)

        lc1 = LifecycleRecord(
            user_id=user_alex.id,
            stage=LifecycleStage.ONBOARDING.value,
            effective_date="2025-01-15",
            notes="Initial joining as Lead Fullstack Engineer",
            created_by_id=user_hr.id
        )
        lc2 = LifecycleRecord(
            user_id=user_alex.id,
            stage=LifecycleStage.CONFIRMED.value,
            effective_date="2025-04-15",
            notes="Successfully completed 90-day probation period with outstanding marks",
            created_by_id=user_hr.id
        )
        db.add_all([lc1, lc2])

        print("17. Creating HR Helpdesk Tickets...")
        tk1 = HRTicket(
            user_id=user_alex.id,
            category="IT Equipment",
            subject="Dual 4K Monitor Arm and Ergonomic Keyboard Request",
            description="Requesting dual monitor desk mounts for local workstation setup.",
            priority=TicketPriority.MEDIUM.value,
            status=TicketStatus.RESOLVED.value,
            assigned_to_id=user_hr.id,
            resolution_notes="Approved and shipped by IT Operations.",
            resolved_at=now_dt - timedelta(days=10)
        )
        tk2 = HRTicket(
            user_id=user_alex.id,
            category="Benefits",
            subject="International Health Insurance Travel Endorsement",
            description="Need insurance certification for upcoming tech conference in Europe.",
            priority=TicketPriority.HIGH.value,
            status=TicketStatus.IN_PROGRESS.value,
            assigned_to_id=user_hr.id
        )
        db.add_all([tk1, tk2])

        db.commit()
        print("SEEDING COMPLETED SUCCESSFULLY!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()

