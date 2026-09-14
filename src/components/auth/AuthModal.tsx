'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LogIn, UserPlus, X, Loader2, Github, Mail, KeyRound, ArrowLeft } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'signin' | 'signup';
}

// Google icon SVG (no lucide equivalent)
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

type AuthMode = 'signin' | 'signup' | 'reset';

export function AuthModal({ isOpen, onClose, defaultMode = 'signin' }: AuthModalProps) {
  const { signInWithPassword, signUpWithPassword, signInWithOAuth, resetPassword, isSupabase } = useAuth();
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const clearState = () => {
    setError('');
    setSuccessMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || (mode !== 'reset' && !password)) {
      setError('Please fill in all required fields');
      return;
    }
    if (mode === 'signup' && !fullName.trim()) {
      setError('Please provide your full name');
      return;
    }

    setLoading(true);
    clearState();

    try {
      if (mode === 'signin') {
        const { error: err } = await signInWithPassword(email.trim(), password);
        if (err) throw err;
        onClose();
      } else if (mode === 'signup') {
        const { error: err } = await signUpWithPassword(email.trim(), password, fullName.trim());
        if (err) throw err;
        // Check if email confirmation is needed
        setSuccessMsg('Account created! Check your email to confirm your account, then sign in.');
        setMode('signin');
      } else if (mode === 'reset') {
        const { error: err } = await resetPassword(email.trim());
        if (err) throw err;
        setSuccessMsg('Password reset email sent! Check your inbox.');
        setMode('signin');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    if (!isSupabase) {
      setError('OAuth requires Supabase to be configured.');
      return;
    }
    setOauthLoading(provider);
    clearState();
    try {
      const { error: err } = await signInWithOAuth(provider);
      if (err) throw err;
      // Page will redirect to OAuth provider — no need to close modal
    } catch (err: any) {
      setError(err.message || `Failed to sign in with ${provider}`);
      setOauthLoading(null);
    }
  };

  const modeTitle = mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl p-6 text-[#cccccc]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#3c3c3c]">
          <div className="flex items-center gap-2 text-white font-semibold text-base">
            {mode === 'signin' && <><LogIn className="w-5 h-5 text-sky-400" /><span>Sign In to CodeCollab</span></>}
            {mode === 'signup' && <><UserPlus className="w-5 h-5 text-emerald-400" /><span>Create an Account</span></>}
            {mode === 'reset' && <><KeyRound className="w-5 h-5 text-amber-400" /><span>Reset Password</span></>}
          </div>
          <button onClick={onClose} className="p-1 rounded text-neutral-400 hover:text-white hover:bg-[#333333]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success message */}
        {successMsg && (
          <div className="mb-4 p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
            {successMsg}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* OAuth Buttons (sign in / sign up only) */}
        {mode !== 'reset' && isSupabase && (
          <div className="flex flex-col gap-2 mb-4">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={oauthLoading !== null || loading}
              className="w-full flex items-center justify-center gap-2.5 py-2 rounded-lg bg-white hover:bg-neutral-100 text-neutral-900 text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
            >
              {oauthLoading === 'google' ? (
                <Loader2 className="w-4 h-4 animate-spin text-neutral-600" />
              ) : (
                <GoogleIcon className="w-4 h-4" />
              )}
              <span>Continue with Google</span>
            </button>

            <button
              type="button"
              onClick={() => handleOAuth('github')}
              disabled={oauthLoading !== null || loading}
              className="w-full flex items-center justify-center gap-2.5 py-2 rounded-lg bg-[#24292e] hover:bg-[#2f363d] text-white text-sm font-medium transition-colors disabled:opacity-50 shadow-sm border border-[#3c3c3c]"
            >
              {oauthLoading === 'github' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Github className="w-4 h-4" />
              )}
              <span>Continue with GitHub</span>
            </button>

            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-[#3c3c3c]" />
              <span className="text-xs text-neutral-500">or</span>
              <div className="flex-1 h-px bg-[#3c3c3c]" />
            </div>
          </div>
        )}

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Alex Rivera"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">Email Address</label>
            <input
              type="email"
              placeholder="developer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-neutral-300">Password</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => { setMode('reset'); clearState(); }}
                    className="text-[11px] text-sky-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'signup' ? 6 : undefined}
                className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || oauthLoading !== null}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-md"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <Mail className="w-4 h-4" />
            <span>
              {mode === 'signin' && 'Sign In with Email'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'reset' && 'Send Reset Email'}
            </span>
          </button>
        </form>

        {/* Footer links */}
        <div className="mt-4 pt-3 border-t border-[#3c3c3c] text-center text-xs text-neutral-400">
          {mode === 'signin' && (
            <p>
              Don't have an account?{' '}
              <button
                onClick={() => { setMode('signup'); clearState(); }}
                className="text-sky-400 hover:underline font-medium"
              >
                Sign up
              </button>
            </p>
          )}
          {mode === 'signup' && (
            <p>
              Already have an account?{' '}
              <button
                onClick={() => { setMode('signin'); clearState(); }}
                className="text-sky-400 hover:underline font-medium"
              >
                Sign in
              </button>
            </p>
          )}
          {mode === 'reset' && (
            <button
              onClick={() => { setMode('signin'); clearState(); }}
              className="flex items-center gap-1 mx-auto text-sky-400 hover:underline font-medium"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
