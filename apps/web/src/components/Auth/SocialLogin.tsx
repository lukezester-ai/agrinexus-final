'use client';

import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { FcGoogle } from 'react-icons/fc';
import { SiApple } from 'react-icons/si';
import { useLocale } from 'next-intl';

export default function SocialLogin() {
  const locale = useLocale();

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/${locale}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) console.error(error);
  };

  const handleAppleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/${locale}/auth/callback`,
      },
    });
    if (error) console.error(error);
  };

  return (
    <div className="flex flex-col gap-3 w-full max-w-sm">
      <Button 
        onClick={handleGoogleLogin}
        variant="outline"
        className="flex items-center gap-3 py-6 text-base"
      >
        <FcGoogle size={24} />
        Продължи с Google
      </Button>

      <Button 
        onClick={handleAppleLogin}
        variant="outline"
        className="flex items-center gap-3 py-6 text-base"
      >
        <SiApple size={24} />
        Продължи с Apple
      </Button>
    </div>
  );
}
