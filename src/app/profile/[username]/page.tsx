'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { UserProfile, Project, ContributionDay } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { useAuth } from '@/context/AuthContext';
import { DeveloperProfileView } from '@/components/profile/DeveloperProfileView';
import { Loader2, UserX, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pinnedProjects, setPinnedProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [contributions, setContributions] = useState<{
    days: ContributionDay[];
    totalContributions: number;
    currentStreak: number;
    longestStreak: number;
  }>({
    days: [],
    totalContributions: 0,
    currentStreak: 0,
    longestStreak: 0,
  });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const usernameParam = (params?.username as string) || '';

  useEffect(() => {
    if (!usernameParam) return;
    const loadProfileData = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const cleanIdentifier = decodeURIComponent(usernameParam).replace(/^@/, '');
        let targetProfile = await DataService.getPublicProfile(cleanIdentifier, user?.id);
        if (!targetProfile && user) {
          const userMatches = 
            user.id === cleanIdentifier ||
            user.username?.toLowerCase() === cleanIdentifier.toLowerCase() ||
            user.email?.split('@')[0].toLowerCase() === cleanIdentifier.toLowerCase();
          if (userMatches) {
            targetProfile = user;
          }
        }

        if (!targetProfile) {
          setNotFound(true);
          return;
        }

        setProfile(targetProfile);

        // Fetch pinned projects, all projects, and contributions in parallel
        const [pinned, projects, contribs] = await Promise.all([
          DataService.getPinnedProjects(targetProfile.id, user?.id),
          DataService.getProjects(targetProfile.id),
          DataService.getDeveloperContributions(targetProfile.id),
        ]);

        setPinnedProjects(pinned);
        setAllProjects(projects);
        setContributions(contribs);
      } catch (err) {
        console.error('Failed to load profile:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, [usernameParam, user?.id]);

  if (loading || authLoading) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center gap-3 text-xs"
        style={{ backgroundColor: 'var(--ide-bg)', color: 'var(--ide-text)' }}
      >
        <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
        <span className="font-medium opacity-75">Loading developer profile...</span>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
        style={{ backgroundColor: 'var(--ide-bg)', color: 'var(--ide-text)' }}
      >
        <div 
          className="p-8 rounded-2xl border max-w-md w-full space-y-4 shadow-sm"
          style={{
            backgroundColor: 'var(--ide-card-bg)',
            borderColor: 'var(--ide-border)',
          }}
        >
          <UserX className="w-12 h-12 text-neutral-500 mx-auto opacity-50" />
          <h2 className="text-base font-bold">Developer Not Found</h2>
          <p className="text-xs" style={{ color: 'var(--ide-text-muted)' }}>
            We could not find a developer profile matching &quot;{usernameParam}&quot;. The username might have changed or does not exist.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white rounded-lg transition-colors shadow-sm"
              style={{ backgroundColor: 'var(--ide-accent)' }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Workspaces</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DeveloperProfileView
      profile={profile}
      initialPinnedProjects={pinnedProjects}
      allProjects={allProjects}
      contributions={contributions}
    />
  );
}
