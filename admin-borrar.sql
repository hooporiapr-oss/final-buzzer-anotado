-- ════════════════════════════════════════════════════════════════
--  BORRAR DESDE EL PANEL — una solicitud entera, o un calendario
--
--  Limpiar un equipo de prueba era abrir el editor SQL de Supabase
--  y correr un guion retocado a mano, cada vez. Eso no es una tarea
--  de administración, es una tarea de programador, y la hace el
--  admin cada semana. Ahora son dos botones en admin.html, y detrás
--  de cada botón una de estas dos funciones.
--
--  ── solicitud_borrar(id)  — el botón «Delete» de un signup ───────
--  Se lleva la solicitud y todo lo que nació de ella: la campaña,
--  sus juegos, sus promesas, el entrenador y su código, la licencia
--  y los marcadores de sus juegos. El árbol de la campaña lo baja
--  campana_borrar (hooporia-limpiar.sql); aquí NO se repite.
--
--  ── torneo_borrar(id)     — el botón «Delete» de un calendario ───
--  Se lleva el torneo, sus juegos del calendario (en cascada) y los
--  marcadores que llevaban sus números de juego.
--
--  Las dos se niegan si hay una licencia enviada o pagada por medio:
--  lo que ya se facturó no se borra desde un botón.
--
--  Se corre entero UNA VEZ en el editor SQL de Supabase. No borra
--  nada por sí solo: sólo define las funciones. Dos veces no rompe
--  nada.
-- ════════════════════════════════════════════════════════════════


-- ── Una solicitud, con todo lo que creó ──────────────────────────
create or replace function public.solicitud_borrar(p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r          record;
  v_camp     uuid;
  v_juegos   int := 0;
  v_promesas int := 0;
  v_marc     int := 0;
  v_numeros  text[];
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'reason', 'no-admin');
  end if;

  select id, team_name, program, coach_email, campaign_id
    into r
    from public.bw_requests
   where id = p_id;
  if r.id is null then
    return json_build_object('ok', false, 'reason', 'gone');
  end if;

  v_camp := r.campaign_id;

  /* LO FACTURADO NO SE BORRA DESDE UN BOTÓN. Una licencia enviada o
     pagada es dinero que ya salió de aquí; borrar su juego dejaría
     una factura apuntando a nada. Las abiertas y anuladas sí se van
     con el árbol. */
  if v_camp is not null and exists (
       select 1 from public.licencias_juego
        where campaign_id = v_camp
          and estado in ('enviada', 'pagada')) then
    return json_build_object('ok', false, 'reason', 'facturado');
  end if;

  if v_camp is not null then
    -- Se cuenta ANTES de borrar: después no queda nada que contar.
    select count(*) into v_juegos   from public.games        where campaign_id = v_camp;
    select count(*) into v_promesas from public.game_pledges where campaign_id = v_camp;

    /* LOS MARCADORES VAN POR NÚMERO DE JUEGO, no por id. El cruce es
       torneo_juegos: game_a y game_b son los dos lados de un juego
       del calendario, y cada lado puede ser de una campaña distinta.
       Sólo se borra el marcador cuando TODOS los lados enlazados son
       de esta campaña — si el otro lado es de otro equipo, su
       marcador es suyo y se queda. */
    select array_agg(distinct tj.juego)
      into v_numeros
      from public.torneo_juegos tj
      left join public.games ga on ga.id = tj.game_a
      left join public.games gb on gb.id = tj.game_b
     where (ga.campaign_id = v_camp or gb.campaign_id = v_camp)
       and coalesce(ga.campaign_id, v_camp) = v_camp
       and coalesce(gb.campaign_id, v_camp) = v_camp;

    if v_numeros is not null then
      delete from public.bw_scores where game_no = any(v_numeros);
      get diagnostics v_marc = row_count;
    end if;

    /* EL CALENDARIO SE QUEDA. torneo_juegos apunta a games con
       «on delete set null», pero borrar_arbol no mira la regla de la
       llave: borra toda fila hija que apunte al juego, y se llevaría
       el juego del calendario entero — con el otro equipo dentro.
       Se sueltan los enlaces a mano antes, que es lo que el «set
       null» habría hecho, y así el árbol no encuentra nada aquí. */
    update public.torneo_juegos tj
       set game_a = null
      from public.games g
     where g.id = tj.game_a and g.campaign_id = v_camp;
    update public.torneo_juegos tj
       set game_b = null
      from public.games g
     where g.id = tj.game_b and g.campaign_id = v_camp;

    -- El árbol entero: juegos, promesas, entrenador, código, licencias.
    perform public.campana_borrar(v_camp);
  end if;

  /* El acuse de la licencia vive en solicitudes, la tabla vieja, y
     se cruza por correo porque no hay otra llave entre las dos. Un
     correo vacío no cruza con nada: no se borra a ciegas. */
  if r.coach_email is not null and btrim(r.coach_email) <> '' then
    delete from public.solicitudes
     where lower(btrim(email)) = lower(btrim(r.coach_email));
  end if;

  delete from public.bw_requests where id = p_id;

  return json_build_object(
    'ok', true,
    'equipo', r.team_name,
    'programa', r.program,
    'juegos', v_juegos,
    'promesas', v_promesas,
    'marcadores', v_marc);
end;
$$;

grant execute on function public.solicitud_borrar(uuid) to authenticated;


