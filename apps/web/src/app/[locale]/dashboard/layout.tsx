import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Проверка за завършен onboarding
  const { data: profile } = await supabase
    .from('farm_profiles')
    .select('onboarding_completed')
    .eq('user_id', session.user.id)
    .single();

  if (!profile?.onboarding_completed) {
    redirect('/onboarding');
  }

  return (
    <div className="min-h-screen bg-[#f6f3ec]">
      {children}
    </div>
  );
}
