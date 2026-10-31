/* ══════════════════════════════════════════════════════════════════
   EL PRECIO DICE LO MISMO EN TODAS PARTES

   El precio vive en siete sitios: PRECIO en index.html, los términos,
   la divulgación del dinero, el FAQ, la hoja de alta, el admin y las
   constantes de la demostración. Son siete copias de un número que un
   día va a cambiar, y nada obliga a que cambien juntas.

   Ya pasó con el piso de $5: estaba en 50 centavos en el servidor y
   en $5 en la página, y un padrino cuya promesa daba $2 leía que no
   debía nada y recibía un aviso pidiéndole $2. Un precio desfasado
   es peor: es lo que una escuela va a leer antes de firmar.

   Así que PRECIO en index.html manda —es el que se pinta y el que lee
   un entrenador— y esto comprueba que las otras seis no lo
   contradigan.

   ══ EL 26 DE OCTUBRE DE 2026 ESTA PRUEBA CAMBIÓ DE FORMA ══

   Vigilaba una escalera de seis peldaños por tamaño de plantilla
   —$29 hasta siete nenes, $599 hasta ochocientos— que cobraba por
   evento, y comprobaba que fuera monótona y contigua: que el precio
   no bajara al subir la plantilla, y que no hubiera huecos ni
   solapes entre peldaños.

   Esa escalera se retiró entera. Ahora hay UN número y se cobra por
   JUEGO con promesas encima: la plantilla no entra en el cálculo, así
   que un equipo de ocho y uno de cuarenta pagan lo mismo por el mismo
   juego. No hay peldaños que ordenar, así que esas comprobaciones no
   tienen objeto y se fueron con ellos.

   Lo que se vigila ahora es más simple y más duro: que el número sea
   UNO, que las siete copias lo digan, y que NINGUNA se haya quedado
   con una cifra de la escalera vieja — que es el fallo de verdad que
   deja este cambio, una página en la que nadie se fijó diciendo $599
   mientras el resto del sitio dice $5.

       node prueba-precio.js
   ══════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

let fallos = 0;
const ok  = (m) => console.log('  ok   ' + m);
const mal = (m) => { fallos++; console.log('  MAL  ' + m) };
const si  = (v, m) => (v ? ok(m) : mal(m));
const leer = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

/* El número, sacado de index.html tal cual se despliega. */
const idx = leer('index.html');
const mf = idx.indexOf('const FEE = {');
if (mf < 0) { console.log('  MAL  no encuentro FEE en index.html'); process.exit(1) }
const FEE = new Function('return ' +
  idx.slice(idx.indexOf('{', mf), idx.indexOf('}', mf) + 1))();
const SUELO = FEE.suelo;
/* La regla entera, en una línea: tantas promesas cualificaron,
   tantos dólares, y a partir del techo deja de subir. */
const licencia = (n) => n > 0 ? Math.min(n, FEE.tope) * FEE.porPromesa : 0;

/* ── EL MÍNIMO DE CINCO JUEGOS, RETIRADO ──────────────────────────
   Esto leía MINIMO de index.html y abortaba la prueba entera si no
   lo encontraba. El mínimo se retiró el 28 de octubre de 2026: con
   un juego basta, y cada juego de más es otra oportunidad.

   La constante nunca llegó a comprobarse contra el texto de ninguna
   página — se parseaba y se guardaba. Ahora se vigila lo contrario,
   y en las seis páginas de dinero a la vez, porque la frase vivía en
   cuatro: la portada, ayuda, custodia y la CASILLA DE
   CONSENTIMIENTO de equipo.html. Esa última es la que marca una
   escuela al inscribirse, así que una sola que se quede atrás es un
   compromiso que alguien acepta sin que nadie se lo pida. */
const MINIMOS_RETIRADOS = [
  /se inscribe con cinco juegos/i,
  /signs? up for five games/i,
  /activa cinco juegos/i,
  /activates five games/i,
  /cinco juegos para empezar/i,
  /five games to start/i
];

