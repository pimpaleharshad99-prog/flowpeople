const API_BASE = '/api/v1';

export interface User {
  id: number;
  company_id: number;
  employee_code: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  gender?: string;
  date_of_birth?: string;
  blood_group?: string;
  role: 'PLATFORM_OWNER' | 'SUPER_ADMIN' | 'ORGANIZATION_OWNER' | 'COMPANY_ADMIN' | 'HR_ADMIN' | 'ADMIN' | 'HR_MANAGER' | 'HR_EXECUTIVE' | 'MANAGER' | 'PAYROLL_ADMIN' | 'EMPLOYEE' | 'AUDITOR';
  role_title?: string;
  is_platform_owner?: boolean;
  status: string;
  employment_type: string;
  date_of_joining: string;
  confirmation_date?: string;
  department_id?: number;
  branch_id?: number;
  branch_name?: string;
  designation_id?: number;
  manager_id?: number;
  shift_id?: number;
  shift_name?: string;
  work_location?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  created_at: string;
  created_by_id?: number;
  invitation_token?: string;
  invited_at?: string;
  department_name?: string;
  designation_name?: string;
  manager_name?: string;
  has_face_enrolled?: boolean;
}

export interface AttendancePunch {
  id: number;
  punch_time: string;
  punch_type: 'IN' | 'OUT';
  ip_address?: string;
  latitude?: number;
  longitude?: number;
  location_note?: string;
  device?: string;
  verification_method?: string;
}

export interface AttendanceRecord {
  id: number;
  user_id: number;
  date: string;
  shift_id?: number;
  first_check_in?: string;
  last_check_out?: string;
  total_work_minutes: number;
  total_break_minutes: number;
  overtime_minutes: number;
  late_in_minutes: number;
  early_out_minutes: number;
  status: string;
  is_regularized: boolean;
  remarks?: string;
  punches: AttendancePunch[];
}

export interface AttendanceStatus {
  is_checked_in: boolean;
  first_check_in?: string;
  last_check_out?: string;
  total_work_minutes: number;
  total_break_minutes: number;
  late_in_minutes: number;
  overtime_minutes: number;
  status: string;
}

export interface LeaveBalance {
  id: number;
  leave_type_id: number;
  leave_type_name: string;
  leave_type_code: string;
  color: string;
  year: number;
  allocated: number;
  used: number;
  pending_approval: number;
  balance: number;
}

export interface LeaveRequest {
  id: number;
  user_id: number;
  user_name?: string;
  employee_code?: string;
  department_name?: string;
  leave_type_id: number;
  leave_type_name: string;
  leave_type_code: string;
  color: string;
  from_date: string;
  to_date: string;
  day_count: number;
  is_half_day: boolean;
  half_day_session: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  document_url?: string;
  created_at: string;
}

export interface Branch {
  id: number;
  company_id: number;
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  timezone: string;
  latitude?: number;
  longitude?: number;
  geofence_radius_meters: number;
  is_geofence_enforced: boolean;
  is_headquarters: boolean;
  created_at?: string;
}

export interface ProjectTask {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  billable: boolean;
  estimated_hours: number;
  status: string;
}

export interface Project {
  id: number;
  name: string;
  code: string;
  client_name?: string;
  budget_hours: number;
  status: string;
  tasks: ProjectTask[];
}

export interface TimeLog {
  id: number;
  user_id: number;
  user_name?: string;
  project_id: number;
  project_name?: string;
  task_id: number;
  task_name?: string;
  timesheet_id?: number;
  log_date: string;
  hours: number;
  description?: string;
  is_billable: boolean;
  created_at: string;
}

export interface Timesheet {
  id: number;
  user_id: number;
  user_name?: string;
  period_start: string;
  period_end: string;
  total_hours: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  submitted_at?: string;
  reviewed_at?: string;
  review_comments?: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  author_name?: string;
  published_at: string;
}

export interface BiometricStatus {
  enrolled: boolean;
  status: 'not_registered' | 'pending' | 'verified' | 'disabled' | 'NOT_REGISTERED' | 'PENDING' | 'VERIFIED' | 'DISABLED';
  quality_score: number;
  liveness_verified: boolean;
  enrolled_at?: string;
  template_version?: string;
  is_model_compatible?: boolean;
}

