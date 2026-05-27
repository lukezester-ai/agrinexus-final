'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const culturesOptions = ['Пшеница', 'Царевица', 'Слънчоглед', 'Ечемик', 'Рапица', 'Домати', 'Краставици', 'Лавандула', 'Лозя'];
const regionOptions = ['Северозападен', 'Северен централен', 'Североизточен', 'Югоизточен', 'Южен централен', 'Югозападен'];

export default function Onboarding() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [cultures, setCultures] = useState<string[]>([]);
  const [region, setRegion] = useState('');
  const [totalHa, setTotalHa] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const toggleCulture = (c: string) => {
    setCultures(prev => prev.includes(c) ? prev.filter(item => item !== c) : [...prev, c]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!region || cultures.length === 0 || totalHa === '') {
      setError('Моля, изберете поне една култура, регион и размер на стопанството.');
      return;
    }

    setLoading(true);
    setError('');

    // Обновяваме профила директно през Supabase (чрез RLS)
    const { error: updateError } = await supabase
      .from('farm_profiles')
      .update({
        cultures,
        region,
        total_ha: Number(totalHa),
        onboarding_completed: true
      })
      .eq('user_id', user.id);

    setLoading(false);

    if (updateError) {
      setError('Грешка при запазване: ' + updateError.message);
    } else {
      router.push('/dashboard');
    }
  };

  if (authLoading) return <div className="p-10 text-center text-gray-500">Зареждане...</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        
        <h1 className="text-3xl font-bold mb-2 text-gray-900">Добре дошли в AgriNexus! 🌾</h1>
        <p className="text-gray-600 mb-8">
          Нека настроим профила на вашето стопанство. Тази информация ще помогне на AI агентите да ви дават максимално точни и персонализирани съвети.
        </p>

        {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-100">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Култури */}
          <div>
            <label className="block text-lg font-semibold text-gray-800 mb-4">1. Кои култури отглеждате?</label>
            <div className="flex flex-wrap gap-3">
              {culturesOptions.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCulture(c)}
                  className={`px-5 py-2.5 rounded-full font-medium transition-all ${
                    cultures.includes(c) 
                    ? 'bg-green-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Регион */}
          <div>
            <label className="block text-lg font-semibold text-gray-800 mb-4">2. В кой регион се намира стопанството?</label>
            <select 
              value={region} 
              onChange={(e) => setRegion(e.target.value)}
              className="w-full p-4 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-green-500 transition-shadow"
            >
              <option value="">Изберете регион...</option>
              {regionOptions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Размер */}
          <div>
            <label className="block text-lg font-semibold text-gray-800 mb-4">3. Общ размер на стопанството (в хектари)</label>
            <input 
              type="number" 
              min="0"
              step="any"
              value={totalHa}
              onChange={(e) => setTotalHa(e.target.value ? Number(e.target.value) : '')}
              placeholder="Напр. 150"
              className="w-full p-4 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-green-500 transition-shadow"
            />
          </div>

          {/* Submit */}
          <div className="pt-4">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-green-600 text-white text-lg font-bold py-4 rounded-xl shadow-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Запазване на данните...' : 'Завърши профила'}
            </button>
          </div>
          
        </form>
      </div>
    </div>
  );
}
