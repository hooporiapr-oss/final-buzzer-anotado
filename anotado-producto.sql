-- ════════════════════════════════════════════════════════════════
--  DE QUÉ PRODUCTO ES ESTA SOLICITUD
--
--  Los dos productos escriben en la misma tabla, bw_requests, y hoy
--  una solicitud de Anotado le llega al admin idéntica a una de Cada
--  Punto: mismo equipo, mismo programa, mismo correo. No hay forma de
--  saber qué pidió el entrenador.
--
--  Esto añade la columna y una función aparte para estamparla. Aparte
--  a propósito: la inscripción sigue entrando por bw_request_team como
--  siempre, y si esta función no existe todavía —o falla— la
--  inscripción no se cae. Es el mismo arreglo que se usó para el acuse
--  de la licencia, que funcionó.
--
--  Los nombres son los de verdad, comprobados contra la tabla:
--  coach_email y asked_at. No se adivina nada.
-- ════════════════════════════════════════════════════════════════

-- ── La columna ───────────────────────────────────────────────────
--  Por defecto 'cada-punto': todo lo que ya está en la tabla es de
--  Cada Punto, y lo que entre sin estampar también, porque el equipo.html
--  de Cada Punto no llama a esta función. Anotado sí.
alter table public.bw_requests
  add column if not exists product text not null default 'cada-punto';

comment on column public.bw_requests.product is
  'Cuál de los dos productos pidió el entrenador: cada-punto o anotado. Por defecto cada-punto, que es lo que había antes de que existiera el otro.';

-- Para que el admin pueda filtrar sin leer la tabla entera.
create index if not exists bw_requests_product_idx
  on public.bw_requests (product, asked_at desc);

-- ── La función que la estampa ────────────────────────────────────
create or replace function public.request_product(
  p_email text, p_product text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_email is null or btrim(p_email) = '' then
    return json_build_object('ok', false, 'error', 'email required');
  end if;

  /* Sólo los dos nombres que existen. Cualquier otra cosa se rechaza
     en vez de guardarse: una columna que acepta lo que sea deja de
     servir para filtrar a los dos meses. */
  if p_product not in ('cada-punto', 'anotado') then
    return json_build_object('ok', false, 'error', 'unknown product');
  end if;

  /* La solicitud más reciente de ese correo, y sólo si acaba de
     entrar. El guardia de los diez minutos importa: sin él, una
     llamada suelta con el correo de un entrenador podría reetiquetar
     una solicitud vieja y de verdad de Cada Punto. Esta función se
     llama segundos después de la inscripción o no se llama. */
  update public.bw_requests r
     set product = p_product
   where r.id = (
     select r2.id
       from public.bw_requests r2
      where lower(r2.coach_email) = lower(btrim(p_email))
        and r2.asked_at > now() - interval '10 minutes'
      order by r2.asked_at desc nulls last
      limit 1)
  returning r.id into v_id;

  if v_id is null then
    return json_build_object('ok', false, 'error', 'no recent request');
  end if;

  return json_build_object('ok', true, 'product', p_product);
end;
$$;

revoke all on function public.request_product(text, text) from public;
grant execute on function public.request_product(text, text) to anon, authenticated;

comment on function public.request_product(text, text) is
  'Marca de qué producto es la solicitud que acaba de entrar. Sólo toca una solicitud de los últimos diez minutos, para que no se pueda reetiquetar una vieja.';

-- ── Comprobación: que corre y que rechaza lo que debe ────────────
--  Con un correo que no existe tiene que contestar
--  {"ok":false,"error":"no recent request"} — eso prueba que llegó
--  hasta la consulta sin romperse por un nombre de columna.
select public.request_product('nadie-que-exista@ejemplo.invalid', 'anotado')
  as debe_decir_no_recent;

--  Y con un producto inventado, 'unknown product'.
select public.request_product('nadie-que-exista@ejemplo.invalid', 'otra-cosa')
  as debe_decir_unknown;
