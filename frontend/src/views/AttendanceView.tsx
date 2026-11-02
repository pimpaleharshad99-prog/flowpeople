import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Calendar, 
  Download, 
  Camera, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck,
  Search,
  Users,
  FileText,
  Scan,
  Activity,
  Fingerprint,
  QrCode,
  ArrowRight,
  Maximize2,
  Building,
  UserCheck,
  Check,
  FileDown,
  LogIn,
  LogOut
} from 'lucide-react';
import { api, AttendanceRecord, AttendanceStatus, BiometricLog, User, HRDashboardData, HRDashboardEmployee } from '../services/api';
import { generateAttendancePdf, AttendancePdfRecord } from '../utils/pdfGenerator';
import { 
  StatCard, 
  GlassCard, 
  StatusBadge, 
  Tabs, 
  DataTable, 
  Column, 
  FilterBar, 
  ConfirmDialog, 
  Skeleton,
  Timeline,
  TimelineItem,
  Avatar
} from '../components/ui';
import { FaceCameraModal } from '../components/FaceCameraModal';
import { FaceKioskModal } from '../components/FaceKioskModal';
import { FingerprintModal } from '../components/FingerprintModal';
import { QRCodeModal } from '../components/QRCodeModal';
import { Logo } from '../components/brand/Logo';

export type AttendanceMethod = 'FACE' | 'FINGERPRINT' | 'QR';

