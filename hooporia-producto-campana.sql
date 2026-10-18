-- ════════════════════════════════════════════════════════════════
--  DE QUÉ PRODUCTO ES UNA CAMPAÑA — campaigns.product
--
--  El problema que cierra esto: el admin construye el enlace con el
--  que un nene entra a jugar su corrida oficial, y para escoger el
--  dominio miraba el JUEGO:
--
--      const SITES = { basketball:'https://hoops.cash',
--                      school:'https://cadapunto.com' };
--      const BASKETBALL_GAMES = ['cashrack','spots'];
--
--  'fortress' no está en esa lista, así que TODO enlace de Fortress
--  salía apuntando a cadapunto.com. Para un reto de Hooporia, el
--  entrenador copiaba el enlace y mandaba a su jugador al otro
--  producto.
--
--  Y el admin no podía hacerlo mejor, porque no tenía cómo saberlo:
--  ni 'challenges' ni 'campaigns' llevaban producto, y los dos
--  productos usan los mismos juegos, así que por el juego no se
--  distinguen. El único sitio donde existía esa distinción era
--  bw_requests.product, que es la fila de la SOLICITUD, no de la
--  campaña.
--
--  ── Por qué en campaigns y no en challenges ──────────────────────
--  Un programa es de un producto. Si fuera por reto, habría que
--  acertarlo cada vez que se crea uno —y el día que alguien se
--  equivoque, los padrinos de ese reto reciben enlaces de otra marca
--  mientras los del reto de al lado los reciben bien. Por campaña se
--  decide una vez, al darla de alta, que es cuando quien la crea
--  tiene delante la solicitud con su etiqueta.
--
--  ── Por qué 'anotado' y no 'hooporia' ────────────────────────────
--  Es el mismo vocabulario que bw_requests.product, que se creó
--  cuando el producto se llamaba Anotado y sigue diciendo 'anotado'
--  en la base. Dos nombres para lo mismo en dos tablas es cómo se
--  escribe un bug: la comparación falla en un sitio y nadie sabe por
--  qué. El nombre de cara al público se traduce al pintar, como ya
--  hace la etiqueta del admin, que dice HOOPORIA leyendo 'anotado'.
--
--  ── Lo que pasa con las campañas que ya existen ──────────────────
--  Se quedan en 'cada-punto' por el valor por defecto, que es la
--  verdad: Hooporia salió hoy y no hay ni una campaña suya todavía.
--  Nadie tiene que tocar ninguna fila a mano.
--
--  Esto se puede correr dos veces sin romper nada.
-- ════════════════════════════════════════════════════════════════

alter table public.campaigns
  add column if not exists product text not null default 'cada-punto';

-- La restricción va en su propio bloque porque ADD CONSTRAINT no
-- tiene IF NOT EXISTS: correr el fichero dos veces reventaría ahí.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.campaigns'::regclass
       and conname  = 'campaigns_product_check'
  ) then
    alter table public.campaigns
      add constraint campaigns_product_check
      check (product in ('cada-punto', 'anotado'));
  end if;
end
$$;

comment on column public.campaigns.product is
  'De qué producto es esta campana: cada-punto o anotado (Hooporia). Decide a que dominio apuntan los enlaces que el admin le da al entrenador: el de jugar la corrida oficial, el de prometer, y el de las pruebas. Mismo vocabulario que bw_requests.product. Por defecto cada-punto, que es lo que eran todas antes de que existiera esta columna.';

-- ── Comprobación ────────────────────────────────────────────────
--  Tiene que salir una fila por producto con su cuenta. Si todas
--  dicen cada-punto, es lo correcto hasta que se cree la primera
--  campaña de Hooporia.
select product, count(*) as campanas
  from public.campaigns
 group by product
 order by product;
