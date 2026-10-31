-- ════════════════════════════════════════════════════════════════
--  EL CÓDIGO DEL ENTRENADOR: SU EQUIPO Y SUS CUATRO NÚMEROS
--
--  Aprobar repartía COACH-7F3A9C21B. Nadie lo recuerda, y un
--  entrenador que no puede entrar a su página no tiene producto.
--  Ahora, al inscribirse, escoge cuatro números, y su código es el
--  nombre del equipo más esos números: CANOVANAS15U-4827.
--
--  El nombre solo no bastaba: sale en cada calendario y en cada
--  aviso, y con él cualquiera abriría la página del equipo.
--
--  Se corre entero UNA VEZ. No borra nada y dos veces no rompe nada.
--  Los códigos que ya existen siguen funcionando igual.
-- ════════════════════════════════════════════════════════════════


-- ── Dónde esperan los números hasta que se aprueba ──────────────
alter table public.bw_requests add column if not exists pin text;


-- ── El nombre del equipo como parte de un código ────────────────
--  Sin acentos, en mayúsculas, sólo letras y números: la misma
--  cuenta que hace la página al entrar, para que «Canóvanas 15U»,
--  «canovanas 15u» y «CANOVANAS15U» sean el mismo código.
--  translate() y no unaccent(), por lo mismo que bw_nombre_norm:
--  unaccent vive en una extensión y no es inmutable.
create or replace function public.bw_codigo_norm(p text)
returns text
language sql
immutable
as $$
  select regexp_replace(
           translate(upper(coalesce(p, '')), 'ÁÉÍÓÚÜÑÀÈÌÒÙ', 'AEIOUUNAEIOU'),
           '[^A-Z0-9]', '', 'g');
$$;


