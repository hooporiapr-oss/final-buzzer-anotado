-- ════════════════════════════════════════════════════════════════
--  EL BANCO DE PRUEBAS DE challenge_report()
--
--  ⛔ ESTO NO VA EN SUPABASE. Y no es un consejo: abajo hay una
--     guarda que lo impide. Se corrió una vez por error en la base
--     buena y paró sólo porque la primera tabla ya existía.
--
--     Lo que había más abajo esperando: un builder_check de mentira
--     que sólo acepta 'CODIGO-BUENO'. En una base de juguete es el
--     chiste; en la buena habría reemplazado el builder_check de
--     verdad, y con él se caen TODOS los códigos de entrenador de
--     los dos productos a la vez — cada página que comprueba un
--     código, en Cada Punto y en Hooporia.
--
--     Por eso la guarda va antes de la primera línea que escribe, y
--     no en un comentario que se lee después.
--
--  Es un esquema de mentira con los nombres de columna de verdad y
--  datos pensados para cazar errores, para correr challenge_report()
--  en un Postgres local antes de tocar la base buena.
--
--  Cómo se corre (hace falta un Postgres 16 y nada más):
--      initdb -D /tmp/pgt/data -U tu_usuario --no-locale -A trust
--      pg_ctl -D /tmp/pgt/data -o "-k /tmp/pgt" -w start
--      createdb -h /tmp/pgt -U tu_usuario prueba
--      psql -h /tmp/pgt -U tu_usuario -d prueba \
--           -c "create role anon; create role authenticated;"
--      psql -h /tmp/pgt -U tu_usuario -d prueba -f prueba-reporte-sql.sql
--      psql -h /tmp/pgt -U tu_usuario -d prueba -f anotado-reporte.sql
--      psql -h /tmp/pgt -U tu_usuario -d prueba -c \
--           "select jsonb_pretty(to_jsonb(challenge_report('CODIGO-BUENO','cccccccc-0000-0000-0000-000000000001'::uuid)))"
--
--  Lo que tiene que salir:
--      Ana   45 puntos, 4 cuartos, 2 promesas, $24.50
--            (0.10 × 45 = 4.50, y 1.00 × 45 = 45 con tope 20 → 20.00)
--      Beto  36 puntos de una corrida suelta, 1 promesa, $9.00
--      Caro  0 puntos, 1 promesa, $0.00  — no jugó
--      Dani  0 puntos, 1 promesa, $0.00  — sacado de la plantilla
--      Eva   21 puntos, 0 promesas, $0.00 — jugó y nadie le prometió
--      count 5, pledged 33.50
--
--  Y lo que NO tiene que salir: 999, 888 ni 777. Las columnas del
--  modelo viejo (amount, team_amount, platform_amount) están
--  rellenas con esos números a propósito. Si aparecen, la función
--  está leyendo lo que no debe.
-- ════════════════════════════════════════════════════════════════

-- ── LA GUARDA ───────────────────────────────────────────────────
--  Dos piezas, y hacen falta las dos.
--
--  1 · La transacción. Es lo que de verdad protege. Un RAISE solo
--      no protege nada: psql por defecto sigue con la sentencia
--      siguiente después de un error, y así se comprobó —la guarda
--      gritó, y detrás se crearon las seis tablas y se reemplazó
--      builder_check igual—. Dentro de BEGIN…COMMIT, el error deja
--      la transacción abortada, todo lo que viene detrás falla con
--      'current transaction is aborted', y el COMMIT final no
--      confirma nada. No depende de que la herramienta decida
--      pararse.
--
--  2 · El RAISE, que dice por qué. Va dentro de un DO porque RAISE
--      necesita PL/pgSQL, y va antes de la primera línea que
--      escribe, que una guarda después de los CREATE no guarda nada.
--
--  En Supabase la base se llama 'postgres', así que salta sola.
begin;

do $guarda$
begin
  if current_database() <> 'prueba' then
    raise exception
      'BANCO DE PRUEBAS: este fichero crea un esquema de mentira y un builder_check falso, y no va en la base buena. Base actual: "%". Córrelo en un Postgres local, en una base llamada "prueba" (las instrucciones están en la cabecera de este fichero).',
      current_database();
  end if;
