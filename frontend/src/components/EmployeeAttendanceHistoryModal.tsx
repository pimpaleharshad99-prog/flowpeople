import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  Download,
  FileDown,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { api, AttendanceRecord } from '../services/api';
import { GlassCard, StatusBadge } from './ui';
import { generateAttendancePdf, AttendancePdfRecord } from '../utils/pdfGenerator';

interface EmployeeAttendanceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number | null;
  employeeName: string;
  employeeCode?: string;
  companyName?: string;
  companyLogoUrl?: string;
  softwareTitle?: string;
}

export const EmployeeAttendanceHistoryModal: React.FC<EmployeeAttendanceHistoryModalProps> = ({
  isOpen,
  onClose,
  userId,
  employeeName,
  employeeCode,
  companyName,
  companyLogoUrl,
  softwareTitle
}) => {
  const currentMonthStr = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      loadHistory();
    }
  }, [isOpen, userId, selectedMonth]);

  const loadHistory = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getEmployeeAttendanceHistory(userId, selectedMonth);
      setRecords(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load attendance history');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !userId) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  // Calculate statistics
  const presentRecords = records.filter(r => r.first_check_in || r.status === 'PRESENT' || r.status === 'CHECKED_IN');
  const incompleteRecords = records.filter(r => {
    if (!r.first_check_in) return false;
    if (r.last_check_out) return false;
    // If it's a past date and has no check-out, it's definitely incomplete
    return r.date < todayStr;
  });

  const totalWorkedMinutes = records.reduce((acc, r) => acc + (r.total_work_minutes || 0), 0);
  const totalWorkedHours = (totalWorkedMinutes / 60).toFixed(1);
  const avgMinutesPerDay = presentRecords.length > 0 ? Math.round(totalWorkedMinutes / presentRecords.length) : 0;
  const avgHoursStr = `${Math.floor(avgMinutesPerDay / 60)}h ${avgMinutesPerDay % 60}m`;

  const exportCSV = () => {
    if (records.length === 0) return;
    const titleBlock = [
      `# FlowPeople Attendance History — ${employeeName} (${employeeCode || 'ID: ' + userId})`,
      `# Month: ${selectedMonth}`,
      `# Generated: ${new Date().toISOString()}`,
      ''
    ].join('\n');

    const headers = ['Date', 'Status', 'First In', 'Last Out', 'Total Work (Mins)', 'Late (Mins)', 'Early Out (Mins)', 'Punches Count'];
    const rows = records.map(r => [
      r.date,
      r.status,
      r.first_check_in ? new Date(r.first_check_in).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '--',
      r.last_check_out ? new Date(r.last_check_out).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '--',
      r.total_work_minutes,
      r.late_in_minutes,
      r.early_out_minutes,
      r.punches ? r.punches.length : 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(titleBlock + '\n' + [headers, ...rows].map(row => row.join(',')).join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `Attendance_History_${employeeCode || userId}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    if (records.length === 0) return;
    const pdfRecords: AttendancePdfRecord[] = records.map(r => {
      const hrs = Math.floor(r.total_work_minutes / 60);
      const mins = r.total_work_minutes % 60;
      const punchesSummary = r.punches && r.punches.length > 0 
        ? r.punches.map(p => `${p.punch_type}: ${new Date(p.punch_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`).join(' → ')
        : '—';
      const lastPunch = r.punches && r.punches.length > 0 ? r.punches[r.punches.length - 1] : null;

      return {
        name: employeeName,
        code: employeeCode || `#${userId}`,
        department: 'General',
        branch: 'Headquarters',
        date: r.date,
        whenIn: r.first_check_in ? new Date(r.first_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
        whenOut: r.last_check_out ? new Date(r.last_check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
        duration: `${hrs}h ${mins}m`,
        status: r.status,
        method: lastPunch?.verification_method || 'FACE',
        punchLogs: punchesSummary
      };
    });

    generateAttendancePdf({
      title: `Employee Monthly Attendance Timesheet`,
      subtitle: `Official In-Out Punch Ledger for ${employeeName} (${employeeCode || `#${userId}`}) — ${selectedMonth}`,
      date: selectedMonth,
      companyName: companyName || 'Organization Workspace',
      companyLogoUrl: companyLogoUrl,
      softwareTitle: softwareTitle || companyName,
      records: pdfRecords,
      summary: {
        totalEmployees: 1,
        present: presentRecords.length,
        absent: incompleteRecords.length
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-glass)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
                <span>Employee Attendance History</span>
                <span className="text-xs px-2 py-0.5 rounded bg-[var(--surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-mono font-medium">
                  {employeeCode || `#${userId}`}
                </span>
              </h2>
              <p className="text-xs text-[var(--text-subtle)] font-medium">
                {employeeName} &bull; Official Daily Check-In/Out Ledger & Punch Timestamps
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportPDF}
              disabled={records.length === 0}
              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition inline-flex items-center gap-1.5 disabled:opacity-50 shadow-xs cursor-pointer"
              title="Generate printable PDF timesheet report"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Generate PDF</span>
            </button>
            <button
              onClick={exportCSV}
              disabled={records.length === 0}
              className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] text-xs font-semibold text-[var(--text-main)] transition inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-subtle)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Month Selector & KPI Metrics */}
        <div className="p-6 border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)]/30 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Select Month:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="glass-input text-xs py-1.5 px-3 rounded-lg border border-[var(--border-subtle)]"
              />
            </div>
            <span className="text-xs text-[var(--text-subtle)] font-mono">
              Showing {records.length} calendar {records.length === 1 ? 'record' : 'records'}
            </span>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-subtle)]">
              <span className="text-[11px] font-semibold text-[var(--text-subtle)] block uppercase tracking-wider">Days Present</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-bold font-mono text-[var(--text-main)]">{presentRecords.length}</span>
                <span className="text-xs text-[var(--text-subtle)]">days</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-subtle)]">
              <span className="text-[11px] font-semibold text-[var(--text-subtle)] block uppercase tracking-wider">Incomplete Days</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className={`text-xl font-bold font-mono ${incompleteRecords.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {incompleteRecords.length}
                </span>
                <span className="text-xs text-[var(--text-subtle)]">missing out</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-subtle)]">
              <span className="text-[11px] font-semibold text-[var(--text-subtle)] block uppercase tracking-wider">Total Working Hours</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-bold font-mono text-[var(--text-main)]">{totalWorkedHours}</span>
                <span className="text-xs text-[var(--text-subtle)]">hrs</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-subtle)]">
              <span className="text-[11px] font-semibold text-[var(--text-subtle)] block uppercase tracking-wider">Average Daily Hours</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-bold font-mono text-teal-600 dark:text-teal-400">{avgHoursStr}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ledger Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 mx-auto border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-[var(--text-subtle)] font-medium">Loading attendance ledger from database...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-500 space-y-2">
              <AlertTriangle className="w-8 h-8 mx-auto opacity-80" />
              <p className="font-semibold text-sm">{error}</p>
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center text-[var(--text-subtle)] space-y-2">
              <Calendar className="w-10 h-10 mx-auto opacity-40 text-slate-400" />
              <p className="font-semibold text-sm text-[var(--text-main)]">No Attendance Records Found</p>
              <p className="text-xs">No biometric scans or punches logged for {selectedMonth}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[var(--surface-secondary)]/50 text-[var(--text-secondary)] font-semibold border-b border-[var(--border-subtle)]">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">First Check-In</th>
                    <th className="py-2.5 px-3">Last Check-Out</th>
                    <th className="py-2.5 px-3">Working Hours</th>
                    <th className="py-2.5 px-3">Punches</th>
                    <th className="py-2.5 px-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {records.map((r) => {
                    const isMissingOut = !r.last_check_out && r.first_check_in && r.date < todayStr;
                    const isCurrentlyActiveToday = !r.last_check_out && r.first_check_in && r.date === todayStr;
                    const hrs = Math.floor(r.total_work_minutes / 60);
                    const mins = r.total_work_minutes % 60;
                    const isExpanded = expandedRow === r.id;

                    const dateObj = new Date(r.date + 'T00:00:00');
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                    return (
                      <React.Fragment key={r.id}>
                        <tr className={`hover:bg-[var(--surface-hover)] transition ${isMissingOut ? 'bg-rose-500/5' : ''}`}>
                          <td className="py-3 px-3">
                            <div className="font-medium text-[var(--text-main)]">{formattedDate}</div>
                            <span className="text-[10px] text-[var(--text-subtle)] font-mono uppercase">{dayName}</span>
                          </td>
                          <td className="py-3 px-3">
                            {isMissingOut ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Incomplete Attendance</span>
                              </span>
                            ) : isCurrentlyActiveToday ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Checked In</span>
                              </span>
                            ) : (
                              <StatusBadge status={r.status} />
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-xs">
                            {r.first_check_in ? (
                              <span className="text-[var(--text-main)] font-semibold">
                                {new Date(r.first_check_in).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : (
                              <span className="text-[var(--text-subtle)]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-xs">
                            {r.last_check_out ? (
                              <span className="text-[var(--text-main)] font-semibold">
                                {new Date(r.last_check_out).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : isMissingOut ? (
                              <span className="text-rose-600 dark:text-rose-400 font-semibold text-[11px] flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Missing
                              </span>
                            ) : isCurrentlyActiveToday ? (
                              <span className="text-teal-600 dark:text-teal-400 font-medium text-[11px]">In progress</span>
                            ) : (
                              <span className="text-[var(--text-subtle)]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-xs">
                            {r.total_work_minutes > 0 ? (
                              <span className="font-bold text-[var(--text-main)]">
                                {hrs}h {mins}m
                              </span>
                            ) : (
                              <span className="text-[var(--text-subtle)]">0h 0m</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[var(--surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                              {r.punches ? r.punches.length : 0} {r.punches?.length === 1 ? 'punch' : 'punches'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            {r.punches && r.punches.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                                className="p-1 rounded text-[var(--text-subtle)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)] transition"
                              >
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Expanded Punch Timeline */}
                        {isExpanded && r.punches && r.punches.length > 0 && (
                          <tr className="bg-[var(--surface-secondary)]/20">
                            <td colSpan={7} className="py-2.5 px-6">
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-subtle)]">
                                  Raw Punch Timeline (Asia/Kolkata):
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {r.punches.map((p, idx) => {
                                    const pTime = new Date(p.punch_time).toLocaleTimeString('en-IN', {
                                      timeZone: 'Asia/Kolkata',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit'
                                    });
                                    const isPunchIn = p.punch_type === 'IN';
                                    return (
                                      <div
                                        key={p.id || idx}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-mono flex items-center gap-1.5 border ${
                                          isPunchIn
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                            : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                                        }`}
                                      >
                                        <span className="font-bold">{p.punch_type}</span>
                                        <span>&bull;</span>
                                        <span>{pTime}</span>
                                        {p.verification_method && (
                                          <span className="text-[9px] px-1 rounded bg-black/10 dark:bg-white/10 uppercase">
                                            {p.verification_method}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[var(--border-subtle)] bg-[var(--surface-glass)] flex items-center justify-between text-xs text-[var(--text-subtle)]">
          <span>FlowPeople Biometric Attendance System &bull; Asia/Kolkata Timezone</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--surface-glass-hover)] text-xs font-semibold text-[var(--text-main)] transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
