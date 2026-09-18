'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { StorageMock } from '@/lib/storage-mock';
import { normalizeOAuthUser } from '@/lib/supabase/profile-utils';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isSupabase: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: any }>;
  signUpWithPassword: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ error: any }>;
  linkIdentity: (provider: 'google' | 'github') => Promise<{ error: any }>;
  unlinkIdentity: (identity: any) => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateCurrentUserProfile: (updates: Partial<UserProfile>) => Promise<UserProfile>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync Supabase user profile
  const syncProfile = async (sessionUser: any) => {
    if (!sessionUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      // 1. Normalize OAuth / user metadata safely
      const normalized = normalizeOAuthUser(sessionUser);

      // 2. Fetch existing profile from database
      let profile: any = null;
      try {
        const { data } = await supabase!
          .from('profiles')
          .select('*')
          .eq('id', sessionUser.id)
          .maybeSingle();
        profile = data;
      } catch (err) {}

      const mockProfile = StorageMock.getProfile(sessionUser.id);

      // 3. Fallback resolution: DB custom value > normalized OAuth > mock fallback
      const fullName = profile?.full_name || profile?.display_name || mockProfile?.full_name || normalized.full_name;
      const displayName = profile?.display_name || profile?.full_name || mockProfile?.display_name || normalized.display_name;
      const avatarUrl = profile?.avatar_url || mockProfile?.avatar_url || normalized.avatar_url;
      const username = profile?.username || mockProfile?.username || normalized.username;
      const githubUser = profile?.github_username || mockProfile?.github_username || normalized.github_username;

      const mergedUser: UserProfile = {
        id: sessionUser.id,
        email: sessionUser.email || profile?.email || mockProfile?.email || normalized.email,
        full_name: fullName,
        display_name: displayName,
        avatar_url: avatarUrl,
        username: username,
        github_username: githubUser,
        bio: profile?.bio !== undefined ? profile.bio : (mockProfile?.bio || ''),
        role: profile?.role || mockProfile?.role || 'Developer',
        location: profile?.location || mockProfile?.location || '',
        education: profile?.education || mockProfile?.education || '',
        skills: profile?.skills || mockProfile?.skills || ['TypeScript', 'React', 'Node.js'],
        technologies: profile?.technologies || mockProfile?.technologies || ['React', 'Next.js', 'Node.js'],
        languages: profile?.languages || mockProfile?.languages || ['JavaScript', 'TypeScript'],
        website: profile?.website || mockProfile?.website || '',
        linkedin_url: profile?.linkedin_url || mockProfile?.linkedin_url || '',
        other_links: profile?.other_links || mockProfile?.other_links || [],
        collaboration_interests: profile?.collaboration_interests || mockProfile?.collaboration_interests || [],
        readme_markdown: profile?.readme_markdown || mockProfile?.readme_markdown || '',
        pinned_project_ids: profile?.pinned_project_ids || mockProfile?.pinned_project_ids || [],
        privacy: profile?.privacy || mockProfile?.privacy || {},
        provider: normalized.provider,
        providers: normalized.providers,
        identities: sessionUser.identities || [],
        created_at: profile?.created_at || sessionUser.created_at,
        updated_at: profile?.updated_at || sessionUser.updated_at,
      };

      StorageMock.updateProfile(sessionUser.id, mergedUser);
      setUser(mergedUser);

      // 4. If row does not exist in DB, create it with upsert
      if (!profile) {
        await supabase!.from('profiles').upsert([{
          id: sessionUser.id,
          email: mergedUser.email,
          full_name: mergedUser.full_name,
          display_name: mergedUser.display_name,
          avatar_url: mergedUser.avatar_url,
          username: mergedUser.username,
          github_username: mergedUser.github_username,
          bio: mergedUser.bio,
          role: mergedUser.role,
          location: mergedUser.location,
          education: mergedUser.education,
          skills: mergedUser.skills,
          languages: mergedUser.languages,
          technologies: mergedUser.technologies,
          website: mergedUser.website,
          linkedin_url: mergedUser.linkedin_url,
          other_links: mergedUser.other_links,
          collaboration_interests: mergedUser.collaboration_interests,
          readme_markdown: mergedUser.readme_markdown,
          pinned_project_ids: mergedUser.pinned_project_ids,
          privacy: mergedUser.privacy,
          created_at: mergedUser.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);
      }
    } catch (e) {
      console.error('Error fetching user profile:', e);
      const normalized = normalizeOAuthUser(sessionUser);
      const mockProfile = StorageMock.getProfile(sessionUser.id);
      setUser(mockProfile || {
        id: sessionUser.id,
        email: sessionUser.email || '',
        full_name: normalized.full_name,
        display_name: normalized.display_name,
        avatar_url: normalized.avatar_url,
        username: normalized.username,
        github_username: normalized.github_username,
        provider: normalized.provider,
        providers: normalized.providers,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    // 1. Initial user/session verification using getUser() as authoritative source of truth
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (user && !error) {
        syncProfile(user);
      } else {
        // Fall back to getSession if getUser is temporarily pending
        supabase!.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            syncProfile(session.user);
          } else {
            setLoading(false);
          }
        });
      }
    });

    // 2. Listen to auth state transitions (sign in, sign out, token refresh)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await syncProfile(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: new Error('Supabase is not configured') };
    }
    const res = await supabase.auth.signInWithPassword({ email, password });
    if (res.data.user) {
      await syncProfile(res.data.user);
    }
    return { error: res.error };
  };

  const signUpWithPassword = async (email: string, password: string, fullName: string) => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: new Error('Supabase is not configured') };
    }
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : 'http://localhost:3000/auth/callback';

    const res = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, display_name: fullName },
        emailRedirectTo: redirectTo,
      },
    });

    if (res.data.user) {
      await supabase!.from('profiles').upsert([{
        id: res.data.user.id,
        email: res.data.user.email,
        full_name: fullName,
        display_name: fullName,
        updated_at: new Date().toISOString(),
      }]);
      await syncProfile(res.data.user);
    }
    return { error: res.error };
  };

  /**
   * OAuth sign-in with Google or GitHub.
   * Strictly uses window.location.origin to support localhost and production dynamically.
   */
  const signInWithOAuth = async (provider: 'google' | 'github') => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: new Error('Supabase is not configured') };
    }
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : 'http://localhost:3000/auth/callback';

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    });
    return { error };
  };

  /**
   * Link an additional OAuth identity (Google or GitHub) to the current account.
   */
  const linkIdentity = async (provider: 'google' | 'github') => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: new Error('Supabase is not configured') };
    }
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : 'http://localhost:3000/auth/callback';

    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: {
        redirectTo,
      },
    });
    return { error };
  };

  /**
   * Unlink an OAuth identity from the current account.
   */
  const unlinkIdentity = async (identity: any) => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: new Error('Supabase is not configured') };
    }
    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await syncProfile(user);
      }
    }
    return { error };
  };

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: new Error('Supabase is not configured') };
    }
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback?type=recovery`
      : 'http://localhost:3000/auth/callback?type=recovery';

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error };
  };

  const signOut = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    if (typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/project/') && !window.location.pathname.endsWith('/public')) {
        window.location.href = '/';
      }
    }
  };

  const updateCurrentUserProfile = async (updates: Partial<UserProfile>): Promise<UserProfile> => {
    if (!user) throw new Error('No authenticated user');

    const merged = { ...user, ...updates };

    // 1. Update StorageMock immediately for local consistency
    StorageMock.updateProfile(user.id, merged);
    setUser(merged);

    if (isSupabaseConfigured && supabase) {
      try {
        // 2. Update profiles table
        await supabase
          .from('profiles')
          .update({
            full_name: merged.full_name,
            display_name: merged.display_name || merged.full_name,
            avatar_url: merged.avatar_url,
            username: merged.username,
            bio: merged.bio,
            github_username: merged.github_username,
            role: merged.role,
            location: merged.location,
            education: merged.education,
            skills: merged.skills,
            languages: merged.languages,
            technologies: merged.technologies,
            website: merged.website,
            linkedin_url: merged.linkedin_url,
            other_links: merged.other_links,
            collaboration_interests: merged.collaboration_interests,
            readme_markdown: merged.readme_markdown,
            pinned_project_ids: merged.pinned_project_ids,
            privacy: merged.privacy,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        // 3. Persist profile fields as Supabase auth user_metadata
        const metaUpdates: Record<string, any> = {};
        const metaFields = [
          'username', 'bio', 'role', 'location', 'education',
          'skills', 'languages', 'technologies', 'website',
          'github_username', 'linkedin_url', 'other_links',
          'collaboration_interests', 'readme_markdown',
          'pinned_project_ids', 'privacy', 'preferences', 'avatar_url', 'full_name', 'display_name'
        ];
        metaFields.forEach((key) => {
          if ((updates as any)[key] !== undefined) {
            metaUpdates[key] = (updates as any)[key];
          }
        });
        if (Object.keys(metaUpdates).length > 0) {
          await supabase.auth.updateUser({ data: metaUpdates });
        }
      } catch (e) {
        console.warn('updateCurrentUserProfile: Supabase update partial failure:', e);
      }
    }

    return merged;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isSupabase: isSupabaseConfigured,
        signInWithPassword,
        signUpWithPassword,
        signInWithOAuth,
        linkIdentity,
        unlinkIdentity,
        resetPassword,
        signOut,
        updateCurrentUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
