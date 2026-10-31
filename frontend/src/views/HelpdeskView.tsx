import React, { useState, useEffect } from 'react';
import {
  LifeBuoy, 
  Plus, 
  MessageSquare, 
  CheckCircle2, 
  Clock,
  AlertTriangle, 
  Search, 
  Tag, 
  UserCheck,
  Check
} from 'lucide-react';
import { api, HRTicket, User } from '../services/api';
import { 
  PageHeader, 
  StatCard, 
  GlassCard, 
  DataTable, 
  StatusBadge, 
  Modal, 
  useToast, 
  Avatar,
  Drawer
} from '../components/ui';

interface HelpdeskViewProps {
  currentUser?: User | null;
}

export const HelpdeskView: React.FC<HelpdeskViewProps> = ({ currentUser }) => {
  const { addToast } = useToast();
  const [tickets, setTickets] = useState<HRTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTicketModal, setShowAddTicketModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<HRTicket | null>(null);
  const [resolutionModalOpen, setResolutionModalOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = [
    'SUPER_ADMIN',
    'ADMIN',
    'HR_ADMIN',
    'HR_MANAGER',
    'HR_EXECUTIVE',
    'COMPANY_ADMIN'
  ].includes(currentUser?.role || '');

  const [newTicket, setNewTicket] = useState({
    category: 'IT Equipment',
    subject: '',
    description: '',
    priority: 'MEDIUM'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getHelpdeskTickets();
      setTickets(data);
    } catch (err: any) {
      addToast({
        title: 'Error loading helpdesk tickets',
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

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createHelpdeskTicket(newTicket);
      addToast({
        title: 'Ticket Submitted',
        description: `Support ticket "${newTicket.subject}" created.`,
        type: 'success'
      });
      setShowAddTicketModal(false);
      setNewTicket({
        category: 'IT Equipment',
        subject: '',
        description: '',
        priority: 'MEDIUM'
      });
      loadData();
    } catch (err: any) {
      addToast({
        title: 'Submission failed',
        description: err.message,
        type: 'danger'
      });
    }
  };

  const handleResolveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    try {
      setSubmitting(true);
      await api.updateHelpdeskTicketStatus(selectedTicket.id, { 
        status: 'RESOLVED', 
        resolution_notes: resolutionNotes 
      });
      addToast({
        title: 'Ticket Resolved',
        description: `Ticket #${selectedTicket.id} closed with resolution notes.`,
        type: 'success'
      });
      setResolutionModalOpen(false);
      setSelectedTicket(null);
      setResolutionNotes('');
      loadData();
    } catch (err: any) {
      addToast({
        title: 'Resolution failed',
        description: err.message,
        type: 'danger'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openTicketsCount = tickets.filter(t => t.status === 'OPEN').length;
  const inProgressCount = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const resolvedCount = tickets.filter(t => t.status === 'RESOLVED').length;

  const ticketColumns = [
    {
      key: 'subject',
      header: 'Ticket Subject & Category',
      render: (t: HRTicket) => (
        <div 
          onClick={() => setSelectedTicket(t)} 
          className="cursor-pointer group"
        >
          <span className="font-medium text-xs text-[var(--text-main)] group-hover:text-[var(--accent)] transition block">
            {t.subject}
          </span>
          <span className="text-[11px] text-[var(--text-subtle)] flex items-center gap-1.5 mt-0.5">
            <Tag className="w-3 h-3" /> {t.category} • Submitted by {t.employee_name}
          </span>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (t: HRTicket) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
          t.priority === 'CRITICAL' || t.priority === 'HIGH'
            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
            : t.priority === 'MEDIUM'
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
            : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border-glass)]'
        }`}>
          {t.priority}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (t: HRTicket) => <StatusBadge status={t.status} />,
    },
    {
      key: 'created_at',
      header: 'Opened Date',
      render: (t: HRTicket) => (
        <span className="font-mono text-xs text-[var(--text-secondary)]">
          {new Date(t.created_at || Date.now()).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (t: HRTicket) => (
        <div className="flex items-center justify-end gap-1.5">
          {t.status !== 'RESOLVED' && (
            <button
              onClick={() => {
                setSelectedTicket(t);
                setResolutionModalOpen(true);
              }}
              className="px-2.5 py-1 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium inline-flex items-center gap-1 transition"
            >
              <Check className="w-3 h-3" />
              <span>Resolve</span>
            </button>
          )}
          <button
            onClick={() => setSelectedTicket(t)}
            className="px-2.5 py-1 text-xs font-medium rounded-md border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition"
          >
            Details
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="HR Helpdesk & Inquiry Center"
        description="Submit workplace requests, track service issues, and monitor HR resolution turnaround times"
        action={
          <button
            onClick={() => setShowAddTicketModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium shadow-sm transition inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Support Ticket</span>
          </button>
        }
      />

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Open Tickets"
          value={openTicketsCount}
          subtext="Awaiting initial assignment"
          icon={<LifeBuoy className="w-4 h-4" />}
        />
        <StatCard
          label="In Progress"
          value={inProgressCount}
          subtext="Being investigated by HR"
          icon={<Clock className="w-4 h-4" />}
        />
        <StatCard
          label="Resolved Tickets"
          value={resolvedCount}
          trend={{ value: `${tickets.length} total cases`, positive: true }}
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <StatCard
          label="Avg Turnaround"
          value="4.2 hrs"
          subtext="First response SLA: 100%"
          icon={<AlertTriangle className="w-4 h-4" />}
        />
      </div>

      {/* DataTable */}
      <DataTable
        columns={ticketColumns}
        data={tickets}
        searchPlaceholder="Search support tickets by subject, category, or employee..."
        filterKey="category"
      />

      {/* Drawer: Ticket Details */}
      <Drawer
        isOpen={!!selectedTicket && !resolutionModalOpen}
        onClose={() => setSelectedTicket(null)}
        title={selectedTicket?.subject || 'Ticket Details'}
        subtitle={`Ticket #${selectedTicket?.id} • Category: ${selectedTicket?.category}`}
        size="md"
      >
        {selectedTicket && (
          <div className="space-y-6 text-xs">
            <div className="p-4 rounded-xl border border-[var(--border-glass)] bg-[var(--surface-hover)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-[var(--text-main)]">Current Status</span>
                <StatusBadge status={selectedTicket.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border-glass)]">
                <div>
                  <span className="text-[11px] text-[var(--text-subtle)] block">Priority Level</span>
                  <span className="font-medium text-[var(--text-main)]">{selectedTicket.priority}</span>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--text-subtle)] block">Requester</span>
                  <span className="font-medium text-[var(--text-main)]">{selectedTicket.employee_name}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-glass)] bg-[var(--surface-glass)] space-y-2">
              <span className="text-[11px] font-medium text-[var(--text-subtle)] uppercase tracking-wider block">
                Description of Issue
              </span>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                {selectedTicket.description}
              </p>
            </div>

            {selectedTicket.resolution_notes && (
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Resolution Record
                </span>
                <p className="text-xs text-[var(--text-main)] leading-relaxed">
                  {selectedTicket.resolution_notes}
                </p>
              </div>
            )}

            {selectedTicket.status !== 'RESOLVED' && isAdmin && (
              <div className="pt-4 border-t border-[var(--border-glass)] flex justify-end">
                <button
                  onClick={() => setResolutionModalOpen(true)}
                  className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark Ticket as Resolved</span>
                </button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Modal: New Ticket */}
      <Modal
        isOpen={showAddTicketModal}
        onClose={() => setShowAddTicketModal(false)}
        title="Submit Support Ticket"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">Subject *</label>
            <input
              type="text"
              required
              placeholder="e.g. Ergonomic chair request or payroll inquiry"
              value={newTicket.subject}
              onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
              className="w-full glass-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Category</label>
              <select
                value={newTicket.category}
                onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                className="w-full glass-input"
              >
                <option value="IT Equipment">IT Equipment</option>
                <option value="Payroll & Benefits">Payroll & Benefits</option>
                <option value="Leaves & Absence">Leaves & Absence</option>
                <option value="Workplace Facilities">Workplace Facilities</option>
                <option value="General HR">General HR</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">Priority</label>
              <select
                value={newTicket.priority}
                onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                className="w-full glass-input"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">Detailed Description *</label>
            <textarea
              rows={4}
              required
              placeholder="Provide complete context to help HR triage and resolve promptly..."
              value={newTicket.description}
              onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
              className="w-full glass-input"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border-glass)]">
            <button
              type="button"
              onClick={() => setShowAddTicketModal(false)}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-main)] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium shadow-sm"
            >
              Submit Ticket
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Resolve Ticket */}
      <Modal
        isOpen={resolutionModalOpen}
        onClose={() => setResolutionModalOpen(false)}
        title="Resolve Ticket"
      >
        <form onSubmit={handleResolveTicket} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">Resolution Summary *</label>
            <textarea
              rows={4}
              required
              placeholder="Enter explanation of action taken to resolve this ticket..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              className="w-full glass-input"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border-glass)]">
            <button
              type="button"
              onClick={() => setResolutionModalOpen(false)}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-main)] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Closing...' : 'Close & Resolve Ticket'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
