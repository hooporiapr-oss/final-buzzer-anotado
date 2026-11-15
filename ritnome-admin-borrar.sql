-- ═══════════════════════════════════════════════════════════════════
--  RITNOME STANDINGS ADMIN — DELETE
--  Run once in the Supabase SQL editor, BEFORE the updated page goes live.
--  (ritnome-admin.sql must already have been run — it was, on 11/15.)
--
--  Delete takes runs off the standings for good: they no longer exist
--  in ritnome_standings and no board or admin list shows them again.
--  A copy of each deleted run is kept in ritnome_standings_deleted
--  (when, by whom, and the whole run), which no page can read, so a
--  record of it is still on file.
--
--  ritnome_admin_delete(ids)   removes those runs, returns how many
--  Locked to the addresses in app_admins (public.is_admin()).
--
--  Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.ritnome_standings_deleted (
  deleted_at timestamptz not null default now(),
  deleted_by text,
  run        jsonb not null
);
-- no policies: nothing outside the database itself can read or change it
alter table public.ritnome_standings_deleted enable row level security;

create or replace function public.ritnome_admin_delete(p_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'not an admin';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    raise exception 'no runs given';
  end if;
  with d as (
    delete from public.ritnome_standings t
     where t.admin_id = any(p_ids)
    returning to_jsonb(t) as run
  )
  insert into public.ritnome_standings_deleted (deleted_by, run)
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', d.run from d;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.ritnome_admin_delete(bigint[]) from public;
grant execute on function public.ritnome_admin_delete(bigint[]) to authenticated;