-- ── Guardar los números de una inscripción recién hecha ─────────
--  La llama equipo.html justo después de bw_request_team. Va aparte
--  porque bw_request_team vive en la base y no en este repo, y
--  cambiarle la firma a ciegas es arriesgar la inscripción entera.
--
--  La puede llamar cualquiera, así que sólo toca una solicitud
--  PENDIENTE, SIN números todavía y de los últimos quince minutos:
--  nadie le pone los números a la solicitud de otro.
create or replace function public.bw_request_pin(p_email text, p_pin text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then
    return json_build_object('ok', false, 'reason', 'pin');
  end if;

  select id into v_id
    from public.bw_requests
   where lower(btrim(coach_email)) = lower(btrim(coalesce(p_email, '')))
     and status = 'pending'
     and pin is null
     and asked_at > now() - interval '15 minutes'
   order by asked_at desc
   limit 1;

  if v_id is null then
    return json_build_object('ok', false, 'reason', 'gone');
  end if;

  update public.bw_requests set pin = p_pin where id = v_id;
  return json_build_object('ok', true);
end;
$$;

revoke all on function public.bw_request_pin(text, text) from public;
grant execute on function public.bw_request_pin(text, text) to anon, authenticated;


-- ── Aprobar, ahora con ese código ───────────────────────────────
--  Idéntica a la de marcador-solicitudes.sql salvo en tres cosas: el
--  código sale del equipo y sus números, la respuesta lo trae con
--  guion para leerlo, y los números se borran de la solicitud.
create or replace function public.bw_approve_request(p_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  r        record;
  v_camp   uuid;
  v_code   text;
  v_muestra text;
  v_coach  text;
  v_torneo text;
  v_cuenta int := 0;
begin
  if not coalesce(public.is_admin(), false) then
    return json_build_object('ok', false, 'reason', 'no-admin');
  end if;

  select * into r from public.bw_requests
   where id = p_id and status = 'pending';
  if not found then
    return json_build_object('ok', false, 'reason', 'gone');
  end if;

  /* Sin acentos, como lo compara el tablero. Con lower() a secas,
     «canovanas» no chocaba con «Canóvanas» y el equipo se daba dos
     veces a dos programas. */
  if exists (select 1 from public.bw_teams
              where public.bw_nombre_norm(name) = public.bw_nombre_norm(r.team_name)
                and campaign_id is not null) then
    return json_build_object('ok', false, 'reason', 'taken');
  end if;

  /* EL CÓDIGO ES EL EQUIPO MÁS SUS CUATRO NÚMEROS. Un COACH-7F3A9C21B
     no lo recuerda nadie, y un entrenador que no puede entrar a su
     página no tiene producto. Se guarda sin guion ni espacios —así
     lo compara la página al entrar— y se enseña con guion, que es
     como se lee. Sin números (una solicitud de antes de esto) se
     sigue repartiendo el de siempre. */
  if coalesce(r.pin, '') ~ '^[0-9]{4}$'
     and public.bw_codigo_norm(r.team_name) <> '' then
    v_code    := public.bw_codigo_norm(r.team_name) || r.pin;
    v_muestra := public.bw_codigo_norm(r.team_name) || '-' || r.pin;
  else
    v_code    := 'COACH-' || upper(substr(md5(gen_random_uuid()::text), 1, 9));
    v_muestra := v_code;
  end if;
  v_coach := 'C-'     || upper(substr(md5(gen_random_uuid()::text), 1, 8));

  /* product SALE DE LA SOLICITUD. Antes no se escribía, y una campaña
     sin product no pertenece a ninguno de los dos productos que
     comparten esta base. El valor por defecto es cada-punto porque es
     de donde viene el formulario público; una solicitud que no lo
     traiga se queda del lado del recaudador y no en tierra de nadie.

     La descripción dice de dónde salió y cuándo, en vez de
     'Basketween 2026', que era verdad una vez y falsa desde el día
     siguiente. */
  insert into public.campaigns (name, description, goal, admin_code, product)
  values (r.program,
          'Alta desde la solicitud de ' || coalesce(r.team_name, 'un equipo') ||
            ' · ' || to_char(now(), 'YYYY-MM-DD'),
          0, v_code,
          coalesce(nullif(btrim(coalesce(r.product, '')), ''), 'cada-punto'))
  returning id into v_camp;

  /* El conflicto se resuelve por el nombre NORMALIZADO, que es el
     que lleva el índice único: si la fila existe con otra grafía, se
     actualiza esa en vez de intentar meter una segunda. */
  insert into public.bw_teams (name, campaign_id, claimed_at)
  values (r.team_name, v_camp, now())
  on conflict (public.bw_nombre_norm(name)) do update
     set campaign_id = excluded.campaign_id, claimed_at = now();

  insert into public.coaches (campaign_id, name, email, access_code)
  values (v_camp, r.coach_name, r.coach_email, v_coach);

  /* ── Y SU CÓDIGO, que es lo que el entrenador escribe ──────────
     Esto escribía el código en campaigns.admin_code y en
     coaches.access_code y en ningún sitio más. Las tres funciones por
     las que entra un entrenador —juegos_del_codigo, juego_puede,
     campana_del_codigo— miran `bw_codes`, que aprobar no tocaba.

     O sea: se aprobaba un programa, se le daba un código, y ese
     código no abría nada. El entrenador entraba en su página y le
     decía que su código no sirve. Es la misma forma que ya apareció
     con bw_approve_request, con game_pledges y con poder crear un
     juego: todo construido detrás de una puerta que no estaba
     conectada.

     can_add_games VA EN TRUE: el entrenador monta sus propios
     calendarios. No es un permiso peligroso — bw_register_tournament
     comprueba de quién es cada torneo y rechaza el ajeno, así que un
     código llega a los suyos y a ninguno más. Lo que da es poder
     registrar un calendario entero de una vez, que para una liga de
     veinte juegos es la diferencia entre usar esto y no usarlo.

     Un juego suelto no lo pide: ése va por campana_del_codigo, que
     sólo mira que el código esté vivo y tenga campaña. */
  insert into public.bw_codes (label, code_hash, campaign_id, can_add_games, active)
  values (r.program, crypt(v_code, gen_salt('bf')), v_camp, true, true);

  update public.bw_requests
     set status = 'approved', campaign_id = v_camp, decided_at = now(),
         pin = null   -- ya vive como hash en bw_codes; aquí sobra
   where id = p_id;

  /* Y la otra fila de la misma inscripción se da por atendida. Si no,
     el programa queda dado de alta y su solicitud sigue saliendo en
     la cola como si nadie la hubiera mirado — que es exactamente la
     confusión que dejó tres filas «approved» sin campaña. */
  update public.solicitudes
     set estado = 'atendida', atendida_el = now()
   where lower(email) = lower(coalesce(r.coach_email, ''))
     and estado = 'nueva';

  /* ── Y SE ENLAZAN LOS TORNEOS QUE YA LO ESPERABAN ──────────────
     Las dos mitades de un alta pueden pasar en cualquier orden, y
     hasta ahora sólo una de las dos funcionaba sola.

       · torneo primero, equipo después — el caso de un equipo que se
         inscribe a mitad de torneo. El día del registro no tenía
         campaña, así que no se le creó juego, y aprobarlo no le creaba
         ninguno tampoco: torneo_enlazar sólo corría al registrar. El
         entrenador quedaba aprobado, veía su equipo en el calendario,
         y sus padrinos abrían un tablero sin juego que prometer. No
         había error en ninguna pantalla. Se arreglaba corriendo SQL a
         mano, y eso sólo si alguien se enteraba.

       · equipo primero, torneo después — ese ya funcionaba, porque
         registrar llama a torneo_enlazar al final.

     Ahora las dos puertas llaman a la misma función y el orden deja de
     importar. Enlazar es idempotente: un juego que ya tenía su llave
     se devuelve igual, así que pasar por los torneos de un equipo no
     puede duplicarle un juego a otro. */
  for v_torneo in
    select distinct tj.torneo
      from public.torneo_juegos tj
     where public.bw_nombre_norm(tj.equipo_a) = public.bw_nombre_norm(r.team_name)
        or public.bw_nombre_norm(tj.equipo_b) = public.bw_nombre_norm(r.team_name)
  loop
    perform public.torneo_enlazar(v_torneo);
    v_cuenta := v_cuenta + 1;
  end loop;

  /* El código sale en la respuesta porque hay que dárselo a alguien:
     es lo único de todo esto que el entrenador tiene que recibir, y
     guardado sólo como hash no se puede volver a leer. */
  return json_build_object('ok', true, 'campaign', v_camp,
                           'team', r.team_name, 'program', r.program,
                           'codigo', v_muestra,
                           'correo', r.coach_email,
                           'product', coalesce(nullif(btrim(coalesce(r.product,'')),''),
                                               'cada-punto'),
                           'torneos_enlazados', v_cuenta);
end $$;

revoke all on function public.bw_approve_request(uuid) from public;
grant execute on function public.bw_approve_request(uuid) to authenticated;