export interface BiometricLog {
  id: number;
  user_id: number;
  user_name: string;
  attempt_type: string;
  status: string;
  confidence_score: number;
  liveness_score: number;
  failure_reason?: string;
  ip_address?: string;
  device_info?: string;
  timestamp: string;
}

export interface Goal {
  id: number;
  user_id: number;
  employee_name: string;
  title: string;
  description?: string;
  kpi_metric?: string;
  target_value: number;
  current_value: number;
  unit: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'ACHIEVED' | 'OVERDUE';
  due_date: string;
  created_at: string;
}

export interface PerformanceReview {
  id: number;
  user_id: number;
  employee_name: string;
  reviewer_name: string;
  cycle_name: string;
  self_assessment?: string;
  manager_feedback?: string;
  rating: number;
  status: 'DRAFT' | 'SUBMITTED' | 'COMPLETED';
  created_at: string;
}

export interface OnboardingTask {
  id: number;
  user_id: number;
  employee_name: string;
  title: string;
  category: 'DOCUMENTS' | 'IT_SETUP' | 'TRAINING' | 'ORIENTATION';
  is_completed: boolean;
  completed_at?: string;
  due_date?: string;
  notes?: string;
}

export interface LifecycleRecord {
  id: number;
  stage: string;
  effective_date: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface HRTicket {
  id: number;
  user_id: number;
  employee_name: string;
  category: string;
  subject: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  assigned_to?: string;
  resolution_notes?: string;
  created_at: string;
  resolved_at?: string;
}

export interface Payslip {
  id: number;
  user_id: number;
  employee_code?: string;
  employee_name: string;
  department?: string;
  designation?: string;
  month: string;
  period_start: string;
  period_end: string;
  working_days: number;
  days_present: number;
  paid_leaves: number;
  unpaid_leaves: number;
  payable_days: number;
  overtime_hours: number;
  overtime_pay: number;
  basic_salary: number;
  hra: number;
  allowances: number;
  gross_earnings: number;
  pf_deduction: number;
  tax_deduction: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
  payment_status: 'PENDING' | 'PAID';
  payment_date?: string;
  created_at?: string;
}

export interface PayrollPeriod {
  id: number;
  month: string;
  period_start: string;
  period_end: string;
  status: 'DRAFT' | 'PROCESSED' | 'APPROVED' | 'PAID';
  total_gross: number;
  total_deductions: number;
  total_net: number;
  employee_count: number;
  notes?: string;
  processed_by?: string;
  approved_by?: string;
  created_at?: string;
}

export interface SalaryStructure {
  id: number;
  user_id: number;
  employee_code?: string;
  employee_name: string;
  department?: string;
  designation?: string;
  ctc_annual: number;
  basic_monthly: number;
  hra_monthly: number;
  allowances_monthly: number;
  pf_deduction_monthly: number;
  professional_tax_monthly: number;
  net_monthly_base: number;
  effective_from: string;
  is_active: boolean;
}

export interface PayrollSummary {
  latest_month?: string;
  latest_status: string;
  latest_net_payroll: number;
  latest_employee_count: number;
  total_periods: number;
  total_paid_ytd: number;
}

export interface SuperAdminHealth {
  status: string;
  timestamp: string;
  database: string;
  metrics: {
    total_companies: number;
    total_employees: number;
    total_attendance_records: number;
    face_id_enrolled_users: number;
    biometric_coverage_pct: number;
  };
  services: { name: string; status: string; latency_ms: number }[];
}

export interface CompanyTenant {
  id: number;
  name: string;
  code: string;
  domain?: string;
  contact_email: string;
  country: string;
  currency: string;
  timezone: string;
  is_active: boolean;
  user_count: number;
  department_count: number;
  admin_name: string;
  admin_email?: string;
  subscription?: {
    plan_id: string;
    plan_name: string;
    status: string;
    billing_cycle: string;
    expires_at: string | null;
    max_employees: number;
  };
  created_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: string;
  description?: string;
  price_monthly_inr: number;
  price_annual_inr: number;
  price_monthly_usd: number;
  price_annual_usd: number;
  max_employees: number;
  max_hr_admins: number;
  face_attendance_enabled: boolean;
  fingerprint_enabled: boolean;
  payroll_enabled: boolean;
  advanced_reports_enabled: boolean;
  storage_limit_gb: number;
  support_level: string;
}

export interface SubscriptionInfo {
  company_id: number;
  company_name: string;
  company_code: string;
  is_active: boolean;
  subscription: {
    id: number | null;
    status: string;
    billing_cycle: string;
    current_period_start: string | null;
    current_period_end: string | null;
    trial_ends_at: string | null;
    cancel_at_period_end: boolean;
  };
  plan: SubscriptionPlan;
  usage: {
    employees_count: number;
    employees_limit: number;
    employees_remaining: number;
    admins_count: number;
    admins_limit: number;
  };
}

export interface InvoiceRecord {
  id: number;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  transaction_reference: string;
  date: string;
  billing_name?: string;
  billing_email?: string;
}

export interface SuperAdminOverview {
  platform_owner: {
    id: number;
    name: string;
    email: string;
  };
  stats: {
    total_organizations: number;
    active_organizations: number;
    total_employees: number;
    active_users: number;
    today_attendance_punches: number;
    face_enrolled_total: number;
    active_subscriptions: number;
    trial_organizations: number;
    expired_subscriptions: number;
    monthly_recurring_revenue_inr: number;
    monthly_recurring_revenue_usd: number;
  };
}

export interface DashboardStats {
  total_employees: number;
  present_today: number;
  late_today: number;
  on_leave_today: number;
  pending_leave_approvals: number;
  pending_regularizations: number;
  pending_timesheets: number;
  department_distribution: { department: string; headcount: number }[];
}

export interface HRDashboardEmployee {
  user_id: number;
  employee_code: string;
  full_name: string;
  avatar_url?: string;
  role?: string;
  role_title?: string;
  department_name?: string;
  branch_name?: string;
  status: 'CHECKED_IN' | 'PRESENT' | 'ABSENT';
  first_check_in?: string;
  last_check_out?: string;
  total_work_minutes: number;
  late_in_minutes: number;
  is_regularized: boolean;
  punch_count: number;
  last_punch_type?: string;
  verification_method?: string;
  has_face_enrolled?: boolean;
}

export interface HRDashboardData {
  date: string;
  total_employees: number;
  present_today: number;
  absent_today: number;
  late_arrivals: number;
  currently_checked_in: number;
  checked_out_today: number;
  incomplete_attendance?: number;
  pending_regularizations: number;
  failed_verifications_count: number;
  employees: HRDashboardEmployee[];
}

export interface VerificationFailureLog {
  id: number;
  user_id: number;
  employee_name: string;
  employee_code: string;
  department_name?: string;
  attempt_type: string;
  status: string;
  confidence_score: number;
  liveness_score: number;
  failure_reason?: string;
  device_info?: string;
  ip_address?: string;
  timestamp: string;
}

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401 && !url.includes('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    let msg = 'API request failed';
    if (typeof errorData.detail === 'string') {
      msg = errorData.detail;
    } else if (Array.isArray(errorData.detail)) {
      msg = errorData.detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', ');
    } else if (errorData.message) {
      msg = errorData.message;
    } else if (errorData.error) {
      msg = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
    }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  // Auth
  login: async (email: string, password: string) => {
    const data = await fetchJson<{ access_token: string; user: User }>(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('currentUser', JSON.stringify(data.user));
    return data;
  },
  register: async (data: { email: string; password: string; first_name: string; last_name: string; role?: string; company_name?: string }) => {
    const res = await fetchJson<{ access_token: string; user: User }>(`${API_BASE}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    localStorage.setItem('token', res.access_token);
    localStorage.setItem('currentUser', JSON.stringify(res.user));
    return res;
  },
  supabaseSync: async (data: { email: string; auth_user_id: string; first_name?: string; last_name?: string }) => {
    const res = await fetchJson<{ access_token: string; user: User }>(`${API_BASE}/auth/supabase-sync`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    localStorage.setItem('token', res.access_token);
    localStorage.setItem('currentUser', JSON.stringify(res.user));
    return res;
  },
  getCurrentUser: () => fetchJson<User>(`${API_BASE}/auth/me`),
  getDemoCredentials: () => fetchJson<{ accounts: any[]; universal_fallback_password: string }>(`${API_BASE}/auth/demo-credentials`),

  // Dashboard & Reports
  getDashboardStats: () => fetchJson<DashboardStats>(`${API_BASE}/reports/dashboard-stats`),

  // Employees & Organization
  getEmployees: (params?: { department_id?: number; search?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.department_id) query.append('department_id', params.department_id.toString());
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', params.status);
    return fetchJson<User[]>(`${API_BASE}/employees?${query.toString()}`);
  },
  getEmployee: (id: number) => fetchJson<User>(`${API_BASE}/employees/${id}`),
  getNextEmployeeCode: () => fetchJson<{ next_code: string }>(`${API_BASE}/employees/next-code`),
  createEmployee: (data: Partial<User> & { password?: string }) =>
    fetchJson<User>(`${API_BASE}/employees`, { method: 'POST', body: JSON.stringify(data) }),
  inviteEmployee: (id: number) =>
    fetchJson<any>(`${API_BASE}/employees/${id}/invite`, { method: 'POST' }),
  resendInvite: (id: number) =>
    fetchJson<any>(`${API_BASE}/employees/${id}/resend-invite`, { method: 'POST' }),
  activateInvite: (data: { token: string; password: string; auth_user_id?: string }) =>
    fetchJson<any>(`${API_BASE}/auth/activate-invite`, { method: 'POST', body: JSON.stringify(data) }),

  getDepartments: () => fetchJson<any[]>(`${API_BASE}/organization/departments`),
  getDesignations: () => fetchJson<any[]>(`${API_BASE}/organization/designations`),
  getHolidays: () => fetchJson<any[]>(`${API_BASE}/organization/holidays`),
  getBranches: () => fetchJson<Branch[]>(`${API_BASE}/organization/branches`),
  createBranch: (data: Partial<Branch>) =>
    fetchJson<Branch>(`${API_BASE}/organization/branches`, { method: 'POST', body: JSON.stringify(data) }),
  updateBranch: (id: number, data: Partial<Branch>) =>
    fetchJson<Branch>(`${API_BASE}/organization/branches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBranch: (id: number) =>
    fetchJson<void>(`${API_BASE}/organization/branches/${id}`, { method: 'DELETE' }),

  // Attendance
  getTodayStatus: () => fetchJson<AttendanceStatus>(`${API_BASE}/attendance/status`),
  punch: (punch_type: 'IN' | 'OUT', location_note?: string) =>
    fetchJson<AttendanceRecord>(`${API_BASE}/attendance/punch`, {
      method: 'POST',
      body: JSON.stringify({ punch_type, location_note, device: 'Web Dashboard' }),
    }),
  getMyAttendanceRecords: (month?: string) => {
    const q = month ? `?month=${month}` : '';
    return fetchJson<AttendanceRecord[]>(`${API_BASE}/attendance/my-records${q}`);
  },
  getEmployeeAttendanceHistory: (userId: number, month?: string) => {
    const q = month ? `?month=${month}` : '';
    return fetchJson<AttendanceRecord[]>(`${API_BASE}/attendance/employee-history/${userId}${q}`);
  },
  getHRDashboard: (params?: { date?: string; branch_id?: number; department_id?: number; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.date) q.append('date', params.date);
    if (params?.branch_id) q.append('branch_id', params.branch_id.toString());
    if (params?.department_id) q.append('department_id', params.department_id.toString());
    if (params?.search) q.append('search', params.search);
    return fetchJson<HRDashboardData>(`${API_BASE}/attendance/hr-dashboard?${q.toString()}`);
  },
  getDailyAttendanceMatrix: (date: string) =>
    fetchJson<AttendanceRecord[]>(`${API_BASE}/attendance/daily-matrix?date=${date}`),
  requestRegularization: (data: { attendance_record_id: number; requested_first_in: string; requested_last_out: string; reason: string }) =>
    fetchJson<any>(`${API_BASE}/attendance/regularize`, { method: 'POST', body: JSON.stringify(data) }),
  getPendingRegularizations: () => fetchJson<any[]>(`${API_BASE}/attendance/regularizations`),
  reviewRegularization: (id: number, status: 'APPROVED' | 'REJECTED', review_comments?: string) =>
    fetchJson<any>(`${API_BASE}/attendance/regularizations/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, review_comments }),
    }),

  // Leaves
  getLeaveTypes: () => fetchJson<any[]>(`${API_BASE}/leaves/types`),
  getMyLeaveBalances: () => fetchJson<LeaveBalance[]>(`${API_BASE}/leaves/my-balances`),
  getMyLeaveRequests: () => fetchJson<LeaveRequest[]>(`${API_BASE}/leaves/my-requests`),
  applyLeave: (data: { leave_type_id: number; from_date: string; to_date: string; is_half_day?: boolean; reason: string }) =>
    fetchJson<LeaveRequest>(`${API_BASE}/leaves/apply`, { method: 'POST', body: JSON.stringify(data) }),
  getLeaveApprovals: () => fetchJson<LeaveRequest[]>(`${API_BASE}/leaves/approvals`),
  reviewLeaveApproval: (id: number, status: 'APPROVED' | 'REJECTED', comments?: string) =>
    fetchJson<LeaveRequest>(`${API_BASE}/leaves/approvals/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, comments }),
    }),
  cancelLeave: (id: number) => fetchJson<LeaveRequest>(`${API_BASE}/leaves/cancel/${id}`, { method: 'POST' }),

