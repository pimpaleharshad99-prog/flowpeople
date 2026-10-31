import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Briefcase, 
  Clock, 
  Calendar, 
  Plus, 
  Users, 
  Shield, 
  MapPin, 
  Navigation, 
  Globe, 
  Compass, 
  CheckCircle2, 
  X,
  Layers
} from 'lucide-react';
import { api, User, Branch } from '../services/api';
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

  const isAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR_ADMIN' || currentUser?.role === 'ADMIN';

  const loadOrgData = async () => {
    try {
      setLoading(true);
      const [deptData, desigData, shiftData, holData, branchData] = await Promise.all([
        api.getDepartments(),
        api.getDesignations(),
        api.getShifts(),
        api.getHolidays(),
        api.getBranches().catch(() => []),
      ]);
      setDepartments(deptData);
      setDesignations(desigData);
      setShifts(shiftData);
      setHolidays(holData);
      setBranches(branchData);
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Organization Structure & Branches"
        description="Multi-tenant operational hierarchy, physical branches, GPS geofences, departments, job roles, and shift rosters"
        action={
          isAdmin && activeTab === 'branches' ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Office Branch</span>
            </button>
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
          label="Observed Holidays"
          value={holidays.length}
          subtext="Annual company calendar"
          icon={<Calendar className="w-4 h-4" />}
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
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
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
