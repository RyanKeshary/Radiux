'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function CurrentUserProfileRedirect() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace(`/profile/${user.username || user.id}`);
      } else {
        router.replace('/login?next=/profile');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#18181b] text-neutral-400">
      <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
    </div>
  );
}
