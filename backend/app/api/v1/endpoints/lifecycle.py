from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel

from app.core.database import get_db
from app.models.lifecycle import OnboardingTask, LifecycleRecord, OnboardingCategory, LifecycleStage
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_admin

router = APIRouter()

class OnboardingTaskCreate(BaseModel):
    user_id: int
    title: str
    category: Optional[str] = "DOCUMENTS"
    due_date: Optional[str] = None
    notes: Optional[str] = None

class LifecycleTransitionRequest(BaseModel):
    user_id: int
    stage: str
    effective_date: str
    notes: Optional[str] = None

@router.get("/tasks")
def list_onboarding_tasks(
    user_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(OnboardingTask).filter(OnboardingTask.company_id == current_user.company_id)
    if current_user.role == UserRole.EMPLOYEE.value:
        query = query.filter(OnboardingTask.user_id == current_user.id)
    elif user_id:
        query = query.filter(OnboardingTask.user_id == user_id)

    tasks = query.order_by(OnboardingTask.created_at.asc()).all()
    return [
        {
            "id": t.id,
            "user_id": t.user_id,
            "employee_name": t.user.full_name if t.user else "Unknown",
            "title": t.title,
            "category": t.category,
            "is_completed": t.is_completed,
            "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            "due_date": t.due_date,
            "notes": t.notes
        }
        for t in tasks
    ]

@router.post("/tasks")
def create_onboarding_task(
    req: OnboardingTaskCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    target = db.query(User).filter(User.id == req.user_id, User.company_id == current_user.company_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Employee not found")

    task = OnboardingTask(
        company_id=current_user.company_id,
        user_id=target.id,
        title=req.title,
        category=req.category or OnboardingCategory.DOCUMENTS.value,
        due_date=req.due_date,
        notes=req.notes
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"success": True, "task_id": task.id}

@router.put("/tasks/{task_id}/toggle")
def toggle_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(OnboardingTask).filter(
        OnboardingTask.id == task_id,
        OnboardingTask.company_id == current_user.company_id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_user.role == UserRole.EMPLOYEE.value and task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot update tasks of other employees")

    task.is_completed = not task.is_completed
    task.completed_at = datetime.now(timezone.utc) if task.is_completed else None
    db.commit()
    return {"success": True, "task_id": task.id, "is_completed": task.is_completed}

@router.get("/history/{user_id}")
def get_lifecycle_history(
    user_id: int,
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
    
    target = db.query(User).filter(User.id == user_id, User.company_id == current_user.company_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Authorization boundary: employees can only view own; managers can view direct reports or own; admins can view all in company
    if current_user.role == UserRole.EMPLOYEE.value and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot view lifecycle history of other employees")
    if current_user.role == UserRole.MANAGER.value and current_user.id != user_id and target.manager_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot view lifecycle history of employees outside your reporting line")

    records = db.query(LifecycleRecord).filter(LifecycleRecord.user_id == user_id)\
        .order_by(LifecycleRecord.created_at.desc()).all()

    return [
        {
            "id": r.id,
            "stage": r.stage,
            "effective_date": r.effective_date,
            "notes": r.notes,
            "created_by": r.created_by.full_name if r.created_by else "System",
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in records
    ]

@router.post("/transition")
def record_lifecycle_transition(
    req: LifecycleTransitionRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    target = db.query(User).filter(User.id == req.user_id, User.company_id == current_user.company_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Employee not found")

    rec = LifecycleRecord(
        user_id=target.id,
        stage=req.stage,
        effective_date=req.effective_date,
        notes=req.notes,
        created_by_id=current_user.id
    )
    db.add(rec)
    db.commit()
    return {"success": True, "stage": req.stage, "employee": target.full_name}

