import React, { useState, useEffect } from 'react';
import type { NavTab } from './components/Sidebar';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { Logo } from './components/brand/Logo';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { DirectoryView } from './views/DirectoryView';
import { AttendanceView } from './views/AttendanceView';
import { LeaveTrackerView } from './views/LeaveTrackerView';
import { ApprovalsView } from './views/ApprovalsView';
import { OrganizationView } from './views/OrganizationView';
import { AnnouncementsView } from './views/AnnouncementsView';
import { SuperAdminPortalView } from './views/SuperAdminPortalView';
import { HRAdminPortalView } from './views/HRAdminPortalView';
import { ManagerPortalView } from './views/ManagerPortalView';
import { PerformanceView } from './views/PerformanceView';
import { LifecycleView } from './views/LifecycleView';
import { HelpdeskView } from './views/HelpdeskView';
import { PayrollView } from './views/PayrollView';
import { FaceCameraModal } from './components/FaceCameraModal';
import { FaceKioskModal } from './components/FaceKioskModal';
import type { User, AttendanceStatus } from './services/api';
import { api } from './services/api';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/ui';

const TAB_TITLES: Record<NavTab, string> = {
  dashboard: 'HR Dashboard',
  superadmin: 'Super Admin Portal',
  hradmin: 'HR Administration Portal',
  manager: 'Manager Workspace',
  directory: 'Employee Directory',
  attendance: 'Attendance & Biometrics',
  leaves: 'Leave Management',
  payroll: 'Payroll & Compensation',
  approvals: 'Approvals Inbox',
  performance: 'Performance & Appraisals',
  lifecycle: 'Employee Lifecycle & Onboarding',
  helpdesk: 'HR Helpdesk & Cases',
  organization: 'Organization Structure',
  announcements: 'Company Announcements'
};

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [isInitializing, setIsInitializing] = useState(true);
  const [globalFaceModalOpen, setGlobalFaceModalOpen] = useState(false);
  const [globalKioskOpen, setGlobalKioskOpen] = useState(false);

  const loadLiveStatus = async () => {
    try {
      const status = await api.getTodayStatus();
      setAttendanceStatus(status);
    } catch (err) {
      console.error('Error fetching today attendance:', err);
    }
  };

  const loadApprovalStats = async () => {
    try {
      const stats = await api.getDashboardStats();
      const count = (stats?.pending_leave_approvals || 0) + (stats?.pending_regularizations || 0);
      setPendingApprovalsCount(count);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  useEffect(() => {
    async function init() {
      setIsInitializing(true);
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const user = await api.getCurrentUser();
          setCurrentUser(user);
          await Promise.all([loadLiveStatus(), loadApprovalStats()]);
        } catch (err) {
          console.warn('Session expired or invalid token:', err);
          localStorage.removeItem('token');
          localStorage.removeItem('currentUser');
          setCurrentUser(null);
        }
      }
      setIsInitializing(false);
    }
    init();

    const handleUnauthorized = () => {
      setCurrentUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="motion-safe:animate-[pulse_1.5s_ease-in-out_infinite]">
            <Logo variant="icon" size={64} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">FlowPeople</h1>
            <p className="text-xs text-slate-400 mt-0.5">by FlowCraft</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <ThemeProvider>
        <ToastProvider>
          <LoginView onLoginSuccess={(u) => {
            setCurrentUser(u);
            loadLiveStatus();
            loadApprovalStats();
          }} />
        </ToastProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="relative flex h-screen font-sans bg-[var(--surface-canvas)] text-[var(--text-main)] overflow-hidden">
          {/* Ambient blurred color blobs */}
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-teal-500/10 dark:bg-teal-500/5 blur-3xl" />
            <div className="absolute top-1/3 -right-32 w-80 h-80 rounded-full bg-slate-400/10 dark:bg-slate-400/5 blur-3xl" />
            <div className="absolute -bottom-32 left-1/4 w-96 h-96 rounded-full bg-teal-600/10 dark:bg-teal-600/5 blur-3xl" />
          </div>

          <div className="relative z-10 flex h-screen w-full overflow-hidden">
            {/* Sidebar Rail */}
            <Sidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              currentUser={currentUser}
              pendingApprovalsCount={pendingApprovalsCount}
              onOpenKiosk={() => setGlobalKioskOpen(true)}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
              <TopHeader
                currentUser={currentUser}
                onLogout={handleLogout}
                attendanceStatus={attendanceStatus}
                onRefreshAttendance={loadLiveStatus}
                activeTabTitle={TAB_TITLES[activeTab] || 'Overview'}
                onOpenFaceModal={() => setGlobalFaceModalOpen(true)}
                onOpenKiosk={() => setGlobalKioskOpen(true)}
              />

              <main className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
                {activeTab === 'dashboard' && (
                  <DashboardView 
                    currentUser={currentUser} 
                    onNavigate={setActiveTab} 
                    attendanceStatus={attendanceStatus}
                    onRefreshStatus={loadLiveStatus}
                  />
                )}
                {activeTab === 'superadmin' && (
                  <SuperAdminPortalView />
                )}
                {activeTab === 'hradmin' && (
                  <HRAdminPortalView />
                )}
                {activeTab === 'manager' && (
                  <ManagerPortalView />
                )}
                {activeTab === 'directory' && (
                  <DirectoryView currentUser={currentUser} />
                )}
                {activeTab === 'attendance' && (
                  <AttendanceView
                    currentUser={currentUser}
                    attendanceStatus={attendanceStatus}
                    onRefreshStatus={loadLiveStatus}
                  />
                )}
                {activeTab === 'leaves' && (
                  <LeaveTrackerView currentUser={currentUser} />
                )}
                {activeTab === 'payroll' && (
                  <PayrollView currentUser={currentUser} />
                )}
                {activeTab === 'approvals' && (
                  <ApprovalsView currentUser={currentUser} onRefreshStats={loadApprovalStats} />
                )}
                {activeTab === 'performance' && (
                  <PerformanceView />
                )}
                {activeTab === 'lifecycle' && (
                  <LifecycleView currentUser={currentUser} />
                )}
                {activeTab === 'helpdesk' && (
                  <HelpdeskView currentUser={currentUser} />
                )}
                {activeTab === 'organization' && (
                  <OrganizationView currentUser={currentUser} />
                )}
                {activeTab === 'announcements' && (
                  <AnnouncementsView currentUser={currentUser} />
                )}
              </main>
            </div>
          </div>

          <FaceCameraModal
            isOpen={globalFaceModalOpen}
            onClose={() => setGlobalFaceModalOpen(false)}
            mode={attendanceStatus?.is_checked_in ? 'PUNCH_OUT' : 'PUNCH_IN'}
            onSuccess={() => {
              loadLiveStatus();
            }}
          />

          <FaceKioskModal
            isOpen={globalKioskOpen}
            onClose={() => setGlobalKioskOpen(false)}
            onPunchRecorded={loadLiveStatus}
          />
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
