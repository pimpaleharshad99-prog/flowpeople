import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  UserPlus, 
  Mail, 
  Phone, 
  Building2, 
  Briefcase, 
  LayoutGrid, 
  List, 
  Calendar,
  CheckCircle2, 
  Shield, 
  Clock, 
  Send, 
  Copy, 
  RotateCcw, 
  Camera, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  UserCheck, 
  MapPin, 
  AlertCircle,
  Sparkles,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { api, User, Branch } from '../services/api';
import { 
  PageHeader, 
  StatCard, 
  GlassCard, 
  DataTable, 
  StatusBadge, 
  Drawer, 
  Modal, 
  useToast, 
  Avatar, 
  Tabs,
  ConfirmDialog
} from '../components/ui';
import { FaceCameraModal } from '../components/FaceCameraModal';
import { removeFaceBiometrics, APPROVED_BIOMETRIC_MODEL, ACTIVE_MODEL_VERSION } from '../services/kioskService';

interface DirectoryViewProps {
  currentUser: User | null;
}

interface StepForm {
  // Step 1: Basic Information
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  avatar_url: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;

  // Step 2: Employment Information
  employee_code: string;
  branch_id: string;
  department_id: string;
  designation_id: string;
  manager_id: string;
  employment_type: string;
  date_of_joining: string;
  shift_id: string;
  work_location: string;

  // Step 3: Role & Access Assignment
  role: string;
  submit_mode: 'INVITE' | 'DRAFT';
}

const INITIAL_FORM: StepForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  gender: 'Prefer not to say',
  avatar_url: '',
  address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',

  employee_code: '',
  branch_id: '',
  department_id: '',
  designation_id: '',
  manager_id: '',
  employment_type: 'FULL_TIME',
  date_of_joining: new Date().toISOString().split('T')[0],
  shift_id: '',
  work_location: 'Headquarters',

  role: 'EMPLOYEE',
  submit_mode: 'INVITE',
};

const ROLE_DESCRIPTIONS: Record<string, { label: string; desc: string; color: string }> = {
  EMPLOYEE: {
    label: 'Standard Employee',
    desc: 'Self-service portal access for Face ID attendance, leaves, shifts, and personal tasks.',
    color: 'border-slate-500/30'
  },
  MANAGER: {
    label: 'Team Manager',
    desc: 'Direct report attendance tracking, shift scheduling, leave approvals, and team reviews.',
    color: 'border-[#DFE1D8]'
  },
  HR_EXECUTIVE: {
    label: 'HR Executive',
    desc: 'Employee directory access, attendance regularizations, onboarding coordination, and helpdesk.',
    color: 'border-[#DFE1D8]'
  },
  HR_ADMIN: {
    label: 'HR Administrator',
    desc: 'Full workforce governance, policy controls, biometric resets, department structuring, and audits.',
    color: 'border-[#DFE1D8]'
  },
  PAYROLL_ADMIN: {
    label: 'Payroll Administrator',
    desc: 'Attendance-to-payroll export, overtime reconciliation, and statutory compliance.',
    color: 'border-amber-500/30'
  },
  AUDITOR: {
    label: 'Compliance Auditor',
    desc: 'Read-only access to biometric event logs, anti-spoof records, and enterprise audit trails.',
    color: 'border-[#DFE1D8]'
  },
  COMPANY_ADMIN: {
    label: 'Company Administrator',
    desc: 'Comprehensive administrative authority over all branch locations, users, and organization settings.',
    color: 'border-[#DFE1D8]'
  },
  SUPER_ADMIN: {
    label: 'Super Admin',
    desc: 'Full multi-tenant authority, database maintenance, system health, and global infrastructure.',
    color: 'border-rose-500/30'
  }
};

