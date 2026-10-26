-- ════════════════════════════════════════════════════════════════
--  EL TABLERO DE UN TORNEO
--  Cada Punto Cuenta · Gostar Digital LLC · 26 de octubre de 2026
--
--  Segunda parte de marcador-torneos.sql. Aquélla le dio cuerpo al
--  torneo; ésta le cuelga lo que cada juego lleva encima: su
--  marcador, sus promesas y lo que llevan recaudado.
--
--  ══ EL PUENTE, QUE ES LO DELICADO ══
--
--  Los dos sistemas no llaman igual al mismo juego. marcador lo
--  conoce por su número —CL-7, texto— y Cada Punto por un uuid en la
--  tabla games. No hay ninguna columna que los ate.
--
--  bw_set_score ya resuelve esto cada vez que entra un marcador, y
--  AQUÍ SE USA SU MISMA REGLA, a propósito y paso por paso:
--
--    1. el nombre de un equipo del calendario contra bw_teams, que
--       es donde vive la relación equipo → campaña
--    2. y después campaña + fecha + nombre del rival contra games
--
--  Escribir aquí una regla distinta —aunque fuera mejor— sería tener
--  dos maneras de contestar la misma pregunta, y el día que una
--  cambie, el admin enseñaría un número que no es el que se factura.
--
--  Que el puente dependa de nombres escritos a mano da menos miedo
--  del que parece: es el MISMO nombre que decide si un equipo tiene
--  botón de prometer en el calendario. Si no casa, no hay botón, no
--  hay promesas, y el cero que sale aquí es verdad.
--
--  SE EJECUTA DESPUÉS de marcador-torneos.sql.
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
           g.id                      as game_id,
           coalesce(p.n, 0)          as promesas,
           coalesce(p.recaudado, 0)  as recaudado,
           coalesce(p.programa, 0)   as programa,
           -- A cinco dólares por juego con promesas, esto es lo que
           -- decide si el juego se factura. Un juego sin promesas no
           -- se factura nunca, y por eso se cuentan las promesas y no
           -- los juegos.
           (coalesce(p.n, 0) > 0)    as facturable,
           -- Si el puente falló, se dice. Un juego al que no se le
           -- encontró su campaña NO es un juego sin promesas: es un
           -- juego del que no sabemos nada, y enseñar 0 en los dos
           -- casos es cómo se deja de facturar algo sin enterarse.
           (c.campaign_id is not null) as hay_campana,
           (g.id is not null)          as hay_juego
      from torneo_juegos tj

      left join bw_scores s
        on s.game_no = tj.juego

      -- 1 · el equipo que tiene campaña, sea el de casa o el de fuera
      left join lateral (
        select bt.campaign_id,
               case when lower(bt.name) = lower(btrim(tj.equipo_a))
                    then btrim(tj.equipo_b)
                    else btrim(tj.equipo_a) end as rival
          from bw_teams bt
         where bt.campaign_id is not null
           and (lower(bt.name) = lower(btrim(coalesce(tj.equipo_a, '')))
             or lower(bt.name) = lower(btrim(coalesce(tj.equipo_b, ''))))
         limit 1
      ) c on true

      -- 2 · su juego en la campaña: misma fecha, mismo rival
      left join lateral (
        select gm.id
          from games gm
         where gm.campaign_id = c.campaign_id
           and gm.plays_on    = tj.fecha
           and lower(btrim(gm.opponent)) = lower(c.rival)
           and gm.status <> 'cancelled'
         limit 1
      ) g on c.campaign_id is not null

      -- 3 · y lo que lleva encima
      left join lateral (
        select count(*)            as n,
               sum(gp.amount)      as recaudado,
               sum(gp.team_amount) as programa
          from game_pledges gp
         where gp.game_id = g.id
      ) p on g.id is not null

     where tj.torneo = p_torneo
  ) x;

  return v;
end $$;

revoke all on function public.torneo_tablero(text) from public;
grant execute on function public.torneo_tablero(text) to authenticated;

-- ── Nota sobre «facturado» ──────────────────────────────────────
-- Esto dice si un juego ES facturable, no si YA se facturó.
--
-- No hay dónde apuntarlo. licencias cuelga de challenge_id —el
-- evento de la corrida por jugador— y lleva roster y promesas, que
-- eran las entradas de la escalera por plantilla que se retiró el 26
-- de octubre de 2026. De un JUEGO no sabe nada.
--
-- game_pledges.invoice_status tampoco sirve: ése es el cobro AL
-- PADRINO, que es otra cosa y de otro. Usarlo para la licencia del
-- programa mezclaría dos dineros que en este producto no se tocan.
--
-- Hace falta decidir dónde vive una licencia por juego antes de que
-- se pueda marcar ninguna como cobrada.
