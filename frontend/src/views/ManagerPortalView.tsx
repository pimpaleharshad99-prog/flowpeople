import React, { useState, useEffect } from 'react';
import {
  Users, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  CheckSquare,
  AlertCircle, 
  Target, 
  Award, 
  Check, 
  X
} from 'lucide-react';
import { api, User, LeaveRequest, Goal } from '../services/api';
import { 
  PageHeader, 
  StatCard, 
  GlassCard, 
  DataTable, 
  StatusBadge, 
  useToast, 
  Avatar,
  Tabs 
} from '../components/ui';

export const ManagerPortalView: React.FC = () => {
  const { addToast } = useToast();
  const [employees, setEmployees] = useState<User[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [teamGoals, setTeamGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('roster');

  const loadData = async () => {
    setLoading(true);
    try {
      const [empData, leavesData, goalsData] = await Promise.all([
        api.getEmployees(),
        api.getLeaveApprovals(),
        api.getGoals()
      ]);
      setEmployees(empData);
      setPendingLeaves(leavesData);
      setTeamGoals(goalsData);
    } catch (err: any) {
      addToast({
        title: 'Error loading team data',
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

  const handleApproveLeave = async (id: number, name: string) => {
    try {
      await api.reviewLeaveApproval(id, 'APPROVED', 'Approved by Team Manager');
      addToast({
        title: 'Leave Approved',
        description: `Leave request for ${name} approved.`,
        type: 'success'
      });
      loadData();
    } catch (err: any) {
      addToast({
        title: 'Approval failed',
        description: err.message,
        type: 'danger'
      });
    }
  };

  const reportColumns = [
    {
      key: 'name',
      header: 'Team Member',
      render: (emp: User) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={`${emp.first_name} ${emp.last_name}`} src={emp.avatar_url} size="sm" />
          <div>
            <span className="font-medium text-xs text-[var(--text-main)] block">{emp.first_name} {emp.last_name}</span>
            <span className="text-[11px] text-[var(--text-subtle)]">{emp.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'designation_name',
      header: 'Designation',
      render: (emp: User) => (
        <span className="text-xs text-[var(--text-secondary)]">{emp.designation_name || 'Engineer'}</span>
      ),
    },
    {
      key: 'department_name',
      header: 'Department',
      render: (emp: User) => (
        <span className="text-xs text-[var(--text-secondary)]">{emp.department_name || 'Engineering'}</span>
      ),
    },
    {
      key: 'face_id',
      header: 'Face ID Attendance',
      render: (emp: User) => (
        <StatusBadge 
          status={emp.has_face_enrolled ? 'ACTIVE' : 'INACTIVE'} 
          customLabel={emp.has_face_enrolled ? 'Enrolled' : 'Not Enrolled'} 
        />
      ),
    },
    {
      key: 'status',
      header: 'Employment Status',
      render: (emp: User) => <StatusBadge status={emp.status} />,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Manager Workspace"
        description="Direct reports overview, rapid approval queues for leaves, and team OKR tracking"
      />

      {/* 3 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Direct Reports"
          value={employees.length}
          subtext="Assigned team personnel"
          icon={<Users className="w-4 h-4" />}
        />
        <StatCard
          label="Pending Leaves"
          value={pendingLeaves.length}
          subtext={pendingLeaves.length === 0 ? 'Approvals up to date' : 'Awaiting review'}
          icon={<Calendar className="w-4 h-4" />}
        />
        <StatCard
          label="Active Team Goals"
          value={teamGoals.length}
          subtext="Key results in progress"
          icon={<Target className="w-4 h-4" />}
        />
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'roster', label: 'Direct Reports Roster', count: employees.length },
          { id: 'approvals', label: 'Leave Approvals Queue', count: pendingLeaves.length },
          { id: 'goals', label: 'Team OKRs & Deliverables', count: teamGoals.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Roster Tab */}
      {activeTab === 'roster' && (
        <DataTable
          columns={reportColumns}
          data={employees}
          searchPlaceholder="Search team member by name or department..."
        />
      )}

      {/* Approvals Queue */}
      {activeTab === 'approvals' && (
        <div className="max-w-3xl">
          {/* Leaves Queue */}
          <GlassCard
            title="Leave Applications"
            subtitle={`${pendingLeaves.length} pending requests`}
          >
            <div className="space-y-3 pt-2">
              {pendingLeaves.length === 0 ? (
                <div className="text-center py-8 text-xs text-[var(--text-subtle)]">
                  No pending leave applications from your team.
                </div>
              ) : (
                pendingLeaves.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-xl border border-[var(--border-glass)] bg-[var(--surface-hover)] space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar name={req.user_name} size="sm" />
                        <div>
                          <span className="font-semibold text-[var(--text-main)] block">{req.user_name}</span>
                          <span className="text-[11px] text-[var(--text-subtle)]">{req.leave_type_name}</span>
                        </div>
                      </div>
                      <span className="font-mono font-medium text-[var(--text-main)]">{req.day_count}d</span>
                    </div>

                    <div className="text-[11px] text-[var(--text-secondary)] font-mono">
                      {req.from_date} to {req.to_date}
                    </div>

                    {req.reason && (
                      <p className="text-[11px] text-[var(--text-secondary)] italic">
                        "{req.reason}"
                      </p>
                    )}

                    <div className="pt-2 border-t border-[var(--border-glass)] flex justify-end gap-2">
                      <button
                        onClick={() => handleApproveLeave(req.id, req.user_name || 'Team Member')}
                        className="px-3 py-1 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium inline-flex items-center gap-1 transition"
                      >
                        <Check className="w-3 h-3" />
                        <span>Approve</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Goals Tab */}
      {activeTab === 'goals' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamGoals.map((g) => {
            const pct = Math.round((g.current_value / Math.max(1, g.target_value)) * 100);
            return (
              <GlassCard
                key={g.id}
                title={g.title}
                subtitle={`Owner: ${g.employee_name}`}
                action={
                  <StatusBadge 
                    status={g.status === 'ACHIEVED' ? 'ACTIVE' : 'INACTIVE'} 
                    customLabel={g.status} 
                  />
                }
              >
                <div className="space-y-3 pt-2 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--text-subtle)]">KPI: {g.kpi_metric}</span>
                    <span className="font-mono font-medium text-[var(--text-main)]">
                      {g.current_value} / {g.target_value} {g.unit} ({pct}%)
                    </span>
                  </div>

                  <div className="w-full bg-[var(--surface-hover)] border border-[var(--border-glass)] rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[var(--accent)] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>

                  <div className="text-[11px] text-[var(--text-subtle)] pt-1">
                    Target Date: {g.due_date}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
};
