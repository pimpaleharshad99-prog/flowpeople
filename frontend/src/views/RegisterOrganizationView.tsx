import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  User, 
  Lock, 
  Mail, 
  Phone, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  CreditCard, 
  ShieldCheck, 
  AlertCircle,
  Clock,
  Layers
} from 'lucide-react';
import { Logo } from '../components/brand/Logo';
import { api, SubscriptionPlan } from '../services/api';

interface RegisterOrganizationViewProps {
  initialPlanId?: string;
  onSuccess: (userData: any) => void;
  onNavigateLogin: () => void;
  onNavigateHome: () => void;
}

export const RegisterOrganizationView: React.FC<RegisterOrganizationViewProps> = ({
  initialPlanId = 'trial',
  onSuccess,
  onNavigateLogin,
  onNavigateHome
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialPlanId);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  
  // Organization Form State
  const [companyName, setCompanyName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [brandName, setBrandName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [currency, setCurrency] = useState('INR');

  // Owner Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSubscriptionPlans()
      .then(setPlans)
      .catch(() => {});
  }, []);

  const handleCompanyNameChange = (val: string) => {
    setCompanyName(val);
    if (!companyCode || companyCode.length < 3) {
      const generated = val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
      setCompanyCode(generated);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    try {
      setLoading(true);
      const res = await api.registerOrganization({
        company_name: companyName,
        company_code: companyCode.toUpperCase(),
        brand_name: brandName.trim() || companyName.trim(),
        logo_url: logoUrl.trim() || undefined,
        contact_email: contactEmail,
        owner_first_name: firstName,
        owner_last_name: lastName,
        owner_password: password,
        owner_phone: phone || undefined,
        plan_id: selectedPlanId,
        billing_cycle: billingCycle,
        currency,
        timezone
      });

      if (res.access_token) {
        localStorage.setItem('token', res.access_token);
        localStorage.setItem('currentUser', JSON.stringify(res.user));
        onSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId) || {
    name: 'Free Trial (14 Days)',
    tier: 'FREE_TRIAL',
    max_employees: 15,
    max_hr_admins: 2,
    face_attendance_enabled: true
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-teal-500 selection:text-white">
      {/* Top Header */}
      <header className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
        <button onClick={onNavigateHome} className="flex items-center gap-2.5 cursor-pointer">
          <Logo variant="icon" size={30} />
          <div className="text-left">
            <span className="font-extrabold text-sm tracking-tight text-white block">FlowPeople</span>
            <span className="text-[9px] text-slate-400 block -mt-1 font-medium">by FlowCraft</span>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 hidden sm:inline">Already have an organization?</span>
          <button
            onClick={onNavigateLogin}
            className="px-3.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Main Registration Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
        <div className="w-full max-w-xl bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Stepper Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-3">
              <span className={step >= 1 ? 'text-teal-400' : ''}>1. Organization</span>
              <span className="h-0.5 w-12 bg-slate-800" />
              <span className={step >= 2 ? 'text-teal-400' : ''}>2. Owner Account</span>
              <span className="h-0.5 w-12 bg-slate-800" />
              <span className={step >= 3 ? 'text-teal-400' : ''}>3. Subscription Plan</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {step === 1 && 'Register Your Organization'}
              {step === 2 && 'Set Up Owner Account'}
              {step === 3 && 'Confirm Subscription & Launch'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {step === 1 && 'Establish your company workspace with isolated multi-tenant data protection.'}
              {step === 2 && 'Create the primary Organization Owner account to manage your workforce.'}
              {step === 3 && 'Review your chosen plan and activate your 14-day free trial.'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* STEP 1: Organization Information */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Organization / Company Name *
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme Technologies Pvt Ltd"
                      value={companyName}
                      onChange={(e) => handleCompanyNameChange(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Company Code / Slug *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ACME"
                      value={companyCode}
                      onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-teal-500 transition"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Used in Employee IDs & Kiosks</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Official Work Email *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        placeholder="hr@company.com"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Software / Brand Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Acme People (Defaults to Company Name)"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Your custom software name on the admin panel & PDFs</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Company Logo URL (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com/logo.png"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Appears in your sidebar, topbar, and PDF headers</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Organization Timezone</label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                      <option value="America/New_York">America/New York (EST)</option>
                      <option value="America/Los_Angeles">America/Los Angeles (PST)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                      <option value="Asia/Singapore">Asia/Singapore (SGT +8:00)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Operating Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
                    >
                      <option value="INR">INR (₹) - Indian Rupee</option>
                      <option value="USD">USD ($) - US Dollar</option>
                      <option value="EUR">EUR (€) - Euro</option>
                      <option value="GBP">GBP (£) - British Pound</option>
                      <option value="AED">AED (د.إ) - UAE Dirham</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={!companyName || !companyCode || !contactEmail}
                    onClick={() => setStep(2)}
                    className="px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
                  >
                    <span>Continue to Owner Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Owner Information */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">First Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Jane"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Last Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mobile Phone (Optional)</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password *</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Confirm Password *</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    disabled={!firstName || !lastName || !password || !confirmPassword}
                    onClick={() => setStep(3)}
                    className="px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
                  >
                    <span>Choose Plan</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Plan Selection & Launch */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {plans.map((p) => {
                    const active = selectedPlanId === p.id;
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setSelectedPlanId(p.id)}
                        className={`p-3 rounded-xl border text-left transition ${
                          active 
                            ? 'bg-teal-500/10 border-teal-500 ring-1 ring-teal-500' 
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-bold text-xs ${active ? 'text-teal-400' : 'text-white'}`}>{p.name}</span>
                          {active && <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-1">
                          {p.price_monthly_inr === 0 ? 'Free' : `₹${p.price_monthly_inr}/mo`}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Up to {p.max_employees} Staff
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Plan Summary Box */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Selected Plan:</span>
                    <span className="font-bold text-teal-400 font-mono">{(selectedPlan as any).name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Included Trial:</span>
                    <span className="font-semibold text-emerald-400">14 Days Completely Free</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Employee Capacity:</span>
                    <span className="font-mono text-white">{(selectedPlan as any).max_employees} Employees</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Biometric Attendance:</span>
                    <span className="font-semibold text-teal-300">128-D Face Recognition + Fingerprint</span>
                  </div>
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between font-bold">
                    <span className="text-white">Amount Due Today:</span>
                    <span className="text-sm font-mono text-emerald-400">₹0.00 (No Card Required)</span>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-7 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-teal-500/25 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    {loading ? (
                      <span>Provisioning Workspace...</span>
                    ) : (
                      <>
                        <span>Activate & Launch Workspace</span>
                        <Sparkles className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 px-6 text-center text-xs text-slate-600 border-t border-slate-900">
        FlowPeople by FlowCraft &bull; Secure Multi-Tenant Architecture &bull; Encrypted DPDP Biometrics
      </footer>
    </div>
  );
};

