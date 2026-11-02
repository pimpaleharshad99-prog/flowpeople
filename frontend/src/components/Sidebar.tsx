import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  Calendar, 
  Timer, 
  CheckSquare, 
  Building2, 
  BellRing,
  ShieldCheck,
  UserCheck,
  Target,
  UserPlus,
  LifeBuoy,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Scan
} from 'lucide-react';
import type { User } from '../services/api';
import { Avatar } from './ui';
import { Logo } from './brand/Logo';

export type NavTab = 
  | 'dashboard' 
  | 'hradmin'
  | 'manager'
  | 'directory' 
  | 'attendance' 
  | 'leaves' 
  | 'payroll'
  | 'approvals' 
  | 'performance'
  | 'lifecycle'
  | 'helpdesk'
  | 'organization'
  | 'announcements';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  currentUser: User | null;
  pendingApprovalsCount: number;
  onOpenKiosk?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  pendingApprovalsCount,
  onOpenKiosk,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const role = currentUser?.role || 'EMPLOYEE';
  const isOwnerOrHR = role === 'ORGANIZATION_OWNER' || role === 'COMPANY_ADMIN' || role === 'HR_ADMIN' || role === 'ADMIN' || role === 'HR_MANAGER' || role === 'SUPER_ADMIN';
  const isHRAdmin = isOwnerOrHR;
  const isManager = isOwnerOrHR || role === 'MANAGER';

  const adminPortals = [
    ...(isOwnerOrHR ? [{ id: 'hradmin' as NavTab, label: 'HR Admin Portal', icon: UserCheck }] : []),
    ...(isManager ? [{ id: 'manager' as NavTab, label: 'Manager Workspace', icon: Users }] : []),
  ];

  const coreModules = [
    { id: 'dashboard' as NavTab, label: 'HR Dashboard', icon: LayoutDashboard },
    { id: 'attendance' as NavTab, label: 'Attendance & Face ID', icon: Clock },
    { id: 'leaves' as NavTab, label: 'Leave Management', icon: Calendar },
    { id: 'payroll' as NavTab, label: isHRAdmin ? 'Payroll & Compensation' : 'My Payslips', icon: DollarSign },
    ...(isManager ? [{ id: 'approvals' as NavTab, label: 'Approvals Inbox', icon: CheckSquare, badge: pendingApprovalsCount }] : []),
    { id: 'directory' as NavTab, label: 'Employee Directory', icon: Users },
  ];

  const talentAndSupport = [
    { id: 'performance' as NavTab, label: 'Goals & Appraisals', icon: Target },
    { id: 'lifecycle' as NavTab, label: 'Onboarding & Lifecycle', icon: UserPlus },
    { id: 'helpdesk' as NavTab, label: 'HR Helpdesk', icon: LifeBuoy },
    { id: 'organization' as NavTab, label: 'Company Structure', icon: Building2 },
    { id: 'announcements' as NavTab, label: 'Announcements', icon: BellRing },
  ];

  const renderNavGroup = (title: string, items: { id: NavTab; label: string; icon: any; badge?: number }[]) => (
    <div className="space-y-1">
      {!isCollapsed && (
        <div className="px-3 pt-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--text-subtle)]">
          {title}
        </div>
      )}
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            title={isCollapsed ? item.label : undefined}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius-button)] text-xs font-medium transition-all ${
              isActive
                ? 'bg-[var(--accent)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-glass-hover)]'
            }`}
          >
            <div className={`flex items-center gap-3 ${isCollapsed ? 'mx-auto' : 'truncate'}`}>
              <Icon className={`w-4 h-4 shrink-0 stroke-[1.5] ${isActive ? 'text-white' : 'text-[var(--text-muted)]'}`} />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </div>
            {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <aside
      className={`glass-panel rounded-none border-y-0 border-l-0 border-r border-[var(--border-glass)] bg-[var(--surface-glass)] flex flex-col shrink-0 min-h-screen transition-all duration-200 select-none ${
        isCollapsed ? 'w-[72px]' : 'w-[240px]'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-3.5 flex items-center justify-between border-b border-[var(--border-glass)]">
        {!isCollapsed ? (
          <button
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center text-left focus:outline-none cursor-pointer hover:opacity-90 transition-opacity"
            title="FlowPeople - Dashboard"
          >
            <Logo size={34} />
          </button>
        ) : (
          <button
            onClick={() => setActiveTab('dashboard')}
            className="mx-auto cursor-pointer focus:outline-none hover:opacity-90 transition-opacity"
            title="FlowPeople by FlowCraft - Home"
          >
            <Logo variant="icon" size={36} />
          </button>
        )}
      </div>

      {/* Quick Launch Face Kiosk Terminal */}
      {onOpenKiosk && (
        <div className="px-3 pt-3">
          <button
            onClick={onOpenKiosk}
            className={`w-full py-2 px-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-xs transition flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-2 cursor-pointer`}
            title="Launch Company Face Scanner Kiosk"
          >
            <div className="flex items-center gap-2">
              <Scan className="w-4 h-4 animate-pulse shrink-0" />
              {!isCollapsed && <span>Face Kiosk</span>}
            </div>
            {!isCollapsed && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20 font-mono font-semibold">1:N KIOSK</span>
            )}
          </button>
        </div>
      )}

      {/* Navigation Sections */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {adminPortals.length > 0 && renderNavGroup('Governance', adminPortals)}
        {renderNavGroup('Core Workforce', coreModules)}
        {renderNavGroup('Talent & Support', talentAndSupport)}
      </nav>

      {/* Footer User Info & Collapse Toggle */}
      <div className="p-3 border-t border-[var(--border-glass)] space-y-2">
        {!isCollapsed && currentUser && (
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-[var(--radius-button)] bg-[var(--surface-hover)] border border-[var(--border-glass)]">
            <Avatar name={`${currentUser.first_name} ${currentUser.last_name}`} src={currentUser.avatar_url} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--text-main)] truncate">
                {currentUser.first_name} {currentUser.last_name}
              </p>
              <p className="text-[10px] text-[var(--text-subtle)] truncate">{currentUser.email}</p>
            </div>
          </div>
        )}

        {/* Powered by FlowCraft Mono Footer */}
        {!isCollapsed && (
          <div className="pt-1 flex items-center justify-center gap-1.5 text-[10px] text-[var(--text-subtle)]">
            <img src="/brand/flowpeople-mono.svg" alt="" className="w-3.5 h-3.5 opacity-40 shrink-0" />
            <span>Powered by FlowCraft</span>
          </div>
        )}

        {/* Collapse Sidebar Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`w-full py-1.5 flex items-center justify-center text-xs text-[var(--text-subtle)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)] rounded-[var(--radius-button)] transition-colors`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