end
$guarda$;

-- El esquema de verdad, con los nombres exactos que salieron de
-- information_schema. Sólo las columnas que la función puede tocar,
-- más las del mundo viejo a propósito: si la función leyera una de
-- ésas, aquí abajo tiene dónde fallar.
create table campaigns (id uuid primary key, name text);
create table challenges (
  id uuid primary key, campaign_id uuid, name text, slug text,
  pledge_deadline date, run_deadline date, team_share_pct integer,
  status text, created_at timestamptz, game text, live boolean,
  opens_at timestamptz, closes_at timestamptz, billed_at timestamptz);
-- coaches: de aquí saca el reporte a quién le escribe un padrino que
-- no sabe cómo pagar. Con los nombres de columna de verdad, que el
-- contacto se busca por access_code y no por campaign_id: una campaña
-- puede tener varios entrenadores y el que importa es el que mandó
-- los avisos.
create table coaches (id uuid primary key, campaign_id uuid, name text,
                      email text, access_code text, grade text, label text);

create table players (
  id uuid primary key, campaign_id uuid, coach_id uuid, name text,
  email text, phone text, status text, created_at timestamp,
  grade text, added_by text, added_at timestamptz, pin_hash text);
create table pledges (
  id uuid primary key, challenge_id uuid, player_id uuid,
  sponsor_name text, sponsor_email text, rate_per_point numeric,
  points_at_invoice integer, amount numeric, team_amount numeric,
  platform_amount numeric, stripe_invoice_id text, invoice_status text,
  invoiced_at timestamptz, paid_at timestamptz, created_at timestamptz,
  pay_link_url text, pay_link_id text, reminded_at timestamptz,
  reminder_count integer, lang text, cap numeric);
create table challenge_quarters (
  challenge_id uuid, player_id uuid, quarter smallint,
  level_reached integer, points integer, recorded_at timestamptz);
create table challenge_runs (
  id uuid primary key, challenge_id uuid, player_id uuid,
  level_reached integer, points integer, time_seconds numeric,
  played_at timestamptz, game text, attempts integer,
  threes integer, fouls integer);

-- builder_check de mentira, con la forma que la función espera:
-- ok, by, y campaigns como arreglo de {id,name}.
-- Acepta los DOS códigos de la misma campaña. Hace falta que acepte
-- los dos para poder comprobar lo que importa del contacto: que el
-- reporte saque al entrenador DUEÑO DEL CÓDIGO y no al primero de la
-- campaña. Con un solo código bueno, el otro camino se cae en la
-- puerta y no se prueba nada.
create or replace function builder_check(p_code text) returns json
language sql as $f$
  select case when p_code in ('CODIGO-BUENO', 'OTRO-CODIGO')
    then json_build_object('ok', true, 'by', 'John Burgos',
           'campaigns', json_build_array(
             json_build_object('id','aaaaaaaa-0000-0000-0000-000000000001','name','Canóvanas 15U')))
    else json_build_object('ok', false) end;
$f$;

-- ── Los datos ────────────────────────────────────────────────────
insert into coaches (id, campaign_id, name, email, access_code) values
  -- El que manda los avisos en la prueba.
  ('dddddddd-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
   'Coach Burgos','burgos@equipo.invalid','CODIGO-BUENO'),
  -- Otro de la MISMA campaña, con otro código y otro correo. Si el
  -- reporte cogiera el primero de la campaña en vez del dueño del
  -- código, el padrino recibiría el correo de este señor.
  ('dddddddd-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001',
   'Coach Que No Mandó','nomando@equipo.invalid','OTRO-CODIGO');

insert into campaigns values
  ('aaaaaaaa-0000-0000-0000-000000000001','Canóvanas 15U'),
  ('aaaaaaaa-0000-0000-0000-000000000002','Programa de otro');

insert into challenges (id, campaign_id, name, status, game, opens_at, closes_at, team_share_pct, billed_at) values
  ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
   'Reto de octubre','closed','fortress','2026-10-10 09:00+00','2026-10-17 20:00+00', 90, now()),
  ('cccccccc-0000-0000-0000-000000000009','aaaaaaaa-0000-0000-0000-000000000002',
   'Reto ajeno','closed','fortress','2026-10-10 09:00+00','2026-10-17 20:00+00', 90, null);

