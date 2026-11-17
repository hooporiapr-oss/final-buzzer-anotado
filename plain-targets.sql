-- ═══════════════════════════════════════════════════════════════════
--  TARGETS: BASKETBALLS OR PLAIN CIRCLES, PER CODE
--  Run once in the Supabase SQL editor, BEFORE the updated pages go live.
--
--  Adds one setting to every code: plain_targets.
--    false (the default) — basketballs, and the court in The Fortress
--    true                — plain circles and no court: the school look
--  Set in License Admin (Targets). Read at sign-in through
--  license_plain, on vreaction.com and in Cognitivo Gym.
--
--  Every existing code stays on basketballs. Nothing already there is
--  deleted or changed. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════

alter table public.licenses add column if not exists plain_targets boolean not null default false;

create or replace function public.license_plain(p_code text, p_product text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select l.plain_targets
                     from public.licenses l
                    where upper(l.code) = upper(btrim(p_code))
                      and l.product = p_product
                      and l.active
                    limit 1), false)
$$;

revoke all on function public.license_plain(text, text) from public;
grant execute on function public.license_plain(text, text) to anon, authenticated;
