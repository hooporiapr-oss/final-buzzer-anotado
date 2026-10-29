-- ════════════════════════════════════════════════════════════════
--  EL JUEGO DEL CALENDARIO Y EL JUEGO QUE SE PROMETE
--
--  Son dos filas distintas y nada las unía.
--
--  `torneo_juegos` es lo que escribe el constructor: el calendario.
--  `games` es a lo que se engancha una promesa, y es lo que lee la
--  página donde un padrino promete. Registrar un torneo escribía la
--  primera y nunca la segunda, así que un entrenador podía montar su
--  juego, registrarlo, y sus padrinos abrían un tablero vacío.
--
--  Las dos mitades se buscaban por campaña, fecha y rival — tres
--  campos de texto que cambian. Por eso el admin tiene un estado
--  «not linked»: se escribió creyendo que era un aviso raro, y es el
--  estado normal de todo juego que registra un entrenador.
--
--  Esto arregla las dos cosas de una vez: al registrar se crea el
--  juego que se promete, y su id se guarda EN la fila del calendario.
--  La unión deja de ser una adivinanza sobre texto y pasa a ser una
--  llave.
--
--  UN JUEGO DEL CALENDARIO SON HASTA DOS JUEGOS DE CAMPAÑA. Canóvanas
--  contra Arecibo es una fila del calendario y dos filas de `games`,
--  una por campaña, cada una viendo al otro como rival. Es lo mismo
--  que descubrió el cobro por los dos lados: los dos equipos recaudan
--  sobre sus propios puntos.
-- ════════════════════════════════════════════════════════════════


-- ── Las dos llaves ──────────────────────────────────────────────
-- on delete set null y no cascade: si alguien borra un juego de
-- campaña, el calendario no se queda sin su fila — se queda sin su
-- enlace, que es justo lo que torneo_enlazar sabe volver a poner.
alter table public.torneo_juegos
  add column if not exists game_a uuid references public.games(id) on delete set null,
  add column if not exists game_b uuid references public.games(id) on delete set null;

create index if not exists torneo_juegos_game_a on public.torneo_juegos (game_a);
create index if not exists torneo_juegos_game_b on public.torneo_juegos (game_b);


