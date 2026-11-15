-- ═══════════════════════════════════════════════════════════════════
--  REACTIFIC: ONE BOARD PER SPEED
--  Run once in the Supabase SQL editor, BEFORE deploying reaction-velocity.
--  Same as Reaction Speed: each saved run keeps its speed ('free', '20'
--  … '120'); runs saved before today stay on the 100 BPM board.
--  Nothing already there is deleted or changed. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════
alter table public.vr_reactific_standings add column if not exists speed text;
