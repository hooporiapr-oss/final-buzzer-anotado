-- ═══════════════════════════════════════════════════════════════════
--  MAKE IT COUNT.: FIXED OR SHUFFLED BUTTONS
--  Run once in the Supabase SQL editor, BEFORE deploying reaction-velocity.
--  Each saved run now keeps buttons: 'fixed' or 'shuffle' (empty for
--  runs saved before today). Nothing already there is deleted or changed.
--  Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════
alter table public.vr_make_it_count_standings add column if not exists buttons text;
