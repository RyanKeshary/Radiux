'use client';

import React, { useState } from 'react';
import { Project, ProjectMember, UserProfile } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { DEMO_USERS } from '@/lib/storage-mock';
import { UserPlus, X, Check, Copy, Shield, ShieldCheck } from 'lucide-react';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  members: ProjectMember[];
  onMemberAdded: (member: ProjectMember) => void;
}

export function InviteMemberModal({
  isOpen,
  onClose,
  project,
  members,
  onMemberAdded,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddCollaborator = async (targetUser: UserProfile) => {
    setLoading(true);
    try {
      const added = await DataService.addMember(project.id, targetUser);
      onMemberAdded(added);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    const mockProfile: UserProfile = {
      id: 'user-' + Math.random().toString(36).substring(2, 9),
      email: email.trim(),
      full_name: email.split('@')[0],
      avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${email}`
    };

    await handleAddCollaborator(mockProfile);
    setEmail('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl p-6 text-[#cccccc]">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#3c3c3c]">
          <div className="flex items-center gap-2 text-white font-semibold text-base">
            <UserPlus className="w-5 h-5 text-sky-400" />
            <span>Collaborate on {project.name}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-[#333333]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Share Link Section */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">
            Shareable Workspace Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={typeof window !== 'undefined' ? window.location.href : ''}
              className="flex-1 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg px-3 py-2 text-xs text-neutral-300 select-all outline-none"
            />
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#333333] hover:bg-[#3e3e3e] text-white rounded-lg text-xs font-medium transition-colors border border-[#444444]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Add User form */}
        <form onSubmit={handleInviteCustom} className="mb-6">
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">
            Add Collaborator by Email
          </label>
          <div className="flex items-center gap-2">
            <input
              type="email"
              placeholder="e.g. bob@codecollab.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
            >
              Add Member
            </button>
          </div>
        </form>

        {/* Quick add demo collaborators */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-neutral-400 mb-2">
            Quick Add Demo Developers:
          </label>
          <div className="space-y-1.5">
            {DEMO_USERS.map((demo) => {
              const isAlreadyMember = members.some((m) => m.user_id === demo.id);
              return (
                <div
                  key={demo.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-[#1e1e1e] border border-[#333333] text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center font-bold text-[10px] text-white">
                      {demo.full_name[0]}
                    </div>
                    <div>
                      <div className="font-medium text-white">{demo.full_name}</div>
                      <div className="text-[10px] text-neutral-400">{demo.email}</div>
                    </div>
                  </div>

                  {isAlreadyMember ? (
                    <span className="text-[10px] text-emerald-400 font-medium px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                      Already in project
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAddCollaborator(demo)}
                      disabled={loading}
                      className="px-2.5 py-1 bg-[#333333] hover:bg-sky-600 hover:text-white text-neutral-300 rounded text-[11px] font-medium transition-colors"
                    >
                      + Grant Access
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Members List */}
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-2">
            Current Project Members ({members.length})
          </label>
          <div className="max-h-36 overflow-y-auto space-y-1">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#1e1e1e]/60 text-xs"
              >
                <span className="text-white font-medium">
                  {m.profile?.full_name || m.user_id}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300 capitalize">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