  // Shifts
  getShifts: () => fetchJson<any[]>(`${API_BASE}/shifts`),

  // Announcements
  getAnnouncements: () => fetchJson<Announcement[]>(`${API_BASE}/announcements`),

  // Biometric Face ID
  getBiometricStatus: () => fetchJson<BiometricStatus>(`${API_BASE}/biometrics/status`),
  enrollFace: (data: { face_vector: string; consent_given: boolean; quality_score?: number; liveness_data?: any; target_user_id?: number; model_version?: string }) =>
    fetchJson<any>(`${API_BASE}/biometrics/enroll`, { method: 'POST', body: JSON.stringify(data) }),
  testFaceVerification: (data: { face_data: string; liveness_data: any; target_user_id?: number; device?: string; model_version?: string }) =>
    fetchJson<any>(`${API_BASE}/biometrics/verify-test`, { method: 'POST', body: JSON.stringify(data) }),
  verifyFacePunch: (data: { punch_type: 'IN' | 'OUT'; face_data: string; liveness_data: any; target_user_id?: number; latitude?: number; longitude?: number; location_note?: string; device?: string; model_version?: string }) =>
    fetchJson<any>(`${API_BASE}/biometrics/verify-punch`, { method: 'POST', body: JSON.stringify(data) }),
  fallbackPunch: (data: { punch_type: 'IN' | 'OUT'; reason: string; latitude?: number; longitude?: number; device?: string }) =>
    fetchJson<any>(`${API_BASE}/biometrics/fallback-punch`, { method: 'POST', body: JSON.stringify(data) }),
  getBiometricLogs: () => fetchJson<BiometricLog[]>(`${API_BASE}/biometrics/logs`),
  getVerificationFailures: () => fetchJson<VerificationFailureLog[]>(`${API_BASE}/biometrics/verification-failures`),
  resetFaceId: (userId: number) => fetchJson<any>(`${API_BASE}/biometrics/admin/reset/${userId}`, { method: 'POST' }),
  kioskScanFacePunch: (data: { face_data: string; liveness_data?: any; target_user_id?: number; device?: string; latitude?: number; longitude?: number; model_version?: string }) =>
    fetchJson<any>(`${API_BASE}/biometrics/kiosk-scan-punch`, { method: 'POST', body: JSON.stringify(data) }),

