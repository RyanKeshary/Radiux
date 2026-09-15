'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile, CodingPartner } from '@/lib/types';
import { DataService } from '@/lib/data-service';
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
  Loader2
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
    const currentUser = await DataService.getProfile(currentUserId);
    if (currentUser) {
      const res = await DataService.sendPartnerRequest(currentUser, profile.email);
      if (res.success) {
        setPartnerStatus('pending');
      }
    }
    setSendingRequest(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in select-none">
      <div 
        className="w-full max-w-md rounded-xl shadow-2xl border flex flex-col overflow-hidden text-xs"
        style={{
          backgroundColor: 'var(--ide-card-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
      >
        {/* Header */}
        <div 
          className="h-24 bg-gradient-to-r from-sky-600/40 via-indigo-600/30 to-purple-600/30 relative flex justify-end p-3"
        >
          <button
            onClick={onClose}
            className="p-1 rounded-full bg-black/40 hover:bg-black/70 text-neutral-300 hover:text-white transition-colors h-fit"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Card Body */}
        <div className="px-5 pb-5 -mt-10 relative">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-400">
              <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
              <span>Loading developer profile...</span>
            </div>
          ) : !profile ? (
            <div className="py-8 text-center text-neutral-400">User profile not found.</div>
          ) : (
            <div className="space-y-4">
              {/* Avatar & User Details */}
              <div className="flex items-end justify-between">
                <div className="relative">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      style={{
                        borderColor: 'var(--ide-border)',
                      }}
                      className="w-16 h-16 rounded-full border-2 object-cover bg-black"
                    />
                  ) : (
                    <div
                      style={{
                        borderColor: 'var(--ide-border)',
                      }}
                      className="w-16 h-16 rounded-full border-2 bg-sky-600 flex items-center justify-center text-xl font-bold text-white uppercase"
                    >
                      {profile.full_name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-black/40" />
                </div>

                {/* Primary Action Button */}
                {userId !== currentUserId && (
                  <div>
                    {partnerStatus === 'accepted' ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Coding Partner</span>
                      </span>
                    ) : partnerStatus === 'pending' ? (
                      <span className="text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                        Request Pending
                      </span>
                    ) : (
                      <button
                        onClick={handleAddPartner}
                        disabled={sendingRequest}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-md font-medium transition-colors shadow-sm disabled:opacity-50"
                      >
                        {sendingRequest ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="w-3.5 h-3.5" />
                        )}
                        <span>Add Partner</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Names */}
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--ide-text)' }}>{profile.full_name || 'Developer'}</h3>
                <p className="font-mono text-[11px]" style={{ color: 'var(--ide-text-muted)' }}>@{profile.username || profile.email.split('@')[0]}</p>
              </div>

              {/* Bio */}
              {profile.bio && (
                <p
                  style={{
                    backgroundColor: 'var(--ide-input-bg)',
                    borderColor: 'var(--ide-border)',
                    color: 'var(--ide-text)',
                  }}
                  className="leading-relaxed text-[11.5px] p-2.5 rounded-md border"
                >
                  {profile.bio}
                </p>
              )}

              {/* Programming Languages */}
              {profile.languages && profile.languages.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--ide-text-muted)' }}>
                    <Code2 className="w-3 h-3 text-sky-400" />
                    <span>Languages</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {profile.languages.map((lang) => (
                      <span
                        key={lang}
                        className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono text-[10.5px]"
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {profile.skills && profile.skills.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--ide-text-muted)' }}>
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    <span>Skills & Frameworks</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {profile.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10.5px]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* External Links & Secondary Actions */}
              <div className="pt-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--ide-border)' }}>
                {profile.github_username ? (
                  <a
                    href={`https://github.com/${profile.github_username}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--ide-text-muted)' }}
                    className="flex items-center gap-1 hover:opacity-80 transition-colors"
                  >
                    <Github className="w-3.5 h-3.5" />
                    <span>github.com/{profile.github_username}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>
                ) : <span />}

                {onInviteToProject && userId !== currentUserId && (
                  <button
                    onClick={() => {
                      onClose();
                      onInviteToProject();
                    }}
                    className="flex items-center gap-1 text-sky-400 hover:text-sky-300 hover:underline font-medium"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Invite to Project</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