-- ── Un lado ─────────────────────────────────────────────────────
-- Devuelve el juego de campaña de ESE equipo en ESE juego, creándolo
-- si no existe. Tres caminos, en este orden:
--
--   1 · ya teníamos su id → se actualiza lo que haya cambiado y se
--       devuelve el mismo. Mover una fecha no puede costarle al
--       entrenador las promesas que ya recogió.
--   2 · no teníamos id pero hay un juego que encaja → se adopta. Es
--       el caso de los torneos que existían antes de esto, y de los
--       juegos creados a mano desde el otro panel.
--   3 · no hay nada → se crea.
create or replace function public.tj_enlazar_lado(
  p_campaign uuid,
  p_rival    text,
  p_fecha    date,
  p_hora     text,
  p_cancha   text,
  p_casa     boolean,
  p_previo   uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_campaign is null or coalesce(btrim(p_rival), '') = '' then
    return null;
  end if;

  -- 1 · el que ya era
  if p_previo is not null then
    update public.games
       set opponent = btrim(p_rival),
           plays_on = p_fecha,
           tip_time = nullif(btrim(coalesce(p_hora, '')), ''),
           venue    = nullif(btrim(coalesce(p_cancha, '')), ''),
           home     = p_casa
     where id = p_previo
       and campaign_id = p_campaign
       -- Un juego ya jugado no se toca: su marcador y sus promesas
       -- están cerrados, y reescribirle la fecha desde un calendario
       -- que alguien rehizo sería mover el suelo debajo de ellas.
       and coalesce(status, 'scheduled') = 'scheduled'
     returning id into v_id;

    if v_id is not null then return v_id; end if;

    -- Existe pero ya se jugó: se devuelve igual, sin tocarlo.
    select id into v_id from public.games
     where id = p_previo and campaign_id = p_campaign;
    if v_id is not null then return v_id; end if;
  end if;

  -- 2 · uno que encaja, de antes de que esto existiera
  select g.id into v_id
    from public.games g
   where g.campaign_id = p_campaign
     and g.plays_on    = p_fecha
     and lower(btrim(coalesce(g.opponent, ''))) = lower(btrim(p_rival))
     and coalesce(g.status, 'scheduled') <> 'cancelled'
   order by g.created_at
   limit 1;
  if v_id is not null then return v_id; end if;

  -- 3 · no hay, se crea
  insert into public.games (campaign_id, opponent, plays_on, tip_time, venue, home,
                            status, made_by)
  values (p_campaign, btrim(p_rival), p_fecha,
          nullif(btrim(coalesce(p_hora, '')), ''),
          nullif(btrim(coalesce(p_cancha, '')), ''),
          p_casa, 'scheduled', 'marcadorpr')
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.tj_enlazar_lado(uuid, text, date, text, text, boolean, uuid)
  from public;


-- ── Todo un torneo ──────────────────────────────────────────────
-- Recorre su calendario y engancha cada lado que tenga campaña. Sirve
-- para dos momentos distintos:
--
--   · al registrar, que es cuando nacen los juegos
--   · después, cuando un equipo que no recaudaba se inscribe a mitad
--     de torneo. Ese equipo no tenía campaña el día del registro, así
--     que no se le creó juego; esto se lo crea sin tocar los demás.
--
-- Los huecos del cuadro —«Ganador CPR-1», «1º Grupo A»— no son
-- equipos y no encuentran campaña, así que se saltan solos.
create or replace function public.torneo_enlazar(p_torneo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r        record;
  v_ca     uuid;
  v_cb     uuid;
  v_ga     uuid;
  v_gb     uuid;
  v_nuevos int := 0;
  v_total  int := 0;
begin
  for r in
    select * from public.torneo_juegos where torneo = p_torneo order by juego
  loop
    -- lado A: su rival es el de la derecha, y juega de local
    select bt.campaign_id into v_ca
      from public.bw_teams bt
     where bt.campaign_id is not null
       and lower(bt.name) = lower(btrim(coalesce(r.equipo_a, '')))
     limit 1;

    -- lado B: su rival es el de la izquierda, y juega de visitante
    select bt.campaign_id into v_cb
      from public.bw_teams bt
     where bt.campaign_id is not null
       and lower(bt.name) = lower(btrim(coalesce(r.equipo_b, '')))
     limit 1;

    v_ga := public.tj_enlazar_lado(v_ca, r.equipo_b, r.fecha, r.hora, r.cancha, true,  r.game_a);
    v_gb := public.tj_enlazar_lado(v_cb, r.equipo_a, r.fecha, r.hora, r.cancha, false, r.game_b);

    if v_ga is not null and r.game_a is null then v_nuevos := v_nuevos + 1; end if;
    if v_gb is not null and r.game_b is null then v_nuevos := v_nuevos + 1; end if;
    if v_ga is not null then v_total := v_total + 1; end if;
    if v_gb is not null then v_total := v_total + 1; end if;

    update public.torneo_juegos
       set game_a = v_ga, game_b = v_gb
     where torneo = p_torneo and juego = r.juego;
  end loop;

  return jsonb_build_object('ok', true, 'enlazados', v_total, 'nuevos', v_nuevos);
end $$;

revoke all on function public.torneo_enlazar(text) from public;
grant execute on function public.torneo_enlazar(text) to authenticated;


-- ── Registrar, ahora enlazando ──────────────────────────────────
-- Igual que en marcador-duenos.sql salvo dos cosas: antes de borrar
-- el calendario se guarda qué juego de campaña tenía cada número, y
-- al final se enlaza.
--
-- EL NÚMERO ES LA IDENTIDAD. Rehacer un calendario borra y reescribe
-- sus filas, así que sin este paso un entrenador que mueve una hora
-- perdería el enlace de todos sus juegos y sus padrinos se quedarían
-- prometiendo sobre filas huérfanas. CPR-1 sigue siendo CPR-1.
create or replace function public.bw_register_tournament(
  p_code    text,
  p_id      text,
  p_nombre  text,
  p_pueblo  text,
  p_prefijo text,
  p_juegos  jsonb
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
  v_previo    jsonb;
  v_enlace    jsonb;
begin
  if coalesce(p_id, '') = '' or coalesce(p_nombre, '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'faltan-datos');
  end if;

  select public.bw_can_build(p_code) into v_ok;
  if not coalesce(v_ok, false) then
    if coalesce(public.bw_check(p_code), false) then
      return jsonb_build_object('ok', false, 'reason', 'build');
    end if;
    return jsonb_build_object('ok', false, 'reason', 'code');
  end if;

  -- ── De quién es ───────────────────────────────────────────────
  v_maestro := coalesce(public.bw_es_maestro(p_code), false);
  v_code_id := public.bw_code_id(p_code);

  select t.codigo into v_dueno from public.torneos t where t.id = p_id;
  v_existe := FOUND;

  if v_existe and not v_maestro then
    if v_dueno is null or v_dueno is distinct from v_code_id then
      select c.label into v_de_quien from public.bw_codes c where c.id = v_dueno;
      return jsonb_build_object('ok', false, 'reason', 'ajeno',
                                'dueno', coalesce(v_de_quien, 'la casa'));
    end if;
  end if;

  -- EL CHOQUE DE PREFIJOS, dicho en voz alta. Dos torneos con las
  -- mismas iniciales numerarían sus juegos igual, y los marcadores se
  -- guardan por número.
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
        codigo  = coalesce(public.torneos.codigo, excluded.codigo);

  -- Qué juego de campaña tenía cada número, antes de borrar nada.
  select coalesce(jsonb_object_agg(juego, jsonb_build_array(game_a, game_b)), '{}'::jsonb)
    into v_previo
    from public.torneo_juegos
   where torneo = p_id;

  delete from public.torneo_juegos where torneo = p_id;

  insert into public.torneo_juegos
    (torneo, juego, cat, etapa, fecha, hora, cancha, equipo_a, equipo_b, game_a, game_b)
  select p_id,
         j->>'no',
         nullif(j->>'cat', ''),
         nullif(j->>'stage', ''),
         -- Un juego que no cupo en el horario viene sin fecha, y eso
         -- es un dato y no un error.
         (nullif(j->>'date', ''))::date,
         nullif(j->>'time', ''),
         nullif(j->>'court', ''),
         nullif(j->>'a', ''),
         nullif(j->>'b', ''),
         nullif(v_previo -> (j->>'no') ->> 0, '')::uuid,
         nullif(v_previo -> (j->>'no') ->> 1, '')::uuid
    from jsonb_array_elements(coalesce(p_juegos, '[]'::jsonb)) as j
   where coalesce(j->>'no', '') <> '';

  get diagnostics v_n = row_count;

  -- Y ahora sí: los juegos que se prometen.
  v_enlace := public.torneo_enlazar(p_id);

  return jsonb_build_object(
    'ok', true,
    'torneo', p_id,
    'juegos', v_n,
    'choque', v_choque,
    'enlazados', v_enlace->'enlazados',
    'nuevos',    v_enlace->'nuevos'
  );
end $$;

revoke all on function public.bw_register_tournament(
  text, text, text, text, text, jsonb) from public;
grant execute on function public.bw_register_tournament(
  text, text, text, text, text, jsonb) to anon, authenticated;


-- ── Comprobar que quedó bien ────────────────────────────────────
--
--   select tj.juego, tj.equipo_a, tj.equipo_b, tj.game_a, tj.game_b
--     from public.torneo_juegos tj
--    where tj.torneo = 'copa-puerto-rico'
--    order by tj.juego;
--
-- Un lado con campaña lleva su uuid; un lado sin campaña, y los
-- huecos del cuadro, van en null. Para enganchar un equipo que se
-- inscribió después:
--
--   select public.torneo_enlazar('copa-puerto-rico');
