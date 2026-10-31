from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.core.database import get_db
from app.models.common import EmployeeDocument
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter()

class DocumentCreate(BaseModel):
    category: str # "Offer Letter", "Contract", "ID Proof", "Certificates"
    title: str
    file_name: str
    file_path: str
    file_size_kb: int = 100

class DocumentOut(BaseModel):
    id: int
    user_id: int
    category: str
    title: str
    file_name: str
    file_path: str
    file_size_kb: int
    uploaded_at: datetime

    class Config:
        from_attributes = True

@router.get("", response_model=List[DocumentOut])
def get_documents(
    user_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    admin_roles = ["SUPER_ADMIN", "ADMIN", "HR_ADMIN", "HR_MANAGER", "HR_EXECUTIVE", "COMPANY_ADMIN"]
    if user_id and current_user.role in admin_roles:
        target_user = db.query(User).filter(User.id == user_id, User.company_id == current_user.company_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Employee not found in your company")
        target_user_id = user_id
    else:
        target_user_id = current_user.id

    docs = db.query(EmployeeDocument).filter(
        EmployeeDocument.user_id == target_user_id
    ).order_by(EmployeeDocument.uploaded_at.desc()).all()
    return docs

@router.post("", response_model=DocumentOut)
def upload_document_metadata(
    doc_in: DocumentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = EmployeeDocument(
        user_id=current_user.id,
        category=doc_in.category,
        title=doc_in.title,
        file_name=doc_in.file_name,
        file_path=doc_in.file_path,
        file_size_kb=doc_in.file_size_kb
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc

