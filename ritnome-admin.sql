-- ═══════════════════════════════════════════════════════════════════
--  RITNOME STANDINGS ADMIN
--  Run once in the Supabase SQL editor, BEFORE the new pages go live.
--
--  What it does (nothing is deleted, no score is changed):
--   1. Adds three columns to ritnome_standings:
--        admin_id   a number for each run, so one run can be picked out
--        hidden     true = kept in the table, not shown on the board
--        logged_at  when the run was saved (empty for runs saved before today)
--   2. Lets the new boards save: if the table only accepted the old
--      pattern names, that rule is removed so Free Tap ('free') and the
--      speed boards ('gonogo@40', 'random@120', ...) can save too.
--   3. Two functions, both locked to the addresses in app_admins
--      (public.is_admin()), used by cadapunto.com/standings.html:
--        ritnome_admin_list()                      every run, hidden ones too
--        ritnome_admin_set(id, name, hidden)       rename a player / hide / show
--
--  Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════

-- 1. columns
alter table public.ritnome_standings add column if not exists admin_id bigint generated always as identity;
alter table public.ritnome_standings add column if not exists hidden boolean not null default false;
alter table public.ritnome_standings add column if not exists logged_at timestamptz;
alter table public.ritnome_standings alter column logged_at set default now();

-- 2. any rule limiting which pattern names are allowed
do $$
declare c record;
begin
  for c in
    select conname, pg_get_constraintdef(oid) as def
      from pg_constraint
     where conrelid = 'public.ritnome_standings'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%pattern%'
  loop
    raise notice 'removing rule % : %', c.conname, c.def;
    execute format('alter table public.ritnome_standings drop constraint %I', c.conname);
  end loop;
end $$;

-- 3a. the list, for the admin page only
create or replace function public.ritnome_admin_list()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'not an admin';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(t) order by t.admin_id desc)
      from public.ritnome_standings t
  ), '[]'::jsonb);
end $$;

-- 3b. rename a player and/or hide or show one run
create or replace function public.ritnome_admin_set(p_id bigint, p_name text default null, p_hidden boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r jsonb;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'not an admin';
  end if;
  if p_name is not null and length(btrim(p_name)) = 0 then
    raise exception 'the name cannot be empty';
  end if;
  update public.ritnome_standings t
     set player_name = coalesce(left(btrim(p_name), 20), t.player_name),
         hidden      = coalesce(p_hidden, t.hidden)
   where t.admin_id = p_id
  returning to_jsonb(t) into r;
  if r is null then
    raise exception 'no run with that number';
  end if;
  return r;
end $$;

revoke all on function public.ritnome_admin_list() from public;
revoke all on function public.ritnome_admin_set(bigint, text, boolean) from public;
grant execute on function public.ritnome_admin_list() to authenticated;
grant execute on function public.ritnome_admin_set(bigint, text, boolean) to authenticated;

-- Check: how many runs are on file, and none hidden yet
-- select count(*) as runs, count(*) filter (where hidden) as hidden from public.ritnome_standings;
