from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.models.timetracker import Project, Task, TimeLog, Timesheet
from app.models.user import User
from app.schemas.timetracker import ProjectOut, TaskOut, TimeLogCreate, TimeLogOut
from app.api.deps import get_current_user

router = APIRouter()

def serialize_task(t: Task) -> TaskOut:
    return TaskOut(
        id=t.id,
        project_id=t.project_id,
        name=t.name,
        description=t.description,
        billable=bool(t.billable),
        estimated_hours=float(t.estimated_hours or 0.0),
        status=str(t.status)
    )

def serialize_project(p: Project) -> ProjectOut:
    return ProjectOut(
        id=p.id,
        name=p.name,
        code=p.code,
        client_name=p.client_name,
        description=p.description,
        budget_hours=float(p.budget_hours or 0.0),
        status=str(p.status),
        tasks=[serialize_task(t) for t in (p.tasks or [])]
    )

@router.get("/projects", response_model=List[ProjectOut])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns active projects belonging strictly to the user's company."""
    projects = db.query(Project).filter(
        Project.company_id == current_user.company_id
    ).all()
    return [serialize_project(p) for p in projects]

@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.company_id == current_user.company_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return serialize_project(project)

@router.post("/timelogs", response_model=TimeLogOut, status_code=status.HTTP_201_CREATED)
def create_timelog(
    log_in: TimeLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(
        Project.id == log_in.project_id,
        Project.company_id == current_user.company_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    new_log = TimeLog(
        company_id=current_user.company_id,
        user_id=current_user.id,
        project_id=log_in.project_id,
        task_id=log_in.task_id,
        log_date=log_in.log_date,
        hours=log_in.hours,
        description=log_in.description,
        is_billable=log_in.is_billable
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)

    return TimeLogOut(
        id=new_log.id,
        user_id=new_log.user_id,
        user_name=current_user.full_name,
        project_id=new_log.project_id,
        project_name=project.name,
        task_id=new_log.task_id,
        task_name=new_log.task.name if new_log.task else None,
        timesheet_id=new_log.timesheet_id,
        log_date=new_log.log_date,
        hours=new_log.hours,
        description=new_log.description,
        is_billable=new_log.is_billable
    )

