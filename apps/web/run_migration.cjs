const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:UzbekistanMubarek1981%40@db.ovvpwizxolporgrmbckc.supabase.co:5432/postgres';

const sql = `
-- 1. Създаване на таблица за Профили (Farm Profiles)
CREATE TABLE IF NOT EXISTS public.farm_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    full_name TEXT,
    region TEXT,
    total_ha NUMERIC,
    cultures TEXT[],
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Създаване на таблица за Полета (Fields)
CREATE TABLE IF NOT EXISTS public.fields (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    hectares NUMERIC NOT NULL,
    crop TEXT NOT NULL,
    status TEXT DEFAULT 'healthy',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Активиране на сигурността (Row Level Security)
ALTER TABLE public.farm_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;

-- 4. Правила кой какво може да вижда и променя (Всеки вижда само своето)
DROP POLICY IF EXISTS "Потребителите виждат само своя профил" ON public.farm_profiles;
CREATE POLICY "Потребителите виждат само своя профил" ON public.farm_profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Потребителите създават своя профил" ON public.farm_profiles;
CREATE POLICY "Потребителите създават своя профил" ON public.farm_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Потребителите обновяват своя профил" ON public.farm_profiles;
CREATE POLICY "Потребителите обновяват своя профил" ON public.farm_profiles FOR UPDATE USING (auth.uid() = user_id);


DROP POLICY IF EXISTS "Потребителите виждат само своите полета" ON public.fields;
CREATE POLICY "Потребителите виждат само своите полета" ON public.fields FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Потребителите могат да добавят свои полета" ON public.fields;
CREATE POLICY "Потребителите могат да добавят свои полета" ON public.fields FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Потребителите могат да редактират свои полета" ON public.fields;
CREATE POLICY "Потребителите могат да редактират свои полета" ON public.fields FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Потребителите могат да трият свои полета" ON public.fields;
CREATE POLICY "Потребителите могат да трият свои полета" ON public.fields FOR DELETE USING (auth.uid() = user_id);
`;

async function run() {
  console.log("Connecting to Supabase Database...");
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully. Running migration...");
    await client.query(sql);
    console.log("SUCCESS! Tables created successfully.");
  } catch (err) {
    console.error("ERROR running migration:", err);
  } finally {
    await client.end();
  }
}

run();
