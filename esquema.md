-- ════════════════════════════════════════════════════════════════
--  PROMETER SOBRE UN JUEGO
--
--  LO QUE FALTABA, Y NO ESTABA EN NINGUNA LISTA.
--
--  `game_pledges` se lee en todas partes —el cobro, los avisos, las
--  correcciones, el reporte, la escalera de la licencia— y no se
--  escribe en ninguna. Ni una página, ni una ruta del servidor, ni una
--  función. La promesa del camino completo de ayer se metió a mano con
--  un INSERT.
--
--  Es decir: un padrino no tiene manera de prometer. Todo lo que hay
--  detrás funciona y no hay puerta por donde entrar — lo mismo que
--  pasaba con bw_approve_request, que existía y no la llamaba nadie.
--
--  `cp_pledge`, la que sí existe, promete sobre un RETO y un ALUMNO:
--  el producto retirado. No sirve, y cambiarla de significado
--  rompería lo que todavía la usa.
--
--  Dos funciones, y nada más que eso:
--
--    juego_publico   — lo que un padrino ve antes de prometer, sin
--                      código y sin cuenta
--    juego_prometer  — la promesa
-- ════════════════════════════════════════════════════════════════


-- ── Lo que ve quien llega con el enlace ─────────────────────────
--
--  Sin código: el enlace se comparte por WhatsApp y quien lo abre no
--  tiene nada nuestro. Así que esto devuelve SÓLO lo que ya es
--  público —lo mismo que cualquiera ve en el marcador— y ni una cosa
--  más: ni campaign_id, ni correos, ni quién más prometió.
--
--  SE PUEDE PROMETER HASTA QUE HAYA MARCADOR, y ni un minuto después.
--  La promesa es por punto: con el resultado ya puesto, prometer no
--  sería prometer, sería escoger una cifra sabiendo la respuesta.
create or replace function public.juego_publico(p_game uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_g  record;
  v_tj text;
begin
  select g.id, g.opponent, g.plays_on, g.home, g.status, g.team_points,
         g.opp_points, g.tip_time, g.venue,
         ca.name as equipo, ca.pay_how
    into v_g
    from public.games g
    left join public.campaigns ca on ca.id = g.campaign_id
   where g.id = p_game;

  if v_g.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no-existe');
  end if;

  select tj.juego into v_tj
    from public.torneo_juegos tj
   where tj.game_a = p_game or tj.game_b = p_game
   limit 1;

  return jsonb_build_object(
    'ok',       true,
    'game_id',  v_g.id,
    'equipo',   v_g.equipo,
    'rival',    v_g.opponent,
    'casa',     v_g.home,
    'juego',    coalesce(v_tj, (case when v_g.home then 'vs ' else '@ ' end)
                               || coalesce(v_g.opponent, '')),
    'fecha',    v_g.plays_on,
    'hora',     v_g.tip_time,
    'cancha',   v_g.venue,
    'jugado',   (coalesce(v_g.status,'') = 'played' and v_g.team_points is not null),
    'puntos',   v_g.team_points,
    'rival_puntos', v_g.opp_points,
    'abierto',  (coalesce(v_g.status, 'scheduled') = 'scheduled'),
    'cancelado',(coalesce(v_g.status, '') = 'cancelled'),
    'piso_centavos', public.cp_piso_centavos(),
    'pay_how',  v_g.pay_how,
    -- Cuántos van. Es lo único «social» que sale, y sin nombres.
    'promesas', (select count(*) from public.game_pledges gp
                  where gp.game_id = p_game
                    and coalesce(gp.invoice_status,'open') not in ('void','anulada'))
  );
end $$;

revoke all on function public.juego_publico(uuid) from public;
grant execute on function public.juego_publico(uuid) to anon, authenticated;


-- ── La promesa ──────────────────────────────────────────────────
--
--  Lo que el padrino decide es una tarifa por punto y, si quiere, un
--  tope. Nada más: no hay pago, no hay cuenta, no hay tarjeta. Lo que
--  queda guardado es una intención, y lo que la convierte en una cifra
--  es el marcador final.
--
--  PROMETER DOS VECES NO SON DOS PROMESAS. El mismo correo sobre el
--  mismo juego actualiza la suya: alguien que se equivoca de cifra y
--  vuelve a mandar el formulario esperaría eso, y no dos cargos — y
--  sobre todo, dos filas contarían DOS veces para el peldaño de la
--  licencia, que se cobra por número de promesas. Un padrino
--  indeciso no puede subirle el precio a su propio programa.
--
--  Y NO SE PUEDE CAMBIAR DESPUÉS DEL AVISO. Si ya se le escribió con
--  una cifra, cambiarla por detrás dejaría su correo diciendo una cosa
--  y la base otra, que es justo el desorden que el paso 2 vino a
--  arreglar.
create or replace function public.juego_prometer(
  p_game   uuid,
  p_nombre text,
  p_email  text,
  p_tarifa numeric,
  p_tope   numeric default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_g      record;
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_id     uuid;
  v_previa record;
begin
  select g.id, g.status, g.team_points, g.campaign_id
    into v_g
    from public.games g
   where g.id = p_game;

  if v_g.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no-existe');
  end if;

  if coalesce(v_g.status, 'scheduled') = 'cancelled' then
    return jsonb_build_object('ok', false, 'reason', 'cancelado');
  end if;

  -- Con marcador puesto ya no se promete: se sabría el resultado.
  if coalesce(v_g.status, 'scheduled') <> 'scheduled' or v_g.team_points is not null then
    return jsonb_build_object('ok', false, 'reason', 'ya-jugado');
  end if;

  if v_nombre = '' then
    return jsonb_build_object('ok', false, 'reason', 'falta-nombre');
  end if;

  -- Una comprobación de forma, no de existencia: que haya algo, una
  -- arroba y un punto después. Si la dirección no existe, eso se
  -- descubre al mandarle el aviso, y para eso está `undeliverable`.
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('ok', false, 'reason', 'correo');
  end if;

  if p_tarifa is null or p_tarifa <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'tarifa');
  end if;

  -- Un techo, para que un cero de más no se convierta en una promesa
  -- de nueve mil dólares que nadie quiso hacer. No es desconfianza:
  -- es que el teclado del teléfono está pegado y esto no se puede
  -- deshacer una vez que el equipo juega.
  if p_tarifa > 25 then
    return jsonb_build_object('ok', false, 'reason', 'tarifa-alta');
  end if;

  if p_tope is not null and p_tope <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'tope');
  end if;

  -- ¿Ya prometió? Entonces se le cambia la suya.
  select gp.id, gp.invoice_status, coalesce(gp.avisos_n, 0) as avisos_n
    into v_previa
    from public.game_pledges gp
   where gp.game_id = p_game
     and lower(gp.padrino_email) = v_email
   limit 1;

  if v_previa.id is not null then
    if v_previa.avisos_n > 0 or v_previa.invoice_status = 'sent' then
      return jsonb_build_object('ok', false, 'reason', 'ya-avisado');
    end if;

    update public.game_pledges
       set padrino_name = v_nombre,
           rate         = p_tarifa,
           cap          = p_tope
     where id = v_previa.id;

    return jsonb_build_object('ok', true, 'cambiada', true,
                              'pledge_id', v_previa.id,
                              'tarifa', p_tarifa, 'tope', p_tope);
  end if;

  insert into public.game_pledges
    (game_id, padrino_name, padrino_email, rate, cap, invoice_status)
  values (p_game, v_nombre, v_email, p_tarifa, p_tope, 'open')
  returning id into v_id;

  return jsonb_build_object('ok', true, 'cambiada', false,
                            'pledge_id', v_id,
                            'tarifa', p_tarifa, 'tope', p_tope);
end $$;

revoke all on function public.juego_prometer(uuid, text, text, numeric, numeric) from public;
grant execute on function public.juego_prometer(uuid, text, text, numeric, numeric)
  to anon, authenticated;


-- ── Un correo, una promesa, por juego ───────────────────────────
-- La función ya lo resuelve, pero la función es una sola puerta y el
-- índice es la cerradura: dos formularios mandados a la vez caben
-- entre el select y el insert, y dos filas del mismo padrino le
-- subirían el peldaño de la licencia a su propio programa.
create unique index if not exists game_pledges_un_correo_por_juego
  on public.game_pledges (game_id, lower(padrino_email));


-- ── Comprobar que quedó bien ────────────────────────────────────
--
--   select public.juego_publico('<game uuid>');
--   select public.juego_prometer('<game uuid>', 'Ana', 'ana@x.com', 0.25, 20);
--
-- Sobre un juego ya jugado, la segunda contesta {"ok":false,
-- "reason":"ya-jugado"} y no escribe nada.
