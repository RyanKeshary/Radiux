'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AuthModal } from './AuthModal';
import { LogOut, User, LogIn, ChevronDown } from 'lucide-react';

export function UserMenu() {
  const { user, loading, signOut } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  if (loading) {
    return <div className="w-20 h-7 bg-[#252526] animate-pulse rounded" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setAuthMode('signin');
            setIsAuthModalOpen(true);
          }}
          className="px-3 py-1 text-xs font-medium text-white bg-[#333333] hover:bg-[#3e3e3e] border border-[#444444] rounded transition-colors"
        >
          Sign In
        </button>
        <button
          onClick={() => {
            setAuthMode('signup');
            setIsAuthModalOpen(true);
          }}
          className="px-3 py-1 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded transition-colors shadow-sm"
        >
          Sign Up
        </button>
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          defaultMode={authMode}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#252526] hover:bg-[#2d2d2d] border border-[#3c3c3c] text-xs text-white transition-all shadow-sm"
      >
        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 text-white flex items-center justify-center text-[10px] font-bold">
          {user.full_name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <span className="truncate max-w-[120px] font-medium">{user.full_name}</span>
        <ChevronDown className="w-3 h-3 text-neutral-400" />
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg bg-[#252526] border border-[#3c3c3c] shadow-2xl z-50 p-2 text-xs text-[#cccccc]">
          <div className="px-2 py-1.5 border-b border-[#3c3c3c] mb-1">
            <div className="font-semibold text-white truncate">{user.full_name}</div>
            <div className="text-[11px] text-neutral-400 truncate">{user.email}</div>
          </div>

          <button
            onClick={async () => {
              await signOut();
              setIsDropdownOpen(false);
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-rose-500/20 text-rose-300 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