-- ── Un calendario registrado ─────────────────────────────────────
create or replace function public.torneo_borrar(p_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre  text;
  v_numeros text[];
  v_juegos  int := 0;
  v_marc    int := 0;
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'reason', 'no-admin');
  end if;

  select nombre into v_nombre from public.torneos where id = p_id;
  if v_nombre is null then
    return json_build_object('ok', false, 'reason', 'gone');
  end if;

  -- Mismo freno que arriba: lo facturado no se borra desde un botón.
  if exists (
       select 1 from public.licencias_juego
        where torneo = p_id
          and estado in ('enviada', 'pagada')) then
    return json_build_object('ok', false, 'reason', 'facturado');
  end if;

  /* Los números de juego llevan el prefijo del torneo, así que son
     suyos y de nadie más: aquí no hay que mirar de quién es cada
     lado. */
  select array_agg(juego), count(*)
    into v_numeros, v_juegos
    from public.torneo_juegos
   where torneo = p_id;

  if v_numeros is not null then
    delete from public.bw_scores where game_no = any(v_numeros);
    get diagnostics v_marc = row_count;
  end if;

  -- torneo_juegos cae en cascada con el torneo.
  delete from public.torneos where id = p_id;

  return json_build_object(
    'ok', true,
    'nombre', v_nombre,
    'juegos', v_juegos,
    'marcadores', v_marc);
end;
$$;

grant execute on function public.torneo_borrar(text) to authenticated;


-- ── Un juego, jugado o no, con promesas o sin ellas ─────────────
--  juego_borrar (marcador-juego.sql) es la del entrenador, y por eso
--  se niega con un juego jugado o con promesas: alguien cuenta con
--  él. El admin limpia pruebas, y la prueba que hay que limpiar es
--  justamente la que se jugó y se prometió. Ésta es la suya.
create or replace function public.juego_borrar_admin(p_game uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rival    text;
  v_promesas int := 0;
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'reason', 'no-admin');
  end if;

  select coalesce(opponent, '?') into v_rival from public.games where id = p_game;
  if v_rival is null then
    return json_build_object('ok', false, 'reason', 'gone');
  end if;

  -- El mismo freno que las otras dos: lo facturado no se borra aquí.
  if exists (select 1 from public.licencias_juego
              where game_id = p_game and estado in ('enviada', 'pagada')) then
    return json_build_object('ok', false, 'reason', 'facturado');
  end if;

  select count(*) into v_promesas from public.game_pledges where game_id = p_game;

  /* Se suelta del calendario antes, por lo mismo que en
     solicitud_borrar: borrar_arbol no respeta el «set null» y se
     llevaría el juego del calendario con el otro equipo dentro. El
     marcador del calendario (bw_scores) no se toca: es del juego
     del calendario, no de este lado. */
  update public.torneo_juegos set game_a = null where game_a = p_game;
  update public.torneo_juegos set game_b = null where game_b = p_game;

  perform public.borrar_arbol('public.games', array[p_game]);
  delete from public.games where id = p_game;

  return json_build_object('ok', true, 'rival', v_rival, 'promesas', v_promesas);
end;
$$;

grant execute on function public.juego_borrar_admin(uuid) to authenticated;


-- ── Una campaña, desde el desplegable del admin ─────────────────
--  solicitud_borrar llega por la solicitud; pero hay campañas cuya
--  solicitud ya no existe, o que nacieron a mano con «+ New
--  campaign», y ésas no tenían botón. Ésta llega por la campaña y se
--  lleva lo mismo: la campaña con todo su árbol, los marcadores de
--  sus juegos, y la solicitud de la que salió, si queda.
create or replace function public.campana_borrar_admin(p_campaign uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre   text;
  v_juegos   int := 0;
  v_promesas int := 0;
  v_marc     int := 0;
  v_numeros  text[];
  v_correos  text[];
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'reason', 'no-admin');
  end if;

  select name into v_nombre from public.campaigns where id = p_campaign;
  if v_nombre is null then
    return json_build_object('ok', false, 'reason', 'gone');
  end if;

  -- Lo facturado no se borra desde un botón.
  if exists (select 1 from public.licencias_juego
              where campaign_id = p_campaign and estado in ('enviada', 'pagada')) then
    return json_build_object('ok', false, 'reason', 'facturado');
  end if;

  select count(*) into v_juegos   from public.games        where campaign_id = p_campaign;
  select count(*) into v_promesas from public.game_pledges where campaign_id = p_campaign;

  -- Los marcadores, sólo donde todos los lados del juego son suyos.
  select array_agg(distinct tj.juego)
    into v_numeros
    from public.torneo_juegos tj
    left join public.games ga on ga.id = tj.game_a
    left join public.games gb on gb.id = tj.game_b
   where (ga.campaign_id = p_campaign or gb.campaign_id = p_campaign)
     and coalesce(ga.campaign_id, p_campaign) = p_campaign
     and coalesce(gb.campaign_id, p_campaign) = p_campaign;
  if v_numeros is not null then
    delete from public.bw_scores where game_no = any(v_numeros);
    get diagnostics v_marc = row_count;
  end if;

  -- El calendario se queda: se sueltan los enlaces antes del árbol.
  update public.torneo_juegos tj set game_a = null
    from public.games g where g.id = tj.game_a and g.campaign_id = p_campaign;
  update public.torneo_juegos tj set game_b = null
    from public.games g where g.id = tj.game_b and g.campaign_id = p_campaign;

  -- La solicitud de la que salió, y su acuse en la tabla vieja.
  select array_agg(lower(btrim(coach_email))) into v_correos
    from public.bw_requests
   where campaign_id = p_campaign and coalesce(btrim(coach_email), '') <> '';
  if v_correos is not null then
    delete from public.solicitudes where lower(btrim(email)) = any(v_correos);
  end if;
  delete from public.bw_requests where campaign_id = p_campaign;

  perform public.campana_borrar(p_campaign);

  return json_build_object('ok', true, 'nombre', v_nombre,
    'juegos', v_juegos, 'promesas', v_promesas, 'marcadores', v_marc);
end;
$$;

grant execute on function public.campana_borrar_admin(uuid) to authenticated;
