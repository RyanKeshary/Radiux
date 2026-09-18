'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function SettingsRedirect() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Redirect to dashboard with settings query
        router.replace('/?settings=open');
      } else {
        router.replace('/login?next=/settings');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#18181b] text-neutral-400">
      <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
    </div>
  );
}
