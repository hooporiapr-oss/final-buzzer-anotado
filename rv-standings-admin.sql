-- ═══════════════════════════════════════════════════════════════════
--  REACTION VELOCITY IN THE STANDINGS ADMIN
--  Run once in the Supabase SQL editor, BEFORE the updated pages go live.
--  (gym-standings-admin.sql was already run on 11/15; this builds on it.)
--
--  Adds the seven Reaction Velocity tables to the standings admin
--  (cadapunto.com/standings.html):
--    vr_reactific_standings         Reactific
--    vr_reaction_speed_standings    Reaction Speed
--    vr_make_it_count_standings     Make It Count.
--    vr_shoot_it_own_it_standings   Shoot It. Own It.
--    vr_chain_reaction_standings    Chain Reaction
--    vr_flashpoint_standings        Flashpoint
--    reaction_velocity_standings    Final Score
--
--  1. Each gets admin_id (a number per run), hidden (kept on file, off
--     the board) and logged_at (empty for runs saved before today).
--  2. gym_admin_list / _set / _delete accept these seven tables too —
--     still only for addresses in app_admins, and still no other tables.
--     Deleted runs are copied to gym_standings_deleted like the others.
--
--  Nothing already there is deleted or changed. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array['vr_reactific_standings', 'vr_reaction_speed_standings', 'vr_make_it_count_standings',
                           'vr_shoot_it_own_it_standings', 'vr_chain_reaction_standings', 'vr_flashpoint_standings',
                           'reaction_velocity_standings']
  loop
    execute format('alter table public.%I add column if not exists admin_id bigint generated always as identity', t);
    execute format('alter table public.%I add column if not exists hidden boolean not null default false', t);
    execute format('alter table public.%I add column if not exists logged_at timestamptz', t);
    execute format('alter table public.%I alter column logged_at set default now()', t);
  end loop;
end $$;

create or replace function public.gym_admin_table(p_table text)
returns text
language plpgsql
immutable
as $$
begin
  if p_table in ('ritnome_standings', 'dynamic_memory_quarter_standings', 'hooporia_4qtr_standings',
                 'vr_reactific_standings', 'vr_reaction_speed_standings', 'vr_make_it_count_standings',
                 'vr_shoot_it_own_it_standings', 'vr_chain_reaction_standings', 'vr_flashpoint_standings',
                 'reaction_velocity_standings') then
    return p_table;
  end if;
  raise exception 'not a gym standings table: %', p_table;
end $$;
