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
  ChevronUp
} from 'lucide-react';
import { Logo } from '../components/brand/Logo';
import { api, User } from '../services/api';
import { supabase } from '../lib/supabase';

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

  // Quick Demo Accounts
  const demoAccounts = [
    {
      role: 'Platform Owner (Super Admin)',
      name: 'Sarah Connor',
      email: 'pimpaleharshad99@gmail.com',
      password: 'password123',
      icon: ShieldCheck,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    },
    {
      role: 'HR Administrator',
      name: 'David Vance',
      email: 'hr@acme.corp',
      password: 'password123',
      icon: UserCheck,
      color: 'text-teal-400 bg-teal-500/10 border-teal-500/20'
    },
    {
      role: 'Operations Manager',
      name: 'Elena Rostova',
      email: 'manager@acme.corp',
      password: 'password123',
      icon: Users,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    },
    {
      role: 'Employee',
      name: 'Alex Mercer',
      email: 'alex@acme.corp',
      password: 'password123',
      icon: Briefcase,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    }
  ];

  const handleFillDemo = (acc: typeof demoAccounts[0]) => {
    setLoginEmail(acc.email);
    setLoginPassword(acc.password);
    setAlert({
      type: 'success',
      message: `Selected ${acc.name} (${acc.role}). Click Sign in below.`
    });
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
      // 1. Primary: backend authentication
      try {
        const res = await api.login(cleanEmail, cleanPwd);
        onSuccess(res.user);
        return;
      } catch (backendErr: any) {
        // 2. Secondary: Supabase fallback if backend direct match fails
        if (cleanEmail.includes('@')) {
          const { data: sbData, error: sbErr } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPwd
          });
          if (!sbErr && sbData.user) {
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
        throw backendErr;
      }
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

      const res = await api.registerOrganization({
        company_name: orgName.trim(),
        company_code: compCode,
        contact_email: signupEmail.trim(),
        owner_first_name: firstName,
        owner_last_name: lastName,
        owner_password: signupPassword,
        owner_phone: phone.trim() || undefined,
        plan_id: 'trial',
        billing_cycle: 'MONTHLY'
      });

      onSuccess(res.user);
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: err.message || 'Unable to complete organization registration. Please verify details.'
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
    <div className="min-h-screen bg-[#060b11] text-slate-100 flex flex-col lg:grid lg:grid-cols-[minmax(400px,5fr)_7fr] font-sans selection:bg-teal-500 selection:text-slate-950">
      
      {/* LEFT BRANDING SIDEBAR */}
      <aside className="relative overflow-hidden p-8 sm:p-14 flex flex-col justify-between bg-gradient-to-br from-[#061a1a] via-[#0b2e2d] to-[#004d40] border-b lg:border-b-0 lg:border-r border-[#162436]/60">
        {/* Radiant Ambient Glows */}
        <div className="pointer-events-none absolute -right-28 -top-28 w-96 h-96 rounded-full bg-teal-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl" />
        
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
            className="lg:hidden text-xs font-semibold text-teal-300 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-950/60 border border-teal-500/30"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Home</span>
          </button>
        </div>

        {/* Center Copy */}
        <div className="relative z-10 my-10 lg:my-auto max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Enterprise HR & Biometrics</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
            {side.title}
          </h2>

          <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-normal">
            {side.lead}
          </p>

          <ul className="space-y-3.5 pt-2">
            {side.points.map((pt, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm sm:text-base text-teal-100 font-medium">
                <div className="w-5 h-5 rounded-full bg-teal-400/20 border border-teal-400/40 flex items-center justify-center shrink-0 mt-0.5 text-teal-300">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom Tagline */}
        <div className="relative z-10 pt-6 border-t border-teal-500/20 text-xs text-teal-300/80 font-medium flex items-center justify-between">
          <span>FlowPeople is a product of FlowCraft</span>
          <span className="font-mono text-[11px] opacity-75">SaaS v2.4</span>
        </div>
      </aside>

      {/* RIGHT AUTH CARD FORM */}
      <main className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12 relative bg-[#060b11]">
        {/* Subtle radial ambient highlight */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_800px_500px_at_100%_0%,rgba(0,213,160,0.06),transparent_60%)]" />

        <div className="relative z-10 w-full max-w-[500px]">
          
          {/* Card Container */}
          <div className="bg-[#0a111a] border border-[#162436] rounded-3xl p-6 sm:p-10 shadow-2xl shadow-black/80 backdrop-blur-xl">

            {/* ALERT NOTIFICATION */}
            {alert && (
              <div 
                className={`mb-6 p-4 rounded-xl text-xs sm:text-sm flex items-start gap-3 border transition-all ${
                  alert.type === 'error'
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : alert.type === 'success'
                    ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
                role="alert"
              >
                {alert.type === 'error' ? (
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-teal-400 mt-0.5" />
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
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Sign in</h1>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
                    Enter your work email or employee code to continue.
                  </p>
                </div>

                {/* Quick Role Fill Helper */}
                <div className="mb-5">
                  <button
                    type="button"
                    onClick={() => setShowDemoRoles(!showDemoRoles)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                      <span>One-Click Role Demo Logins</span>
                    </div>
                    {showDemoRoles ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showDemoRoles && (
                    <div className="mt-2.5 p-2 rounded-xl bg-[#060b11] border border-[#162436] space-y-1.5 animate-in fade-in duration-150">
                      {demoAccounts.map((acc, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleFillDemo(acc)}
                          className="w-full text-left p-2.5 rounded-lg hover:bg-slate-900 flex items-center justify-between transition cursor-pointer border border-transparent hover:border-slate-800"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <acc.icon className="w-4 h-4 text-teal-400 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-white block truncate">{acc.name}</span>
                              <span className="text-[10px] text-slate-400 block truncate">{acc.role}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20 shrink-0">
                            Fill
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {/* Email / ID */}
                  <div>
                    <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                      Work Email or Employee ID
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="you@company.com or EMP-001"
                        required
                        className="w-full h-12 px-4 rounded-xl bg-[#0f1a26] border border-[#162436] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => onNavigateMode('forgot')}
                        className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition"
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
                        className="w-full h-12 pl-4 pr-12 rounded-xl bg-[#0f1a26] border border-[#162436] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 rounded-lg"
                        aria-label="Toggle password visibility"
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300 select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded bg-[#0f1a26] border-[#162436] text-teal-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      <span>Remember my credentials</span>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 mt-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/25 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-950/30 border-t-slate-950 animate-spin" />
                    ) : (
                      <span>Sign in to Workspace</span>
                    )}
                  </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-800/80 text-center space-y-4">
                  <p className="text-xs sm:text-sm text-slate-400">
                    New to FlowPeople?{' '}
                    <button
                      type="button"
                      onClick={() => onNavigateMode('signup')}
                      className="font-bold text-teal-400 hover:text-teal-300 transition"
                    >
                      Create an organization account
                    </button>
                  </p>

                  <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                    <Lock className="w-3.5 h-3.5 text-teal-500" />
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
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Create your account</h1>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
                    Set up FlowPeople for your organization. You will be its primary owner.
                  </p>
                </div>

                <form onSubmit={handleSignupSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">
                        Your Full Name
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Priya Sharma"
                        required
                        className="w-full h-11 px-3.5 rounded-xl bg-[#0f1a26] border border-[#162436] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">
                        Organization Name
                      </label>
                      <input
                        type="text"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="e.g. Acme Industries"
                        required
                        className="w-full h-11 px-3.5 rounded-xl bg-[#0f1a26] border border-[#162436] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">
                        Work Email
                      </label>
                      <input
                        type="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="you@company.com"
                        required
                        className="w-full h-11 px-3.5 rounded-xl bg-[#0f1a26] border border-[#162436] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">
                        Phone Number <span className="text-slate-500 font-normal lowercase">(optional)</span>
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full h-11 px-3.5 rounded-xl bg-[#0f1a26] border border-[#162436] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showSignupPassword ? 'text' : 'password'}
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="Create a strong password"
                        required
                        className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-[#0f1a26] border border-[#162436] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPassword(!showSignupPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 rounded-lg"
                      >
                        {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* 4-bar Password Strength Meter */}
                    {signupPassword && (
                      <div className="mt-2.5 space-y-2">
                        <div className="grid grid-cols-4 gap-1.5 h-1.5 rounded-full overflow-hidden bg-slate-800">
                          <div className={`h-full transition-all ${signupStrength.score >= 1 ? (signupStrength.score === 1 ? 'bg-rose-500' : signupStrength.score === 2 ? 'bg-amber-500' : signupStrength.score === 3 ? 'bg-emerald-400' : 'bg-teal-400') : 'bg-transparent'}`} />
                          <div className={`h-full transition-all ${signupStrength.score >= 2 ? (signupStrength.score === 2 ? 'bg-amber-500' : signupStrength.score === 3 ? 'bg-emerald-400' : 'bg-teal-400') : 'bg-transparent'}`} />
                          <div className={`h-full transition-all ${signupStrength.score >= 3 ? (signupStrength.score === 3 ? 'bg-emerald-400' : 'bg-teal-400') : 'bg-transparent'}`} />
                          <div className={`h-full transition-all ${signupStrength.score >= 4 ? 'bg-teal-400' : 'bg-transparent'}`} />
                        </div>

                        {/* Checklist */}
                        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                          <span className={signupStrength.rules.len ? 'text-teal-400 font-semibold' : 'text-slate-500'}>
                            {signupStrength.rules.len ? '✓' : '○'} At least 10 characters
                          </span>
                          <span className={signupStrength.rules.upper ? 'text-teal-400 font-semibold' : 'text-slate-500'}>
                            {signupStrength.rules.upper ? '✓' : '○'} One uppercase letter
                          </span>
                          <span className={signupStrength.rules.lower ? 'text-teal-400 font-semibold' : 'text-slate-500'}>
                            {signupStrength.rules.lower ? '✓' : '○'} One lowercase letter
                          </span>
                          <span className={signupStrength.rules.digit ? 'text-teal-400 font-semibold' : 'text-slate-500'}>
                            {signupStrength.rules.digit ? '✓' : '○'} One number
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                        required
                        className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-[#0f1a26] border border-[#162436] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 rounded-lg"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Terms */}
                  <div className="pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300 select-none">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        required
                        className="w-4 h-4 rounded bg-[#0f1a26] border-[#162436] text-teal-500 focus:ring-0 focus:ring-offset-0 mt-0.5 cursor-pointer"
                      />
                      <span className="leading-relaxed">
                        I agree to the <span className="text-teal-400 font-semibold underline">Terms of Service</span> and <span className="text-teal-400 font-semibold underline">Privacy Policy</span>.
                      </span>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 mt-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/25 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-950/30 border-t-slate-950 animate-spin" />
                    ) : (
                      <span>Create Account & Start 14-Day Free Trial</span>
                    )}
                  </button>
                </form>

                <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
                  <p className="text-xs sm:text-sm text-slate-400">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => onNavigateMode('login')}
                      className="font-bold text-teal-400 hover:text-teal-300 transition"
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
                    <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mb-5">
                      <KeyRound className="w-6 h-6" />
                    </div>

                    <div className="mb-6">
                      <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Forgot password?</h1>
                      <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
                        Enter the work email associated with your account and we will send you a reset link.
                      </p>
                    </div>

                    <form onSubmit={handleForgotSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                          Work Email
                        </label>
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="you@company.com"
                          required
                          className="w-full h-12 px-4 rounded-xl bg-[#0f1a26] border border-[#162436] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 mt-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/25 transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {loading ? (
                          <div className="w-5 h-5 rounded-full border-2 border-slate-950/30 border-t-slate-950 animate-spin" />
                        ) : (
                          <span>Send Password Reset Link</span>
                        )}
                      </button>
                    </form>

                    <div className="mt-6 text-center">
                      <button
                        type="button"
                        onClick={() => onNavigateMode('login')}
                        className="text-xs font-semibold text-slate-400 hover:text-white transition flex items-center gap-1.5 mx-auto"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to sign in</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Step 2: Check Email Sent Confirmation */
                  <div className="text-center py-4 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-2">
                      <Mail className="w-7 h-7" />
                    </div>

                    <h1 className="text-2xl font-extrabold text-white">Check your email</h1>
                    
                    <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
                      If an account exists for <strong className="text-white">{forgotEmail}</strong>, we have dispatched a link to choose a new password.
                    </p>

                    <p className="text-xs text-slate-500">
                      Nothing arrived? Check your spam folder or try again in a few minutes.
                    </p>

                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={() => onNavigateMode('login')}
                        className="w-full h-11 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold text-xs transition"
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
                      <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Set a new password</h1>
                      <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
                        Enter and confirm your new password below.
                      </p>
                    </div>

                    <form onSubmit={handleResetSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                          New Password
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Create a strong password"
                            required
                            className="w-full h-12 pl-4 pr-12 rounded-xl bg-[#0f1a26] border border-[#162436] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                          >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>

                        {/* Strength Indicator */}
                        {newPassword && (
                          <div className="mt-2.5 space-y-2">
                            <div className="grid grid-cols-4 gap-1.5 h-1.5 rounded-full overflow-hidden bg-slate-800">
                              <div className={`h-full ${resetStrength.score >= 1 ? 'bg-amber-400' : 'bg-transparent'}`} />
                              <div className={`h-full ${resetStrength.score >= 2 ? 'bg-amber-400' : 'bg-transparent'}`} />
                              <div className={`h-full ${resetStrength.score >= 3 ? 'bg-emerald-400' : 'bg-transparent'}`} />
                              <div className={`h-full ${resetStrength.score >= 4 ? 'bg-teal-400' : 'bg-transparent'}`} />
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                              <span className={resetStrength.rules.len ? 'text-teal-400' : 'text-slate-500'}>
                                {resetStrength.rules.len ? '✓' : '○'} At least 10 characters
                              </span>
                              <span className={resetStrength.rules.upper ? 'text-teal-400' : 'text-slate-500'}>
                                {resetStrength.rules.upper ? '✓' : '○'} One uppercase letter
                              </span>
                              <span className={resetStrength.rules.lower ? 'text-teal-400' : 'text-slate-500'}>
                                {resetStrength.rules.lower ? '✓' : '○'} One lowercase letter
                              </span>
                              <span className={resetStrength.rules.digit ? 'text-teal-400' : 'text-slate-500'}>
                                {resetStrength.rules.digit ? '✓' : '○'} One number
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                          Confirm New Password
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmNewPassword ? 'text' : 'password'}
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            placeholder="Re-enter your new password"
                            required
                            className="w-full h-12 pl-4 pr-12 rounded-xl bg-[#0f1a26] border border-[#162436] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                          >
                            {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 mt-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/25 transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {loading ? (
                          <div className="w-5 h-5 rounded-full border-2 border-slate-950/30 border-t-slate-950 animate-spin" />
                        ) : (
                          <span>Update Password & Continue</span>
                        )}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-2">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h1 className="text-2xl font-extrabold text-white">Password Updated</h1>
                    <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto">
                      Your password has been securely updated. You can now sign in with your new credentials.
                    </p>
                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={() => onNavigateMode('login')}
                        className="w-full h-12 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm transition"
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
                    <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-2">
                      <Mail className="w-7 h-7" />
                    </div>

                    <h1 className="text-2xl font-extrabold text-white">Verify your email</h1>
                    
                    <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
                      We dispatched a verification link to activate your account and secure your organization workspace.
                    </p>

                    <div className="pt-4 space-y-3">
                      <div className="max-w-sm mx-auto">
                        <input
                          type="email"
                          value={resendEmail}
                          onChange={(e) => setResendEmail(e.target.value)}
                          placeholder="Confirm email address"
                          className="w-full h-11 px-3.5 rounded-xl bg-[#0f1a26] border border-[#162436] text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-teal-400 mb-2"
                        />
                        <button
                          type="button"
                          onClick={handleResendVerification}
                          disabled={loading || resendSent}
                          className="w-full h-11 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition"
                        >
                          {resendSent ? 'Verification Dispatched ✓' : 'Resend Verification Email'}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onNavigateMode('login')}
                        className="text-xs font-semibold text-slate-400 hover:text-white transition flex items-center gap-1.5 mx-auto pt-2"
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
              className="text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1.5 mx-auto"
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