export const DirectoryView: React.FC<DirectoryViewProps> = ({ currentUser }) => {
  const { addToast } = useToast();
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<number | undefined>();
  const [selectedBranch, setSelectedBranch] = useState<number | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Profile Drawer State
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [profileTab, setProfileTab] = useState('overview');

  // Multi-step Add Employee Wizard
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [formData, setFormData] = useState<StepForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [nextCodePreview, setNextCodePreview] = useState<string>('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Biometric Face ID Modal for self or user
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [faceModalTargetUser, setFaceModalTargetUser] = useState<User | null>(null);

  // Confirm Revoke Face ID
  const [revokeTargetUser, setRevokeTargetUser] = useState<User | null>(null);

  // Face Attendance Profile Sub-state (Section 6)
  const [employeeConsentChecked, setEmployeeConsentChecked] = useState(false);
  const [cameraCheckResult, setCameraCheckResult] = useState<'IDLE' | 'CHECKING' | 'AVAILABLE' | 'UNAVAILABLE'>('IDLE');

  const checkCameraAvailability = async () => {
    setCameraCheckResult('CHECKING');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraCheckResult('UNAVAILABLE');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach((t) => t.stop());
      setCameraCheckResult('AVAILABLE');
    } catch {
      setCameraCheckResult('UNAVAILABLE');
    }
  };

  const loadReferenceData = async () => {
    try {
      const [depts, desigs, brs, shs] = await Promise.all([
        api.getDepartments().catch(() => []),
        api.getDesignations().catch(() => []),
        api.getBranches().catch(() => []),
        api.getShifts().catch(() => [])
      ]);
      setDepartments(depts);
      setDesignations(desigs);
      setBranches(brs);
      setShifts(shs);
    } catch {
      // handled
    }
  };

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const data = await api.getEmployees({
        department_id: selectedDept,
        search: search || undefined,
        status: selectedStatus === 'ALL' ? undefined : selectedStatus
      });
      setEmployees(data);
    } catch (err: any) {
      addToast({
        title: 'Error loading directory',
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
    loadEmployees();
  }, [selectedDept, selectedBranch, selectedStatus, search]);

  const openAddEmployeeModal = async () => {
    try {
      const codeRes = await api.getNextEmployeeCode();
      setNextCodePreview(codeRes.next_code);
      setFormData({
        ...INITIAL_FORM,
        employee_code: codeRes.next_code,
        branch_id: branches.length > 0 ? String(branches[0].id) : '',
        department_id: departments.length > 0 ? String(departments[0].id) : '',
        designation_id: designations.length > 0 ? String(designations[0].id) : '',
        shift_id: shifts.length > 0 ? String(shifts[0].id) : ''
      });
      setCurrentStep(1);
      setIsAddModalOpen(true);
    } catch (err: any) {
      addToast({
        title: 'Could not fetch employee ID sequence',
        description: err.message,
        type: 'danger'
      });
    }
  };

  const handleStepSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as any);
      return;
    }

    // Step 4: Final Submission
    try {
      setSubmitting(true);
      const payload: any = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        gender: formData.gender,
        avatar_url: formData.avatar_url || undefined,
        address: formData.address || undefined,
        emergency_contact_name: formData.emergency_contact_name || undefined,
        emergency_contact_phone: formData.emergency_contact_phone || undefined,

        employee_code: formData.employee_code.trim() || undefined,
        branch_id: formData.branch_id ? Number(formData.branch_id) : undefined,
        department_id: formData.department_id ? Number(formData.department_id) : undefined,
        designation_id: formData.designation_id ? Number(formData.designation_id) : undefined,
        manager_id: formData.manager_id ? Number(formData.manager_id) : undefined,
        employment_type: formData.employment_type,
        date_of_joining: formData.date_of_joining,
        shift_id: formData.shift_id ? Number(formData.shift_id) : undefined,
        work_location: formData.work_location,

        role: formData.role,
        status: formData.submit_mode === 'DRAFT' ? 'DRAFT' : 'PENDING_INVITATION'
      };

      const newEmp = await api.createEmployee(payload);

      let inviteResult: any = null;
      if (formData.submit_mode === 'INVITE') {
        try {
          inviteResult = await api.inviteEmployee(newEmp.id);
        } catch (inviteErr: any) {
          console.warn('Invite email delivery notice:', inviteErr);
        }
      }

      addToast({
        title: formData.submit_mode === 'INVITE' ? 'Employee Onboarded & Invited' : 'Employee Saved as Draft',
        description: `${newEmp.first_name} ${newEmp.last_name} (${newEmp.employee_code}) was registered successfully.${inviteResult ? ' Invitation link generated.' : ''}`,
        type: 'success'
      });

      setIsAddModalOpen(false);
      loadEmployees();
    } catch (err: any) {
      addToast({
        title: 'Employee Onboarding Failed',
        description: err.message,
        type: 'danger'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendInvite = async (emp: User) => {
    try {
      const res = await api.inviteEmployee(emp.id);
      addToast({
        title: 'Invitation Sent',
        description: `Activation token generated for ${emp.first_name}. Token: ${res.invitation_token.substring(0, 12)}...`,
        type: 'success'
      });
      loadEmployees();
      if (selectedEmployee?.id === emp.id) {
        setSelectedEmployee({ ...emp, status: 'INVITED', invitation_token: res.invitation_token });
      }
    } catch (err: any) {
      addToast({
        title: 'Failed to send invitation',
        description: err.message,
        type: 'danger'
      });
    }
  };

  const handleResendInvite = async (emp: User) => {
    try {
      const res = await api.resendInvite(emp.id);
      addToast({
        title: 'Invitation Reissued',
        description: `New activation token issued for ${emp.first_name}.`,
        type: 'success'
      });
      loadEmployees();
      if (selectedEmployee?.id === emp.id) {
        setSelectedEmployee({ ...emp, status: 'INVITED', invitation_token: res.invitation_token });
      }
    } catch (err: any) {
      addToast({
        title: 'Failed to resend invitation',
        description: err.message,
        type: 'danger'
      });
    }
  };

  const handleCopyInviteLink = (token?: string) => {
    if (!token) return;
    const url = `${window.location.origin}/activate?token=${encodeURIComponent(token)}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
    addToast({
      title: 'Invitation Link Copied',
      description: 'The secure onboarding URL has been copied to your clipboard.',
      type: 'success'
    });
  };

  const handleConfirmRevokeFaceId = async () => {
    if (!revokeTargetUser) return;
    try {
      try {
        await removeFaceBiometrics(String(revokeTargetUser.id));
      } catch {
        // Fallback to backend API
        await api.resetFaceId(revokeTargetUser.id);
      }
      addToast({
        title: 'Face ID Template Revoked',
        description: `Biometric optical enrollment for ${revokeTargetUser.first_name} ${revokeTargetUser.last_name} has been revoked via authorized RPC. Re-enrollment is required.`,
        type: 'warning'
      });
      setRevokeTargetUser(null);
      loadEmployees();
      if (selectedEmployee?.id === revokeTargetUser.id) {
        setSelectedEmployee({ ...selectedEmployee, has_face_enrolled: false });
      }
    } catch (err: any) {
      addToast({
        title: 'Revocation failed',
        description: err.message,
        type: 'danger'
      });
    }
  };

  const isHRorAdmin = 
    currentUser?.role === 'SUPER_ADMIN' || 
    currentUser?.role === 'COMPANY_ADMIN' || 
    currentUser?.role === 'HR_ADMIN' || 
    currentUser?.role === 'HR_EXECUTIVE';

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const tableColumns = [
    {
      key: 'name',
      header: 'Employee',
      render: (emp: User) => (
        <div 
          onClick={() => setSelectedEmployee(emp)}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <Avatar name={`${emp.first_name} ${emp.last_name}`} src={emp.avatar_url} size="sm" />
          <div>
            <span className="font-medium text-xs text-[var(--text-main)] group-hover:text-[var(--accent)] transition block">
              {emp.first_name} {emp.last_name}
            </span>
            <span className="text-[11px] text-[var(--text-subtle)] font-mono">{emp.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'employee_code',
      header: 'Employee ID',
      render: (emp: User) => (
        <span className="text-xs text-[var(--text-secondary)] font-mono font-medium px-2 py-0.5 rounded-md bg-[var(--surface-hover)] border border-[var(--border-subtle)]">
          {emp.employee_code}
        </span>
      ),
    },
    {
      key: 'department_name',
      header: 'Department',
      render: (emp: User) => (
        <span className="text-xs text-[var(--text-secondary)]">{emp.department_name || '—'}</span>
      ),
    },
    {
      key: 'designation_name',
      header: 'Designation',
      render: (emp: User) => (
        <span className="text-xs text-[var(--text-main)] font-medium">{emp.designation_name || 'Staff'}</span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (emp: User) => (
        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[var(--surface-glass)] text-[var(--text-secondary)] border border-[var(--border-glass)]">
          {emp.role.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'face_status',
      header: 'Face ID',
      render: (emp: User) => (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
          emp.has_face_enrolled 
            ? 'bg-[#ECEEE7] text-[#4A5A3F] border border-[#C8CAC0]' 
            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
        }`}>
          <Camera className="w-2.5 h-2.5" />
          <span>{emp.has_face_enrolled ? 'Enrolled' : 'Not Enrolled'}</span>
        </span>
      )
    },
    {
      key: 'status',
      header: 'Account Status',
      render: (emp: User) => <StatusBadge status={emp.status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (emp: User) => (
        <div className="flex items-center justify-end gap-1.5">
          {(emp.status === 'PENDING_INVITATION' || emp.status === 'DRAFT') && isHRorAdmin && (
            <button
              onClick={() => handleSendInvite(emp)}
              className="px-2 py-1 text-[11px] font-medium rounded-md bg-[var(--accent)] text-white hover:opacity-90 transition inline-flex items-center gap-1 shadow-2xs"
              title="Generate activation invite"
            >
              <Send className="w-3 h-3" />
              <span>Invite</span>
            </button>
          )}

          {emp.status === 'INVITED' && isHRorAdmin && (
            <button
              onClick={() => handleResendInvite(emp)}
              className="px-2 py-1 text-[11px] font-medium rounded-md border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition inline-flex items-center gap-1"
              title="Resend activation invite"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Resend</span>
            </button>
          )}

          <button
            onClick={() => setSelectedEmployee(emp)}
            className="px-2.5 py-1 text-xs font-medium rounded-md border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition"
          >
            Profile
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Employee Directory"
        description="Comprehensive enterprise workforce roster, multi-step onboarding, automatic ID sequencing, and Face ID biometric management."
        action={
          <div className="flex items-center gap-3">
            <div className="flex p-0.5 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-glass)]">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md text-xs transition ${
                  viewMode === 'grid' 
                    ? 'bg-[var(--surface-hover)] text-[var(--accent)] font-medium shadow-2xs' 
                    : 'text-[var(--text-subtle)]'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md text-xs transition ${
                  viewMode === 'list' 
                    ? 'bg-[var(--surface-hover)] text-[var(--accent)] font-medium shadow-2xs' 
                    : 'text-[var(--text-subtle)]'
                }`}
                title="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {isHRorAdmin && (
              <button
                onClick={openAddEmployeeModal}
                className="px-3.5 py-1.5 rounded-lg bg-[var(--accent)] hover:opacity-90 text-white text-xs font-medium shadow-sm transition inline-flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Employee</span>
              </button>
            )}
          </div>
        }
      />

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Workforce"
          value={employees.length}
          subtext="Configured company roster"
          icon={<Users className="w-4 h-4" />}
        />
        <StatCard
          label="Active Accounts"
          value={employees.filter(e => e.status === 'ACTIVE').length}
          subtext="Authenticated personnel"
          trend={{ value: 'Full platform access', positive: true }}
          icon={<UserCheck className="w-4 h-4" />}
        />
        <StatCard
          label="Biometric Enrolled"
          value={`${employees.filter(e => e.has_face_enrolled).length} / ${employees.length}`}
          subtext="Face ID verified"
          trend={{ value: `${Math.round((employees.filter(e => e.has_face_enrolled).length / (employees.length || 1)) * 100)}% coverage`, positive: true }}
          icon={<Camera className="w-4 h-4" />}
        />
        <StatCard
          label="Pending Invitations"
          value={employees.filter(e => e.status === 'INVITED' || e.status === 'PENDING_INVITATION').length}
          subtext="Awaiting user activation"
          icon={<Send className="w-4 h-4" />}
        />
      </div>

      {/* Filter Toolbar */}
      <GlassCard>
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-[var(--text-subtle)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by employee name, code (FP-2026-XXXX), or email..."
              className="w-full pl-9 pr-4 py-2 glass-input text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select
              value={selectedDept || ''}
              onChange={(e) => setSelectedDept(e.target.value ? Number(e.target.value) : undefined)}
              className="glass-input text-xs py-2 min-w-[140px]"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="glass-input text-xs py-2 min-w-[130px]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INVITED">Invited</option>
              <option value="PENDING_INVITATION">Pending Invite</option>
              <option value="DRAFT">Draft</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Grid or Table Mode */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {employees.map((emp) => (
            <GlassCard 
              key={emp.id} 
              className="text-center cursor-pointer hover:border-[var(--accent)] transition relative group"
            >
              <div onClick={() => setSelectedEmployee(emp)} className="space-y-3">
                <div className="flex justify-center relative">
                  <Avatar 
                    name={`${emp.first_name} ${emp.last_name}`} 
                    src={emp.avatar_url} 
                    size="lg" 
                  />
                  {emp.has_face_enrolled && (
                    <span 
                      className="absolute bottom-0 right-1/2 translate-x-5 p-1 rounded-full bg-[#4A5A3F] text-white shadow-xs" 
                      title="Face ID Enrolled & Active"
                    >
                      <Camera className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-xs text-[var(--text-main)] group-hover:text-[var(--accent)] transition">
                    {emp.first_name} {emp.last_name}
                  </h3>
                  <p className="text-[11px] text-[var(--accent)] font-medium mt-0.5">
                    {emp.designation_name || 'Staff Member'}
                  </p>
                  <p className="text-[11px] text-[var(--text-subtle)]">
                    {emp.department_name || 'General Department'}
                  </p>
                </div>

                <div className="pt-2 border-t border-[var(--border-glass)] flex items-center justify-between text-[11px]">
                  <span className="font-mono text-[var(--text-secondary)] font-medium">{emp.employee_code}</span>
                  <StatusBadge status={emp.status} />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <DataTable
          columns={tableColumns}
          data={employees}
          searchPlaceholder="Filter listed employees..."
          filterKey="department_name"
        />
      )}

      {/* Multi-Step Onboarding Wizard Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Enterprise Employee Onboarding & Registration"
        description="Comprehensive employee record creation, automatic ID sequencing, and credential dispatch"
        maxWidth="4xl"
      >
        <div className="space-y-6">
          {/* Wizard Step Indicator */}
          <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
            {[
              { num: 1, title: 'Basic Information', subtitle: 'Personal credentials' },
              { num: 2, title: 'Employment Details', subtitle: 'Role & location' },
              { num: 3, title: 'Role & Access', subtitle: 'Permissions' },
              { num: 4, title: 'Review & Confirm', subtitle: 'Dispatch account' }
            ].map((st, idx) => (
              <div key={st.num} className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm transition-all ${
                  currentStep === st.num 
                    ? 'bg-[var(--accent)] text-white shadow-md ring-2 ring-[var(--accent)]/30' 
                    : currentStep > st.num 
                    ? 'bg-[#ECEEE7] text-[#4A5A3F] font-bold border border-[#C8CAC0]' 
                    : 'bg-[var(--surface-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
                }`}>
                  {currentStep > st.num ? <Check className="w-4 h-4 stroke-[2.5]" /> : st.num}
                </div>
                <div className="hidden md:block">
                  <div className={`text-xs font-bold leading-tight ${
                    currentStep === st.num ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                  }`}>
                    {st.title}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">{st.subtitle}</div>
                </div>
                {idx < 3 && <div className="hidden lg:block w-8 h-px bg-[var(--border-subtle)] ml-2" />}
              </div>
            ))}
          </div>

          <form onSubmit={handleStepSubmit} className="space-y-6 text-sm">
            {/* STEP 1: Basic Information */}
            {currentStep === 1 && (
              <div className="p-6 rounded-2xl bg-[var(--surface-glass)]/60 border border-[var(--border-subtle)] space-y-5 shadow-xs">
                <h4 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
                  <span>Personal Identity & Contact Information</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-sm text-[var(--text-secondary)] mb-1.5">First Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Elena"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-4 py-3 text-base glass-input font-medium rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-sm text-[var(--text-secondary)] mb-1.5">Last Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rostova"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-4 py-3 text-base glass-input font-medium rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-sm text-[var(--text-secondary)] mb-1.5">Corporate Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="elena.rostova@company.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 text-base glass-input font-medium rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-sm text-[var(--text-secondary)] mb-1.5">Mobile Contact Number</label>
                    <input
                      type="tel"
                      placeholder="+1 (555) 012-3456"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 text-base glass-input font-medium rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-sm text-[var(--text-secondary)] mb-1.5">Date of Birth</label>
                    <input
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      className="w-full px-4 py-3 text-base glass-input font-medium rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-sm text-[var(--text-secondary)] mb-1.5">Gender Identification</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full px-4 py-3 text-base glass-input font-medium rounded-xl"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-sm text-[var(--text-secondary)] mb-1.5">Avatar / Profile Photo URL</label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={formData.avatar_url}
                    onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                    className="w-full px-4 py-3 text-base glass-input font-medium rounded-xl"
                  />
                </div>

                <div className="pt-4 border-t border-[var(--border-subtle)] space-y-4">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)]">
                    Emergency Contact Reference
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-sm text-[var(--text-secondary)] mb-1.5">Emergency Contact Full Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Maria Rostova (Sister)"
                        value={formData.emergency_contact_name}
                        onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                        className="w-full px-4 py-3 text-base glass-input font-medium rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-sm text-[var(--text-secondary)] mb-1.5">Emergency Contact Phone Number</label>
                      <input
                        type="tel"
                        placeholder="+1 (555) 999-0011"
                        value={formData.emergency_contact_phone}
                        onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                        className="w-full px-4 py-3 text-base glass-input font-medium rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Employment Information */}
            {currentStep === 2 && (
              <div className="p-6 rounded-2xl bg-[var(--surface-glass)]/60 border border-[var(--border-subtle)] space-y-5 shadow-xs">
                {/* Auto Generated Employee ID Display */}
                <div className="p-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-subtle)] flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase font-bold text-[var(--text-muted)] tracking-wider block">System Employee Code</span>
                    <span className="font-mono font-bold text-xl text-[var(--accent)]">{formData.employee_code || nextCodePreview}</span>
                  </div>
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-[var(--accent)] text-white shadow-xs">
                    Auto-Sequenced
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-sm text-[var(--text-secondary)] mb-1.5">Branch / Office Location *</label>
                    <select
                      value={formData.branch_id}
                      onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                      className="w-full px-4 py-3 text-base glass-input font-medium rounded-xl"
                      required
                    >
                      <option value="">Select Corporate Branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name} ({b.city || 'HQ'})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-sm text-[var(--text-secondary)] mb-1.5">Department *</label>
                    <select
                      value={formData.department_id}
                      onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                      className="w-full px-4 py-3 text-base glass-input font-medium rounded-xl"
                      required
                    >
                      <option value="">Select Department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-sm text-[var(--text-secondary)] mb-1.5">Designation / Title *</label>
                    <select
                      value={formData.designation_id}
                      onChange={(e) => setFormData({ ...formData, designation_id: e.target.value })}
                      className="w-full px-4 py-3 text-base glass-input font-medium rounded-xl"
                      required
                    >
                      <option value="">Select Designation</option>
                      {designations.map((d) => (
                        <option key={d.id} value={d.id}>{d.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-sm text-[var(--text-secondary)] mb-1.5">Reporting Manager</label>
                    <select
                      value={formData.manager_id}
                      onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                      className="w-full px-4 py-3 text-base glass-input font-medium rounded-xl"
                    >
                      <option value="">Select Reporting Manager</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-sm text-[var(--text-secondary)] mb-1.5">Employment Contract Type</label>
                    <select
                      value={formData.employment_type}
                      onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                      className="w-full px-4 py-3 text-base glass-input font-medium rounded-xl"
                    >
                      <option value="FULL_TIME">Full Time Permanent</option>
                      <option value="PART_TIME">Part Time</option>
                      <option value="CONTRACT">Contractor / Consultant</option>
                      <option value="INTERN">Internship</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-sm text-[var(--text-secondary)] mb-1.5">Date of Joining *</label>
                    <input
                      type="date"
                      required
                      value={formData.date_of_joining}
                      onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                      className="w-full px-4 py-3 text-base glass-input font-medium rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-sm text-[var(--text-secondary)] mb-1.5">Assigned Shift Schedule</label>
                    <select
                      value={formData.shift_id}
                      onChange={(e) => setFormData({ ...formData, shift_id: e.target.value })}
                      className="w-full px-4 py-3 text-base glass-input font-medium rounded-xl"
                    >
                      <option value="">Select Shift Schedule</option>
                      {shifts.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.start_time} - {s.end_time})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-sm text-[var(--text-secondary)] mb-1.5">Work Location Model</label>
                    <select
                      value={formData.work_location}
                      onChange={(e) => setFormData({ ...formData, work_location: e.target.value })}
                      className="w-full px-4 py-3 text-base glass-input font-medium rounded-xl"
                    >
                      <option value="Headquarters">Headquarters / On-site</option>
                      <option value="Remote">Remote</option>
                      <option value="Hybrid">Hybrid (Flexible)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Role & Access Assignment */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-base text-[var(--text-primary)]">
                    System Security Role & Access Assignment
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    Granular role assignments dictate administrative controls, attendance approvals, and payroll access.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {[
                    'EMPLOYEE',
                    'MANAGER',
                    'HR_EXECUTIVE',
                    'HR_ADMIN',
                    'PAYROLL_ADMIN',
                    'AUDITOR',
                    ...(isSuperAdmin ? ['COMPANY_ADMIN', 'SUPER_ADMIN'] : [])
                  ].map((rKey) => {
                    const info = ROLE_DESCRIPTIONS[rKey] || { label: rKey, desc: '', color: '' };
                    const isSelected = formData.role === rKey;
                    return (
                      <div
                        key={rKey}
                        onClick={() => setFormData({ ...formData, role: rKey })}
                        className={`p-4 sm:p-5 rounded-2xl border-2 text-left cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-[var(--surface-hover)] border-[var(--accent)] ring-2 ring-[var(--accent)]/30 shadow-sm' 
                            : 'bg-[var(--surface-glass)]/70 border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`font-bold text-sm ${isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                            {info.label}
                          </span>
                          {isSelected && <CheckCircle2 className="w-5 h-5 text-[var(--accent)]" />}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                          {info.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 4: Review & Confirm */}
            {currentStep === 4 && (
              <div className="space-y-5">
                <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-glass)] space-y-5 shadow-sm">
                  <div className="flex items-center gap-4 pb-4 border-b border-[var(--border-subtle)]">
                    <Avatar name={`${formData.first_name} ${formData.last_name}`} src={formData.avatar_url} size="lg" />
                    <div>
                      <h4 className="font-bold text-lg text-[var(--text-primary)]">
                        {formData.first_name} {formData.last_name}
                      </h4>
                      <p className="text-sm text-[var(--accent)] font-semibold mt-0.5">
                        {designations.find(d => String(d.id) === formData.designation_id)?.title || 'Assigned Role'} &bull; {formData.email}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                    <div className="p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--border-subtle)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Employee ID</span>
                      <span className="font-mono font-bold text-sm text-[var(--accent)]">{formData.employee_code || nextCodePreview}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--border-subtle)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Department</span>
                      <span className="font-semibold text-sm text-[var(--text-primary)]">
                        {departments.find(d => String(d.id) === formData.department_id)?.name || '—'}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--border-subtle)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">System Role</span>
                      <span className="font-bold text-sm text-[var(--accent)]">{formData.role.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--border-subtle)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Contract Type</span>
                      <span className="font-semibold text-xs text-[var(--text-primary)]">{formData.employment_type}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--border-subtle)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Joining Date</span>
                      <span className="font-semibold text-xs text-[var(--text-primary)]">{formData.date_of_joining}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--border-subtle)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Shift Schedule</span>
                      <span className="font-semibold text-xs text-[var(--text-primary)]">
                        {shifts.find(s => String(s.id) === formData.shift_id)?.name || 'Standard General'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] block">Choose Onboarding Action</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, submit_mode: 'INVITE' })}
                      className={`p-3.5 rounded-xl border-2 text-left transition ${
                        formData.submit_mode === 'INVITE'
                          ? 'border-[var(--accent)] bg-[var(--surface-glass)] shadow-xs text-[var(--accent)] font-semibold'
                          : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Send className="w-4 h-4 text-[var(--accent)]" />
                        <span className="text-sm font-bold">Submit & Invite</span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] font-normal">Generate secure account invite link immediately</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, submit_mode: 'DRAFT' })}
                      className={`p-3.5 rounded-xl border-2 text-left transition ${
                        formData.submit_mode === 'DRAFT'
                          ? 'border-[var(--accent)] bg-[var(--surface-glass)] shadow-xs text-[var(--accent)] font-semibold'
                          : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-[var(--accent)]" />
                        <span className="text-sm font-bold">Save as Draft</span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] font-normal">Save profile record without sending email invite</p>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation & Action Buttons */}
            <div className="pt-4 flex items-center justify-between border-t border-[var(--border-subtle)]">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                  className="px-5 py-3 rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] font-semibold text-sm inline-flex items-center gap-1.5 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-3 rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] font-semibold text-sm transition"
                >
                  Cancel
                </button>
              )}

              {currentStep < 4 ? (
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-sm shadow-md transition inline-flex items-center gap-1.5"
                >
                  <span>Continue Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-7 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-sm shadow-md transition disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Complete Onboarding</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </Modal>

      {/* Employee Profile Slide-over Drawer */}
      <Drawer
        isOpen={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        title={selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}` : 'Employee Profile'}
        subtitle={selectedEmployee ? `${selectedEmployee.designation_name || 'Staff'} • ${selectedEmployee.employee_code}` : ''}
        size="md"
      >
        {selectedEmployee && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--surface-hover)] border border-[var(--border-glass)]">
              <Avatar 
                name={`${selectedEmployee.first_name} ${selectedEmployee.last_name}`} 
                src={selectedEmployee.avatar_url} 
                size="lg" 
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[var(--text-main)]">
                    {selectedEmployee.first_name} {selectedEmployee.last_name}
                  </h3>
                  <StatusBadge status={selectedEmployee.status} />
                </div>
                <p className="text-xs text-[var(--accent)] font-medium mt-0.5">
                  {selectedEmployee.designation_name || 'Staff Member'}
                </p>
                <p className="text-xs text-[var(--text-subtle)] font-mono">{selectedEmployee.email}</p>
              </div>
            </div>

            <Tabs
              tabs={[
                { id: 'overview', label: 'Overview' },
                { id: 'job', label: 'Job & Role' },
                { id: 'biometrics', label: 'Face ID Biometrics' },
                { id: 'account', label: 'Invitation & Access' },
              ]}
              activeTab={profileTab}
              onChange={setProfileTab}
            />

            {profileTab === 'overview' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-glass)]">
                    <span className="text-[11px] text-[var(--text-subtle)] block">Employee ID</span>
                    <span className="font-mono font-semibold text-[var(--text-main)]">{selectedEmployee.employee_code}</span>
                  </div>
                  <div className="p-3 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-glass)]">
                    <span className="text-[11px] text-[var(--text-subtle)] block">Department</span>
                    <span className="font-medium text-[var(--text-main)]">{selectedEmployee.department_name || 'General'}</span>
                  </div>
                  <div className="p-3 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-glass)]">
                    <span className="text-[11px] text-[var(--text-subtle)] block">Role</span>
                    <span className="font-medium text-[var(--text-main)]">{selectedEmployee.role.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="p-3 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-glass)]">
                    <span className="text-[11px] text-[var(--text-subtle)] block">Date of Joining</span>
                    <span className="font-medium text-[var(--text-main)]">{selectedEmployee.date_of_joining || '—'}</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-glass)] space-y-2">
                  <span className="text-[11px] text-[var(--text-subtle)] font-medium uppercase tracking-wider block">Contact Information</span>
                  <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <Mail className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
                    <span>{selectedEmployee.email}</span>
                  </div>
                  {selectedEmployee.phone && (
                    <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                      <Phone className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
                      <span>{selectedEmployee.phone}</span>
                    </div>
                  )}
                  {selectedEmployee.emergency_contact_name && (
                    <div className="pt-2 border-t border-[var(--border-glass)]">
                      <span className="text-[10px] text-[var(--text-subtle)] block">Emergency Contact</span>
                      <span className="font-medium text-[var(--text-main)]">
                        {selectedEmployee.emergency_contact_name} ({selectedEmployee.emergency_contact_phone || 'No phone'})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {profileTab === 'job' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-glass)] space-y-1">
                  <span className="text-[11px] text-[var(--text-subtle)] block">Branch / Facility</span>
                  <span className="font-medium text-[var(--text-main)]">{selectedEmployee.branch_name || 'San Francisco HQ'}</span>
                </div>
                <div className="p-3 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-glass)] space-y-1">
                  <span className="text-[11px] text-[var(--text-subtle)] block">Employment Type</span>
                  <span className="font-medium text-[var(--text-main)]">{selectedEmployee.employment_type}</span>
                </div>
                <div className="p-3 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-glass)] space-y-1">
                  <span className="text-[11px] text-[var(--text-subtle)] block">Work Location</span>
                  <span className="font-medium text-[var(--text-main)]">{selectedEmployee.work_location || 'Headquarters'}</span>
                </div>
                <div className="p-3 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-glass)] space-y-1">
                  <span className="text-[11px] text-[var(--text-subtle)] block">Assigned Shift Schedule</span>
                  <span className="font-medium text-[var(--text-main)]">{selectedEmployee.shift_name || 'Standard General (09:00 - 18:00)'}</span>
                </div>
              </div>
            )}

            {profileTab === 'biometrics' && (
              <div className="space-y-4 text-xs">
                {/* 1. Biometric Enrollment Status & Model Architecture */}
                <div className={`p-4 rounded-xl border space-y-2 text-center ${
                  selectedEmployee.has_face_enrolled 
                    ? 'border-[#C8CAC0] bg-[#ECEEE7]' 
                    : 'border-amber-500/30 bg-amber-500/5'
                }`}>
                  <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${
                    selectedEmployee.has_face_enrolled ? 'bg-[#ECEEE7] text-[#4A5A3F]' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="font-bold text-sm text-[var(--text-main)] block">
                      {selectedEmployee.has_face_enrolled ? 'Face ID Enrolled & Active' : 'Face ID Not Registered'}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--text-subtle)]">
                      {selectedEmployee.has_face_enrolled 
                        ? `Template: ${APPROVED_BIOMETRIC_MODEL.id} (${APPROVED_BIOMETRIC_MODEL.dimensions}-D) • Model Compatible` 
                        : 'Awaiting Employee Biometric Consent & Optical Capture'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-subtle)] leading-relaxed">
                    {selectedEmployee.has_face_enrolled 
                      ? `Biometric mathematical vector (${APPROVED_BIOMETRIC_MODEL.dimensions}-D, L2-normalized) is active on the server and verified for optical attendance kiosks.`
                      : `Employee must complete optical face enrollment before biometric check-in is enabled. System enforces ${APPROVED_BIOMETRIC_MODEL.name}.`
                    }
                  </p>
                </div>

                {/* Biometric Model Version Consistency Badge */}
                <div className="p-3 rounded-xl border border-[var(--border-glass)] bg-[var(--surface-sunken)] flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-[var(--text-main)] block">Biometric Architecture Standard</span>
                    <span className="text-[10px] text-[var(--text-subtle)] font-mono">
                      {APPROVED_BIOMETRIC_MODEL.id} &bull; 128-D L2 &bull; 160x160 RGB
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#ECEEE7] text-[#590907] border border-[#DFE1D8]">
                    ENFORCED
                  </span>
                </div>

                {/* 2. Explicit Employee Biometric Consent */}
                {!selectedEmployee.has_face_enrolled && (
                  <div className="p-3.5 rounded-xl border border-[var(--border-glass)] bg-[var(--surface-sunken)] space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                      Mandatory Biometric Consent
                    </span>
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={employeeConsentChecked}
                        onChange={(e) => setEmployeeConsentChecked(e.target.checked)}
                        className="mt-0.5 h-4 w-4 text-[var(--accent)] rounded border-[var(--border-subtle)]"
                      />
                      <span className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                        <strong>Employee Consent:</strong> {selectedEmployee.first_name} {selectedEmployee.last_name} explicitly consents to capturing and storing an encrypted 128-D facial feature vector ({APPROVED_BIOMETRIC_MODEL.id}) solely for company attendance verification.
                      </span>
                    </label>
                  </div>
                )}

                {/* 3. Camera Availability Check */}
                <div className="p-3.5 rounded-xl border border-[var(--border-glass)] bg-[var(--surface-glass)] flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-[var(--text-main)] block">Optical Camera Sensor</span>
                    <span className="text-[11px] text-[var(--text-subtle)]">
                      {cameraCheckResult === 'IDLE' && 'Verify optical camera accessibility'}
                      {cameraCheckResult === 'CHECKING' && 'Probing camera hardware...'}
                      {cameraCheckResult === 'AVAILABLE' && 'Camera device ready and verified'}
                      {cameraCheckResult === 'UNAVAILABLE' && 'Camera permission denied or hardware unavailable'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={checkCameraAvailability}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                      cameraCheckResult === 'AVAILABLE'
                        ? 'bg-[#ECEEE7] border-[#C8CAC0] text-[#4A5A3F]'
                        : 'border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-main)]'
                    }`}
                  >
                    {cameraCheckResult === 'CHECKING' ? 'Checking...' : cameraCheckResult === 'AVAILABLE' ? 'Verified' : 'Check Camera'}
                  </button>
                </div>

                {/* 4. Start Enrollment Action & Authorized Revocation */}
                <div className="p-3.5 rounded-xl border border-[var(--border-glass)] bg-[var(--surface-glass)] space-y-3">
                  <span className="text-xs font-bold text-[var(--text-main)] block">Biometric Enrollment Actions</span>
                  
                  {selectedEmployee.has_face_enrolled ? (
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          setFaceModalTargetUser(selectedEmployee);
                          setIsFaceModalOpen(true);
                        }}
                        className="w-full py-2 rounded-lg border border-[#DFE1D8] text-[#590907] hover:bg-[#ECEEE7] transition font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Update / Re-enroll Face ID Template</span>
                      </button>

                      <button
                        onClick={() => setRevokeTargetUser(selectedEmployee)}
                        className="w-full py-2 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Revoke Face ID Template</span>
                      </button>
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={() => {
                          setFaceModalTargetUser(selectedEmployee);
                          setIsFaceModalOpen(true);
                        }}
                        disabled={!employeeConsentChecked}
                        className="w-full py-2.5 rounded-lg bg-[var(--accent)] hover:opacity-90 text-white transition font-bold inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Start Face ID Enrollment</span>
                      </button>
                      {!employeeConsentChecked && (
                        <p className="text-[10px] text-amber-500 mt-1 text-center">
                          Requires explicit employee biometric consent checkbox above.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 5. Alternative Attendance Options (Section 6) */}
                <div className="p-3.5 rounded-xl border border-[var(--border-glass)] bg-[var(--surface-sunken)] space-y-2">
                  <span className="text-xs font-bold text-[var(--text-main)] block">Alternative Attendance Options</span>
                  <p className="text-[11px] text-[var(--text-subtle)] leading-relaxed">
                    For employees with medical exemptions or hardware restrictions, alternative attendance options are authorized:
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-2.5 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-glass)] space-y-1">
                      <span className="font-semibold text-xs text-[var(--text-main)] block">QR Code Badge</span>
                      <span className="text-[10px] text-[var(--text-subtle)] block">Dynamic rotating TOTP token</span>
                    </div>
                    <div className="p-2.5 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-glass)] space-y-1">
                      <span className="font-semibold text-xs text-[var(--text-main)] block">Manual Web Punch</span>
                      <span className="text-[10px] text-[var(--text-subtle)] block">Subject to HR approval</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {profileTab === 'account' && (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-glass)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[var(--text-subtle)] font-medium">Account Status</span>
                    <StatusBadge status={selectedEmployee.status} />
                  </div>
                  {selectedEmployee.invited_at && (
                    <div className="text-[11px] text-[var(--text-subtle)]">
                      Last Invited: {new Date(selectedEmployee.invited_at).toLocaleString()}
                    </div>
                  )}
                </div>

                {isHRorAdmin && (
                  <div className="p-3 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-hover)] space-y-3">
                    <span className="text-[11px] font-semibold text-[var(--text-main)] block">Invitation Controls</span>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSendInvite(selectedEmployee)}
                        className="flex-1 py-1.5 rounded-lg bg-[var(--accent)] hover:opacity-90 text-white font-medium inline-flex items-center justify-center gap-1.5 transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send / Reissue Invite</span>
                      </button>

                      {selectedEmployee.invitation_token && (
                        <button
                          onClick={() => handleCopyInviteLink(selectedEmployee.invitation_token)}
                          className="px-3 py-1.5 rounded-lg border border-[var(--border-glass)] hover:bg-[var(--surface-glass)] text-[var(--text-secondary)] font-medium inline-flex items-center gap-1 transition"
                          title="Copy onboarding link"
                        >
                          {copiedToken === selectedEmployee.invitation_token ? <Check className="w-3.5 h-3.5 text-[#4A5A3F]" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>Copy Link</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Face Camera Enrollment Modal */}
      <FaceCameraModal
        isOpen={isFaceModalOpen}
        onClose={() => {
          setIsFaceModalOpen(false);
          setFaceModalTargetUser(null);
        }}
        mode="ENROLL"
        targetUserId={faceModalTargetUser?.id}
        targetUserName={faceModalTargetUser ? `${faceModalTargetUser.first_name} ${faceModalTargetUser.last_name}` : undefined}
        initialEmployeeData={faceModalTargetUser || undefined}
        onSuccess={() => {
          addToast({
            title: 'Face ID Enrolled Successfully',
            description: 'Biometric template registered and encrypted on server.',
            type: 'success'
          });
          loadEmployees();
          if (selectedEmployee) {
            setSelectedEmployee({ ...selectedEmployee, has_face_enrolled: true });
          }
        }}
      />

      {/* Confirm Revoke Face ID Dialog */}
      <ConfirmDialog
        isOpen={!!revokeTargetUser}
        onClose={() => setRevokeTargetUser(null)}
        onConfirm={handleConfirmRevokeFaceId}
        title="Revoke Biometric Face Template"
        message={`Are you sure you want to revoke Face ID biometric enrollment for ${revokeTargetUser?.first_name} ${revokeTargetUser?.last_name}? They will be required to re-enroll before checking in with optical biometrics.`}
        confirmText="Revoke Face ID"
        type="danger"
      />
    </div>
  );
};
