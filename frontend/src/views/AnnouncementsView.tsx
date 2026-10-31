import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Info, Calendar, Radio, Users, CheckCircle2, Plus } from 'lucide-react';
import { api, Announcement, User } from '../services/api';
import { 
  PageHeader, 
  StatCard, 
  GlassCard, 
  StatusBadge, 
  Modal,
  useToast, 
  Avatar 
} from '../components/ui';

interface AnnouncementsViewProps {
  currentUser: User | null;
}

export const AnnouncementsView: React.FC<AnnouncementsViewProps> = ({ currentUser }) => {
  const { addToast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    priority: 'NORMAL' as 'NORMAL' | 'IMPORTANT' | 'URGENT'
  });

  const isAdmin = [
    'SUPER_ADMIN',
    'ADMIN',
    'HR_ADMIN',
    'HR_MANAGER',
    'HR_EXECUTIVE',
    'COMPANY_ADMIN'
  ].includes(currentUser?.role || '');

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await api.getAnnouncements();
      setAnnouncements(data);
    } catch (err: any) {
      addToast({
        title: 'Error loading announcements',
        description: err.message,
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, [currentUser]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createAnnouncement(newAnnouncement);
      addToast({
        title: 'Announcement Published',
        description: `"${newAnnouncement.title}" has been broadcast to all staff.`,
        type: 'success'
      });
      setShowCreateModal(false);
      setNewAnnouncement({
        title: '',
        content: '',
        priority: 'NORMAL'
      });
      loadAnnouncements();
    } catch (err: any) {
      addToast({
        title: 'Failed to publish announcement',
        description: err.message,
        type: 'danger'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const urgentCount = announcements.filter(a => a.priority === 'URGENT').length;
  const importantCount = announcements.filter(a => a.priority === 'IMPORTANT').length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Company Announcements"
        description="Official organization communications, procedural updates, leadership notices, and corporate events"
        action={
          isAdmin ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium shadow-sm transition inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Post Announcement</span>
            </button>
          ) : undefined
        }
      />

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Published Notices"
          value={announcements.length}
          subtext="Active company feeds"
          icon={<Bell className="w-4 h-4" />}
        />
        <StatCard
          label="Important Bulletins"
          value={importantCount}
          subtext="High visibility updates"
          icon={<AlertTriangle className="w-4 h-4" />}
        />
        <StatCard
          label="Urgent Priority"
          value={urgentCount}
          subtext={urgentCount === 0 ? 'No critical alerts' : 'Requires immediate read'}
          icon={<Radio className="w-4 h-4" />}
        />
        <StatCard
          label="Audience Reach"
          value="All Staff"
          subtext="Enterprise broadcast"
          icon={<Users className="w-4 h-4" />}
        />
      </div>

      {loading ? (
        <GlassCard>
          <div className="py-12 text-center text-xs text-[var(--text-subtle)]">
            Loading announcements feed...
          </div>
        </GlassCard>
      ) : announcements.length === 0 ? (
        <GlassCard>
          <div className="py-12 text-center text-xs text-[var(--text-subtle)]">
            No announcements currently posted.
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {announcements.map((ann) => (
            <GlassCard key={ann.id}>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-glass)]">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                      ann.priority === 'URGENT'
                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                        : ann.priority === 'IMPORTANT'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                    }`}>
                      {ann.priority}
                    </span>
                    <h3 className="font-semibold text-sm text-[var(--text-main)]">
                      {ann.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-subtle)] font-mono">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(ann.published_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                  {ann.content}
                </p>

                <div className="pt-2 flex items-center justify-between text-[11px] text-[var(--text-subtle)] border-t border-[var(--border-glass)]">
                  <div className="flex items-center gap-2">
                    <Avatar name={ann.author_name || 'HR Team'} size="sm" />
                    <span>Posted by <strong className="text-[var(--text-main)]">{ann.author_name || 'HR Management'}</strong></span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Broadcast Active</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Modal: Post Announcement */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Broadcast New Announcement"
      >
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">Headline / Subject *</label>
            <input
              type="text"
              required
              value={newAnnouncement.title}
              onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
              placeholder="e.g. Annual Company All-Hands & Q4 Roadmap Briefing"
              className="w-full glass-input"
            />
          </div>

          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">Priority Level</label>
            <select
              value={newAnnouncement.priority}
              onChange={(e) => setNewAnnouncement({ ...newAnnouncement, priority: e.target.value as any })}
              className="w-full glass-input"
            >
              <option value="NORMAL">Normal — General Information</option>
              <option value="IMPORTANT">Important — Policy & Procedure Updates</option>
              <option value="URGENT">Urgent — Immediate Action Required</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">Announcement Body *</label>
            <textarea
              rows={5}
              required
              value={newAnnouncement.content}
              onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
              placeholder="Compose full notice for all employees across the organization..."
              className="w-full glass-input"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border-glass)]">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-main)] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Publishing...' : 'Publish Announcement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
