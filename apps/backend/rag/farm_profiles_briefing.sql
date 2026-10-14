-- Weekly briefing (Telegram / future Viber). Run once in Supabase SQL editor.
alter table public.farm_profiles
  add column if not exists briefing_preferences jsonb default null;

comment on column public.farm_profiles.briefing_preferences is
  'JSON: enabled, telegram_chat_id, preferred_channel, linked_at';
