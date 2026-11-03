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
import { supabase } from '../lib/supabase';
import {
  registerCompanyWithSupabase,
  generateCompanySlug,
  generateRegistrationKey,
  formatSupabaseError,
  validateCompanySlug
} from '../services/organizationService';

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
  const [companySlug, setCompanySlug] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [brandName, setBrandName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [currency, setCurrency] = useState('INR');

  // Idempotency Request Key: initialized per registration attempt; reused across retries of the same attempt
  const [requestKey, setRequestKey] = useState<string>(() => generateRegistrationKey());

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
      .catch(() => { });
  }, []);

  const handleCompanyNameChange = (val: string) => {
    setCompanyName(val);
    const autoSlug = generateCompanySlug(val);
    setCompanySlug(autoSlug);
    // Fresh idempotency key for new organization input
    setRequestKey(generateRegistrationKey());

    if (!companyCode || companyCode.length < 3) {
      const generated = val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
      setCompanyCode(generated);
    }
  };

  const handleSlugChange = (val: string) => {
    setCompanySlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''));
    // Fresh idempotency key when changing slug
    setRequestKey(generateRegistrationKey());
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

    const effectiveSlug = companySlug.trim().toLowerCase() || generateCompanySlug(companyName);
    const slugCheck = validateCompanySlug(effectiveSlug);
    if (!slugCheck.valid) {
      setError(slugCheck.error || 'Invalid organization slug');
      return;
    }

    try {
      setLoading(true);

      // 1. Establish or verify authenticated Supabase session
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        const cleanEmail = contactEmail.trim().toLowerCase();
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password: password.trim(),
          options: {
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim()
            }
          }
        });

        if (signUpErr) {
          // If already registered in auth, attempt sign-in with password
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: password.trim()
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
      // Note: Reuses the same requestKey when retrying the same attempt
      const rpcResult = await registerCompanyWithSupabase({
        name: companyName.trim(),
        slug: effectiveSlug,
        requestKey: requestKey,
        legalName: brandName.trim() || companyName.trim()
      });

      // 3. Complete backend local sync & issue session token
      const res = await api.registerOrganization({
        company_name: companyName.trim(),
        company_code: (companyCode || effectiveSlug.slice(0, 8)).toUpperCase(),
        brand_name: brandName.trim() || companyName.trim(),
        logo_url: logoUrl.trim() || undefined,
        contact_email: contactEmail.trim().toLowerCase(),
        owner_first_name: firstName.trim(),
        owner_last_name: lastName.trim(),
        owner_password: password.trim(),
        owner_phone: phone || undefined,
        plan_id: selectedPlanId,
        billing_cycle: billingCycle,
        currency,
        timezone,
        supabase_company_id: rpcResult.organization?.id,
        supabase_slug: effectiveSlug,
        supabase_request_key: requestKey
      });

      if (res.access_token) {
        localStorage.setItem('token', res.access_token);
        localStorage.setItem('currentUser', JSON.stringify(res.user));
        onSuccess(res.user);
      }
    } catch (err: any) {
      // Requirement 5: Display real Supabase error message/code instead of generic internal error
      setError(formatSupabaseError(err));
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
    <div className="min-h-screen bg-[#FAF6F0] text-[#2E3029] flex flex-col justify-between font-sans selection:bg-[#590907] selection:text-[#590907]">
      {/* Top Header */}
      <header className="px-6 py-4 border-b border-[#DFE1D8] flex items-center justify-between">
        <button onClick={onNavigateHome} className="flex items-center gap-2.5 cursor-pointer">
          <Logo variant="icon" size={30} />
          <div className="text-left">
            <span className="font-extrabold text-sm tracking-tight text-[#590907] block">FlowPeople</span>
            <span className="text-[9px] text-[#6B6D62] block -mt-1 font-medium">by FlowCraft</span>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#6B6D62] hidden sm:inline">Already have an organization?</span>
          <button
            onClick={onNavigateLogin}
            className="px-3.5 py-1.5 rounded-lg border border-[#DFE1D8] hover:bg-[#ECEEE7] text-xs font-semibold text-[#2E3029] transition"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Main Registration Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
        <div className="w-full max-w-xl bg-white border border-[#DFE1D8] rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#E8D2B5]/25 rounded-full blur-3xl pointer-events-none" />

          {/* Stepper Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-xs font-bold text-[#6B6D62] mb-3">
              <span className={step >= 1 ? 'text-[#590907]' : ''}>1. Organization</span>
              <span className="h-0.5 w-12 bg-slate-800" />
              <span className={step >= 2 ? 'text-[#590907]' : ''}>2. Owner Account</span>
              <span className="h-0.5 w-12 bg-slate-800" />
              <span className={step >= 3 ? 'text-[#590907]' : ''}>3. Subscription Plan</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#590907] tracking-tight">
              {step === 1 && 'Register Your Organization'}
              {step === 2 && 'Set Up Owner Account'}
              {step === 3 && 'Confirm Subscription & Launch'}
            </h1>
            <p className="text-xs text-[#6B6D62] mt-1">
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
                    <Building2 className="w-4 h-4 text-[#8E9084] absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme Technologies Pvt Ltd"
                      value={companyName}
                      onChange={(e) => handleCompanyNameChange(e.target.value)}
                      className="w-full bg-[#FAF6F0] border border-[#DFE1D8] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-[#590907] placeholder-slate-500 focus:outline-none focus:border-[#590907] focus:ring-1 focus:ring-[#590907] transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Organization Slug (p_slug) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. acme-corp"
                      value={companySlug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      className="w-full bg-[#FAF6F0] border border-[#DFE1D8] rounded-xl px-3.5 py-2.5 text-xs text-[#590907] font-mono lowercase focus:outline-none focus:border-[#590907] transition"
                    />
                    <span className="text-[10px] text-[#8E9084] mt-1 block">URL-safe tenant slug</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Company Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ACME"
                      value={companyCode}
                      onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                      className="w-full bg-[#FAF6F0] border border-[#DFE1D8] rounded-xl px-3.5 py-2.5 text-xs text-[#590907] font-mono uppercase focus:outline-none focus:border-[#590907] transition"
                    />
                    <span className="text-[10px] text-[#8E9084] mt-1 block">Staff IDs & terminals</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Official Work Email *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#8E9084] absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        placeholder="hr@company.com"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="w-full bg-[#FAF6F0] border border-[#DFE1D8] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-[#590907] placeholder-slate-500 focus:outline-none focus:border-[#590907] transition"
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
                      className="w-full bg-[#FAF6F0] border border-[#DFE1D8] rounded-xl px-3.5 py-2.5 text-xs text-[#590907] placeholder-slate-500 focus:outline-none focus:border-[#590907] transition"
                    />
                    <span className="text-[10px] text-[#8E9084] mt-1 block">Your custom software name on the admin panel & PDFs</span>
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
                      className="w-full bg-[#FAF6F0] border border-[#DFE1D8] rounded-xl px-3.5 py-2.5 text-xs text-[#590907] placeholder-slate-500 focus:outline-none focus:border-[#590907] transition"
                    />
                    <span className="text-[10px] text-[#8E9084] mt-1 block">Appears in your sidebar, topbar, and PDF headers</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Organization Timezone</label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full bg-[#FAF6F0] border border-[#DFE1D8] rounded-xl px-3 py-2.5 text-xs text-[#590907] focus:outline-none focus:border-[#590907]"
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
                      className="w-full bg-[#FAF6F0] border border-[#DFE1D8] rounded-xl px-3 py-2.5 text-xs text-[#590907] focus:outline-none focus:border-[#590907]"
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
                    disabled={!companyName || !companySlug || !companyCode || !contactEmail}
                    onClick={() => setStep(2)}
                    className="px-6 py-2.5 rounded-xl bg-[#590907] hover:bg-[#450605] text-[#FAF6F0] border border-[#400605] font-bold text-xs flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
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
                      className="w-full bg-[#FAF6F0] border border-[#DFE1D8] rounded-xl px-3.5 py-2.5 text-xs text-[#590907] focus:outline-none focus:border-[#590907]"
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
                      className="w-full bg-[#FAF6F0] border border-[#DFE1D8] rounded-xl px-3.5 py-2.5 text-xs text-[#590907] focus:outline-none focus:border-[#590907]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mobile Phone (Optional)</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-[#8E9084] absolute left-3 top-3" />
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-[#FAF6F0] border border-[#DFE1D8] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-[#590907] focus:outline-none focus:border-[#590907]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password *</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#8E9084] absolute left-3 top-3" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-[#FAF6F0] border border-[#DFE1D8] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-[#590907] focus:outline-none focus:border-[#590907]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Confirm Password *</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#8E9084] absolute left-3 top-3" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-[#FAF6F0] border border-[#DFE1D8] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-[#590907] focus:outline-none focus:border-[#590907]"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2 rounded-xl text-[#6B6D62] hover:text-[#590907] text-xs font-semibold flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    disabled={!firstName || !lastName || !password || !confirmPassword}
                    onClick={() => setStep(3)}
                    className="px-6 py-2.5 rounded-xl bg-[#590907] hover:bg-[#450605] text-[#FAF6F0] border border-[#400605] font-bold text-xs flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
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
                        className={`p-3 rounded-xl border text-left transition ${active
                          ? 'bg-[#E8D2B5]/25 border-[#590907] ring-1 ring-[#590907]'
                          : 'bg-[#FAF6F0] border-[#DFE1D8] hover:border-[#DFE1D8]'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-bold text-xs ${active ? 'text-[#590907]' : 'text-[#590907]'}`}>{p.name}</span>
                          {active && <CheckCircle2 className="w-3.5 h-3.5 text-[#590907]" />}
                        </div>
                        <div className="text-[11px] font-mono text-[#6B6D62] mt-1">
                          {p.price_monthly_inr === 0 ? 'Free' : `₹${p.price_monthly_inr}/mo`}
                        </div>
                        <div className="text-[10px] text-[#8E9084] mt-0.5">
                          Up to {p.max_employees} Staff
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Plan Summary Box */}
                <div className="p-4 rounded-2xl bg-[#FAF6F0] border border-[#DFE1D8] space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#6B6D62]">Selected Plan:</span>
                    <span className="font-bold text-[#590907] font-mono">{(selectedPlan as any).name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#6B6D62]">Included Trial:</span>
                    <span className="font-semibold text-[#4A5A3F]">14 Days Completely Free</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#6B6D62]">Employee Capacity:</span>
                    <span className="font-mono text-[#590907]">{(selectedPlan as any).max_employees} Employees</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#6B6D62]">Biometric Attendance:</span>
                    <span className="font-semibold text-[#590907]">128-D Face Recognition + Fingerprint</span>
                  </div>
                  <div className="pt-2 border-t border-[#DFE1D8] flex items-center justify-between font-bold">
                    <span className="text-[#590907]">Amount Due Today:</span>
                    <span className="text-sm font-mono text-[#4A5A3F]">₹0.00 (No Card Required)</span>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2 rounded-xl text-[#6B6D62] hover:text-[#590907] text-xs font-semibold flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-7 py-3 rounded-xl bg-[#590907] hover:bg-[#450605] text-[#FAF6F0] border border-[#400605] font-extrabold text-xs shadow-md shadow-[#590907]/20 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer active:scale-95"
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

