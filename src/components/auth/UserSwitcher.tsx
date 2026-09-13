'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { DEMO_USERS } from '@/lib/storage-mock';
import { UserCheck, LogIn, Users, Sparkles, X } from 'lucide-react';

export function UserSwitcher() {
  const { user, switchDemoUser, isSupabase, signIn } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [customEmail, setCustomEmail] = useState('');

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#333333] hover:bg-[#3e3e3e] border border-[#444444] text-xs font-medium text-white transition-all shadow-sm"
        title="Switch user account for multi-collaborator testing"
      >
        <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
          {user?.full_name?.charAt(0) || 'U'}
        </div>
        <span className="truncate max-w-[110px]">{user?.full_name || 'Sign In'}</span>
        <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-neutral-300">
          {isSupabase ? 'Supabase' : 'Demo Mode'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-lg bg-[#252526] border border-[#3c3c3c] shadow-2xl z-50 p-3 text-sm text-[#cccccc]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#3c3c3c]">
            <div className="flex items-center gap-1.5 font-semibold text-white">
              <Users className="w-4 h-4 text-sky-400" />
              <span>Multi-User Testing</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-neutral-400 hover:text-white p-1 rounded hover:bg-[#333333]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-neutral-400 mb-3">
            Quickly switch accounts to test real-time collaboration across multiple tabs/windows:
          </p>

          <div className="space-y-1.5 mb-4">
            {DEMO_USERS.map((u) => {
              const active = u.id === user?.id;
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    switchDemoUser(u);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                    active
                      ? 'bg-sky-600/30 text-sky-300 border border-sky-500/50'
                      : 'hover:bg-[#333333] text-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-neutral-700 flex items-center justify-center font-bold text-[10px]">
                      {u.full_name[0]}
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{u.full_name}</div>
                      <div className="text-[10px] text-neutral-400">{u.email}</div>
                    </div>
                  </div>
                  {active && <UserCheck className="w-3.5 h-3.5 text-sky-400" />}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#3c3c3c]">
            <label className="block text-[11px] text-neutral-400 mb-1">
              Add another user:
            </label>
            <div className="flex gap-1.5">
              <input
                type="email"
                placeholder="colleague@example.com"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                className="flex-1 bg-[#1e1e1e] border border-[#3c3c3c] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={async () => {
                  if (customEmail.trim()) {
                    await signIn(customEmail.trim());
                    setCustomEmail('');
                    setIsOpen(false);
                  }
                }}
                className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-medium"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
