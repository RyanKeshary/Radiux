'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserProfile, Project, ContributionDay } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { useAuth } from '@/context/AuthContext';
import { ContributionGraph } from './ContributionGraph';
import { ProfileReadme } from './ProfileReadme';
import { PinnedProjectsSection } from './PinnedProjectsSection';
import { DirectMessageModal } from './DirectMessageModal';
import { ProfileEditorModal } from './ProfileEditorModal';
import { 
  MapPin, 
  GraduationCap, 
  Briefcase, 
  Globe, 
  Github, 
  Linkedin, 
  MessageSquare, 
  UserPlus, 
  Check, 
  Edit3, 
  Share2, 
  FolderGit2, 
  Users, 
  Shield, 
  ArrowLeft,
  Sparkles,
  CheckCheck
} from 'lucide-react';

interface DeveloperProfileViewProps {
  profile: UserProfile;
  initialPinnedProjects: Project[];
  allProjects?: Project[];
  contributions: {
    days: ContributionDay[];
    totalContributions: number;
    currentStreak: number;
    longestStreak: number;
  };
}

export function DeveloperProfileView({
  profile: initialProfile,
  initialPinnedProjects,
  allProjects = [],
  contributions,
}: DeveloperProfileViewProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [pinnedProjects, setPinnedProjects] = useState<Project[]>(initialPinnedProjects);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDirectMessageOpen, setIsDirectMessageOpen] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [partnerRequestId, setPartnerRequestId] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const isOwner = !!(user && user.id === profile.id);

  // Check coding partner status if viewing another developer
  useEffect(() => {
    if (!user || isOwner) return;
    DataService.getCodingPartners(user.id).then((partners) => {
      const match = partners.find(
        (p) => (p.requester_id === profile.id && p.receiver_id === user.id) ||
               (p.requester_id === user.id && p.receiver_id === profile.id)
      );
      if (match) {
        setPartnerStatus(match.status === 'accepted' ? 'accepted' : 'pending');
        setPartnerRequestId(match.id);
      }
    });
  }, [user, profile.id, isOwner]);

  const handleSendPartnerRequest = async () => {
    if (!user || partnerStatus !== 'none') return;
    try {
      await DataService.sendPartnerRequest(user, profile.id);
      setPartnerStatus('pending');
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdatePinned = async (projectIds: string[]) => {
    try {
      const updated = await DataService.updatePinnedProjects(profile.id, projectIds);
      setProfile(updated);
      const freshPinned = await DataService.getPinnedProjects(profile.id, user?.id);
      setPinnedProjects(freshPinned);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveReadme = async (markdown: string) => {
    try {
      const updated = await DataService.updateProfile(profile.id, { readme_markdown: markdown });
      setProfile(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyProfileUrl = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    }
  };

  const privacy = profile.privacy || {};

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--ide-bg)', color: 'var(--ide-text)' }}>
      {/* Top Navbar */}
      <header 
        className="h-12 px-4 md:px-8 border-b flex items-center justify-between select-none sticky top-0 z-30 backdrop-blur-md"
        style={{
          backgroundColor: 'var(--ide-card-bg)',
          borderColor: 'var(--ide-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded hover:opacity-80 transition-opacity"
            style={{ color: 'var(--ide-text-muted)' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Workspaces</span>
          </Link>
          <span className="text-neutral-500">/</span>
          <div className="flex items-center gap-2 font-semibold text-xs">
            <span className="text-sky-400">@{profile.username || profile.email.split('@')[0]}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyProfileUrl}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border hover:opacity-85 transition-opacity"
            style={{
              borderColor: 'var(--ide-border)',
              backgroundColor: 'var(--ide-dock-header)',
              color: 'var(--ide-text)',
            }}
            title="Share Profile Link"
          >
            {copiedUrl ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedUrl ? 'Copied Link' : 'Share'}</span>
          </button>
        </div>
      </header>

      {/* Profile Main Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 space-y-6">
        {/* 1. Developer Identity Card */}
        <div 
          className="p-6 rounded-2xl border shadow-sm relative overflow-hidden"
          style={{
            backgroundColor: 'var(--ide-card-bg)',
            borderColor: 'var(--ide-border)',
          }}
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Avatar with status indicator */}
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center text-2xl font-bold shadow-md ring-4 ring-white/10 overflow-hidden">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                  ) : (
                    profile.full_name?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <span 
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-[var(--ide-card-bg)]" 
                  title="Online on CodeCollab"
                />
              </div>

              {/* Identity Info */}
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--ide-text)' }}>
                    {profile.full_name}
                  </h1>
                  <span className="text-xs font-mono opacity-70">
                    @{profile.username || profile.email.split('@')[0]}
                  </span>
                </div>

                {profile.role && (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-sky-400">
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>{profile.role}</span>
                  </div>
                )}

                {/* Location & Education */}
                <div className="flex items-center gap-3 text-xs flex-wrap opacity-75 pt-0.5" style={{ color: 'var(--ide-text-muted)' }}>
                  {privacy.show_location !== false && profile.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {profile.location}
                    </span>
                  )}
                  {privacy.show_education !== false && profile.education && (
                    <span className="flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5" />
                      {profile.education}
                    </span>
                  )}
                </div>

                {/* Bio */}
                {profile.bio && (
                  <p className="text-xs leading-relaxed max-w-xl pt-1.5 opacity-90" style={{ color: 'var(--ide-text)' }}>
                    {profile.bio}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 self-stretch md:self-auto justify-end flex-wrap">
              {isOwner ? (
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg border hover:opacity-90 transition-opacity shadow-sm"
                  style={{
                    borderColor: 'var(--ide-border)',
                    backgroundColor: 'var(--ide-dock-header)',
                    color: 'var(--ide-text)',
                  }}
                >
                  <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setIsDirectMessageOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg border hover:opacity-90 transition-opacity"
                    style={{
                      borderColor: 'var(--ide-border)',
                      backgroundColor: 'var(--ide-dock-header)',
                      color: 'var(--ide-text)',
                    }}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                    <span>Message</span>
                  </button>

                  <button
                    onClick={handleSendPartnerRequest}
                    disabled={partnerStatus !== 'none'}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      partnerStatus === 'accepted'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : partnerStatus === 'pending'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'text-white shadow-sm hover:brightness-110'
                    }`}
                    style={{
                      backgroundColor: partnerStatus === 'none' ? 'var(--ide-accent)' : undefined,
                    }}
                  >
                    {partnerStatus === 'accepted' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Coding Partner</span>
                      </>
                    ) : partnerStatus === 'pending' ? (
                      <span>Request Pending</span>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add Partner</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* External Links & Skills Pills */}
          <div className="pt-4 mt-5 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs" style={{ borderColor: 'var(--ide-border)' }}>
            {/* Skills */}
            {privacy.show_skills !== false && profile.skills && profile.skills.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {profile.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md text-[11px] font-mono border"
                    style={{
                      borderColor: 'var(--ide-border)',
                      backgroundColor: 'var(--ide-dock-header)',
                      color: 'var(--ide-text-muted)',
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}

            {/* Links */}
            {privacy.show_links !== false && (
              <div className="flex items-center gap-3 text-xs flex-wrap">
                {profile.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-sky-400 hover:underline"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Website</span>
                  </a>
                )}
                {profile.github_username && (
                  <a
                    href={`https://github.com/${profile.github_username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 hover:underline"
                    style={{ color: 'var(--ide-text)' }}
                  >
                    <Github className="w-3.5 h-3.5" />
                    <span>GitHub</span>
                  </a>
                )}
                {profile.linkedin_url && (
                  <a
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-blue-400 hover:underline"
                  >
                    <Linkedin className="w-3.5 h-3.5" />
                    <span>LinkedIn</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2. Pinned Projects Showcase (Maximum 4) */}
        <PinnedProjectsSection
          pinnedProjects={pinnedProjects}
          allProjects={allProjects}
          isOwner={isOwner}
          onUpdatePinned={handleUpdatePinned}
        />

        {/* 3. Developer Contribution Graph (GitHub-Style 52-week grid) */}
        {privacy.show_activity !== false && (
          <ContributionGraph
            days={contributions.days}
            totalContributions={contributions.totalContributions}
            currentStreak={contributions.currentStreak}
            longestStreak={contributions.longestStreak}
          />
        )}

        {/* 4. Profile README */}
        {privacy.show_readme !== false && (
          <ProfileReadme
            initialMarkdown={profile.readme_markdown || ''}
            isOwner={isOwner}
            username={profile.username || profile.email.split('@')[0]}
            onSave={handleSaveReadme}
          />
        )}
      </main>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <ProfileEditorModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          currentUser={profile}
          onProfileUpdated={(updated) => {
            setProfile(updated);
          }}
        />
      )}

      {/* Direct Message Modal */}
      {isDirectMessageOpen && (
        <DirectMessageModal
          isOpen={isDirectMessageOpen}
          onClose={() => setIsDirectMessageOpen(false)}
          targetUser={profile}
        />
      )}
    </div>
  );
}
