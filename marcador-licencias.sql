-- ════════════════════════════════════════════════════════════════
--  LA LICENCIA POR JUEGO
--  Cada Punto Cuenta · Gostar Digital LLC · 26 de octubre de 2026
--
--  Tercera parte, después de marcador-torneos.sql y -2.
--
--  El 26 de octubre de 2026 el precio pasó de una escalera por
--  tamaño de plantilla, cobrada por evento, a cinco dólares por cada
--  juego en el que se pongan promesas. No había dónde apuntar eso.
--
--  licencias no servía: cuelga de challenge_id —el evento de la
--  corrida por jugador— y lleva roster y promesas, que eran las
--  entradas de la escalera retirada. De un juego no sabe nada, y
--  ensancharla habría tocado una tabla que ya lleva eventos vivos.
--
--  game_pledges.invoice_status tampoco: ése es el cobro AL PADRINO.
--  Es dinero de otra persona y va en otra dirección. Mezclarlo con
--  la licencia del programa juntaría los dos dineros que este
--  producto mantiene separados a propósito, y es justo la confusión
--  que custodia.html existe para deshacer.
--
--  Así que una tabla aparte, al lado de licencias y con su misma
--  forma, para que quien conozca una conozca la otra.
--
--  SE EJECUTA DESPUÉS de marcador-torneos-2.sql.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.licencias_juego (
  id          uuid primary key default gen_random_uuid(),

  -- El juego de la campaña, que es lo que se factura. Un juego sin
  -- promesas no llega nunca a esta tabla: no hay fila, no hay cargo.
  game_id     uuid not null references public.games(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,

  -- De qué torneo salió. Es opcional a propósito: un equipo con
  -- calendario propio —su temporada, juego a juego— recauda igual y
  -- no pertenece a ningún torneo.
  torneo      text references public.torneos(id) on delete set null,
  juego_no    text,                   -- CL-7, para encontrarlo a ojo

  -- En centavos, como Stripe y como licencias. Un float para dinero
  -- es cómo se pierde un centavo por redondeo y nadie sabe dónde.
  --
  -- SIN VALOR POR DEFECTO, y eso cambió el 26 de octubre de 2026.
  -- Tenía 500 puesto, de cuando el precio era cinco dólares planos
  -- por juego. Ahora el peldaño lo fija cuántas promesas recogió el
  -- juego, así que un valor por defecto sería el precio del peldaño
  -- de abajo cobrado a un juego de cualquier tamaño — y lo haría en
  -- silencio, que es la peor manera de equivocarse con una factura.
  -- Quien crea la fila dice cuánto, o no hay fila.
  amount_cents integer not null check (amount_cents >= 0),

  -- Con qué se decidió, guardado tal como estaba el día de la
  -- factura. El precio puede cambiar; lo que se cobró, no.
  promesas    integer,                -- cuántas llevaba el juego
  recaudado   numeric,                -- y cuánto se prometió encima

  -- open → enviada → pagada. 'anulada' para una que se tuvo que
  -- retirar; no se borra la fila, que entonces se podría volver a
  -- facturar el mismo juego.
  estado      text not null default 'open'
              check (estado in ('open','enviada','pagada','anulada')),

  creada      timestamptz not null default now(),
  enviada_el  timestamptz,
  pagada_el   timestamptz
);

-- UN JUEGO, UNA LICENCIA. Es la regla entera de este precio y va en
-- la base y no en una pantalla: dos filas para el mismo juego son
-- diez dólares por algo que vale cinco, y eso se descubre cuando lo
-- dice un programa que ya pagó.
--
-- Parcial, dejando fuera las anuladas: una licencia que se retiró
-- tiene que poder reemplazarse por otra buena.
create unique index if not exists licencias_juego_una_por_juego
  on public.licencias_juego (game_id)
  where estado <> 'anulada';

create index if not exists licencias_juego_torneo
  on public.licencias_juego (torneo);

alter table public.licencias_juego enable row level security;

drop policy if exists licencias_juego_admin on public.licencias_juego;
create policy licencias_juego_admin on public.licencias_juego
  for all using (public.is_admin()) with check (public.is_admin());

-- ── Y el tablero pasa a decir en qué estado va cada cargo ───────
-- Mismo cuerpo que en marcador-torneos-2.sql con una columna más:
-- 'licencia', que es null mientras el juego no se haya facturado.
-- Se reemplaza entera en vez de parchearla porque una función a
-- medias entre dos ficheros es imposible de leer después.
create or replace function public.torneo_tablero(p_torneo text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v json;
begin
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
           (coalesce(p.n, 0) > 0)    as facturable,
           (c.campaign_id is not null) as hay_campana,
           (g.id is not null)          as hay_juego,
           -- null = facturable y sin facturar todavía
           lj.estado                 as licencia
      from torneo_juegos tj

      left join bw_scores s
        on s.game_no = tj.juego

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

      left join lateral (
        select gm.id
          from games gm
         where gm.campaign_id = c.campaign_id
           and gm.plays_on    = tj.fecha
           and lower(btrim(gm.opponent)) = lower(c.rival)
           and gm.status <> 'cancelled'
         limit 1
      ) g on c.campaign_id is not null

      left join lateral (
        select count(*)            as n,
               sum(gp.amount)      as recaudado,
               sum(gp.team_amount) as programa
          from game_pledges gp
         where gp.game_id = g.id
      ) p on g.id is not null

      left join public.licencias_juego lj
        on lj.game_id = g.id and lj.estado <> 'anulada'

     where tj.torneo = p_torneo
  ) x;

  return v;
end $$;

revoke all on function public.torneo_tablero(text) from public;
grant execute on function public.torneo_tablero(text) to authenticated;

-- ── Lo que falta por facturar de un torneo ──────────────────────
-- Devuelve los juegos facturables que todavía no tienen licencia.
-- No cobra nada: dice qué habría que cobrar. Facturar es una acción
-- aparte y con su propio botón, porque mirar una cuenta y emitirla
-- no son la misma decisión.
create or replace function public.torneo_por_facturar(p_torneo text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v json;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  -- Se apoya en torneo_tablero y no repite su puente: el día que esa
  -- regla cambie, cambia en un sitio. Repetirla aquí sería tener dos
  -- maneras de decidir qué juego se factura.
  select coalesce(json_agg(t), '[]'::json) into v
    from json_array_elements(public.torneo_tablero(p_torneo)) as t
   where (t->>'facturable')::boolean
     and (t->>'game_id') is not null
     and not exists (
       select 1 from public.licencias_juego lj
        where lj.game_id = (t->>'game_id')::uuid
          and lj.estado <> 'anulada'
     );

  return v;
end $$;

revoke all on function public.torneo_por_facturar(text) from public;
grant execute on function public.torneo_por_facturar(text) to authenticated;