/* Las cifras de la escalera POR PLANTILLA, que se retiró. Cualquiera
   de éstas en una página de dinero es la frase vieja sin cambiar. */
const RETIRADAS = [29, 49, 149, 349, 599];

console.log('\n1 · El precio, por dentro\n');
{
  si(FEE.porPromesa === 1, 'un dólar por promesa que cualifica');
  si(FEE.tope === 99, 'y el techo son $' + FEE.tope);
  si(FEE.suelo === 5, 'una promesa cualifica desde $' + FEE.suelo);

  /* NO BAJA NUNCA. Si recoger una promesa más pudiera salir más
     barato, habría un número de padrinos que conviene no pasar — y
     eso es exactamente lo que un precio no puede hacer. */
  let sube = true;
  for (let n = 1; n <= 150; n++) if (licencia(n) < licencia(n - 1)) sube = false;
  si(sube, 'y el precio nunca baja al recoger una promesa más');

  /* SE CUENTA CON LOS DEDOS, que es la razón de haber retirado la
     escalera: lo que paga un juego es el número de promesas que
     cualificaron, sin tabla que consultar. */
  si(licencia(1) === 1 && licencia(23) === 23 && licencia(60) === 60,
     'una promesa un dólar, veintitrés veintitrés, sesenta sesenta');

  /* Y DEJA DE SUBIR. Un programa que lo hace muy bien no puede
     acabar pagando más por hacerlo mejor. */
  si(licencia(99) === 99 && licencia(100) === 99 && licencia(500) === 99,
     'a partir de 99 ya no sube, pase lo que pase');

  si(licencia(0) === 0, 'y sin promesas que cualifiquen no hay cargo');
}

console.log('\n2 · La portada lo dice en una línea, sin tabla\n');
{
  /* LA TABLA DE EJEMPLOS NO PUEDE VOLVER. Seis filas diciendo «5
     promesas $5», «25 promesas $25» leídas en columna se leen como
     peldaños, que es lo que se acaba de retirar. Un dólar por
     promesa se explica en una frase. */
  si(!/id="escalera"/.test(idx), 'ya no hay tabla de ejemplos');
  si(!/escCuantas|escTope/.test(idx),
     'ni los rótulos que la rellenaban');

  /* Lo que sí tiene que estar: la regla dicha, y qué cualifica. */
  si(/priceQ1/.test(idx) && /priceQ2/.test(idx),
     'pero sí dice qué hace que una promesa cualifique, con su ejemplo');
  si(/priceNoPay/.test(idx), 'y qué pasa si no se paga');
  si(/licenciaDe/.test(idx),
     'y la regla sigue escrita una sola vez, para poder comprobarla');

  /* Y QUE NO SE PISEN LOS HUECOS. {D} y {H} son los de los rótulos
     de cada fila; si conPrecio los sustituyera, las seis filas
     saldrían con el mismo número y nada fallaría. */
  const cp = idx.slice(idx.indexOf('function conPrecio'), idx.indexOf('function conPrecio') + 400);
  si(!/\{D\}|\{H\}/.test(cp),
     'y conPrecio no toca {D} ni {H}, que son los huecos de las filas');
}

