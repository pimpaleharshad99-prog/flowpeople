import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Check, 
  X, 
  Calendar, 
  Clock, 
  Timer, 
  MessageSquare,
  AlertCircle,
  FileText,
  UserCheck
} from 'lucide-react';
import { api, LeaveRequest, User } from '../services/api';
import { 
  PageHeader, 
  StatCard, 
  GlassCard, 
  DataTable, 
  StatusBadge, 
  Tabs, 
  Modal, 
  useToast,
  Avatar
} from '../components/ui';

interface ApprovalsViewProps {
  currentUser: User | null;
  onRefreshStats: () => void;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({ currentUser, onRefreshStats }) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('leaves');
  const [leaveApprovals, setLeaveApprovals] = useState<LeaveRequest[]>([]);
  const [regularizations, setRegularizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Review modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [targetItem, setTargetItem] = useState<{ id: number; kind: 'leave' | 'attendance'; title: string } | null>(null);
  const [reviewComments, setReviewComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadApprovals = async () => {
    try {
      setLoading(true);
      const [leaves, regs] = await Promise.all([
        api.getLeaveApprovals().catch(() => []),
        api.getPendingRegularizations().catch(() => []),
      ]);
      setLeaveApprovals(leaves);
      setRegularizations(regs);
    } catch (err: any) {
      addToast({
        title: 'Error loading approvals',
        description: err.message,
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, [currentUser]);

  const handleOpenReview = (id: number, kind: 'leave' | 'attendance', title: string, action: 'APPROVED' | 'REJECTED') => {
    setTargetItem({ id, kind, title });
    setActionType(action);
    setReviewComments('');
    setReviewModalOpen(true);
  };

  const handleConfirmReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetItem) return;
    try {
      setSubmitting(true);
      if (targetItem.kind === 'leave') {
        await api.reviewLeaveApproval(targetItem.id, actionType, reviewComments);
      } else if (targetItem.kind === 'attendance') {
        await api.reviewRegularization(targetItem.id, actionType, reviewComments);
      }
      
      addToast({
        title: `Request ${actionType === 'APPROVED' ? 'Approved' : 'Rejected'}`,
        description: `${targetItem.title} has been successfully processed.`,
        type: actionType === 'APPROVED' ? 'success' : 'default'
      });

      setReviewModalOpen(false);
      loadApprovals();
      onRefreshStats();
    } catch (err: any) {
      addToast({
        title: 'Review Action Failed',
        description: err.message,
        type: 'danger'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const totalPending = leaveApprovals.length + regularizations.length;

  const leaveColumns = [
    {
      key: 'user_name',
      header: 'Employee',
      render: (req: LeaveRequest) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={req.user_name} size="sm" />
          <div>
            <span className="font-medium text-xs text-[var(--text-main)] block">{req.user_name}</span>
            <span className="text-[11px] text-[var(--text-subtle)]">{req.department_name}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'leave_type_name',
      header: 'Leave Category',
      render: (req: LeaveRequest) => (
        <span 
          className="px-2 py-0.5 rounded text-[10px] font-medium text-white shadow-2xs" 
          style={{ backgroundColor: req.color || '#0f766e' }}
        >
          {req.leave_type_name}
        </span>
      ),
    },
    {
      key: 'from_date',
      header: 'Duration',
      render: (req: LeaveRequest) => (
        <div>
          <span className="font-mono text-xs text-[var(--text-main)] block">{req.from_date} to {req.to_date}</span>
          <span className="text-[11px] text-[var(--text-subtle)]">{req.day_count} business {req.day_count === 1 ? 'day' : 'days'}</span>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Stated Reason',
      render: (req: LeaveRequest) => (
        <span className="text-xs text-[var(--text-secondary)] line-clamp-1 max-w-xs">{req.reason}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Decision',
      align: 'right' as const,
      render: (req: LeaveRequest) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenReview(req.id, 'leave', `Leave: ${req.user_name}`, 'APPROVED')}
            className="px-2.5 py-1 rounded-md bg-[#4A5A3F] hover:bg-[#3D4B34] text-[#FAF6F0] text-xs font-medium inline-flex items-center gap-1 transition"
          >
            <Check className="w-3 h-3" />
            <span>Approve</span>
          </button>
          <button
            onClick={() => handleOpenReview(req.id, 'leave', `Leave: ${req.user_name}`, 'REJECTED')}
            className="px-2.5 py-1 rounded-md border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-rose-600 dark:text-rose-400 text-xs font-medium inline-flex items-center gap-1 transition"
          >
            <X className="w-3 h-3" />
            <span>Reject</span>
          </button>
        </div>
      ),
    },
  ];

  const regColumns = [
    {
      key: 'user_name',
      header: 'Employee',
      render: (reg: any) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={reg.user_name} size="sm" />
          <span className="font-medium text-xs text-[var(--text-main)]">{reg.user_name}</span>
        </div>
      ),
    },
    {
      key: 'requested_first_in',
      header: 'Requested Punch-In',
      render: (reg: any) => (
        <span className="font-mono text-xs text-[var(--text-secondary)]">
          {new Date(reg.requested_first_in).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      ),
    },
    {
      key: 'requested_last_out',
      header: 'Requested Punch-Out',
      render: (reg: any) => (
        <span className="font-mono text-xs text-[var(--text-secondary)]">
          {new Date(reg.requested_last_out).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Justification',
      render: (reg: any) => (
        <span className="text-xs text-[var(--text-secondary)] line-clamp-1 max-w-xs">{reg.reason}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Decision',
      align: 'right' as const,
      render: (reg: any) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenReview(reg.id, 'attendance', `Regularization: ${reg.user_name}`, 'APPROVED')}
            className="px-2.5 py-1 rounded-md bg-[#4A5A3F] hover:bg-[#3D4B34] text-[#FAF6F0] text-xs font-medium inline-flex items-center gap-1 transition"
          >
            <Check className="w-3 h-3" />
            <span>Approve</span>
          </button>
          <button
            onClick={() => handleOpenReview(reg.id, 'attendance', `Regularization: ${reg.user_name}`, 'REJECTED')}
            className="px-2.5 py-1 rounded-md border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-rose-600 dark:text-rose-400 text-xs font-medium inline-flex items-center gap-1 transition"
          >
            <X className="w-3 h-3" />
            <span>Reject</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Approvals Inbox"
        description="Unified management workspace for team leave applications and punch adjustments"
      />

      {/* 3 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Total Action Items"
          value={totalPending}
          subtext="Across active modules"
          icon={<CheckSquare className="w-4 h-4" />}
        />
        <StatCard
          label="Pending Leaves"
          value={leaveApprovals.length}
          subtext={leaveApprovals.length === 0 ? 'Queue is clear' : 'Requires approval'}
          icon={<Calendar className="w-4 h-4" />}
        />
        <StatCard
          label="Punch Regularizations"
          value={regularizations.length}
          subtext={regularizations.length === 0 ? 'No attendance disputes' : 'Pending review'}
          icon={<Clock className="w-4 h-4" />}
        />
      </div>

      {/* Navigation Tabs */}
      <Tabs
        tabs={[
          { id: 'leaves', label: 'Leave Applications', count: leaveApprovals.length },
          { id: 'attendance', label: 'Punch Regularizations', count: regularizations.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Content depending on active tab */}
      {activeTab === 'leaves' && (
        <DataTable
          columns={leaveColumns}
          data={leaveApprovals}
          searchPlaceholder="Search employee or leave type..."
          filterKey="department_name"
        />
      )}

      {activeTab === 'attendance' && (
        <DataTable
          columns={regColumns}
          data={regularizations}
          searchPlaceholder="Search employee..."
        />
      )}

      {/* Review Modal */}
      <Modal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title={`${actionType === 'APPROVED' ? 'Approve' : 'Reject'} Request`}
      >
        <form onSubmit={handleConfirmReview} className="space-y-4 text-xs">
          <div className="p-3 rounded-lg bg-[var(--surface-hover)] border border-[var(--border-glass)]">
            <span className="text-[11px] font-medium text-[var(--text-subtle)] block uppercase tracking-wider mb-0.5">
              Target Item
            </span>
            <p className="font-medium text-xs text-[var(--text-main)]">{targetItem?.title}</p>
          </div>

          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">
              Manager Note & Feedback {actionType === 'REJECTED' && <span className="text-rose-500">*</span>}
            </label>
            <textarea
              rows={3}
              required={actionType === 'REJECTED'}
              value={reviewComments}
              onChange={(e) => setReviewComments(e.target.value)}
              placeholder={actionType === 'APPROVED' ? 'Optional remarks for employee records...' : 'Please specify reason for rejection...'}
              className="w-full glass-input"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border-glass)]">
            <button
              type="button"
              onClick={() => setReviewModalOpen(false)}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-main)] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-4 py-1.5 rounded-lg text-white font-medium shadow-sm transition disabled:opacity-50 ${
                actionType === 'APPROVED'
                  ? 'bg-[#4A5A3F] hover:bg-[#3D4B34]'
                  : 'bg-rose-700 hover:bg-rose-800'
              }`}
            >
              {submitting ? 'Processing...' : `Confirm ${actionType === 'APPROVED' ? 'Approval' : 'Rejection'}`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
