from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from app.core.database import get_db
from app.models.timetracker import (
    Project, Task, ProjectMember, TimeLog, Timesheet,
    ProjectStatus, TaskStatus, TimesheetStatus
)
from app.models.user import User
from app.schemas.timetracker import (
    ProjectOut, TaskOut, TimeLogCreate, TimeLogOut,
    TimesheetSubmitRequest, TimesheetAction, TimesheetOut
)
from app.api.deps import get_current_user, require_manager_or_above, require_admin

router = APIRouter()

def serialize_log(log: TimeLog) -> TimeLogOut:
    return TimeLogOut(
        id=log.id,
        user_id=log.user_id,
        user_name=log.user.full_name if log.user else None,
        project_id=log.project_id,
        project_name=log.project.name if log.project else None,
        task_id=log.task_id,
        task_name=log.task.name if log.task else None,
        timesheet_id=log.timesheet_id,
        log_date=log.log_date,
        hours=log.hours,
        description=log.description,
        is_billable=log.is_billable,
        created_at=log.created_at
    )

def serialize_project(p: Project) -> ProjectOut:
    return ProjectOut(
        id=p.id,
        name=p.name,
        code=p.code,
        client_name=p.client_name,
        description=p.description,
        budget_hours=p.budget_hours,
        status=p.status,
        tasks=[TaskOut.model_validate(t) for t in p.tasks]
    )