console.log('\n3 · Las otras seis no la contradicen\n');
{
  /* Las páginas de letra pequeña no repiten el número en cifra:
     lo dicen con palabras —«cinco dólares por juego»— porque una
     cifra repetida en siete sitios es una cifra que un día dirá
     cosas distintas. Lo que sí tienen que decir bien es el MODELO:
     por juego, con promesas, y que un juego sin promesas no se
     factura.

     equipo.html entró en esta lista el 23 de octubre de 2026, y era
     el peor de los que faltaban: su línea lic: es la que un programa
     MARCA para aceptar la licencia. Si ahí dice un precio que no es,
     lo que se ha aceptado no es lo que se va a facturar. */
  const PAGINAS = [
    ['terms.html',    2],
    ['custodia.html', 2],
    ['ayuda.html',    2],
    ['equipo.html',   4],   // lic: y fineP:, en los dos idiomas
    ['admin.html',    1]
  ];

  for (const [f, copias] of PAGINAS) {
    const t = leer(f);
    const sinComentarios = t.replace(/<!--[\s\S]*?-->/g, '');

    /* POR JUEGO, dicho tantas veces como copias tiene la página.
       Contar y no sólo buscar: terms y custodia llevan el texto dos
       veces, una por idioma, y con un indexOf a secas cambiar el
       inglés y dejar el español pasaba la prueba. */
    /* «per-game» con guión cuenta igual que «per game»: la línea que
       un programa marca dice «the per-game license», y exigir la
       forma sin guión la dejaba fuera por un carácter. */
    const porJuego = (sinComentarios.match(/per[- ]game|por juego/gi) || []).length;
    si(porJuego >= copias,
       f + ' dice «por juego» en sus ' + copias + ' copia(s) (' + porJuego + ')');

    /* Y QUE UN JUEGO SIN PROMESAS NO SE FACTURA. Es la única promesa
       que estas páginas hacen sobre dinero, y la que hace que el
       mínimo de inscripción no sea un cargo. */
    /* Cada página lo dice con sus palabras —«no fee is invoiced for
       it», «no se le factura ningún cargo»— así que se busca la IDEA
       y no una frase concreta: promesas ninguna, y cargo ninguno.
       Pedir una redacción exacta hacía fallar a terms.html, que lo
       dice perfectamente desde antes de este cambio. */
    const sinCargo =
      /no pledges,? no fee/i.test(sinComentarios) ||
      /sin promesas,? sin cargo/i.test(sinComentarios) ||
      /records no pledges[\s\S]{0,60}?(not invoiced|no fee)/i.test(sinComentarios) ||
      /ni una promesa,?[\s\S]{0,40}?no se (le )?factura/i.test(sinComentarios);
    si(sinCargo, f + ' dice que un juego sin promesas no se factura');

    /* NINGUNA CIFRA DE LA ESCALERA RETIRADA. Éste es el fallo que
       deja este cambio: una página en la que nadie se fijó diciendo
       $599 mientras el resto del sitio dice $5.

       Se saltan las cifras de EJEMPLO de custodia.html —$16,20,
       $6,45 y $42,75, las promesas desiguales que explican por qué la
       cuenta a mano no la lleva nadie— porque no son precios de
       licencia. Se reconocen porque llevan centavos. */
    const sinCentavos = sinComentarios.replace(/\$\d+[.,]\d\d/g, '');
    const quedan = RETIRADAS.filter(n => new RegExp('\\$' + n + '\\b').test(sinCentavos));
    si(quedan.length === 0,
       f + ' no se quedó con ninguna cifra de la escalera vieja' +
       (quedan.length ? ' — sobran: ' + quedan.map(n => '$' + n).join(', ') : ''));

    /* Ni con el vocabulario del modelo viejo, que es por dónde se
       cuela media frase sin cambiar: cobrar POR EVENTO y fijar el
       cargo SEGÚN LA PLANTILLA eran las dos piezas del precio
       retirado.

       Se busca la AFIRMACIÓN y no la palabra. Las páginas nuevas
       dicen «no depende del tamaño de la plantilla» y «does not
       change with the size of the roster» —que es copy correcto y
       deliberado: niega justo el modelo viejo— y una regex que
       mirara el sustantivo a secas suspendía las cuatro páginas por
       decir bien lo que tienen que decir. */
    const viejo =
      /licen[cs]\w*\s+per\s+event/i.test(sinComentarios) ||
      /se licencia por evento|licencia por evento/i.test(sinComentarios) ||
      /fee set by the size of the roster/i.test(sinComentarios) ||
      /cargo fijo (que depende del|según el) tamaño/i.test(sinComentarios);
    si(!viejo, f + ' ya no cobra por evento ni fija el cargo por plantilla');
  }
}

