-- ════════════════════════════════════════════════════════════════
--  EL REPORTE DEL RETO — challenge_report(p_code, p_challenge)
--
--  Lo que el programa se lleva cuando cierra la ventana: el reto, los
--  puntos de cada nene, y cada padrino con su tarifa, su tope y su
--  total.
--
--  ── Lo que NO lee, a propósito ────────────────────────────────────
--  La tabla 'pledges' todavía carga con todo el aparato de cobro de
--  antes del cambio de modelo: stripe_invoice_id, pay_link_url,
--  pay_link_id, platform_amount, paid_at, reminded_at,
--  reminder_count. Y 'challenges' tiene team_share_pct y billed_at.
--  Esta función no toca ninguna. Si algún día aparece una de ésas
--  aquí, algo se torció.
--
--  Y hay una que es trampa: 'amount'. En el modelo viejo el padrino
--  pagaba la promesa MÁS un 10% nuestro por encima — en el servidor
--  era team = paid / 1.10 — así que 'amount' lleva un recargo que ya
--  no existe y 'team_amount' es la promesa de verdad. Usar 'amount'
--  aquí le cobraría al padrino un 10% que nadie le prometió.
--
--  Por eso el total se calcula al vuelo: tarifa × puntos, con el tope
--  aplicado. Es lo que dicen los términos y es lo único que se le
--  puede pedir a un padrino.
--
--  ── Los puntos ───────────────────────────────────────────────────
--  Dos formatos escriben en dos sitios: el de cuatro cuartos pone una
--  fila por cuarto en challenge_quarters, y la corrida suelta pone una
--  en challenge_runs. Se suman los cuartos si hay; si no, se toma la
--  corrida. Nunca los dos, que sería contar los puntos dos veces.
--
--  ── La puerta ────────────────────────────────────────────────────
--  El código del entrenador, con la misma builder_check que usa el
--  resto. Con un código bueno pero de otro programa contesta 'not
--  your campaign' — no se dice cuál de las dos cosas falló, que
--  enumerar campañas ajenas por el mensaje de error sería un regalo.
-- ════════════════════════════════════════════════════════════════

