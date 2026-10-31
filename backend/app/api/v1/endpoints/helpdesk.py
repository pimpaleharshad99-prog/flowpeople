from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel

from app.core.database import get_db
from app.models.common import HRTicket, TicketStatus, TicketPriority
from app.models.user import User, UserRole
from app.api.deps import get_current_user

router = APIRouter()

class TicketCreate(BaseModel):
    category: str
    subject: str
    description: str
    priority: Optional[str] = "MEDIUM"

class TicketStatusUpdate(BaseModel):
    status: str
    resolution_notes: Optional[str] = None

@router.get("/tickets")
def list_tickets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(HRTicket).join(User, HRTicket.user_id == User.id)\
        .filter(User.company_id == current_user.company_id)

    # If employee, show only own tickets
    if current_user.role == UserRole.EMPLOYEE.value:
        query = query.filter(HRTicket.user_id == current_user.id)

    tickets = query.order_by(HRTicket.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "user_id": t.user_id,
            "employee_name": t.user.full_name if t.user else "Unknown",
            "category": t.category,
            "subject": t.subject,
            "description": t.description,
            "priority": t.priority,
            "status": t.status,
            "assigned_to": t.assigned_to.full_name if t.assigned_to else "Unassigned",
            "resolution_notes": t.resolution_notes,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "resolved_at": t.resolved_at.isoformat() if t.resolved_at else None
        }
        for t in tickets
    ]

@router.post("/tickets")
def create_ticket(
    req: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ticket = HRTicket(
        user_id=current_user.id,
        category=req.category,
        subject=req.subject,
        description=req.description,
        priority=req.priority or TicketPriority.MEDIUM.value,
        status=TicketStatus.OPEN.value
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return {"success": True, "ticket_id": ticket.id, "subject": ticket.subject}

@router.put("/tickets/{ticket_id}/status")
def update_ticket_status(
    ticket_id: int,
    req: TicketStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ticket = db.query(HRTicket).join(User, HRTicket.user_id == User.id)\
        .filter(HRTicket.id == ticket_id, User.company_id == current_user.company_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if current_user.role == UserRole.EMPLOYEE.value:
        if ticket.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Employees can only manage their own support cases")
        if req.status not in [TicketStatus.CLOSED.value, TicketStatus.OPEN.value]:
            raise HTTPException(status_code=403, detail="Employees cannot resolve tickets; this action requires an HR Agent or Administrator")

    ticket.status = req.status
    if req.resolution_notes:
        ticket.resolution_notes = req.resolution_notes
    if req.status in [TicketStatus.RESOLVED.value, TicketStatus.CLOSED.value]:
        ticket.resolved_at = datetime.now(timezone.utc)
        if not ticket.assigned_to_id:
            ticket.assigned_to_id = current_user.id

    db.commit()
    return {"success": True, "ticket_id": ticket.id, "status": ticket.status}

