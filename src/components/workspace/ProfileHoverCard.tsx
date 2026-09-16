'use client';

import React, { useState, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { UserProfile } from '@/lib/types';
import { ExternalLink, UserPlus, CheckCheck, Sparkles, Code2 } from 'lucide-react';
import { Sound } from '@/lib/audio';

interface ProfileHoverCardProps {
  userId: string;
  userName: string;
  userAvatar?: string;
  userRole?: string;
  statusHeadline?: string;
  onOpenFullProfile: (userId: string) => void;
  children: React.ReactNode;
}

export function ProfileHoverCard({
  userId,
  userName,
  userAvatar,
  userRole = 'Developer',
  statusHeadline,
  onOpenFullProfile,
  children,
}: ProfileHoverCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const popoverRef = useRef<HTMLDivElement>(null);

  useClickOutside(popoverRef, () => {
    setIsOpen(false);
    setClickCount(0);
  }, isOpen);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      // First click: open mini card & show confirmation
      setIsOpen(true);
      setClickCount(1);
      Sound.playHapticPop();
    } else {
      // Second click: open full profile modal!
      setIsOpen(false);
      setClickCount(0);
      Sound.playHapticPop();
      onOpenFullProfile(userId);
    }
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <div 
        onClick={handleClick}
        className="cursor-pointer transition-transform active:scale-95"
        title="Click to view profile preview"
      >
        {children}
      </div>

      {isOpen && (
        <div 
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-xl border shadow-2xl p-3 z-50 text-xs backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 select-none"
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))',
            borderColor: 'rgba(56, 189, 248, 0.3)',
            boxShadow: '0 20px 35px -10px rgba(0, 0, 0, 0.7), 0 0 15px rgba(56, 189, 248, 0.15)',
            color: '#f8fafc',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mini Header */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md overflow-hidden ring-2 ring-sky-400/30">
                {userAvatar ? (
                  <img src={userAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  userName.charAt(0).toUpperCase()
                )}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-bold text-xs truncate text-white">{userName}</div>
              <div className="text-[10.5px] text-sky-400 font-medium truncate">{userRole}</div>
              {statusHeadline && (
                <div className="text-[10px] text-slate-300 truncate mt-0.5">{statusHeadline}</div>
              )}
            </div>
          </div>

          {/* Interactive 'Click again' prompt badge */}
          <button
            onClick={() => {
              setIsOpen(false);
              onOpenFullProfile(userId);
              Sound.playHapticPop();
            }}
            className="w-full mt-2.5 py-1.5 px-2 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-200 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all group"
          >
            <Sparkles className="w-3 h-3 text-sky-400 group-hover:rotate-12 transition-transform" />
            <span>Click again to view full profile</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </button>
        </div>
      )}
    </div>
  );
}
