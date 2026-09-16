'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { UserProfile, CodingPartner } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { 
  User, 
  ExternalLink, 
  Check, 
  UserPlus, 
  Sparkles, 
  X,
  Code2,
  Clock,
  CheckCheck
} from 'lucide-react';

interface ProfilePreviewCardProps {
  userId: string | null;
  currentUserId?: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenFullProfile: (userId: string) => void;
  anchorPosition?: { top: number; left: number } | null;
}

export function ProfilePreviewCard({
  userId,
  currentUserId,
  isOpen,
  onClose,
  onOpenFullProfile,
  anchorPosition,
}: ProfilePreviewCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [partnerStatus, setPartnerStatus] = useState<string>('none');
  const [loading, setLoading] = useState(true);

  useClickOutside(cardRef, onClose, isOpen);

  useEffect(() => {
    if (isOpen && userId) {
      setLoading(true);
      Promise.all([
        DataService.getProfile(userId),
        currentUserId ? DataService.getCodingPartners(currentUserId) : Promise.resolve([]),
      ]).then(([p, partners]) => {
        setProfile(p);
        if (partners && partners.length > 0) {
          const match = partners.find(
            (item: any) => item.requester_id === userId || item.receiver_id === userId
          );
          if (match) {
            setPartnerStatus(match.status);
          } else {
            setPartnerStatus('none');
          }
        }
        setLoading(false);
      });
    }
  }, [isOpen, userId, currentUserId]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, onClose]);

  if (!isOpen || !userId) return null;

  // Handle "Click again to view profile"
  const handleTriggerFullProfile = () => {
    onClose();
    onOpenFullProfile(userId);
  };

  // Compute position relative to viewport or anchor
  const stylePos: React.CSSProperties = anchorPosition ? {
    position: 'fixed',
    top: Math.min(Math.max(16, anchorPosition.top), window.innerHeight - 320),
    left: Math.min(Math.max(16, anchorPosition.left), window.innerWidth - 300),
    zIndex: 60,
  } : {
    position: 'fixed',
    top: '25%',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 60,
  };

  return (
    <div 
      ref={cardRef}
      style={{
        ...stylePos,
        backgroundColor: 'var(--ide-card-bg)',
        borderColor: 'var(--ide-border)',
        color: 'var(--ide-text)',
      }}
      className="w-72 rounded-xl shadow-2xl border flex flex-col overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-100 select-none backdrop-blur-xl"
    >
      {/* Mini banner */}
      <div className="h-14 bg-gradient-to-r from-sky-600/30 via-indigo-600/20 to-purple-600/30 relative p-2 flex justify-end">
        <button
          onClick={onClose}
          className="w-5 h-5 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Avatar & Core Identity */}
      <div className="px-4 pb-3 -mt-6">
        <div className="flex items-end justify-between mb-2">
          <div className="relative">
            {profile?.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt={profile.full_name || 'Avatar'}
                className="w-12 h-12 rounded-full object-cover border-2 border-[var(--ide-card-bg)] shadow-md"
              />
            ) : (
              <div 
                className="w-12 h-12 rounded-full border-2 border-[var(--ide-card-bg)] flex items-center justify-center font-bold text-lg text-sky-400 bg-sky-500/10 shadow-md"
              >
                {(profile?.full_name || 'D')[0]}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[var(--ide-card-bg)]" />
          </div>

          {/* Partner status badge */}
          {partnerStatus === 'accepted' ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <Check className="w-2.5 h-2.5" /> Partner
            </span>
          ) : partnerStatus === 'pending' ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" /> Pending
            </span>
          ) : null}
        </div>

        {/* Name and Handle */}
        <div className="min-w-0">
          <h4 className="font-bold text-xs truncate" style={{ color: 'var(--ide-text)' }}>
            {profile?.full_name || 'Developer'}
          </h4>
          <p className="text-[10.5px] opacity-60 font-mono truncate">
            @{profile?.username || 'developer'}
          </p>
        </div>

        {/* Short Bio */}
        {profile?.bio && (
          <p className="text-[11px] opacity-80 mt-1.5 line-clamp-2 leading-relaxed">
            {profile.bio}
          </p>
        )}

        {/* Key Skills */}
        {profile?.skills && profile.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {profile.skills.slice(0, 3).map((s, idx) => (
              <span 
                key={idx} 
                className="text-[9.5px] px-1.5 py-0.2 rounded font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20"
              >
                {s}
              </span>
            ))}
            {profile.skills.length > 3 && (
              <span className="text-[9px] px-1 py-0.2 rounded opacity-50 font-mono">
                +{profile.skills.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Clear Interaction Hint: "Click again to view profile" */}
        <div className="mt-3.5 pt-2.5 border-t border-white/5">
          <button
            onClick={handleTriggerFullProfile}
            className="w-full py-1.5 px-2.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-400 hover:text-sky-300 font-medium text-[11px] flex items-center justify-between transition-all group shadow-sm"
          >
            <span className="flex items-center gap-1.5 font-semibold">
              <Sparkles className="w-3 h-3" />
              <span>Click again to view profile</span>
            </span>
            <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
