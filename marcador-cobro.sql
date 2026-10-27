-- ════════════════════════════════════════════════════════════════
--  EL COBRO DE UN JUEGO DE MARCADOR
--
--  Lo que ya existía cobraba RETOS: challenge_report abre la puerta,
--  licencia_calculo saca el peldaño, y /challenge-notices manda los
--  avisos y factura. Todo eso cuelga de `pledges` y `challenge_id`.
--
--  Las promesas de un juego de baloncesto viven en `game_pledges` y
--  no las tocaba nada de aquello. Esto es lo mismo, apuntado a los
--  juegos:
--
--    juego_puede            — ¿este código puede cobrar este juego?
--    licencia_juego_calculo — el peldaño, y si ya se facturó
--    juego_reporte          — la puerta y la lista, en una llamada
--
--  LO QUE NO SE HACE AQUÍ, y es a propósito:
--
--  No se le cobra nada al padrino. `game_pledges` todavía tiene
--  `platform_amount` y `stripe_session` de cuando la plataforma se
--  llevaba un veinte por ciento y procesaba el pago. Ese modelo se
--  retiró. Lo que se promete va completo al programa, y la custodia
--  lo dice con todas las letras: «A los padrinos no se les cobra
--  nada». Estas funciones dejan esas dos columnas donde están y
--  nunca escriben un centavo en ellas.
--
--  Lo que se factura es la LICENCIA, y se le factura al programa.
-- ════════════════════════════════════════════════════════════════


-- ── El piso ─────────────────────────────────────────────────────
-- Por debajo de esto no se le pide dinero a nadie: el aviso costaría
-- más que la promesa. Vive aquí y no en el servidor para que haya un
-- solo sitio donde cambiarlo — estaba escrito en los dos y eso es
-- como se acaba cobrando una cifra distinta de la que se enseñó.
create or replace function public.cp_piso_centavos()
returns integer language sql immutable
as $$ select 500 $$;