console.log('\n4 · La demostración cobra lo que dice la portada\n');
{
  /* demo.html lleva su propia copia de la escalera, en constantes y
     no en texto: calcula en vivo lo que habría recaudado un programa
     y lo que costaría la licencia. Es el único sitio donde el precio
     no se LEE —se calcula— así que un desfase sale como un número
     creíble y falso, y no lo nota nadie.

     Tuvo dos precios por plantilla, después uno solo, y ahora la
     escalera. Lo que se exige es que sus peldaños sean EXACTAMENTE
     los de la portada, y que el que use sea el que le toca a las
     promesas que modela. */
  const d = leer('demo.html');
  const mtope = d.match(/var TOPE_LIC\s*=\s*(\d+)/);
  if (!mtope) mal('no encuentro el techo en demo.html');
  else {
    si(+mtope[1] === FEE.tope,
       'su techo es el mismo que el de la portada ($' + FEE.tope + ')');

    /* Y el precio que enseña es el que le toca. La demostración
       modela doce jugadores con cuatro padrinos cada uno: 48
       promesas. Si alguien cambia los padrinos o la plantilla y no
       mira el precio, esto lo dice. */
    const mp = d.match(/PADRINOS\s*=\s*(\d+)/);
    const mq = d.match(/PLANTILLA\s*=\s*(\d+)/);
    if (!mp || !mq) mal('no encuentro padrinos y plantilla en demo.html');
    else {
      const n = +mp[1] * +mq[1];
      si(/var LICENCIA = peldano\(PROMESAS\)/.test(d),
         'y el precio lo saca de la regla y no de una cifra escrita');
      ok('modela ' + n + ' promesas, que a un dólar cada una son $' + licencia(n));
    }

    /* LA ESCALERA RETIRADA NO PUEDE QUEDAR AQUÍ. Una tabla vieja en
       la demostración enseña un precio que ya nadie cobra. */
    si(!/TARIFAS_LIC/.test(d), 'y ya no lleva la escalera de peldaños');
  }

  si(!/LICENCIA_CHICA|PLANTILLA_CHICA/.test(d),
     'y ya no lleva las dos tarifas por plantilla');
}

