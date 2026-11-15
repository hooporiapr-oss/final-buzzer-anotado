-- ═══════════════════════════════════════════════════════════════════
--  AGE GROUP ON EVERY GAME'S SAVED RUNS
--  Run once in the Supabase SQL editor, BEFORE the updated pages go live.
--
--  With the one-name setup (jugador.js), every run a player saves goes
--  under the age group of the code used at sign-in. Ritnome already
--  has the column; this adds it to every other standings table of the
--  two programs:
--    Cognitivo Gym       dynamic_memory_quarter_standings, hooporia_4qtr_standings
--    Reaction Velocity   its six game tables and reaction_velocity_standings
--
--  Empty for runs saved before today. Nothing already there is deleted
--  or changed. Safe to run more than once.
--  (license_category, from ritnome-categorias.sql, already answers for
--   Reaction Velocity codes too — nothing to add for that.)
-- ═══════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array['dynamic_memory_quarter_standings', 'hooporia_4qtr_standings',
                           'vr_reactific_standings', 'vr_reaction_speed_standings', 'vr_make_it_count_standings',
                           'vr_shoot_it_own_it_standings', 'vr_chain_reaction_standings', 'vr_flashpoint_standings',
                           'reaction_velocity_standings']
  loop
    execute format('alter table public.%I add column if not exists category text', t);
  end loop;
end $$;
