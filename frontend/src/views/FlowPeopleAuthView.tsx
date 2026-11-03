import React, { useState, useEffect } from 'react';
import { 
  Check, 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  KeyRound, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft, 
  ShieldCheck, 
  Users, 
  UserCheck, 
  Briefcase, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  Zap
} from 'lucide-react';
import { Logo } from '../components/brand/Logo';
import { api, User } from '../services/api';
import { supabase } from '../lib/supabase';
import { 
  registerCompanyWithSupabase, 
  generateCompanySlug, 
  generateRegistrationKey, 
  formatSupabaseError 
} from '../services/organizationService';

export type AuthMode = 'login' | 'signup' | 'forgot' | 'reset' | 'verify';

interface FlowPeopleAuthViewProps {
  initialMode?: AuthMode;
  onSuccess: (user: User) => void;
  onNavigateHome: () => void;
  onNavigateMode: (mode: AuthMode) => void;
}

export const FlowPeopleAuthView: React.FC<FlowPeopleAuthViewProps> = ({
  initialMode = 'login',
  onSuccess,
  onNavigateHome,
  onNavigateMode
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // General state
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'error' | 'success' | 'warn'; message: string } | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showDemoRoles, setShowDemoRoles] = useState(false);

  // Signup form state
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [signupRequestKey, setSignupRequestKey] = useState<string>(() => generateRegistrationKey());

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // Reset password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Verify email state
  const [verifyStatus, setVerifyStatus] = useState<'working' | 'ok' | 'fail' | 'pending'>('pending');
  const [resendEmail, setResendEmail] = useState('');
  const [resendSent, setResendSent] = useState(false);

  // Password validation & strength calculation
  const getPasswordStrength = (pwd: string) => {
    const rules = {
      len: pwd.length >= 10,
      upper: /[A-Z]/.test(pwd),
      lower: /[a-z]/.test(pwd),
      digit: /[0-9]/.test(pwd)
    };
    const score = Object.values(rules).filter(Boolean).length;
    return { rules, score };
  };

  const signupStrength = getPasswordStrength(signupPassword);
  const resetStrength = getPasswordStrength(newPassword);

  // Quick Demo Accounts (1-Click & Form Fill)
  const demoAccounts = [
    {
      role: 'Super Admin (Platform Owner)',
      apiRole: 'SUPER_ADMIN',
      name: 'Sarah Connor',
      email: 'admin@acme.corp',
      password: 'Admin@EMP001',
      icon: ShieldCheck,
      color: 'text-amber-800 bg-amber-100/60 border-amber-300'
    },
    {
      role: 'HR Administrator',
      apiRole: 'HR_ADMIN',
      name: 'David Vance',
      email: 'hr@acme.corp',
      password: 'HR@EMP002',
      icon: UserCheck,
      color: 'text-[#590907] bg-[#ECEEE7] border-[#DFE1D8]'
    },
    {
      role: 'Operations Manager',
      apiRole: 'MANAGER',
      name: 'Elena Rostova',
      email: 'manager@acme.corp',
      password: 'Manager@EMP003',
      icon: Users,
      color: 'text-[#590907] bg-[#ECEEE7] border-[#DFE1D8]'
    },
    {
      role: 'Staff Employee',
      apiRole: 'EMPLOYEE',
      name: 'Alex Mercer',
      email: 'alex@acme.corp',
      password: 'Alex@EMP004',
      icon: Briefcase,
      color: 'text-[#590907] bg-[#ECEEE7] border-[#DFE1D8]'
    }
  ];

  const handleFillDemo = (acc: typeof demoAccounts[0]) => {
    setLoginEmail(acc.email);
    setLoginPassword(acc.password);
    setAlert({
      type: 'success',
      message: `Selected ${acc.name} (${acc.role}). Click Sign in below or use 1-Click login.`
    });
  };

  const handleInstantDemoLogin = async (apiRole: string, email: string) => {
    setLoading(true);
    setAlert(null);
    try {
      const res = await api.demoLogin(apiRole, email);
      setAlert({
        type: 'success',
        message: `Authenticated as ${res.user.first_name} ${res.user.last_name} (${res.user.role}). Redirecting...`
      });
      onSuccess(res.user);
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: err.message || 'Demo login failed. Please ensure the backend server is running.'
      });
    } finally {
      setLoading(false);
    }
  };

  // 1. LOGIN SUBMIT
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);

    const cleanEmail = loginEmail.trim();
    const cleanPwd = loginPassword.trim();

    if (!cleanEmail) {
      setAlert({ type: 'error', message: 'Please enter your work email or employee code.' });
      return;
    }
    if (!cleanPwd) {
      setAlert({ type: 'error', message: 'Please enter your account password.' });
      return;
    }

    setLoading(true);
    try {
      // 1. If email identifier, authenticate against Supabase Auth as authoritative IDP
      if (cleanEmail.includes('@')) {
        try {
          const { data: sbData, error: sbErr } = await supabase.auth.signInWithPassword({
            email: cleanEmail.toLowerCase(),
            password: cleanPwd
          });

          if (!sbErr && sbData.session && sbData.user) {
            localStorage.setItem('token', sbData.session.access_token);
            try {
              const user = await api.getCurrentUser();
              onSuccess(user);
              return;
            } catch (syncErr) {
              const synced = await api.supabaseSync({
                email: sbData.user.email || cleanEmail,
                auth_user_id: sbData.user.id,
                first_name: sbData.user.user_metadata?.first_name || cleanEmail.split('@')[0],
                last_name: sbData.user.user_metadata?.last_name || 'User'
              });
              onSuccess(synced.user);
              return;
            }
          }
        } catch (sbEx) {
          console.warn('Supabase authentication notice:', sbEx);
        }
      }

      // 2. Authenticate against local backend (employee code or local credentials)
      const res = await api.login(cleanEmail, cleanPwd);
      onSuccess(res.user);
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: err.message || 'Incorrect email, employee code, or password. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  // 2. SIGNUP SUBMIT
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);

    if (!fullName.trim()) {
      setAlert({ type: 'error', message: 'Please enter your full name.' });
      return;
    }
    if (!orgName.trim()) {
      setAlert({ type: 'error', message: 'Please enter your organization name.' });
      return;
    }
    if (!signupEmail.trim() || !signupEmail.includes('@')) {
      setAlert({ type: 'error', message: 'Please provide a valid company work email.' });
      return;
    }
    if (signupStrength.score < 3) {
      setAlert({ type: 'error', message: 'Please choose a stronger password meeting the security criteria.' });
      return;
    }
    if (signupPassword !== confirmPassword) {
      setAlert({ type: 'error', message: 'Passwords do not match.' });
      return;
    }
    if (!acceptedTerms) {
      setAlert({ type: 'error', message: 'Please agree to the Terms of Service & Privacy Policy to continue.' });
      return;
    }

    setLoading(true);
    try {
      const names = fullName.trim().split(' ');
      const firstName = names[0] || 'Admin';
      const lastName = names.slice(1).join(' ') || 'Owner';
      const compCode = orgName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase() || 'ORG';
      const targetSlug = generateCompanySlug(orgName);

      // 1. Establish or verify authenticated Supabase session
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        const cleanEmail = signupEmail.trim().toLowerCase();
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password: signupPassword.trim(),
          options: {
            data: {
              first_name: firstName,
              last_name: lastName
            }
          }
        });

        if (signUpErr) {
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: signupPassword.trim()
          });

          if (signInErr) {
            throw new Error(formatSupabaseError(signUpErr || signInErr));
          }
          session = signInData.session;
        } else {
          session = signUpData.session;
        }
      }

      // 2. Invoke public.register_company RPC with exact parameters: (p_name, p_slug, p_request_key, p_legal_name)
      // Note: Reuses signupRequestKey when retrying the same attempt
      const rpcResult = await registerCompanyWithSupabase({
        name: orgName.trim(),
        slug: targetSlug,
        requestKey: signupRequestKey,
        legalName: orgName.trim()
      });

      // 3. Complete backend local sync & issue session token
      const res = await api.registerOrganization({
        company_name: orgName.trim(),
        company_code: compCode,
        contact_email: signupEmail.trim().toLowerCase(),
        owner_first_name: firstName,
        owner_last_name: lastName,
        owner_password: signupPassword.trim(),
        owner_phone: phone.trim() || undefined,
        plan_id: 'trial',
        billing_cycle: 'MONTHLY',
        supabase_company_id: rpcResult.organization?.id,
        supabase_slug: targetSlug,
        supabase_request_key: signupRequestKey
      });

      onSuccess(res.user);
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: formatSupabaseError(err)
      });
    } finally {
      setLoading(false);
    }
  };

  // 3. FORGOT PASSWORD SUBMIT
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);

    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      setAlert({ type: 'error', message: 'Please enter a valid work email address.' });
      return;
    }

    setLoading(true);
    try {
      try {
        await supabase.auth.resetPasswordForEmail(forgotEmail.trim());
      } catch (e) {
        // Fallback to backend reset dispatch
      }
      await api.forgotPassword(forgotEmail.trim());
      setForgotSent(true);
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: err.message || 'Failed to dispatch reset email. Please try again later.'
      });
    } finally {
      setLoading(false);
    }
  };

  // 4. RESET PASSWORD SUBMIT
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);

    if (resetStrength.score < 3) {
      setAlert({ type: 'error', message: 'Please provide a password meeting complexity standards.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setAlert({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword('sample-token', newPassword);
      setResetSuccess(true);
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: err.message || 'This reset link is invalid or expired. Request a new one.'
      });
    } finally {
      setLoading(false);
    }
  };

  // 5. RESEND VERIFICATION
  const handleResendVerification = async () => {
    const targetEmail = resendEmail.trim() || signupEmail.trim();
    if (!targetEmail) {
      setAlert({ type: 'error', message: 'Please enter your email to receive verification.' });
      return;
    }
    setLoading(true);
    try {
      await api.resendVerification(targetEmail);
      setResendSent(true);
      setAlert({ type: 'success', message: `Verification email dispatched to ${targetEmail}.` });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Unable to dispatch verification email.' });
    } finally {
      setLoading(false);
    }
  };

  // SIDEBAR COPY BY MODE
  const getSideContent = () => {
    switch (mode) {
      case 'signup':
        return {
          title: 'Start your free trial in minutes.',
          lead: 'Create your organization, invite your team, and track your first shift today.',
          points: [
            '14-day free trial, no credit card needed',
            'Instant face and fingerprint scanner kiosk access',
            'Full HRMS: leaves, shifts, timesheets & payroll',
            'DPDP & biometric data encrypted and private'
          ]
        };
      case 'forgot':
        return {
          title: 'Locked out? It happens.',
          lead: 'We will dispatch a secure link to your work email to reset your password.',
          points: [
            'Fast and cryptographically secured link',
            'Direct token authentication for your organization',
            'Protecting your company data and audit trails'
          ]
        };
      case 'reset':
        return {
          title: 'Choose a new password.',
          lead: 'Pick a strong password that you do not use anywhere else.',
          points: [
            'Enforces enterprise password standards',
            'Syncs across all web portals and kiosk access'
          ]
        };
      case 'verify':
        return {
          title: 'One quick step to protect your account.',
          lead: 'Verifying your email proves it is really you and keeps your organization safe.',
          points: [
            'Authenticates tenant ownership',
            'Activates all multi-tenant capabilities immediately'
          ]
        };
      case 'login':
      default:
        return {
          title: 'Welcome back to People Management. Simplified.',
          lead: 'Sign in to manage attendance, leaves, shifts, and payroll in one place.',
          points: [
            'Face and fingerprint attendance in real time',
            'Automated payroll reading verified attendance & leave',
            'Role-based access for owners, HR, managers & staff'
          ]
        };
    }
  };

  const side = getSideContent();

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-slate-900 flex flex-col lg:grid lg:grid-cols-[minmax(400px,5fr)_7fr] font-sans selection:bg-[#ECEEE7]0 selection:text-white">
      
      {/* LEFT BRANDING SIDEBAR */}
      <aside className="relative overflow-hidden p-8 sm:p-14 flex flex-col justify-between bg-[#590907] text-white border-b lg:border-b-0 lg:border-r border-[#400605]">
        {/* Radiant Ambient Glows */}
        <div className="pointer-events-none absolute -right-28 -top-28 w-96 h-96 rounded-full bg-[#E8D2B5]/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-[#A5A79B]/15 blur-3xl" />
        
        {/* Top Logo */}
        <div className="relative z-10 flex items-center justify-between">
          <button 
            onClick={onNavigateHome}
            className="cursor-pointer hover:opacity-90 transition-opacity"
            title="Return to FlowPeople Home"
          >
            <Logo variant="full" size={38} colorMode="dark" />
          </button>
          
          <button
            onClick={onNavigateHome}
            className="lg:hidden text-xs font-semibold text-[#E8D2B5] hover:text-[#FAF6F0] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#400605] border border-[#A5A79B]/40 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Home</span>
          </button>
        </div>

        {/* Center Copy */}
        <div className="relative z-10 my-10 lg:my-auto max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#400605] border border-[#A5A79B]/30 text-[#E8D2B5] text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Enterprise HR & Biometrics</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
            {side.title}
          </h2>

          <p className="text-[#FAF6F0]/90 text-base sm:text-lg leading-relaxed font-normal">
            {side.lead}
          </p>

          <ul className="space-y-3.5 pt-2">
            {side.points.map((pt, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm sm:text-base text-[#FAF6F0] font-medium">
                <div className="w-5 h-5 rounded-full bg-[#E8D2B5]/20 border border-[#A5A79B]/40 flex items-center justify-center shrink-0 mt-0.5 text-[#E8D2B5]">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom Tagline */}
        <div className="relative z-10 pt-6 border-t border-[#A5A79B]/30 text-xs text-[#E8D2B5]/80 font-medium flex items-center justify-between">
          <span>FlowPeople is a product of FlowCraft</span>
          <span className="font-mono text-[11px] opacity-75">SaaS v2.4</span>
        </div>
      </aside>

      {/* RIGHT AUTH CARD FORM */}
      <main className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12 relative bg-[#f8fafc]">
        {/* Subtle radial ambient highlight */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_800px_500px_at_100%_0%,rgba(13,148,136,0.06),transparent_60%)]" />

        <div className="relative z-10 w-full max-w-[500px]">
          
          {/* Card Container */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-200/60">

            {/* ALERT NOTIFICATION */}
            {alert && (
              <div 
                className={`mb-6 p-4 rounded-xl text-xs sm:text-sm flex items-start gap-3 border transition-all ${
                  alert.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : alert.type === 'success'
                    ? 'bg-[#ECEEE7] border-[#DFE1D8] text-[#590907]'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
                role="alert"
              >
                {alert.type === 'error' ? (
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-[#590907] mt-0.5" />
                )}
                <div className="flex-1 leading-relaxed font-medium">{alert.message}</div>
              </div>
            )}

            {/* ========================================================= */}
            {/* 1. SIGN IN VIEW */}
            {/* ========================================================= */}
            {mode === 'login' && (
              <div>
                <div className="mb-6">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Sign in</h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
                    Enter your work email or employee code to continue.
                  </p>
                </div>

                {/* Quick Role Fill & 1-Click Instant Demo Login */}
                <div className="mb-5">
                  <button
                    type="button"
                    onClick={() => setShowDemoRoles(!showDemoRoles)}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-[#FAF6F0] border border-slate-200 hover:border-[#590907]/30 text-xs font-bold text-slate-700 flex items-center justify-between transition cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#590907]" />
                      <span>⚡ 1-Click Demo Login (Super Admin, HR, Manager, Employee)</span>
                    </div>
                    {showDemoRoles ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>

                  {showDemoRoles && (
                    <div className="mt-2.5 p-2 rounded-xl bg-[#FAF6F0] border border-slate-200 space-y-2 animate-in fade-in duration-150">
                      <div className="px-2 pt-1 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span>Select role to sign in instantly:</span>
                        <span className="text-[#590907] font-semibold text-[10px]">Zero rate-limits</span>
                      </div>
                      {demoAccounts.map((acc, idx) => (
                        <div
                          key={idx}
                          className="w-full p-2.5 rounded-lg bg-white border border-slate-200 hover:border-[#590907]/40 flex items-center justify-between gap-2 shadow-2xs transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`p-1.5 rounded-md ${acc.color}`}>
                              <acc.icon className="w-4 h-4 shrink-0" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-900 block truncate">{acc.name}</span>
                              <span className="text-[10px] text-slate-500 block truncate">{acc.role} &bull; {acc.email}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleFillDemo(acc)}
                              className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition cursor-pointer"
                              title="Fill credentials into input form"
                            >
                              Fill
                            </button>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => handleInstantDemoLogin(acc.apiRole, acc.email)}
                              className="text-[10px] font-bold text-[#FAF6F0] bg-[#590907] hover:bg-[#450605] px-2.5 py-1 rounded shadow-2xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Sign in instantly without typing"
                            >
                              <Zap className="w-3 h-3 text-[#E8D2B5]" />
                              <span>1-Click</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {/* Email / ID */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Work Email or Employee ID
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="you@company.com or EMP-002"
                        required
                        className="w-full h-12 px-4 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#590907] focus:ring-2 focus:ring-[#590907]/15 transition"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => onNavigateMode('forgot')}
                        className="text-xs font-semibold text-[#590907] hover:text-[#590907] transition"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        className="w-full h-12 pl-4 pr-12 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#590907] focus:ring-2 focus:ring-[#590907]/15 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                        aria-label="Toggle password visibility"
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-600 select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-[#590907] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      <span>Remember my credentials</span>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 mt-2 rounded-xl bg-[#590907] hover:bg-[#450605] text-[#FAF6F0] border border-[#400605] font-bold text-sm shadow-md shadow-[#590907]/20 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ) : (
                      <span>Sign in to Workspace</span>
                    )}
                  </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-200 text-center space-y-4">
                  <p className="text-xs sm:text-sm text-slate-600">
                    New to FlowPeople?{' '}
                    <button
                      type="button"
                      onClick={() => onNavigateMode('signup')}
                      className="font-bold text-[#590907] hover:text-[#590907] transition"
                    >
                      Create an organization account
                    </button>
                  </p>

                  <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                    <Lock className="w-3.5 h-3.5 text-[#590907]" />
                    <span>256-bit TLS encryption • Hardware-bound biometrics</span>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* 2. SIGN UP VIEW */}
            {/* ========================================================= */}
            {mode === 'signup' && (
              <div>
                <div className="mb-6">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Create your account</h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
                    Set up FlowPeople for your organization. You will be its primary owner.
                  </p>
                </div>

                <form onSubmit={handleSignupSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Your Full Name
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Priya Sharma"
                        required
                        className="w-full h-11 px-3.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#590907] focus:ring-2 focus:ring-[#590907]/15 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Organization Name
                      </label>
                      <input
                        type="text"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="e.g. Acme Industries"
                        required
                        className="w-full h-11 px-3.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#590907] focus:ring-2 focus:ring-[#590907]/15 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Work Email
                      </label>
                      <input
                        type="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="you@company.com"
                        required
                        className="w-full h-11 px-3.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#590907] focus:ring-2 focus:ring-[#590907]/15 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Phone Number <span className="text-slate-400 font-normal lowercase">(optional)</span>
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full h-11 px-3.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#590907] focus:ring-2 focus:ring-[#590907]/15 transition"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showSignupPassword ? 'text' : 'password'}
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="Create a strong password"
                        required
                        className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#590907] focus:ring-2 focus:ring-[#590907]/15 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPassword(!showSignupPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                      >
                        {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* 4-bar Password Strength Meter */}
                    {signupPassword && (
                      <div className="mt-2.5 space-y-2">
                        <div className="grid grid-cols-4 gap-1.5 h-1.5 rounded-full overflow-hidden bg-slate-200">
                          <div className={`h-full transition-all ${signupStrength.score >= 1 ? (signupStrength.score === 1 ? 'bg-rose-500' : signupStrength.score === 2 ? 'bg-amber-500' : signupStrength.score === 3 ? 'bg-[#4A5A3F]' : 'bg-[#590907]') : 'bg-transparent'}`} />
                          <div className={`h-full transition-all ${signupStrength.score >= 2 ? (signupStrength.score === 2 ? 'bg-amber-500' : signupStrength.score === 3 ? 'bg-[#4A5A3F]' : 'bg-[#590907]') : 'bg-transparent'}`} />
                          <div className={`h-full transition-all ${signupStrength.score >= 3 ? (signupStrength.score === 3 ? 'bg-[#4A5A3F]' : 'bg-[#590907]') : 'bg-transparent'}`} />
                          <div className={`h-full transition-all ${signupStrength.score >= 4 ? 'bg-[#590907]' : 'bg-transparent'}`} />
                        </div>

                        {/* Checklist */}
                        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                          <span className={signupStrength.rules.len ? 'text-[#590907] font-semibold' : 'text-slate-500'}>
                            {signupStrength.rules.len ? '✓' : '○'} At least 10 characters
                          </span>
                          <span className={signupStrength.rules.upper ? 'text-[#590907] font-semibold' : 'text-slate-500'}>
                            {signupStrength.rules.upper ? '✓' : '○'} One uppercase letter
                          </span>
                          <span className={signupStrength.rules.lower ? 'text-[#590907] font-semibold' : 'text-slate-500'}>
                            {signupStrength.rules.lower ? '✓' : '○'} One lowercase letter
                          </span>
                          <span className={signupStrength.rules.digit ? 'text-[#590907] font-semibold' : 'text-slate-500'}>
                            {signupStrength.rules.digit ? '✓' : '○'} One number
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                        required
                        className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#590907] focus:ring-2 focus:ring-[#590907]/15 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Terms */}
                  <div className="pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 select-none">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        required
                        className="w-4 h-4 rounded border-slate-300 text-[#590907] focus:ring-0 focus:ring-offset-0 mt-0.5 cursor-pointer"
                      />
                      <span className="leading-relaxed">
                        I agree to the <span className="text-[#590907] font-semibold underline">Terms of Service</span> and <span className="text-[#590907] font-semibold underline">Privacy Policy</span>.
                      </span>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 mt-2 rounded-xl bg-[#590907] hover:bg-[#450605] text-[#FAF6F0] border border-[#400605] font-bold text-sm shadow-md shadow-[#590907]/20 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ) : (
                      <span>Create Account & Start 14-Day Free Trial</span>
                    )}
                  </button>
                </form>

                <div className="mt-6 pt-4 border-t border-slate-200 text-center">
                  <p className="text-xs sm:text-sm text-slate-600">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => onNavigateMode('login')}
                      className="font-bold text-[#590907] hover:text-[#590907] transition"
                    >
                      Sign in
                    </button>
                  </p>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* 3. FORGOT PASSWORD VIEW */}
            {/* ========================================================= */}
            {mode === 'forgot' && (
              <div>
                {!forgotSent ? (
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-[#ECEEE7] border border-[#DFE1D8] text-[#590907] flex items-center justify-center mb-5">
                      <KeyRound className="w-6 h-6" />
                    </div>

                    <div className="mb-6">
                      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Forgot password?</h1>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
                        Enter the work email associated with your account and we will send you a reset link.
                      </p>
                    </div>

                    <form onSubmit={handleForgotSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                          Work Email
                        </label>
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="you@company.com"
                          required
                          className="w-full h-12 px-4 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#590907] focus:ring-2 focus:ring-[#590907]/15 transition"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 mt-2 rounded-xl bg-[#590907] hover:bg-[#450605] text-[#FAF6F0] border border-[#400605] font-bold text-sm shadow-md shadow-[#590907]/20 transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {loading ? (
                          <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        ) : (
                          <span>Send Password Reset Link</span>
                        )}
                      </button>
                    </form>

                    <div className="mt-6 text-center">
                      <button
                        type="button"
                        onClick={() => onNavigateMode('login')}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition flex items-center gap-1.5 mx-auto"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to sign in</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Step 2: Check Email Sent Confirmation */
                  <div className="text-center py-4 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#ECEEE7] border border-[#DFE1D8] text-[#590907] flex items-center justify-center mx-auto mb-2">
                      <Mail className="w-7 h-7" />
                    </div>

                    <h1 className="text-2xl font-extrabold text-slate-900">Check your email</h1>
                    
                    <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
                      If an account exists for <strong className="text-slate-900">{forgotEmail}</strong>, we have dispatched a link to choose a new password.
                    </p>

                    <p className="text-xs text-slate-500">
                      Nothing arrived? Check your spam folder or try again in a few minutes.
                    </p>

                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={() => onNavigateMode('login')}
                        className="w-full h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition"
                      >
                        Return to Sign In
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* 4. RESET PASSWORD VIEW */}
            {/* ========================================================= */}
            {mode === 'reset' && (
              <div>
                {!resetSuccess ? (
                  <div>
                    <div className="mb-6">
                      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Set a new password</h1>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
                        Enter and confirm your new password below.
                      </p>
                    </div>

                    <form onSubmit={handleResetSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                          New Password
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Create a strong password"
                            required
                            className="w-full h-12 pl-4 pr-12 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#590907] focus:ring-2 focus:ring-[#590907]/15 transition"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                          >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>

                        {/* Strength Indicator */}
                        {newPassword && (
                          <div className="mt-2.5 space-y-2">
                            <div className="grid grid-cols-4 gap-1.5 h-1.5 rounded-full overflow-hidden bg-slate-200">
                              <div className={`h-full ${resetStrength.score >= 1 ? 'bg-amber-500' : 'bg-transparent'}`} />
                              <div className={`h-full ${resetStrength.score >= 2 ? 'bg-amber-500' : 'bg-transparent'}`} />
                              <div className={`h-full ${resetStrength.score >= 3 ? 'bg-[#4A5A3F]' : 'bg-transparent'}`} />
                              <div className={`h-full ${resetStrength.score >= 4 ? 'bg-[#590907]' : 'bg-transparent'}`} />
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                              <span className={resetStrength.rules.len ? 'text-[#590907]' : 'text-slate-500'}>
                                {resetStrength.rules.len ? '✓' : '○'} At least 10 characters
                              </span>
                              <span className={resetStrength.rules.upper ? 'text-[#590907]' : 'text-slate-500'}>
                                {resetStrength.rules.upper ? '✓' : '○'} One uppercase letter
                              </span>
                              <span className={resetStrength.rules.lower ? 'text-[#590907]' : 'text-slate-500'}>
                                {resetStrength.rules.lower ? '✓' : '○'} One lowercase letter
                              </span>
                              <span className={resetStrength.rules.digit ? 'text-[#590907]' : 'text-slate-500'}>
                                {resetStrength.rules.digit ? '✓' : '○'} One number
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                          Confirm New Password
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmNewPassword ? 'text' : 'password'}
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            placeholder="Re-enter your new password"
                            required
                            className="w-full h-12 pl-4 pr-12 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#590907] focus:ring-2 focus:ring-[#590907]/15 transition"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                          >
                            {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 mt-2 rounded-xl bg-[#590907] hover:bg-[#450605] text-[#FAF6F0] border border-[#400605] font-bold text-sm shadow-md shadow-[#590907]/20 transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {loading ? (
                          <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        ) : (
                          <span>Update Password & Continue</span>
                        )}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#ECEEE7] border border-[#DFE1D8] text-[#590907] flex items-center justify-center mx-auto mb-2">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h1 className="text-2xl font-extrabold text-slate-900">Password Updated</h1>
                    <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto">
                      Your password has been securely updated. You can now sign in with your new credentials.
                    </p>
                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={() => onNavigateMode('login')}
                        className="w-full h-12 rounded-xl bg-[#590907] hover:bg-[#450605] text-[#FAF6F0] border border-[#400605] font-bold text-sm transition"
                      >
                        Continue to Sign In
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* 5. VERIFY EMAIL VIEW */}
            {/* ========================================================= */}
            {mode === 'verify' && (
              <div className="text-center py-4 space-y-4">
                {verifyStatus === 'pending' && (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-[#ECEEE7] border border-[#DFE1D8] text-[#590907] flex items-center justify-center mx-auto mb-2">
                      <Mail className="w-7 h-7" />
                    </div>

                    <h1 className="text-2xl font-extrabold text-slate-900">Verify your email</h1>
                    
                    <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
                      We dispatched a verification link to activate your account and secure your organization workspace.
                    </p>

                    <div className="pt-4 space-y-3">
                      <div className="max-w-sm mx-auto">
                        <input
                          type="email"
                          value={resendEmail}
                          onChange={(e) => setResendEmail(e.target.value)}
                          placeholder="Confirm email address"
                          className="w-full h-11 px-3.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-[#590907] mb-2"
                        />
                        <button
                          type="button"
                          onClick={handleResendVerification}
                          disabled={loading || resendSent}
                          className="w-full h-11 rounded-xl bg-[#590907] hover:bg-[#450605] text-[#FAF6F0] border border-[#400605] font-bold text-xs transition"
                        >
                          {resendSent ? 'Verification Dispatched ✓' : 'Resend Verification Email'}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onNavigateMode('login')}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition flex items-center gap-1.5 mx-auto pt-2"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to sign in</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>

          {/* Footer Back Link */}
          <div className="mt-6 text-center">
            <button
              onClick={onNavigateHome}
              className="text-xs text-slate-500 hover:text-slate-800 transition flex items-center gap-1.5 mx-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to FlowPeople by FlowCraft</span>
            </button>
          </div>

        </div>
      </main>

    </div>
  );
};

