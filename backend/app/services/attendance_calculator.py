from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.attendance import AttendanceRecord, AttendancePunch, AttendanceStatus, PunchType
from app.models.shift import Shift
from app.services.shift_service import get_employee_shift_for_date

def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

def recalculate_attendance_record(db: Session, record: AttendanceRecord):
    """
    Deterministically computes total work time, breaks, late arrivals,
    early departures, and overtime based on punch events.
    """
    punches: List[AttendancePunch] = sorted(record.punches, key=lambda p: ensure_utc(p.punch_time))
    if not punches:
        record.status = AttendanceStatus.ABSENT.value
        record.total_work_minutes = 0
        record.total_break_minutes = 0
        record.overtime_minutes = 0
        record.late_in_minutes = 0
        record.early_out_minutes = 0
        db.commit()
        return

    # First and last punches
    record.first_check_in = punches[0].punch_time
    record.last_check_out = punches[-1].punch_time if len(punches) > 1 else None

    # Calculate work intervals and break intervals
    total_work_secs = 0.0
    total_break_secs = 0.0
    
    current_in_time: Optional[datetime] = None
    last_out_time: Optional[datetime] = None

    for p in punches:
        p_time = ensure_utc(p.punch_time)
        if p.punch_type == PunchType.IN.value:
            current_in_time = p_time
            if last_out_time is not None:
                break_duration = (current_in_time - last_out_time).total_seconds()
                if break_duration > 0:
                    total_break_secs += break_duration
                last_out_time = None
        elif p.punch_type == PunchType.OUT.value:
            if current_in_time is not None:
                work_duration = (p_time - current_in_time).total_seconds()
                if work_duration > 0:
                    total_work_secs += work_duration
                current_in_time = None
            last_out_time = p_time

    # If currently checked in without checking out, calculate work up to now
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if current_in_time is not None and record.date == today_str:
        now_utc = datetime.now(timezone.utc)
        work_so_far = (now_utc - current_in_time).total_seconds()
        if work_so_far > 0:
            total_work_secs += work_so_far

    record.total_work_minutes = max(0, int(total_work_secs // 60))
    record.total_break_minutes = max(0, int(total_break_secs // 60))

    # Shift comparisons
    shift = record.shift or get_employee_shift_for_date(db, record.user_id, record.date)
    if shift:
        record.shift_id = shift.id
        
        # Parse shift start time (e.g. "09:00")
        try:
            shift_h, shift_m = map(int, shift.start_time.split(":"))
            first_in = ensure_utc(record.first_check_in)
            if first_in:
                in_local_minutes = first_in.hour * 60 + first_in.minute
                shift_start_minutes = shift_h * 60 + shift_m
                grace_limit = shift_start_minutes + shift.grace_period_mins
                if in_local_minutes > grace_limit:
                    record.late_in_minutes = in_local_minutes - shift_start_minutes
                else:
                    record.late_in_minutes = 0
        except Exception:
            record.late_in_minutes = 0

        # Check early exit if checked out
        if record.last_check_out and len(punches) > 1 and punches[-1].punch_type == PunchType.OUT.value:
            try:
                shift_end_h, shift_end_m = map(int, shift.end_time.split(":"))
                last_out = ensure_utc(record.last_check_out)
                out_local_minutes = last_out.hour * 60 + last_out.minute
                shift_end_minutes = shift_end_h * 60 + shift_end_m
                early_limit = shift_end_minutes - shift.early_exit_allowance_mins
                if out_local_minutes < early_limit:
                    record.early_out_minutes = shift_end_minutes - out_local_minutes
                else:
                    record.early_out_minutes = 0
            except Exception:
                record.early_out_minutes = 0

        # Overtime calculation
        expected = shift.expected_work_hours
        if record.total_work_minutes > expected:
            record.overtime_minutes = record.total_work_minutes - expected
        else:
            record.overtime_minutes = 0

        # Status determination
        half_day_min = shift.half_day_threshold_mins
        full_day_min = expected - 60
        if record.total_work_minutes >= full_day_min:
            record.status = AttendanceStatus.PRESENT.value
        elif record.total_work_minutes >= half_day_min:
            record.status = AttendanceStatus.HALF_DAY.value
        elif record.first_check_in and record.date == today_str:
            record.status = AttendanceStatus.PRESENT.value
        else:
            record.status = AttendanceStatus.ABSENT.value

    db.commit()
    db.refresh(record)
