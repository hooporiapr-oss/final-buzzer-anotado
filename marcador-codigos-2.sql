-- ════════════════════════════════════════════════════════════════
--  MANEJAR LOS CÓDIGOS DESDE EL ADMIN
--
--  Hasta aquí un código se podía crear y nada más. La lista enseñaba
--  «active» / «off» como si fuera un interruptor y no lo era: una vez
--  creado, un código vivía para siempre. Un torneo que terminó dejaba
--  su código de mesa abierto, y la única manera de cerrarlo era entrar
--  a la base a mano.
--
--  Tres funciones, todas detrás de is_admin():
--
--    bw_codes_admin   — la lista, sin el hash
--    bw_code_set      — cambiar nombre, permiso de montar, encendido
--    bw_code_delete   — borrarlo del todo
--
--  Apagar es lo normal y borrar la excepción: un código apagado deja
--  el rastro de a quién se le dio y cuándo se usó por última vez, y
--  eso es justo lo que hace falta cuando un marcador sale mal.
-- ════════════════════════════════════════════════════════════════


-- ── La lista ────────────────────────────────────────────────────
-- Devuelve la fila entera MENOS code_hash. Se arma con to_jsonb para
-- no tener que nombrar cada columna: así sigue funcionando si bw_codes
-- gana una columna mañana, y el hash se quita por nombre en vez de
-- confiar en que nadie lo añada a una lista de campos.
create or replace function public.bw_codes_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_rows jsonb;
begin
  if not coalesce(public.is_admin(), false) then
    return jsonb_build_object('ok', false, 'reason', 'admin');
  end if;

  select coalesce(jsonb_agg(x order by x->>'label'), '[]'::jsonb)
    into v_rows
    from (
      select (to_jsonb(c) - 'code_hash')
             || jsonb_build_object('campaign', ca.name) as x
        from public.bw_codes c
        left join public.campaigns ca on ca.id = c.campaign_id
    ) s;

  return jsonb_build_object('ok', true, 'codigos', v_rows);
end $$;

revoke all on function public.bw_codes_admin() from public;
grant execute on function public.bw_codes_admin() to authenticated;


-- ── Cambiar un código ───────────────────────────────────────────
-- Nombre, permiso de montar calendarios y encendido. El código en sí
-- NO se puede cambiar: sólo existe su hash, así que cambiarlo es
-- hacer uno nuevo y borrar el viejo.
--
-- Los tres parámetros son opcionales: null quiere decir «deja eso
-- como está», para que apagar un código no le borre el nombre.
create or replace function public.bw_code_set(
  p_id     uuid,
  p_label  text    default null,
  p_build  boolean default null,
  p_active boolean default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  if not coalesce(public.is_admin(), false) then
    return jsonb_build_object('ok', false, 'reason', 'admin');
  end if;
  if p_id is null then
    return jsonb_build_object('ok', false, 'reason', 'falta-id');
  end if;
  if p_label is not null and btrim(p_label) = '' then
    return jsonb_build_object('ok', false, 'reason', 'label');
  end if;

  update public.bw_codes
     set label         = coalesce(btrim(p_label), label),
         can_add_games = coalesce(p_build,  can_add_games),
         active        = coalesce(p_active, active)
   where id = p_id;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no-existe');
  end if;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.bw_code_set(uuid, text, boolean, boolean) from public;
grant execute on function public.bw_code_set(uuid, text, boolean, boolean) to authenticated;


-- ── Borrar un código ────────────────────────────────────────────
-- Se devuelve el nombre de lo borrado para que el admin pueda decir
-- QUÉ desapareció. Borrar un código no toca ningún marcador: los
-- marcadores no guardan con qué código se escribieron.
create or replace function public.bw_code_delete(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_label text;
begin
  if not coalesce(public.is_admin(), false) then
    return jsonb_build_object('ok', false, 'reason', 'admin');
  end if;
  if p_id is null then
    return jsonb_build_object('ok', false, 'reason', 'falta-id');
  end if;

  delete from public.bw_codes where id = p_id returning label into v_label;

  if v_label is null then
    return jsonb_build_object('ok', false, 'reason', 'no-existe');
  end if;

  return jsonb_build_object('ok', true, 'label', v_label);
end $$;

revoke all on function public.bw_code_delete(uuid) from public;
grant execute on function public.bw_code_delete(uuid) to authenticated;


-- ── Comprobar que quedó bien ────────────────────────────────────
--
--   select public.bw_codes_admin();
--
-- Desde el admin, con sesión iniciada, devuelve {"ok":true,"codigos":[...]}
-- y ninguna de esas filas lleva code_hash. Sin sesión de admin
-- devuelve {"ok":false,"reason":"admin"}.
--
-- Y para confirmar que el hash no se escapa nunca:
--
--   select jsonb_path_exists(public.bw_codes_admin(), '$.codigos[*].code_hash');
--
-- Tiene que dar false.
