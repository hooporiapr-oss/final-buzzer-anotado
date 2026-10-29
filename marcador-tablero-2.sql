-- ════════════════════════════════════════════════════════════════
--  EL TABLERO DE UN TORNEO, POR LOS DOS LADOS
--
--  torneo_tablero tenía el mismo `limit 1` que tenía el cobro: por
--  cada juego del calendario buscaba UN equipo con campaña y paraba.
--  En un juego donde los dos recaudan —que es lo que la portada
--  anuncia— enseñaba las promesas de uno y las del otro no.
--
--  El cobro ya mira los dos. Si el tablero sigue mirando uno, el
--  admin enseña $12 en una fila que acaba de facturar $17, y el
--  primero que lo note será un entrenador preguntando por qué se le
--  cobró de más.
--
--  Ahora cada juego trae un `lados`: un elemento por equipo que
--  recauda, con sus promesas, lo prometido y su licencia. Las
--  columnas de siempre —promesas, recaudado— pasan a ser la suma de
--  los dos, que es lo que el admin enseñaba creyendo que era el
--  total.
-- ════════════════════════════════════════════════════════════════

create or replace function public.torneo_tablero(p_torneo text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v json;
begin
  -- security definer salta RLS, así que el permiso se comprueba aquí
  -- a mano: sin esto, cualquiera con la llave anónima leería lo que
  -- lleva recaudado cada programa.
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  select coalesce(json_agg(x order by x.fecha nulls last, x.hora, x.juego), '[]'::json)
    into v
  from (
    select tj.juego, tj.cat, tj.etapa, tj.fecha, tj.hora, tj.cancha,
           tj.equipo_a, tj.equipo_b,
           s.a_pts, s.b_pts,

           -- Un elemento por equipo que recauda. Vacío si ninguno de
           -- los dos tiene campaña.
           coalesce(l.lados, '[]'::json)            as lados,

           -- Los totales del juego, sumando los dos lados. Es lo que
           -- la columna enseñaba creyendo que lo era.
           coalesce(l.promesas, 0)                  as promesas,
           coalesce(l.recaudado, 0)                 as recaudado,
           coalesce(l.programa, 0)                  as programa,
           (coalesce(l.promesas, 0) > 0)            as facturable,

           -- Si el puente falló, se dice. Un juego al que no se le
           -- encontró campaña NO es un juego sin promesas: es un
           -- juego del que no sabemos nada, y enseñar 0 en los dos
           -- casos es cómo se deja de facturar algo sin enterarse.
           coalesce(l.hay_campana, false)           as hay_campana,
           coalesce(l.hay_juego, false)             as hay_juego
      from torneo_juegos tj

      left join bw_scores s
        on s.game_no = tj.juego

      -- LOS DOS LADOS. El `limit 1` de antes escogía uno y el otro no
      -- salía en ninguna pantalla.
      left join lateral (
        select json_agg(json_build_object(
                 'equipo',      d.equipo,
                 'campaign_id', d.campaign_id,
                 'game_id',     d.game_id,
                 'promesas',    d.n,
                 'recaudado',   d.recaudado,
                 'programa',    d.programa,
                 'licencia',    d.licencia
               ) order by d.equipo)                      as lados,
               sum(d.n)                                  as promesas,
               sum(d.recaudado)                          as recaudado,
               sum(d.programa)                           as programa,
               bool_or(d.campaign_id is not null)        as hay_campana,
               bool_or(d.game_id is not null)            as hay_juego
          from (
            select lado.equipo,
                   bt.campaign_id,
                   g.id                        as game_id,
                   coalesce(p.n, 0)            as n,
                   coalesce(p.recaudado, 0)    as recaudado,
                   coalesce(p.programa, 0)     as programa,
                   case when lj.id is null then null else
                     json_build_object('estado', lj.estado,
                                       'amount_cents', lj.amount_cents) end as licencia
              from (values (btrim(tj.equipo_a), btrim(tj.equipo_b)),
                           (btrim(tj.equipo_b), btrim(tj.equipo_a)))
                   as lado(equipo, rival)

              join bw_teams bt
                on bt.campaign_id is not null
               and lower(bt.name) = lower(coalesce(lado.equipo, ''))

              left join lateral (
                select gm.id
                  from games gm
                 where gm.campaign_id = bt.campaign_id
                   and gm.plays_on    = tj.fecha
                   and lower(btrim(coalesce(gm.opponent, ''))) = lower(coalesce(lado.rival, ''))
                   and gm.status <> 'cancelled'
                 limit 1
              ) g on true

              left join lateral (
                select count(*)            as n,
                       sum(gp.amount)      as recaudado,
                       sum(gp.team_amount) as programa
                  from game_pledges gp
                 where gp.game_id = g.id
              ) p on g.id is not null

              left join public.licencias_juego lj
                on lj.game_id = g.id and lj.estado <> 'anulada'
          ) d
      ) l on true

     where tj.torneo = p_torneo
  ) x;

  return v;
end $$;

revoke all on function public.torneo_tablero(text) from public;
grant execute on function public.torneo_tablero(text) to authenticated;


-- ── Comprobar que quedó bien ────────────────────────────────────
--
--   select j->>'juego'                              as juego,
--          j->>'promesas'                           as promesas_total,
--          json_array_length((j->'lados')::json)    as lados
--     from json_array_elements(public.torneo_tablero('copa-puerto-rico')) j;
--
-- Un juego donde los dos equipos recaudan tiene lados = 2, y
-- promesas_total es la suma de los dos. Antes era uno y el de uno.
