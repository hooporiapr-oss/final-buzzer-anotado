-- ═══════════════════════════════════════════════════════════════════
--  LICENSE ADMIN: THE CATEGORY LIST
--  Run once in the Supabase SQL editor, BEFORE deploying the License Admin.
--
--  The Category on a code is now picked from a list, like the school
--  name, so an age group is always spelled the same on every code and
--  its boards and player list line up across Cognitivo Gym and Reaction
--  Velocity. The list starts with the age groups below; "＋ New
--  category…" adds one.
--
--  Only admins (app_admins, public.is_admin()) can read or add to it.
--  Codes already made are not touched. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.license_categories (
  name       text primary key,
  created_at timestamptz not null default now()
);
alter table public.license_categories enable row level security;

drop policy if exists license_categories_admin_read on public.license_categories;
create policy license_categories_admin_read on public.license_categories
  for select to authenticated using (coalesce(public.is_admin(), false));

drop policy if exists license_categories_admin_add on public.license_categories;
create policy license_categories_admin_add on public.license_categories
  for insert to authenticated with check (coalesce(public.is_admin(), false));

grant select, insert on public.license_categories to authenticated;

insert into public.license_categories (name) values
  ('5-6 años'), ('7-8 años'), ('9-10 años'), ('11-12 años'), ('13-14 años'), ('15-16 años'), ('17-18 años')
on conflict (name) do nothing;
