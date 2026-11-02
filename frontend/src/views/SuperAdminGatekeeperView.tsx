import React, { useState } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import { Logo } from '../components/brand/Logo';
import { api, User } from '../services/api';
import { supabase } from '../lib/supabase';

interface SuperAdminGatekeeperViewProps {
  onSuccess: (user: User) => void;
  onNavigateHome: () => void;
}

export const SuperAdminGatekeeperView: React.FC<SuperAdminGatekeeperViewProps> = ({
  onSuccess,
  onNavigateHome,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    const cleanPwd = password.trim();

    if (!cleanEmail || !cleanPwd) {
      setError('Both Platform Owner Email and Master Password are required.');
      return;
    }

    setLoading(true);
    try {
      // 1. Authenticate using Supabase Auth signInWithPassword
      const { data: sbData, error: sbError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPwd,
      });

      if (sbError || !sbData.session) {
        setError(sbError?.message || 'Invalid Platform Owner credentials.');
        setLoading(false);
        return;
      }

      // 2. Send Supabase access token to backend for server-side verification against public.platform_admins
      const res = await api.superAdminLogin(sbData.session.access_token);

      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Access Denied: Account is not authorized as a Root Platform Owner.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#2E3029] flex flex-col justify-between p-4 sm:p-6 font-sans">
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <Logo variant="icon" size={32} colorMode="light" />
          <div>
            <span className="font-extrabold text-sm text-[#590907] block">FlowPeople</span>
            <span className="text-[10px] text-[#8E9084] font-mono font-semibold block -mt-0.5">Platform Security Gatekeeper</span>
          </div>
        </div>

        <button
          onClick={onNavigateHome}
          className="text-xs text-[#590907] hover:text-[#450605] flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DFE1D8] bg-white hover:bg-[#ECEEE7] transition shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return Home</span>
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-[#DFE1D8] rounded-2xl p-6 sm:p-8 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-[#E8D2B5]/30 border border-[#A5A79B]/40 text-[#590907] flex items-center justify-center mb-4 mx-auto shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>

          <div className="text-center mb-6">
            <h1 className="text-xl font-extrabold text-[#590907]">Root Platform Gatekeeper</h1>
            <p className="text-xs text-[#6B6D62] mt-1">
              Restricted console for global SaaS fleet & multi-tenant operations.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-[#FBF2F2] border border-[#E9BCBB] text-[#590907] text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#590907] mt-0.5" />
              <div className="leading-relaxed font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#4B4D44] uppercase tracking-wider mb-1.5">
                Owner Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@flowpeople.io"
                required
                className="w-full h-11 px-3.5 rounded-xl bg-[#FAF6F0] border border-[#DFE1D8] text-[#2E3029] text-sm placeholder:text-[#8E9084] focus:outline-none focus:bg-white focus:border-[#590907] focus:ring-2 focus:ring-[#590907]/15 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#4B4D44] uppercase tracking-wider mb-1.5">
                Master Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter secret password"
                  required
                  className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-[#FAF6F0] border border-[#DFE1D8] text-[#2E3029] text-sm placeholder:text-[#8E9084] focus:outline-none focus:bg-white focus:border-[#590907] focus:ring-2 focus:ring-[#590907]/15 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E9084] hover:text-[#2E3029] p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-2 rounded-xl bg-[#590907] hover:bg-[#450605] text-[#FAF6F0] font-bold text-xs uppercase tracking-wider transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm border border-[#400605]"
            >
              {loading ? (
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Authorize Super Admin</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#ECEEE7] text-center">
            <span className="text-[10px] text-[#8E9084] font-mono">
              IP & Activity logged for security auditing
            </span>
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-[#8E9084] py-2">
        FlowCraft Platform Infrastructure Gatekeeper
      </footer>
    </div>
  );
};
