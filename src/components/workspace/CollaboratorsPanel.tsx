'use client';

import React from 'react';
import { ProjectMember, VoicePeer } from '@/lib/types';
import { 
  Users, 
  UserPlus, 
  Mic, 
  MicOff, 
  FileCode, 
  ExternalLink,
  Shield,
  Circle
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';

interface CollaboratorStatus {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  color: string;
  currentFileId?: string | null;
  currentFileName?: string | null;
}

interface CollaboratorsPanelProps {
  members: ProjectMember[];
  onlinePeers: CollaboratorStatus[];
  voicePeers: VoicePeer[];
  isInVoice: boolean;
  onInviteClick: () => void;
  onSelectMemberProfile: (userId: string) => void;
  onJumpToFile: (fileId: string) => void;
}

export function CollaboratorsPanel({
  members,
  onlinePeers,
  voicePeers,
  isInVoice,
  onInviteClick,
  onSelectMemberProfile,
  onJumpToFile,
}: CollaboratorsPanelProps) {
  const { user } = useAuth();

  // Map online users by ID, email, and name for flexible lookup
  const onlineMap = new Map<string, CollaboratorStatus>();
  const onlineEmailMap = new Map<string, CollaboratorStatus>();
  const onlineNameMap = new Map<string, CollaboratorStatus>();

  onlinePeers.forEach(p => {
    if (p.id) onlineMap.set(p.id, p);
    if (p.email) onlineEmailMap.set(p.email.toLowerCase(), p);
    if (p.name) onlineNameMap.set(p.name.trim().toLowerCase(), p);
  });

  // Voice map
  const voiceMap = new Map<string, boolean>(); // userId -> isMuted
  voicePeers.forEach(vp => voiceMap.set(vp.userId, vp.isMuted));

  const onlineMembers: { member: ProjectMember; onlineData?: CollaboratorStatus }[] = [];
  const offlineMembers: ProjectMember[] = [];
  const matchedPeerIds = new Set<string>();

  members.forEach(m => {
    // Check if the current member is the currently logged-in user
    const isCurrentUser = Boolean(user && (m.user_id === user.id || (m.profile?.email && m.profile.email.toLowerCase() === user.email?.toLowerCase())));
    
    // Check if member matches any online peer
    let onlineData = onlineMap.get(m.user_id) || (m.id ? onlineMap.get(m.id) : undefined);
    if (!onlineData && m.profile?.email) {
      onlineData = onlineEmailMap.get(m.profile.email.toLowerCase());
    }
    if (!onlineData && m.profile?.full_name) {
      onlineData = onlineNameMap.get(m.profile.full_name.trim().toLowerCase());
    }

    if (onlineData || isCurrentUser) {
      if (onlineData) matchedPeerIds.add(onlineData.id);
      onlineMembers.push({ 
        member: m, 
        onlineData: onlineData || {
          id: m.user_id,
          name: m.profile?.full_name || user?.full_name || 'You',
          color: '#38bdf8',
        }
      });
    } else {
      offlineMembers.push(m);
    }
  });

  // Unmatched online peers (e.g. guests or users not in members table)
  const guestPeers = onlinePeers.filter(p => !matchedPeerIds.has(p.id) && p.id !== user?.id);

  return (
    <div 
      className="flex flex-col h-full select-none text-xs"
      style={{
        backgroundColor: 'var(--ide-sidebar)',
        color: 'var(--ide-text)',
      }}
    >
      {/* Panel Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 border-b text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex-shrink-0"
        style={{ borderColor: 'var(--ide-border)' }}
      >
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-sky-400" />
          <span>Collaborators ({members.length})</span>
        </div>

        <button
          onClick={onInviteClick}
          className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1 text-[11px] font-medium lowercase"
          title="Invite Teammate to Project"
        >
          <UserPlus className="w-3.5 h-3.5 text-sky-400" />
          <span>invite</span>
        </button>
      </div>

      {/* Member List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {/* Online Section */}
        <div>
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Online ({onlineMembers.length + guestPeers.length})</span>
          </div>

          <div className="mt-1 space-y-1">
            {onlineMembers.length === 0 && guestPeers.length === 0 ? (
              <div className="px-2 py-1.5 text-neutral-500 italic text-[11px]">No other collaborators online right now.</div>
            ) : (
              <>
                {onlineMembers.map(({ member, onlineData }) => {
                  const isUserInVoice = voiceMap.has(member.user_id);
                  const isUserMuted = voiceMap.get(member.user_id);

                  return (
                    <div
                      key={member.id}
                      className="flex flex-col gap-1 p-2 rounded hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 group"
                    >
                      <div className="flex items-center justify-between">
                        <div 
                          onClick={() => onSelectMemberProfile(member.user_id)}
                          className="flex items-center gap-2 cursor-pointer min-w-0 flex-1"
                          title="Click to view developer profile"
                        >
                          {member.profile?.avatar_url ? (
                            <img
                              src={member.profile.avatar_url}
                              alt=""
                              className="w-5 h-5 rounded-full ring-1 ring-emerald-500/50 object-cover"
                            />
                          ) : (
                            <div 
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white uppercase"
                              style={{ backgroundColor: onlineData?.color || '#38bdf8' }}
                            >
                              {(member.profile?.full_name || 'U').charAt(0)}
                            </div>
                          )}

                          <span className="truncate font-medium group-hover:text-sky-400 transition-colors" style={{ color: 'var(--ide-text)' }}>
                            {member.profile?.full_name || onlineData?.name || 'Anonymous Peer'}
                          </span>

                          {member.role === 'owner' && (
                            <span title="Project Owner">
                              <Shield className="w-3 h-3 text-amber-400 flex-shrink-0" />
                            </span>
                          )}
                        </div>

                        {/* Voice indicator */}
                        {isUserInVoice && (
                          <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            {isUserMuted ? <MicOff className="w-2.5 h-2.5 text-neutral-400" /> : <Mic className="w-2.5 h-2.5 animate-pulse" />}
                            <span>voice</span>
                          </div>
                        )}
                      </div>

                      {/* Active File indicator & Jump to file */}
                      {onlineData?.currentFileName && (
                        <div className="flex items-center justify-between pl-7 text-[11px]" style={{ color: 'var(--ide-text-muted)' }}>
                          <div className="flex items-center gap-1 truncate">
                            <FileCode className="w-3 h-3 text-sky-400 flex-shrink-0" />
                            <span className="truncate font-mono text-[10.5px]">{onlineData.currentFileName}</span>
                          </div>

                          {onlineData.currentFileId && (
                            <button
                              onClick={() => onJumpToFile(onlineData.currentFileId!)}
                              className="text-[10px] text-sky-400 hover:text-sky-200 hover:underline flex items-center gap-0.5 ml-2 flex-shrink-0"
                              title="Jump to active file"
                            >
                              <span>view</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Additional Guest / Active Peers */}
                {guestPeers.map((peer) => (
                  <div
                    key={peer.id}
                    className="flex flex-col gap-1 p-2 rounded hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div 
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white uppercase"
                          style={{ backgroundColor: peer.color || '#38bdf8' }}
                        >
                          {(peer.name || 'G').charAt(0)}
                        </div>
                        <span className="truncate font-medium" style={{ color: 'var(--ide-text)' }}>
                          {peer.name || 'Active Collaborator'}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          guest
                        </span>
                      </div>
                    </div>

                    {peer.currentFileName && (
                      <div className="flex items-center justify-between pl-7 text-[11px]" style={{ color: 'var(--ide-text-muted)' }}>
                        <div className="flex items-center gap-1 truncate">
                          <FileCode className="w-3 h-3 text-sky-400 flex-shrink-0" />
                          <span className="truncate font-mono text-[10.5px]">{peer.currentFileName}</span>
                        </div>
                        {peer.currentFileId && (
                          <button
                            onClick={() => onJumpToFile(peer.currentFileId!)}
                            className="text-[10px] text-sky-400 hover:text-sky-200 hover:underline flex items-center gap-0.5 ml-2 flex-shrink-0"
                            title="Jump to active file"
                          >
                            <span>view</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Offline Section */}
        <div>
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ide-text-muted)' }}>
            <Circle className="w-1.5 h-1.5 opacity-60" />
            <span>Offline ({offlineMembers.length})</span>
          </div>

          <div className="mt-1 space-y-1">
            {offlineMembers.map((member) => (
              <div
                key={member.id}
                onClick={() => onSelectMemberProfile(member.user_id)}
                style={{ color: 'var(--ide-text-muted)' }}
                className="flex items-center gap-2 p-2 rounded hover:bg-white/5 cursor-pointer transition-colors"
                title="Click to view developer profile"
              >
                {member.profile?.avatar_url ? (
                  <img
                    src={member.profile.avatar_url}
                    alt=""
                    className="w-5 h-5 rounded-full opacity-60 object-cover"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-neutral-700 flex items-center justify-center text-[9px] font-bold text-neutral-300 uppercase">
                    {(member.profile?.full_name || 'U').charAt(0)}
                  </div>
                )}

                <span className="truncate flex-1">{member.profile?.full_name || 'Teammate'}</span>

                {member.role === 'owner' && (
                  <span title="Project Owner">
                    <Shield className="w-3 h-3 opacity-60" />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