  // Fingerprint Attendance
  getFingerprintStatus: () => fetchJson<{ enrolled: boolean; credential_id?: string; device_name?: string; enrolled_at?: string; hardware_support: any }>(`${API_BASE}/attendance/fingerprint/status`),
  getFingerprintChallenge: () => fetchJson<{ challenge: string; rp_name: string; user: { id: string; name: string; displayName: string } }>(`${API_BASE}/attendance/fingerprint/challenge`),
  enrollFingerprint: (data: { credential_id: string; public_key?: string; device_name?: string; target_user_id?: number }) =>
    fetchJson<any>(`${API_BASE}/attendance/fingerprint/enroll`, { method: 'POST', body: JSON.stringify(data) }),
  verifyFingerprintPunch: (data: { punch_type: 'IN' | 'OUT'; credential_id: string; challenge?: string; signature?: string; device?: string; latitude?: number; longitude?: number; target_user_id?: number }) =>
    fetchJson<any>(`${API_BASE}/attendance/fingerprint/verify-punch`, { method: 'POST', body: JSON.stringify(data) }),
  punchWithFingerprint: (data: { punch_type: 'IN' | 'OUT'; credential_id: string; challenge?: string; signature?: string; device?: string; latitude?: number; longitude?: number; target_user_id?: number }) =>
    fetchJson<any>(`${API_BASE}/attendance/fingerprint/verify-punch`, { method: 'POST', body: JSON.stringify(data) }),