@router.get("/projects", response_model=List[ProjectOut])
def list_projects(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    projects = db.query(Project).filter(Project.company_id == current_user.company_id).all()
    return [serialize_project(p) for p in projects]

@router.post("/projects", response_model=ProjectOut)
def create_project(
    name: str,
    code: str,
    client_name: Optional[str] = None,
    budget_hours: float = 0.0,
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    p = Project(
        company_id=current_user.company_id,
        name=name,
        code=code,
        client_name=client_name,
        budget_hours=budget_hours
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return serialize_project(p)

@router.post("/tasks", response_model=TaskOut)
def create_task(
    project_id: int,
    name: str,
    billable: bool = True,
    estimated_hours: float = 0.0,
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.company_id == current_user.company_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found in your company")

    task = Task(
        project_id=project_id,
        name=name,
        billable=billable,
        estimated_hours=estimated_hours
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

@router.get("/logs", response_model=List[TimeLogOut])
def get_time_logs(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(TimeLog).filter(TimeLog.user_id == current_user.id)
    if start_date:
        query = query.filter(TimeLog.log_date >= start_date)
    if end_date:
        query = query.filter(TimeLog.log_date <= end_date)
    logs = query.order_by(TimeLog.log_date.desc()).all()
    return [serialize_log(l) for l in logs]

@router.post("/logs", response_model=TimeLogOut)
def create_time_log(
    log_in: TimeLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    log = TimeLog(
        user_id=current_user.id,
        project_id=log_in.project_id,
        task_id=log_in.task_id,
        log_date=log_in.log_date,
        hours=log_in.hours,
        description=log_in.description,
        is_billable=log_in.is_billable
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return serialize_log(log)

@router.get("/timesheets", response_model=List[TimesheetOut])
def get_my_timesheets(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sheets = db.query(Timesheet).filter(Timesheet.user_id == current_user.id).order_by(Timesheet.period_start.desc()).all()
    return [
        TimesheetOut(
            id=s.id,
            user_id=s.user_id,
            user_name=current_user.full_name,
            period_start=s.period_start,
            period_end=s.period_end,
            total_hours=s.total_hours,
            status=s.status,
            approver_id=s.approver_id,
            submitted_at=s.submitted_at,
            reviewed_at=s.reviewed_at,
            review_comments=s.review_comments
        )
        for s in sheets
    ]

@router.post("/timesheets/submit", response_model=TimesheetOut)
def submit_weekly_timesheet(
    sub_in: TimesheetSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Collect logs in that period
    logs = db.query(TimeLog).filter(
        TimeLog.user_id == current_user.id,
        TimeLog.log_date >= sub_in.period_start,
        TimeLog.log_date <= sub_in.period_end
    ).all()

    total_hrs = sum(l.hours for l in logs)

    sheet = db.query(Timesheet).filter(
        Timesheet.user_id == current_user.id,
        Timesheet.period_start == sub_in.period_start
    ).first()

    if not sheet:
        sheet = Timesheet(
            user_id=current_user.id,
            period_start=sub_in.period_start,
            period_end=sub_in.period_end,
            total_hours=total_hrs,
            status=TimesheetStatus.SUBMITTED.value,
            approver_id=current_user.manager_id,
            submitted_at=datetime.now(timezone.utc)
        )
        db.add(sheet)
        db.flush()
    else:
        sheet.total_hours = total_hrs
        sheet.status = TimesheetStatus.SUBMITTED.value
        sheet.submitted_at = datetime.now(timezone.utc)

    # Associate logs with timesheet
    for l in logs:
        l.timesheet_id = sheet.id

    db.commit()
    db.refresh(sheet)

    return TimesheetOut(
        id=sheet.id,
        user_id=sheet.user_id,
        user_name=current_user.full_name,
        period_start=sheet.period_start,
        period_end=sheet.period_end,
        total_hours=sheet.total_hours,
        status=sheet.status,
        approver_id=sheet.approver_id,
        submitted_at=sheet.submitted_at,
        reviewed_at=sheet.reviewed_at,
        review_comments=sheet.review_comments
    )

@router.get("/timesheets/pending", response_model=List[TimesheetOut])
def get_pending_timesheets(
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    admin_roles = ["SUPER_ADMIN", "ADMIN", "HR_ADMIN", "HR_MANAGER", "HR_EXECUTIVE", "COMPANY_ADMIN"]
    query = db.query(Timesheet).join(User, Timesheet.user_id == User.id).filter(
        User.company_id == current_user.company_id,
        Timesheet.status == TimesheetStatus.SUBMITTED.value
    )
    if current_user.role not in admin_roles:
        query = query.filter(Timesheet.approver_id == current_user.id)
    sheets = query.all()

    return [
        TimesheetOut(
            id=s.id,
            user_id=s.user_id,
            user_name=s.user.full_name if s.user else None,
            period_start=s.period_start,
            period_end=s.period_end,
            total_hours=s.total_hours,
            status=s.status,
            approver_id=s.approver_id,
            submitted_at=s.submitted_at,
            reviewed_at=s.reviewed_at,
            review_comments=s.review_comments
        )
        for s in sheets
    ]

@router.put("/timesheets/{id}/review", response_model=TimesheetOut)
def review_timesheet(
    id: int,
    action: TimesheetAction,
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    sheet = db.query(Timesheet).join(User, Timesheet.user_id == User.id).filter(
        Timesheet.id == id,
        User.company_id == current_user.company_id
    ).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Timesheet not found in your company")

    admin_roles = ["SUPER_ADMIN", "ADMIN", "HR_ADMIN", "HR_MANAGER", "HR_EXECUTIVE", "COMPANY_ADMIN"]
    if current_user.role not in admin_roles and sheet.approver_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to review timesheets for this employee")

    sheet.status = action.status.upper()
    sheet.review_comments = action.review_comments
    sheet.reviewed_at = datetime.now(timezone.utc)
    sheet.approver_id = current_user.id
    db.commit()
    db.refresh(sheet)

    return TimesheetOut(
        id=sheet.id,
        user_id=sheet.user_id,
        user_name=sheet.user.full_name if sheet.user else None,
        period_start=sheet.period_start,
        period_end=sheet.period_end,
        total_hours=sheet.total_hours,
        status=sheet.status,
        approver_id=sheet.approver_id,
        submitted_at=sheet.submitted_at,
        reviewed_at=sheet.reviewed_at,
        review_comments=sheet.review_comments
    )

