from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.company import Company, Branch, Department, Designation, Holiday
from app.models.user import User
from app.schemas.company import (
    DepartmentOut, DepartmentCreate,
    DesignationOut, DesignationCreate,
    HolidayOut, HolidayCreate,
    CompanyOut,
    BranchOut, BranchCreate, BranchUpdate
)
from app.api.deps import get_current_user, require_admin

router = APIRouter()

@router.get("/company", response_model=CompanyOut)
def get_company(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == current_user.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company

@router.get("/departments", response_model=List[DepartmentOut])
def list_departments(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Department).filter(Department.company_id == current_user.company_id).all()

@router.post("/departments", response_model=DepartmentOut)
def create_department(
    dep_data: DepartmentCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    dep = Department(
        company_id=current_user.company_id,
        name=dep_data.name,
        code=dep_data.code,
        description=dep_data.description,
        parent_id=dep_data.parent_id,
        head_user_id=dep_data.head_user_id
    )
    db.add(dep)
    db.commit()
    db.refresh(dep)
    return dep

@router.get("/designations", response_model=List[DesignationOut])
def list_designations(
    department_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Designation).filter(Designation.company_id == current_user.company_id)
    if department_id:
        query = query.filter(Designation.department_id == department_id)
    return query.all()

@router.post("/designations", response_model=DesignationOut)
def create_designation(
    desig_data: DesignationCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    desig = Designation(
        company_id=current_user.company_id,
        department_id=desig_data.department_id,
        name=desig_data.name,
        code=desig_data.code,
        description=desig_data.description
    )
    db.add(desig)
    db.commit()
    db.refresh(desig)
    return desig

@router.get("/holidays", response_model=List[HolidayOut])
def list_holidays(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Holiday).filter(Holiday.company_id == current_user.company_id).order_by(Holiday.holiday_date.asc()).all()

@router.post("/holidays", response_model=HolidayOut)
def create_holiday(
    holiday_data: HolidayCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    holiday = Holiday(
        company_id=current_user.company_id,
        name=holiday_data.name,
        holiday_date=holiday_data.holiday_date,
        is_optional=holiday_data.is_optional,
        description=holiday_data.description
    )
    db.add(holiday)
    db.commit()
    db.refresh(holiday)
    return holiday

# -------------------------------------------------------------
# BRANCHES & OFFICE LOCATIONS (GEOFENCING)
# -------------------------------------------------------------

@router.get("/branches", response_model=List[BranchOut])
def list_branches(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all branches/office locations for the current company."""
    return db.query(Branch).filter(Branch.company_id == current_user.company_id).order_by(Branch.name.asc()).all()

@router.post("/branches", response_model=BranchOut, status_code=status.HTTP_201_CREATED)
def create_branch(
    branch_data: BranchCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new branch with physical address and geofence coordinates."""
    # If set as headquarters, unset previous headquarters
    if branch_data.is_headquarters:
        db.query(Branch).filter(
            Branch.company_id == current_user.company_id,
            Branch.is_headquarters == True
        ).update({"is_headquarters": False})

    branch = Branch(
        company_id=current_user.company_id,
        name=branch_data.name,
        code=branch_data.code,
        address=branch_data.address,
        city=branch_data.city,
        state=branch_data.state,
        country=branch_data.country,
        postal_code=branch_data.postal_code,
        timezone=branch_data.timezone or "UTC",
        latitude=branch_data.latitude,
        longitude=branch_data.longitude,
        geofence_radius_meters=branch_data.geofence_radius_meters or 150,
        is_geofence_enforced=branch_data.is_geofence_enforced if branch_data.is_geofence_enforced is not None else True,
        is_headquarters=branch_data.is_headquarters or False
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch

@router.get("/branches/{branch_id}", response_model=BranchOut)
def get_branch(
    branch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve branch details."""
    branch = db.query(Branch).filter(
        Branch.id == branch_id,
        Branch.company_id == current_user.company_id
    ).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch location not found")
    return branch

@router.put("/branches/{branch_id}", response_model=BranchOut)
def update_branch(
    branch_id: int,
    branch_update: BranchUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update branch details, coordinates, or geofence boundary."""
    branch = db.query(Branch).filter(
        Branch.id == branch_id,
        Branch.company_id == current_user.company_id
    ).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch location not found")

    update_data = branch_update.model_dump(exclude_unset=True)
    if update_data.get("is_headquarters"):
        db.query(Branch).filter(
            Branch.company_id == current_user.company_id,
            Branch.id != branch_id,
            Branch.is_headquarters == True
        ).update({"is_headquarters": False})

    for field, val in update_data.items():
        setattr(branch, field, val)

    db.commit()
    db.refresh(branch)
    return branch

@router.delete("/branches/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_branch(
    branch_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a branch office location."""
    branch = db.query(Branch).filter(
        Branch.id == branch_id,
        Branch.company_id == current_user.company_id
    ).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch location not found")

    db.delete(branch)
    db.commit()
    return None


