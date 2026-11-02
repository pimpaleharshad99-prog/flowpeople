import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Square, 
  Search, 
  Bell, 
  Sun, 
  Moon, 
  X,
  Clock,
  LogOut,
  Camera,
  Scan
} from 'lucide-react';
import type { User, AttendanceStatus } from '../services/api';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { Avatar } from './ui';
import { Logo } from './brand/Logo';

interface TopHeaderProps {
  currentUser: User | null;
  attendanceStatus: AttendanceStatus | null;
  onRefreshAttendance: () => void;
  activeTabTitle?: string;
  onOpenFaceModal?: () => void;
  onOpenKiosk?: () => void;
  onLogout?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentUser,
  attendanceStatus,
  onRefreshAttendance,
  activeTabTitle = 'Overview',
  onOpenFaceModal,
  onOpenKiosk,
  onLogout,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [punching, setPunching] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Live timer when checked in
  useEffect(() => {
    if (attendanceStatus?.is_checked_in && attendanceStatus.first_check_in) {
      const startTime = new Date(attendanceStatus.first_check_in).getTime();
      const interval = setInterval(() => {
        const now = Date.now();
        setElapsedSeconds(Math.max(0, Math.floor((now - startTime) / 1000)));
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsedSeconds(0);
    }
  }, [attendanceStatus]);

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePunch = async () => {
    try {
      setPunching(true);
      const nextType = attendanceStatus?.is_checked_in ? 'OUT' : 'IN';
      await api.punch(nextType, 'FlowPeople Web Terminal');
      onRefreshAttendance();
    } catch (err: any) {
      alert(`Attendance punch error: ${err.message}`);
    } finally {
      setPunching(false);
    }
  };

  return (
    <header className="h-16 px-6 glass-panel rounded-none border-x-0 border-t-0 border-b border-[var(--border-glass)] bg-[var(--surface-glass)] flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left: Breadcrumb / Page Title */}
      <div className="flex items-center gap-3">
        <div className="md:hidden shrink-0">
          <Logo 
            variant="icon" 
            size={28} 
            customLogoUrl={currentUser?.company_logo_url}
            customTitle={currentUser?.brand_name || currentUser?.company_name}
          />
        </div>
        <span className="hidden sm:inline text-xs font-medium text-[var(--text-subtle)]">
          {currentUser?.brand_name || currentUser?.company_name || 'FlowPeople'}
        </span>
        <span className="hidden sm:inline text-xs text-[var(--text-subtle)]">/</span>
        <span className="text-sm font-semibold text-[var(--text-main)]">{activeTabTitle}</span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Global Search Shortcut */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-button)] bg-[var(--surface-glass-solid)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:border-[var(--border-strong)] cursor-pointer transition-colors">
          <Search className="w-3.5 h-3.5 stroke-[1.5]" />
          <span>Search anything...</span>
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--status-neutral-bg)] font-mono text-[10px] text-[var(--text-subtle)]">
            Ctrl+K
          </kbd>
        </div>

        {/* Compact Clock In / Clock Out Timer */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--radius-button)] bg-[var(--surface-glass-solid)] border border-[var(--border-subtle)]">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              attendanceStatus?.is_checked_in
                ? 'bg-[var(--status-success)] animate-pulse'
                : 'bg-[var(--status-neutral)]'
            }`}
          />
          <span className="text-xs font-mono font-semibold text-[var(--text-primary)]">
            {attendanceStatus?.is_checked_in ? formatTimer(elapsedSeconds) : '00:00:00'}
          </span>

          <button
            onClick={handlePunch}
            disabled={punching}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-semibold text-white transition-all ${
              attendanceStatus?.is_checked_in
                ? 'bg-[var(--status-danger)] hover:opacity-90'
                : 'bg-[var(--accent)] hover:opacity-90'
            }`}
          >
            {attendanceStatus?.is_checked_in ? (
              <>
                <Square className="w-3 h-3 fill-current" />
                <span>Clock Out</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Clock In</span>
              </>
            )}
          </button>

          {onOpenFaceModal && (
            <button
              onClick={onOpenFaceModal}
              title="Verify with Face ID Camera"
              className="p-1 text-[var(--accent)] hover:bg-[var(--accent-subtle)] rounded-[6px] transition-colors"
            >
              <Camera className="w-3.5 h-3.5 stroke-[1.5]" />
            </button>
          )}
        </div>

        {/* Company Face Attendance Kiosk Button */}
        {onOpenKiosk && (
          <button
            onClick={onOpenKiosk}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-button)] bg-[#590907] hover:bg-[#450605] text-[#FAF6F0] font-bold text-xs shadow-xs transition cursor-pointer border border-[#400605]"
            title="Launch Company-Wide Face Attendance Terminal"
          >
            <Scan className="w-3.5 h-3.5 animate-pulse text-[#E8D2B5]" />
            <span className="hidden sm:inline">Face Kiosk</span>
          </button>
        )}

        {/* Notifications Icon */}
        <button
          className="relative p-2 rounded-[var(--radius-button)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-glass-hover)] transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4 stroke-[1.5]" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
        </button>

        {/* User Avatar Menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-[var(--accent-subtle)] transition-all"
          >
            <Avatar
              name={currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'User'}
              src={currentUser?.avatar_url}
              size="sm"
            />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-11 z-50 w-56 glass-dropdown p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">
                    {currentUser?.first_name} {currentUser?.last_name}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] truncate">{currentUser?.email}</p>
                  <div className="flex items-center justify-between text-[10px] mt-1 text-[var(--text-subtle)]">
                    <span className="text-[var(--accent)] font-mono">{currentUser?.employee_code}</span>
                    <span className="font-semibold text-[#590907] uppercase">{currentUser?.role?.replace('_', ' ')}</span>
                  </div>
                  {currentUser?.company_name && (
                    <p className="text-[10px] text-[var(--text-muted)] truncate mt-1 pt-1 border-t border-[var(--border-subtle)]">
                      Org: <strong>{currentUser.brand_name || currentUser.company_name}</strong>
                    </p>
                  )}
                </div>

                {onLogout && (
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-xs text-rose-600 dark:text-rose-400 hover:bg-[var(--surface-hover)] text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
