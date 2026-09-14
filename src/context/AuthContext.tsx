'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { APP_URL } from '@/lib/config';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isSupabase: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: any }>;
  signUpWithPassword: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
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
      const { data: profile } = await supabase!
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .single();

      if (profile) {
        setUser({
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name || sessionUser.email?.split('@')[0] || 'User',
          avatar_url: profile.avatar_url,
        });
      } else {
        // Build full_name from OAuth metadata or email
        const oauthName =
          sessionUser.user_metadata?.full_name ||
          sessionUser.user_metadata?.name ||
          sessionUser.email?.split('@')[0] ||
          'User';
        const oauthAvatar =
          sessionUser.user_metadata?.avatar_url ||
          sessionUser.user_metadata?.picture ||
          '';

        const fallbackProfile = {
          id: sessionUser.id,
          email: sessionUser.email || '',
          full_name: oauthName,
          avatar_url: oauthAvatar,
        };
        setUser(fallbackProfile);
        // Ensure profile row exists (upsert handles OAuth + email sign-ups)
        await supabase!.from('profiles').upsert([fallbackProfile]);
      }
    } catch (e) {
      console.error('Error fetching user profile:', e);
      setUser({
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
