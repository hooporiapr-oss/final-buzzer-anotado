-- ═══════════════════════════════════════════════════════════════════
--  SHOOT IT. OWN IT.: FLASH SPEEDS AND BUTTONS
--  Run once in the Supabase SQL editor, BEFORE deploying reaction-velocity.
--
--  Each saved run now keeps:
--    speed    the flash speed: 'free-<BPM>' (Free Flash) or '60' '90' '120' '180'
--    buttons  'fixed' or 'shuffle'
--  Runs saved before today (the 60-second game) have no speed and stay
--  on their own board, "60 sec (before)".
--  Nothing already there is deleted or changed. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════
alter table public.vr_shoot_it_own_it_standings add column if not exists speed text;
alter table public.vr_shoot_it_own_it_standings add column if not exists buttons text;
