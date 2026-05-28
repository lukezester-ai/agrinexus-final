-- Run in Supabase SQL editor (once). Stores per-farm cost inputs for break-even.
alter table public.farm_profiles
  add column if not exists break_even_inputs jsonb default null;

comment on column public.farm_profiles.break_even_inputs is
  'JSON: cost_*_eur_per_ha, yield_t_per_ha, optional local_price_eur_per_tonne';
