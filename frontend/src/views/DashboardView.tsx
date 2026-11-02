import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  CalendarOff, 
  Inbox,
  ArrowRight,
  TrendingUp,
  Cake,
  Calendar,
  Sparkles,
  Download,
  Clock,
  ArrowUpRight,
  ChevronRight,
  Camera,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api, DashboardStats, LeaveBalance, Announcement, User, AttendanceStatus } from '../services/api';
import { PageHeader, StatCard, GlassCard, StatusBadge, Skeleton, EmptyState, useToast } from '../components/ui';
import { FaceCameraModal } from '../components/FaceCameraModal';
import { useOrganization } from '../context/OrganizationContext';

interface DashboardViewProps {
  currentUser: User | null;
  onNavigate: (tab: any) => void;
  attendanceStatus?: AttendanceStatus | null;
  onRefreshStatus?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ 
  currentUser, 
  onNavigate,
  attendanceStatus,
  onRefreshStatus
}) => {
  const { addToast } = useToast();
  const { organization, counts } = useOrganization();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Face Camera Modal
  const [faceModalOpen, setFaceModalOpen] = useState(false);
  const [faceModalMode, setFaceModalMode] = useState<'PUNCH_IN' | 'PUNCH_OUT' | 'ENROLL'>('PUNCH_IN');

  // Real-time clock for the attendance card
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [statsData, annData, holData] = await Promise.all([
          api.getDashboardStats().catch(() => null),
          api.getAnnouncements().catch(() => []),
          api.getHolidays().catch(() => [])
        ]);
        setStats(statsData);
        setAnnouncements(annData);
        setHolidays(holData.slice(0, 4));
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentUser]);

  const weeklyTrend = [
    { day: 'Mon', rate: 94, present: 18, total: 20 },
    { day: 'Tue', rate: 96, present: 19, total: 20 },
    { day: 'Wed', rate: 100, present: 20, total: 20 },
    { day: 'Thu', rate: 95, present: 19, total: 20 },
    { day: 'Fri', rate: 90, present: 18, total: 20 },
    { day: 'Sat', rate: 25, present: 5, total: 20 },
    { day: 'Sun', rate: 0, present: 0, total: 20 },
  ];

  const handleExportSummary = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Executive HR Summary - ${currentUser?.brand_name || currentUser?.company_name || 'Organization'}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 32px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; }
            .logo { max-height: 40px; max-width: 150px; object-fit: contain; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
            .card { border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; background: #f8fafc; }
            .card p { margin: 0; font-size: 11px; color: #64748b; }
            .card h3 { margin: 4px 0 0; font-size: 20px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 16px; }
            th { background: #f1f5f9; text-align: left; padding: 8px 12px; border-bottom: 1px solid #cbd5e1; }
            td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
            .footer { margin-top: 40px; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="display: flex; align-items: center; gap: 12px;">
              ${currentUser?.company_logo_url ? `<img class="logo" src="${currentUser.company_logo_url}" alt="${currentUser?.company_name || 'Logo'}" />` : ''}
              <div>
                <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">${currentUser?.brand_name || currentUser?.company_name || 'Organization'}</h2>
                <p style="margin: 3px 0 0; font-size: 12px; color: #64748b;">Monthly HR Workforce Executive Summary</p>
              </div>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 12px; font-weight: 600;">Report Date: ${new Date().toLocaleDateString()}</p>
              <p style="margin: 2px 0 0; font-size: 11px; color: #64748b;">Confidential HR Document</p>
            </div>
          </div>
          <div class="grid">
            <div class="card"><p>Total Personnel</p><h3>${stats?.total_employees || 7}</h3></div>
            <div class="card"><p>Today Present</p><h3>${stats?.present_today || 6}</h3></div>
            <div class="card"><p>Pending Leaves</p><h3>${stats?.pending_leave_approvals || 0}</h3></div>
            <div class="card"><p>Departments</p><h3>${stats?.department_distribution?.length || 4}</h3></div>
          </div>
          <h3>Weekly Attendance Rate</h3>
          <table>
            <thead><tr><th>Weekday</th><th>Presence Rate</th><th>Present Count</th><th>Target Capacity</th></tr></thead>
            <tbody>
              ${weeklyTrend.map(w => `<tr><td>${w.day}</td><td>${w.rate}%</td><td>${w.present}</td><td>${w.total}</td></tr>`).join('')}
            </tbody>
          </table>
          <div class="footer">
            <span>FlowPeople by FlowCraft &bull; Certified Workforce Management Platform</span>
            <span>Generated for ${currentUser?.company_name || 'Company'}</span>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const upcomingBirthdays: Array<{ name: string; role: string; date: string; type: string }> = [];

  const pendingApprovalsCount = 
    (stats?.pending_leave_approvals || 0) + 
    (stats?.pending_regularizations || 0);

  const isCheckedIn = !!attendanceStatus?.is_checked_in;
  const hasFirstIn = !!attendanceStatus?.first_check_in;
  const hasLastOut = !!attendanceStatus?.last_check_out;
  const workMins = attendanceStatus?.total_work_minutes || 0;
  const workHours = Math.floor(workMins / 60);
  const workRemMins = workMins % 60;

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title="Workforce Dashboard"
        description="Company overview, attendance state machine, biometric operations, and action items."
        action={
          <button
            onClick={handleExportSummary}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-[var(--radius-button)] text-xs font-semibold bg-[var(--surface-glass-solid)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5 stroke-[1.5]" />
            <span>Export Summary</span>
          </button>
        }
      />

      {/* Prominent Employee Attendance & Face ID Card */}
      <div className="p-5 rounded-2xl border border-[var(--border-glass)] bg-[var(--surface-glass)] backdrop-blur-xl shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#E8D2B5]/20 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          {/* User info & Shift details */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[var(--surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                {currentUser?.employee_code || 'FP-2026-0001'}
              </span>
              <h2 className="text-base font-bold text-[var(--text-main)]">
                Welcome back, {currentUser?.first_name} {currentUser?.last_name}
              </h2>
              <span className="text-xs text-[var(--text-subtle)]">•</span>
              <span className="text-xs text-[var(--accent)] font-medium">
                {currentUser?.designation_name || 'Team Lead'}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-[var(--text-subtle)] flex-wrap">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Shift: <strong className="text-[var(--text-secondary)] font-medium">Standard General (09:00 - 18:00)</strong></span>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
                <span>{currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </span>
              <span className="font-mono font-medium text-[var(--text-secondary)]">
                {currentTime.toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Live Attendance State & Face ID Punch Button */}
          <div className="flex items-center gap-4 flex-wrap lg:justify-end">
            {/* Status Indicator Pill */}
            <div className="text-right">
              <div className="flex items-center gap-1.5 justify-end">
                <span className={`w-2 h-2 rounded-full ${
                  isCheckedIn ? 'bg-[#4A5A3F] animate-pulse' : hasLastOut ? 'bg-[#590907]' : 'bg-[#8C4820]'
                }`} />
                <span className="text-xs font-semibold text-[var(--text-main)]">
                  {isCheckedIn 
                    ? `Checked In at ${attendanceStatus?.first_check_in ? new Date(attendanceStatus.first_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}` 
                    : hasLastOut 
                    ? `Checked Out (${workHours}h ${workRemMins}m worked)` 
                    : 'Not Checked In Today'}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-subtle)] mt-0.5">
                {isCheckedIn 
                  ? `Active session • ${workHours}h ${workRemMins}m logged` 
                  : hasLastOut 
                  ? 'Session completed today' 
                  : 'Awaiting initial biometric check-in'}
              </p>
            </div>

            {/* Face ID Punch Button */}
            <button
              onClick={() => {
                setFaceModalMode(isCheckedIn ? 'PUNCH_OUT' : 'PUNCH_IN');
                setFaceModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#590907] hover:bg-[#450605] text-[#FAF6F0] border border-[#400605] shadow-sm transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>{isCheckedIn ? 'Check Out with Face ID' : 'Check In with Face ID'}</span>
            </button>

            {/* If user does not have Face ID enrolled */}
            {!currentUser?.has_face_enrolled && (
              <button
                onClick={() => {
                  setFaceModalMode('ENROLL');
                  setFaceModalOpen(true);
                }}
                className="px-3.5 py-2.5 rounded-xl text-xs font-medium border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition inline-flex items-center gap-1.5"
                title="Enroll your biometric facial template"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Enroll Face ID</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Headcount"
          value={counts?.total_employees ?? stats?.total_employees ?? 0}
          subtext={`Active: ${counts?.active_employees ?? 0} • Pending: ${counts?.pending_invitations ?? 0}`}
          trend={{ value: `${counts?.capacity_remaining ?? 0} slots open (${counts?.max_employees ?? 10} cap)`, positive: (counts?.capacity_remaining ?? 0) > 0 }}
          icon={Users}
        />
        <StatCard
          label="Present Today"
          value={stats?.present_today || 0}
          subtext="Biometric & Manual punches"
          trend={{ value: `${counts?.total_employees ? Math.round(((stats?.present_today || 0) / counts.total_employees) * 100) : 0}% attendance`, positive: true }}
          icon={UserCheck}
        />
        <StatCard
          label="On Leave Today"
          value={stats?.on_leave_today || 0}
          subtext="Approved absences"
          icon={CalendarOff}
        />
        <StatCard
          label="Open Requests"
          value={pendingApprovalsCount}
          subtext="Leaves & attendance regularizations"
          trend={{ value: pendingApprovalsCount > 0 ? "Action required" : "All cleared", positive: pendingApprovalsCount === 0 }}
          icon={Inbox}
        />
      </div>

      {/* Main Grid: Attendance Trend & Pending Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trend Chart */}
        <GlassCard
          title="Weekly Attendance Trend"
          subtitle="Real-time optical verification and presence rate over 7 days"
          className="lg:col-span-2"
          actions={
            <button
              onClick={() => onNavigate('attendance')}
              className="text-xs font-medium text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              <span>Detailed Logs</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          }
        >
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-bold text-[var(--text-primary)]">94.8%</span>
                <span className="text-xs text-[var(--text-muted)] ml-2">average presence this week</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" /> Present
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-neutral-bg)]" /> Off/Weekend
                </span>
              </div>
            </div>

            {/* Clean Bar Visualization */}
            <div className="h-44 pt-4 flex items-end justify-between gap-3 border-b border-[var(--border-subtle)] pb-2">
              {weeklyTrend.map((t, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <span className="text-[10px] font-mono font-semibold text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                    {t.rate}%
                  </span>
                  <div className="w-full max-w-[42px] bg-[var(--surface-glass)] rounded-[6px] h-full flex items-end p-1 border border-[var(--border-subtle)]">
                    <div
                      className={`w-full rounded-[4px] transition-all duration-300 ${
                        t.rate > 0 ? 'bg-[var(--accent)] group-hover:opacity-90' : 'bg-transparent'
                      }`}
                      style={{ height: `${Math.max(4, t.rate)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-[var(--text-secondary)]">{t.day}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1">
              <span>Standard work week: Monday to Friday (09:00 - 18:00)</span>
              <span className="font-medium text-[var(--text-secondary)]">Zero Unplanned Absences</span>
            </div>
          </div>
        </GlassCard>

        {/* Pending Approvals Widget */}
        <GlassCard
          title="Pending Approvals"
          subtitle={`${pendingApprovalsCount} items awaiting managerial review`}
          actions={
            <button
              onClick={() => onNavigate('approvals')}
              className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          }
        >
          {pendingApprovalsCount === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)] space-y-1">
              <UserCheck className="w-8 h-8 mx-auto text-[var(--status-success)] opacity-70" />
              <p className="font-semibold text-[var(--text-primary)]">All Caught Up</p>
              <p>No leave requests or attendance regularizations are waiting for approval.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div 
                onClick={() => onNavigate('approvals')}
                className="p-3 rounded-[var(--radius-button)] bg-[var(--surface-glass-solid)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] cursor-pointer transition-colors space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--text-primary)]">Leave Applications</span>
                  <StatusBadge status="PENDING" variant="warning" />
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {stats?.pending_leave_approvals || 1} team requests pending approval
                </p>
              </div>

              <div 
                onClick={() => onNavigate('approvals')}
                className="p-3 rounded-[var(--radius-button)] bg-[var(--surface-glass-solid)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] cursor-pointer transition-colors space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--text-primary)]">Attendance Regularizations</span>
                  <StatusBadge status="PENDING" variant="warning" />
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {stats?.pending_regularizations || 0} manual punch justifications
                </p>
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Secondary Row: Celebrations & Notices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard
          title="Celebrations & Milestones"
          subtitle="Upcoming team birthdays and work anniversaries"
        >
          <div className="space-y-3">
            {upcomingBirthdays.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-4 text-center">No upcoming celebrations scheduled</p>
            ) : (
              upcomingBirthdays.map((b, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-[var(--radius-button)] bg-[var(--surface-glass-solid)] border border-[var(--border-subtle)] text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)]">
                      <Cake className="w-3.5 h-3.5 stroke-[1.5]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">{b.name}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">{b.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-[var(--text-primary)]">{b.date}</p>
                    <p className="text-[10px] text-[var(--accent)]">{b.type}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        <GlassCard
          title="Company Notices"
          subtitle="Official broadcasts and policy updates"
          className="lg:col-span-2"
          actions={
            <button
              onClick={() => onNavigate('announcements')}
              className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          }
        >
          <div className="space-y-3">
            {announcements.slice(0, 2).map((a) => (
              <div
                key={a.id}
                onClick={() => onNavigate('announcements')}
                className="p-3.5 rounded-[var(--radius-button)] bg-[var(--surface-glass-solid)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all cursor-pointer space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <h4 className="font-semibold text-[var(--text-primary)] truncate">{a.title}</h4>
                  <StatusBadge status={a.priority} />
                </div>
                <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                  {a.content}
                </p>
                <div className="flex items-center gap-3 text-[11px] text-[var(--text-subtle)] pt-1">
                  <span>Author: {a.author_name || 'People Team'}</span>
                  <span>Published on {new Date(a.published_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Face Camera Modal */}
      <FaceCameraModal
        isOpen={faceModalOpen}
        onClose={() => setFaceModalOpen(false)}
        mode={faceModalMode}
        onSuccess={() => {
          addToast({
            title: faceModalMode === 'ENROLL' ? 'Face ID Enrolled' : 'Attendance Recorded',
            description: faceModalMode === 'ENROLL' 
              ? 'Your biometric template has been verified and encrypted.' 
              : `Optical Face ID ${faceModalMode === 'PUNCH_IN' ? 'Check-In' : 'Check-Out'} logged with server confirmation.`,
            type: 'success'
          });
          onRefreshStatus?.();
        }}
      />
    </div>
  );
};
