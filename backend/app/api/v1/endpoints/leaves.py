from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from app.core.database import get_db
from app.models.leave import (
    LeaveType, LeaveBalance, LeaveRequest, LeaveApproval,
    LeaveStatus, HalfDaySession
)
from app.models.user import User
from app.schemas.leave import (
    LeaveTypeOut, LeaveBalanceOut, LeaveApplyRequest,
    LeaveApprovalAction, LeaveRequestOut
)
from app.services.leave_engine import (
    calculate_working_days, check_and_deduct_leave,
    finalize_leave_approval, refund_cancelled_leave
)
from app.api.deps import get_current_user, require_manager_or_above

router = APIRouter()

def serialize_leave_request(r: LeaveRequest) -> LeaveRequestOut:
    return LeaveRequestOut(
        id=r.id,
        user_id=r.user_id,
        user_name=r.user.full_name if r.user else None,
        employee_code=r.user.employee_code if r.user else None,
        department_name=r.user.department.name if r.user and r.user.department else None,
        leave_type_id=r.leave_type_id,
        leave_type_name=r.leave_type.name,
        leave_type_code=r.leave_type.code,
        color=r.leave_type.color,
        from_date=r.from_date,
        to_date=r.to_date,
        day_count=r.day_count,
        is_half_day=r.is_half_day,
        half_day_session=r.half_day_session,
        reason=r.reason,
        status=r.status,
        document_url=r.document_url,
        created_at=r.created_at
    )

@router.get("/types", response_model=List[LeaveTypeOut])
def list_leave_types(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(LeaveType).filter(LeaveType.company_id == current_user.company_id).all()

@router.get("/my-balances", response_model=List[LeaveBalanceOut])
def get_my_balances(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_year = datetime.now(timezone.utc).year
    types = db.query(LeaveType).filter(LeaveType.company_id == current_user.company_id).all()
    
    balances_out = []
    for lt in types:
        balance = db.query(LeaveBalance).filter(
            LeaveBalance.user_id == current_user.id,
            LeaveBalance.leave_type_id == lt.id,
            LeaveBalance.year == current_year
        ).first()

        if not balance:
            # Auto initialize balance
            balance = LeaveBalance(
                user_id=current_user.id,
                leave_type_id=lt.id,
                year=current_year,
                allocated=lt.annual_quota,
                used=0.0,
                pending_approval=0.0,
                balance=lt.annual_quota
            )
            db.add(balance)
            db.commit()
            db.refresh(balance)

        balances_out.append(
            LeaveBalanceOut(
                id=balance.id,
                leave_type_id=lt.id,
                leave_type_name=lt.name,
                leave_type_code=lt.code,
                color=lt.color,
                year=balance.year,
                allocated=balance.allocated,
                used=balance.used,
                pending_approval=balance.pending_approval,
                balance=balance.balance
            )
        )
    return balances_out

@router.get("/my-requests", response_model=List[LeaveRequestOut])
def get_my_leave_requests(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    requests = db.query(LeaveRequest).filter(
        LeaveRequest.user_id == current_user.id
    ).order_by(LeaveRequest.created_at.desc()).all()
    return [serialize_leave_request(r) for r in requests]

@router.post("/apply", response_model=LeaveRequestOut)
def apply_leave(
    leave_in: LeaveApplyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        days = calculate_working_days(
            db,
            current_user.company_id,
            leave_in.from_date,
            leave_in.to_date,
            leave_in.is_half_day
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    year = int(leave_in.from_date.split("-")[0])
    success, msg, _ = check_and_deduct_leave(db, current_user.id, leave_in.leave_type_id, days, year)
    if not success:
        raise HTTPException(status_code=400, detail=msg)

    req = LeaveRequest(
        user_id=current_user.id,
        leave_type_id=leave_in.leave_type_id,
        from_date=leave_in.from_date,
        to_date=leave_in.to_date,
        day_count=days,
        is_half_day=leave_in.is_half_day,
        half_day_session=leave_in.half_day_session,
        reason=leave_in.reason,
        status=LeaveStatus.PENDING.value,
        document_url=leave_in.document_url
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    # Automatically create approval task for manager if exists
    if current_user.manager_id:
        approval = LeaveApproval(
            leave_request_id=req.id,
            approver_id=current_user.manager_id,
            tier_level=1,
            status=LeaveStatus.PENDING.value
        )
        db.add(approval)
        db.commit()

    return serialize_leave_request(req)

@router.get("/approvals", response_model=List[LeaveRequestOut])
def list_pending_approvals(
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    admin_roles = ["SUPER_ADMIN", "ADMIN", "HR_ADMIN", "HR_MANAGER", "HR_EXECUTIVE", "COMPANY_ADMIN"]
    if current_user.role in admin_roles:
        requests = db.query(LeaveRequest).join(User, LeaveRequest.user_id == User.id).filter(
            User.company_id == current_user.company_id,
            LeaveRequest.status == LeaveStatus.PENDING.value
        ).order_by(LeaveRequest.created_at.desc()).all()
    else:
        requests = db.query(LeaveRequest).join(User, LeaveRequest.user_id == User.id).filter(
            User.company_id == current_user.company_id,
            User.manager_id == current_user.id,
            LeaveRequest.status == LeaveStatus.PENDING.value
        ).order_by(LeaveRequest.created_at.desc()).all()

    return [serialize_leave_request(r) for r in requests]

@router.put("/approvals/{id}", response_model=LeaveRequestOut)
def review_leave_request(
    id: int,
    action: LeaveApprovalAction,
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    req = db.query(LeaveRequest).join(User, LeaveRequest.user_id == User.id).filter(
        LeaveRequest.id == id,
        User.company_id == current_user.company_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found in your company")

    admin_roles = ["SUPER_ADMIN", "ADMIN", "HR_ADMIN", "HR_MANAGER", "HR_EXECUTIVE", "COMPANY_ADMIN"]
    if current_user.role not in admin_roles and req.user.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to approve leaves for this employee")

    approved = (action.status.upper() == LeaveStatus.APPROVED.value)
    req.status = LeaveStatus.APPROVED.value if approved else LeaveStatus.REJECTED.value

    # Update balance
    finalize_leave_approval(db, req, approved)

    # Update or add approval record
    approval = db.query(LeaveApproval).filter(
        LeaveApproval.leave_request_id == req.id,
        LeaveApproval.approver_id == current_user.id
    ).first()
    if not approval:
        approval = LeaveApproval(
            leave_request_id=req.id,
            approver_id=current_user.id,
            tier_level=1
        )
        db.add(approval)

    approval.status = req.status
    approval.comments = action.comments
    approval.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(req)

    return serialize_leave_request(req)

@router.post("/cancel/{id}", response_model=LeaveRequestOut)
def cancel_leave(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == id, LeaveRequest.user_id == current_user.id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if req.status in [LeaveStatus.REJECTED.value, LeaveStatus.CANCELLED.value]:
        raise HTTPException(status_code=400, detail="Cannot cancel an already rejected or cancelled leave")

    refund_cancelled_leave(db, req)
    db.refresh(req)
    return serialize_leave_request(req)

