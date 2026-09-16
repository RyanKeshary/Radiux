'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile, CodingPartner } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { Sound } from '@/lib/audio';
import { 
  X, 
  User, 
  UserPlus, 
  CheckCheck, 
  FolderPlus, 
  Github, 
  ExternalLink,
  Code2,
  Sparkles,
  Loader2,
  Globe,
  Check
} from 'lucide-react';

interface PublicProfileModalProps {
  userId: string | null;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
  onInviteToProject?: () => void;
}

export function PublicProfileModal({
  userId,
  currentUserId,
  isOpen,
  onClose,
  onInviteToProject,
}: PublicProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [partnerStatus, setPartnerStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [sendingRequest, setSendingRequest] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      setLoading(true);
      Promise.all([
        DataService.getProfile(userId),
        DataService.getCodingPartners(currentUserId),
      ]).then(([p, partners]) => {
        setProfile(p);
        const match = partners.find(
          item => item.requester_id === userId || item.receiver_id === userId
        );
        if (match) {
          setPartnerStatus(match.status as any);
        } else {
          setPartnerStatus('none');
        }
        setLoading(false);
      });
    }
  }, [isOpen, userId, currentUserId]);

  if (!isOpen || !userId) return null;

  const handleAddPartner = async () => {
    if (!profile) return;
    setSendingRequest(true);
    Sound.playHapticPop();
    const currentUser = await DataService.getProfile(currentUserId);
    if (currentUser) {
      const res = await DataService.sendPartnerRequest(currentUser, profile.email);
      if (res.success) {
        setPartnerStatus('pending');
        Sound.playNotificationChime();
      }
    }
    setSendingRequest(false);
  };

  const bannerBg = profile?.banner_url || 'linear-gradient(135deg, #0ea5e9, #6366f1, #a855f7)';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md animate-in fade-in select-none p-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md rounded-2xl shadow-2xl border flex flex-col overflow-hidden text-xs"
        style={{
          backgroundColor: 'var(--ide-card-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner */}
        <div 
          className="h-28 relative flex justify-end p-3 transition-all"
          style={{
            background: bannerBg.startsWith('http') ? `url("${bannerBg}") center/cover no-repeat` : bannerBg,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
          <button
            onClick={() => {
              onClose();
              Sound.playHapticPop();
            }}
            className="relative z-10 p-1.5 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors h-fit"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Profile Details Body */}
        <div className="px-5 pb-5 -mt-10 relative">
          {loading ? (
            <div className="py-14 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              <span>Loading developer profile...</span>
            </div>
          ) : !profile ? (
            <div className="py-8 text-center text-slate-400">User profile not found.</div>
          ) : (
            <div className="space-y-3.5">
              {/* Avatar & Partner Action */}
              <div className="flex items-end justify-between">
                <div className="relative">
                  <div className="w-18 h-18 rounded-full border-4 shadow-xl overflow-hidden bg-slate-800" style={{ borderColor: 'var(--ide-card-bg)' }}>
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-sky-600 flex items-center justify-center text-2xl font-bold text-white uppercase">
                        {profile.full_name?.charAt(0) || 'U'}
                      </div>
                    )}
                  </div>
                  <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                </div>

                {userId !== currentUserId && (
                  <div>
                    {partnerStatus === 'accepted' ? (
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Partner</span>
                      </span>
                    ) : partnerStatus === 'pending' ? (
                      <span className="text-[11px] font-medium text-amber-300 bg-amber-500/15 px-3 py-1.5 rounded-full border border-amber-500/30">
                        Request Pending
                      </span>
                    ) : (
                      <button
                        onClick={handleAddPartner}
                        disabled={sendingRequest}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-semibold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50"
                      >
                        {sendingRequest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                        <span>Add Partner</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Names & Headline */}
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--ide-text)' }}>
                  {profile.full_name || 'Developer'}
                </h3>
                <p className="font-mono text-xs opacity-60" style={{ color: 'var(--ide-text-muted)' }}>
                  @{profile.username || profile.email.split('@')[0]}
                </p>
                {profile.headline && (
                  <p className="text-xs text-sky-400 mt-1 font-medium">
                    {profile.headline}
                  </p>
                )}
              </div>

              {/* Bio Box */}
              {profile.bio && (
                <div 
                  className="p-3 rounded-xl border leading-relaxed text-xs"
                  style={{
                    backgroundColor: 'var(--ide-input-bg)',
                    borderColor: 'var(--ide-border)',
                    color: 'var(--ide-text)',
                  }}
                >
                  {profile.bio}
                </div>
              )}

              {/* Languages */}
              {profile.languages && profile.languages.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 opacity-60">
                    Languages
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.languages.map((l) => (
                      <span key={l} className="px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono text-[11px]">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {profile.skills && profile.skills.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 opacity-60">
                    Skills & Frameworks
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills.map((s) => (
                      <span key={s} className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px]">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Links */}
              <div className="pt-2 border-t flex items-center gap-4 text-xs opacity-80" style={{ borderColor: 'var(--ide-border)' }}>
                {profile.github_username && (
                  <a
                    href={`https://github.com/${profile.github_username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 hover:text-sky-400 transition-colors"
                  >
                    <Github className="w-3.5 h-3.5" />
                    <span>github.com/{profile.github_username}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                  </a>
                )}
                {profile.website_url && (
                  <a
                    href={profile.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 hover:text-sky-400 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Portfolio</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
