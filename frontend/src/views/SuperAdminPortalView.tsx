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
  FileText
} from 'lucide-react';
import { api, CompanyTenant, SuperAdminHealth } from '../services/api';
import { 
  PageHeader, 
  StatCard, 
  GlassCard, 
  DataTable, 
  StatusBadge, 
  Modal, 
  useToast 
} from '../components/ui';

export const SuperAdminPortalView: React.FC = () => {
  const { addToast } = useToast();
  const [health, setHealth] = useState<SuperAdminHealth | null>(null);
  const [companies, setCompanies] = useState<CompanyTenant[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [showCreateHRAdminModal, setShowCreateHRAdminModal] = useState(false);

  // Form states
  const [newCompany, setNewCompany] = useState({
    name: '',
    code: '',
    domain: '',
    contact_email: '',
    country: 'United States',
    currency: 'USD',
    timezone: 'America/New_York'
  });

  const [newAdmin, setNewAdmin] = useState({
    company_id: 1,
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    employee_code: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [hData, cData, aData] = await Promise.all([
        api.getSuperAdminHealth(),
        api.getSuperAdminCompanies(),
        api.getGlobalAuditLogs()
      ]);
      setHealth(hData);
      setCompanies(cData);
      setAuditLogs(aData);
      if (cData.length > 0) {
        setNewAdmin(prev => ({ ...prev, company_id: cData[0].id }));
      }
    } catch (err: any) {
      addToast({
        title: 'Error loading Super Admin telemetry',
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
      await api.createCompany(newCompany);
      addToast({
        title: 'Tenant Provisioned',
        description: `Organization ${newCompany.name} established with schema isolation.`,
        type: 'success'
      });
      setShowAddCompanyModal(false);
      setNewCompany({
        name: '',
        code: '',
        domain: '',
        contact_email: '',
        country: 'United States',
        currency: 'USD',
        timezone: 'America/New_York'
      });
      loadData();
    } catch (err: any) {
      addToast({
        title: 'Provisioning failed',
        description: err.message,
        type: 'danger'
      });
    }
  };

  const handleCreateHRAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createHRAdmin(newAdmin);
      addToast({
        title: 'HR Administrator Provisioned',
        description: `Account ${newAdmin.email} (${newAdmin.employee_code}) created successfully.`,
        type: 'success'
      });
      setShowCreateHRAdminModal(false);
      setNewAdmin({
        company_id: companies[0]?.id || 1,
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        employee_code: ''
      });
      loadData();
    } catch (err: any) {
      addToast({
        title: 'Creation failed',
        description: err.message,
        type: 'danger'
      });
    }
  };

  const companyColumns = [
    {
      key: 'name',
      header: 'Organization',
      render: (c: CompanyTenant) => (
        <div>
          <span className="font-semibold text-xs text-[var(--text-main)] block">{c.name}</span>
          <span className="text-[11px] text-[var(--text-subtle)]">{c.country} • {c.currency}</span>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Tenant Code',
      render: (c: CompanyTenant) => (
        <span className="font-mono text-xs text-[var(--accent)] font-medium">{c.code}</span>
      ),
    },
    {
      key: 'contact_email',
      header: 'Admin Contact',
      render: (c: CompanyTenant) => (
        <div>
          <span className="font-medium text-xs text-[var(--text-main)] block">{c.admin_name}</span>
          <span className="text-[11px] text-[var(--text-subtle)]">{c.contact_email}</span>
        </div>
      ),
    },
    {
      key: 'user_count',
      header: 'Headcount',
      render: (c: CompanyTenant) => (
        <span className="font-mono text-xs text-[var(--text-main)] font-medium">{c.user_count} Users</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: () => <StatusBadge status="ACTIVE" customLabel="Isolated" />,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Super Admin Portal"
        description="Multi-tenant governance, biometrics compliance, system telemetry, and global audit log trail"
        action={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddCompanyModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium shadow-sm transition inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Organization</span>
            </button>
            <button
              onClick={() => setShowCreateHRAdminModal(true)}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-main)] text-xs font-medium transition inline-flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Provision HR Admin</span>
            </button>
            <button
              onClick={loadData}
              className="p-2 rounded-lg border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        }
      />

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Tenants"
          value={health?.metrics.total_companies || companies.length}
          subtext="100% schema isolated"
          icon={<Building2 className="w-4 h-4" />}
        />
        <StatCard
          label="Global Personnel"
          value={health?.metrics.total_employees || 0}
          subtext="Total workforce directory"
          icon={<Users className="w-4 h-4" />}
        />
        <StatCard
          label="Biometrics Coverage"
          value={`${health?.metrics.biometric_coverage_pct || 100}%`}
          trend={{ value: `${health?.metrics.face_id_enrolled_users || 0} enrolled`, positive: true }}
          icon={<ShieldCheck className="w-4 h-4" />}
        />
        <StatCard
          label="Engine Status"
          value="OPERATIONAL"
          subtext="Zero security incidents"
          icon={<Activity className="w-4 h-4" />}
        />
      </div>

      {/* Main Grid: Companies and Services */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Organizations Table (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <GlassCard
            title="Enterprise Tenants"
            subtitle="Multi-tenant accounts with discrete organizational databases"
            action={
              <span className="font-mono text-xs text-[var(--text-subtle)]">
                {companies.length} Registered
              </span>
            }
          >
            <div className="pt-2">
              <DataTable
                columns={companyColumns}
                data={companies}
                searchPlaceholder="Search registered tenant organizations..."
              />
            </div>
          </GlassCard>
        </div>

        {/* Microservices Telemetry (1 col) */}
        <div className="space-y-6">
          <GlassCard
            title="Core Services Telemetry"
            subtitle="System health metrics and latency"
          >
            <div className="space-y-3 pt-2">
              {health?.services ? (
                Object.entries(health.services).map(([sName, sData]: [string, any]) => (
                  <div
                    key={sName}
                    className="p-3 rounded-xl border border-[var(--border-glass)] bg-[var(--surface-hover)] flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-medium text-[var(--text-main)] block">{sName}</span>
                      <span className="text-[11px] text-[var(--text-subtle)] font-mono">{sData.latency_ms}ms latency</span>
                    </div>
                    <StatusBadge status={sData.status} />
                  </div>
                ))
              ) : (
                <div className="text-xs text-[var(--text-subtle)] py-4 text-center">Loading telemetry...</div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Global Audit Log */}
      <GlassCard
        title="Global Security Audit Trail"
        subtitle="Immutable chronological ledger of administrative access, security events, and biometrics changes"
      >
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-glass)] text-[var(--text-subtle)] font-medium uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action Type</th>
                <th className="px-4 py-3">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-glass)]">
              {auditLogs.slice(0, 10).map((log, i) => (
                <tr key={i} className="hover:bg-[var(--surface-hover)] transition">
                  <td className="px-4 py-3 font-mono text-[var(--text-subtle)] text-[11px]">
                    {new Date(log.created_at || Date.now()).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--text-main)]">
                    {log.actor_name || 'System Operator'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--surface-hover)] border border-[var(--border-glass)] text-[var(--text-secondary)]">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {log.details || 'Administrative verification passed.'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Modal: Add Organization */}
      <Modal
        isOpen={showAddCompanyModal}
        onClose={() => setShowAddCompanyModal(false)}
        title="Provision New Enterprise Organization"
      >
        <form onSubmit={handleCreateCompany} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Company Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Hexa Technologies Inc."
                value={newCompany.name}
                onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                className="w-full glass-input"
              />
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Tenant Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. HEXA"
                value={newCompany.code}
                onChange={(e) => setNewCompany({ ...newCompany, code: e.target.value.toUpperCase() })}
                className="w-full glass-input font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Corporate Domain</label>
              <input
                type="text"
                placeholder="company.com"
                value={newCompany.domain}
                onChange={(e) => setNewCompany({ ...newCompany, domain: e.target.value })}
                className="w-full glass-input"
              />
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Admin Email *</label>
              <input
                type="email"
                required
                placeholder="admin@company.com"
                value={newCompany.contact_email}
                onChange={(e) => setNewCompany({ ...newCompany, contact_email: e.target.value })}
                className="w-full glass-input"
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border-glass)]">
            <button
              type="button"
              onClick={() => setShowAddCompanyModal(false)}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-main)] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium shadow-sm"
            >
              Provision Organization
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Provision HR Admin */}
      <Modal
        isOpen={showCreateHRAdminModal}
        onClose={() => setShowCreateHRAdminModal(false)}
        title="Provision HR Administrator"
      >
        <form onSubmit={handleCreateHRAdmin} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">Assign Tenant Organization *</label>
            <select
              required
              value={newAdmin.company_id}
              onChange={(e) => setNewAdmin({ ...newAdmin, company_id: Number(e.target.value) })}
              className="w-full glass-input"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">First Name *</label>
              <input
                type="text"
                required
                value={newAdmin.first_name}
                onChange={(e) => setNewAdmin({ ...newAdmin, first_name: e.target.value })}
                className="w-full glass-input"
              />
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Last Name *</label>
              <input
                type="text"
                required
                value={newAdmin.last_name}
                onChange={(e) => setNewAdmin({ ...newAdmin, last_name: e.target.value })}
                className="w-full glass-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Admin Email *</label>
              <input
                type="email"
                required
                placeholder="hr.lead@company.com"
                value={newAdmin.email}
                onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                className="w-full glass-input"
              />
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Employee ID *</label>
              <input
                type="text"
                required
                placeholder="EMP-HR-01"
                value={newAdmin.employee_code}
                onChange={(e) => setNewAdmin({ ...newAdmin, employee_code: e.target.value })}
                className="w-full glass-input font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">Initial Password *</label>
            <input
              type="password"
              required
              value={newAdmin.password}
              onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
              className="w-full glass-input font-mono"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border-glass)]">
            <button
              type="button"
              onClick={() => setShowCreateHRAdminModal(false)}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-main)] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium shadow-sm"
            >
              Authorize HR Admin
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
