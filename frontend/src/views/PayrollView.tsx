import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Calendar,
  FileText,
  CreditCard,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  RefreshCw,
  TrendingUp,
  Download,
  Users,
  Eye,
  Check,
  ShieldCheck,
  Building
} from 'lucide-react';
import {
  api,
  PayrollPeriod,
  Payslip,
  SalaryStructure,
  PayrollSummary,
  User
} from '../services/api';
import {
  PageHeader,
  StatCard,
  GlassCard,
  DataTable,
  StatusBadge,
  Modal,
  useToast,
  Avatar
} from '../components/ui';

interface PayrollViewProps {
  currentUser?: User | null;
}

export const PayrollView: React.FC<PayrollViewProps> = ({ currentUser }) => {
  const { addToast } = useToast();

  const isAdmin = [
    'SUPER_ADMIN',
    'ADMIN',
    'HR_ADMIN',
    'HR_MANAGER',
    'HR_EXECUTIVE',
    'COMPANY_ADMIN'
  ].includes(currentUser?.role || '');

  const [activeTab, setActiveTab] = useState<'my_payslips' | 'payroll_runs' | 'salary_structures'>(
    isAdmin ? 'payroll_runs' : 'my_payslips'
  );

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [myPayslips, setMyPayslips] = useState<Payslip[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);

  // Modals
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [showRunPayrollModal, setShowRunPayrollModal] = useState(false);
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [selectedPeriodDetail, setSelectedPeriodDetail] = useState<{ period: PayrollPeriod; payslips: Payslip[] } | null>(null);
  const [editingStructure, setEditingStructure] = useState<SalaryStructure | null>(null);

  const [runForm, setRunForm] = useState({
    month: new Date().toISOString().slice(0, 7), // YYYY-MM
    period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
    notes: 'Standard monthly payroll cycle'
  });

  const [structureForm, setStructureForm] = useState({
    user_id: 0,
    ctc_annual: 60000,
    basic_monthly: 2500,
    hra_monthly: 1250,
    allowances_monthly: 750,
    pf_deduction_monthly: 300,
    professional_tax_monthly: 100,
    effective_from: new Date().toISOString().slice(0, 10)
  });

  const loadData = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const [sumData, perData, myData, structData] = await Promise.all([
          api.getPayrollSummary().catch(() => null),
          api.getPayrollPeriods().catch(() => []),
          api.getMyPayslips().catch(() => []),
          api.getSalaryStructures().catch(() => [])
        ]);
        setSummary(sumData);
        setPeriods(perData);
        setMyPayslips(myData);
        setStructures(structData);
      } else {
        const myData = await api.getMyPayslips();
        setMyPayslips(myData);
      }
    } catch (err: any) {
      addToast({
        title: 'Error loading payroll data',
        description: err.message,
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser, isAdmin]);

  const handleRunPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.runPayroll(runForm);
      addToast({
        title: 'Payroll Generated',
        description: `Calculated ${runForm.month} payroll for ${res.employee_count} employees. Net total: $${res.total_net.toLocaleString()}`,
        type: 'success'
      });
      setShowRunPayrollModal(false);
      loadData();
    } catch (err: any) {
      addToast({
        title: 'Payroll run failed',
        description: err.message,
        type: 'danger'
      });
    }
  };

  const handleApprovePeriod = async (periodId: number) => {
    try {
      await api.approvePayrollPeriod(periodId);
      addToast({
        title: 'Payroll Approved',
        description: 'Payroll cycle has been locked and approved for disbursement.',
        type: 'success'
      });
      loadData();
      if (selectedPeriodDetail?.period.id === periodId) {
        inspectPeriod(periodId);
      }
    } catch (err: any) {
      addToast({
        title: 'Approval failed',
        description: err.message,
        type: 'danger'
      });
    }
  };

  const handleMarkPaid = async (periodId: number) => {
    try {
      await api.markPayrollPeriodPaid(periodId);
      addToast({
        title: 'Disbursement Complete',
        description: 'All employee payslips marked as PAID.',
        type: 'success'
      });
      loadData();
      if (selectedPeriodDetail?.period.id === periodId) {
        inspectPeriod(periodId);
      }
    } catch (err: any) {
      addToast({
        title: 'Update failed',
        description: err.message,
        type: 'danger'
      });
    }
  };

  const inspectPeriod = async (periodId: number) => {
    try {
      const data = await api.getPayrollPeriodDetail(periodId);
      setSelectedPeriodDetail(data);
    } catch (err: any) {
      addToast({
        title: 'Failed to inspect period',
        description: err.message,
        type: 'danger'
      });
    }
  };

  const handleSaveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveSalaryStructure(structureForm);
      addToast({
        title: 'Salary Structure Updated',
        description: 'Employee compensation baseline saved successfully.',
        type: 'success'
      });
      setShowStructureModal(false);
      loadData();
    } catch (err: any) {
      addToast({
        title: 'Failed to save salary structure',
        description: err.message,
        type: 'danger'
      });
    }
  };

  const openEditStructure = (s: SalaryStructure) => {
    setEditingStructure(s);
    setStructureForm({
      user_id: s.user_id,
      ctc_annual: s.ctc_annual,
      basic_monthly: s.basic_monthly,
      hra_monthly: s.hra_monthly,
      allowances_monthly: s.allowances_monthly,
      pf_deduction_monthly: s.pf_deduction_monthly,
      professional_tax_monthly: s.professional_tax_monthly,
      effective_from: s.effective_from || new Date().toISOString().slice(0, 10)
    });
    setShowStructureModal(true);
  };

  // Columns for My Payslips
  const myPayslipColumns = [
    {
      key: 'month',
      header: 'Payroll Cycle',
      render: (p: Payslip) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[var(--accent)]" />
          <span className="font-semibold text-xs text-[var(--text-main)]">{p.month}</span>
        </div>
      )
    },
    {
      key: 'working_days',
      header: 'Working Days',
      render: (p: Payslip) => (
        <span className="font-mono text-xs">{p.payable_days} / {p.working_days} days</span>
      )
    },
    {
      key: 'gross_earnings',
      header: 'Gross Earnings',
      render: (p: Payslip) => (
        <span className="font-mono text-xs font-medium text-[var(--text-main)]">
          ${p.gross_earnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'total_deductions',
      header: 'Deductions',
      render: (p: Payslip) => (
        <span className="font-mono text-xs text-rose-600 dark:text-rose-400">
          -${p.total_deductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'net_salary',
      header: 'Net Take-Home',
      render: (p: Payslip) => (
        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
          ${p.net_salary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'payment_status',
      header: 'Disbursement Status',
      render: (p: Payslip) => (
        <StatusBadge status={p.payment_status} />
      )
    },
    {
      key: 'action',
      header: 'Action',
      render: (p: Payslip) => (
        <button
          onClick={() => setSelectedPayslip(p)}
          className="px-2.5 py-1 rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border-glass)] text-xs font-medium transition inline-flex items-center gap-1.5"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>View Slip</span>
        </button>
      )
    }
  ];

  // Columns for Admin Payroll Periods
  const periodColumns = [
    {
      key: 'month',
      header: 'Cycle Month',
      render: (p: PayrollPeriod) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[var(--accent)]" />
          <div>
            <span className="font-semibold text-xs text-[var(--text-main)] block">{p.month}</span>
            <span className="text-[10px] text-[var(--text-subtle)] font-mono">{p.period_start} → {p.period_end}</span>
          </div>
        </div>
      )
    },
    {
      key: 'employee_count',
      header: 'Enrolled Staff',
      render: (p: PayrollPeriod) => (
        <span className="font-mono text-xs">{p.employee_count} employees</span>
      )
    },
    {
      key: 'total_gross',
      header: 'Total Gross',
      render: (p: PayrollPeriod) => (
        <span className="font-mono text-xs text-[var(--text-main)]">
          ${p.total_gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'total_deductions',
      header: 'Total Deductions',
      render: (p: PayrollPeriod) => (
        <span className="font-mono text-xs text-rose-600 dark:text-rose-400">
          -${p.total_deductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'total_net',
      header: 'Net Disbursable',
      render: (p: PayrollPeriod) => (
        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
          ${p.total_net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (p: PayrollPeriod) => (
        <StatusBadge status={p.status} />
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (p: PayrollPeriod) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => inspectPeriod(p.id)}
            className="px-2 py-1 rounded bg-[var(--surface-hover)] hover:bg-[var(--surface-card)] border border-[var(--border-glass)] text-xs text-[var(--text-main)] font-medium inline-flex items-center gap-1"
            title="Inspect Payslips"
          >
            <Eye className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Inspect</span>
          </button>

          {p.status === 'PROCESSED' && (
            <button
              onClick={() => handleApprovePeriod(p.id)}
              className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium inline-flex items-center gap-1"
              title="Approve Cycle"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve</span>
            </button>
          )}

          {p.status === 'APPROVED' && (
            <button
              onClick={() => handleMarkPaid(p.id)}
              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium inline-flex items-center gap-1"
              title="Mark Disbursed"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Disburse</span>
            </button>
          )}
        </div>
      )
    }
  ];

  // Columns for Salary Structures
  const structureColumns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (s: SalaryStructure) => (
        <div>
          <span className="font-semibold text-xs text-[var(--text-main)] block">{s.employee_name}</span>
          <span className="text-[10px] text-[var(--text-subtle)] font-mono">{s.employee_code || `EMP-${s.user_id}`} • {s.department}</span>
        </div>
      )
    },
    {
      key: 'designation',
      header: 'Designation',
      render: (s: SalaryStructure) => (
        <span className="text-xs text-[var(--text-secondary)]">{s.designation}</span>
      )
    },
    {
      key: 'ctc_annual',
      header: 'Annual CTC',
      render: (s: SalaryStructure) => (
        <span className="font-mono text-xs font-medium text-[var(--text-main)]">
          ${s.ctc_annual.toLocaleString()}
        </span>
      )
    },
    {
      key: 'basic_monthly',
      header: 'Basic Monthly',
      render: (s: SalaryStructure) => (
        <span className="font-mono text-xs">${s.basic_monthly.toLocaleString()}</span>
      )
    },
    {
      key: 'allowances',
      header: 'HRA + Allowances',
      render: (s: SalaryStructure) => (
        <span className="font-mono text-xs">${(s.hra_monthly + s.allowances_monthly).toLocaleString()}</span>
      )
    },
    {
      key: 'deductions',
      header: 'Deductions (PF+Tax)',
      render: (s: SalaryStructure) => (
        <span className="font-mono text-xs text-rose-600 dark:text-rose-400">
          -${(s.pf_deduction_monthly + s.professional_tax_monthly).toLocaleString()}
        </span>
      )
    },
    {
      key: 'net_monthly_base',
      header: 'Net Base Monthly',
      render: (s: SalaryStructure) => (
        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
          ${s.net_monthly_base.toLocaleString()}
        </span>
      )
    },
    {
      key: 'action',
      header: 'Action',
      render: (s: SalaryStructure) => (
        <button
          onClick={() => openEditStructure(s)}
          className="px-2.5 py-1 rounded bg-[var(--surface-hover)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border-glass)] text-xs font-medium transition"
        >
          Edit Structure
        </button>
      )
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Payroll & Compensation Management"
          description="Authoritative attendance-integrated payroll processing, tax schedules, statutory deductions, and itemized employee payslips"
        />

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRunPayrollModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium shadow-sm transition inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Run Payroll Cycle</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Stats */}
      {isAdmin && summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Latest Net Payroll"
            value={`$${summary.latest_net_payroll.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            subtext={`Cycle ${summary.latest_month || 'N/A'}`}
            icon={<DollarSign className="w-4 h-4" />}
          />
          <StatCard
            label="Enrolled Staff"
            value={summary.latest_employee_count}
            subtext="Active wage earners"
            icon={<Users className="w-4 h-4" />}
          />
          <StatCard
            label="Payroll Cycles"
            value={summary.total_periods}
            subtext={`Latest: ${summary.latest_status}`}
            icon={<Calendar className="w-4 h-4" />}
          />
          <StatCard
            label="Disbursed YTD"
            value={`$${summary.total_paid_ytd.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            trend={{ value: 'Full Compliance', positive: true }}
            icon={<CreditCard className="w-4 h-4" />}
          />
        </div>
      )}

      {/* Tab Nav for Admins */}
      {isAdmin && (
        <div className="flex items-center gap-2 border-b border-[var(--border-glass)] pb-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab('payroll_runs')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'payroll_runs'
                ? 'bg-[var(--accent)] text-white shadow-2xs font-semibold'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            Payroll Runs & Cycles ({periods.length})
          </button>
          <button
            onClick={() => setActiveTab('salary_structures')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'salary_structures'
                ? 'bg-[var(--accent)] text-white shadow-2xs font-semibold'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            Salary Structures ({structures.length})
          </button>
          <button
            onClick={() => setActiveTab('my_payslips')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'my_payslips'
                ? 'bg-[var(--accent)] text-white shadow-2xs font-semibold'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            My Personal Payslips ({myPayslips.length})
          </button>
        </div>
      )}

      {/* Tab 1: Payroll Runs (Admin) */}
      {isAdmin && activeTab === 'payroll_runs' && (
        <div className="space-y-4">
          <DataTable
            columns={periodColumns}
            data={periods}
            searchPlaceholder="Search payroll periods by month or status..."
            filterKey="status"
          />
        </div>
      )}

      {/* Tab 2: Salary Structures (Admin) */}
      {isAdmin && activeTab === 'salary_structures' && (
        <div className="space-y-4">
          <DataTable
            columns={structureColumns}
            data={structures}
            searchPlaceholder="Search employees by name, code, or department..."
            filterKey="department"
          />
        </div>
      )}

      {/* Tab 3 / Default for Employees: My Payslips */}
      {activeTab === 'my_payslips' && (
        <div className="space-y-4">
          <GlassCard
            title="My Official Payslip Archive"
            subtitle="View or print itemized monthly compensation statements"
          >
            {loading ? (
              <div className="py-12 text-center text-xs text-[var(--text-subtle)]">
                Loading compensation records...
              </div>
            ) : myPayslips.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--text-subtle)]">
                No payslips generated for your profile yet. Once a payroll cycle is executed by HR, your itemized payslips will appear here.
              </div>
            ) : (
              <DataTable
                columns={myPayslipColumns}
                data={myPayslips}
                searchPlaceholder="Search payslips by month..."
              />
            )}
          </GlassCard>
        </div>
      )}

      {/* Modal: Run Payroll Cycle */}
      <Modal
        isOpen={showRunPayrollModal}
        onClose={() => setShowRunPayrollModal(false)}
        title="Execute Monthly Payroll Calculation"
      >
        <form onSubmit={handleRunPayroll} className="space-y-4 text-xs">
          <div className="p-3 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-hover)] text-xs text-[var(--text-secondary)] space-y-1">
            <span className="font-semibold text-[var(--text-main)] block">Authoritative Calculation Engine</span>
            <p>
              FlowPeople will evaluate biometric punches, recorded shift allocations, approved leave balances, and overtime hours for every active employee in your company.
            </p>
          </div>

          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">Payroll Month *</label>
            <input
              type="month"
              required
              value={runForm.month}
              onChange={(e) => setRunForm({ ...runForm, month: e.target.value })}
              className="w-full glass-input font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Period Start *</label>
              <input
                type="date"
                required
                value={runForm.period_start}
                onChange={(e) => setRunForm({ ...runForm, period_start: e.target.value })}
                className="w-full glass-input font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Period End *</label>
              <input
                type="date"
                required
                value={runForm.period_end}
                onChange={(e) => setRunForm({ ...runForm, period_end: e.target.value })}
                className="w-full glass-input font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">Audit Notes</label>
            <textarea
              rows={2}
              value={runForm.notes}
              onChange={(e) => setRunForm({ ...runForm, notes: e.target.value })}
              placeholder="e.g. Standard monthly calculation with Q4 performance adjustments..."
              className="w-full glass-input"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border-glass)]">
            <button
              type="button"
              onClick={() => setShowRunPayrollModal(false)}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-main)] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium shadow-sm"
            >
              Start Computation Run
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Salary Structure */}
      <Modal
        isOpen={showStructureModal}
        onClose={() => setShowStructureModal(false)}
        title={`Configure Compensation: ${editingStructure?.employee_name}`}
      >
        <form onSubmit={handleSaveStructure} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Annual CTC ($) *</label>
              <input
                type="number"
                required
                value={structureForm.ctc_annual}
                onChange={(e) => setStructureForm({ ...structureForm, ctc_annual: Number(e.target.value) })}
                className="w-full glass-input font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Basic Monthly ($) *</label>
              <input
                type="number"
                required
                value={structureForm.basic_monthly}
                onChange={(e) => setStructureForm({ ...structureForm, basic_monthly: Number(e.target.value) })}
                className="w-full glass-input font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">HRA Monthly ($) *</label>
              <input
                type="number"
                required
                value={structureForm.hra_monthly}
                onChange={(e) => setStructureForm({ ...structureForm, hra_monthly: Number(e.target.value) })}
                className="w-full glass-input font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Allowances Monthly ($)</label>
              <input
                type="number"
                value={structureForm.allowances_monthly}
                onChange={(e) => setStructureForm({ ...structureForm, allowances_monthly: Number(e.target.value) })}
                className="w-full glass-input font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">PF Deduction ($)</label>
              <input
                type="number"
                value={structureForm.pf_deduction_monthly}
                onChange={(e) => setStructureForm({ ...structureForm, pf_deduction_monthly: Number(e.target.value) })}
                className="w-full glass-input font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Professional Tax ($)</label>
              <input
                type="number"
                value={structureForm.professional_tax_monthly}
                onChange={(e) => setStructureForm({ ...structureForm, professional_tax_monthly: Number(e.target.value) })}
                className="w-full glass-input font-mono"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg border border-[var(--border-glass)] bg-emerald-500/5 text-xs flex justify-between items-center">
            <span className="font-medium text-[var(--text-secondary)]">Calculated Base Net Take-Home:</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
              ${(
                structureForm.basic_monthly +
                structureForm.hra_monthly +
                structureForm.allowances_monthly -
                structureForm.pf_deduction_monthly -
                structureForm.professional_tax_monthly
              ).toLocaleString(undefined, { minimumFractionDigits: 2 })} / mo
            </span>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border-glass)]">
            <button
              type="button"
              onClick={() => setShowStructureModal(false)}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-main)] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium shadow-sm"
            >
              Save Compensation Structure
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Period Inspector (List of all payslips for a period) */}
      <Modal
        isOpen={!!selectedPeriodDetail}
        onClose={() => setSelectedPeriodDetail(null)}
        title={`Cycle Inspector: ${selectedPeriodDetail?.period.month}`}
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-3 gap-3 p-3 rounded-xl border border-[var(--border-glass)] bg-[var(--surface-hover)] text-xs">
            <div>
              <span className="text-[11px] text-[var(--text-subtle)] block">Cycle Status</span>
              <StatusBadge status={selectedPeriodDetail?.period.status || ''} />
            </div>
            <div>
              <span className="text-[11px] text-[var(--text-subtle)] block">Employees In Cycle</span>
              <span className="font-mono font-semibold text-[var(--text-main)]">
                {selectedPeriodDetail?.period.employee_count} staff
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[var(--text-subtle)] block">Total Net Payroll</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                ${selectedPeriodDetail?.period.total_net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-[var(--text-main)] block">Itemized Employee Payslips</span>
            <div className="space-y-1.5">
              {selectedPeriodDetail?.payslips.map((ps) => (
                <div
                  key={ps.id}
                  className="p-3 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-card)] flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-semibold text-[var(--text-main)] block">{ps.employee_name}</span>
                    <span className="text-[10px] text-[var(--text-subtle)] font-mono">
                      {ps.employee_code || `EMP-${ps.user_id}`} • {ps.department} • {ps.payable_days}/{ps.working_days} days
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right font-mono">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                        ${ps.net_salary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-[var(--text-subtle)]">
                        Gross ${ps.gross_earnings.toLocaleString()}
                      </span>
                    </div>

                    <button
                      onClick={() => setSelectedPayslip(ps)}
                      className="px-2.5 py-1 rounded bg-[var(--surface-hover)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border-glass)] text-xs font-medium inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 flex justify-between items-center border-t border-[var(--border-glass)]">
            <div className="flex items-center gap-2">
              {selectedPeriodDetail?.period.status === 'PROCESSED' && (
                <button
                  onClick={() => handleApprovePeriod(selectedPeriodDetail.period.id)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium inline-flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve Entire Cycle</span>
                </button>
              )}
              {selectedPeriodDetail?.period.status === 'APPROVED' && (
                <button
                  onClick={() => handleMarkPaid(selectedPeriodDetail.period.id)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium inline-flex items-center gap-1.5"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Mark All As Paid</span>
                </button>
              )}
            </div>

            <button
              onClick={() => setSelectedPeriodDetail(null)}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-main)] text-xs font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Executive Printable Payslip */}
      <Modal
        isOpen={!!selectedPayslip}
        onClose={() => setSelectedPayslip(null)}
        title="Official Employee Salary Statement"
      >
        {selectedPayslip && (
          <div className="space-y-6 text-xs" id="printable-payslip">
            {/* Header: Company & FlowPeople Branding */}
            <div className="pb-4 border-b border-[var(--border-glass)] flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                    FP
                  </div>
                  <span className="font-bold text-base tracking-tight text-[var(--text-main)]">FlowPeople</span>
                </div>
                <span className="text-[11px] text-[var(--text-subtle)] block">
                  FlowCraft Ecosystem • Enterprise Workforce HRMS
                </span>
              </div>

              <div className="text-right">
                <span className="text-xs font-semibold text-[var(--text-main)] block">PAYSLIP / SALARY ADVICE</span>
                <span className="font-mono text-xs font-bold text-[var(--accent)]">
                  {selectedPayslip.month}
                </span>
                <span className="text-[10px] text-[var(--text-subtle)] block font-mono">
                  Period: {selectedPayslip.period_start} to {selectedPayslip.period_end}
                </span>
              </div>
            </div>

            {/* Employee Information Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl border border-[var(--border-glass)] bg-[var(--surface-hover)]">
              <div>
                <span className="text-[10px] text-[var(--text-subtle)] uppercase tracking-wider block">Employee</span>
                <span className="font-semibold text-xs text-[var(--text-main)] block">{selectedPayslip.employee_name}</span>
                <span className="text-[10px] text-[var(--text-subtle)] font-mono">{selectedPayslip.employee_code || `EMP-${selectedPayslip.user_id}`}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-subtle)] uppercase tracking-wider block">Department</span>
                <span className="font-medium text-xs text-[var(--text-main)]">{selectedPayslip.department}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-subtle)] uppercase tracking-wider block">Designation</span>
                <span className="font-medium text-xs text-[var(--text-main)]">{selectedPayslip.designation}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-subtle)] uppercase tracking-wider block">Disbursement</span>
                <StatusBadge status={selectedPayslip.payment_status} />
              </div>
            </div>

            {/* Attendance & Shift Summary */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs p-2.5 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-glass)]">
              <div>
                <span className="text-[10px] text-[var(--text-subtle)] block">Standard Days</span>
                <span className="font-mono font-semibold text-[var(--text-main)]">{selectedPayslip.working_days}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-subtle)] block">Days Present</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{selectedPayslip.days_present}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-subtle)] block">Paid Leaves</span>
                <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{selectedPayslip.paid_leaves}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-subtle)] block">Payable Days</span>
                <span className="font-mono font-bold text-[var(--accent)]">{selectedPayslip.payable_days}</span>
              </div>
            </div>

            {/* Financial Breakdown: Earnings vs Deductions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Earnings Table */}
              <div className="rounded-xl border border-[var(--border-glass)] overflow-hidden">
                <div className="p-2.5 bg-[var(--surface-hover)] border-b border-[var(--border-glass)] font-semibold text-xs text-[var(--text-main)]">
                  Earnings & Allowances
                </div>
                <div className="p-3 space-y-2 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Basic Salary</span>
                    <span className="text-[var(--text-main)]">${selectedPayslip.basic_salary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">House Rent Allowance (HRA)</span>
                    <span className="text-[var(--text-main)]">${selectedPayslip.hra.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Special Allowances</span>
                    <span className="text-[var(--text-main)]">${selectedPayslip.allowances.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  {selectedPayslip.overtime_pay > 0 && (
                    <div className="flex justify-between text-blue-600 dark:text-blue-400">
                      <span>Overtime Pay ({selectedPayslip.overtime_hours} hrs)</span>
                      <span>+${selectedPayslip.overtime_pay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-[var(--border-glass)] flex justify-between font-bold text-xs text-[var(--text-main)]">
                    <span>Total Gross Earnings</span>
                    <span>${selectedPayslip.gross_earnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Deductions Table */}
              <div className="rounded-xl border border-[var(--border-glass)] overflow-hidden">
                <div className="p-2.5 bg-[var(--surface-hover)] border-b border-[var(--border-glass)] font-semibold text-xs text-[var(--text-main)]">
                  Statutory & Tax Deductions
                </div>
                <div className="p-3 space-y-2 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Provident Fund (PF)</span>
                    <span className="text-rose-600 dark:text-rose-400">-${selectedPayslip.pf_deduction.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Professional / State Tax</span>
                    <span className="text-rose-600 dark:text-rose-400">-${selectedPayslip.tax_deduction.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  {selectedPayslip.other_deductions > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Other Withholdings</span>
                      <span className="text-rose-600 dark:text-rose-400">-${selectedPayslip.other_deductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-[var(--border-glass)] flex justify-between font-bold text-xs text-rose-600 dark:text-rose-400">
                    <span>Total Deductions</span>
                    <span>-${selectedPayslip.total_deductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Take-Home Highlight Banner */}
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                  Net Salary Payable
                </span>
                <span className="text-[11px] text-[var(--text-subtle)]">
                  Disbursed via automated bank transfer
                </span>
              </div>
              <div className="text-right">
                <span className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400">
                  ${selectedPayslip.net_salary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Verification Sign-Off Footer */}
            <div className="pt-4 border-t border-[var(--border-glass)] flex items-center justify-between text-[10px] text-[var(--text-subtle)]">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Digitally Authenticated by FlowPeople Core Engine</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--surface-card)] border border-[var(--border-glass)] text-[var(--text-main)] font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Payslip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPayslip(null)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
