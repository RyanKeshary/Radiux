'use client';

import React, { useState } from 'react';
import { Project, ProjectMember, UserProfile } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { useAuth } from '@/context/AuthContext';
import { config } from '@/lib/config';
import { UserPlus, X, Check, Copy, Shield, Trash2, Search, AlertCircle, Loader2 } from 'lucide-react';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  members: ProjectMember[];
  onMemberAdded: (member: ProjectMember) => void;
  onMemberRemoved: (userId: string) => void;
  onRoleChanged?: (userId: string, newRole: 'editor' | 'visitor') => void;
}

export function InviteMemberModal({
  isOpen,
  onClose,
  project,
  members,
  onMemberAdded,
  onMemberRemoved,
  onRoleChanged,
}: InviteMemberModalProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<'editor' | 'visitor'>('editor');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const isOwner = project.owner_id === user?.id;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setSearchError('');
    setSuccessMsg('');

    try {
      // 1. Find user by email in Supabase profiles
      const targetUser = await DataService.findUserByEmail(email.trim());
      if (!targetUser) {
        setSearchError('No registered user found with that email. Make sure they have created an account first.');
        setLoading(false);
        return;
      }

      // 2. Check if already member
      if (members.some(m => m.user_id === targetUser.id)) {
        setSearchError('This user is already a member of this project.');
        setLoading(false);
        return;
      }

      // 3. Add to project with selected role
      const added = await DataService.addMember(project.id, targetUser, selectedRole);
      onMemberAdded(added);

      // 4. Send persistent actionable notification to invited user
      try {
        const { NotificationService } = await import('@/lib/notifications/notification-service');
        await NotificationService.sendNotification({
          recipient_id: targetUser.id,
          actor_id: user?.id,
          actor_name: user?.full_name || 'Project Owner',
          project_id: project.id,
          project_name: project.name,
          type: 'action',
          category: 'project_invitation',
          title: `Invited to ${project.name}`,
          body: `${user?.full_name || 'A teammate'} invited you to join "${project.name}" as ${selectedRole === 'visitor' ? 'a Visitor (Read-only)' : 'an Editor'}.`,
          metadata: {
            dedup_key: `invite:${project.id}:${targetUser.id}`,
            role: selectedRole,
            projectId: project.id,
            projectName: project.name,
            senderEmail: user?.email,
          },
          action_state: 'pending',
        });
      } catch (e) {
        console.warn('Could not send notification:', e);
      }

      setSuccessMsg(`Successfully added ${targetUser.full_name} (${targetUser.email}) as ${selectedRole}!`);
      setEmail('');
    } catch (err: any) {
      setSearchError(err.message || 'Failed to add collaborator.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'editor' | 'visitor') => {
    try {
      await DataService.updateMemberRole(project.id, userId, newRole);
      if (onRoleChanged) {
        onRoleChanged(userId, newRole);
      }
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this collaborator?')) return;
    try {
      await DataService.removeMember(project.id, userId);
      onMemberRemoved(userId);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div 
        style={{
          backgroundColor: 'var(--ide-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
        className="w-full max-w-md border rounded-xl shadow-2xl p-6"
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: 'var(--ide-border)' }}>
          <div className="flex items-center gap-2 font-semibold text-base" style={{ color: 'var(--ide-text)' }}>
            <UserPlus className="w-5 h-5 text-sky-400" />
            <span>Project Collaborators & Roles</span>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--ide-text-muted)' }}
            className="p-1 rounded hover:bg-white/[0.07] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Share Link */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ide-text)' }}>
            Share Workspace Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={typeof window !== 'undefined' ? window.location.href : ''}
              style={{
                backgroundColor: 'var(--ide-input-bg)',
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text-muted)',
              }}
              className="w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.08] hover:bg-white/[0.14] rounded-lg text-xs font-medium transition-colors flex-shrink-0"
              style={{ color: 'var(--ide-text)' }}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Add User form (Only Owner can invite) */}
        {isOwner ? (
          <form onSubmit={handleInviteUser} className="mb-5 space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ide-text)' }}>
                Add Registered Collaborator by Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="collaborator@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    backgroundColor: 'var(--ide-input-bg)',
                    borderColor: 'var(--ide-border)',
                    color: 'var(--ide-text)',
                  }}
                  className="w-full border rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-sky-500"
                />
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5" style={{ color: 'var(--ide-text-muted)' }} />
              </div>
            </div>

            {/* Role Selector: Editor vs Visitor */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ide-text)' }}>
                Collaborator Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`flex flex-col p-2.5 rounded-lg border cursor-pointer transition-all ${
                    selectedRole === 'editor'
                      ? 'border-sky-500 bg-sky-500/10 text-white'
                      : 'border-white/[0.08] bg-white/[0.02] text-neutral-400 hover:border-white/[0.16]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">Editor</span>
                    <input
                      type="radio"
                      name="inviteRole"
                      value="editor"
                      checked={selectedRole === 'editor'}
                      onChange={() => setSelectedRole('editor')}
                      className="accent-sky-500"
                    />
                  </div>
                  <span className="text-[10px] leading-tight text-neutral-400">
                    Edit code, run terminal, Git, and Zodiac AI.
                  </span>
                </label>

                <label
                  className={`flex flex-col p-2.5 rounded-lg border cursor-pointer transition-all ${
                    selectedRole === 'visitor'
                      ? 'border-sky-500 bg-sky-500/10 text-white'
                      : 'border-white/[0.08] bg-white/[0.02] text-neutral-400 hover:border-white/[0.16]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">Visitor</span>
                    <input
                      type="radio"
                      name="inviteRole"
                      value="visitor"
                      checked={selectedRole === 'visitor'}
                      onChange={() => setSelectedRole('visitor')}
                      className="accent-sky-500"
                    />
                  </div>
                  <span className="text-[10px] leading-tight text-neutral-400">
                    Read-only code viewing and team chat.
                  </span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Send Invitation & Add</span>
            </button>

            {searchError && (
              <div className="mt-2 flex items-center gap-1.5 text-rose-400 text-xs">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{searchError}</span>
              </div>
            )}

            {successMsg && (
              <div className="mt-2 flex items-center gap-1.5 text-emerald-400 text-xs">
                <Check className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
          </form>
        ) : (
          <div className="mb-5 p-2.5 rounded bg-sky-500/10 border border-sky-500/20 text-xs text-sky-300">
            You are a project collaborator. Only the project owner can invite or remove members.
          </div>
        )}

        {/* Current Members List */}
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: 'var(--ide-text)' }}>
            Project Members ({members.length})
          </label>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {members.map((m) => {
              const isMemberOwner = m.role === 'owner' || m.user_id === project.owner_id;
              const name = m.profile?.full_name || m.user_id;
              const memberEmail = m.profile?.email || '';
              const currentRole = m.role === 'visitor' ? 'visitor' : isMemberOwner ? 'owner' : 'editor';

              return (
                <div
                  key={m.id}
                  style={{
                    backgroundColor: 'var(--ide-card-bg)',
                    borderColor: 'var(--ide-border)',
                  }}
                  className="flex items-center justify-between p-2 rounded-lg border text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-800 flex items-center justify-center font-bold text-[10px] text-white">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-1.5" style={{ color: 'var(--ide-text)' }}>
                        <span>{name}</span>
                        {isMemberOwner && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Owner
                          </span>
                        )}
                      </div>
                      {memberEmail && (
                        <div className="text-[10px]" style={{ color: 'var(--ide-text-muted)' }}>{memberEmail}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Role dropdown for Owner */}
                    {isOwner && !isMemberOwner ? (
                      <select
                        value={currentRole}
                        onChange={(e) => handleRoleChange(m.user_id, e.target.value as 'editor' | 'visitor')}
                        className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.1] text-neutral-200 focus:outline-none"
                      >
                        <option value="editor">Editor</option>
                        <option value="visitor">Visitor</option>
                      </select>
                    ) : (
                      !isMemberOwner && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-neutral-400 capitalize">
                          {currentRole}
                        </span>
                      )
                    )}

                    {isOwner && !isMemberOwner && (
                      <button
                        onClick={() => handleRemove(m.user_id)}
                        title="Remove member"
                        className="p-1 rounded text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