create or replace function public.challenge_report(p_code text, p_challenge uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chk   json;
  v_reto  record;
  v_camp  record;
  v_coach record;
  v_mine  boolean := false;
  v_jug   json;
  v_prom  json;
  v_total numeric := 0;
  v_count int     := 0;
begin
  if p_code is null or p_challenge is null then
    return json_build_object('ok', false, 'error', 'code and challenge are required');
  end if;

  -- Quién es, y qué campañas son suyas.
  v_chk := to_json(public.builder_check(p_code));
  if v_chk is null or coalesce((v_chk ->> 'ok')::boolean, false) = false then
    return json_build_object('ok', false, 'error', 'bad code');
  end if;

  select ch.id, ch.campaign_id, ch.name, ch.game, ch.status,
         ch.opens_at, ch.closes_at
    into v_reto
    from public.challenges ch
   where ch.id = p_challenge;

  if not found then
    return json_build_object('ok', false, 'error', 'no such challenge');
  end if;

  select exists (
    select 1
      from json_array_elements(v_chk -> 'campaigns') c
     where (c ->> 'id')::uuid = v_reto.campaign_id
  ) into v_mine;

  if not v_mine then
    return json_build_object('ok', false, 'error', 'not your campaign');
  end if;

  select c.id, c.name into v_camp
    from public.campaigns c
   where c.id = v_reto.campaign_id;

  /* ── A quién le escribe un padrino que no sabe cómo pagar ────────
     El aviso le dice al padrino que le paga al programa directo. Si
     no le dice a QUIÉN, se queda con la pregunta y el único correo
     que tiene delante es el nuestro — y nosotros no tenemos nada que
     cobrarle ni cómo ayudarle.

     Se saca el entrenador POR SU CÓDIGO, no el primero de la
     campaña: una campaña puede tener varios, y el que importa es el
     que acaba de cerrar el evento y mandar los avisos. Es su equipo
     y es él quien recibe el dinero.

     Puede no salir ninguno —con un admin_code no hay fila en
     coaches— y entonces va en null, que el aviso sabe tratar: sin
     contacto vuelve a decir sólo «el programa te dirá cómo», que es
     verdad aunque sea menos útil. Lo que no hace nunca es imprimir
     un hueco donde iba un correo.

     campaigns no tiene columna de contacto, así que no hay dónde
     más buscarlo. */
  select co.name, co.email into v_coach
    from public.coaches co
   where upper(btrim(co.access_code)) = upper(btrim(p_code))
     and co.campaign_id = v_reto.campaign_id
   limit 1;

  /* ── Todo en una consulta ────────────────────────────────────────
     Antes esto usaba una tabla temporal para los puntos. Mala idea
     dentro de una función security definer con search_path fijado:
     la visibilidad de una temp table ahí es frágil, y una temp table
     que tape a una real es justamente el agujero que search_path
     fijado viene a cerrar. Con CTEs no hay nada que tapar.

     ── Los puntos ──
     Dos formatos escriben en dos sitios: el de cuatro cuartos pone
     una fila por cuarto en challenge_quarters, y la corrida suelta
     pone una en challenge_runs. Se suman los cuartos si hay; si no,
     se toma la corrida. Nunca los dos, que sería contar doble.

     ── El total ──
     least(tarifa × puntos, tope). Sin tope, la tarifa por los puntos.
     Calculado al vuelo y nunca leído de 'amount', por lo que dice la
     cabecera de este fichero. */
  with pts as (
    select p.id                           as player_id,
           coalesce(q.puntos, r.puntos, 0) as puntos,
           coalesce(q.cuartos, 0)          as cuartos
      from public.players p
      left join (
        select cq.player_id,
               sum(cq.points)::int as puntos,
               count(*)::int       as cuartos
          from public.challenge_quarters cq
         where cq.challenge_id = p_challenge
         group by cq.player_id
      ) q on q.player_id = p.id
      left join (
        select cr.player_id, max(cr.points)::int as puntos
          from public.challenge_runs cr
         where cr.challenge_id = p_challenge
         group by cr.player_id
      ) r on r.player_id = p.id
     where p.campaign_id = v_reto.campaign_id
  ),
  /* Tres campos que el reporte no pinta y el aviso necesita: id para
     saber qué fila marcar, lang para escribirle al padrino en el
     idioma en que prometió, y estado para no avisar dos veces al
     mismo.

     Van aquí y no en una función aparte a propósito. El aviso tiene
     que decir el MISMO número que el entrenador acaba de ver en el
     reporte; si el correo lo calculara por su cuenta, bastaría una
     diferencia —los cuartos sumados en un sitio y la corrida en el
     otro— para que el padrino reciba una cifra que el entrenador no
     vio nunca. Una sola cuenta, y es ésta. */
  prom as (
    select
      pg.id             as id,
      pg.lang           as idioma,
      coalesce(pg.invoice_status, 'open') as estado,
      pl.name           as jugador,
      pg.sponsor_name   as padrino,
      pg.sponsor_email  as correo,
      pg.rate_per_point as tarifa,
      pg.cap            as tope,
      coalesce(t.puntos, 0) as puntos,
      round(
        least(
          pg.rate_per_point * coalesce(t.puntos, 0),
          coalesce(pg.cap, pg.rate_per_point * coalesce(t.puntos, 0))
        )::numeric, 2) as total
      from public.pledges pg
      join public.players pl on pl.id = pg.player_id
      left join pts t        on t.player_id = pg.player_id
     where pg.challenge_id = p_challenge
       and coalesce(pg.invoice_status, 'open') <> 'void'
  ),
  /* El resumen por jugador incluye a los que no jugaron: un nene con
     padrinos y sin corrida es justo lo que el programa necesita ver,
     y esconderlo sería esconder el único problema que un reporte
     puede enseñar.

     Y también a los sacados de la plantilla. Primero filtraba por
     status <> 'removed', y eso rompía las cuentas: el total de abajo
     sale de TODAS las promesas del reto, así que si un nene sacado
     tenía padrinos, la suma de los totales por jugador no cuadraba
     con el total de arriba. Un reporte cuyas dos cifras no cuadran no
     lo vuelve a creer nadie. Sale con sus puntos en cero, que es la
     verdad: no jugó. */
  jug as (
    select
      pl.name                as nombre,
      coalesce(t.puntos, 0)  as puntos,
      coalesce(t.cuartos, 0) as cuartos,
      count(pg.id)::int      as promesas,
      round(coalesce(sum(
        least(
          pg.rate_per_point * coalesce(t.puntos, 0),
          coalesce(pg.cap, pg.rate_per_point * coalesce(t.puntos, 0))
        )), 0)::numeric, 2)  as total
      from public.players pl
      left join pts t on t.player_id = pl.id
      left join public.pledges pg
        on  pg.player_id    = pl.id
        and pg.challenge_id = p_challenge
        and coalesce(pg.invoice_status, 'open') <> 'void'
     where pl.campaign_id = v_reto.campaign_id
     group by pl.name, t.puntos, t.cuartos
  )
  select
    coalesce((select json_agg(x order by x.jugador, x.padrino) from prom x), '[]'::json),
    coalesce((select sum(x.total) from prom x), 0),
    (select count(*)::int from prom),
    coalesce((select json_agg(y order by y.nombre) from jug y), '[]'::json)
  into v_prom, v_total, v_count, v_jug;

  return json_build_object(
    'ok',        true,
    'campaign',  v_camp.name,
    /* El contacto del programa, para el aviso. Los dos campos pueden
       venir en null y el aviso lo sabe. */
    'contact',   json_build_object(
      'name',  v_coach.name,
      'email', v_coach.email
    ),
    'challenge', json_build_object(
      'name',      v_reto.name,
      'game',      v_reto.game,
      'status',    v_reto.status,
      'opens_at',  v_reto.opens_at,
      'closes_at', v_reto.closes_at
    ),
    'players',   v_jug,
    'pledges',   v_prom,
    'count',     v_count,
    'pledged',   round(v_total, 2),
    'generated', now()
  );
end;
$$;

revoke all on function public.challenge_report(text, uuid) from public;
grant execute on function public.challenge_report(text, uuid) to anon, authenticated;

comment on function public.challenge_report(text, uuid) is
  'Reporte final de un reto: los puntos de cada jugador y cada promesa con su total, calculado al vuelo (tarifa x puntos, con tope). No lee amount ni platform_amount: amount lleva el recargo del 10% del modelo viejo. Nada de cobros: Hooporia no recibe pagos.';

-- ════════════════════════════════════════════════════════════════
--  LOS RETOS DE UN ENTRENADOR — challenge_list(p_code)
--
--  El reporte necesita que el entrenador escoja un reto, y para eso
--  hay que poder enseñárselos. cp_reto_vivo sólo da el que está
--  abierto; aquí hacen falta también los que ya cerraron, que son
--  precisamente los que tienen reporte.
--
--  Devuelve los retos de TODAS sus campañas, el más reciente
--  primero, con cuántas promesas tiene cada uno — para que la lista
--  ya diga cuál vale la pena abrir. Sin dinero: eso es el reporte.
-- ════════════════════════════════════════════════════════════════

create or replace function public.challenge_list(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chk  json;
  v_out  json;
begin
  if p_code is null or btrim(p_code) = '' then
    return json_build_object('ok', false, 'error', 'code required');
  end if;

  v_chk := to_json(public.builder_check(p_code));
  if v_chk is null or coalesce((v_chk ->> 'ok')::boolean, false) = false then
    return json_build_object('ok', false, 'error', 'bad code');
  end if;

  select coalesce(json_agg(x order by x.closes_at desc nulls last, x.reto), '[]'::json)
  into v_out
  from (
    select
      ch.id                 as id,
      ch.name               as reto,
      c.name                as campana,
      ch.game               as juego,
      ch.status             as estado,
      ch.opens_at           as opens_at,
      ch.closes_at          as closes_at,
      (select count(*)::int
         from public.pledges pg
        where pg.challenge_id = ch.id
          and coalesce(pg.invoice_status, 'open') <> 'void') as promesas
      from public.challenges ch
      join public.campaigns c on c.id = ch.campaign_id
     where ch.campaign_id in (
       select (e ->> 'id')::uuid
         from json_array_elements(v_chk -> 'campaigns') e
     )
  ) x;

  return json_build_object('ok', true, 'by', v_chk ->> 'by', 'challenges', v_out);
end;
$$;

revoke all on function public.challenge_list(text) from public;
grant execute on function public.challenge_list(text) to anon, authenticated;

comment on function public.challenge_list(text) is
  'Los retos de las campanas de un entrenador, el mas reciente primero, con cuantas promesas tiene cada uno. Para que el reporte pueda ofrecerle cual abrir.';

-- ── Comprobación ────────────────────────────────────────────────
select public.challenge_list('codigo-que-no-existe') as debe_decir_bad_code_tambien;

-- ── Comprobación: que corre de verdad ───────────────────────────
--  Con un código que no existe tiene que contestar
--  {"ok":false,"error":"bad code"} — eso prueba que la función se
--  creó y llegó hasta builder_check sin romperse. Si contestara otra
--  cosa, o diera error de columna, sale aquí y no delante de un
--  entrenador con los padrinos esperando su número.
select public.challenge_report('codigo-que-no-existe', '00000000-0000-0000-0000-000000000000'::uuid)
  as debe_decir_bad_code;
