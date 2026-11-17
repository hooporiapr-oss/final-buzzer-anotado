-- ═══════════════════════════════════════════════════════════════════
--  HOME BASE and SWIPE IT — their board
--  Run once in the Supabase SQL editor, BEFORE the updated pages go live.
--
--  One new board for Home Base and Swipe It — played from the Reaction
--  Velocity hub (any device) or from Reaction Mobile (phones):
--    vr_mobile_standings   game_key 'home-base' (Home Base)
--                                   'swipe-it'  (Swipe It)
--  Each run records its device ('tablet' or 'phone'), so a tablet reach
--  and a phone flick never mix in My Progress, personal bests or the
--  Coach View. If the board was already created, this adds the device.
--
--  Pages may read the board and add runs; they cannot change or delete
--  runs. Codes for these games are product 'reaction-mobile' in the
--  licenses table (License Admin → 📱 Reaction Mobile).
--
--  Nothing already there is deleted or changed. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.vr_mobile_standings (
  admin_id    bigint generated always as identity primary key,
  game_key    text not null check (game_key in ('home-base', 'swipe-it')),
  player_name text not null check (char_length(btrim(player_name)) between 1 and 20),
  school_name text,
  category    text,
  bpm         integer not null check (bpm between 0 and 1000),
  hits        integer check (hits between 0 and 100),
  misses      integer check (misses between 0 and 100),
  avg_ms      integer,
  hidden      boolean not null default false,
  logged_at   timestamptz not null default now()
);

alter table public.vr_mobile_standings add column if not exists device text not null default 'phone'
  check (device in ('tablet', 'phone'));

create index if not exists vr_mobile_standings_school on public.vr_mobile_standings (school_name, game_key);

alter table public.vr_mobile_standings enable row level security;

drop policy if exists "mobile board read" on public.vr_mobile_standings;
create policy "mobile board read" on public.vr_mobile_standings
  for select to anon, authenticated using (true);

drop policy if exists "mobile board add" on public.vr_mobile_standings;
create policy "mobile board add" on public.vr_mobile_standings
  for insert to anon, authenticated with check (hidden = false);

grant select, insert on public.vr_mobile_standings to anon, authenticated;
