'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [profileLoading, setProfileLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    const checkProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('farm_profiles')
          .select('onboarding_completed')
          .eq('user_id', user.id)
          .single();

        if (!error && data) {
          if (!data.onboarding_completed && pathname !== '/onboarding') {
            router.push('/onboarding');
          } else {
            setHasAccess(true);
          }
        } else {
          // Ако профилът още не е създаден от webhook-а (забавяне)
          if (pathname !== '/onboarding') {
            router.push('/onboarding');
          } else {
            setHasAccess(true);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setProfileLoading(false);
      }
    };

    checkProfile();
  }, [user, authLoading, router, pathname]);

  if (authLoading || profileLoading) return <div className="p-10 text-center text-gray-500">Зареждане на профил...</div>;
  if (!user || !hasAccess) return null;

  return <>{children}</>;
}
