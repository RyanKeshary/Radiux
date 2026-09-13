'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isSupabase: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: any }>;
  signUpWithPassword: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
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
      // Fetch or ensure profile exists in public.profiles
      const { data: profile } = await supabase!
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .single();

      if (profile) {
        setUser({
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name || sessionUser.email.split('@')[0],
          avatar_url: profile.avatar_url,
        });
      } else {
        const fallbackProfile = {
          id: sessionUser.id,
          email: sessionUser.email,
          full_name: sessionUser.user_metadata?.full_name || sessionUser.email.split('@')[0],
        };
        setUser(fallbackProfile);
        // Ensure profile row
        await supabase!.from('profiles').upsert([fallbackProfile]);
      }
    } catch (e) {
      console.error('Error fetching user profile:', e);
      setUser({
        id: sessionUser.id,
        email: sessionUser.email,
        full_name: sessionUser.user_metadata?.full_name || sessionUser.email.split('@')[0],
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

    // 1. Initial session fetch
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        syncProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    // 2. Listen to auth state transitions
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
    const res = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (res.data.user) {
      // Auto-insert profile record immediately
      await supabase.from('profiles').upsert([{
        id: res.data.user.id,
        email: res.data.user.email,
        full_name: fullName,
      }]);
      await syncProfile(res.data.user);
    }
    return { error: res.error };
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
