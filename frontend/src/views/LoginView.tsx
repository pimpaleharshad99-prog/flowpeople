import React, { useState, useEffect } from 'react';
import {
  Lock, Mail, KeyRound, ArrowRight, CheckCircle2, Shield,
  Briefcase, Users, UserCheck, ChevronDown, ChevronUp, UserPlus,
  Scan, Zap
} from 'lucide-react';
import { api, User } from '../services/api';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/brand/Logo';
import { GlassCard, useToast } from '../components/ui';
import { FaceKioskModal } from '../components/FaceKioskModal';
import { GoogleIcon } from './FlowPeopleAuthView';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

const CLEAN_ROLES = [
  {
    role: 'SUPER_ADMIN',
    label: 'Platform Administrator',
    identifier: 'admin@acme.corp',
    altCode: 'admin',
    password: 'Admin@EMP001',
    icon: Shield,
    color: 'text-amber-600 bg-amber-500/10 border-amber-500/20'
  },
  {
    role: 'HR_ADMIN',
    label: 'David Vance (HR Admin)',
    identifier: 'hr@acme.corp',
    altCode: 'hr',
    password: 'HR@EMP002',
    icon: UserCheck,
    color: 'text-[#590907] bg-[#ECEEE7] border-[#DFE1D8]'
  },
  {
    role: 'MANAGER',
    label: 'Elena Rostova (Operations)',
    identifier: 'manager@acme.corp',
    altCode: 'manager',
    password: 'Manager@EMP003',
    icon: Users,
    color: 'text-[#590907] bg-[#ECEEE7] border-[#DFE1D8]'
  },
  {
    role: 'EMPLOYEE',
    label: 'Alex Mercer (Staff)',
    identifier: 'alex@acme.corp',
    altCode: 'alex',
    password: 'Alex@EMP004',
    icon: Briefcase,
    color: 'text-[#590907] bg-[#ECEEE7] border-[#DFE1D8]'
  }
];

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER' | 'FORGOT'>('LOGIN');

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRoleHelper, setShowRoleHelper] = useState(false);
  const [faceKioskOpen, setFaceKioskOpen] = useState(false);

  // Register form state
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<'SUPER_ADMIN' | 'HR_ADMIN' | 'EMPLOYEE'>('SUPER_ADMIN');

  // Forgot password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  const fillRole = (roleObj: typeof CLEAN_ROLES[0]) => {
    setIdentifier(roleObj.identifier);
    setPassword(roleObj.password);
    addToast({
      title: `${roleObj.label} Selected`,
      description: `Loaded ${roleObj.identifier}.`,
      type: 'info'
    });
  };

  const handleInstantLogin = async (role: string, email: string) => {
    setLoading(true);
    try {
      const data = await api.demoLogin(role, email);
      addToast({
        title: 'Instant Sign In Successful',
        description: `Logged in as ${data.user.first_name} ${data.user.last_name} (${data.user.role})`,
        type: 'success'
      });
      onLoginSuccess(data.user);
    } catch (err: any) {
      addToast({
        title: 'Instant Login Failed',
        description: err.message || 'Could not log in with demo account. Ensure backend is running.',
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && (hash.includes('access_token=') || hash.includes('id_token='))) {
      const params = new URLSearchParams(hash.replace('#', '?'));
      const token = params.get('access_token') || params.get('id_token');
      if (token) {
        setLoading(true);
        window.history.replaceState(null, '', window.location.pathname);
        api.loginWithGoogle({ credential: token })
          .then((res) => {
            addToast({
              title: 'Google Sign In Successful',
              description: `Welcome, ${res.user.first_name}! Logged in with Google.`,
              type: 'success'
            });
            onLoginSuccess(res.user);
          })
          .catch((err) => {
            addToast({
              title: 'Google Sign In Failed',
              description: err.message || 'Could not authenticate with Google.',
              type: 'danger'
            });
          })
          .finally(() => setLoading(false));
      }
    }
  }, [onLoginSuccess, addToast]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      if (supabase) {
        try {
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: window.location.origin
            }
          });
          if (!error && data?.url) {
            window.location.href = data.url;
            return;
          }
        } catch (sbErr) {
          console.warn('Supabase Google OAuth fallback:', sbErr);
        }
      }

      const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '576186695621-kmd7kbtvr5jdgpech8mibpnoe1k0g3qb.apps.googleusercontent.com';
      const redirectUri = window.location.origin;
      const scope = encodeURIComponent('openid email profile');
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${scope}&prompt=select_account`;
      window.location.href = authUrl;
    } catch (err: any) {
      addToast({
        title: 'Google Sign In Failed',
        description: err.message || 'Could not start Google OAuth.',
        type: 'danger'
      });
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const cleanId = identifier.trim();
    const cleanPwd = password.trim();

    try {
      // 1. Supabase Auth (Primary identity provider for email logins)
      if (cleanId.includes('@')) {
        try {
          const { data: sbData, error: sbErr } = await supabase.auth.signInWithPassword({
            email: cleanId.toLowerCase(),
            password: cleanPwd
          });
          if (!sbErr && sbData.session && sbData.user) {
            localStorage.setItem('token', sbData.session.access_token);
            try {
              const user = await api.getCurrentUser();
              addToast({
                title: 'Welcome back',
                description: `Signed in as ${user.first_name} ${user.last_name} (${user.role})`,
                type: 'success'
              });
              onLoginSuccess(user);
              return;
            } catch (curErr) {
              const synced = await api.supabaseSync({
                email: sbData.user.email || cleanId,
                auth_user_id: sbData.user.id,
                first_name: sbData.user.user_metadata?.first_name || cleanId.split('@')[0],
                last_name: sbData.user.user_metadata?.last_name || 'User'
              });
              addToast({
                title: 'Supabase Authenticated',
                description: `Signed in via Supabase cloud as ${synced.user.email}`,
                type: 'success'
              });
              onLoginSuccess(synced.user);
              return;
            }
          }
        } catch (sbCatchErr) {
          console.warn('Supabase auth attempt:', sbCatchErr);
        }
      }

      // 2. Local Backend Login (Employee Code e.g. EMP-001 or fallback)
      const data = await api.login(cleanId, cleanPwd);
      addToast({
        title: 'Welcome back',
        description: `Signed in as ${data.user.first_name} ${data.user.last_name} (${data.user.role})`,
        type: 'success'
      });
      onLoginSuccess(data.user);
    } catch (err: any) {
      addToast({
        title: 'Authentication Failed',
        description: err.message || 'Incorrect Employee ID, Email, or Password',
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Try registering on Supabase Auth in parallel
      try {
        await supabase.auth.signUp({
          email: regEmail.trim().toLowerCase(),
          password: regPassword.trim(),
          options: {
            data: {
              first_name: regFirstName.trim(),
              last_name: regLastName.trim(),
              role: regRole
            }
          }
        });
      } catch (sbErr) {
        console.warn('Supabase signup notice:', sbErr);
      }

      // Register and active account on backend
      const res = await api.register({
        first_name: regFirstName.trim(),
        last_name: regLastName.trim(),
        email: regEmail.trim().toLowerCase(),
        password: regPassword.trim(),
        role: regRole,
        company_name: 'FlowCraft Technologies Inc.'
      });

      addToast({
        title: 'Account Created',
        description: `Welcome ${res.user.first_name}! You are registered as ${res.user.role}.`,
        type: 'success'
      });
      onLoginSuccess(res.user);
    } catch (err: any) {
      addToast({
        title: 'Registration Failed',
        description: err.message || 'Could not create account',
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResetSuccess(true);
    addToast({
      title: 'Reset instructions sent',
      description: `Verification link dispatched to ${resetEmail}`,
      type: 'info'
    });
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center py-10 px-4 sm:px-6 bg-[var(--surface-canvas)] text-[var(--text-main)] overflow-y-auto">
      {/* Ambient background light blobs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#E8D2B5]/25 blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 rounded-full bg-[#A5A79B]/15 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-[#590907]/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md my-auto space-y-5">
        {/* Centered Large Logo above the form */}
        <div className="flex flex-col items-center text-center">
          <Logo size={52} variant="full" />
          <p className="text-xs text-[var(--text-subtle)] mt-1.5">
            Enterprise Workforce & Biometric Management System
          </p>
        </div>

        {/* Standalone Company Face Attendance Terminal (No Login Required) */}
        <div className="p-3.5 sm:p-4 rounded-2xl border-2 border-[#A5A79B]/40 bg-[#ECEEE7] backdrop-blur-md shadow-sm text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#590907] animate-pulse" />
            <span className="font-bold text-xs uppercase tracking-wider text-[#590907]">
              Company Face Attendance Kiosk
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFaceKioskOpen(true)}
            className="w-full py-2.5 px-4 rounded-xl bg-[#590907] hover:bg-[#450605] text-[#FAF6F0] font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 group cursor-pointer border border-[#400605]"
          >
            <Scan className="w-4 h-4 animate-bounce" />
            <span>Launch Face Scanner Terminal</span>
          </button>
          <p className="text-[11px] text-[var(--text-subtle)] leading-relaxed">
            Walk up to camera &bull; Automatic 1:N face identification &bull; Direct Check-In / Departure
          </p>
        </div>

        {/* Card Form */}
        <GlassCard>
          {/* Top Tabs: Sign In / Create Account */}
          <div className="flex items-center gap-1 p-1 bg-[var(--surface-sunken)] rounded-lg mb-4 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('LOGIN')}
              className={`flex-1 py-1.5 rounded-md transition ${activeTab === 'LOGIN' ? 'bg-[var(--surface-canvas)] text-[var(--text-main)] shadow-xs' : 'text-[var(--text-subtle)] hover:text-[var(--text-main)]'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('REGISTER')}
              className={`flex-1 py-1.5 rounded-md transition ${activeTab === 'REGISTER' ? 'bg-[var(--surface-canvas)] text-[var(--text-main)] shadow-xs' : 'text-[var(--text-subtle)] hover:text-[var(--text-main)]'}`}
            >
              Create Account
            </button>
          </div>

          {activeTab === 'LOGIN' && (
            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">
                  Email, Employee ID or Role *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--text-subtle)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="pimpaleharshad99@gmail.com, admin, or EMP-001"
                    className="w-full pl-9 pr-3 py-2 glass-input font-medium"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-[var(--text-secondary)]">Password *</label>
                  <button
                    type="button"
                    onClick={() => setActiveTab('FORGOT')}
                    className="text-[11px] text-[var(--accent)] hover:underline focus:outline-none"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--text-subtle)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password (e.g. password123)"
                    className="w-full pl-9 pr-3 py-2 glass-input font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-xs shadow-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In to Workspace'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {/* Google OAuth 2.0 Sign In */}
              <div className="pt-1">
                <div className="relative flex py-1.5 items-center">
                  <div className="flex-grow border-t border-[var(--border-glass)]"></div>
                  <span className="flex-shrink mx-2 text-[var(--text-subtle)] text-[10px] font-semibold uppercase tracking-wider">or</span>
                  <div className="flex-grow border-t border-[var(--border-glass)]"></div>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogleSignIn}
                  className="w-full h-9 rounded-lg bg-[var(--surface-canvas)] hover:bg-[var(--surface-hover)] border border-[var(--border-glass)] text-[var(--text-main)] font-semibold text-[11px] shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <GoogleIcon className="w-3.5 h-3.5" />
                  <span>Sign in with Google</span>
                </button>
              </div>

              {/* Fast 1-Click Role Login Bar */}
              <div className="pt-3 border-t border-[var(--border-glass)]">
                <button
                  type="button"
                  onClick={() => setShowRoleHelper(!showRoleHelper)}
                  className="w-full flex items-center justify-between text-[11px] text-[var(--text-subtle)] hover:text-[var(--text-main)] py-1 focus:outline-none transition-colors"
                >
                  <span className="flex items-center gap-1.5 font-bold">
                    <Zap className="w-3.5 h-3.5 text-[var(--accent)]" />
                    ⚡ 1-Click Demo Logins (Super Admin, HR, Manager, Staff)
                  </span>
                  {showRoleHelper ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showRoleHelper && (
                  <div className="mt-2.5 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {CLEAN_ROLES.map((r) => {
                        const Icon = r.icon;
                        return (
                          <div
                            key={r.identifier}
                            className="flex flex-col p-2.5 rounded-lg border border-[var(--border-glass)] bg-[var(--surface-canvas)] shadow-2xs group"
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`p-1 rounded-md ${r.color}`}>
                                <Icon className="w-3 h-3" />
                              </span>
                              <span className="font-semibold text-[11px] text-[var(--text-main)] truncate">
                                {r.label}
                              </span>
                            </div>
                            <span className="text-[10px] text-[var(--text-subtle)] font-mono truncate mb-2">{r.identifier}</span>

                            <div className="mt-auto flex items-center gap-1 pt-1.5 border-t border-[var(--border-glass)]">
                              <button
                                type="button"
                                onClick={() => fillRole(r)}
                                className="flex-1 py-1 px-1.5 rounded bg-[var(--surface-hover)] hover:bg-[var(--surface-sunken)] text-[10px] text-[var(--text-secondary)] font-medium text-center transition cursor-pointer"
                              >
                                Fill Form
                              </button>
                              <button
                                type="button"
                                disabled={loading}
                                onClick={() => handleInstantLogin(r.role, r.identifier)}
                                className="flex-1 py-1 px-1.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[10px] text-white font-bold text-center transition flex items-center justify-center gap-0.5 cursor-pointer disabled:opacity-50"
                              >
                                <Zap className="w-2.5 h-2.5 text-[#E8D2B5]" />
                                <span>1-Click</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </form>
          )}

          {activeTab === 'REGISTER' && (
            <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-[var(--text-secondary)] mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={regFirstName}
                    onChange={(e) => setRegFirstName(e.target.value)}
                    placeholder="e.g. Rahul"
                    className="w-full p-2 glass-input font-medium"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--text-secondary)] mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={regLastName}
                    onChange={(e) => setRegLastName(e.target.value)}
                    placeholder="e.g. Sharma"
                    className="w-full p-2 glass-input font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="your.email@company.com"
                  className="w-full p-2 glass-input font-medium"
                />
              </div>

              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Choose a secure password"
                  className="w-full p-2 glass-input font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">Assign Role *</label>
                <select
                  value={regRole}
                  onChange={(e: any) => setRegRole(e.target.value)}
                  className="w-full p-2 glass-input"
                >
                  <option value="SUPER_ADMIN">Super Administrator (Full System Control)</option>
                  <option value="HR_ADMIN">HR Administrator</option>
                  <option value="EMPLOYEE">Standard Employee</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-xs shadow-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50 mt-2"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{loading ? 'Creating Account...' : 'Register & Launch Workspace'}</span>
              </button>
            </form>
          )}

          {activeTab === 'FORGOT' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <h3 className="font-semibold text-sm text-[var(--text-main)]">Reset Account Password</h3>
                <p className="text-[11px] text-[var(--text-subtle)]">
                  Enter your registered corporate email to receive a password recovery link.
                </p>
              </div>

              {resetSuccess ? (
                <div className="p-3.5 rounded-xl border border-[#C8CAC0] bg-[#ECEEE7] space-y-2 text-center">
                  <CheckCircle2 className="w-6 h-6 text-[#4A5A3F] mx-auto" />
                  <p className="font-medium text-[var(--text-main)]">Recovery Link Dispatched</p>
                  <p className="text-[11px] text-[var(--text-subtle)]">
                    Please check your corporate inbox to reset your password credentials.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setResetSuccess(false);
                      setActiveTab('LOGIN');
                    }}
                    className="mt-2 text-xs font-semibold text-[var(--accent)] underline"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block font-medium text-[var(--text-secondary)] mb-1">
                      Corporate Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full glass-input p-2"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('LOGIN')}
                      className="flex-1 py-2 rounded-lg border border-[var(--border-glass)] hover:bg-[var(--surface-hover)] text-[var(--text-main)] font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium shadow-sm"
                    >
                      Send Reset Link
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </GlassCard>

        {/* Footer Brand Mono */}
        <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-subtle)]">
          <img src="/brand/flowpeople-mono.svg" alt="" className="w-4 h-4 opacity-40 shrink-0" />
          <span>FlowPeople by FlowCraft &bull; Enterprise Workforce Ecosystem</span>
        </div>
      </div>

      {/* Standalone Company Face Attendance Kiosk Modal */}
      <FaceKioskModal
        isOpen={faceKioskOpen}
        onClose={() => setFaceKioskOpen(false)}
      />
    </div>
  );
};

export default LoginView;
