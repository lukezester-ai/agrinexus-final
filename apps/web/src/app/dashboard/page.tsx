'use client';

import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiCloud, FiTrendingUp, FiMessageSquare, FiMap, FiChevronRight } from 'react-icons/fi';

export default function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      supabase
        .from('farm_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          setProfile(data);
          setLoading(false);
        });
    }
  }, [user]);

  if (loading || !profile) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-green-700 font-medium">Зареждане на таблото...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12">
      {/* Header with Gradient Background */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-800 pb-24 pt-12 px-4 sm:px-6 lg:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-extrabold text-white mb-2 drop-shadow-md">
            Здравейте, {profile.full_name?.split(' ')[0] || 'Фермер'}! 👋
          </h1>
          <p className="text-green-100 text-lg flex items-center gap-2 opacity-90">
            <FiMap className="text-green-200" />
            {profile.region} • {profile.total_ha} хектара
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16">
        {/* Култури (Quick Stats) - Glassmorphism */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/50 p-6 mb-8 flex flex-wrap gap-4 items-center">
          <div className="text-gray-500 font-medium mr-4">Вашите култури:</div>
          {profile.cultures?.map((c: string) => (
            <span key={c} className="px-4 py-1.5 bg-green-50 text-green-700 rounded-full font-medium text-sm flex items-center gap-2 border border-green-100 shadow-sm">
              🌱 {c}
            </span>
          ))}
          {(!profile.cultures || profile.cultures.length === 0) && (
            <span className="text-gray-400 italic">Няма избрани култури.</span>
          )}
        </div>

        {/* Основен Grid с Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* AI Tutor Card */}
          <Link href="/tutor" className="group block">
            <div className="bg-white rounded-2xl p-6 h-full shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-green-300 relative overflow-hidden flex flex-col justify-between cursor-pointer transform hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
              <div>
                <div className="w-14 h-14 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mb-6 shadow-sm">
                  <FiMessageSquare size={28} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">AgriNexus Tutor</h2>
                <p className="text-gray-600 mb-6 line-clamp-2">
                  Вашият личен AI агроном. Попитайте за болести, торене или пазарни цени.
                </p>
              </div>
              <div className="flex items-center text-green-600 font-semibold group-hover:translate-x-2 transition-transform">
                Започни чат <FiChevronRight className="ml-1" />
              </div>
            </div>
          </Link>

          {/* Време & Риск Card */}
          <Link href="/weather" className="group block">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 h-full shadow-md hover:shadow-xl transition-all duration-300 border border-blue-400 relative overflow-hidden flex flex-col justify-between cursor-pointer transform hover:-translate-y-1">
              <div className="absolute -bottom-4 -right-4 text-white/10">
                <FiCloud size={140} />
              </div>
              <div>
                <div className="w-14 h-14 bg-white/20 text-white backdrop-blur-sm rounded-xl flex items-center justify-center mb-6 shadow-sm">
                  <FiCloud size={28} />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Време & Риск</h2>
                <p className="text-blue-100 mb-6 line-clamp-2">
                  Прогноза за <b>{profile.region}</b> и активни предупреждения за болести.
                </p>
              </div>
              <div className="flex items-center text-white font-semibold group-hover:translate-x-2 transition-transform">
                Детайлна прогноза <FiChevronRight className="ml-1" />
              </div>
            </div>
          </Link>

          {/* Пазари Card */}
          <Link href="/market" className="group block">
            <div className="bg-white rounded-2xl p-6 h-full shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-emerald-300 relative overflow-hidden flex flex-col justify-between cursor-pointer transform hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
              <div>
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-6 shadow-sm">
                  <FiTrendingUp size={28} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Пазари & Цени</h2>
                <p className="text-gray-600 mb-6 line-clamp-2">
                  Проследете тенденциите за <b>{profile.cultures?.[0] || 'вашите култури'}</b> и разберете кога да продавате.
                </p>
              </div>
              <div className="flex items-center text-emerald-600 font-semibold group-hover:translate-x-2 transition-transform">
                Анализ на пазара <FiChevronRight className="ml-1" />
              </div>
            </div>
          </Link>

        </div>
      </div>
    </div>
  );
}
