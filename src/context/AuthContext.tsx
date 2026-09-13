'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '@/lib/types';
import { DEMO_USERS, initStorageMock } from '@/lib/storage-mock';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isSupabase: boolean;
  switchDemoUser: (user: UserProfile) => void;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initStorageMock();

    if (isSupabaseConfigured && supabase) {
      // Check supabase session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            avatar_url: session.user.user_metadata?.avatar_url,
          });
        } else {
          // Fallback to active demo user if not logged in
          const savedDemoUserId = localStorage.getItem('codecollab_current_demo_user');
          const demoUser = DEMO_USERS.find(u => u.id === savedDemoUserId) || DEMO_USERS[0];
          setUser(demoUser);
        }
        setLoading(false);
      });

      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            avatar_url: session.user.user_metadata?.avatar_url,
          });
        } else {
          const savedDemoUserId = localStorage.getItem('codecollab_current_demo_user');
          const demoUser = DEMO_USERS.find(u => u.id === savedDemoUserId) || DEMO_USERS[0];
          setUser(demoUser);
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    } else {
      // Local/Demo user mode
      const savedDemoUserId = typeof window !== 'undefined' ? localStorage.getItem('codecollab_current_demo_user') : null;
      const demoUser = DEMO_USERS.find(u => u.id === savedDemoUserId) || DEMO_USERS[0];
      setUser(demoUser);
      setLoading(false);
    }
  }, []);

  const switchDemoUser = (newUser: UserProfile) => {
    localStorage.setItem('codecollab_current_demo_user', newUser.id);
    setUser(newUser);
  };

  const signIn = async (email: string) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
    } else {
      // Create or find mock user
      let found = DEMO_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!found) {
        found = {
          id: 'user-' + Math.random().toString(36).substring(2, 8),
          email,
          full_name: email.split('@')[0],
          avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${email}`
        };
        DEMO_USERS.push(found);
      }
      switchDemoUser(found);
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    // Switch to first demo user
    switchDemoUser(DEMO_USERS[0]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isSupabase: isSupabaseConfigured,
        switchDemoUser,
        signIn,
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
