import React, { useState, useEffect } from 'react';
import {
  Target, 
  Award, 
  Star, 
  Plus, 
  CheckCircle2, 
  Clock,
  TrendingUp, 
  Calendar, 
  UserCheck, 
  MessageSquare,
  BarChart3
} from 'lucide-react';
import { api, Goal, PerformanceReview } from '../services/api';
import { 
  PageHeader, 
  StatCard, 
  GlassCard, 
  Tabs, 
  Modal, 
  StatusBadge, 
  useToast, 
  Avatar 
} from '../components/ui';

export const PerformanceView: React.FC = () => {
  const { addToast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [activeTab, setActiveTab] = useState('goals');

  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    kpi_metric: '',
    target_value: 100,
    current_value: 0,
    unit: '%',
    due_date: '2026-12-31'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [gData, rData] = await Promise.all([
        api.getGoals(),
        api.getPerformanceReviews()
      ]);
      setGoals(gData);
      setReviews(rData);
    } catch (err: any) {
      addToast({
        title: 'Error loading performance records',
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

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createGoal(newGoal);
      addToast({
        title: 'Goal Established',
        description: `OKR "${newGoal.title}" created successfully.`,
        type: 'success'
      });
      setShowAddGoalModal(false);
      setNewGoal({
        title: '',
        description: '',
        kpi_metric: '',
        target_value: 100,
        current_value: 0,
        unit: '%',
        due_date: '2026-12-31'
      });
      loadData();
    } catch (err: any) {
      addToast({
        title: 'Error creating goal',
        description: err.message,
        type: 'danger'
      });
    }
  };

  const handleUpdateGoalProgress = async (goal: Goal, delta: number) => {
    const nextVal = Math.min(goal.target_value, Math.max(0, goal.current_value + delta));
    try {
      await api.updateGoal(goal.id, { current_value: nextVal });
      addToast({
        title: 'Progress Updated',
        description: `Goal updated to ${nextVal} ${goal.unit}.`,
        type: 'default'
      });
      loadData();
    } catch (err: any) {
      addToast({
        title: 'Update failed',
        description: err.message,
        type: 'danger'
      });
    }
  };

  // Metrics
  const avgProgress = goals.length > 0 
    ? Math.round(goals.reduce((acc, g) => acc + (g.current_value / Math.max(1, g.target_value)), 0) / goals.length * 100)
    : 0;

  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  const achievedGoals = goals.filter(g => g.status === 'ACHIEVED').length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Performance & Appraisals"
        description="Establish key results (OKRs), track quantifiable targets, and manage quarterly 360 reviews"
        action={
          <button
            onClick={() => setShowAddGoalModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium shadow-sm transition inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New OKR Goal</span>
          </button>
        }
      />

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Goals & OKRs"
          value={goals.length}
          subtext={`${achievedGoals} targets achieved`}
          icon={<Target className="w-4 h-4" />}
        />
        <StatCard
          label="Average Progress"
          value={`${avgProgress}%`}
          trend={{ value: `${achievedGoals} complete`, positive: avgProgress >= 70 }}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <StatCard
          label="Review Cycles"
          value={reviews.length}
          subtext="Appraisals recorded"
          icon={<Award className="w-4 h-4" />}
        />
        <StatCard
          label="Average Appraisal"
          value={`${avgRating} / 5.0`}
          subtext="Team satisfaction score"
          icon={<Star className="w-4 h-4" />}
        />
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'goals', label: 'Active Goals & OKRs', count: goals.length },
          { id: 'reviews', label: 'Performance Reviews', count: reviews.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'goals' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((g) => {
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
                <div className="space-y-4 pt-2">
                  {g.description && (
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{g.description}</p>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-subtle)]">KPI: {g.kpi_metric || 'Completion'}</span>
                      <span className="font-mono font-medium text-[var(--text-main)]">
                        {g.current_value} / {g.target_value} {g.unit} ({pct}%)
                      </span>
                    </div>

                    <div className="w-full bg-[var(--surface-hover)] border border-[var(--border-glass)] rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-[var(--accent)] transition-all duration-500"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-glass)] flex items-center justify-between text-xs">
                    <span className="text-[11px] text-[var(--text-subtle)] flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Due {g.due_date}
                    </span>
                    <button
                      onClick={() => handleUpdateGoalProgress(g, 10)}
                      className="px-2 py-1 rounded border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] font-medium text-[11px] transition"
                    >
                      +10%
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="space-y-4">
          {reviews.map((r) => (
            <GlassCard key={r.id}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border-glass)]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm text-[var(--text-main)]">{r.cycle_name}</h3>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-[var(--text-subtle)]">
                    Employee: <span className="font-medium text-[var(--text-main)]">{r.employee_name}</span> • Reviewer: <span className="font-medium text-[var(--text-main)]">{r.reviewer_name}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-hover)]">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="font-mono font-bold text-xs text-[var(--text-main)]">{r.rating.toFixed(1)}</span>
                  <span className="text-[11px] text-[var(--text-subtle)]">/ 5.0</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 text-xs">
                <div className="p-3 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-hover)]">
                  <span className="font-medium text-[var(--text-main)] mb-1 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
                    Self Evaluation
                  </span>
                  <p className="text-[var(--text-secondary)] italic leading-relaxed">
                    "{r.self_assessment || 'No self evaluation submitted.'}"
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-hover)]">
                  <span className="font-medium text-[var(--text-main)] mb-1 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                    Manager Appraisal & Guidance
                  </span>
                  <p className="text-[var(--text-secondary)] leading-relaxed">
                    "{r.manager_feedback || 'Pending manager appraisal notes.'}"
                  </p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Create Goal Modal */}
      <Modal
        isOpen={showAddGoalModal}
        onClose={() => setShowAddGoalModal(false)}
        title="Create Performance Goal / OKR"
      >
        <form onSubmit={handleCreateGoal} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">Goal Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Architect High-Throughput Ingestion Engine"
              value={newGoal.title}
              onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
              className="w-full glass-input"
            />
          </div>

          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">Objective Description</label>
            <textarea
              rows={2}
              placeholder="Key deliverable description and business impact..."
              value={newGoal.description}
              onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
              className="w-full glass-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Target Metric *</label>
              <input
                type="text"
                required
                placeholder="e.g. Unit Test Coverage"
                value={newGoal.kpi_metric}
                onChange={(e) => setNewGoal({ ...newGoal, kpi_metric: e.target.value })}
                className="w-full glass-input"
              />
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Target Value *</label>
              <input
                type="number"
                required
                value={newGoal.target_value}
                onChange={(e) => setNewGoal({ ...newGoal, target_value: Number(e.target.value) })}
                className="w-full glass-input font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Metric Unit</label>
              <input
                type="text"
                value={newGoal.unit}
                onChange={(e) => setNewGoal({ ...newGoal, unit: e.target.value })}
                className="w-full glass-input font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Target Due Date *</label>
              <input
                type="date"
                required
                value={newGoal.due_date}
                onChange={(e) => setNewGoal({ ...newGoal, due_date: e.target.value })}
                className="w-full glass-input"
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border-glass)]">
            <button
              type="button"
              onClick={() => setShowAddGoalModal(false)}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-main)] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium shadow-sm"
            >
              Save OKR Goal
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
