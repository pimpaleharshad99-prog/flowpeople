import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, 
  Building2, 
  Users, 
  Activity, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Server, 
  RefreshCw, 
  KeyRound, 
  Globe, 
  Clock, 
  FileText,
  DollarSign,
  TrendingUp,
  CreditCard,
  Layers,
  Lock,
  Power
} from 'lucide-react';
import { api, CompanyTenant, SuperAdminHealth, SuperAdminOverview } from '../services/api';
import { 
  PageHeader, 
  StatCard, 
  GlassCard, 
  DataTable, 
  StatusBadge, 
  Modal, 
  useToast,
  Tabs
} from '../components/ui';

export const SuperAdminPortalView: React.FC = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'companies' | 'subscriptions' | 'audit'>('overview');
  const [overview, setOverview] = useState<SuperAdminOverview | null>(null);
  const [health, setHealth] = useState<SuperAdminHealth | null>(null);
  const [companies, setCompanies] = useState<CompanyTenant[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [showEditPlanModal, setShowEditPlanModal] = useState(false);
  const [selectedCompanyForPlan, setSelectedCompanyForPlan] = useState<CompanyTenant | null>(null);

  // Form states
  const [newCompany, setNewCompany] = useState({
    name: '',
    code: '',
    domain: '',
    contact_email: '',
    country: 'India',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    plan_id: 'trial',
    owner_first_name: '',
    owner_last_name: '',
    owner_password: 'Password123!'
  });

  const [editPlanData, setEditPlanData] = useState({
    plan_id: 'professional',
    max_employees: 100,
    status: 'ACTIVE',
    extend_days: 30
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [oData, hData, cData, aData] = await Promise.all([
        api.getSuperAdminOverview().catch(() => null),
        api.getSuperAdminHealth().catch(() => null),
        api.getSuperAdminCompanies().catch(() => []),
        api.getGlobalAuditLogs().catch(() => [])
      ]);
      setOverview(oData);
      setHealth(hData);
      setCompanies(cData);
      setAuditLogs(aData);
    } catch (err: any) {
      addToast({
        title: 'Platform owner authorization required',
        description: err.message,
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.provisionCompany(newCompany);
      addToast({
        title: 'Tenant Provisioned',
        description: `Organization ${newCompany.name} created with owner account.`,
        type: 'success'
      });
      setShowAddCompanyModal(false);
      loadData();
    } catch (err: any) {
      addToast({
        title: 'Provisioning Failed',
        description: err.message,
        type: 'danger'
      });
    }
  };

  const handleToggleStatus = async (comp: CompanyTenant) => {
    const nextStatus = !comp.is_active;
    try {
      await api.updateCompanyStatus(comp.id, nextStatus, 'Platform owner administrative action');
      addToast({
        title: nextStatus ? 'Organization Activated' : 'Organization Suspended',
        description: `${comp.name} status updated.`,
        type: nextStatus ? 'success' : 'warning'
      });
      loadData();
    } catch (err: any) {
      addToast({ title: 'Status Update Failed', description: err.message, type: 'danger' });
    }
  };

  const handleUpdateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyForPlan) return;
    try {
      await api.updateCompanySubscription(selectedCompanyForPlan.id, editPlanData);
      addToast({
        title: 'Subscription Adjusted',
        description: `Updated plan for ${selectedCompanyForPlan.name} to ${editPlanData.plan_id.toUpperCase()}.`,
        type: 'success'
      });
      setShowEditPlanModal(false);
      loadData();
    } catch (err: any) {
      addToast({ title: 'Update Failed', description: err.message, type: 'danger' });
    }
  };

  const companyColumns = [
    {
      key: 'name',
      header: 'Organization & Code',
      render: (comp: CompanyTenant) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#E8D2B5]/30 text-[#590907] font-mono font-bold text-xs border border-[#A5A79B]/30">
            {comp.code}
          </div>
          <div>
            <div className="font-bold text-xs text-[var(--text-main)] flex items-center gap-1.5">
              <span>{comp.name}</span>
              {!comp.is_active && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold uppercase">
                  Suspended
                </span>
              )}
            </div>
            <span className="text-[11px] text-[var(--text-subtle)] font-mono">{comp.contact_email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'subscription',
      header: 'Subscription & Limits',
      render: (comp: CompanyTenant) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#ECEEE7] text-[#590907] border border-[#DFE1D8] uppercase">
              {comp.subscription?.plan_name || 'Free Trial'}
            </span>
            <span className="text-[10px] font-mono text-[var(--text-subtle)]">
              {comp.user_count} / {comp.subscription?.max_employees || 10} staff
            </span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] font-mono">
            Expires: {comp.subscription?.expires_at ? new Date(comp.subscription.expires_at).toLocaleDateString() : 'Active'}
          </div>
        </div>
      )
    },
    {
      key: 'owner',
      header: 'Organization Owner',
      render: (comp: CompanyTenant) => (
        <div>
          <span className="text-xs font-medium text-[var(--text-main)] block">{comp.admin_name}</span>
          <span className="text-[10px] text-[var(--text-subtle)] font-mono">{comp.admin_email || '—'}</span>
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Administrative Actions',
      render: (comp: CompanyTenant) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedCompanyForPlan(comp);
              setEditPlanData({
                plan_id: comp.subscription?.plan_id || 'professional',
                max_employees: comp.subscription?.max_employees || 100,
                status: 'ACTIVE',
                extend_days: 30
              });
              setShowEditPlanModal(true);
            }}
            className="px-2.5 py-1 rounded-lg border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-xs font-semibold text-[#590907] transition"
          >
            Adjust Limits
          </button>
          <button
            onClick={() => handleToggleStatus(comp)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
              comp.is_active
                ? 'border-[#590907]/30 text-[#590907] hover:bg-[#590907]/10'
                : 'border-[#4A5A3F]/30 text-[#4A5A3F] hover:bg-[#4A5A3F]/10'
            }`}
          >
            {comp.is_active ? 'Suspend' : 'Activate'}
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Platform Owner Security Banner */}
      <div className="p-3.5 rounded-2xl bg-[#ECEEE7] border border-[#DFE1D8] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#E8D2B5] text-[#590907]">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold text-xs text-[var(--text-main)] flex items-center gap-2">
              <span>AUTHORIZED PLATFORM-OWNER CONSOLE</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF6F0] text-[#590907] border border-[#DFE1D8] font-bold">
                ROOT PRIVILEGES
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-subtle)]">
              Isolated from tenant workflows. Tenant organizations, managers, and employees cannot access this interface.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddCompanyModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-[#590907] hover:bg-[#450605] text-[#FAF6F0] border border-[#400605] text-xs font-extrabold shadow-sm transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Provision Organization</span>
          </button>
          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs
        tabs={[
          { id: 'overview', label: 'Global SaaS Overview' },
          { id: 'companies', label: 'Tenant Organizations', count: companies.length },
          { id: 'audit', label: 'Platform Audit Trail', count: auditLogs.length }
        ]}
        activeTab={activeTab}
        onChange={(tab) => setActiveTab(tab as any)}
      />

      {/* TAB 1: Global SaaS Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <StatCard
              label="Total Organizations"
              value={overview?.stats.total_organizations || companies.length}
              subtext="Isolated Workspaces"
              icon={<Building2 className="w-3.5 h-3.5" />}
            />
            <StatCard
              label="Active Subscriptions"
              value={overview?.stats.active_subscriptions || 0}
              subtext="Paid / Active"
              icon={<CreditCard className="w-3.5 h-3.5" />}
            />
            <StatCard
              label="Free Trials"
              value={overview?.stats.trial_organizations || 0}
              subtext="14-Day Cohort"
              icon={<Clock className="w-3.5 h-3.5" />}
            />
            <StatCard
              label="Monthly RR (INR)"
              value={`₹${(overview?.stats.monthly_recurring_revenue_inr || 0).toLocaleString()}`}
              subtext="Recurring Monthly"
              icon={<DollarSign className="w-3.5 h-3.5" />}
            />
            <StatCard
              label="Total Personnel"
              value={overview?.stats.total_employees || 0}
              subtext="Across All Tenants"
              icon={<Users className="w-3.5 h-3.5" />}
            />
            <StatCard
              label="Active Users"
              value={overview?.stats.active_users || 0}
              subtext="Healthy Status"
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            />
            <StatCard
              label="Today Punches"
              value={overview?.stats.today_attendance_punches || 0}
              subtext="Optical & Sensor"
              icon={<Activity className="w-3.5 h-3.5" />}
            />
            <StatCard
              label="Face ID Enrolled"
              value={overview?.stats.face_enrolled_total || 0}
              subtext="128-D Templates"
              icon={<ShieldCheck className="w-3.5 h-3.5" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <GlassCard
                title="Active Organizations Summary"
                subtitle="All tenant workspaces deployed on FlowPeople"
              >
                <DataTable
                  columns={companyColumns}
                  data={companies.slice(0, 5)}
                />
              </GlassCard>
            </div>

            <div>
              <GlassCard
                title="Core Services Health"
                subtitle="High-availability engine status"
              >
                <div className="space-y-3 pt-1">
                  {(health?.services || [
                    { name: 'FastAPI Core Engine', status: 'ONLINE', latency_ms: 1.2 },
                    { name: 'Face Biometrics Anti-Spoof Engine', status: 'ONLINE', latency_ms: 4.5 },
                    { name: 'Physical Fingerprint Bridge', status: 'READY', latency_ms: 2.8 },
                    { name: 'SaaS Subscription & Quota Engine', status: 'ONLINE', latency_ms: 1.5 },
                    { name: 'Tenant Isolation Gatekeeper', status: 'ONLINE', latency_ms: 0.8 }
                  ]).map((s: any) => (
                    <div
                      key={s.name}
                      className="p-3 rounded-xl border border-[var(--border-glass)] bg-[var(--surface-hover)] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#4A5A3F] animate-pulse" />
                        <span className="font-semibold text-[var(--text-main)]">{s.name}</span>
                      </div>
                      <span className="font-mono text-[10px] text-[var(--accent)] font-bold">
                        {s.latency_ms}ms
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Organizations List */}
      {activeTab === 'companies' && (
        <GlassCard
          title="All Customer Organizations"
          subtitle="Manage quotas, subscription tiers, and tenant activation states"
        >
          <DataTable
            columns={companyColumns}
            data={companies}
            searchPlaceholder="Search organizations by name or code..."
          />
        </GlassCard>
      )}

      {/* TAB 3: Global Audit Trail */}
      {activeTab === 'audit' && (
        <GlassCard
          title="Global Platform Audit Log"
          subtitle="Immutable security trail of administrative, tenant, and billing events"
        >
          <div className="space-y-2">
            {auditLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                No platform audit records logged yet.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl border border-[var(--border-glass)] bg-[var(--surface-hover)] flex items-start justify-between gap-4 text-xs"
                >
                  <div>
                    <div className="font-bold text-[var(--text-main)] flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-[var(--surface-primary)] border border-[var(--border-subtle)] font-mono text-[10px]">
                        {log.action}
                      </span>
                      <span>{log.entity_name} #{log.entity_id}</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-1">{log.details}</p>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono whitespace-nowrap">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      )}

      {/* Modal: Provision Organization */}
      <Modal
        isOpen={showAddCompanyModal}
        onClose={() => setShowAddCompanyModal(false)}
        title="Provision Customer Organization"
      >
        <form onSubmit={handleCreateCompany} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Company Name</label>
              <input
                type="text"
                required
                placeholder="Apex Logistics Ltd"
                value={newCompany.name}
                onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                className="glass-input text-xs w-full p-2.5 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Company Code</label>
              <input
                type="text"
                required
                placeholder="APEX"
                value={newCompany.code}
                onChange={(e) => setNewCompany({ ...newCompany, code: e.target.value.toUpperCase() })}
                className="glass-input text-xs w-full p-2.5 rounded-xl uppercase font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Owner Contact Email</label>
            <input
              type="email"
              required
              placeholder="admin@apexlogistics.com"
              value={newCompany.contact_email}
              onChange={(e) => setNewCompany({ ...newCompany, contact_email: e.target.value })}
              className="glass-input text-xs w-full p-2.5 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Owner First Name</label>
              <input
                type="text"
                required
                placeholder="Rajesh"
                value={newCompany.owner_first_name}
                onChange={(e) => setNewCompany({ ...newCompany, owner_first_name: e.target.value })}
                className="glass-input text-xs w-full p-2.5 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Owner Last Name</label>
              <input
                type="text"
                required
                placeholder="Sharma"
                value={newCompany.owner_last_name}
                onChange={(e) => setNewCompany({ ...newCompany, owner_last_name: e.target.value })}
                className="glass-input text-xs w-full p-2.5 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Initial Subscription Tier</label>
            <select
              value={newCompany.plan_id}
              onChange={(e) => setNewCompany({ ...newCompany, plan_id: e.target.value })}
              className="glass-input text-xs w-full p-2.5 rounded-xl"
            >
              <option value="trial">Free Trial (14 Days / 15 Staff)</option>
              <option value="starter">Starter Plan (30 Staff / Optical Face)</option>
              <option value="professional">Professional Plan (100 Staff / Face + Fingerprint + Payroll)</option>
              <option value="enterprise">Enterprise Plan (Unlimited Staff / Priority)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setShowAddCompanyModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#590907] hover:bg-[#450605] text-[#FAF6F0] font-bold text-xs shadow-sm border border-[#400605]"
            >
              Provision Workspace
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Adjust Subscription & Quotas */}
      <Modal
        isOpen={showEditPlanModal}
        onClose={() => setShowEditPlanModal(false)}
        title={`Adjust Subscription — ${selectedCompanyForPlan?.name}`}
      >
        <form onSubmit={handleUpdateSubscription} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Subscription Plan Tier</label>
            <select
              value={editPlanData.plan_id}
              onChange={(e) => setEditPlanData({ ...editPlanData, plan_id: e.target.value })}
              className="glass-input text-xs w-full p-2.5 rounded-xl"
            >
              <option value="trial">Free Trial (14 Days)</option>
              <option value="starter">Starter (30 Employees)</option>
              <option value="professional">Professional (100 Employees)</option>
              <option value="enterprise">Enterprise (Custom / High Capacity)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Employee Quota Limit</label>
              <input
                type="number"
                value={editPlanData.max_employees}
                onChange={(e) => setEditPlanData({ ...editPlanData, max_employees: parseInt(e.target.value) || 10 })}
                className="glass-input text-xs w-full p-2.5 rounded-xl font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Extend Access (Days)</label>
              <input
                type="number"
                value={editPlanData.extend_days}
                onChange={(e) => setEditPlanData({ ...editPlanData, extend_days: parseInt(e.target.value) || 30 })}
                className="glass-input text-xs w-full p-2.5 rounded-xl font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setShowEditPlanModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#590907] hover:bg-[#450605] text-[#FAF6F0] font-bold text-xs shadow-sm border border-[#400605]"
            >
              Save Adjustments
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