  // QR Attendance
  getActiveKioskQRToken: (kioskId?: string) => {
    const q = kioskId ? `?kiosk_id=${encodeURIComponent(kioskId)}` : '';
    return fetchJson<{ qr_token: string; kiosk_id: string; company_id: number; timestamp: number; expires_in_seconds: number; refresh_interval_seconds: number }>(`${API_BASE}/attendance/qr/active-kiosk-token${q}`);
  },
  scanQRPunch: (data: { qr_token: string; punch_type: 'IN' | 'OUT'; device?: string; latitude?: number; longitude?: number }) =>
    fetchJson<any>(`${API_BASE}/attendance/qr/scan-punch`, { method: 'POST', body: JSON.stringify(data) }),
  getQRKioskStatus: () => fetchJson<{ kiosks_active: number; kiosk_names: string[]; rotation_interval_seconds: number; qr_punches_today: number }>(`${API_BASE}/attendance/qr/kiosk-status`),

  // Super Admin & Multi-Tenant
  getSuperAdminCompanies: () => fetchJson<CompanyTenant[]>(`${API_BASE}/superadmin/companies`),
  createCompany: (data: { name: string; code: string; contact_email: string; domain?: string; country?: string; currency?: string; timezone?: string }) =>
    fetchJson<any>(`${API_BASE}/superadmin/companies`, { method: 'POST', body: JSON.stringify(data) }),
  createHRAdmin: (data: { company_id: number; first_name: string; last_name: string; email: string; password: string; employee_code?: string }) =>
    fetchJson<any>(`${API_BASE}/superadmin/create-hr-admin`, { method: 'POST', body: JSON.stringify(data) }),
  getSuperAdminHealth: () => fetchJson<SuperAdminHealth>(`${API_BASE}/superadmin/system-health`),
  getGlobalAuditLogs: () => fetchJson<any[]>(`${API_BASE}/superadmin/audit-logs`),

