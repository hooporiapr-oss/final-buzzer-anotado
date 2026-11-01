-- ════════════════════════════════════════════════════════════════
--  LLEGAR AL CALENDARIO — el entrenador y el público
--
--  Un calendario registrado sólo se encontraba con el enlace que
--  sale al registrarlo. El entrenador que lo perdía no tenía cómo
--  volver a él desde «Mi calendario», y un padrino o una familia no
--  tenía dónde buscarlo.
--
--  Dos funciones, y ninguna toca nada:
--    · calendarios_del_codigo — los calendarios de un equipo, para
--      el botón «Ver mi calendario» de su página.
--    · calendarios_publicos   — todos los calendarios, para la
--      página «Calendarios» de cadapunto.com.
--
--  Se corre entero UNA VEZ. Dos veces no rompe nada.
-- ════════════════════════════════════════════════════════════════


-- ── Los calendarios de un equipo ────────────────────────────────
--  Con el mismo código con el que entra a su página. Un calendario
--  es «suyo» si alguno de sus juegos está enganchado a un juego de su
--  campaña: así salen igual el de su temporada y el torneo en el que
--  juega.
create or replace function public.calendarios_del_codigo(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $$
declare v_camp uuid;
begin
  select c.campaign_id into v_camp
    from public.bw_codes c
   where coalesce(c.active, true)
     and c.campaign_id is not null
     and c.code_hash = crypt(coalesce(p_code, ''), code_hash)
   limit 1;

  if v_camp is null then
    return jsonb_build_object('ok', false, 'reason', 'code');
  end if;

  return jsonb_build_object('ok', true, 'calendarios', coalesce((
    select jsonb_agg(jsonb_build_object('id', t.id, 'nombre', t.nombre)
                     order by t.creado desc)
      from public.torneos t
     where exists (
       select 1 from public.torneo_juegos tj
         join public.games g on g.id = tj.game_a or g.id = tj.game_b
        where tj.torneo = t.id and g.campaign_id = v_camp)
  ), '[]'::jsonb));
end $$;

revoke all on function public.calendarios_del_codigo(text) from public;
grant execute on function public.calendarios_del_codigo(text) to anon, authenticated;


-- ── Todos los calendarios, para el desplegable del menú ─────────
--  Lo mismo que ya enseña cualquier calendario abierto: su nombre,
--  su pueblo, su deporte y sus fechas. Nada de promesas ni padrinos.
--
--  ACTIVO es que todavía le queda algún día por jugar, contado con
--  la fecha de Puerto Rico y no la del servidor: a las nueve de la
--  noche aquí ya es mañana en UTC, y un torneo que se juega hoy
--  saldría como pasado. Uno sin fechas cuenta por el día en que se
--  registró.
create or replace function public.calendarios_publicos()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'id',      t.id,
               'nombre',  t.nombre,
               'pueblo',  t.pueblo,
               'deporte', coalesce(t.deporte, 'baloncesto'),
               'desde',   f.desde,
               'hasta',   f.hasta,
               'activo',  coalesce(f.hasta, t.creado::date)
                            >= (now() at time zone 'America/Puerto_Rico')::date
             ) as x
        from public.torneos t
        left join lateral (
          select min(tj.fecha) as desde, max(tj.fecha) as hasta
            from public.torneo_juegos tj where tj.torneo = t.id) f on true
    ) s;
$$;

revoke all on function public.calendarios_publicos() from public;
grant execute on function public.calendarios_publicos() to anon, authenticated;
