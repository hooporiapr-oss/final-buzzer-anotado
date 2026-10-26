-- ════════════════════════════════════════════════════════════════
--  LAS SOLICITUDES — un programa que pide campaña
--
--  Lo que llena un entrenador en equipo.html y manda a /team-signup.
--
--  ── Por qué esta tabla existe ────────────────────────────────────
--  Hasta el 26 de octubre de 2026 una solicitud no se guardaba en
--  ninguna parte: /team-signup mandaba un correo y se acababa ahí. Si
--  el correo rebotaba, caía en Promociones o alguien lo borraba, la
--  solicitud no existía en ningún sitio — no había dónde mirarla.
--
--  Y el propio código decía lo contrario en dos sitios: el correo
--  prometía que «la petición ya está en la cola», y cuando el envío
--  fallaba el servidor contestaba 'request saved, notice failed'. No
--  había cola y no se guardaba nada. Las dos frases son verdad desde
--  que existe esta tabla, que es la mitad del motivo de escribirla.
--
--  ── Quién escribe y quién lee ────────────────────────────────────
--  Escribe el servidor, con la llave de servicio, antes de mandar el
--  correo. El aviso es el extra: si falla, la solicitud ya está a
--  salvo, que es justo al revés de como estaba.
--
--  Lee el admin, y nadie más. El navegador no inserta: una solicitud
--  entra por /team-signup o no entra.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.solicitudes (
  id          uuid primary key default gen_random_uuid(),

  -- Lo que escribe el entrenador.
  equipo      text not null,
  programa    text,
  coach       text,
  email       text not null,
  telefono    text,

  /* EL ACUSE DE LA LICENCIA, guardado entero y no como un sí.
     Es lo que el programa marcó haber leído al inscribirse, y el
     texto que marcó puede cambiar en la página con el tiempo. Sin
     guardar el texto de ese día, dentro de un año sabríamos que
     aceptó algo pero no qué. */
  licencia_ok   boolean not null default false,
  licencia_por  text,
  licencia_el   text,
  licencia_texto text,

  /* nueva → atendida. No hay «rechazada»: una solicitud que no
     cuaja se atiende igual —se le contesta— y se quita de la cola.
     Un estado que significa «le dijimos que no» pide un sitio donde
     escribir por qué, y eso es una conversación, no una columna. */
  estado      text not null default 'nueva'
              check (estado in ('nueva', 'atendida')),
  atendida_el timestamptz,

  creada      timestamptz not null default now()
);

-- La cola se mira por fecha, y casi siempre sólo las nuevas.
create index if not exists solicitudes_cola
  on public.solicitudes (estado, creada desc);

-- ── Quién puede verlas ───────────────────────────────────────────
alter table public.solicitudes enable row level security;

drop policy if exists solicitudes_admin_ve on public.solicitudes;
create policy solicitudes_admin_ve on public.solicitudes
  for select using (public.is_admin());

/* El admin sólo puede marcarlas atendidas. No puede editar lo que
   escribió el entrenador: es el acuse de lo que pidió y de lo que
   aceptó, y un acuse que se puede reescribir no acusa nada. */
drop policy if exists solicitudes_admin_atiende on public.solicitudes;
create policy solicitudes_admin_atiende on public.solicitudes
  for update using (public.is_admin()) with check (public.is_admin());

-- Ni insert ni delete desde el navegador. Una solicitud entra por
-- /team-signup, con la llave de servicio, o no entra.


-- ── Comprobación ─────────────────────────────────────────────────
--  Cuántas hay esperando:
--      select count(*) from public.solicitudes where estado = 'nueva';
--
--  La cola, como la pinta el admin:
--      select equipo, coach, email, creada
--        from public.solicitudes
--       where estado = 'nueva'
--       order by creada desc;