console.log('\n4b · Y al padrino no se le suma nada\n');
{
  /* ESTA SECCIÓN EXISTE POR UN FALLO QUE SE ESCAPÓ.

     El 26 de octubre de 2026 se portó scoreboard.html desde la
     generación anterior. Se le miró la marca, la barra, los enlaces
     y las cuatro pruebas del sitio, y pasó todas — porque ninguna
     miraba lo que esa página le dice a un padrino sobre dinero.

     Y lo que le decía era que a su promesa se le añadía un 20% de
     plataforma. No era sólo texto: la línea se calculaba y los
     botones de tarifa enseñaban el total multiplicado por 1.20. Una
     promesa de $25.00 le salía por $30.00.

     Ese cargo se retiró del producto cuando Cada Punto pasó a
     licenciarse al programa. Los términos, la divulgación, el FAQ y
     la hoja de alta dicen desde entonces que no es un por ciento de
     nada y que al padrino no se le cobra nada. La página portada
     decía lo contrario, en la pantalla donde alguien promete.

     Las páginas que mira esto son las que ve un padrino. No se les
     exige que hablen de la licencia —no es asunto suyo— sino que no
     le sumen nada a lo que prometió. */
  const DEL_PADRINO = ['prometer.html', 'scoreboard.html',
                       'padrinos.html', 'jugador.html'];

  for (const f of DEL_PADRINO) {
    let t;
    try { t = leer(f) } catch (e) { mal('no encuentro ' + f); continue }
    const limpio = t.replace(/<!--[\s\S]*?-->/g, '')
                    .replace(/\/\*[\s\S]*?\*\//g, '');

    /* Un por ciento de plataforma, dicho de cualquier manera. */
    const porCiento = /platform fee|cargo de plataforma|% de plataforma|\d+% platform/i
      .test(limpio);
    si(!porCiento, f + ' no le nombra ningún cargo de plataforma al padrino');

    /* Y sin calcularlo por lo bajo. Ésta es la que habría cazado el
       fallo: el texto se puede cambiar y dejar la cuenta puesta, y
       entonces la página dice una cosa y cobra otra. */
    const calcula = /\*\s*0\.20\b|\*\s*1\.20\b|\*\s*0,20\b/.test(limpio);
    si(!calcula, f + ' tampoco se lo calcula por lo bajo');
  }
}

console.log('\n4b · Ninguna página pide un mínimo de juegos\n');
{
  /* La frase vivía en cuatro páginas, y una de ellas es la casilla
     que marca una escuela al inscribirse. Una sola que se quede
     atrás es un compromiso de temporada que alguien acepta sin que
     nadie se lo pida. */
  for (const f of ['index.html', 'terms.html', 'custodia.html',
                   'ayuda.html', 'equipo.html', 'demo.html']) {
    const t = leer(f).replace(/<!--[\s\S]*?-->/g, '')
                     .replace(/\/\*[\s\S]*?\*\//g, '');
    const pillada = MINIMOS_RETIRADOS.find((r) => r.test(t));
    si(!pillada, f + ' no le pide un mínimo de juegos a nadie' +
       (pillada ? '  (dice ' + pillada + ')' : ''));
  }
}

console.log('\n5 · Y nadie promete una deducción\n');
{
  /* No es una comprobación de precio, pero vive aquí porque es la
     frase que se cuela cuando alguien reescribe una página de
     dinero: «deducible de impuestos» no lo decimos en ningún sitio
     y en ningún idioma. */
  for (const f of ['index.html', 'terms.html', 'custodia.html',
                   'ayuda.html', 'equipo.html', 'demo.html']) {
    const t = leer(f).replace(/<!--[\s\S]*?-->/g, '');
    /* Se permite la frase que lo NIEGA —«no decimos que una promesa
       sea deducible», «we do not issue tax receipts»— que es justo
       lo que custodia.html y los términos TIENEN que decir. Lo que
       no se permite es afirmarlo.

       Así que se mira cada mención por separado y se le lee lo que
       lleva delante: si en los sesenta caracteres anteriores hay una
       negación, es la frase que nos protege y no la que nos hunde.
       Con una regex a secas, las dos páginas que mejor lo dicen eran
       las dos que suspendían. */
    const menciones = [...t.matchAll(/deducib\w*|tax deduction|deducción de impuestos/gi)];
    const afirmadas = menciones.filter(m => {
      const antes = t.slice(Math.max(0, m.index - 80), m.index);
      /* «ni» cuenta como negación, y hacía falta: los términos dicen
         «no decimos que su pago sea caritativo NI que es deducible»,
         donde la única negación cerca de la palabra es ésa. Sin ella
         la página que mejor lo niega era la que suspendía. */
      if (/\b(no|not|never|ni|nunca|ningún|ninguna|sin|don't|do not|does not)\b/i.test(antes)) return false;
      /* Y una PREGUNTA no es una afirmación. El FAQ titula una de sus
         entradas «¿Esto es deducible de impuestos?» justamente para
         contestar que no; leer ese título como una promesa de
         deducción es leerlo al revés. */
      const hasta = t.slice(m.index, m.index + 80);
      if (/^[^.!]*\?/.test(hasta) || /¿[^?]*$/.test(antes)) return false;
      return true;
    });
    si(afirmadas.length === 0,
       f + ' no promete ninguna deducción' +
       (menciones.length ? ' (' + menciones.length + ' mención(es), todas negadas)' : ''));
  }
}

console.log('\n' + (fallos === 0
  ? '✓ el precio dice lo mismo en los siete sitios'
  : '✗ ' + fallos + ' fallo(s)'));
process.exit(fallos ? 1 : 0);
