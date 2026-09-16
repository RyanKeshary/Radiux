'use client';

import React, { useRef, useEffect } from 'react';
import { ExternalLink, UserPlus, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';

interface ProfileHoverCardProps {
  user: {
    id: string;
    full_name?: string;
    username?: string;
    avatar_url?: string;
    bio?: string;
    statusQuote?: string;
  };
  position: { x: number; y: number };
  onClose: () => void;
  onOpenFullProfile: (userId: string) => void;
}

export function ProfileHoverCard({
  user,
  position,
  onClose,
  onOpenFullProfile,
}: ProfileHoverCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleDown);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleSecondClick = () => {
    triggerHaptic('medium');
    onOpenFullProfile(user.id);
    onClose();
  };

  // Keep card inside viewport bounds
  const left = Math.min(Math.max(16, position.x), typeof window !== 'undefined' ? window.innerWidth - 260 : 300);
  const top = Math.min(Math.max(16, position.y + 10), typeof window !== 'undefined' ? window.innerHeight - 180 : 300);

  return (
    <div
      ref={cardRef}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        backgroundColor: 'rgba(23, 27, 38, 0.95)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
      }}
      className="fixed z-50 w-64 rounded-2xl border p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 select-none text-xs text-white"
    >
      <div className="flex items-center gap-3">
        {/* Avatar with glow */}
        <div className="relative">
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-bold text-sm shadow-md overflow-hidden ring-2 ring-white/10">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.full_name || 'User'} className="w-full h-full object-cover" />
            ) : (
              user.full_name?.charAt(0).toUpperCase() || 'U'
            )}
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[rgba(23,27,38,0.95)]" />
        </div>

        {/* Name & Handle */}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{user.full_name || 'Developer'}</div>
          <div className="text-[11px] text-neutral-400 truncate">@{user.username || 'developer'}</div>
        </div>
      </div>

      {user.bio && (
        <p className="mt-2 text-[11px] text-neutral-300 line-clamp-2 italic">
          &ldquo;{user.bio}&rdquo;
        </p>
      )}

      {/* Prominent Click-Again Prompt Badge */}
      <button
        onClick={handleSecondClick}
        className="mt-3 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-medium text-[11.5px] flex items-center justify-center gap-1.5 shadow-lg shadow-sky-900/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
        <span>Click again to view profile</span>
      </button>
    </div>
  );
}
