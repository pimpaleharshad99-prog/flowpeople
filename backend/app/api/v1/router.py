from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, organization, employees, attendance,
    shifts, leaves, timetracker, documents,
    announcements, reports, biometrics, superadmin,
    performance, lifecycle, helpdesk, payroll,
    fingerprint, qr_attendance
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & Profile"])
api_router.include_router(organization.router, prefix="/organization", tags=["Organization"])
api_router.include_router(employees.router, prefix="/employees", tags=["Employee Master Directory"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["Attendance & Punches"])
api_router.include_router(biometrics.router, prefix="/biometrics", tags=["Face ID Biometrics"])
api_router.include_router(fingerprint.router, prefix="/attendance/fingerprint", tags=["Fingerprint Biometric Attendance"])
api_router.include_router(qr_attendance.router, prefix="/attendance/qr", tags=["QR Code Attendance"])
api_router.include_router(shifts.router, prefix="/shifts", tags=["Shift Rostering"])
api_router.include_router(leaves.router, prefix="/leaves", tags=["Leave Tracker"])
api_router.include_router(timetracker.router, prefix="/timetracker", tags=["Time Tracker & Timesheets"])
api_router.include_router(payroll.router, prefix="/payroll", tags=["Payroll & Compensation"])
api_router.include_router(performance.router, prefix="/performance", tags=["Performance & Goals"])
api_router.include_router(lifecycle.router, prefix="/lifecycle", tags=["Employee Lifecycle & Onboarding"])
api_router.include_router(helpdesk.router, prefix="/helpdesk", tags=["HR Helpdesk"])
api_router.include_router(documents.router, prefix="/documents", tags=["Employee Documents"])
api_router.include_router(announcements.router, prefix="/announcements", tags=["Announcements"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports & Analytics"])
api_router.include_router(superadmin.router, prefix="/superadmin", tags=["Super Admin & Multi-Tenant"])
