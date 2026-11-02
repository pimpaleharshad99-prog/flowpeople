import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Scan, 
  Fingerprint, 
  Users, 
  Calendar, 
  DollarSign, 
  BarChart3, 
  Lock, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  Zap, 
  Clock, 
  Building2, 
  Award, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Star,
  Camera,
  Layers,
  FileCheck
} from 'lucide-react';
import { Logo } from '../components/brand/Logo';
import { SubscriptionPlan, api } from '../services/api';

interface LandingPageViewProps {
  onNavigateLogin: () => void;
  onNavigateRegister: (selectedPlanId?: string) => void;
  onNavigateKiosk: () => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onNavigateLogin,
  onNavigateRegister,
  onNavigateKiosk
}) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    api.getSubscriptionPlans()
      .then(setPlans)
      .catch(() => {
        // Fallback static plans if offline
        setPlans([
          {
            id: 'trial',
            name: 'Free Trial',
            tier: 'FREE_TRIAL',
            description: '14 days of unrestricted access to all biometric and HR tools.',
            price_monthly_inr: 0,
            price_annual_inr: 0,
            price_monthly_usd: 0,
            price_annual_usd: 0,
            max_employees: 15,
            max_hr_admins: 2,
            face_attendance_enabled: true,
            fingerprint_enabled: true,
            payroll_enabled: true,
            advanced_reports_enabled: true,
            storage_limit_gb: 5,
            support_level: 'Standard'
          },
          {
            id: 'starter',
            name: 'Starter',
            tier: 'STARTER',
            description: 'Essential workforce & optical face attendance for rising businesses.',
            price_monthly_inr: 2499,
            price_annual_inr: 24990,
            price_monthly_usd: 29,
            price_annual_usd: 290,
            max_employees: 30,
            max_hr_admins: 2,
            face_attendance_enabled: true,
            fingerprint_enabled: true,
            payroll_enabled: false,
            advanced_reports_enabled: true,
            storage_limit_gb: 15,
            support_level: 'Email Support'
          },
          {
            id: 'professional',
            name: 'Professional',
            tier: 'PROFESSIONAL',
            description: 'The complete enterprise HRMS suite with Face, Fingerprint & Payroll.',
            price_monthly_inr: 6999,
            price_annual_inr: 69990,
            price_monthly_usd: 79,
            price_annual_usd: 790,
            max_employees: 100,
            max_hr_admins: 5,
            face_attendance_enabled: true,
            fingerprint_enabled: true,
            payroll_enabled: true,
            advanced_reports_enabled: true,
            storage_limit_gb: 50,
            support_level: 'Priority 24/7'
          },
          {
            id: 'enterprise',
            name: 'Enterprise',
            tier: 'ENTERPRISE',
            description: 'Unlimited capacity, customized biometric kiosks and high-security compliance.',
            price_monthly_inr: 19999,
            price_annual_inr: 199990,
            price_monthly_usd: 249,
            price_annual_usd: 2490,
            max_employees: 10000,
            max_hr_admins: 50,
            face_attendance_enabled: true,
            fingerprint_enabled: true,
            payroll_enabled: true,
            advanced_reports_enabled: true,
            storage_limit_gb: 500,
            support_level: 'Dedicated Manager'
          }
        ]);
      });
  }, []);

  const faqs = [
    {
      q: 'How does the pure Face Recognition Attendance work?',
      a: 'FlowPeople uses an optical 128-dimensional normalized neural embedding pipeline with multi-frame liveness verification. Employees simply approach any tablet, laptop, or desktop kiosk. The camera automatically activates, confirms anti-spoof liveness, identifies the enrolled face against the organization roster in under 300ms, and registers an immutable timestamped punch without requiring manual ID entry.'
    },
    {
      q: 'Does it support physical USB Fingerprint scanners?',
      a: 'Yes. In addition to optical face recognition, FlowPeople provides biometric bridge connectivity supporting official hardware SDKs (SecuGen, DigitalPersona, Mantra MFS100) and WebAuthn platform biometric sensors (Windows Hello, Touch ID, Android biometrics) on the same kiosk interface.'
    },
    {
      q: 'Is my company data and employee biometric information secure?',
      a: 'Every organization is strictly isolated in its own multi-tenant workspace with database-level isolation. Face vectors are stored as non-invertible, encrypted mathematical embeddings. Raw camera images are never retained, and all operations comply with Indian Digital Personal Data Protection (DPDP) standards.'
    },
    {
      q: 'Can employees punch in from multiple branches or offices?',
      a: 'Yes. Organizations can register multiple branch locations with geofenced GPS boundaries and deploy independent Kiosks. All punches synchronize instantaneously to the central HR Admin portal in real time.'
    },
    {
      q: 'Can I start with a Free Trial without a credit card?',
      a: 'Absolutely. Every newly registered organization receives an immediate 14-day Free Trial with complete access to optical face attendance, leave management, shifts, and reports.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-teal-500 selection:text-white">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="icon" size={34} />
            <div>
              <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                FlowPeople
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 uppercase tracking-widest">
                  SaaS
                </span>
              </span>
              <span className="text-[10px] text-slate-400 block -mt-1 font-medium">by FlowCraft</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-300">
            <a href="#features" className="hover:text-teal-400 transition">Features</a>
            <a href="#biometrics" className="hover:text-teal-400 transition">Biometric Attendance</a>
            <a href="#pricing" className="hover:text-teal-400 transition">Pricing</a>
            <a href="#security" className="hover:text-teal-400 transition">Security & DPDP</a>
            <a href="#faq" className="hover:text-teal-400 transition">FAQ</a>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onNavigateKiosk}
              className="px-3 py-1.5 rounded-lg border border-teal-500/30 text-teal-300 hover:bg-teal-500/10 text-xs font-bold transition flex items-center gap-1.5"
            >
              <Scan className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Launch Kiosk</span>
            </button>
            <button
              onClick={onNavigateLogin}
              className="px-3.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 text-xs font-bold transition"
            >
              Sign In
            </button>
            <button
              onClick={() => onNavigateRegister('trial')}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-extrabold text-xs shadow-md shadow-teal-500/20 transition flex items-center gap-1.5 active:scale-95"
            >
              <span>Start Free Trial</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-28 px-4 sm:px-8 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-teal-500/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-teal-500/30 text-teal-400 text-xs font-semibold shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>Next-Generation Multi-Tenant Biometric Workforce SaaS</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
            People First. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-300">
              Work Smarter.
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-300 font-normal leading-relaxed">
            The complete cloud HRMS with automatic optical face recognition, physical USB fingerprint attendance, multi-branch shift management, automated payroll, and bank-grade tenant isolation.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            <button
              onClick={() => onNavigateRegister('trial')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-bold text-sm shadow-xl shadow-teal-500/25 transition active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Start 14-Day Free Trial</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#pricing"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 font-bold text-sm transition flex items-center justify-center gap-2"
            >
              <span>View Pricing Plans</span>
            </a>
            <button
              onClick={onNavigateKiosk}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-teal-500/40 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 font-bold text-sm transition flex items-center justify-center gap-2"
            >
              <Scan className="w-4 h-4" />
              <span>Experience Kiosk</span>
            </button>
          </div>

          {/* Social Proof Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-12 border-t border-slate-800/80 max-w-4xl mx-auto">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">&lt; 300ms</div>
              <p className="text-xs text-slate-400 mt-1">Optical Face Recognition</p>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-teal-400 font-mono">100% Isolated</div>
              <p className="text-xs text-slate-400 mt-1">Tenant Database Workspaces</p>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">Dual Biometric</div>
              <p className="text-xs text-slate-400 mt-1">Face ID + USB Fingerprint</p>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">DPDP Ready</div>
              <p className="text-xs text-slate-400 mt-1">Encrypted Biometric Vectors</p>
            </div>
          </div>
        </div>
      </section>

      {/* Biometrics Showcase Section */}
      <section id="biometrics" className="py-20 px-4 sm:px-8 bg-slate-900/50 border-y border-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold uppercase tracking-wider mb-3">
              <Camera className="w-3.5 h-3.5" />
              <span>Real Biometrics, Zero Proxies</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Optical Face Recognition + Physical Fingerprint
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-2">
              Transform any office tablet or camera into an autonomous clock-in terminal. No buddy punching, no paper logs, and zero manual code entries.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Left: Interactive Optical Terminal Card */}
            <div className="rounded-2xl border border-teal-500/30 bg-slate-950 p-6 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-bl-full pointer-events-none" />
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-mono text-slate-400 ml-2">Terminal // Asia/Kolkata Kiosk</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  LIVE STREAM READY
                </span>
              </div>

              <div className="relative aspect-video rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                <div className="w-20 h-20 rounded-full border-2 border-teal-500/40 border-dashed animate-[spin_8s_linear_infinite] flex items-center justify-center mb-3">
                  <Scan className="w-8 h-8 text-teal-400 animate-pulse" />
                </div>
                <div className="font-bold text-sm text-white">Autonomous 1:N Facial Matching</div>
                <p className="text-xs text-slate-400 max-w-xs mt-1 font-mono">
                  128-D L2-Normalized Embedding &bull; Anti-Spoof Blink Verification &bull; Auto Check-In / Check-Out
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Model Architecture:</span>
                <span className="font-mono text-teal-400 font-bold">v2.0-facenet-norm (128-D)</span>
              </div>
            </div>

            {/* Right: Technical Features List */}
            <div className="space-y-4">
              {[
                {
                  title: 'Pure Optical 1:N Identification',
                  desc: 'Employees do not type badges or passwords. The camera identifies the face against the organization roster instantly.',
                  icon: Scan
                },
                {
                  title: 'Dynamic Anti-Spoof Liveness Detection',
                  desc: 'Multi-frame variance analysis and blink detection reject photo-on-phone, printed paper, and replay video spoof attempts.',
                  icon: ShieldCheck
                },
                {
                  title: 'Physical USB Fingerprint Bridge',
                  desc: 'Compatible with SecuGen, DigitalPersona, and Mantra MFS100 scanners, as well as Windows Hello and Touch ID.',
                  icon: Fingerprint
                },
                {
                  title: 'State Machine Punch Logic',
                  desc: 'Determines whether to register arrival Check-In or departure Check-Out based on employee’s daily punch chronology.',
                  icon: Clock
                }
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 flex items-start gap-3.5 hover:border-teal-500/40 transition">
                    <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">{item.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Complete HRMS Modules Section */}
      <section id="features" className="py-20 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
              <Layers className="w-3.5 h-3.5" />
              <span>All-In-One Enterprise Suite</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Everything Your Organization Needs
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-2">
              From employee onboarding to automated payroll and attendance analytics, FlowPeople consolidates your workplace tools into a single coherent system.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Employee Directory & Master',
                desc: 'Comprehensive employee profiles, hierarchical department trees, designation charts, emergency contacts, and digital document vaults.',
                icon: Users
              },
              {
                title: 'Leave & Attendance Tracking',
                desc: 'Configurable paid leave balances, automated monthly accruals, half-day sessions, manager approval workflows, and regularization audit trails.',
                icon: Calendar
              },
              {
                title: 'Automated Payroll & Payslips',
                desc: 'Base salary structures, HRA, PF deductions, tax calculations, one-click payroll runs, and downloadable PDF payslips for staff.',
                icon: DollarSign
              },
              {
                title: 'Multi-Branch Shift Rostering',
                desc: 'Flexible shift rotations, morning/night shifts, grace periods, geofenced clock-in radii, and automated late-arrival calculations.',
                icon: Clock
              },
              {
                title: 'Real-Time Workforce Analytics',
                desc: 'Live activity streams, presence heatmaps, department headcount distributions, and exportable vector A4 print timesheet ledgers.',
                icon: BarChart3
              },
              {
                title: 'Role-Based Access (RBAC)',
                desc: 'Strictly defined roles for Organization Owners, HR Admins, Department Managers, and Staff Employees with server-enforced permissions.',
                icon: ShieldCheck
              }
            ].map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900 hover:border-slate-700 transition space-y-3">
                  <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 w-fit">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-white">{feature.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security & DPDP Compliance Section */}
      <section id="security" className="py-20 px-4 sm:px-8 bg-slate-900/40 border-t border-slate-800">
        <div className="max-w-5xl mx-auto rounded-3xl border border-teal-500/30 bg-gradient-to-b from-slate-900 to-slate-950 p-8 sm:p-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold uppercase tracking-wider">
                <Lock className="w-3.5 h-3.5" />
                <span>Security & Compliance</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Engineered for High-Trust Enterprises
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                We believe workforce biometrics must uphold uncompromising privacy standards. FlowPeople ensures full compliance with Indian DPDP regulations and enterprise data protection standards.
              </p>
              <div className="space-y-2.5 pt-2">
                {[
                  'Strict Tenant Database Isolation (No Cross-Tenant Leaks)',
                  'Non-Invertible 128-D Vector Embeddings (No Raw Face Images Stored)',
                  'Mandatory Informed Biometric Consent & Revocation Workflow',
                  'Owner-Only Super Admin Isolated at /superadmin',
                  'Immutable Audit Logging for Every Punch & Administrative Event'
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Security Architecture</span>
                <span className="text-[10px] font-mono text-teal-400 font-semibold">VERIFIED PASS</span>
              </div>
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="font-semibold text-slate-200">Tenant Scoping Policy</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Enforced across all database queries via company_id foreign key validation.</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="font-semibold text-slate-200">Platform Isolation</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Platform Owner portal is physically detached from regular company navigation bars.</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="font-semibold text-slate-200">Anti-Spoofing Verification</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">High-entropy multi-frame liveness detection eliminates presentation attacks.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Plans Section */}
      <section id="pricing" className="py-24 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold uppercase tracking-wider mb-3">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Transparent SaaS Pricing</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Predictable Plans for Every Stage
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-2">
              Start with a 14-day Free Trial. Upgrade, downgrade, or cancel anytime with zero hidden fees.
            </p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
                <button
                  onClick={() => setBillingCycle('MONTHLY')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${billingCycle === 'MONTHLY' ? 'bg-teal-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  Monthly Billing
                </button>
                <button
                  onClick={() => setBillingCycle('ANNUAL')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${billingCycle === 'ANNUAL' ? 'bg-teal-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  <span>Annual (Save 20%)</span>
                </button>
              </div>

              <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
                <button
                  onClick={() => setCurrency('INR')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition ${currency === 'INR' ? 'bg-slate-800 text-teal-400' : 'text-slate-400'}`}
                >
                  INR (₹)
                </button>
                <button
                  onClick={() => setCurrency('USD')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition ${currency === 'USD' ? 'bg-slate-800 text-teal-400' : 'text-slate-400'}`}
                >
                  USD ($)
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {plans.map((p) => {
              const isPopular = p.tier === 'PROFESSIONAL';
              const price = currency === 'INR' 
                ? (billingCycle === 'ANNUAL' ? Math.round(p.price_annual_inr / 12) : p.price_monthly_inr)
                : (billingCycle === 'ANNUAL' ? Math.round(p.price_annual_usd / 12) : p.price_monthly_usd);

              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border p-6 flex flex-col justify-between transition-all relative ${
                    isPopular 
                      ? 'bg-slate-900/90 border-teal-500 shadow-xl shadow-teal-500/10 ring-1 ring-teal-500' 
                      : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider shadow">
                      Most Popular
                    </span>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h3 className="font-bold text-lg text-white">{p.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 min-h-[32px]">{p.description}</p>
                    </div>

                    <div className="py-2 border-y border-slate-800/80">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-white font-mono">
                          {currency === 'INR' ? '₹' : '$'}{price.toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">/ month</span>
                      </div>
                      {billingCycle === 'ANNUAL' && price > 0 && (
                        <span className="text-[10px] text-teal-400 font-mono mt-0.5 block">Billed annually</span>
                      )}
                    </div>

                    <ul className="space-y-2.5 text-xs text-slate-300">
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span>Up to <strong className="text-white">{p.max_employees} Employees</strong></span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span><strong className="text-white">{p.max_hr_admins} HR Administrator{p.max_hr_admins > 1 ? 's' : ''}</strong></span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span>Optical Face Recognition Kiosk</span>
                      </li>
                      <li className="flex items-center gap-2">
                        {p.fingerprint_enabled ? (
                          <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        ) : (
                          <span className="w-3.5 h-3.5 text-slate-600 shrink-0">&bull;</span>
                        )}
                        <span className={p.fingerprint_enabled ? 'text-slate-200' : 'text-slate-500'}>
                          USB Fingerprint Scanner
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        {p.payroll_enabled ? (
                          <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        ) : (
                          <span className="w-3.5 h-3.5 text-slate-600 shrink-0">&bull;</span>
                        )}
                        <span className={p.payroll_enabled ? 'text-slate-200' : 'text-slate-500'}>
                          Full Payroll & Salary Slips
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span>{p.storage_limit_gb} GB Secure Storage</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span>{p.support_level} Support</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-6 mt-4">
                    <button
                      onClick={() => onNavigateRegister(p.id)}
                      className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1.5 ${
                        isPopular
                          ? 'bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-extrabold shadow-md shadow-teal-500/20'
                          : 'border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-white'
                      }`}
                    >
                      <span>{p.id === 'trial' ? 'Start Free Trial' : 'Select Plan'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-8 bg-slate-900/30 border-t border-slate-800">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider">
              <HelpCircle className="w-3.5 h-3.5 text-teal-400" />
              <span>Frequently Asked Questions</span>
            </div>
            <h2 className="text-3xl font-extrabold text-white">Got Questions? We Have Answers.</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden transition"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-sm text-white hover:text-teal-300 transition"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-teal-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/60">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Footer Section */}
      <section className="py-20 px-4 sm:px-8 text-center relative overflow-hidden">
        <div className="max-w-3xl mx-auto space-y-6 relative z-10">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Ready to modernise your workforce?
          </h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto">
            Join forward-thinking companies running autonomous face attendance, streamlined payroll, and enterprise HR operations on FlowPeople.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigateRegister('trial')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-bold text-sm shadow-xl shadow-teal-500/25 transition active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Get Started with 14-Day Free Trial</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onNavigateKiosk}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-sm transition flex items-center justify-center gap-2"
            >
              <Scan className="w-4 h-4" />
              <span>Launch Attendance Kiosk</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 px-4 sm:px-8 bg-slate-950 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Logo variant="icon" size={24} />
            <span className="font-bold text-slate-300">FlowPeople by FlowCraft</span>
            <span>&bull; &copy; {new Date().getFullYear()} All Rights Reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-slate-300 transition">Features</a>
            <a href="#pricing" className="hover:text-slate-300 transition">Pricing</a>
            <a href="#security" className="hover:text-slate-300 transition">DPDP Security</a>
            <button onClick={onNavigateKiosk} className="hover:text-teal-400 transition font-mono">
              Kiosk Mode
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
