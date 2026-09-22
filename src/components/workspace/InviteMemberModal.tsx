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
}

export function InviteMemberModal({
  isOpen,
  onClose,
  project,
  members,
  onMemberAdded,
  onMemberRemoved,
}: InviteMemberModalProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
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

      // 3. Add to project
      const added = await DataService.addMember(project.id, targetUser);
      onMemberAdded(added);



      setSuccessMsg(`Successfully added ${targetUser.full_name} (${targetUser.email}) to the project!`);
      setEmail('');
    } catch (err: any) {
      setSearchError(err.message || 'Failed to add collaborator.');
    } finally {
      setLoading(false);
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
            <span>Project Collaborators</span>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--ide-text-muted)' }}
            className="p-1 rounded hover:opacity-80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Share Link Section */}
        <div className="mb-5">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ide-text-muted)' }}>
            Shareable Project URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={typeof window !== 'undefined' ? window.location.href : ''}
              style={{
                backgroundColor: 'var(--ide-input-bg)',
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text)',
              }}
              className="flex-1 border rounded-lg px-3 py-2 text-xs select-all outline-none font-mono"
            />
            <button
              onClick={handleCopyLink}
              style={{
                backgroundColor: 'var(--ide-input-bg)',
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text)',
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border hover:opacity-90"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <p className="text-[11px] mt-1" style={{ color: 'var(--ide-text-muted)' }}>
            Note: Only added members can access this project link.
          </p>
        </div>

        {/* Add User form (Only Owner can invite) */}
        {isOwner ? (
          <form onSubmit={handleInviteUser} className="mb-5">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ide-text)' }}>
              Add Registered Collaborator by Email
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
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
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Add Member</span>
              </button>
            </div>

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
            You are a project member. Only the project owner can invite or remove members.
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
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
