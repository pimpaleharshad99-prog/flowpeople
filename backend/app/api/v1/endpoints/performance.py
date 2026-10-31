from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel

from app.core.database import get_db
from app.models.performance import Goal, PerformanceReview, GoalStatus, ReviewStatus
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_manager_or_above

router = APIRouter()

class GoalCreate(BaseModel):
    user_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    kpi_metric: Optional[str] = None
    target_value: Optional[float] = 100.0
    current_value: Optional[float] = 0.0
    unit: Optional[str] = "%"
    due_date: str

class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    target_value: Optional[float] = None
    current_value: Optional[float] = None
    status: Optional[str] = None
    due_date: Optional[str] = None

class ReviewCreate(BaseModel):
    user_id: int
    cycle_name: Optional[str] = "Q4 2026 Annual Performance Review"
    self_assessment: Optional[str] = None
    manager_feedback: Optional[str] = None
    rating: Optional[float] = 4.0

class ReviewUpdate(BaseModel):
    self_assessment: Optional[str] = None
    manager_feedback: Optional[str] = None
    rating: Optional[float] = None
    status: Optional[str] = None

@router.get("/goals")
def list_goals(
    user_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Goal).filter(Goal.company_id == current_user.company_id)
    # If not manager/admin, restrict to self
    if current_user.role == UserRole.EMPLOYEE.value:
        query = query.filter(Goal.user_id == current_user.id)
    elif user_id:
        query = query.filter(Goal.user_id == user_id)

    goals = query.order_by(Goal.created_at.desc()).all()
    return [
        {
            "id": g.id,
            "user_id": g.user_id,
            "employee_name": g.user.full_name if g.user else "Unknown",
            "title": g.title,
            "description": g.description,
            "kpi_metric": g.kpi_metric,
            "target_value": g.target_value,
            "current_value": g.current_value,
            "unit": g.unit,
            "status": g.status,
            "due_date": g.due_date,
            "created_at": g.created_at.isoformat() if g.created_at else None
        }
        for g in goals
    ]

@router.post("/goals")
def create_goal(
    req: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_user_id = req.user_id if (req.user_id and current_user.role != UserRole.EMPLOYEE.value) else current_user.id
    target_user = db.query(User).filter(User.id == target_user_id, User.company_id == current_user.company_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Employee not found")

    goal = Goal(
        company_id=current_user.company_id,
        user_id=target_user.id,
        title=req.title,
        description=req.description,
        kpi_metric=req.kpi_metric,
        target_value=req.target_value or 100.0,
        current_value=req.current_value or 0.0,
        unit=req.unit or "%",
        status=GoalStatus.IN_PROGRESS.value,
        due_date=req.due_date
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return {"success": True, "goal_id": goal.id, "title": goal.title}

@router.put("/goals/{goal_id}")
def update_goal(
    goal_id: int,
    req: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.company_id == current_user.company_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    if current_user.role == UserRole.EMPLOYEE.value and goal.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot edit goals of other employees")

    if req.title is not None:
        goal.title = req.title
    if req.description is not None:
        goal.description = req.description
    if req.target_value is not None:
        goal.target_value = req.target_value
    if req.current_value is not None:
        goal.current_value = req.current_value
        if goal.current_value >= goal.target_value:
            goal.status = GoalStatus.ACHIEVED.value
    if req.status is not None:
        goal.status = req.status
    if req.due_date is not None:
        goal.due_date = req.due_date

    db.commit()
    db.refresh(goal)
    return {"success": True, "goal_id": goal.id, "status": goal.status, "current_value": goal.current_value}

@router.get("/reviews")
def list_reviews(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(PerformanceReview).filter(PerformanceReview.company_id == current_user.company_id)
    if current_user.role == UserRole.EMPLOYEE.value:
        query = query.filter(PerformanceReview.user_id == current_user.id)

    reviews = query.order_by(PerformanceReview.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "employee_name": r.user.full_name if r.user else "Unknown",
            "reviewer_name": r.reviewer.full_name if r.reviewer else "Pending Assignment",
            "cycle_name": r.cycle_name,
            "self_assessment": r.self_assessment,
            "manager_feedback": r.manager_feedback,
            "rating": r.rating,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in reviews
    ]

@router.post("/reviews")
def create_review(
    req: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_user = db.query(User).filter(User.id == req.user_id, User.company_id == current_user.company_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Employee not found")

    rev = PerformanceReview(
        company_id=current_user.company_id,
        user_id=target_user.id,
        reviewer_id=current_user.id if current_user.id != target_user.id else target_user.manager_id,
        cycle_name=req.cycle_name or "Q4 2026 Annual Performance Review",
        self_assessment=req.self_assessment,
        manager_feedback=req.manager_feedback,
        rating=req.rating or 4.0,
        status=ReviewStatus.SUBMITTED.value
    )
    db.add(rev)
    db.commit()
    db.refresh(rev)
    return {"success": True, "review_id": rev.id}

@router.put("/reviews/{review_id}")
def update_review(
    review_id: int,
    req: ReviewUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rev = db.query(PerformanceReview).filter(
        PerformanceReview.id == review_id,
        PerformanceReview.company_id == current_user.company_id
    ).first()
    if not rev:
        raise HTTPException(status_code=404, detail="Review not found")

    if req.self_assessment is not None:
        rev.self_assessment = req.self_assessment
    if req.manager_feedback is not None:
        rev.manager_feedback = req.manager_feedback
    if req.rating is not None:
        rev.rating = req.rating
    if req.status is not None:
        rev.status = req.status
        if req.status == ReviewStatus.COMPLETED.value:
            rev.completed_at = datetime.now(timezone.utc)

    db.commit()
    return {"success": True, "review_id": rev.id, "status": rev.status}

