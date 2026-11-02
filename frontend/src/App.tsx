import React, { useState, useEffect } from 'react';
import type { NavTab } from './components/Sidebar';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { Logo } from './components/brand/Logo';
import { LoginView } from './views/LoginView';
import { FlowPeopleAuthView, AuthMode } from './views/FlowPeopleAuthView';
import { LandingPageView } from './views/LandingPageView';
import { RegisterOrganizationView } from './views/RegisterOrganizationView';
import { AttendanceKioskView } from './views/AttendanceKioskView';
import { DashboardView } from './views/DashboardView';
import { DirectoryView } from './views/DirectoryView';
import { AttendanceView } from './views/AttendanceView';
import { LeaveTrackerView } from './views/LeaveTrackerView';
import { ApprovalsView } from './views/ApprovalsView';
import { OrganizationView } from './views/OrganizationView';
import { AnnouncementsView } from './views/AnnouncementsView';
import { SuperAdminPortalView } from './views/SuperAdminPortalView';
import { SuperAdminGatekeeperView } from './views/SuperAdminGatekeeperView';
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
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';

const TAB_TITLES: Record<NavTab, string> = {
  dashboard: 'HR Dashboard',
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
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname || '/');
  const [selectedPlanForRegister, setSelectedPlanForRegister] = useState<string>('trial');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [isInitializing, setIsInitializing] = useState(true);
  const [globalFaceModalOpen, setGlobalFaceModalOpen] = useState(false);
  const [globalKioskOpen, setGlobalKioskOpen] = useState(false);

  // Synchronize browser history and path
  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
    navigateTo('/');
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

  // 1. DEDICATED ROUTE: /attendance/kiosk
  if (currentPath === '/attendance/kiosk') {
    return (
      <ThemeProvider>
        <ToastProvider>
          <AttendanceKioskView
            currentUser={currentUser}
            onExit={() => navigateTo(currentUser ? '/app' : '/')}
          />
        </ToastProvider>
      </ThemeProvider>
    );
  }

  // 2. DEDICATED ROUTE: /superadmin (Platform Owner Only)
  if (currentPath === '/superadmin') {
    if (!currentUser) {
      return (
        <ThemeProvider>
          <ToastProvider>
            <SuperAdminGatekeeperView
              onSuccess={(user) => {
                setCurrentUser(user);
                loadLiveStatus();
                loadApprovalStats();
              }}
              onNavigateHome={() => navigateTo('/')}
            />
          </ToastProvider>
        </ThemeProvider>
      );
    }

    // Authenticated: check if platform owner
    const isPlatformOwner = Boolean(
      currentUser.is_platform_owner ||
      currentUser.email?.toLowerCase() === 'pimpaleg80@gmail.com' ||
      currentUser.email?.toLowerCase() === 'pimpaleharshad99@gmail.com' ||
      currentUser.email?.toLowerCase() === 'admin@flowcraft.io' ||
      currentUser.role === 'PLATFORM_OWNER'
    );

    if (!isPlatformOwner) {
      return (
        <ThemeProvider>
          <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
            <div className="p-4 rounded-3xl bg-rose-50 border border-rose-200 text-rose-600 mb-4 shadow-sm">
              <ShieldAlert className="w-12 h-12" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">403 Forbidden: Access Restricted</h1>
            <p className="text-xs text-slate-600 max-w-md mt-2 leading-relaxed">
              You are currently signed in as <strong className="text-slate-900">{currentUser.email}</strong> with role <strong className="text-slate-900">{currentUser.role}</strong>. The Super Admin Console is strictly restricted to the platform owner.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => navigateTo('/app')}
                className="px-5 py-2.5 rounded-xl bg-[#590907] hover:bg-[#450605] text-[#FAF6F0] font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Organization Workspace</span>
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2.5 rounded-xl border border-[#DFE1D8] hover:bg-[#ECEEE7] text-xs font-semibold text-[#590907] transition cursor-pointer"
              >
                Sign In With Different Account
              </button>
            </div>
          </div>
        </ThemeProvider>
      );
    }

    // Authorized Platform Owner: Render Super Admin Console
    return (
      <ThemeProvider>
        <ToastProvider>
          <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <header className="px-6 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <Logo variant="icon" size={30} colorMode="light" />
                <div>
                  <span className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    FlowPeople Super Admin Console
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 border border-amber-500/30">
                      ROOT OWNER
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-500 block -mt-0.5">Platform Fleet & SaaS Management</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigateTo('/app')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs text-slate-700 font-medium cursor-pointer"
                >
                  Customer Workspace View
                </button>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </header>

            <main className="p-6">
              <SuperAdminPortalView />
            </main>
          </div>
        </ToastProvider>
      </ThemeProvider>
    );
  }

  // 3. UNAUTHENTICATED PUBLIC WORKFLOWS
  if (!currentUser) {
    if (
      currentPath === '/login' ||
      currentPath === '/signup' ||
      currentPath === '/register' ||
      currentPath === '/forgot-password' ||
      currentPath === '/reset-password' ||
      currentPath === '/verify-email'
    ) {
      const authMode: AuthMode = (
        currentPath === '/signup' || currentPath === '/register'
          ? 'signup'
          : currentPath === '/forgot-password'
          ? 'forgot'
          : currentPath === '/reset-password'
          ? 'reset'
          : currentPath === '/verify-email'
          ? 'verify'
          : 'login'
      );

      return (
        <ThemeProvider>
          <ToastProvider>
            <FlowPeopleAuthView
              initialMode={authMode}
              onSuccess={(user) => {
                setCurrentUser(user);
                navigateTo(user.is_platform_owner ? '/superadmin' : '/app');
                loadLiveStatus();
                loadApprovalStats();
              }}
              onNavigateHome={() => navigateTo('/')}
              onNavigateMode={(m) => {
                const targetPath = (
                  m === 'login'
                    ? '/login'
                    : m === 'signup'
                    ? '/signup'
                    : m === 'forgot'
                    ? '/forgot-password'
                    : m === 'reset'
                    ? '/reset-password'
                    : '/verify-email'
                );
                navigateTo(targetPath);
              }}
            />
          </ToastProvider>
        </ThemeProvider>
      );
    }

    // Default: Public SaaS Landing Page
    return (
      <ThemeProvider>
        <ToastProvider>
          <LandingPageView
            onNavigateLogin={() => navigateTo('/login')}
            onNavigateRegister={(planId) => {
              if (planId) setSelectedPlanForRegister(planId);
              navigateTo('/register');
            }}
            onNavigateKiosk={() => navigateTo('/attendance/kiosk')}
          />
        </ToastProvider>
      </ThemeProvider>
    );
  }

  // 4. AUTHENTICATED CUSTOMER WORKSPACE
  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="relative flex h-screen font-sans bg-[var(--surface-canvas)] text-[var(--text-main)] overflow-hidden">
          {/* Ambient warm editorial color blobs */}
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#E8D2B5]/25 blur-3xl" />
            <div className="absolute top-1/3 -right-32 w-80 h-80 rounded-full bg-[#A5A79B]/15 blur-3xl" />
            <div className="absolute -bottom-32 left-1/4 w-96 h-96 rounded-full bg-[#590907]/5 blur-3xl" />
          </div>

          <div className="relative z-10 flex h-screen w-full overflow-hidden">
            {/* Customer Organization Sidebar Rail (Super Admin Purged) */}
            <Sidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              currentUser={currentUser}
              pendingApprovalsCount={pendingApprovalsCount}
              onOpenKiosk={() => navigateTo('/attendance/kiosk')}
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
                onOpenKiosk={() => navigateTo('/attendance/kiosk')}
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
                {activeTab === 'hradmin' && (
                  <HRAdminPortalView currentUser={currentUser} />
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
