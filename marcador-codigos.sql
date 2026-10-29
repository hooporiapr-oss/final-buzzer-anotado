-- ════════════════════════════════════════════════════════════════
--  CÓDIGOS DE MESA
--
--  Hasta aquí marcadorpr tenía UN código y nada más. bw_check mira
--  una sola fila:
--
--      select exists (select 1 from bw_gate
--                      where id = 1 and code_hash = crypt(...));
--
--  bw_codes existe, el admin escribe filas en ella, y bw_check nunca
--  la mira. De modo que dar un código a quien apunta marcadores es
--  dar EL código: el mismo que abre todos los torneos, y el mismo con
--  el que bw_register_tournament rehace un calendario entero.
--
--  Un voluntario en la mesa de Copa Puerto Rico no debería poder
--  borrar el calendario de Copa Puerto Rico. Aquí se separan las dos
--  cosas:
--
--    bw_check      — ¿puede apuntar marcadores?   (gate, o un bw_code activo)
--    bw_can_build  — ¿puede rehacer el calendario? (gate, o un bw_code
--                                                   activo con can_add_games)
--
--  El código maestro de bw_gate sigue valiendo para todo, así que
--  nada de lo que ya funciona deja de funcionar.
-- ════════════════════════════════════════════════════════════════


-- ── Apuntar marcadores ──────────────────────────────────────────
-- Se añade bw_codes a lo que ya había. El gate queda primero a
-- propósito: es una sola fila y un solo crypt, y es el código que más
-- se usa.
--
-- OJO AL COSTE: crypt() con bcrypt es lento a propósito, y comparar
-- contra bw_codes es un crypt POR FILA. Con decenas de códigos no se
-- nota; con cientos sí. Apagar los de torneos que ya pasaron es a la
-- vez la medida de seguridad y la de velocidad — por eso el filtro
-- por activo va antes que el crypt.
create or replace function public.bw_check(p_code text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
  select exists (
    select 1 from bw_gate
     where id = 1
       and code_hash = crypt(coalesce(p_code, ''), code_hash)
  ) or exists (
    select 1 from bw_codes
     where coalesce(active, true)
       and code_hash is not null
       and code_hash = crypt(coalesce(p_code, ''), code_hash)
  );
$function$;

revoke all on function public.bw_check(text) from public;
grant execute on function public.bw_check(text) to anon, authenticated;


-- ── Rehacer un calendario ───────────────────────────────────────
-- Lo mismo, pero exigiendo can_add_games. Es la columna que el admin
-- lleva enseñando desde siempre como «can build the schedule» /
-- «scores only» sin que nada la mirara.
create or replace function public.bw_can_build(p_code text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
  select exists (
    select 1 from bw_gate
     where id = 1
       and code_hash = crypt(coalesce(p_code, ''), code_hash)
  ) or exists (
    select 1 from bw_codes
     where coalesce(active, true)
       and coalesce(can_add_games, false)
       and code_hash is not null
       and code_hash = crypt(coalesce(p_code, ''), code_hash)
  );
$function$;

revoke all on function public.bw_can_build(text) from public;
grant execute on function public.bw_can_build(text) to anon, authenticated;


-- ── Registrar un torneo ─────────────────────────────────────────
-- Idéntica a la de marcador-torneos.sql salvo una línea: comprueba
-- bw_can_build y no bw_check. Registrar REEMPLAZA el calendario —
-- borra sus juegos y escribe los nuevos — y eso no es cosa de la
-- mesa.
create or replace function public.bw_register_tournament(
  p_code    text,
  p_id      text,
  p_nombre  text,
  p_pueblo  text,
  p_prefijo text,
  p_juegos  jsonb          -- [{no,cat,stage,date,time,court,a,b}, ...]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok      boolean;
  v_choque  text;
  v_n       int;
begin
  if coalesce(p_id, '') = '' or coalesce(p_nombre, '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'faltan-datos');
  end if;

  -- LA ÚNICA LÍNEA QUE CAMBIA. Un código de mesa pasa bw_check y no
  -- pasa de aquí: se devuelve 'build' y no 'code', para que el
  -- constructor pueda decir «ese código apunta marcadores pero no
  -- monta calendarios» en vez de «código incorrecto».
  select public.bw_can_build(p_code) into v_ok;
  if not coalesce(v_ok, false) then
    if coalesce(public.bw_check(p_code), false) then
      return jsonb_build_object('ok', false, 'reason', 'build');
    end if;
    return jsonb_build_object('ok', false, 'reason', 'code');
  end if;

  -- EL CHOQUE DE PREFIJOS, dicho en voz alta.
  --
  -- El prefijo sale de las iniciales del nombre, así que «Copa Loíza»
  -- y «Copa Lajas» son los dos CL y sus juegos se llamarían igual:
  -- CL-7 en los dos. Los marcadores se guardan por número, de modo
  -- que el segundo torneo nacería con los marcadores del primero
  -- encima — que es justo lo que el prefijo se inventó para evitar.
  --
  -- No se bloquea el registro: se devuelve el aviso y el constructor
  -- lo enseña. Quien monta el calendario puede cambiarle el nombre al
  -- torneo ahí mismo, que es la única persona que puede arreglarlo y
  -- el único momento en que es barato.
  select id into v_choque
    from public.torneos
   where prefijo = p_prefijo and id <> p_id
   limit 1;

  insert into public.torneos (id, nombre, pueblo, prefijo, juegos, tocado)
  values (p_id, p_nombre, nullif(p_pueblo, ''), p_prefijo,
          coalesce(jsonb_array_length(p_juegos), 0), now())
  on conflict (id) do update
    set nombre  = excluded.nombre,
        pueblo  = excluded.pueblo,
        prefijo = excluded.prefijo,
        juegos  = excluded.juegos,
        tocado  = now();

  delete from public.torneo_juegos where torneo = p_id;

  insert into public.torneo_juegos
    (torneo, juego, cat, etapa, fecha, hora, cancha, equipo_a, equipo_b)
  select p_id,
         j->>'no',
         nullif(j->>'cat', ''),
         nullif(j->>'stage', ''),
         -- Un juego que no cupo en el horario viene sin fecha, y eso
         -- es un dato y no un error: el constructor lo enseña en
         -- rojo. nullif evita que '' reviente el cast a date.
         (nullif(j->>'date', ''))::date,
         nullif(j->>'time', ''),
         nullif(j->>'court', ''),
         nullif(j->>'a', ''),
         nullif(j->>'b', '')
    from jsonb_array_elements(coalesce(p_juegos, '[]'::jsonb)) as j
   where coalesce(j->>'no', '') <> '';

  get diagnostics v_n = row_count;

  return jsonb_build_object(
    'ok', true,
    'torneo', p_id,
    'juegos', v_n,
    'choque', v_choque          -- null si el prefijo es sólo suyo
  );
end $$;

revoke all on function public.bw_register_tournament(
  text, text, text, text, text, jsonb) from public;
grant execute on function public.bw_register_tournament(
  text, text, text, text, text, jsonb) to anon, authenticated;


-- ── Comprobar que quedó bien ────────────────────────────────────
--
--   select label,
--          campaign_id is null as de_torneo,
--          coalesce(can_add_games, false) as puede_montar,
--          coalesce(active, true)         as activo
--     from public.bw_codes
--    order by de_torneo desc, label;
--
-- Y con un código de mesa recién hecho, sin marcar «can build»:
--
--   select public.bw_check(''),      -- true  — apunta marcadores
--          public.bw_can_build('');  -- false — no monta calendarios
--
-- Si bw_codes no tiene columna `active`, las dos funciones fallan al
-- crearse y Postgres lo dice por su nombre. En ese caso:
--
--   alter table public.bw_codes add column active boolean default true;