interface AttendanceViewProps {
  currentUser: User | null;
  attendanceStatus: AttendanceStatus | null;
  onRefreshStatus: () => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  currentUser,
  attendanceStatus,
  onRefreshStatus,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<AttendanceMethod>('FACE');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  // Modals
  const [faceModalOpen, setFaceModalOpen] = useState(false);
  const [faceModalMode, setFaceModalMode] = useState<'PUNCH_IN' | 'PUNCH_OUT' | 'ENROLL' | 'TEST'>('PUNCH_IN');
  const [faceKioskOpen, setFaceKioskOpen] = useState(false);
  const [fingerprintModalOpen, setFingerprintModalOpen] = useState(false);
  const [fingerprintMode, setFingerprintMode] = useState<'PUNCH_IN' | 'PUNCH_OUT' | 'ENROLL'>('PUNCH_IN');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrAdminKioskOpen, setQrAdminKioskOpen] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'HISTORY' | 'REPORTS' | 'TEAM' | 'LOGS' | 'KIOSK'>('HISTORY');

  // Data
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [biometricLogs, setBiometricLogs] = useState<BiometricLog[]>([]);
  const [hrData, setHrData] = useState<HRDashboardData | null>(null);
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Live Clock updater
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isManagerOrAdmin = [
    'ADMIN', 'SUPER_ADMIN', 'HR_ADMIN', 'COMPANY_ADMIN', 'HR_MANAGER', 'MANAGER'
  ].includes(currentUser?.role || '');

  const isAdminOrHR = [
    'ADMIN', 'SUPER_ADMIN', 'HR_ADMIN', 'COMPANY_ADMIN', 'HR_MANAGER'
  ].includes(currentUser?.role || '');

  const loadData = async () => {
    try {
      setLoading(true);
      const [recordsData, empData, logsData, hrDashboardRes] = await Promise.all([
        api.getMyAttendanceRecords().catch(() => []),
        isManagerOrAdmin ? api.getEmployees().catch(() => []) : Promise.resolve([]),
        isAdminOrHR ? api.getBiometricLogs().catch(() => []) : Promise.resolve([]),
        isManagerOrAdmin ? api.getHRDashboard({ date: reportDate }).catch(() => null) : Promise.resolve(null)
      ]);
      setRecords(recordsData);
      setEmployees(empData);
      setBiometricLogs(logsData);
      if (hrDashboardRes) setHrData(hrDashboardRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser, reportDate]);

  const handleTriggerPrimaryPunch = () => {
    const punchMode = attendanceStatus?.is_checked_in ? 'PUNCH_OUT' : 'PUNCH_IN';

    if (selectedMethod === 'FACE') {
      setFaceModalMode(punchMode);
      setFaceModalOpen(true);
    } else if (selectedMethod === 'FINGERPRINT') {
      setFingerprintMode(punchMode);
      setFingerprintModalOpen(true);
    } else if (selectedMethod === 'QR') {
      setQrModalOpen(true);
    }
  };

  const handlePunchSuccess = (data: any) => {
    onRefreshStatus();
    loadData();
  };

  const handleGeneratePdf = () => {
    // If viewing company / team roster in REPORTS or TEAM tab
    if (activeTab === 'REPORTS' || activeTab === 'TEAM') {
      const rosterList = hrData?.employees || [];
      const pdfRecords: AttendancePdfRecord[] = rosterList.map(emp => {
        const hrs = Math.floor(emp.total_work_minutes / 60);
        const mins = emp.total_work_minutes % 60;
        return {
          name: emp.full_name,
          code: emp.employee_code,
          department: emp.department_name,
          branch: emp.branch_name,
          date: hrData?.date || reportDate,
          whenIn: emp.first_check_in ? new Date(emp.first_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
          whenOut: emp.last_check_out ? new Date(emp.last_check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (emp.status === 'CHECKED_IN' ? 'Active / On Duty' : '—'),
          duration: `${hrs}h ${mins}m`,
          status: emp.status,
          method: emp.verification_method || 'FACE',
          punchLogs: `${emp.punch_count} recorded punches`
        };
      });

      generateAttendancePdf({
        title: `Official Attendance & In-Out Timesheet Ledger`,
        subtitle: `Complete Employee Clock-In, Departure & Biometric Verification Record`,
        date: reportDate,
        companyName: currentUser?.company_name || 'Organization Workspace',
        companyLogoUrl: currentUser?.company_logo_url,
        softwareTitle: currentUser?.brand_name || currentUser?.company_name,
        records: pdfRecords,
        summary: {
          totalEmployees: hrData?.total_employees,
          present: hrData?.present_today,
          checkedIn: hrData?.currently_checked_in,
          absent: hrData?.absent_today
        }
      });
      return;
    }

    // Default: My Attendance Timesheet PDF
    const pdfRecords: AttendancePdfRecord[] = records.map(r => {
      const hrs = Math.floor(r.total_work_minutes / 60);
      const mins = r.total_work_minutes % 60;
      const punchesSummary = r.punches && r.punches.length > 0 
        ? r.punches.map(p => `${p.punch_type}: ${new Date(p.punch_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`).join(' → ')
        : '—';
      const lastPunch = r.punches && r.punches.length > 0 ? r.punches[r.punches.length - 1] : null;

      return {
        name: currentUser?.full_name || 'Employee',
        code: currentUser?.employee_code || 'EMP',
        department: currentUser?.department_name || 'General',
        branch: currentUser?.branch_name || 'Headquarters',
        date: r.date,
        whenIn: r.first_check_in ? new Date(r.first_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
        whenOut: r.last_check_out ? new Date(r.last_check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
        duration: `${hrs}h ${mins}m`,
        status: r.status,
        method: lastPunch?.verification_method || 'FACE',
        punchLogs: punchesSummary
      };
    });

    generateAttendancePdf({
      title: `Employee Personal Attendance Timesheet`,
      subtitle: `Official In-Out Punch Ledger for ${currentUser?.full_name} (${currentUser?.employee_code})`,
      date: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long' }),
      companyName: currentUser?.company_name || 'Organization Workspace',
      companyLogoUrl: currentUser?.company_logo_url,
      softwareTitle: currentUser?.brand_name || currentUser?.company_name,
      records: pdfRecords
    });
  };

  const exportCSV = () => {
    const titleBlock = [
      '# FlowPeople by FlowCraft',
      '# Attendance & Biometric Audit Report',
      `# Generated: ${new Date().toLocaleString()}`,
      `# Employee: ${currentUser?.full_name || 'All'} (${currentUser?.employee_code || 'EMP'})`,
      ''
    ].join('\n');

    const headers = ['Date', 'First In', 'Last Out', 'Work (Minutes)', 'Break (Minutes)', 'Overtime (Min)', 'Status', 'Regularized'];
    const rows = records.map(r => [
      r.date,
      r.first_check_in ? new Date(r.first_check_in).toLocaleTimeString() : '—',
      r.last_check_out ? new Date(r.last_check_out).toLocaleTimeString() : '—',
      r.total_work_minutes,
      r.total_break_minutes,
      r.overtime_minutes,
      r.status,
      r.is_regularized ? 'Yes' : 'No'
    ]);

    const csvContent = titleBlock + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `flowpeople_attendance_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tabs = [
    { id: 'HISTORY', label: 'My Attendance', count: records.length },
    { id: 'REPORTS', label: 'Full In-Out Ledger & PDF', count: isManagerOrAdmin ? (hrData?.employees?.length || employees.length) : records.length },
    ...(isManagerOrAdmin ? [{ id: 'TEAM', label: 'Team Attendance', count: employees.length }] : []),
    ...(isAdminOrHR ? [{ id: 'LOGS', label: 'Biometric Security Audit', count: biometricLogs.length }] : []),
    ...(isAdminOrHR ? [{ id: 'KIOSK', label: 'Attendance Kiosks' }] : [])
  ];

  // Format elapsed time string
  const formatWorkHours = (totalMinutes: number) => {
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto px-2 sm:px-4">
      
      {/* 1. Header Card (Minimal, Clean, Professional) */}
      <div className="p-4 sm:p-5 rounded-2xl glass-panel bg-[var(--surface-glass)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Avatar
            name={currentUser?.full_name || 'User'}
            src={currentUser?.avatar_url}
            size="lg"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                {currentUser?.full_name || 'Employee Attendance'}
              </h2>
              <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-[var(--surface-hover)] border border-[var(--border-subtle)] text-[var(--accent)] font-semibold">
                {currentUser?.employee_code || 'EMP-001'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {currentUser?.designation_name || currentUser?.role?.replace(/_/g, ' ') || 'Staff'} &bull; {currentUser?.department_name || 'General'}
            </p>
          </div>
        </div>

        {/* Live Digital Clock & Quick Export */}
        <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-[var(--border-subtle)]">
          <div className="text-left sm:text-right">
            <div className="text-sm sm:text-base font-mono font-bold text-[var(--text-primary)] tracking-tight">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              {currentTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleGeneratePdf}
              className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition text-xs font-bold flex items-center gap-1.5 shadow-sm"
              title="Generate and Download Official Attendance Timesheet PDF"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Generate PDF</span>
            </button>
            <button
              onClick={() => setFaceKioskOpen(true)}
              className="px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white transition text-xs font-bold flex items-center gap-1.5 shadow-sm"
              title="Launch Continuous Multi-Employee Face Attendance Kiosk"
            >
              <Scan className="w-3.5 h-3.5" />
              <span>Face Kiosk Terminal</span>
            </button>
            <button
              onClick={exportCSV}
              className="p-2 rounded-lg bg-[var(--surface-glass)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] transition text-xs flex items-center gap-1"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-medium">CSV</span>
            </button>
            {isAdminOrHR && (
              <button
                onClick={() => setQrAdminKioskOpen(true)}
                className="p-2 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition text-xs flex items-center gap-1"
                title="Launch Workplace QR Kiosk"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-semibold">QR Kiosk</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Attendance Section (Unified 3-Way Verification) */}
      <div className="p-5 sm:p-6 rounded-2xl glass-panel bg-[var(--surface-glass-solid)] border border-[var(--border-strong)] shadow-lg space-y-5">
        
        {/* Status Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[var(--surface-glass)]/70 border border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className={`w-3.5 h-3.5 rounded-full ${attendanceStatus?.is_checked_in ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-slate-600'}`} />
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                Today's Presence Status
              </span>
              <div className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <span>{attendanceStatus?.is_checked_in ? 'Currently Clocked In' : 'Currently Clocked Out'}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  attendanceStatus?.is_checked_in 
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                    : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30'
                }`}>
                  {attendanceStatus?.status || (attendanceStatus?.is_checked_in ? 'PRESENT' : 'OFFLINE')}
                </span>
              </div>
            </div>
          </div>

          {/* Timing details */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-[10px] text-[var(--text-muted)] block uppercase font-sans font-semibold">First Punch In</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {attendanceStatus?.first_check_in ? new Date(attendanceStatus.first_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-muted)] block uppercase font-sans font-semibold">Effective Work</span>
              <span className="font-bold text-[var(--accent)] text-sm">
                {formatWorkHours(attendanceStatus?.total_work_minutes || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Verification Method Selector (Compact Horizontal) */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
            Select Verification Method
          </label>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { id: 'FACE', label: 'Face Recognition', icon: Camera, desc: 'Optical 128-D anti-spoof' },
              { id: 'FINGERPRINT', label: 'Fingerprint Sensor', icon: Fingerprint, desc: 'WebAuthn / USB scanner' },
              { id: 'QR', label: 'Scan QR Code', icon: QrCode, desc: 'Signed rotating kiosk QR' }
            ].map(m => {
              const Icon = m.icon;
              const active = selectedMethod === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMethod(m.id as AttendanceMethod)}
                  className={`p-3 rounded-xl border text-left transition relative flex flex-col justify-between ${
                    active 
                      ? 'bg-[var(--surface-hover)] border-[var(--accent)] ring-2 ring-[var(--accent)]/30 shadow-xs' 
                      : 'bg-[var(--surface-glass)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Icon className={`w-4 h-4 ${active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
                    {active && <Check className="w-3.5 h-3.5 text-[var(--accent)]" />}
                  </div>
                  <div>
                    <div className={`text-xs font-bold leading-tight ${active ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                      {m.label}
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] truncate hidden sm:block mt-0.5">
                      {m.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Action Button (Clear, High-Contrast, Action-Oriented) */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={handleTriggerPrimaryPunch}
            className={`w-full sm:flex-1 py-3.5 px-6 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2.5 ${
              attendanceStatus?.is_checked_in
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-[var(--accent)]/20'
            }`}
          >
            {selectedMethod === 'FACE' && <Camera className="w-4 h-4" />}
            {selectedMethod === 'FINGERPRINT' && <Fingerprint className="w-4 h-4" />}
            {selectedMethod === 'QR' && <QrCode className="w-4 h-4" />}
            
            <span>
              {attendanceStatus?.is_checked_in
                ? `Clock Out with ${selectedMethod === 'FACE' ? 'Face ID' : selectedMethod === 'FINGERPRINT' ? 'Fingerprint' : 'QR'}`
                : `Clock In with ${selectedMethod === 'FACE' ? 'Face ID' : selectedMethod === 'FINGERPRINT' ? 'Fingerprint' : 'QR'}`
              }
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Diagnostic Test & Kiosk Buttons */}
          {selectedMethod === 'FACE' && (
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setFaceKioskOpen(true)}
                className="w-full sm:w-auto px-4 py-3.5 rounded-xl border border-teal-500/40 bg-teal-500/10 hover:bg-teal-500/20 text-xs font-bold text-teal-600 dark:text-teal-400 transition flex items-center justify-center gap-2"
              >
                <Scan className="w-3.5 h-3.5" />
                <span>Launch Face Kiosk Terminal</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFaceModalMode('TEST');
                  setFaceModalOpen(true);
                }}
                className="w-full sm:w-auto px-4 py-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-glass)] hover:bg-[var(--surface-hover)] text-xs font-semibold text-[var(--text-secondary)] transition flex items-center justify-center gap-1.5"
              >
                <Activity className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Test Camera</span>
              </button>
            </div>
          )}

          {selectedMethod === 'FINGERPRINT' && (
            <button
              type="button"
              onClick={() => {
                setFingerprintMode('ENROLL');
                setFingerprintModalOpen(true);
              }}
              className="w-full sm:w-auto px-4 py-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-glass)] hover:bg-[var(--surface-hover)] text-xs font-semibold text-[var(--text-secondary)] transition flex items-center justify-center gap-1.5"
            >
              <Fingerprint className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Enroll Fingerprint</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Role-Based Navigation Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as any)}
      />

      {/* TAB 1: My Attendance History */}
      {activeTab === 'HISTORY' && (
        <GlassCard
          title="Personal Attendance History"
          subtitle="Chronological check-in and check-out logs"
        >
          {loading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : records.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)] space-y-1">
              <Clock className="w-8 h-8 mx-auto opacity-50" />
              <p className="font-semibold text-[var(--text-primary)]">No Attendance Punches Recorded</p>
              <p>Clock in above using Face ID, Fingerprint, or QR to record attendance.</p>
            </div>
          ) : (
            <DataTable
              data={records}
              columns={[
                {
                  key: 'date',
                  header: 'Date',
                  render: (r: AttendanceRecord) => <span className="font-medium">{r.date}</span>
                },
                {
                  key: 'in',
                  header: 'Check-In',
                  render: (r: AttendanceRecord) => (
                    <span className="font-mono text-xs">
                      {r.first_check_in ? new Date(r.first_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                  )
                },
                {
                  key: 'out',
                  header: 'Check-Out',
                  render: (r: AttendanceRecord) => (
                    <span className="font-mono text-xs">
                      {r.last_check_out ? new Date(r.last_check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                  )
                },
                {
                  key: 'work',
                  header: 'Effective Hours',
                  render: (r: AttendanceRecord) => (
                    <span className="font-semibold text-[var(--accent)] font-mono text-xs">
                      {formatWorkHours(r.total_work_minutes)}
                    </span>
                  )
                },
                {
                  key: 'method',
                  header: 'Method Used',
                  render: (r: AttendanceRecord) => {
                    const lastPunch = r.punches && r.punches.length > 0 ? r.punches[r.punches.length - 1] : null;
                    const method = lastPunch?.verification_method || 'FACE';
                    return (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                        {method}
                      </span>
                    );
                  }
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (r: AttendanceRecord) => <StatusBadge status={r.status} />
                }
              ]}
            />
          )}
        </GlassCard>
      )}

      {/* TAB: Comprehensive In-Out Ledger & PDF Timesheets */}
      {activeTab === 'REPORTS' && (
        <GlassCard
          title="Full Attendance & In-Out Timesheet Ledger"
          subtitle="Complete records with exact clock-in, departure times, work hours, and instant PDF report generation"
        >
          {/* Action & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-[var(--border-subtle)]">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-[var(--surface-primary)] border border-[var(--border-subtle)] px-2.5 py-1.5 rounded-xl">
                <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="bg-transparent text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <input
                type="text"
                placeholder="Search employee or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="glass-input text-xs px-3 py-1.5 rounded-xl min-w-[200px]"
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="glass-input text-xs px-3 py-1.5 rounded-xl"
              >
                <option value="ALL">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="CHECKED_IN">Checked In</option>
                <option value="ABSENT">Absent</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGeneratePdf}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-teal-500/20 active:scale-95 transition"
              >
                <FileDown className="w-4 h-4" />
                <span>Generate PDF Report</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--border-subtle)]">
              <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">Total Tracked</span>
              <span className="text-lg font-bold text-[var(--text-primary)] font-mono">
                {isManagerOrAdmin ? (hrData?.total_employees || employees.length) : 1}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider block">Completed Today</span>
              <span className="text-lg font-bold font-mono">
                {isManagerOrAdmin ? (hrData?.present_today || 0) : (records.filter(r => r.last_check_out).length)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider block">Currently Checked In</span>
              <span className="text-lg font-bold font-mono">
                {isManagerOrAdmin ? (hrData?.currently_checked_in || 0) : (attendanceStatus?.is_checked_in ? 1 : 0)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider block">Absent / Incomplete</span>
              <span className="text-lg font-bold font-mono">
                {isManagerOrAdmin ? (hrData?.absent_today || 0) : (records.filter(r => !r.first_check_in).length)}
              </span>
            </div>
          </div>

          {/* Roster / Ledger Table */}
          {loading ? (
            <div className="space-y-3 py-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isManagerOrAdmin && hrData && hrData.employees ? (
            <DataTable
              data={hrData.employees.filter(e => {
                if (searchQuery) {
                  const q = searchQuery.toLowerCase();
                  if (!e.full_name.toLowerCase().includes(q) && !e.employee_code.toLowerCase().includes(q)) return false;
                }
                if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
                return true;
              })}
              columns={[
                {
                  key: 'employee',
                  header: 'Employee Name & Code',
                  render: (emp: HRDashboardEmployee) => (
                    <div className="flex items-center gap-2.5">
                      <Avatar name={emp.full_name} src={emp.avatar_url} size="sm" />
                      <div>
                        <div className="font-bold text-xs text-[var(--text-primary)]">{emp.full_name}</div>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">{emp.employee_code}</div>
                      </div>
                    </div>
                  )
                },
                {
                  key: 'dept',
                  header: 'Department',
                  render: (emp: HRDashboardEmployee) => (
                    <div>
                      <span className="text-xs text-[var(--text-secondary)] block font-medium">{emp.department_name || 'General'}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{emp.branch_name || 'Headquarters'}</span>
                    </div>
                  )
                },
                {
                  key: 'whenIn',
                  header: 'When In (Clock In)',
                  render: (emp: HRDashboardEmployee) => (
                    <div className="flex items-center gap-1.5">
                      <LogIn className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {emp.first_check_in ? new Date(emp.first_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    </div>
                  )
                },
                {
                  key: 'whenOut',
                  header: 'When Out (Go Out)',
                  render: (emp: HRDashboardEmployee) => (
                    <div className="flex items-center gap-1.5">
                      <LogOut className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      {emp.last_check_out ? (
                        <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                          {new Date(emp.last_check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : emp.status === 'CHECKED_IN' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 animate-pulse">
                          <span>Active / On Duty</span>
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)] font-mono">—</span>
                      )}
                    </div>
                  )
                },
                {
                  key: 'duration',
                  header: 'Duration',
                  render: (emp: HRDashboardEmployee) => {
                    const hrs = Math.floor(emp.total_work_minutes / 60);
                    const mins = emp.total_work_minutes % 60;
                    return (
                      <span className="font-mono text-xs font-semibold text-[var(--accent)]">
                        {hrs}h {mins}m
                      </span>
                    );
                  }
                },
                {
                  key: 'punches',
                  header: 'Punches',
                  render: (emp: HRDashboardEmployee) => (
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-medium">
                      {emp.punch_count} punches
                    </span>
                  )
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (emp: HRDashboardEmployee) => <StatusBadge status={emp.status} />
                }
              ]}
            />
          ) : (
            <DataTable
              data={records}
              columns={[
                {
                  key: 'date',
                  header: 'Date',
                  render: (r: AttendanceRecord) => <span className="font-medium text-xs font-mono">{r.date}</span>
                },
                {
                  key: 'whenIn',
                  header: 'When In (Clock In)',
                  render: (r: AttendanceRecord) => (
                    <div className="flex items-center gap-1.5">
                      <LogIn className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {r.first_check_in ? new Date(r.first_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    </div>
                  )
                },
                {
                  key: 'whenOut',
                  header: 'When Out (Go Out)',
                  render: (r: AttendanceRecord) => (
                    <div className="flex items-center gap-1.5">
                      <LogOut className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                        {r.last_check_out ? new Date(r.last_check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    </div>
                  )
                },
                {
                  key: 'punches',
                  header: 'In/Out Timeline',
                  render: (r: AttendanceRecord) => {
                    if (!r.punches || r.punches.length === 0) return <span className="text-[11px] text-[var(--text-muted)]">—</span>;
                    return (
                      <div className="flex flex-wrap items-center gap-1">
                        {r.punches.map((p, i) => (
                          <span
                            key={i}
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                              p.punch_type === 'IN' 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                                : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                            }`}
                          >
                            {p.punch_type}: {new Date(p.punch_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ))}
                      </div>
                    );
                  }
                },
                {
                  key: 'duration',
                  header: 'Duration',
                  render: (r: AttendanceRecord) => (
                    <span className="font-mono text-xs font-semibold text-[var(--accent)]">
                      {formatWorkHours(r.total_work_minutes)}
                    </span>
                  )
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (r: AttendanceRecord) => <StatusBadge status={r.status} />
                }
              ]}
            />
          )}
        </GlassCard>
      )}

      {/* TAB 2: Team Attendance (Managers & Admins) */}
      {activeTab === 'TEAM' && isManagerOrAdmin && (
        <GlassCard
          title="Department & Team Attendance"
          subtitle="Real-time employee presence overview for managers"
        >
          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Filter team employees by name or code..."
          >
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="glass-input text-xs p-2"
            >
              <option value="ALL">All Employees</option>
              <option value="ACTIVE">Active Staff</option>
              <option value="PROBATION">Probation</option>
            </select>
          </FilterBar>

          <DataTable
            data={employees.filter(e => {
              if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchName = `${e.first_name} ${e.last_name}`.toLowerCase().includes(q);
                const matchCode = (e.employee_code || '').toLowerCase().includes(q);
                if (!matchName && !matchCode) return false;
              }
              if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
              return true;
            })}
            columns={[
              {
                key: 'employee',
                header: 'Employee',
                render: (emp: User) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar name={`${emp.first_name} ${emp.last_name}`} src={emp.avatar_url} size="sm" />
                    <div>
                      <div className="font-semibold text-xs text-[var(--text-primary)]">
                        {emp.first_name} {emp.last_name}
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)] font-mono">{emp.employee_code}</span>
                    </div>
                  </div>
                )
              },
              {
                key: 'department',
                header: 'Department',
                render: (emp: User) => (
                  <span className="text-xs text-[var(--text-secondary)]">
                    {emp.department_name || '—'}
                  </span>
                )
              },
              {
                key: 'role',
                header: 'Role',
                render: (emp: User) => (
                  <span className="text-xs font-mono text-[var(--accent)] font-medium">
                    {emp.role.replace(/_/g, ' ')}
                  </span>
                )
              },
              {
                key: 'status',
                header: 'Account Status',
                render: (emp: User) => <StatusBadge status={emp.status} />
              }
            ]}
          />
        </GlassCard>
      )}

      {/* TAB 3: Biometric Security Audit Logs (Admins & HR) */}
      {activeTab === 'LOGS' && isAdminOrHR && (
        <GlassCard
          title="Optical & Biometric Security Logs"
          subtitle="Chronological audit trail of biometric attempts, anti-spoof checks, and fallbacks"
        >
          {biometricLogs.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              No biometric verification events recorded yet.
            </div>
          ) : (
            <DataTable
              data={biometricLogs}
              columns={[
                {
                  key: 'time',
                  header: 'Timestamp',
                  render: (l: BiometricLog) => (
                    <span className="text-xs font-mono">
                      {new Date(l.timestamp).toLocaleString()}
                    </span>
                  )
                },
                {
                  key: 'user',
                  header: 'Employee',
                  render: (l: BiometricLog) => <span className="font-semibold text-xs">{l.user_name}</span>
                },
                {
                  key: 'attempt',
                  header: 'Attempt Type',
                  render: (l: BiometricLog) => <span className="font-mono text-xs">{l.attempt_type}</span>
                },
                {
                  key: 'scores',
                  header: 'Confidence / Liveness',
                  render: (l: BiometricLog) => (
                    <span className="font-mono text-xs text-[var(--accent)]">
                      {(l.confidence_score * 100).toFixed(0)}% / {(l.liveness_score * 100).toFixed(0)}%
                    </span>
                  )
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (l: BiometricLog) => <StatusBadge status={l.status} />
                }
              ]}
            />
          )}
        </GlassCard>
      )}

      {/* TAB: Comprehensive In-Out Ledger & PDF Timesheets */}
      {activeTab === 'REPORTS' && (
        <GlassCard
          title="Full Attendance & In-Out Timesheet Ledger"
          subtitle="Complete records with exact clock-in, departure times, work hours, and instant PDF report generation"
        >
          {/* Action & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-[var(--border-subtle)]">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-[var(--surface-primary)] border border-[var(--border-subtle)] px-2.5 py-1.5 rounded-xl">
                <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="bg-transparent text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <input
                type="text"
                placeholder="Search employee or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="glass-input text-xs px-3 py-1.5 rounded-xl min-w-[200px]"
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="glass-input text-xs px-3 py-1.5 rounded-xl"
              >
                <option value="ALL">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="CHECKED_IN">Checked In</option>
                <option value="ABSENT">Absent</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGeneratePdf}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-teal-500/20 active:scale-95 transition"
              >
                <FileDown className="w-4 h-4" />
                <span>Generate PDF Report</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--border-subtle)]">
              <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">Total Tracked</span>
              <span className="text-lg font-bold text-[var(--text-primary)] font-mono">
                {isManagerOrAdmin ? (hrData?.total_employees || employees.length) : 1}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider block">Completed Today</span>
              <span className="text-lg font-bold font-mono">
                {isManagerOrAdmin ? (hrData?.present_today || 0) : (records.filter(r => r.last_check_out).length)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider block">Currently Checked In</span>
              <span className="text-lg font-bold font-mono">
                {isManagerOrAdmin ? (hrData?.currently_checked_in || 0) : (attendanceStatus?.is_checked_in ? 1 : 0)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider block">Absent / Incomplete</span>
              <span className="text-lg font-bold font-mono">
                {isManagerOrAdmin ? (hrData?.absent_today || 0) : (records.filter(r => !r.first_check_in).length)}
              </span>
            </div>
          </div>

          {/* Roster / Ledger Table */}
          {loading ? (
            <div className="space-y-3 py-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isManagerOrAdmin && hrData && hrData.employees ? (
            <DataTable
              data={hrData.employees.filter(e => {
                if (searchQuery) {
                  const q = searchQuery.toLowerCase();
                  if (!e.full_name.toLowerCase().includes(q) && !e.employee_code.toLowerCase().includes(q)) return false;
                }
                if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
                return true;
              })}
              columns={[
                {
                  key: 'employee',
                  header: 'Employee Name & Code',
                  render: (emp: HRDashboardEmployee) => (
                    <div className="flex items-center gap-2.5">
                      <Avatar name={emp.full_name} src={emp.avatar_url} size="sm" />
                      <div>
                        <div className="font-bold text-xs text-[var(--text-primary)]">{emp.full_name}</div>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">{emp.employee_code}</div>
                      </div>
                    </div>
                  )
                },
                {
                  key: 'dept',
                  header: 'Department',
                  render: (emp: HRDashboardEmployee) => (
                    <div>
                      <span className="text-xs text-[var(--text-secondary)] block font-medium">{emp.department_name || 'General'}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{emp.branch_name || 'Headquarters'}</span>
                    </div>
                  )
                },
                {
                  key: 'whenIn',
                  header: 'When In (Clock In)',
                  render: (emp: HRDashboardEmployee) => (
                    <div className="flex items-center gap-1.5">
                      <LogIn className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {emp.first_check_in ? new Date(emp.first_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    </div>
                  )
                },
                {
                  key: 'whenOut',
                  header: 'When Out (Go Out)',
                  render: (emp: HRDashboardEmployee) => (
                    <div className="flex items-center gap-1.5">
                      <LogOut className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      {emp.last_check_out ? (
                        <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                          {new Date(emp.last_check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : emp.status === 'CHECKED_IN' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 animate-pulse">
                          <span>Active / On Duty</span>
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)] font-mono">—</span>
                      )}
                    </div>
                  )
                },
                {
                  key: 'duration',
                  header: 'Duration',
                  render: (emp: HRDashboardEmployee) => {
                    const hrs = Math.floor(emp.total_work_minutes / 60);
                    const mins = emp.total_work_minutes % 60;
                    return (
                      <span className="font-mono text-xs font-semibold text-[var(--accent)]">
                        {hrs}h {mins}m
                      </span>
                    );
                  }
                },
                {
                  key: 'punches',
                  header: 'Punches',
                  render: (emp: HRDashboardEmployee) => (
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-medium">
                      {emp.punch_count} punches
                    </span>
                  )
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (emp: HRDashboardEmployee) => <StatusBadge status={emp.status} />
                }
              ]}
            />
          ) : (
            <DataTable
              data={records}
              columns={[
                {
                  key: 'date',
                  header: 'Date',
                  render: (r: AttendanceRecord) => <span className="font-medium text-xs font-mono">{r.date}</span>
                },
                {
                  key: 'whenIn',
                  header: 'When In (Clock In)',
                  render: (r: AttendanceRecord) => (
                    <div className="flex items-center gap-1.5">
                      <LogIn className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {r.first_check_in ? new Date(r.first_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    </div>
                  )
                },
                {
                  key: 'whenOut',
                  header: 'When Out (Go Out)',
                  render: (r: AttendanceRecord) => (
                    <div className="flex items-center gap-1.5">
                      <LogOut className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                        {r.last_check_out ? new Date(r.last_check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    </div>
                  )
                },
                {
                  key: 'punches',
                  header: 'In/Out Timeline',
                  render: (r: AttendanceRecord) => {
                    if (!r.punches || r.punches.length === 0) return <span className="text-[11px] text-[var(--text-muted)]">—</span>;
                    return (
                      <div className="flex flex-wrap items-center gap-1">
                        {r.punches.map((p, i) => (
                          <span
                            key={i}
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                              p.punch_type === 'IN' 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                                : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                            }`}
                          >
                            {p.punch_type}: {new Date(p.punch_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ))}
                      </div>
                    );
                  }
                },
                {
                  key: 'duration',
                  header: 'Duration',
                  render: (r: AttendanceRecord) => (
                    <span className="font-mono text-xs font-semibold text-[var(--accent)]">
                      {formatWorkHours(r.total_work_minutes)}
                    </span>
                  )
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (r: AttendanceRecord) => <StatusBadge status={r.status} />
                }
              ]}
            />
          )}
        </GlassCard>
      )}

      {/* TAB 4: Workplace Kiosk Terminals (Admins & HR) */}
      {activeTab === 'KIOSK' && isAdminOrHR && (
        <div className="space-y-4">
          {/* Primary Face Attendance Terminal Card */}
          <GlassCard
            title="Multi-Employee Face Attendance Kiosk Terminal"
            subtitle="Continuous 1:N camera recognition terminal for office entrance lobby or reception"
          >
            <div className="p-4 rounded-xl border border-teal-500/30 bg-teal-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-[var(--text-primary)]">
                    Continuous Face Attendance Kiosk (1:N Matching)
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-600 dark:text-teal-400">
                    RECOMMENDED
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] max-w-xl leading-relaxed">
                  Employees simply walk up to the camera. The system recognizes their identity, displays their name, role, and details in the real-time activity log, and automatically marks Check-In (Arrival) or Check-Out (Departure).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFaceKioskOpen(true)}
                className="py-3 px-5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm shrink-0"
              >
                <Scan className="w-4 h-4" />
                <span>Launch Face Kiosk Terminal</span>
              </button>
            </div>
          </GlassCard>

          {/* Secondary Rotating QR Kiosk Card */}
          <GlassCard
            title="Workplace Rotating QR Kiosk"
            subtitle="Secondary option for QR attendance using personal mobile devices"
          >
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-glass)]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-[var(--text-primary)]">Rotating HMAC-Signed QR Display</h4>
                <p className="text-xs text-[var(--text-muted)] max-w-xl leading-relaxed">
                  Opens full-screen rotating QR attendance display. Tokens automatically rotate every 15 seconds to prevent photo replay attacks.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrAdminKioskOpen(true)}
                className="py-2.5 px-4 rounded-xl bg-[var(--surface-hover)] border border-[var(--border-strong)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs shrink-0"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Launch QR Kiosk</span>
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Modals */}
      <FaceKioskModal
        isOpen={faceKioskOpen}
        onClose={() => setFaceKioskOpen(false)}
        onPunchRecorded={() => {
          onRefreshStatus();
          loadData();
        }}
      />
      <FaceCameraModal
        isOpen={faceModalOpen}
        onClose={() => setFaceModalOpen(false)}
        mode={faceModalMode}
        onSuccess={handlePunchSuccess}
      />

      <FingerprintModal
        isOpen={fingerprintModalOpen}
        onClose={() => setFingerprintModalOpen(false)}
        mode={fingerprintMode}
        onSuccess={handlePunchSuccess}
      />

      <QRCodeModal
        isOpen={qrModalOpen || qrAdminKioskOpen}
        onClose={() => {
          setQrModalOpen(false);
          setQrAdminKioskOpen(false);
        }}
        mode={attendanceStatus?.is_checked_in ? 'PUNCH_OUT' : 'PUNCH_IN'}
        onSuccess={handlePunchSuccess}
        isAdmin={qrAdminKioskOpen}
      />

    </div>
  );
};

export default AttendanceView;
