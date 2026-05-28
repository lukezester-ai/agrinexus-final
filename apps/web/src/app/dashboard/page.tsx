'use client';

import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { 
  Bot, CloudRain, TrendingUp, MapPin, 
  Sprout, Leaf, Sun, Wind, Bell, ChevronRight, Activity 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

const mockChartData = [
  { name: 'Пон', price: 410 },
  { name: 'Вто', price: 415 },
  { name: 'Сря', price: 405 },
  { name: 'Чет', price: 420 },
  { name: 'Пет', price: 435 },
  { name: 'Съб', price: 430 },
  { name: 'Нед', price: 450 },
];

export default function PremiumDashboard() {
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

  // Framer Motion Variants
  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  if (loading || !profile) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="relative w-20 h-20">
         <div className="absolute inset-0 border-4 border-emerald-200 rounded-full"></div>
         <div className="absolute inset-0 border-4 border-emerald-600 rounded-full border-t-transparent animate-spin"></div>
      </div>
    </div>
  );

  const mainCulture = profile.cultures?.[0] || 'Пшеница';

  return (
    <div className="min-h-screen bg-[#F4F7F6] font-sans selection:bg-emerald-200">
      
      {/* Top Header Section */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold text-xl shadow-lg shadow-emerald-600/20">
               {profile.full_name?.charAt(0) || 'Ф'}
             </div>
             <div>
               <h2 className="font-bold text-gray-800 text-lg leading-tight">Здравейте, {profile.full_name?.split(' ')[0] || 'Фермер'}!</h2>
               <p className="text-sm text-gray-500 font-medium">{profile.total_ha} хектара • {profile.region}</p>
             </div>
          </div>
          <button className="relative p-2 text-gray-400 hover:text-emerald-600 transition-colors bg-gray-50 rounded-full hover:bg-emerald-50">
             <Bell size={20} />
             <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <motion.div 
          variants={container} 
          initial="hidden" 
          animate="show" 
          className="grid grid-cols-1 md:grid-cols-12 gap-6"
        >
          
          {/* Welcome & AI Tutor Banner (Bento Box - Large) */}
          <motion.div variants={item} className="md:col-span-8 bg-gradient-to-br from-emerald-800 via-emerald-900 to-green-950 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col justify-between group">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-700"></div>
            <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-green-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
            
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-sm font-medium text-emerald-100 mb-6 border border-white/10">
                <SparklesIcon /> AI Анализът е готов
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight">
                Време е за стратегическо решение за {mainCulture}.
              </h1>
              <p className="text-emerald-100/80 text-lg max-w-xl mb-8 leading-relaxed">
                Нашите агенти (Market, Risk, Crop) анализираха вашето стопанство. Очаква се промяна в цените другата седмица.
              </p>
            </div>
            
            <div className="relative z-10 flex flex-wrap gap-4 mt-auto">
              <Link href="/tutor">
                <button className="bg-white text-emerald-900 hover:bg-emerald-50 px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 shadow-lg">
                  <Bot size={20} /> Стартирай Deep Debate
                </button>
              </Link>
            </div>
          </motion.div>

          {/* Quick Weather Widget (Bento Box - Small) */}
          <motion.div variants={item} className="md:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col justify-between hover:border-blue-200 transition-colors group cursor-pointer">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Времето днес</p>
                <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><MapPin size={20} className="text-blue-500"/> {profile.region}</h3>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                <Sun size={28} />
              </div>
            </div>
            
            <div className="mt-auto">
              <div className="text-5xl font-extrabold text-gray-800 mb-4 tracking-tighter">
                24°<span className="text-3xl text-gray-400">C</span>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg"><CloudRain size={16} className="text-blue-500"/> 0%</div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg"><Wind size={16} className="text-teal-500"/> 12 km/h</div>
              </div>
            </div>
          </motion.div>

          {/* Market Chart Widget (Bento Box - Wide) */}
          <motion.div variants={item} className="md:col-span-8 bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <TrendingUp className="text-amber-500" /> Борсови цени
                </h3>
                <p className="text-sm text-gray-500 mt-1">Тренд за {mainCulture} (EUR/тон)</p>
              </div>
              <div className="px-4 py-1.5 bg-green-50 text-green-700 font-bold rounded-full text-sm border border-green-200">
                +4.2% Тази седмица
              </div>
            </div>
            
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                    itemStyle={{ color: '#065f46', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="price" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Quick Stats & Alerts (Bento Box - Tall) */}
          <motion.div variants={item} className="md:col-span-4 flex flex-col gap-6">
            
            {/* Cultures Card */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex-1 hover:shadow-md transition-shadow">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Leaf size={16} /> Вашите култури
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.cultures?.map((c: string) => (
                  <span key={c} className="px-4 py-2 bg-emerald-50 text-emerald-800 rounded-xl font-bold text-sm flex items-center gap-2 border border-emerald-100">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            {/* Smart Alerts Card */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-6 shadow-sm border border-amber-100 flex-1 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500 rounded-full mix-blend-multiply filter blur-2xl opacity-10"></div>
              <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Activity size={16} /> AI Препоръки
              </h3>
              <div className="space-y-4 relative z-10">
                <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-white/50">
                  <p className="text-sm font-semibold text-gray-800 mb-1">Риск от ръжда ⚠️</p>
                  <p className="text-xs text-gray-600">Влажността се покачва. Препоръчителен е оглед на блоковете с пшеница.</p>
                </div>
                <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-white/50">
                  <p className="text-sm font-semibold text-gray-800 mb-1">Прозорец за продажба 📈</p>
                  <p className="text-xs text-gray-600">Цената на MATIF достигна локален пик. Обмислете реализация на 20%.</p>
                </div>
              </div>
            </div>

          </motion.div>

        </motion.div>
      </main>
    </div>
  );
}

// Помощен компонент за иконка
function SparklesIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-300">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
    </svg>
  );
}
