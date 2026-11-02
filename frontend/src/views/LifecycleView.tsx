import React, { useState, useEffect } from 'react';
import {
  CheckSquare, 
  Square, 
  UserPlus, 
  Award, 
  Calendar, 
  Clock,
  FileText, 
  ShieldCheck, 
  Laptop, 
  GraduationCap, 
  Plus,
  CheckCircle2,
  TrendingUp,
  UserCheck
} from 'lucide-react';
import { api, OnboardingTask, LifecycleRecord, User } from '../services/api';
import { 
  PageHeader, 
  StatCard, 
  GlassCard, 
  Modal, 
  useToast, 
  Timeline 
} from '../components/ui';

interface LifecycleViewProps {
  currentUser?: User | null;
}

export const LifecycleView: React.FC<LifecycleViewProps> = ({ currentUser }) => {
  const { addToast } = useToast();
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [history, setHistory] = useState<LifecycleRecord[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number>(currentUser?.id || 1);
  const [loading, setLoading] = useState(true);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showTransitionModal, setShowTransitionModal] = useState(false);

  const isAdminOrManager = [
    'SUPER_ADMIN',
    'ADMIN',
    'HR_ADMIN',
    'HR_MANAGER',
    'HR_EXECUTIVE',
    'COMPANY_ADMIN',
    'MANAGER'
  ].includes(currentUser?.role || '');

  const [newTask, setNewTask] = useState({
    title: '',
    category: 'DOCUMENTS',
    due_date: '2026-11-15',
    notes: ''
  });

  const [newTransition, setNewTransition] = useState({
    stage: 'CONFIRMATION',
    effective_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    if (currentUser?.id) {
      setSelectedUserId(currentUser.id);
    }
  }, [currentUser]);

  useEffect(() => {
    if (isAdminOrManager) {
      api.getEmployees().then(setEmployees).catch(() => {});
    }
  }, [isAdminOrManager]);

  const loadData = async (targetId: number) => {
    setLoading(true);
    try {
      const [tData, hData] = await Promise.all([
        api.getOnboardingTasks(targetId),
        api.getLifecycleHistory(targetId)
      ]);
      setTasks(tData);
      setHistory(hData);
    } catch (err: any) {
      addToast({
        title: 'Error loading lifecycle data',
        description: err.message,
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedUserId) {
      loadData(selectedUserId);
    }
  }, [selectedUserId]);

  const handleToggleTask = async (id: number) => {
    try {
      await api.toggleOnboardingTask(id);
      loadData(selectedUserId);
    } catch (err: any) {
      addToast({
        title: 'Update failed',
        description: err.message,
        type: 'danger'
      });
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createOnboardingTask({
        user_id: selectedUserId,
        ...newTask
      });
      addToast({
        title: 'Task Created',
        description: `Checklist task "${newTask.title}" assigned.`,
        type: 'success'
      });
      setShowAddTaskModal(false);
      setNewTask({
        title: '',
        category: 'DOCUMENTS',
        due_date: '2026-11-15',
        notes: ''
      });
      loadData(selectedUserId);
    } catch (err: any) {
      addToast({
        title: 'Creation failed',
        description: err.message,
        type: 'danger'
      });
    }
  };

  const handleRecordTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.recordLifecycleTransition({
        user_id: selectedUserId,
        ...newTransition
      });
      addToast({
        title: 'Milestone Recorded',
        description: `Lifecycle transition to "${newTransition.stage}" logged.`,
        type: 'success'
      });
      setShowTransitionModal(false);
      setNewTransition({
        stage: 'CONFIRMATION',
        effective_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      loadData(selectedUserId);
    } catch (err: any) {
      addToast({
        title: 'Transition failed',
        description: err.message,
        type: 'danger'
      });
    }
  };

  const completedCount = tasks.filter((t) => t.is_completed).length;
  const progressPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const targetEmployee = employees.find((e) => e.id === selectedUserId) || currentUser;

  const getEmployeeName = (u?: User | null) => {
    if (!u) return 'Employee';
    if (u.full_name) return u.full_name;
    return `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Employee';
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'DOCUMENTS':
        return <FileText className="w-3.5 h-3.5 text-[var(--accent)]" />;
      case 'IT_SETUP':
        return <Laptop className="w-3.5 h-3.5 text-[#590907]" />;
      case 'TRAINING':
        return <GraduationCap className="w-3.5 h-3.5 text-[#590907]" />;
      default:
        return <UserPlus className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const timelineItems = history.map((h) => ({
    title: h.stage,
    timestamp: h.effective_date,
    description: h.notes,
    badge: `By ${h.created_by}`,
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Employee Lifecycle & Onboarding"
          description="Monitor onboarding roadmaps, procedural checklists, and organizational career transitions"
        />

        <div className="flex items-center gap-2">
          {isAdminOrManager && employees.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[var(--surface-card)] border border-[var(--border-glass)] rounded-lg px-2.5 py-1 text-xs">
              <UserCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(Number(e.target.value))}
                className="bg-transparent border-none text-[var(--text-main)] text-xs focus:outline-hidden cursor-pointer"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id} className="bg-[var(--surface-card)] text-[var(--text-main)]">
                    {getEmployeeName(emp)} ({emp.employee_code || `EMP-${emp.id}`})
                  </option>
                ))}
              </select>
            </div>
          )}

          {isAdminOrManager && (
            <button
              onClick={() => setShowTransitionModal(true)}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-main)] text-xs font-medium transition inline-flex items-center gap-1.5"
            >
              <Award className="w-3.5 h-3.5 text-[#590907]" />
              <span>Record Milestone</span>
            </button>
          )}

          {isAdminOrManager && (
            <button
              onClick={() => setShowAddTaskModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium shadow-sm transition inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Checklist Item</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Onboarding Progress"
          value={`${progressPct}%`}
          trend={{ value: `${completedCount} of ${tasks.length} done`, positive: progressPct >= 60 }}
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <StatCard
          label="Pending Tasks"
          value={tasks.length - completedCount}
          subtext="Action items remaining"
          icon={<CheckSquare className="w-4 h-4" />}
        />
        <StatCard
          label="Career Milestones"
          value={history.length}
          subtext="Recorded lifecycle events"
          icon={<Award className="w-4 h-4" />}
        />
        <StatCard
          label="Current Stage"
          value={history[history.length - 1]?.stage || 'Onboarding'}
          subtext={getEmployeeName(targetEmployee)}
          icon={<UserPlus className="w-4 h-4" />}
        />
      </div>

      {/* Progress Overview Panel */}
      <GlassCard>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[var(--text-main)]">
              Overall Onboarding Completion: {completedCount} of {tasks.length} Checkpoints Cleared for {getEmployeeName(targetEmployee)}
            </span>
            <span className="font-mono font-bold text-[var(--accent)]">{progressPct}%</span>
          </div>
          <div className="w-full bg-[var(--surface-hover)] border border-[var(--border-glass)] rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-[var(--accent)] h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </GlassCard>

      {/* Main Grid: Onboarding Checklist & Career Milestones Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Checklist (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <GlassCard
            title={`Assigned Onboarding Checkpoints (${tasks.length})`}
            subtitle="Click checkboxes to mark items completed"
          >
            {loading ? (
              <div className="py-8 text-center text-xs text-[var(--text-subtle)]">Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-subtle)]">
                No onboarding checklist items assigned for this employee.
              </div>
            ) : (
              <div className="space-y-2 pt-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                      task.is_completed
                        ? 'bg-[var(--surface-glass)] border-[var(--border-glass)] opacity-60'
                        : 'bg-[var(--surface-card)] border-[var(--border-glass)] hover:border-[var(--accent)] shadow-2xs'
                    }`}
                  >
                    <div className="mt-0.5">
                      {task.is_completed ? (
                        <CheckSquare className="w-4 h-4 text-[#4A5A3F]" />
                      ) : (
                        <Square className="w-4 h-4 text-[var(--text-subtle)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="p-1 rounded bg-[var(--surface-hover)] border border-[var(--border-glass)]">
                          {getCategoryIcon(task.category)}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            task.is_completed ? 'line-through text-[var(--text-subtle)]' : 'text-[var(--text-main)]'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                      {task.notes && (
                        <p className="text-[11px] text-[var(--text-secondary)] mt-1">{task.notes}</p>
                      )}
                      <div className="flex items-center gap-3 text-[11px] text-[var(--text-subtle)] mt-2 font-mono">
                        <span>Category: {task.category}</span>
                        {task.due_date && <span>Due: {task.due_date}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Career Timeline (1 col) */}
        <div className="space-y-4">
          <GlassCard
            title="Career Milestone Timeline"
            subtitle="Official organizational lifecycle events"
          >
            <div className="pt-2">
              {history.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--text-subtle)]">
                  No milestone transitions recorded yet.
                </div>
              ) : (
                <Timeline items={timelineItems} />
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Modal: Add Step */}
      <Modal
        isOpen={showAddTaskModal}
        onClose={() => setShowAddTaskModal(false)}
        title={`Add Onboarding Task for ${getEmployeeName(targetEmployee)}`}
      >
        <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">Task Title *</label>
            <input
              type="text"
              required
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="e.g. Sign Security & Compliance Agreement"
              className="w-full glass-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Category</label>
              <select
                value={newTask.category}
                onChange={(e) => setNewTask({ ...newTask, category: e.target.value as any })}
                className="w-full glass-input"
              >
                <option value="DOCUMENTS">Documents</option>
                <option value="IT_SETUP">IT Hardware</option>
                <option value="TRAINING">Training</option>
                <option value="ORIENTATION">Orientation</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Target Due Date</label>
              <input
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                className="w-full glass-input"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">Instructions / Notes</label>
            <textarea
              rows={2}
              value={newTask.notes}
              onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
              placeholder="Provide procedural instructions or link to documentation..."
              className="w-full glass-input"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border-glass)]">
            <button
              type="button"
              onClick={() => setShowAddTaskModal(false)}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-main)] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium shadow-sm"
            >
              Add Checkpoint
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Record Transition */}
      <Modal
        isOpen={showTransitionModal}
        onClose={() => setShowTransitionModal(false)}
        title={`Record Career Milestone for ${getEmployeeName(targetEmployee)}`}
      >
        <form onSubmit={handleRecordTransition} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Career Stage *</label>
              <select
                value={newTransition.stage}
                onChange={(e) => setNewTransition({ ...newTransition, stage: e.target.value })}
                className="w-full glass-input"
              >
                <option value="ONBOARDING">Onboarding Started</option>
                <option value="PROBATION">Probation Active</option>
                <option value="CONFIRMATION">Confirmed Full-Time</option>
                <option value="PROMOTION">Promoted / Elevated</option>
                <option value="LATERAL_TRANSFER">Department Transfer</option>
                <option value="SABBATICAL">Sabbatical / Leave</option>
                <option value="NOTICE_PERIOD">Notice Period</option>
                <option value="OFFBOARDING">Offboarded</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Effective Date *</label>
              <input
                type="date"
                required
                value={newTransition.effective_date}
                onChange={(e) => setNewTransition({ ...newTransition, effective_date: e.target.value })}
                className="w-full glass-input"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">Notes / Remarks</label>
            <textarea
              rows={3}
              value={newTransition.notes}
              onChange={(e) => setNewTransition({ ...newTransition, notes: e.target.value })}
              placeholder="e.g. Completed 6-month probationary review with exceeding expectations rating..."
              className="w-full glass-input"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border-glass)]">
            <button
              type="button"
              onClick={() => setShowTransitionModal(false)}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-main)] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium shadow-sm"
            >
              Save Milestone
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
