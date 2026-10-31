import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw,
  RefreshCw,
  Search, 
  Filter, 
  Calendar, 
  FileText, 
  UserCheck,
  Eye,
  Camera,
  Download,
  AlertCircle,
  Building2,
  Check,
  ShieldAlert,
  ArrowRight,
  Scan
} from 'lucide-react';
import { 
  api, 
  BiometricLog, 
  User, 
  HRDashboardData, 
  HRDashboardEmployee, 
  VerificationFailureLog,
  Branch
} from '../services/api';
import { 
  PageHeader, 
  StatCard, 
  GlassCard, 
  DataTable, 
  StatusBadge, 
  ConfirmDialog, 
  useToast, 
  Tabs,
  Avatar 
} from '../components/ui';
import { FaceKioskModal } from '../components/FaceKioskModal';
import { FaceCameraModal } from '../components/FaceCameraModal';
import { EmployeeAttendanceHistoryModal } from '../components/EmployeeAttendanceHistoryModal';
import { removeFaceBiometrics } from '../services/kioskService';

export const HRAdminPortalView: React.FC = () => {
  const { addToast } = useToast();
  
  // Dashboard & Attendance Data
  const [dashboardData, setDashboardData] = useState<HRDashboardData | null>(null);
  const [verificationFailures, setVerificationFailures] = useState<VerificationFailureLog[]>([]);
  const [logs, setLogs] = useState<BiometricLog[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [faceKioskOpen, setFaceKioskOpen] = useState(false);

  // Filters
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterBranchId, setFilterBranchId] = useState<number | undefined>();
  const [filterDepartmentId, setFilterDepartmentId] = useState<number | undefined>();
  const [searchQuery, setSearchQuery] = useState('');

  // Tabs
  const [activeTab, setActiveTab] = useState('attendance_roster');

  // Revoke Face ID Target
  const [selectedUserForReset, setSelectedUserForReset] = useState<User | null>(null);

  // Enroll / Re-enroll Pure Camera Target
  const [selectedUserForEnroll, setSelectedUserForEnroll] = useState<User | null>(null);
  const [registerNewFaceOpen, setRegisterNewFaceOpen] = useState(false);

  // Employee Attendance History Target
  const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState<{ userId: number; name: string; code?: string } | null>(null);

  const loadReferenceData = async () => {
    try {
      const [brs, depts] = await Promise.all([
        api.getBranches().catch(() => []),
        api.getDepartments().catch(() => [])
      ]);
      setBranches(brs);
      setDepartments(depts);
    } catch {
      // handled
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [dash, failures, logData, empData] = await Promise.all([
        api.getHRDashboard({
          date: filterDate,
          branch_id: filterBranchId,
          department_id: filterDepartmentId,
          search: searchQuery || undefined
        }).catch(() => null),
        api.getVerificationFailures().catch(() => []),
        api.getBiometricLogs().catch(() => []),
        api.getEmployees().catch(() => [])
      ]);

      setDashboardData(dash);
      setVerificationFailures(failures);
      setLogs(logData);
      setEmployees(empData);
    } catch (err: any) {
      addToast({
        title: 'Error loading HR Admin dashboard',
        description: err.message,
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [filterDate, filterBranchId, filterDepartmentId, searchQuery]);

  const handleResetFaceId = async () => {
    if (!selectedUserForReset) return;
    try {
      try {
        await removeFaceBiometrics(String(selectedUserForReset.id));
      } catch {
        await api.resetFaceId(selectedUserForReset.id);
      }
      addToast({
        title: 'Biometric Enrollment Revoked',
        description: `Face ID template for ${selectedUserForReset.first_name} ${selectedUserForReset.last_name} revoked via authorized RPC. Employee may re-enroll.`,
        type: 'warning'
      });
      setSelectedUserForReset(null);
      loadDashboardData();
    } catch (err: any) {
      addToast({
        title: 'Revocation failed',
        description: err.message,
        type: 'danger'
      });
    }
  };

  const exportAttendanceCSV = () => {
    if (!dashboardData?.employees) return;
    const titleBlock = [
      '# FlowPeople by FlowCraft — HR Admin Attendance Roster',
      `# Date: ${dashboardData.date}`,
      `# Generated: ${new Date().toISOString()}`,
      ''
    ].join('\n');
    const headers = ['Employee Code', 'Full Name', 'Department', 'Branch', 'Status', 'First In', 'Last Out', 'Worked (Mins)', 'Late (Mins)', 'Punches'];
    const rows = dashboardData.employees.map(e => [
      e.employee_code,
      `"${e.full_name}"`,
      `"${e.department_name || '—'}"`,
      `"${e.branch_name || '—'}"`,
      e.status,
      e.first_check_in ? new Date(e.first_check_in).toLocaleTimeString() : '--',
      e.last_check_out ? new Date(e.last_check_out).toLocaleTimeString() : '--',
      e.total_work_minutes,
      e.late_in_minutes,
      e.punch_count
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(titleBlock + '\n' + [headers, ...rows].map(r => r.join(',')).join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `HR_Attendance_Roster_${dashboardData.date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderRoleBadge = (role?: string, roleTitle?: string) => {
    const norm = (role || '').toUpperCase();
    let label = roleTitle || role || 'Staff Employee';
    let colorClasses = 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';

    if (norm.includes('SUPER') || norm === 'COMPANY_ADMIN') {
      colorClasses = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      label = roleTitle || 'Company Admin';
    } else if (norm.includes('HR_ADMIN') || norm === 'ADMIN') {
      colorClasses = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      label = roleTitle || 'HR Administrator';
    } else if (norm.includes('HR')) {
      colorClasses = 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
      label = roleTitle || 'HR Executive';
    } else if (norm.includes('MANAGER')) {
      colorClasses = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
      label = roleTitle || 'Team Manager';
    } else if (norm.includes('PAYROLL')) {
      colorClasses = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      label = roleTitle || 'Payroll Admin';
    } else if (norm.includes('AUDITOR')) {
      colorClasses = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      label = roleTitle || 'Auditor';
    }

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${colorClasses}`}>
        {label}
      </span>
    );
  };

  // Live Attendance Columns
  const attendanceColumns = [
    {
      key: 'full_name',
      header: 'Employee & Identity',
      render: (emp: HRDashboardEmployee) => (
        <div className="flex items-center gap-3">
          <Avatar name={emp.full_name} src={emp.avatar_url} size="md" />
          <div>
            <span className="font-bold text-sm text-[var(--text-main)] block">{emp.full_name}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--text-subtle)] font-medium">
                {emp.employee_code}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Assigned Role',
      render: (emp: HRDashboardEmployee) => renderRoleBadge(emp.role, emp.role_title),
    },
    {
      key: 'department_name',
      header: 'Department / Branch',
      render: (emp: HRDashboardEmployee) => (
        <div>
          <span className="text-xs font-medium text-[var(--text-main)] block">{emp.department_name}</span>
          <span className="text-[11px] text-[var(--text-subtle)]">{emp.branch_name}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status Today',
      render: (emp: HRDashboardEmployee) => {
        if (emp.status === 'CHECKED_IN') {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Checked In</span>
            </span>
          );
        }
        if (emp.status === 'PRESENT') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Check className="w-3 h-3" />
              <span>Completed</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-500 border border-slate-500/20">
            Absent
          </span>
        );
      },
    },
    {
      key: 'first_check_in',
      header: 'First In',
      render: (emp: HRDashboardEmployee) => (
        <span className="font-mono text-xs text-[var(--text-secondary)] font-medium">
          {emp.first_check_in ? new Date(emp.first_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
      ),
    },
    {
      key: 'last_check_out',
      header: 'Last Out',
      render: (emp: HRDashboardEmployee) => (
        <span className="font-mono text-xs text-[var(--text-secondary)] font-medium">
          {emp.last_check_out ? new Date(emp.last_check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
      ),
    },
    {
      key: 'total_work_minutes',
      header: 'Duration',
      render: (emp: HRDashboardEmployee) => {
        const hrs = Math.floor(emp.total_work_minutes / 60);
        const mins = emp.total_work_minutes % 60;
        return (
          <span className="font-mono text-xs font-semibold text-[var(--text-main)]">
            {hrs}h {mins}m
          </span>
        );
      },
    },
    {
      key: 'late_in_minutes',
      header: 'Late',
      render: (emp: HRDashboardEmployee) => (
        emp.late_in_minutes > 0 ? (
          <span className="font-mono text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            +{emp.late_in_minutes}m
          </span>
        ) : (
          <span className="text-[11px] text-[var(--text-subtle)]">On time</span>
        )
      ),
    },
    {
      key: 'punch_count',
      header: 'Punches',
      align: 'right' as const,
      render: (emp: HRDashboardEmployee) => (
        <span className="font-mono text-xs font-semibold text-[var(--text-secondary)] px-2 py-0.5 rounded bg-[var(--surface-hover)] border border-[var(--border-subtle)]">
          {emp.punch_count}
        </span>
      ),
    },
    {
      key: 'has_face_enrolled',
      header: 'Face Biometrics',
      render: (emp: HRDashboardEmployee) => (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
          emp.has_face_enrolled
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
        }`}>
          <Camera className="w-3 h-3" />
          <span>{emp.has_face_enrolled ? 'Enrolled' : 'Pending'}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Ledger',
      align: 'right' as const,
      render: (emp: HRDashboardEmployee) => (
        <button
          onClick={() => setSelectedEmployeeForHistory({
            userId: emp.user_id,
            name: emp.full_name,
            code: emp.employee_code
          })}
          className="px-2.5 py-1 text-xs font-medium rounded-md border border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition inline-flex items-center gap-1.5 shadow-2xs"
          title="View Employee Daily Attendance Ledger"
        >
          <Calendar className="w-3 h-3 text-teal-500" />
          <span>History</span>
        </button>
      ),
    },
  ];

  // Employee Biometrics Registry Columns
  const employeeRegistryColumns = [
    {
      key: 'name',
      header: 'Employee & Identity',
      render: (emp: User) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${emp.first_name} ${emp.last_name}`} src={emp.avatar_url} size="md" />
          <div>
            <span className="font-bold text-sm text-[var(--text-main)] block">{emp.first_name} {emp.last_name}</span>
            <span className="text-[11px] text-[var(--text-subtle)] font-mono">{emp.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'employee_code',
      header: 'Employee ID',
      render: (emp: User) => (
        <span className="font-mono text-xs text-[var(--text-main)] font-semibold px-2 py-0.5 rounded bg-[var(--surface-hover)] border border-[var(--border-subtle)]">
          {emp.employee_code}
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Assigned Role',
      render: (emp: User) => (
        <div>
          {renderRoleBadge(emp.role, emp.role_title)}
          {emp.designation_name && (
            <span className="text-[11px] text-[var(--text-subtle)] block mt-0.5">{emp.designation_name}</span>
          )}
        </div>
      ),
    },
    {
      key: 'department_name',
      header: 'Department / Branch',
      render: (emp: User) => (
        <div>
          <span className="text-xs font-medium text-[var(--text-main)] block">{emp.department_name || '—'}</span>
          <span className="text-[11px] text-[var(--text-subtle)]">{emp.branch_name || 'Headquarters'}</span>
        </div>
      ),
    },
    {
      key: 'biometric_status',
      header: 'Face ID Biometrics',
      render: (emp: User) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
          emp.has_face_enrolled 
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
        }`}>
          <Camera className="w-3 h-3" />
          <span>{emp.has_face_enrolled ? 'Enrolled & Active' : 'Not Registered'}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Face Enrollment Actions',
      align: 'right' as const,
      render: (emp: User) => (
        <div className="flex items-center justify-end gap-1.5">
          {!emp.has_face_enrolled ? (
            <button
              onClick={() => setSelectedUserForEnroll(emp)}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Add Employee Face ID into Company Database"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>+ Add Face</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSelectedUserForEnroll(emp)}
                className="px-2.5 py-1 text-xs font-semibold rounded-md border border-teal-500/30 hover:bg-teal-500/10 text-teal-600 dark:text-teal-400 transition inline-flex items-center gap-1 cursor-pointer"
                title="Update Employee Face Biometric Vector"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Update Face</span>
              </button>
              <button
                onClick={() => setSelectedUserForReset(emp)}
                className="px-2.5 py-1 text-xs font-semibold rounded-md border border-rose-500/30 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition inline-flex items-center gap-1 cursor-pointer"
                title="Revoke Biometric Template"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Revoke</span>
              </button>
            </div>
          )}
        </div>
      ),
    },
  ];

  // Verification Failures Columns
  const failureColumns = [
    {
      key: 'employee_name',
      header: 'Employee',
      render: (f: VerificationFailureLog) => (
        <div>
          <span className="font-semibold text-xs text-[var(--text-main)] block">{f.employee_name}</span>
          <span className="font-mono text-[11px] text-[var(--text-subtle)]">{f.employee_code} • {f.department_name || 'General'}</span>
        </div>
      ),
    },
    {
      key: 'attempt_type',
      header: 'Action',
      render: (f: VerificationFailureLog) => (
        <span className="font-mono text-xs text-[var(--text-secondary)] font-medium">
          {f.attempt_type}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Security Result',
      render: (f: VerificationFailureLog) => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <ShieldAlert className="w-2.5 h-2.5" />
          <span>{f.status}</span>
        </span>
      ),
    },
    {
      key: 'confidence_score',
      header: 'Confidence Score',
      render: (f: VerificationFailureLog) => (
        <div className="font-mono text-xs">
          <span className="text-[var(--text-main)] font-semibold">
            {f.confidence_score ? `${(f.confidence_score * 100).toFixed(1)}% match` : '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'failure_reason',
      header: 'Reason / Terminal',
      render: (f: VerificationFailureLog) => (
        <div>
          <span className="text-xs text-[var(--text-main)] font-medium block">{f.failure_reason || 'Biometric security mismatch'}</span>
          <span className="text-[10px] text-[var(--text-subtle)]">{f.device_info || 'Optical Kiosk Terminal'}</span>
        </div>
      ),
    },
    {
      key: 'timestamp',
      header: 'Timestamp',
      align: 'right' as const,
      render: (f: VerificationFailureLog) => (
        <span className="font-mono text-xs text-[var(--text-subtle)]">
          {new Date(f.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="HR Administration & Attendance Portal"
        description="Authoritative real-time attendance KPIs, employee presence roster, Face ID biometric registry, and optical security audits."
        action={
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-start sm:justify-end">
            <button
              onClick={() => setRegisterNewFaceOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-bold text-white transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>+ Register New Face ID</span>
            </button>
            <button
              onClick={() => setFaceKioskOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Scan className="w-3.5 h-3.5" />
              <span>Face Kiosk Terminal</span>
            </button>
            <button
              onClick={exportAttendanceCSV}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-xs font-semibold text-[var(--text-main)] transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Daily Roster</span>
            </button>
          </div>
        }
      />

      {/* 8 Real-time Aggregated KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        <StatCard
          label="Total Headcount"
          value={dashboardData?.total_employees ?? employees.length}
          subtext="Active workforce"
          icon={<Users className="w-3.5 h-3.5" />}
        />
        <StatCard
          label="Present Today"
          value={dashboardData?.present_today ?? 0}
          subtext="Logged in roster"
          icon={<UserCheck className="w-3.5 h-3.5" />}
        />
        <StatCard
          label="Absent Today"
          value={dashboardData?.absent_today ?? 0}
          subtext="No punch today"
          icon={<AlertCircle className="w-3.5 h-3.5" />}
        />
        <StatCard
          label="Late Arrivals"
          value={dashboardData?.late_arrivals ?? 0}
          subtext="Past grace period"
          icon={<Clock className="w-3.5 h-3.5" />}
        />
        <StatCard
          label="Checked In"
          value={dashboardData?.currently_checked_in ?? 0}
          subtext="Active in-office"
          icon={<Camera className="w-3.5 h-3.5" />}
        />
        <StatCard
          label="Checked Out"
          value={dashboardData?.checked_out_today ?? 0}
          subtext="Completed shift"
          icon={<Check className="w-3.5 h-3.5" />}
        />
        <StatCard
          label="Incomplete"
          value={dashboardData?.incomplete_attendance ?? 0}
          subtext="Checked in, no out"
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
        />
        <StatCard
          label="Failed Audits"
          value={verificationFailures.length}
          subtext="Requires review"
          icon={<ShieldAlert className="w-3.5 h-3.5" />}
        />
      </div>

      {/* Filter Toolbar */}
      <GlassCard>
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Calendar className="w-4 h-4 text-[var(--text-subtle)] shrink-0" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="glass-input text-xs py-2 w-full sm:w-auto"
            />
          </div>

          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-[var(--text-subtle)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search roster by employee name or code..."
              className="w-full pl-9 pr-4 py-2 glass-input text-xs"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <select
              value={filterBranchId || ''}
              onChange={(e) => setFilterBranchId(e.target.value ? Number(e.target.value) : undefined)}
              className="glass-input text-xs py-2 min-w-[130px] flex-1 sm:flex-none"
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <select
              value={filterDepartmentId || ''}
              onChange={(e) => setFilterDepartmentId(e.target.value ? Number(e.target.value) : undefined)}
              className="glass-input text-xs py-2 min-w-[140px] flex-1 sm:flex-none"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Navigation Tabs */}
      <Tabs
        tabs={[
          { id: 'attendance_roster', label: 'Live Attendance Roster', count: dashboardData?.employees.length ?? 0 },
          { id: 'registry', label: 'Face ID Biometrics Registry', count: employees.length },
          { id: 'failures', label: 'Verification Failures Review', count: verificationFailures.length },
          { id: 'audit_logs', label: 'Full Verification Audit Trail', count: logs.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* TAB 1: Live Attendance Roster */}
      {activeTab === 'attendance_roster' && (
        <div className="space-y-4">
          {/* Real-time Live Attendance Activity Feed (Section 6-B) */}
          <GlassCard>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                    Live Attendance Activity Feed
                  </span>
                  <span className="text-[10px] text-[var(--text-subtle)] font-mono">
                    (Asia/Kolkata Optical Kiosk Stream)
                  </span>
                </div>
                <span className="text-xs text-[var(--text-subtle)] font-medium">
                  {logs.filter(l => l.attempt_type === 'IN' || l.attempt_type === 'OUT').length} punches logged
                </span>
              </div>

              {logs.filter(l => l.attempt_type === 'IN' || l.attempt_type === 'OUT').length === 0 ? (
                <div className="py-4 text-center text-xs text-[var(--text-subtle)]">
                  No attendance punches recorded yet today. Scans at the Face Kiosk will appear here in real time.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {logs
                    .filter(l => l.attempt_type === 'IN' || l.attempt_type === 'OUT')
                    .slice(0, 4)
                    .map((log) => {
                      const isPunchIn = log.attempt_type === 'IN';
                      const timeStr = new Date(log.timestamp).toLocaleTimeString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      });
                      return (
                        <div
                          key={log.id}
                          className="p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)]/40 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-[var(--text-main)] truncate block">
                              {log.user_name}
                            </span>
                            <span className="text-[10px] font-mono text-[var(--text-subtle)]">
                              {timeStr} &bull; {(log.confidence_score * 100).toFixed(0)}% match
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 border ${
                              isPunchIn
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                            }`}
                          >
                            {isPunchIn ? 'Check-In' : 'Check-Out'}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </GlassCard>

          <DataTable
            columns={attendanceColumns}
            data={dashboardData?.employees || []}
            searchPlaceholder="Filter listed roster..."
          />
        </div>
      )}

      {/* TAB 2: Biometrics Registry */}
      {activeTab === 'registry' && (
        <div className="space-y-4">
          <GlassCard>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Company Face Biometric Enrollment Portal</span>
                </h4>
                <p className="text-xs text-[var(--text-subtle)] mt-1 max-w-2xl">
                  Scan any employee's face with the optical camera, fill their profile details, and save. Enrolled employees can clock in/out instantly on the Kiosk.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 flex-wrap">
                <button
                  onClick={() => setRegisterNewFaceOpen(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-bold text-xs shadow-md shadow-teal-500/20 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  <Camera className="w-4 h-4 text-slate-950" />
                  <span>+ Register New Employee Face ID</span>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20 whitespace-nowrap">
                    {employees.filter(e => e.has_face_enrolled).length} Enrolled
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20 whitespace-nowrap">
                    {employees.filter(e => !e.has_face_enrolled).length} Pending Face
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>

          {employees.length === 0 ? (
            <GlassCard>
              <div className="py-12 text-center text-xs text-[var(--text-subtle)] space-y-3">
                <Camera className="w-10 h-10 mx-auto text-teal-500 opacity-80" />
                <div className="space-y-1">
                  <p className="font-semibold text-sm text-[var(--text-main)]">No Employees in Registry</p>
                  <p>Register your first employee with live facial recognition scan and personal profile details.</p>
                </div>
                <button
                  onClick={() => setRegisterNewFaceOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition cursor-pointer inline-flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>+ Register New Employee Face ID</span>
                </button>
              </div>
            </GlassCard>
          ) : (
            <DataTable
              columns={employeeRegistryColumns}
              data={employees}
              searchPlaceholder="Search enrolled personnel..."
              filterKey="department_name"
            />
          )}
        </div>
      )}

      {/* TAB 3: Verification Failures Review */}
      {activeTab === 'failures' && (
        <div>
          {verificationFailures.length === 0 ? (
            <GlassCard>
              <div className="py-12 text-center text-xs text-[var(--text-subtle)] space-y-1">
                <ShieldCheck className="w-8 h-8 mx-auto text-emerald-500 opacity-80" />
                <p className="font-semibold text-sm text-[var(--text-main)]">Zero Verification Failures</p>
                <p>All biometric optical punches match encrypted employee facial templates with high confidence.</p>
              </div>
            </GlassCard>
          ) : (
            <DataTable
              columns={failureColumns}
              data={verificationFailures}
              searchPlaceholder="Filter verification failure alerts..."
            />
          )}
        </div>
      )}

      {/* TAB 4: Full Audit Trail */}
      {activeTab === 'audit_logs' && (
        <DataTable
          columns={[
            {
              key: 'user_name',
              header: 'Subject',
              render: (l: BiometricLog) => (
                <span className="font-semibold text-xs text-[var(--text-main)]">{l.user_name}</span>
              ),
            },
            {
              key: 'attempt_type',
              header: 'Action',
              render: (l: BiometricLog) => (
                <span className="font-mono text-xs text-[var(--text-secondary)]">{l.attempt_type}</span>
              ),
            },
            {
              key: 'confidence_score',
              header: 'Confidence',
              render: (l: BiometricLog) => (
                <span className="font-mono text-xs font-semibold text-[var(--text-main)]">
                  {(l.confidence_score * 100).toFixed(1)}%
                </span>
              ),
            },
            {
              key: 'device_info',
              header: 'Terminal Device',
              render: (l: BiometricLog) => (
                <span className="text-xs text-[var(--text-secondary)] font-mono">
                  {l.device_info || 'Optical Terminal'}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Result',
              render: (l: BiometricLog) => <StatusBadge status={l.status} />,
            },
            {
              key: 'timestamp',
              header: 'Timestamp',
              align: 'right' as const,
              render: (l: BiometricLog) => (
                <span className="font-mono text-xs text-[var(--text-subtle)]">
                  {new Date(l.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              ),
            },
          ]}
          data={logs}
          searchPlaceholder="Search audit events..."
        />
      )}

      {/* Confirm Revoke Dialog */}
      <ConfirmDialog
        isOpen={!!selectedUserForReset}
        onClose={() => setSelectedUserForReset(null)}
        onConfirm={handleResetFaceId}
        title="Revoke Face ID Biometric Template"
        message={`Are you sure you want to revoke the registered biometric facial template for ${selectedUserForReset?.first_name} ${selectedUserForReset?.last_name}? The user will be required to re-enroll their optical biometric template before checking in with Face ID.`}
        confirmText="Revoke Biometric Template"
        type="danger"
      />

      {/* Face Kiosk Modal */}
      <FaceKioskModal
        isOpen={faceKioskOpen}
        onClose={() => setFaceKioskOpen(false)}
        onPunchRecorded={loadDashboardData}
      />

      {/* Pure-Camera Face ID Enrollment Modal */}
      {(selectedUserForEnroll || registerNewFaceOpen) && (
        <FaceCameraModal
          isOpen={!!selectedUserForEnroll || registerNewFaceOpen}
          onClose={() => {
            setSelectedUserForEnroll(null);
            setRegisterNewFaceOpen(false);
          }}
          mode="ENROLL"
          targetUserId={selectedUserForEnroll?.id}
          targetUserName={selectedUserForEnroll ? `${selectedUserForEnroll.first_name} ${selectedUserForEnroll.last_name}` : undefined}
          initialEmployeeData={selectedUserForEnroll || undefined}
          onSuccess={(data) => {
            addToast({
              title: 'Face ID Biometrics Registered',
              description: selectedUserForEnroll
                ? `Face ID updated for ${selectedUserForEnroll.first_name} ${selectedUserForEnroll.last_name}.`
                : `Successfully registered new employee ${data?.first_name || ''} ${data?.last_name || ''} with Face ID.`,
              type: 'success'
            });
            setSelectedUserForEnroll(null);
            setRegisterNewFaceOpen(false);
            loadDashboardData();
          }}
        />
      )}

      {/* Employee Attendance History Ledger Modal */}
      <EmployeeAttendanceHistoryModal
        isOpen={!!selectedEmployeeForHistory}
        onClose={() => setSelectedEmployeeForHistory(null)}
        userId={selectedEmployeeForHistory?.userId || null}
        employeeName={selectedEmployeeForHistory?.name || ''}
        employeeCode={selectedEmployeeForHistory?.code}
      />
    </div>
  );
};
