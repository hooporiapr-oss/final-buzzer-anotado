-- ═══════════════════════════════════════════════════════════════════
--  CATEGORIES (age groups) FOR THE PARADISO GYM CODES
--  Run once in the Supabase SQL editor, BEFORE the updated pages go live.
--
--  A category belongs to a code. A school gets one code per age group,
--  all with the same school name, e.g.
--      CANOVANAS-56   school "Canóvanas Basketball"   category "5-6 años"
--      CANOVANAS-78   school "Canóvanas Basketball"   category "7-8 años"
--  Everyone who enters with a code plays in its category, and the
--  school's Ritnome board gets one tab per category plus "All".
--  A code with no category works exactly as before.
--
--   1. licenses.category            set in License Admin (optional)
--   2. ritnome_standings.category   saved with each run (empty for runs before today)
--   3. license_category(code, product)
--        tells the gym page the category of a code it was just given.
--        Returns only that one word or nothing — never the school,
--        the expiry, or any other code.
--
--  Nothing is deleted or changed in what is already there. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════

alter table public.licenses          add column if not exists category text;
alter table public.ritnome_standings add column if not exists category text;

create or replace function public.license_category(p_code text, p_product text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(btrim(l.category), '')
    from public.licenses l
   where upper(l.code) = upper(btrim(p_code))
     and l.product = p_product
     and l.active
   limit 1
$$;

revoke all on function public.license_category(text, text) from public;
grant execute on function public.license_category(text, text) to anon, authenticated;
