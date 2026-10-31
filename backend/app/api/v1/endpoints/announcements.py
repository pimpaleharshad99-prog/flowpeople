from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from app.core.database import get_db
from app.models.common import Announcement
from app.models.user import User
from app.api.deps import get_current_user, require_admin

router = APIRouter()

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    priority: str = "NORMAL" # NORMAL, IMPORTANT, URGENT

class AnnouncementOut(BaseModel):
    id: int
    title: str
    content: str
    priority: str
    author_name: Optional[str] = None
    published_at: datetime

    class Config:
        from_attributes = True

@router.get("", response_model=List[AnnouncementOut])
def list_announcements(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    anns = db.query(Announcement).filter(
        Announcement.company_id == current_user.company_id
    ).order_by(Announcement.published_at.desc()).all()

    return [
        AnnouncementOut(
            id=a.id,
            title=a.title,
            content=a.content,
            priority=a.priority,
            author_name=a.author.full_name if a.author else "HR Department",
            published_at=a.published_at
        )
        for a in anns
    ]

@router.post("", response_model=AnnouncementOut)
def create_announcement(
    ann_in: AnnouncementCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    a = Announcement(
        company_id=current_user.company_id,
        author_id=current_user.id,
        title=ann_in.title,
        content=ann_in.content,
        priority=ann_in.priority
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return AnnouncementOut(
        id=a.id,
        title=a.title,
        content=a.content,
        priority=a.priority,
        author_name=current_user.full_name,
        published_at=a.published_at
    )