-- ── ¿Puede este código cobrar este juego? ───────────────────────
-- El código maestro de bw_gate llega a todo. Un bw_code activo llega
-- a los juegos de SU campaña y a ninguno más: el código de un equipo
-- no factura los juegos de otro.
--
-- Se mira can_add_games a propósito NO: montar un calendario y cobrar
-- un juego son permisos distintos, y el de la mesa no debería hacer
-- ninguno de los dos. Un código de mesa no tiene campaña, así que no
-- llega a ningún juego por esta puerta.
create or replace function public.juego_puede(p_code text, p_game uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select exists (
    select 1 from bw_gate
     where id = 1 and code_hash = crypt(coalesce(p_code, ''), code_hash)
  ) or exists (
    select 1
      from bw_codes c
      join games g on g.id = p_game
     where coalesce(c.active, true)
       and c.campaign_id is not null
       and c.campaign_id = g.campaign_id
       and c.code_hash = crypt(coalesce(p_code, ''), code_hash)
  );
$$;

revoke all on function public.juego_puede(text, uuid) from public;
grant execute on function public.juego_puede(text, uuid) to anon, authenticated;


-- ── El peldaño ──────────────────────────────────────────────────
-- Desde cinco dólares por cada juego con promesas, y lo que fija el
-- peldaño es CUÁNTAS promesas recogió ese juego — no cuánto se
-- prometió. Por eso no es un porcentaje y nunca lo será.
--
--     hasta  10 promesas → $5
--     hasta  25          → $12
--     hasta  50          → $25
--     hasta 100          → $45
--     hasta 200          → $79
--     más de 200         → se habla; no se inventa un precio
--
-- QUÉ CUENTA COMO PROMESA RECOGIDA: la que va a producir dinero.
-- Una promesa que sale por debajo del piso no se le cobra al padrino,
-- así que no puede contar para el peldaño del programa — y un juego
-- que acabó 0 no recogió nada por mucho que tuviera doce promesas
-- apuntadas. Cobrar doce dólares por un juego que recaudó cero es
-- indefendible delante de un entrenador, y tendría razón.
create or replace function public.licencia_juego_calculo(p_game uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g          record;
  v_piso     integer := public.cp_piso_centavos();
  v_promesas integer := 0;
  v_recaudado numeric := 0;
  v_cents    integer;
  v_peldano  text;
  v_lic      record;
  v_email    text;
  v_nombre   text;
begin
  select gm.id, gm.campaign_id, gm.opponent, gm.plays_on, gm.home,
         gm.status, gm.team_points, gm.opp_points, ca.name as campana
    into g
    from public.games gm
    left join public.campaigns ca on ca.id = gm.campaign_id
   where gm.id = p_game;

  if g.id is null then
    return jsonb_build_object('ok', false, 'why', 'no-existe');
  end if;

  -- Sin marcador no hay cuenta que hacer: la promesa es por punto.
  if coalesce(g.status, '') <> 'played' or g.team_points is null then
    return jsonb_build_object('ok', false, 'why', 'sin-marcador');
  end if;

  -- Las que van a producir dinero, con el tope que puso cada padrino.
  select count(*), coalesce(sum(t), 0)
    into v_promesas, v_recaudado
    from (
      select least(gp.rate * g.team_points,
                   coalesce(gp.cap, gp.rate * g.team_points)) as t
        from public.game_pledges gp
       where gp.game_id = p_game
         and coalesce(gp.invoice_status, 'open') not in ('void', 'anulada')
    ) s
   where round(t * 100) >= v_piso;

  -- ¿Ya se facturó? Una fila anulada no cuenta: se anuló para poder
  -- volver a facturar.
  select * into v_lic
    from public.licencias_juego
   where game_id = p_game and estado <> 'anulada'
   limit 1;

  -- A quién se le factura. El correo del programa vive en coaches;
  -- si hay varios, el primero que entró.
  select c.email, coalesce(c.name, g.campana)
    into v_email, v_nombre
    from public.coaches c
   where c.campaign_id = g.campaign_id and coalesce(c.email, '') <> ''
   order by c.created_at nulls last
   limit 1;

  v_peldano := case
    when v_promesas = 0   then null
    when v_promesas <= 10 then '10'
    when v_promesas <= 25 then '25'
    when v_promesas <= 50 then '50'
    when v_promesas <= 100 then '100'
    when v_promesas <= 200 then '200'
    else 'hablar' end;

  v_cents := case v_peldano
    when '10'  then 500
    when '25'  then 1200
    when '50'  then 2500
    when '100' then 4500
    when '200' then 7900
    else null end;

  return jsonb_build_object(
    'ok',            true,
    'game_id',       g.id,
    'campaign_id',   g.campaign_id,
    'juego',         (case when g.home then 'vs ' else '@ ' end) || coalesce(g.opponent, ''),
    'plays_on',      g.plays_on,
    'puntos',        g.team_points,
    -- El marcador entero va al aviso: un padrino que lee «68–61»
    -- sabe de qué juego le hablan, y un equipo juega tres veces en
    -- un fin de semana.
    'opp_points',    g.opp_points,
    'programa',      g.campana,
    'promesas',      v_promesas,
    'recaudado',     round(v_recaudado, 2),
    'piso_centavos', v_piso,
    'peldano',       v_peldano,
    'amount_cents',  v_cents,
    -- Cobrable es las dos cosas a la vez: que haya promesas que
    -- produzcan dinero, y que el peldaño tenga precio.
    'cobrable',      (v_promesas > 0 and v_cents is not null),
    'program_name',  v_nombre,
    'program_email', v_email,
    'ya_facturada',  (v_lic.id is not null),
    'licencia',      case when v_lic.id is null then null else
                       jsonb_build_object('id', v_lic.id, 'estado', v_lic.estado,
                                          'amount_cents', v_lic.amount_cents) end
  );
end $$;

revoke all on function public.licencia_juego_calculo(uuid) from public;
grant execute on function public.licencia_juego_calculo(uuid) to anon, authenticated;


-- ── La puerta y la lista, en una llamada ────────────────────────
-- El servidor pide esto una vez y ya tiene todo: si puede, el
-- marcador, a quién facturar, y cada promesa con su cuenta hecha.
-- Hacerlo en dos llamadas deja un hueco entre comprobar y leer.
create or replace function public.juego_reporte(p_code text, p_game uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_calc jsonb;
  v_pl   jsonb;
  v_piso integer := public.cp_piso_centavos();
  v_pts  integer;
  v_how  text;
begin
  if not coalesce(public.juego_puede(p_code, p_game), false) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  v_calc := public.licencia_juego_calculo(p_game);
  if not coalesce((v_calc->>'ok')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', v_calc->>'why');
  end if;

  v_pts := (v_calc->>'puntos')::int;

  select ca.pay_how into v_how
    from public.campaigns ca
   where ca.id = (v_calc->>'campaign_id')::uuid;

  -- Cada promesa con su cuenta hecha aquí, para que el servidor no
  -- vuelva a calcular dinero por su cuenta: una fórmula en dos sitios
  -- es dos fórmulas el día que una cambie.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',     gp.id,
           'nombre', gp.padrino_name,
           'email',  gp.padrino_email,
           'rate',   gp.rate,
           'cap',    gp.cap,
           'puntos', v_pts,
           'total',  round(least(gp.rate * v_pts,
                                 coalesce(gp.cap, gp.rate * v_pts)), 2),
           'estado', gp.invoice_status
         ) order by gp.created_at), '[]'::jsonb)
    into v_pl
    from public.game_pledges gp
   where gp.game_id = p_game;

  return v_calc
      || jsonb_build_object('ok', true, 'pay_how', v_how, 'pledges', v_pl);
end $$;

revoke all on function public.juego_reporte(text, uuid) from public;
grant execute on function public.juego_reporte(text, uuid) to anon, authenticated;


-- ── Los juegos de un torneo que todavía hay que cobrar ──────────
-- Lo que recorre el barrido. Usa EL MISMO puente que torneo_tablero
-- —nombre de equipo → bw_teams → campaña, y luego (campaña, fecha,
-- rival) → games— porque tener dos versiones de esa regla es tener
-- dos el día que una cambie.
--
-- Sale un juego sólo si: se jugó, tiene promesas sin avisar, y
-- todavía no se le hizo factura. Así el barrido se puede repetir sin
-- escribirle dos veces a nadie.
create or replace function public.torneo_juegos_cobrables(p_torneo text)
returns table (game_id uuid, juego_no text, promesas bigint)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, tj.juego, count(gp.id)
    from public.torneo_juegos tj

    -- 1 · LOS DOS LADOS, no uno.
    --
    -- Esto decía `limit 1` y escogía un equipo por juego. En un juego
    -- donde los dos recaudan —que es lo que la portada anuncia:
    -- «Ganes o pierdas, tu marcador es la recaudación»— eso facturaba
    -- a uno y al otro no, y cuál de los dos lo decidía el planificador.
    -- El equipo que se quedaba fuera no salía en ninguna pantalla:
    -- sus padrinos no recibían aviso y su licencia no se cobraba.
    cross join lateral (values (btrim(tj.equipo_a), btrim(tj.equipo_b)),
                               (btrim(tj.equipo_b), btrim(tj.equipo_a)))
               as lado(equipo, rival)

    join public.bw_teams bt
      on bt.campaign_id is not null
     and lower(bt.name) = lower(coalesce(lado.equipo, ''))

    -- 2 · su juego en la campaña: misma fecha, mismo rival
    join lateral (
      select gm.id, gm.status
        from public.games gm
       where gm.campaign_id = bt.campaign_id
         and gm.plays_on    = tj.fecha
         and lower(btrim(coalesce(gm.opponent, ''))) = lower(coalesce(lado.rival, ''))
       limit 1
    ) g on true

    join public.game_pledges gp
      on gp.game_id = g.id
     and coalesce(gp.invoice_status, 'open') in ('open', 'pending')

   where tj.torneo = p_torneo
     and g.status  = 'played'
     -- Ya facturado no se vuelve a tocar. Una licencia anulada sí,
     -- que para eso se anuló.
     and not exists (
       select 1 from public.licencias_juego lj
        where lj.game_id = g.id and lj.estado <> 'anulada')

   group by g.id, tj.juego
   order by tj.juego;
$$;

revoke all on function public.torneo_juegos_cobrables(text) from public;
grant execute on function public.torneo_juegos_cobrables(text) to anon, authenticated;


-- ── Lo que la factura escribe de vuelta ─────────────────────────
-- licencias_juego se creó antes de que hubiera factura, así que no
-- tenía dónde guardar la de Stripe. Son las mismas tres columnas que
-- lleva `licencias` desde siempre: sin ellas no hay manera de abrir
-- la factura de un juego ni de saber cuándo vence.
alter table public.licencias_juego
  add column if not exists stripe_invoice_id text,
  add column if not exists stripe_hosted_url text,
  add column if not exists due_at            timestamptz;


-- ── Un juego no se factura dos veces ────────────────────────────
-- El índice es lo único que lo impide de verdad: ahora hay dos
-- caminos que pueden llegar a la vez —el botón de un juego y el
-- barrido de un torneo— y entre calcular e insertar cabe el otro.
create unique index if not exists licencias_juego_una_por_juego
  on public.licencias_juego (game_id)
  where estado <> 'anulada';


-- ── Comprobar que quedó bien ────────────────────────────────────
--
--   select public.licencia_juego_calculo('<game uuid>');
--
-- Un juego sin marcador da {"ok":false,"why":"sin-marcador"}.
-- Un juego jugado sin promesas da cobrable=false y amount_cents=null.
-- Uno con doce promesas de verdad da peldano '25' y amount_cents 1200.
