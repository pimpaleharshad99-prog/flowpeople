import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Briefcase, 
  Clock, 
  Calendar, 
  Plus, 
  Users, 
  Shield, 
  ShieldCheck,
  MapPin, 
  Navigation, 
  Globe, 
  Compass, 
  CheckCircle2, 
  X,
  Layers,
  CreditCard,
  Sparkles,
  Check,
  Receipt,
  FileText,
  AlertTriangle,
  ArrowUpRight,
  Download,
  Fingerprint,
  ScanFace
} from 'lucide-react';
import { api, User, Branch, SubscriptionInfo, SubscriptionPlan, InvoiceRecord } from '../services/api';
import { GoogleDriveIntegrationCard } from '../components/GoogleDriveIntegrationCard';
import { 
  PageHeader, 
  StatCard, 
  GlassCard, 
  Tabs, 
  DataTable, 
  StatusBadge, 
  useToast 
} from '../components/ui';

interface OrganizationViewProps {
  currentUser: User | null;
}

export const OrganizationView: React.FC<OrganizationViewProps> = ({ currentUser }) => {
  const { addToast } = useToast();
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeTab, setActiveTab] = useState('branches');
  const [loading, setLoading] = useState(true);

  // Subscription & Billing state
  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('professional');
  const [upgradeCycle, setUpgradeCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [paymentTxRef, setPaymentTxRef] = useState<string>('');
  const [paying, setPaying] = useState(false);

  // White-Label Company Branding state
  const [companyBranding, setCompanyBranding] = useState({
    name: currentUser?.company_name || '',
    brand_name: currentUser?.brand_name || '',
    logo_url: currentUser?.company_logo_url || '',
    timezone: 'Asia/Kolkata',
    currency: 'INR'
  });
  const [savingBranding, setSavingBranding] = useState(false);

  // New Branch Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [branchForm, setBranchForm] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    country: 'United States',
    postal_code: '',
    timezone: 'America/New_York',
    latitude: 37.7749,
    longitude: -122.4194,
    geofence_radius_meters: 150,
    is_geofence_enforced: true,
    is_headquarters: false,
  });

  const isAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR_ADMIN' || currentUser?.role === 'ADMIN' || currentUser?.role === 'ORGANIZATION_OWNER';

  const loadOrgData = async () => {
    try {
      setLoading(true);
      const [deptData, desigData, shiftData, holData, branchData, subData, planData, invoiceData] = await Promise.all([
        api.getDepartments(),
        api.getDesignations(),
        api.getShifts(),
        api.getHolidays(),
        api.getBranches().catch(() => []),
        api.getSubscriptionInfo().catch(() => null),
        api.getSubscriptionPlans().catch(() => []),
        api.getInvoices().catch(() => []),
      ]);
      setDepartments(deptData);
      setDesignations(desigData);
      setShifts(shiftData);
      setHolidays(holData);
      setBranches(branchData);
      if (subData) setSubInfo(subData);
      if (planData) setPlans(planData);
      if (invoiceData) setInvoices(invoiceData);
      api.getCompany().then((c: any) => {
        if (c) {
          setCompanyBranding({
            name: c.name || '',
            brand_name: c.brand_name || '',
            logo_url: c.logo_url || '',
            timezone: c.timezone || 'Asia/Kolkata',
            currency: c.currency || 'INR'
          });
        }
      }).catch(() => {});
    } catch (err: any) {
      addToast({
        title: 'Error loading organization metadata',
        description: err.message,
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgData();
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('subtab') === 'integrations' || urlParams.get('google_drive') || urlParams.get('google_drive_error')) {
      setActiveTab('integrations');
    }
  }, [currentUser]);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.name || !branchForm.code) {
      addToast({
        title: 'Missing required fields',
        description: 'Branch name and code are required.',
        type: 'danger'
      });
      return;
    }
    try {
      setSubmitting(true);
      await api.createBranch({
        ...branchForm,
        latitude: Number(branchForm.latitude),
        longitude: Number(branchForm.longitude),
        geofence_radius_meters: Number(branchForm.geofence_radius_meters)
      });
      addToast({
        title: 'Office Branch Configured',
        description: `Successfully provisioned ${branchForm.name} with ${branchForm.geofence_radius_meters}m geofence.`,
        type: 'success'
      });
      setIsModalOpen(false);
      setBranchForm({
        name: '',
        code: '',
        address: '',
        city: '',
        state: '',
        country: 'United States',
        postal_code: '',
        timezone: 'America/New_York',
        latitude: 37.7749,
        longitude: -122.4194,
        geofence_radius_meters: 150,
        is_geofence_enforced: true,
        is_headquarters: false,
      });
      loadOrgData();
    } catch (err: any) {
      addToast({
        title: 'Failed to configure branch',
        description: err.message,
        type: 'danger'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const holidayColumns = [
    {
      key: 'name',
      header: 'Holiday Name',
      render: (h: any) => (
        <span className="font-medium text-xs text-[var(--text-main)]">{h.name}</span>
      ),
    },
    {
      key: 'holiday_date',
      header: 'Scheduled Date',
      render: (h: any) => (
        <span className="font-mono text-xs text-[var(--text-secondary)]">{h.holiday_date}</span>
      ),
    },
    {
      key: 'is_optional',
      header: 'Policy Rule',
      render: (h: any) => (
        <StatusBadge 
          status={h.is_optional ? 'OPTIONAL' : 'ACTIVE'} 
          customLabel={h.is_optional ? 'Optional Floating' : 'Company Wide'} 
        />
      ),
    },
    {
      key: 'description',
      header: 'Observance Notes',
      render: (h: any) => (
        <span className="text-xs text-[var(--text-secondary)]">{h.description || '—'}</span>
      ),
    },
  ];

  const handleUpgradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const plan = plans.find(p => p.id === selectedPlanId);
    if (!plan) return;

    try {
      setPaying(true);
      const amount = upgradeCycle === 'ANNUAL'
        ? (currency === 'INR' ? plan.price_annual_inr : plan.price_annual_usd)
        : (currency === 'INR' ? plan.price_monthly_inr : plan.price_monthly_usd);

      const ref = paymentTxRef.trim() || `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      await api.verifyPayment({
        plan_id: selectedPlanId,
        billing_cycle: upgradeCycle,
        transaction_reference: ref,
        amount: amount,
        currency: currency,
        billing_name: `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() || 'Organization Owner',
        billing_email: currentUser?.email || 'billing@flowcraft.io'
      });

      addToast({
        title: 'Subscription Activated',
        description: `Successfully upgraded to ${plan.name} (${upgradeCycle}). Quotas refreshed!`,
        type: 'success'
      });

      setIsUpgradeModalOpen(false);
      setPaymentTxRef('');
      const [updatedSub, updatedInvoices] = await Promise.all([
        api.getSubscriptionInfo(),
        api.getInvoices()
      ]);
      setSubInfo(updatedSub);
      setInvoices(updatedInvoices);
    } catch (err: any) {
      addToast({
        title: 'Upgrade Failed',
        description: err.message || 'Payment verification failed',
        type: 'danger'
      });
    } finally {
      setPaying(false);
    }
  };

  const printReceipt = (inv: InvoiceRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to view receipt.');
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt ${inv.invoice_number}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0d9488; padding-bottom: 20px; margin-bottom: 24px; }
          .title { font-size: 24px; font-weight: 800; color: #0f172a; }
          .accent { color: #0d9488; }
          .meta { font-size: 13px; color: #64748b; line-height: 1.6; }
          .table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px; }
          .table th { background: #f8fafc; text-align: left; padding: 12px; border-bottom: 2px solid #e2e8f0; }
          .table td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
          .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; background: #ecfdf5; color: #065f46; font-weight: 600; font-size: 12px; }
          .total { text-align: right; font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 16px; }
          .footer { margin-top: 48px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">Flow<span class="accent">People</span></div>
            <div class="meta">FlowCraft Cloud HRMS & Biometrics</div>
            <div class="meta">GSTIN / Tax ID: 27AADCF1234F1Z8</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: 700;">PAYMENT RECEIPT</div>
            <div class="meta">Invoice: <strong>${inv.invoice_number}</strong></div>
            <div class="meta">Date: ${new Date(inv.date).toLocaleDateString()}</div>
            <div class="meta">Status: <span class="badge">${inv.status}</span></div>
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <div class="meta">Billed To:</div>
          <div style="font-weight: 600; font-size: 15px;">${inv.billing_name || subInfo?.company_name || 'Organization'}</div>
          <div class="meta">${inv.billing_email || currentUser?.email || ''}</div>
          <div class="meta">Organization Code: ${subInfo?.company_code || ''}</div>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Reference</th>
              <th>Status</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>FlowPeople SaaS Subscription</td>
              <td><code>${inv.transaction_reference}</code></td>
              <td><span class="badge">${inv.status}</span></td>
              <td style="text-align: right; font-weight: 600;">${inv.currency === 'INR' ? '₹' : '$'}${inv.amount.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div class="total">
          Total Paid: ${inv.currency === 'INR' ? '₹' : '$'}${inv.amount.toLocaleString()} ${inv.currency}
        </div>

        <div class="footer">
          Thank you for trusting FlowPeople by FlowCraft. This is a computer-generated tax receipt.
        </div>
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingBranding(true);
      const res = await api.updateCompanyBranding(companyBranding);
      addToast({
        title: 'Branding Updated',
        description: 'Your organization software title, logo and white-label settings have been updated.',
        type: 'success'
      });
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        parsed.company_name = res.name;
        parsed.brand_name = res.brand_name;
        parsed.company_logo_url = res.logo_url;
        localStorage.setItem('currentUser', JSON.stringify(parsed));
      }
      setTimeout(() => window.location.reload(), 600);
    } catch (err: any) {
      addToast({
        title: 'Failed to update branding',
        description: err.message,
        type: 'danger'
      });
    } finally {
      setSavingBranding(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Organization Structure & Subscriptions"
        description="Multi-tenant operational hierarchy, physical branches, GPS geofences, SaaS quotas, and subscription lifecycle"
        action={
          isAdmin ? (
            activeTab === 'branches' ? (
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Office Branch</span>
              </button>
            ) : activeTab === 'subscription' ? (
              <button
                onClick={() => setIsUpgradeModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#590907] text-[#FAF6F0] hover:bg-[#450605] border border-[#400605] transition-colors shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span>Upgrade / Change Plan</span>
              </button>
            ) : undefined
          ) : undefined
        }
      />

      {/* 5 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Office Branches"
          value={branches.length}
          subtext="Geofenced sites"
          icon={<MapPin className="w-4 h-4 text-[var(--accent)]" />}
        />
        <StatCard
          label="Business Departments"
          value={departments.length}
          subtext="Operational units"
          icon={<Building2 className="w-4 h-4" />}
        />
        <StatCard
          label="Designation Levels"
          value={designations.length}
          subtext="Organizational roles"
          icon={<Briefcase className="w-4 h-4" />}
        />
        <StatCard
          label="Configured Shifts"
          value={shifts.length}
          subtext="Roster timings"
          icon={<Clock className="w-4 h-4" />}
        />
        <StatCard
          label="SaaS Plan Quota"
          value={subInfo ? `${subInfo.usage.employees_count}/${subInfo.usage.employees_limit}` : '10/10'}
          subtext={subInfo ? `${subInfo.plan.name}` : 'Trial Active'}
          icon={<CreditCard className="w-4 h-4 text-[#4A5A3F]" />}
        />
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'branches', label: 'Offices & Branches', count: branches.length },
          { id: 'departments', label: 'Departments', count: departments.length },
          { id: 'designations', label: 'Job Designations', count: designations.length },
          { id: 'shifts', label: 'Shift Schedules', count: shifts.length },
          { id: 'holidays', label: 'Holiday Calendar', count: holidays.length },
          { id: 'subscription', label: 'Plan & Subscription', count: subInfo?.usage.employees_count },
          { id: 'branding', label: 'Company Branding & Logo' },
          { id: 'integrations', label: 'Cloud & Google Drive Integrations' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Tab: Offices & Branches */}
      {activeTab === 'branches' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((b) => (
              <GlassCard
                key={b.id}
                title={b.name}
                subtitle={`${b.city ? b.city + ', ' : ''}${b.country || ''}`}
                action={
                  b.is_headquarters ? (
                    <span className="font-mono text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      HQ
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-[var(--text-subtle)] px-2 py-0.5 rounded bg-[var(--surface-sunken)] border border-[var(--border-glass)]">
                      {b.code}
                    </span>
                  )
                }
              >
                <div className="pt-2 space-y-2.5 text-xs">
                  {b.address && (
                    <div className="flex items-start gap-2 text-[var(--text-secondary)]">
                      <MapPin className="w-3.5 h-3.5 text-[var(--text-subtle)] shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{b.address}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-[var(--text-subtle)]">
                    <span className="inline-flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" />
                      <span>{b.timezone}</span>
                    </span>
                    <span className="font-mono">
                      {b.latitude ? `${b.latitude.toFixed(4)}, ${b.longitude?.toFixed(4)}` : 'No GPS set'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-glass)] flex items-center justify-between">
                    <div className="inline-flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span className="text-[11px] font-medium text-[var(--text-main)]">
                        Geofence: {b.geofence_radius_meters}m
                      </span>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      b.is_geofence_enforced 
                        ? 'bg-[#ECEEE7] text-[#4A5A3F]  border border-[#C8CAC0]' 
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    }`}>
                      {b.is_geofence_enforced ? 'Enforced' : 'Flexible'}
                    </span>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>

          {branches.length === 0 && !loading && (
            <div className="text-center py-12 glass rounded-xl border border-[var(--border-glass)]">
              <MapPin className="w-10 h-10 mx-auto text-[var(--text-subtle)] mb-2" />
              <p className="text-sm font-medium text-[var(--text-main)]">No office branches registered</p>
              <p className="text-xs text-[var(--text-subtle)] mt-1">Configure your physical office locations and geofencing boundaries.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Departments */}
      {activeTab === 'departments' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((d) => (
            <GlassCard
              key={d.id}
              title={d.name}
              subtitle={`Code: ${d.code}`}
              action={
                <span className="font-mono text-[11px] text-[var(--text-subtle)]">
                  ID #{d.id}
                </span>
              }
            >
              <div className="pt-2 text-xs text-[var(--text-secondary)] leading-relaxed">
                {d.description || 'Primary operational business unit.'}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Tab: Designations */}
      {activeTab === 'designations' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {designations.map((desig) => (
            <GlassCard key={desig.id}>
              <div className="space-y-1">
                <span className="font-mono text-[10px] font-medium text-[var(--accent)] px-2 py-0.5 rounded bg-[var(--accent-tint)] border border-[var(--border-glass)] inline-block">
                  {desig.code}
                </span>
                <h4 className="font-semibold text-xs text-[var(--text-main)] pt-1">{desig.name || desig.title}</h4>
                <p className="text-[11px] text-[var(--text-subtle)]">Full-time Job Profile</p>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Tab: Shifts */}
      {activeTab === 'shifts' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shifts.map((s) => (
            <GlassCard
              key={s.id}
              title={s.name}
              subtitle={`Timings: ${s.start_time} - ${s.end_time}`}
              action={
                s.is_default ? (
                  <StatusBadge status="ACTIVE" customLabel="Default Shift" />
                ) : undefined
              }
            >
              <div className="space-y-2 pt-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-subtle)]">Grace Period</span>
                  <span className="font-medium text-[var(--text-main)]">{s.grace_period_mins} mins</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-subtle)]">Break Allowance</span>
                  <span className="font-medium text-[var(--text-main)]">{s.break_duration_mins} mins</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-subtle)]">Expected Hours</span>
                  <span className="font-mono font-medium text-[var(--text-main)]">{(s.expected_work_hours / 60).toFixed(1)} hrs</span>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Tab: Holidays */}
      {activeTab === 'holidays' && (
        <DataTable
          columns={holidayColumns}
          data={holidays}
          searchPlaceholder="Search holiday name or notes..."
        />
      )}

      {/* Tab: Plan & Subscription */}
      {activeTab === 'subscription' && (
        <div className="space-y-6">
          {/* Active Subscription Overview Card */}
          <GlassCard className="p-6 border-l-4 border-l-[#4A5A3F]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#ECEEE7] text-[#4A5A3F] border border-[#C8CAC0]">
                    {subInfo?.subscription.status || 'TRIALING'}
                  </span>
                  <span className="text-xs text-[var(--text-subtle)] uppercase tracking-wider font-mono">
                    {subInfo?.company_code}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
                  <span>{subInfo?.plan.name || 'FlowPeople Starter Plan'}</span>
                  <Sparkles className="w-5 h-5 text-amber-500" />
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xl">
                  {subInfo?.plan.description || 'Full-featured enterprise workforce management, biometric attendance kiosk, and compliance suite.'}
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-[var(--text-subtle)]">
                  <span>Billing: <strong className="text-[var(--text-main)]">{subInfo?.subscription.billing_cycle || 'MONTHLY'}</strong></span>
                  <span>&bull;</span>
                  <span>
                    Renewal / Expiry: <strong className="text-[var(--text-main)]">
                      {subInfo?.subscription.current_period_end 
                        ? new Date(subInfo.subscription.current_period_end).toLocaleDateString()
                        : subInfo?.subscription.trial_ends_at
                          ? new Date(subInfo.subscription.trial_ends_at).toLocaleDateString()
                          : 'Ongoing'}
                    </strong>
                  </span>
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsUpgradeModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#590907] text-[#FAF6F0] hover:bg-[#450605] border border-[#400605] transition-colors shadow-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Change / Upgrade Tier</span>
                  </button>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Quotas & Capacity Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Employee Seats Gauge */}
            <GlassCard className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-[#ECEEE7] text-[#4A5A3F]">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--text-main)]">Employee Directory Seats</h4>
                    <p className="text-[11px] text-[var(--text-subtle)]">Active personnel capacity</p>
                  </div>
                </div>
                <span className="text-sm font-bold font-mono text-[var(--text-main)]">
                  {subInfo?.usage.employees_count || 0} / {subInfo?.usage.employees_limit || 0}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[var(--surface-sunken)] rounded-full h-2.5 overflow-hidden border border-[var(--border-glass)]">
                <div 
                  className={`h-full transition-all duration-500 ${
                    ((subInfo?.usage.employees_count || 0) / (subInfo?.usage.employees_limit || 1)) >= 0.9 
                      ? 'bg-rose-500' 
                      : 'bg-[#4A5A3F]'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round(((subInfo?.usage.employees_count || 0) / (subInfo?.usage.employees_limit || 1)) * 100))}%`
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[var(--text-subtle)]">
                <span>{subInfo?.usage.employees_remaining || 0} seats available</span>
                <span>{Math.round(((subInfo?.usage.employees_count || 0) / (subInfo?.usage.employees_limit || 1)) * 100)}% utilized</span>
              </div>
            </GlassCard>

            {/* Admin Capacity Gauge */}
            <GlassCard className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-[#ECEEE7] text-[#590907]">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--text-main)]">HR & Admin Seats</h4>
                    <p className="text-[11px] text-[var(--text-subtle)]">Management console users</p>
                  </div>
                </div>
                <span className="text-sm font-bold font-mono text-[var(--text-main)]">
                  {subInfo?.usage.admins_count || 0} / {subInfo?.usage.admins_limit || 0}
                </span>
              </div>

              <div className="w-full bg-[var(--surface-sunken)] rounded-full h-2.5 overflow-hidden border border-[var(--border-glass)]">
                <div 
                  className="h-full bg-[#590907] transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.round(((subInfo?.usage.admins_count || 0) / (subInfo?.usage.admins_limit || 1)) * 100))}%`
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[var(--text-subtle)]">
                <span>Dedicated role-based access</span>
                <span>{Math.round(((subInfo?.usage.admins_count || 0) / (subInfo?.usage.admins_limit || 1)) * 100)}% allocated</span>
              </div>
            </GlassCard>

            {/* Platform Features Included */}
            <GlassCard className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                  <Layers className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-semibold text-[var(--text-main)]">Enterprise Capabilities</h4>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-[#4A5A3F]">
                  <Check className="w-3.5 h-3.5" />
                  <span className="text-[var(--text-secondary)]">Pure 128-D Face Recognition</span>
                </div>
                <div className="flex items-center gap-2 text-[#4A5A3F]">
                  <Check className="w-3.5 h-3.5" />
                  <span className="text-[var(--text-secondary)]">Physical Fingerprint Hardware Bridge</span>
                </div>
                <div className="flex items-center gap-2 text-[#4A5A3F]">
                  <Check className="w-3.5 h-3.5" />
                  <span className="text-[var(--text-secondary)]">Vector Attendance & Timesheet PDF</span>
                </div>
                <div className="flex items-center gap-2 text-[#4A5A3F]">
                  <Check className="w-3.5 h-3.5" />
                  <span className="text-[var(--text-secondary)]">Indian DPDP & Vector Encryption</span>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Billing Invoices & Receipts History */}
          <GlassCard className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-glass)] pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#4A5A3F]" />
                <h4 className="text-sm font-semibold text-[var(--text-main)]">Billing Invoices & Receipts</h4>
              </div>
              <span className="text-xs text-[var(--text-subtle)]">
                {invoices.length} {invoices.length === 1 ? 'transaction' : 'transactions'} recorded
              </span>
            </div>

            {invoices.length === 0 ? (
              <div className="text-center py-8 text-xs text-[var(--text-subtle)] space-y-1">
                <FileText className="w-8 h-8 mx-auto opacity-30 text-[var(--text-subtle)]" />
                <p>No historical billing invoices yet.</p>
                <p>Paid plan upgrades will automatically issue tax receipts here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[var(--border-glass)] text-[var(--text-subtle)] font-medium">
                      <th className="py-2.5 px-3">Invoice Number</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Transaction Ref</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-glass)]">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-[var(--surface-sunken)]/50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-medium text-[var(--text-main)]">
                          {inv.invoice_number}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                          {new Date(inv.date).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[var(--text-subtle)]">
                          {inv.transaction_reference}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[var(--text-main)]">
                          {inv.currency === 'INR' ? '₹' : '$'}{inv.amount.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#ECEEE7] text-[#4A5A3F] border border-[#C8CAC0]">
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => printReceipt(inv)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[var(--surface-sunken)] hover:bg-[var(--surface-card)] text-[var(--text-main)] border border-[var(--border-glass)] transition-colors"
                          >
                            <Download className="w-3 h-3 text-[var(--accent)]" />
                            <span>Receipt PDF</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Tab: Company Branding & White-Label Logo */}
      {activeTab === 'branding' && (
        <div className="space-y-6">
          <GlassCard className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start justify-between border-b border-[var(--border-glass)] pb-6 mb-6">
              <div>
                <h3 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
                  <Globe className="w-5 h-5 text-[var(--accent)]" />
                  <span>White-Label Organization Branding</span>
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xl">
                  Configure your organization's custom software name and corporate logo. This replaces the default branding across the top navigation, sidebar, employee portals, and official PDF attendance reports.
                </p>
              </div>

              {/* Live Preview Pill */}
              <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-glass)] min-w-[220px]">
                <p className="text-[10px] font-bold text-[var(--text-subtle)] uppercase tracking-wider mb-2">
                  Live Header Preview
                </p>
                <div className="flex items-center gap-3">
                  {companyBranding.logo_url ? (
                    <img 
                      src={companyBranding.logo_url} 
                      alt="Logo Preview" 
                      className="w-9 h-9 object-contain rounded-lg border border-[var(--border-glass)] bg-white/40"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-[var(--accent)] text-white font-bold flex items-center justify-center text-sm shadow-sm">
                      {(companyBranding.brand_name || companyBranding.name || 'FP').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--text-main)] truncate">
                      {companyBranding.brand_name || companyBranding.name || 'FlowPeople'}
                    </p>
                    <p className="text-[10px] text-[var(--text-subtle)]">
                      by FlowCraft
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveBranding} className="space-y-5 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1.5">
                    Legal Organization Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Technologies Inc."
                    value={companyBranding.name}
                    onChange={(e) => setCompanyBranding({ ...companyBranding, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--surface-sunken)] border border-[var(--border-glass)] text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                  <span className="text-[10px] text-[var(--text-subtle)] mt-1 block">Used in legal payroll and tax receipts</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1.5">
                    Custom Software / Portal Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Workforce (defaults to Org Name)"
                    value={companyBranding.brand_name}
                    onChange={(e) => setCompanyBranding({ ...companyBranding, brand_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--surface-sunken)] border border-[var(--border-glass)] text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                  <span className="text-[10px] text-[var(--text-subtle)] mt-1 block">Displayed on Admin Panel, Sidebar & PDF Headers</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1.5">
                  Company Logo Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/assets/logo.png"
                  value={companyBranding.logo_url}
                  onChange={(e) => setCompanyBranding({ ...companyBranding, logo_url: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--surface-sunken)] border border-[var(--border-glass)] text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
                <span className="text-[10px] text-[var(--text-subtle)] mt-1 block">
                  Direct PNG, SVG, or JPG image link. Embedded in your sidebar and official PDF timesheet headers.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1.5">Corporate Timezone</label>
                  <input
                    type="text"
                    value={companyBranding.timezone}
                    onChange={(e) => setCompanyBranding({ ...companyBranding, timezone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--surface-sunken)] border border-[var(--border-glass)] text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1.5">Base Currency</label>
                  <input
                    type="text"
                    value={companyBranding.currency}
                    onChange={(e) => setCompanyBranding({ ...companyBranding, currency: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--surface-sunken)] border border-[var(--border-glass)] text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] font-mono"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#ECEEE7] border border-[#DFE1D8] text-xs text-[#590907] flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  <strong>Footer Attribution:</strong> As requested, generated PDF attendance and timesheet exports will carry your organization's logo and title prominently at the top, while keeping the platform certification stamp <em>"FlowPeople by FlowCraft"</em> discreetly at the bottom footer.
                </p>
              </div>

              {isAdmin && (
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingBranding}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity shadow-md disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{savingBranding ? 'Saving Branding...' : 'Save & Apply Organization Branding'}</span>
                  </button>
                </div>
              )}
            </form>
          </GlassCard>
        </div>
      )}

      {/* Tab: Google Drive & Cloud Integrations */}
      {activeTab === 'integrations' && (
        <GoogleDriveIntegrationCard currentUser={currentUser} />
      )}

      {/* SaaS Plan Upgrade / Change Modal */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl glass-card rounded-2xl border border-[var(--border-glass)] shadow-2xl p-6 bg-[var(--surface-panel)] space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border-glass)] pb-3">
              <div>
                <h3 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#4A5A3F]" />
                  <span>Upgrade / Change SaaS Plan</span>
                </h3>
                <p className="text-xs text-[var(--text-subtle)]">
                  Expand employee quotas, unlock biometric hardware bridges, and enable automated payroll.
                </p>
              </div>
              <button
                onClick={() => setIsUpgradeModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--surface-sunken)] text-[var(--text-subtle)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cycle & Currency Selectors */}
            <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-glass)] text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[var(--text-secondary)]">Billing Cycle:</span>
                <button
                  type="button"
                  onClick={() => setUpgradeCycle('MONTHLY')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    upgradeCycle === 'MONTHLY'
                      ? 'bg-[#590907] text-[#FAF6F0] shadow-sm'
                      : 'text-[var(--text-subtle)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setUpgradeCycle('ANNUAL')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    upgradeCycle === 'ANNUAL'
                      ? 'bg-[#590907] text-[#FAF6F0] shadow-sm'
                      : 'text-[var(--text-subtle)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Annual (Save 20%)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-medium text-[var(--text-secondary)]">Currency:</span>
                <button
                  type="button"
                  onClick={() => setCurrency('INR')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    currency === 'INR' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-subtle)]'
                  }`}
                >
                  ₹ INR
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    currency === 'USD' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-subtle)]'
                  }`}
                >
                  $ USD
                </button>
              </div>
            </div>

            {/* Plan Tier Selection Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.filter(p => p.id !== 'trial').map((p) => {
                const isSelected = selectedPlanId === p.id;
                const price = upgradeCycle === 'ANNUAL'
                  ? (currency === 'INR' ? p.price_annual_inr : p.price_annual_usd)
                  : (currency === 'INR' ? p.price_monthly_inr : p.price_monthly_usd);

                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPlanId(p.id)}
                    className={`cursor-pointer rounded-xl p-4 border transition-all space-y-3 ${
                      isSelected
                        ? 'border-[#590907] bg-[#ECEEE7] ring-2 ring-[#590907]/20 shadow-md'
                        : 'border-[var(--border-glass)] hover:border-slate-400 bg-[var(--surface-sunken)]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-[var(--text-main)]">{p.name}</h4>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-[#4A5A3F]" />}
                    </div>
                    <div>
                      <span className="text-2xl font-bold font-mono text-[var(--text-main)]">
                        {currency === 'INR' ? '₹' : '$'}{price.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-[var(--text-subtle)]">
                        /{upgradeCycle === 'ANNUAL' ? 'yr' : 'mo'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2">
                      {p.description}
                    </p>
                    <div className="pt-2 border-t border-[var(--border-glass)] space-y-1 text-[11px]">
                      <div className="font-semibold text-[#4A5A3F]">
                        Up to {p.max_employees} Staff
                      </div>
                      <div className="text-[var(--text-subtle)]">
                        Up to {p.max_hr_admins} HR Admins
                      </div>
                      <div className="text-[var(--text-subtle)]">
                        {p.face_attendance_enabled ? '✓ Pure Face Kiosk' : '— Basic attendance'}
                      </div>
                      <div className="text-[var(--text-subtle)]">
                        {p.fingerprint_enabled ? '✓ Fingerprint Bridge' : '— Mobile/Web'}
                      </div>
                      <div className="text-[var(--text-subtle)]">
                        {p.payroll_enabled ? '✓ Full Payroll & TDS' : '— Standard logs'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Payment Verification Form */}
            <form onSubmit={handleUpgradeSubmit} className="space-y-4 pt-2 border-t border-[var(--border-glass)]">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                  Payment Reference / Transaction ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter Payment Ref or leave blank for instant auto-mock gateway"
                    value={paymentTxRef}
                    onChange={(e) => setPaymentTxRef(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl text-xs bg-[var(--surface-sunken)] border border-[var(--border-glass)] text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[#590907] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setPaymentTxRef(`RAZORPAY-${Date.now().toString(36).toUpperCase()}`)}
                    className="px-3 py-2 rounded-xl text-xs font-medium bg-[var(--surface-sunken)] hover:bg-[var(--surface-card)] text-[var(--text-main)] border border-[var(--border-glass)]"
                  >
                    Generate Ref
                  </button>
                </div>
                <p className="text-[11px] text-[var(--text-subtle)] mt-1">
                  Payments are signed and verified against replay attacks on the backend server before quota activation.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-glass)]">
                <button
                  type="button"
                  onClick={() => setIsUpgradeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paying}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-[#590907] text-[#FAF6F0] hover:bg-[#450605] border border-[#400605] transition-colors shadow-lg shadow-[#590907]/20 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{paying ? 'Verifying Payment...' : 'Confirm Upgrade & Activate'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Office Branch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="relative w-full max-w-lg glass-card rounded-xl border border-[var(--border-glass)] shadow-2xl p-6 bg-[var(--surface-panel)] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border-glass)] pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-base font-semibold text-[var(--text-main)]">Add Office Branch Location</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--surface-sunken)] text-[var(--text-subtle)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Office Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Austin Innovation Hub"
                    value={branchForm.name}
                    onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-[var(--surface-sunken)] border border-[var(--border-glass)] text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Branch Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ATX-01"
                    value={branchForm.code}
                    onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-[var(--surface-sunken)] border border-[var(--border-glass)] text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Physical Street Address</label>
                <input
                  type="text"
                  placeholder="e.g. 100 Congress Avenue, Suite 1500"
                  value={branchForm.address}
                  onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-[var(--surface-sunken)] border border-[var(--border-glass)] text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">City</label>
                  <input
                    type="text"
                    placeholder="Austin"
                    value={branchForm.city}
                    onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-[var(--surface-sunken)] border border-[var(--border-glass)] text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">State / Region</label>
                  <input
                    type="text"
                    placeholder="TX"
                    value={branchForm.state}
                    onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-[var(--surface-sunken)] border border-[var(--border-glass)] text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Country</label>
                  <input
                    type="text"
                    placeholder="United States"
                    value={branchForm.country}
                    onChange={(e) => setBranchForm({ ...branchForm, country: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-[var(--surface-sunken)] border border-[var(--border-glass)] text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="30.2672"
                    value={branchForm.latitude}
                    onChange={(e) => setBranchForm({ ...branchForm, latitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-[var(--surface-sunken)] border border-[var(--border-glass)] text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="-97.7431"
                    value={branchForm.longitude}
                    onChange={(e) => setBranchForm({ ...branchForm, longitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-[var(--surface-sunken)] border border-[var(--border-glass)] text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Radius (Meters)</label>
                  <input
                    type="number"
                    min="50"
                    max="5000"
                    value={branchForm.geofence_radius_meters}
                    onChange={(e) => setBranchForm({ ...branchForm, geofence_radius_meters: parseInt(e.target.value) || 150 })}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-[var(--surface-sunken)] border border-[var(--border-glass)] text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={branchForm.is_geofence_enforced}
                    onChange={(e) => setBranchForm({ ...branchForm, is_geofence_enforced: e.target.checked })}
                    className="rounded border-[var(--border-glass)] text-[var(--accent)] focus:ring-0"
                  />
                  <span>Enforce Geofence Punch</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={branchForm.is_headquarters}
                    onChange={(e) => setBranchForm({ ...branchForm, is_headquarters: e.target.checked })}
                    className="rounded border-[var(--border-glass)] text-[var(--accent)] focus:ring-0"
                  />
                  <span>Corporate Headquarters</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-glass)]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Office Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