  // Performance & Goals
  getGoals: (userId?: number) => {
    const q = userId ? `?user_id=${userId}` : '';
    return fetchJson<Goal[]>(`${API_BASE}/performance/goals${q}`);
  },
  createGoal: (data: { title: string; user_id?: number; description?: string; kpi_metric?: string; target_value?: number; current_value?: number; unit?: string; due_date: string }) =>
    fetchJson<any>(`${API_BASE}/performance/goals`, { method: 'POST', body: JSON.stringify(data) }),
  updateGoal: (id: number, data: Partial<Goal>) =>
    fetchJson<any>(`${API_BASE}/performance/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getPerformanceReviews: () => fetchJson<PerformanceReview[]>(`${API_BASE}/performance/reviews`),
  createPerformanceReview: (data: { user_id: number; cycle_name?: string; self_assessment?: string; manager_feedback?: string; rating?: number }) =>
    fetchJson<any>(`${API_BASE}/performance/reviews`, { method: 'POST', body: JSON.stringify(data) }),
  updatePerformanceReview: (id: number, data: { self_assessment?: string; manager_feedback?: string; rating?: number; status?: string }) =>
    fetchJson<any>(`${API_BASE}/performance/reviews/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Lifecycle & Onboarding
  getOnboardingTasks: (userId?: number) => {
    const q = userId ? `?user_id=${userId}` : '';
    return fetchJson<OnboardingTask[]>(`${API_BASE}/lifecycle/tasks${q}`);
  },
  createOnboardingTask: (data: { user_id: number; title: string; category?: string; due_date?: string; notes?: string }) =>
    fetchJson<any>(`${API_BASE}/lifecycle/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  toggleOnboardingTask: (id: number) =>
    fetchJson<any>(`${API_BASE}/lifecycle/tasks/${id}/toggle`, { method: 'PUT' }),
  getLifecycleHistory: (userId: number) =>
    fetchJson<LifecycleRecord[]>(`${API_BASE}/lifecycle/history/${userId}`),
  recordLifecycleTransition: (data: { user_id: number; stage: string; effective_date: string; notes?: string }) =>
    fetchJson<any>(`${API_BASE}/lifecycle/transition`, { method: 'POST', body: JSON.stringify(data) }),

  // HR Helpdesk
  getHelpdeskTickets: () => fetchJson<HRTicket[]>(`${API_BASE}/helpdesk/tickets`),
  createHelpdeskTicket: (data: { category: string; subject: string; description: string; priority?: string }) =>
    fetchJson<any>(`${API_BASE}/helpdesk/tickets`, { method: 'POST', body: JSON.stringify(data) }),
  updateHelpdeskTicketStatus: (id: number, data: { status: string; resolution_notes?: string }) =>
    fetchJson<any>(`${API_BASE}/helpdesk/tickets/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),

  // Payroll & Compensation
  getPayrollSummary: () => fetchJson<PayrollSummary>(`${API_BASE}/payroll/summary`),
  getPayrollPeriods: () => fetchJson<PayrollPeriod[]>(`${API_BASE}/payroll/periods`),
  runPayroll: (data: { month: string; period_start: string; period_end: string; notes?: string }) =>
    fetchJson<any>(`${API_BASE}/payroll/periods`, { method: 'POST', body: JSON.stringify(data) }),
  getPayrollPeriodDetail: (periodId: number) =>
    fetchJson<{ period: PayrollPeriod; payslips: Payslip[] }>(`${API_BASE}/payroll/periods/${periodId}`),
  approvePayrollPeriod: (periodId: number) =>
    fetchJson<any>(`${API_BASE}/payroll/periods/${periodId}/approve`, { method: 'POST' }),
  markPayrollPeriodPaid: (periodId: number) =>
    fetchJson<any>(`${API_BASE}/payroll/periods/${periodId}/mark-paid`, { method: 'POST' }),
  getMyPayslips: () => fetchJson<Payslip[]>(`${API_BASE}/payroll/my-payslips`),
  getPayslipDetail: (payslipId: number) => fetchJson<Payslip>(`${API_BASE}/payroll/payslips/${payslipId}`),
  getSalaryStructures: () => fetchJson<SalaryStructure[]>(`${API_BASE}/payroll/salary-structures`),
  saveSalaryStructure: (data: Partial<SalaryStructure> & { user_id: number }) =>
    fetchJson<any>(`${API_BASE}/payroll/salary-structures`, { method: 'POST', body: JSON.stringify(data) }),

  // Announcements creation
  createAnnouncement: (data: { title: string; content: string; priority?: string }) =>
    fetchJson<Announcement>(`${API_BASE}/announcements`, { method: 'POST', body: JSON.stringify(data) }),

  // SaaS Billing & Subscriptions
  getSubscriptionPlans: () => fetchJson<SubscriptionPlan[]>(`${API_BASE}/billing/plans`),
  getSubscriptionInfo: () => fetchJson<SubscriptionInfo>(`${API_BASE}/billing/subscription`),
  registerOrganization: (data: any) =>
    fetchJson<{ success: boolean; access_token: string; organization: any; user: any }>(
      `${API_BASE}/billing/register-organization`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
  verifyPayment: (data: { plan_id: string; billing_cycle: string; transaction_reference: string; amount: number; currency?: string; billing_name?: string; billing_email?: string }) =>
    fetchJson<any>(`${API_BASE}/billing/verify-payment`, { method: 'POST', body: JSON.stringify(data) }),
  getInvoices: () => fetchJson<InvoiceRecord[]>(`${API_BASE}/billing/invoices`),

  // Super Admin Platform Management
  getSuperAdminOverview: () => fetchJson<SuperAdminOverview>(`${API_BASE}/superadmin/overview`),
  provisionCompany: (data: any) =>
    fetchJson<any>(`${API_BASE}/superadmin/companies`, { method: 'POST', body: JSON.stringify(data) }),
  updateCompanyStatus: (id: number, is_active: boolean, reason?: string) =>
    fetchJson<any>(`${API_BASE}/superadmin/companies/${id}/status`, { method: 'PUT', body: JSON.stringify({ is_active, reason }) }),
  updateCompanySubscription: (id: number, data: { plan_id: string; max_employees?: number; status?: string; extend_days?: number }) =>
    fetchJson<any>(`${API_BASE}/superadmin/companies/${id}/subscription`, { method: 'PUT', body: JSON.stringify(data) }),
};

