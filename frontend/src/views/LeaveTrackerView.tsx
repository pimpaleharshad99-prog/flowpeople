import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  FileText, 
  Users, 
  ShieldCheck,
  Check,
  X
} from 'lucide-react';
import { api, LeaveBalance, LeaveRequest, User } from '../services/api';
import { 
  PageHeader, 
  StatCard, 
  GlassCard, 
  StatusBadge, 
  Tabs, 
  DataTable, 
  Column, 
  Drawer, 
  ConfirmDialog, 
  FilterBar,
  Skeleton
} from '../components/ui';

interface LeaveTrackerViewProps {
  currentUser: User | null;
}

export const LeaveTrackerView: React.FC<LeaveTrackerViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'MY_LEAVE' | 'CALENDAR' | 'REQUESTS' | 'POLICIES'>('MY_LEAVE');
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [adminRequests, setAdminRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Leave Drawer Form
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applyData, setApplyData] = useState({
    leave_type_id: '',
    from_date: new Date().toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0],
    is_half_day: false,
    reason: '',
  });

  const isManager = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR_ADMIN' || currentUser?.role === 'MANAGER';

  const loadData = async () => {
    try {
      setLoading(true);
      const [b, r, types, allReqs] = await Promise.all([
        api.getMyLeaveBalances().catch(() => []),
        api.getMyLeaveRequests().catch(() => []),
        api.getLeaveTypes().catch(() => []),
        isManager ? api.getLeaveApprovals().catch(() => []) : Promise.resolve([])
      ]);
      setBalances(b);
      setRequests(r);
      setLeaveTypes(types);
      setAdminRequests(allReqs);
      if (types.length > 0 && !applyData.leave_type_id) {
        setApplyData((prev) => ({ ...prev, leave_type_id: types[0].id.toString() }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyData.leave_type_id) {
      alert('Please select a leave category');
      return;
    }
    try {
      setSubmitting(true);
      await api.applyLeave({
        leave_type_id: parseInt(applyData.leave_type_id),
        from_date: applyData.from_date,
        to_date: applyData.to_date,
        is_half_day: applyData.is_half_day,
        reason: applyData.reason,
      });
      setDrawerOpen(false);
      setApplyData({
        leave_type_id: leaveTypes[0]?.id?.toString() || '',
        from_date: new Date().toISOString().split('T')[0],
        to_date: new Date().toISOString().split('T')[0],
        is_half_day: false,
        reason: '',
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error submitting leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (id: number, status: 'APPROVED' | 'REJECTED') => {
    try {
      await api.reviewLeaveApproval(id, status);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error reviewing leave request');
    }
  };

  const handleCancelLeave = async (id: number) => {
    try {
      await api.cancelLeave(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error cancelling leave');
    }
  };

  // Stats calculation
  const totalBalance = balances.reduce((acc, curr) => acc + curr.balance, 0);
  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;

  const tabs = [
    { id: 'MY_LEAVE', label: 'My Leave & Balances' },
    { id: 'CALENDAR', label: 'Team Absence Calendar' },
    ...(isManager ? [{ id: 'REQUESTS', label: 'Team Requests', count: adminRequests.length }] : []),
    { id: 'POLICIES', label: 'Leave Policies & Quotas' },
  ];

  const requestColumns: Column<LeaveRequest>[] = [
    { key: 'leave_type_name', header: 'Leave Category' },
    { key: 'from_date', header: 'Start Date' },
    { key: 'to_date', header: 'End Date' },
    { 
      key: 'day_count', 
      header: 'Days', 
      render: (r) => <span className="font-semibold text-[var(--text-primary)]">{r.day_count} {r.day_count === 1 ? 'day' : 'days'}</span> 
    },
    { key: 'reason', header: 'Reason', render: (r) => <span className="line-clamp-1">{r.reason || 'Personal'}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }
  ];

  const teamRequestColumns: Column<LeaveRequest>[] = [
    { key: 'user_name', header: 'Employee', render: (r) => <span className="font-semibold text-[var(--text-primary)]">{r.user_name || 'Team Member'}</span> },
    { key: 'leave_type_name', header: 'Leave Category' },
    { key: 'from_date', header: 'From Date' },
    { key: 'to_date', header: 'To Date' },
    { key: 'day_count', header: 'Days', render: (r) => <span className="font-semibold text-[var(--text-primary)]">{r.day_count}d</span> },
    { key: 'reason', header: 'Reason' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Leave Management"
        description="Time-off quotas, absence calendar, and leave approvals workflow."
        action={
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-button)] text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-90 shadow-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5 stroke-[1.5]" />
            <span>Request Time Off</span>
          </button>
        }
      />

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="My Available Balance"
          value={`${totalBalance.toFixed(1)} Days`}
          subtext="Across all paid categories"
          trend={{ value: "Quota renewed 2026", positive: true }}
          icon={Calendar}
        />
        <StatCard
          label="Pending Applications"
          value={pendingCount}
          subtext="Awaiting manager sign-off"
          icon={Clock}
        />
        <StatCard
          label="Approved This Year"
          value={approvedCount}
          subtext="Recorded time off taken"
          icon={CheckCircle}
        />
        <StatCard
          label="Team On Leave Today"
          value="0 Colleagues"
          subtext="Nobody on leave today"
          icon={Users}
        />
      </div>

      {/* Navigation Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as any)} />

      {/* Tab 1: My Leave & Balances */}
      {activeTab === 'MY_LEAVE' && (
        <div className="space-y-6">
          {/* Balance Cards per Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {balances.map((b) => (
              <GlassCard key={b.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{b.leave_type_name}</span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface-glass)] px-1.5 py-0.5 rounded">
                    {b.leave_type_code}
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[var(--text-primary)] font-mono">
                    {b.balance} <span className="text-xs font-sans font-normal text-[var(--text-muted)]">days left</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-2 border-t border-[var(--border-subtle)]">
                  <span>Allocated: {b.allocated}d</span>
                  <span>Used: {b.used}d</span>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Leave History Table */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">My Leave Request History</h3>
            <DataTable
              columns={requestColumns}
              data={requests}
              keyExtractor={(r) => r.id}
              rowActions={[
                {
                  label: 'Cancel Request',
                  isDanger: true,
                  icon: XCircle,
                  onClick: (r) => handleCancelLeave(r.id)
                }
              ]}
            />
          </div>
        </div>
      )}

      {/* Tab 2: Absence Calendar */}
      {activeTab === 'CALENDAR' && (
        <GlassCard
          title="Team Absence & Holiday Schedule"
          subtitle="Overview of who is away across departments this month"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-[var(--text-muted)] border-b border-[var(--border-subtle)] pb-2">
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 28 }).map((_, i) => {
                const day = i + 1;
                const isLeaveDay = day === 4 || day === 15 || day === 16;
                return (
                  <div
                    key={i}
                    className={`h-20 p-1.5 rounded-[var(--radius-button)] border text-xs flex flex-col justify-between transition-colors ${
                      isLeaveDay
                        ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)]'
                        : 'bg-[var(--surface-glass-solid)] border-[var(--border-subtle)]'
                    }`}
                  >
                    <span className="font-semibold text-[var(--text-primary)]">{day}</span>
                    {isLeaveDay && (
                      <span className="text-[10px] font-medium text-[var(--accent)] truncate bg-[var(--surface-glass)] px-1 py-0.5 rounded">
                        Priya S. (Leave)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </GlassCard>
      )}

      {/* Tab 3: Team Requests (Manager only) */}
      {activeTab === 'REQUESTS' && isManager && (
        <div className="space-y-4">
          <DataTable
            columns={teamRequestColumns}
            data={adminRequests}
            keyExtractor={(r) => r.id}
            rowActions={[
              {
                label: 'Approve Leave',
                icon: Check,
                onClick: (r) => handleReview(r.id, 'APPROVED')
              },
              {
                label: 'Reject Leave',
                isDanger: true,
                icon: X,
                onClick: (r) => handleReview(r.id, 'REJECTED')
              }
            ]}
          />
        </div>
      )}

      {/* Tab 4: Policies */}
      {activeTab === 'POLICIES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {leaveTypes.map((t) => (
            <GlassCard key={t.id} title={t.name} subtitle={`Code: ${t.code} • Annual Quota: ${t.annual_quota} days`}>
              <div className="space-y-2 text-xs text-[var(--text-secondary)]">
                <p>{t.description || 'Standard corporate leave policy applies for full-time personnel.'}</p>
                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                  <span>Carry-forward limit: {t.carry_forward_limit || 0} days</span>
                  <StatusBadge status="ACTIVE" variant="success" />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Request Leave Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Submit Time Off Request"
        subtitle="Choose leave category and specify date range"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="px-4 py-1.5 text-xs font-semibold rounded-[var(--radius-button)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyLeave}
              disabled={submitting}
              className="px-4 py-1.5 text-xs font-semibold rounded-[var(--radius-button)] bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Send Application'}
            </button>
          </>
        }
      >
        <form onSubmit={handleApplyLeave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
              Leave Category *
            </label>
            <select
              value={applyData.leave_type_id}
              onChange={(e) => setApplyData({ ...applyData, leave_type_id: e.target.value })}
              className="w-full text-xs glass-input p-2.5 bg-[var(--surface-glass-solid)]"
              required
            >
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={applyData.from_date}
                onChange={(e) => setApplyData({ ...applyData, from_date: e.target.value })}
                className="w-full text-xs glass-input p-2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                End Date *
              </label>
              <input
                type="date"
                required
                value={applyData.to_date}
                onChange={(e) => setApplyData({ ...applyData, to_date: e.target.value })}
                className="w-full text-xs glass-input p-2.5"
              />
            </div>
          </div>

          <div className="p-3 rounded-[var(--radius-button)] bg-[var(--surface-glass)] border border-[var(--border-subtle)]">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={applyData.is_half_day}
                onChange={(e) => setApplyData({ ...applyData, is_half_day: e.target.checked })}
                className="rounded border-[var(--border-strong)] text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              <span>Half Day Session</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
              Reason / Explanatory Notes *
            </label>
            <textarea
              required
              rows={3}
              value={applyData.reason}
              onChange={(e) => setApplyData({ ...applyData, reason: e.target.value })}
              placeholder="e.g. Annual dental checkup and personal appointment"
              className="w-full text-xs glass-input p-2.5"
            />
          </div>
        </form>
      </Drawer>
    </div>
  );
};
