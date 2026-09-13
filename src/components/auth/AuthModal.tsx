'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LogIn, UserPlus, X, Loader2, Sparkles } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'signin' | 'signup';
}

export function AuthModal({ isOpen, onClose, defaultMode = 'signin' }: AuthModalProps) {
  const { signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide email and password');
      return;
    }
    if (mode === 'signup' && !fullName.trim()) {
      setError('Please provide your full name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (mode === 'signin') {
        const { error: err } = await signInWithPassword(email.trim(), password);
        if (err) throw err;
      } else {
        const { error: err } = await signUpWithPassword(email.trim(), password, fullName.trim());
        if (err) throw err;
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl p-6 text-[#cccccc]">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#3c3c3c]">
          <div className="flex items-center gap-2 text-white font-semibold text-base">
            {mode === 'signin' ? (
              <>
                <LogIn className="w-5 h-5 text-sky-400" />
                <span>Log In to CodeCollab</span>
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <span>Create an Account</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-[#333333]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                placeholder="e.g. Alex Rivera"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder="developer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-md"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-[#3c3c3c] text-center text-xs text-neutral-400">
          {mode === 'signin' ? (
            <p>
              Don't have an account?{' '}
              <button
                onClick={() => {
                  setMode('signup');
                  setError('');
                }}
                className="text-sky-400 hover:underline font-medium"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already registered?{' '}
              <button
                onClick={() => {
                  setMode('signin');
                  setError('');
                }}
                className="text-sky-400 hover:underline font-medium"
              >
                Log in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
