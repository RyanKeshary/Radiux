'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ArrowRight, Code2 } from 'lucide-react';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Verify if user is in an active recovery or authenticated session
    async function checkSession() {
      if (!isSupabaseConfigured || !supabase) {
        setHasSession(false);
        setError('Supabase is not configured in this environment.');
        return;
      }
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          // Listen for onAuthStateChange in case session is being established from hash fragment
          const { data: authListener } = supabase.auth.onAuthStateChange((event, s) => {
            if (event === 'PASSWORD_RECOVERY' || s) {
              setHasSession(true);
              setError(null);
            }
          });
          setTimeout(() => {
            if (hasSession === null) {
              setHasSession(false);
              setError('No active password recovery session found. Please request a new password reset link.');
            }
          }, 3000);
          return () => {
            authListener.subscription.unsubscribe();
          };
        } else {
          setHasSession(true);
        }
      } catch (e: any) {
        setHasSession(false);
        setError(e.message || 'Failed to verify session');
      }
    }

    checkSession();
  }, [hasSession]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase is not configured.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 2500);
    } catch (err: any) {
      console.error('Password update failed:', err);
      setError(err.message || 'Failed to update password. Your reset link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0d14] text-neutral-200 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-sky-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[250px] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Main Glassmorphic Container */}
      <div className="w-full max-w-md bg-[#121620]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 mb-3">
            <Code2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Reset Your Radiux Password
          </h1>
          <p className="text-xs text-neutral-400 mt-1 max-w-xs">
            Enter your new secure password below to regain access to your workspaces.
          </p>
        </div>

        {/* Success View */}
        {success ? (
          <div className="flex flex-col items-center text-center py-4 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-base font-semibold text-white">Password Updated Successfully</h2>
            <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
              Your password has been changed. You will be redirected to the dashboard in a moment...
            </p>
            <div className="mt-6">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                <span>Go to Radiux Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5 text-rose-300 text-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  className="w-full pl-9 pr-10 py-2.5 bg-[#181d29] border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  required
                  minLength={6}
                  className="w-full pl-9 pr-10 py-2.5 bg-[#181d29] border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || (hasSession === false)}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Save New Password</span>
                </>
              )}
            </button>

            <div className="pt-3 border-t border-white/5 text-center">
              <Link
                href="/"
                className="text-xs text-neutral-400 hover:text-white transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
