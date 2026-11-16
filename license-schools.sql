-- ═══════════════════════════════════════════════════════════════════
--  LICENSE ADMIN: THE SCHOOL LIST
--  Run once in the Supabase SQL editor, BEFORE deploying the License Admin.
--
--  The School Name dropdown in the License Admin now reads its own list
--  of official school names, starting EMPTY. A school joins the list the
--  first time it is added with "＋ New school…"; every later code for it
--  (any product) is picked from the list, so the name is always spelled
--  the same and players line up across Cognitivo Gym and Reaction Velocity.
--
--  Only admins (app_admins, public.is_admin()) can read or add to it.
--  Codes already made are not touched. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.license_schools (
  name       text primary key,
  created_at timestamptz not null default now()
);
alter table public.license_schools enable row level security;

drop policy if exists license_schools_admin_read on public.license_schools;
create policy license_schools_admin_read on public.license_schools
  for select to authenticated using (coalesce(public.is_admin(), false));

drop policy if exists license_schools_admin_add on public.license_schools;
create policy license_schools_admin_add on public.license_schools
  for insert to authenticated with check (coalesce(public.is_admin(), false));

grant select, insert on public.license_schools to authenticated;
