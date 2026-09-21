'use client';

import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { FcGoogle } from 'react-icons/fc';
import { SiApple } from 'react-icons/si';
import { useLocale } from 'next-intl';
import { routing } from '@/i18n/routing';

function oauthCallbackUrl(locale: string): string {
  const path =
    locale === routing.defaultLocale ? '/auth/callback' : `/${locale}/auth/callback`;
  return `${window.location.origin}${path}`;
}

export default function SocialLogin() {
  const locale = useLocale();

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: oauthCallbackUrl(locale),
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
        redirectTo: oauthCallbackUrl(locale),
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
