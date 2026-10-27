-- ════════════════════════════════════════════════════════════════
--  DE QUIÉN ES CADA TORNEO
--
--  bw_register_tournament comprueba que un código PUEDA montar
--  calendarios. No comprueba QUÉ puede montar — y registrar es
--  destructivo:
--
--      delete from torneo_juegos where torneo = p_id;
--
--  El id sale del nombre, así que dos entrenadores que llamen «Copa
--  Navideña» a sus torneos de diciembre escriben los dos en
--  `copa-navidena`. El segundo que registre borra el calendario del
--  primero entero, sin aviso: los marcadores se quedan en la base
--  pero los juegos a los que pertenecían desaparecen.
--
--  Mientras el único código capaz de montar fuera el de casa, esto
--  era teórico. En cuanto un entrenador tenga uno, deja de serlo.
--
--  LA REGLA:
--
--    · el código maestro llega a todo — hace falta para arreglarle
--      las cosas a la gente
--    · un bw_code registra un torneo que no existe, o uno que ya es
--      suyo
--    · cualquier otra cosa se niega, y se dice de quién es, para que
--      el que llega segundo le cambie el nombre al suyo
--
--  SIN DUEÑO QUIERE DECIR DE LA CASA. Los torneos registrados antes
--  de esto tienen la columna vacía, y un torneo sin dueño sólo lo
--  toca el código maestro. Al revés —vacío quiere decir de nadie,
--  cójalo quien quiera— cualquier entrenador podría sobrescribir
--  Basketween el primer día.
-- ════════════════════════════════════════════════════════════════


-- ── La columna ──────────────────────────────────────────────────
-- on delete set null: si se borra el código de un entrenador, su
-- torneo pasa a ser de la casa y deja de poder tocarlo. Es lo que se
-- quiere decir al borrarle el código a alguien.
alter table public.torneos
  add column if not exists codigo uuid references public.bw_codes(id) on delete set null;

create index if not exists torneos_codigo on public.torneos (codigo);


-- ── Qué código es éste ──────────────────────────────────────────
-- Devuelve la fila de bw_codes que corresponde, o null si el que
-- llega es el maestro (que no vive en bw_codes) o no es ninguno.
create or replace function public.bw_code_id(p_code text)
returns uuid
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select id from public.bw_codes
   where coalesce(active, true)
     and code_hash = crypt(coalesce(p_code, ''), code_hash)
   limit 1;
$$;

revoke all on function public.bw_code_id(text) from public;
grant execute on function public.bw_code_id(text) to anon, authenticated;


create or replace function public.bw_es_maestro(p_code text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select exists (
    select 1 from public.bw_gate
     where id = 1 and code_hash = crypt(coalesce(p_code, ''), code_hash)
  );
$$;

revoke all on function public.bw_es_maestro(text) from public;
grant execute on function public.bw_es_maestro(text) to anon, authenticated;


-- ── Registrar, ahora con dueño ──────────────────────────────────
-- Igual que antes salvo el bloque de propiedad y la columna que se
-- escribe. Todo lo demás —el choque de prefijos, el reemplazo de los
-- juegos, el nullif de la fecha vacía— está sin tocar.
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
  v_ok        boolean;
  v_choque    text;
  v_n         int;
  v_maestro   boolean;
  v_code_id   uuid;
  v_existe    boolean;
  v_dueno     uuid;
  v_de_quien  text;
begin
  if coalesce(p_id, '') = '' or coalesce(p_nombre, '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'faltan-datos');
  end if;

  -- Puede montar calendarios, sí o no.
  select public.bw_can_build(p_code) into v_ok;
  if not coalesce(v_ok, false) then
    if coalesce(public.bw_check(p_code), false) then
      return jsonb_build_object('ok', false, 'reason', 'build');
    end if;
    return jsonb_build_object('ok', false, 'reason', 'code');
  end if;

  -- ── Y AHORA: PUEDE MONTAR ÉSTE ────────────────────────────────
  v_maestro := coalesce(public.bw_es_maestro(p_code), false);
  v_code_id := public.bw_code_id(p_code);

  select t.codigo into v_dueno from public.torneos t where t.id = p_id;
  v_existe := FOUND;

  if v_existe and not v_maestro then
    if v_dueno is null or v_dueno is distinct from v_code_id then
      select c.label into v_de_quien from public.bw_codes c where c.id = v_dueno;
      return jsonb_build_object(
        'ok', false, 'reason', 'ajeno',
        -- Sin dueño es de la casa, y decir el nombre de un código
        -- ajeno a quien no es su dueño sería enseñar de más.
        'dueno', coalesce(v_de_quien, 'la casa'));
    end if;
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

  insert into public.torneos (id, nombre, pueblo, prefijo, juegos, tocado, codigo)
  values (p_id, p_nombre, nullif(p_pueblo, ''), p_prefijo,
          coalesce(jsonb_array_length(p_juegos), 0), now(), v_code_id)
  on conflict (id) do update
    set nombre  = excluded.nombre,
        pueblo  = excluded.pueblo,
        prefijo = excluded.prefijo,
        juegos  = excluded.juegos,
        tocado  = now(),
        -- El dueño no cambia al volver a registrar: que el maestro
        -- le arregle el calendario a un entrenador no se lo quita.
        -- Y uno sin dueño sigue sin dueño.
        codigo  = coalesce(public.torneos.codigo, excluded.codigo);

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
--   select t.id, t.nombre, coalesce(c.label, 'la casa') as dueno
--     from public.torneos t
--     left join public.bw_codes c on c.id = t.codigo
--    order by t.creado desc;
--
-- Los torneos de antes de esto salen como «la casa», que es lo
-- correcto: sólo el código maestro los toca.