insert into players (id, campaign_id, name, status) values
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Ana (cuartos)','active'),
  ('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','Beto (corrida)','active'),
  ('bbbbbbbb-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','Caro (no jugó)','active'),
  ('bbbbbbbb-0000-0000-0000-000000000004','aaaaaaaa-0000-0000-0000-000000000001','Dani (sacado)','removed'),
  ('bbbbbbbb-0000-0000-0000-000000000005','aaaaaaaa-0000-0000-0000-000000000001','Eva (sin padrinos)','active');

-- Ana: cuatro cuartos, 10+12+9+14 = 45
insert into challenge_quarters (challenge_id, player_id, quarter, level_reached, points, recorded_at) values
  ('cccccccc-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001',1,4,10,now()),
  ('cccccccc-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001',2,4,12,now()),
  ('cccccccc-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001',3,3,9,now()),
  ('cccccccc-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001',4,5,14,now());
-- Beto: una corrida suelta de 36
insert into challenge_runs (id, challenge_id, player_id, level_reached, points, time_seconds, played_at, game) values
  ('dddddddd-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000002',8,36,74.5,now(),'fortress');
-- Eva: jugó, pero nadie le prometió nada
insert into challenge_runs (id, challenge_id, player_id, level_reached, points, time_seconds, played_at, game) values
  ('dddddddd-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000005',6,21,61.0,now(),'fortress');

-- Promesas. Las columnas del mundo viejo se rellenan con basura a
-- propósito: si la función las leyera, los números saldrían mal.
-- 'lang' lleva el idioma en que prometio el padrino, que es el que usa
-- el aviso. Aqui van los tres estados a proposito: 'es', 'en', y null
-- —filas viejas de antes de que existiera la columna—, que es el caso
-- en que no se puede adivinar y el aviso tiene que salir en los dos.
insert into pledges (id, challenge_id, player_id, sponsor_name, sponsor_email,
                     rate_per_point, cap, invoice_status, amount, team_amount,
                     platform_amount, paid_at, pay_link_url, reminder_count,
                     lang) values
  -- Ana, 45 puntos. 0.10 sin tope = 4.50
  ('11110000-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001','Abuela','abuela@x.invalid',
   0.10, null, 'open', 999, 888, 777, now(), 'http://cobra.me', 9, 'es'),
  -- Ana, 1.00 con tope 20 → 45 llegaría a 45, el tope lo baja a 20
  ('11110000-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001','Tío Orlando','tio@x.invalid',
   1.00, 20, 'open', 999, 888, 777, null, null, 0, 'en'),
  -- Ana, anulada: no debe contar
  ('11110000-0000-0000-0000-000000000003','cccccccc-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001','Anulado','nope@x.invalid',
   5.00, null, 'void', 999, 888, 777, null, null, 0, 'es'),
  -- Beto, 36 puntos a 0.25 = 9.00
  ('11110000-0000-0000-0000-000000000004','cccccccc-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000002','Vecino','vecino@x.invalid',
   0.25, null, 'open', 999, 888, 777, null, null, 0, null),
  -- Caro no jugó: 0 puntos → 0.00, aunque prometieron 0.50
  ('11110000-0000-0000-0000-000000000005','cccccccc-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000003','Madrina','madrina@x.invalid',
   0.50, null, 'open', 999, 888, 777, null, null, 0, 'es'),
  -- Dani está sacado y tenía padrino: 0 puntos → 0.00, pero sale
  ('11110000-0000-0000-0000-000000000006','cccccccc-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000004','Primo','primo@x.invalid',
   0.75, null, 'open', 999, 888, 777, null, null, 0, 'en'),
  -- Y una de OTRO reto, que no debe aparecer
  ('11110000-0000-0000-0000-000000000007','cccccccc-0000-0000-0000-000000000009',
   'bbbbbbbb-0000-0000-0000-000000000001','De otro reto','x@x.invalid',
   9.99, null, 'open', 999, 888, 777, null, null, 0, 'es');

-- Cierra la transacción que abre la guarda allá arriba. Si la guarda
-- saltó, aquí no hay nada que confirmar: la transacción viene
-- abortada y este COMMIT la deshace entera.
commit;
