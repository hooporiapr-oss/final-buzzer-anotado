-- ═══════════════════════════════════════════════════════════════════
--  GYM STANDINGS ADMIN — EVERY GAME
--  Run once in the Supabase SQL editor, BEFORE the updated pages go live.
--  (ritnome-admin.sql, ritnome-admin-borrar.sql and ritnome-categorias.sql
--   were already run on 11/15; this builds on them.)
--
--  The standings admin (cadapunto.com/standings.html) now covers every
--  game of the Paradiso gym, from three tables:
--    ritnome_standings                  Ritnome
--    dynamic_memory_quarter_standings   The Fortress, Recall, Recognition,
--                                       Shot Map and Replay (by game_key)
--    hooporia_4qtr_standings            Final Score (the four quarters)
--
--  1. The two memory tables get what Ritnome already has: admin_id (a
--     number per run), hidden (kept on file, off the board) and
--     logged_at (empty for runs saved before today).
--  2. Three functions for all three tables, locked to app_admins
--     (public.is_admin()) and to those three table names only:
--       gym_admin_list(table)                      every run, hidden ones too
--       gym_admin_set(table, id, name, hidden)     rename / hide / show
--       gym_admin_delete(table, ids)               delete for good
--  3. Each deleted run is copied to gym_standings_deleted (which table,
--     when, by whom, the whole run). No page can read it.
--
--  Nothing already there is deleted or changed. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════

-- 1. columns on the memory tables
alter table public.dynamic_memory_quarter_standings add column if not exists admin_id bigint generated always as identity;
alter table public.dynamic_memory_quarter_standings add column if not exists hidden boolean not null default false;
alter table public.dynamic_memory_quarter_standings add column if not exists logged_at timestamptz;
alter table public.dynamic_memory_quarter_standings alter column logged_at set default now();

alter table public.hooporia_4qtr_standings add column if not exists admin_id bigint generated always as identity;
alter table public.hooporia_4qtr_standings add column if not exists hidden boolean not null default false;
alter table public.hooporia_4qtr_standings add column if not exists logged_at timestamptz;
alter table public.hooporia_4qtr_standings alter column logged_at set default now();

-- 3. the record of deleted runs
create table if not exists public.gym_standings_deleted (
  table_name text not null,
  deleted_at timestamptz not null default now(),
  deleted_by text,
  run        jsonb not null
);
alter table public.gym_standings_deleted enable row level security;

-- 2. the functions
create or replace function public.gym_admin_table(p_table text)
returns text
language plpgsql
immutable
as $$
begin
  if p_table in ('ritnome_standings', 'dynamic_memory_quarter_standings', 'hooporia_4qtr_standings') then
    return p_table;
  end if;
  raise exception 'not a gym standings table: %', p_table;
end $$;

create or replace function public.gym_admin_list(p_table text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r jsonb;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'not an admin'; end if;
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by t.admin_id desc), ''[]''::jsonb) from public.%I t',
                 public.gym_admin_table(p_table)) into r;
  return r;
end $$;

create or replace function public.gym_admin_set(p_table text, p_id bigint, p_name text default null, p_hidden boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r jsonb;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'not an admin'; end if;
  if p_name is not null and length(btrim(p_name)) = 0 then raise exception 'the name cannot be empty'; end if;
  execute format('update public.%I t set player_name = coalesce(left(btrim($1), 40), t.player_name),
                                         hidden = coalesce($2, t.hidden)
                   where t.admin_id = $3 returning to_jsonb(t)', public.gym_admin_table(p_table))
    into r using p_name, p_hidden, p_id;
  if r is null then raise exception 'no run with that number'; end if;
  return r;
end $$;

create or replace function public.gym_admin_delete(p_table text, p_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer; t text := public.gym_admin_table(p_table);
begin
  if not coalesce(public.is_admin(), false) then raise exception 'not an admin'; end if;
  if p_ids is null or cardinality(p_ids) = 0 then raise exception 'no runs given'; end if;
  execute format('with d as (delete from public.%I x where x.admin_id = any($1) returning to_jsonb(x) as run)
                  insert into public.gym_standings_deleted (table_name, deleted_by, run)
                  select %L, $2, d.run from d', t, t)
    using p_ids, nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email';
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.gym_admin_list(text) from public;
revoke all on function public.gym_admin_set(text, bigint, text, boolean) from public;
revoke all on function public.gym_admin_delete(text, bigint[]) from public;
grant execute on function public.gym_admin_list(text) to authenticated;
grant execute on function public.gym_admin_set(text, bigint, text, boolean) to authenticated;
grant execute on function public.gym_admin_delete(text, bigint[]) to authenticated;
