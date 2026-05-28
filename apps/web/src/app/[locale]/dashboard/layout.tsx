import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import Sidebar from '@/components/Dashboard/Sidebar';

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

  const { data: profile } = await supabase
    .from('farm_profiles')
    .select('*')
    .eq('user_id', session.user.id)
    .single();

  if (!profile?.onboarding_completed) {
    redirect('/onboarding');
  }

  const userName = profile?.full_name || session?.user?.email?.split('@')[0] || "User";
  const initials = userName.substring(0, 2).toUpperCase();
  const userRegion = profile?.region || "Unknown";
  const userHa = profile?.total_ha || "0";
  const userMeta = `${userRegion} · ${userHa} ${locale === "bg" ? "ха" : "ha"}`;

  return (
    <div className="relative z-[2] flex min-h-screen bg-[#f6f3ec]">
      <Sidebar 
        locale={locale} 
        initials={initials} 
        userName={userName} 
        userMeta={userMeta} 
      />
      <main className="relative min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
