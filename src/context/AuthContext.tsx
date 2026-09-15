'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { APP_URL } from '@/lib/config';
import { StorageMock } from '@/lib/storage-mock';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isSupabase: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: any }>;
  signUpWithPassword: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ error: any }>;
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
      let profile: any = null;
      try {
        const { data } = await supabase!
          .from('profiles')
          .select('*')
          .eq('id', sessionUser.id)
          .single();
        profile = data;
      } catch (err) {}

      const metadata = sessionUser.user_metadata || {};
      const mockProfile = StorageMock.getProfile(sessionUser.id);

      const fullName = profile?.full_name || metadata.full_name || metadata.name || mockProfile?.full_name || sessionUser.email?.split('@')[0] || 'User';
      const avatarUrl = profile?.avatar_url || metadata.avatar_url || metadata.picture || mockProfile?.avatar_url || '';
      const username = metadata.username || mockProfile?.username || profile?.username || sessionUser.email?.split('@')[0];

      const mergedUser: UserProfile = {
        id: sessionUser.id,
        email: sessionUser.email || profile?.email || mockProfile?.email || '',
        full_name: fullName,
        avatar_url: avatarUrl,
        username: username,
        bio: metadata.bio !== undefined ? metadata.bio : (mockProfile?.bio || ''),
        role: metadata.role !== undefined ? metadata.role : (mockProfile?.role || 'Developer'),
        location: metadata.location !== undefined ? metadata.location : (mockProfile?.location || ''),
        education: metadata.education !== undefined ? metadata.education : (mockProfile?.education || ''),
        skills: metadata.skills || mockProfile?.skills || ['TypeScript', 'React', 'Node.js'],
        technologies: metadata.technologies || mockProfile?.technologies || ['React', 'Next.js', 'Node.js'],
        languages: metadata.languages || mockProfile?.languages || ['JavaScript', 'TypeScript'],
        website: metadata.website !== undefined ? metadata.website : (mockProfile?.website || ''),
        github_username: metadata.github_username !== undefined ? metadata.github_username : (mockProfile?.github_username || ''),
        linkedin_url: metadata.linkedin_url !== undefined ? metadata.linkedin_url : (mockProfile?.linkedin_url || ''),
        other_links: metadata.other_links || mockProfile?.other_links || [],
        collaboration_interests: metadata.collaboration_interests || mockProfile?.collaboration_interests || [],
        readme_markdown: metadata.readme_markdown !== undefined ? metadata.readme_markdown : (mockProfile?.readme_markdown || ''),
        pinned_project_ids: metadata.pinned_project_ids || mockProfile?.pinned_project_ids || [],
        privacy: metadata.privacy || mockProfile?.privacy || {},
      };

      StorageMock.updateProfile(sessionUser.id, mergedUser);
      setUser(mergedUser);

      if (!profile) {
        // Ensure profile row exists (upsert handles OAuth + email sign-ups)
        // Include all extended fields now that the schema has them
        await supabase!.from('profiles').upsert([{
          id: sessionUser.id,
          email: sessionUser.email || '',
          full_name: fullName,
          avatar_url: avatarUrl,
          username: mergedUser.username,
          bio: mergedUser.bio,
          role: mergedUser.role,
          location: mergedUser.location,
          education: mergedUser.education,
          skills: mergedUser.skills,
          languages: mergedUser.languages,
          technologies: mergedUser.technologies,
          website: mergedUser.website,
          github_username: mergedUser.github_username,
          linkedin_url: mergedUser.linkedin_url,
          other_links: mergedUser.other_links,
          collaboration_interests: mergedUser.collaboration_interests,
          readme_markdown: mergedUser.readme_markdown,
          pinned_project_ids: mergedUser.pinned_project_ids,
          privacy: mergedUser.privacy,
        }]);
      }
    } catch (e) {
      console.error('Error fetching user profile:', e);
      const mockProfile = StorageMock.getProfile(sessionUser.id);
      setUser(mockProfile || {
        id: sessionUser.id,
        email: sessionUser.email || '',
        full_name: sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || 'User',
        avatar_url: sessionUser.user_metadata?.avatar_url,
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

    // 1. Initial session fetch (handles OAuth redirect back)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        syncProfile(session.user);
      } else {
        setLoading(false);
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
    const redirectTo = APP_URL ? `${APP_URL}/auth/callback` : undefined;
    const res = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: redirectTo,
      },
    });

    if (res.data.user) {
      await supabase.from('profiles').upsert([{
        id: res.data.user.id,
        email: res.data.user.email,
        full_name: fullName,
      }]);
      await syncProfile(res.data.user);
    }
    return { error: res.error };
  };

  /**
   * Level 6: OAuth sign-in with Google or GitHub.
   * Redirects to provider, then back to /auth/callback which restores the session.
   */
  const signInWithOAuth = async (provider: 'google' | 'github') => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: new Error('Supabase is not configured') };
    }
    const redirectTo = APP_URL ? `${APP_URL}/auth/callback` : `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    return { error };
  };

  /**
   * Level 6: Password reset — sends reset email.
   */
  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: new Error('Supabase is not configured') };
    }
    const redirectTo = APP_URL ? `${APP_URL}/auth/callback` : `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error };
  };

  const signOut = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
  };

  /**
   * Level 8: Update current user's extended profile.
   * Since profiles table only has id/email/full_name/avatar_url, we store
   * extra fields (bio, role, skills, etc.) in Supabase auth user_metadata
   * AND in StorageMock (local fallback). The profiles table base fields
   * (full_name, avatar_url) are also updated in Supabase.
   */
  const updateCurrentUserProfile = async (updates: Partial<any>): Promise<any> => {
    if (!user) throw new Error('No authenticated user');

    const merged = { ...user, ...updates };

    // 1. Update StorageMock immediately for local consistency
    StorageMock.updateProfile(user.id, merged);
    setUser(merged);

    if (isSupabaseConfigured && supabase) {
      try {
        // 2. Update profiles table for base fields
        await supabase
          .from('profiles')
          .update({
            full_name: merged.full_name,
            avatar_url: merged.avatar_url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        // 3. Persist ALL profile fields as Supabase auth user_metadata
        //    so they survive re-login and are restored via syncProfile()
        const metaUpdates: Record<string, any> = {};
        const metaFields = [
          'username', 'bio', 'role', 'location', 'education',
          'skills', 'languages', 'technologies', 'website',
          'github_username', 'linkedin_url', 'other_links',
          'collaboration_interests', 'readme_markdown',
          'pinned_project_ids', 'privacy', 'preferences', 'avatar_url', 'full_name',
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
