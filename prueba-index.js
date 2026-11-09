/* ════════════════════════════════════════════════════════════════
   LA PORTADA, EN CINCO PARTES

   La portada se vació el 31 de octubre de 2026. Tenía once secciones
   —dos héroes, el calendario, la escalera de $17 → $68 → $816, el
   tope de padrinos, el equipo que perdió, a dónde va el dinero, el
   reporte entero con sus nueve columnas, los precios con sus tablas—
   y se leía como un manual. Ahora son cinco:

     1 · el cartel
     2 · cómo funciona, en cuatro pasos
     3 · un ejemplo, una sola cuenta
     4 · cuánto cuesta
     5 · inscribe tu equipo

   Esta prueba vigila dos cosas a la vez, y la segunda importa más que
   la primera: que las cinco estén, y que lo que se quitó NO vuelva.
   Una portada se llena sola — cada semana hay una frase más que
   parece imprescindible, y en tres meses vuelve a ser un manual.
   ════════════════════════════════════════════════════════════════ */
const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
const path = require('path');
const fs   = require('fs');
const FILE = 'file://' + path.resolve(__dirname, 'index.html');

let bad = 0;
const ok  = m => console.log('  ok   ' + m);
const mal = m => { bad++; console.log('  MAL  ' + m) };
const di  = m => console.log('\n' + m);
/* Media página va en versalitas por CSS y innerText las devuelve
   gritadas. Ninguna comprobación depende de la caja de una letra. */
const ci  = re => new RegExp(re.source, re.flags.includes('i') ? re.flags : re.flags + 'i');
const has = (t,re,q) => ci(re).test(t) ? ok(q) : mal(q + '  (no ' + re + ')');
const not = (t,re,q) => !ci(re).test(t) ? ok(q) : mal(q + '  (apareció ' + re + ')');

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });

  async function abrir(lang, ancho){
    const c = await b.newContext({ viewport:{ width: ancho||1280, height: 900 } });
    const p = await c.newPage();
    await p.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
    const errs = [];
    p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
    /* La prueba corta todo lo que no sea file:, que es lo correcto —
       una prueba no sale a la red. La portada pide la tipografía a
       Google, así que ese corte deja un error de consola que es de la
       prueba y no de la página. Se ignora ése y sólo ése. */
    p.on('console', m => {
      if (m.type() !== 'error') return;
      if (/Failed to load resource/.test(m.text())) return;
      errs.push('console: ' + m.text());
    });
    await p.goto(FILE + '?lang=' + lang, { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(350);
    return { c, p, errs };
  }

  // ════════ 1 · Las cinco partes, y ninguna más ════════
  di('1 · Seis secciones, y ninguna más');
  const { c:c1, p, errs } = await abrir('es');

  const secciones = await p.evaluate(() =>
    [...document.querySelectorAll('section')].map(s => s.id || s.className.split(' ')[0]));
  /* SEIS desde el 3 de noviembre de 2026, y a propósito: el dueño
     pidió la sección del Cognitivo Gym (The Reset, gratis con el
     código del equipo) antes de «Inscribe tu equipo». Una sexta que
     aparezca sin pedirla sigue haciendo fallar esto. */
  const esperadas = ['cartel','how','example','precio','cognitivo','signup'];
  JSON.stringify(secciones) === JSON.stringify(esperadas)
    ? ok('las seis, en orden: ' + secciones.join(' · '))
    : mal('salieron ' + secciones.length + ': ' + secciones.join(' · '));

  const marco = await p.evaluate(() => ({
    header: !!document.querySelector('header'),
    footer: !!document.querySelector('footer')
  }));
  marco.header && marco.footer ? ok('con su cabecera y su pie')
                               : mal('falta cabecera o pie');

  // ════════ 2 · El cartel ════════
  di('2 · El cartel');
  const cartel = await p.evaluate(() => {
    const i = document.querySelector('.cartel img');
    if (!i) return null;
    return { src:i.getAttribute('src'), w:i.naturalWidth, h:i.naturalHeight,
             ancho:Math.round(i.getBoundingClientRect().width),
             padre:Math.round(i.parentElement.getBoundingClientRect().width) };
  });
  if (!cartel) mal('no hay cartel');
  else {
    cartel.src === 'cadapunto-hero.jpg' ? ok('es cadapunto-hero.jpg') : mal('es ' + cartel.src);
    cartel.w > 0 ? ok('y carga de verdad (' + cartel.w + '×' + cartel.h + ')')
                 : mal('el fichero no carga');
    /* De borde a borde: el cartel es lo primero que se ve y lo que
       hace el trabajo. Si se queda en una columna centrada, no. */
    Math.abs(cartel.ancho - cartel.padre) <= 2
      ? ok('y ocupa el ancho entero')
      : mal('no llena el ancho: ' + cartel.ancho + ' de ' + cartel.padre);
  }
  /* Y QUE NO SE REPITAN SUS LEMAS DEBAJO. El cartel ya dice «nada que
     vender» y «sin rifas»; decirlo otra vez en texto es la clase de
     repetición que infló la portada la primera vez. */
  /* Salvo el lema de debajo del cartel (.lema), que dice «Sin rifas»
     a propósito: es el mensaje que el dueño pidió ahí, el 1 de
     noviembre. En el resto de la página la regla sigue igual. */
  const t = await p.evaluate(() => {
    const l = document.querySelector('.lema');
    return document.body.innerText.replace(l ? l.innerText : '', '');
  });
  not(t, /nada que vender|sin rifas|nada que entregar/,
      'y sus lemas no se repiten debajo en texto');

  // ════════ 3 · Cómo funciona ════════
  di('3 · Cómo funciona, en cuatro pasos');
  has(t, /Así de sencillo/,                                  'el titular');
  has(t, /Consigue padrinos/i,                                '01 consigue padrinos');
  has(t, /invitan a familiares, amigos y patrocinadores/,     'a quién invitan');
  has(t, /Juega y anota/i,                                    '02 juega y anota');
  has(t, /Sin enlaces de pago\. Sin recordatorios/,           'sin enlaces de pago');
  has(t, /Recibe tu reporte/i,                                '03 recibe tu reporte');
  has(t, /entrega un reporte completo a tu organización/,     'el reporte completo');
  has(t, /Tus fondos\. Tu control\./,                         'y debajo, tus fondos, tu control');
  has(t, /administra las promesas, no el dinero/,             'las promesas, no el dinero');
  /* TRES, desde que «invita» y «promete» se juntaron: compartían el
     mismo enlace, que es la señal de que son un solo movimiento. */
  const pasos = await p.evaluate(() => document.querySelectorAll('#how .paso').length);
  pasos === 3 ? ok('son tres pasos') : mal('salieron ' + pasos + ' pasos');
  const decl = await p.evaluate(() => { const e = document.querySelector('#how .pasos + .nocobra');
    return e && !e.classList.contains('paso') ? e.querySelector('h3').textContent : ''; });
  decl === 'Tus fondos. Tu control.' ? ok('«Tus fondos. Tu control.» justo debajo, y no es un paso')
                                     : mal('debajo de los pasos: ' + decl);

  // ════════ 4 · Un ejemplo: UNA cuenta ════════
  di('4 · Un juego, el poder de muchos');
  has(t, /Un juego\. Cada punto cuenta/i,                     'el titular');
  has(t, /Un punto en la cancha\. Muchas promesas detrás/,    'y su frase');
  has(t, /No importa quién enceste\. Cada punto suma para todos/, 'cada punto suma para todos');
  has(t, /El poder de muchos/i,                              'el poder de muchos');
  has(t, /20 padrinos prometen solo 25¢ por punto/,          '20 padrinos a 25¢');
  has(t, /\$5\.00 prometidos por cada punto entre todos/,     '$5.00 por punto entre todos');
  has(t, /68 puntos anotados por el equipo/,                 '68 puntos');
  has(t, /\$340/,                                            'el total, $340');
  has(t, /50 padrinos: \$850 en promesas/,                    'y con 50 padrinos, $850');
  has(t, /Cada padrino cuenta\. Cada punto multiplica/,       'cada punto multiplica');
  has(t, /We manage the pledges\. You manage the proceeds/,   'la frase de marca');
  has(t, /Las cantidades son promesas, no dinero cobrado/,    'y que son promesas, no dinero cobrado');

  /* LA CUENTA ES UNA. Eran tres peldaños y el que se llevaba un
     entrenador era el último: $816, por doce jugadores que a lo mejor
     no tiene y cuatro padrinos cada uno que nadie le ha prometido.
     Multiplicado por una temporada, una expectativa que la
     recaudación no iba a cumplir. */
  not(t, /\$816|\$68\.00|\$8,160|\$16,320|\$480|\$960|\$250|\$500|\$197\.20/,
      'y no volvió ninguna proyección');
  not(t, /La plantilla entera|12 jugadores|48 padrinos|120 padrinos/,
      'ni los multiplicadores de jugadores y padrinos');
  /* LAS CIFRAS, FUERA DE LA MUESTRA. La tarjeta del reporte tiene las
     suyas —$197.20 y las tres filas— y son datos de ejemplo, no
     proyecciones: nadie multiplica $20.40 por una temporada. Lo que
     se vigila es que no vuelvan cifras INVENTADAS al resto de la
     portada, que es de donde salía la expectativa. */
  /* SE ESCONDE LA TARJETA Y SE LEE EL DOM DE VERDAD. Clonar el body
     y leerle innerText no vale: en un nodo suelto innerText se cae a
     textContent, que sí trae el texto de los <script> — y ahí dentro
     hay un comentario que menciona la escalera vieja con sus «$5,
     $12, $25». La prueba fallaba por un comentario que explica por
     qué se quitó justo eso. */
  const fuera = await p.evaluate(() => {
    const c = document.querySelector('.rpcard');
    const antes = c ? c.style.display : null;
    if (c) c.style.display = 'none';
    const t = document.body.innerText;
    if (c) c.style.display = antes;
    return t;
  });
  const dolares = (fuera.match(/\$[\d,]+(?:\.\d\d)?/g) || []);
  const permitidos = new Set(['$5.00','$340','$850','$1','$99','$5']);
  const sobran = [...new Set(dolares)].filter(x => !permitidos.has(x));
  sobran.length === 0
    ? ok('fuera de la muestra, las únicas cifras son ' + [...new Set(dolares)].join(' '))
    : mal('cifras de más: ' + sobran.join(' '));

  // ════════ 5 · Cuánto cuesta ════════
  di('5 · Cuánto cuesta');
  has(t, /Precios simples\. Sin sorpresas/,  'el titular');
  has(t, /\$1 por cada promesa que cualifique/, 'el dólar por promesa que cualifica');
  has(t, /Máximo \$99 por juego/,         'y el tope por juego');
  has(t, /alcanza \$5 o\s+más/,           'qué cualifica: $5 o más');
  has(t, /nunca pagarás\s+más de \$99 por juego/, 'nunca más de $99');
  has(t, /Sin suscripción\. Sin costo inicial\. Sin cargos sorpresa/, 'sin suscripción ni sorpresas');
  has(t, /¿Tienes preguntas\?/,            'y la puerta a las preguntas');
  /* UNA SOLA TABLA, la de la muestra, y con TRES filas. La que se
     quitó tenía doce padrinos y nueve columnas; ésta enseña un caso
     normal, uno que rebotó y uno que no cualifica, y nada más. Si
     algún día crece, esto lo para. */
  const tab = await p.evaluate(() => {
    const t = [...document.querySelectorAll('table')];
    return { n: t.length, filas: t[0] ? t[0].rows.length : 0,
             cols: t[0] && t[0].rows[0] ? t[0].rows[0].cells.length : 0 };
  });
  /* SIN TABLA: la muestra del reporte se quitó; quedan sus dos botones. */
  tab.n === 0 ? ok('ninguna tabla en la portada')
              : mal('hay ' + tab.n + ' tabla(s)');
  not(t, /María Rivera|Rosa Vega|Tía Carmen|Canóvanas 15U vs\. Arecibo/, 'y sin las filas de muestra');

  /* EL PRECIO SE LEE DEL JS, y ahí sigue aunque la sección sea de
     texto: prueba-precio.js lo saca de aquí para cuadrar las siete
     páginas. Si FEE desapareciera, esa prueba se cae entera. */
  const src = fs.readFileSync(path.resolve(__dirname,'index.html'), 'utf8');
  /const FEE = \{/.test(src) ? ok('FEE sigue en el fichero, que es de donde lo lee prueba-precio')
                             : mal('FEE desapareció: prueba-precio.js se queda sin fuente');

  // ════════ 5b · Cognitivo Gym ════════
  di('5b · Cognitivo Gym: The Reset');
  has(t, /The Reset: la próxima jugada es la que cuenta/, 'el titular');
  has(t, /Gratis para todos/, 'gratis para todos');
  not(t, /código de su equipo|Ya tienes tu código|Beneficio exclusivo/, 'y sin pedir código de equipo');
  has(t, /Una señal\. Una respiración\. Una frase/, 'señal, respiración, frase');
  const grande = await p.evaluate(() => { const e = document.querySelector('.cgGratisH');
    return e ? parseFloat(getComputedStyle(e).fontSize) : 0; });
  grande >= 18 ? ok('y el «gratis» va en grande (' + grande + 'px)') : mal('el «gratis» no destaca: ' + grande + 'px');
  const cg = await p.evaluate(() =>
    [...document.querySelectorAll('#cognitivo a')].map(a => a.getAttribute('href')));
  cg[0] === 'https://hooporia.mobi/005-reset.html' ? ok('su botón abre The Reset directo')
                                                   : mal('el primer botón va a ' + cg[0]);
  !cg.some(h => /d=volleyball/.test(h || '')) ? ok('y ya no hay Reset de voleibol')
                                              : mal('todavía hay un botón de voleibol');
  not(t, /lección para la vida/, 'y ya no habla de lecciones para la vida');

  // ════════ 6 · Inscribe tu equipo ════════
  di('6 · Inscribe tu equipo');
  has(t, /Tus juegos ya están programados/, 'el titular');
  has(t, /Haz que cada punto cuente/,       'y su remate');
  const cta = await p.evaluate(() =>
    [...document.querySelectorAll('#signup a')].map(a => a.getAttribute('href')));
  cta.length === 1 && cta[0] === 'equipo.html'
    ? ok('un solo botón, a equipo.html')
    : mal('botones en el cierre: ' + JSON.stringify(cta));

  // ════════ 7 · Lo que se quitó, y que no vuelva ════════
  di('7 · Lo que se quitó');
  not(t, /El cuadro se llena solo|cuadro|bracket/i, 'sin el cuadro del torneo');
  not(t, /Sábado \d|2:00PM|4:00PM/,                 'sin la demostración de calendario');
  not(t, /Tú no llevas la cuenta|Valor de la promesa|En hoja de cálculo/,
      'sin el reporte largo ni sus cuatro formatos');
  /* PERO LA PUERTA AL REPORTE SE QUEDA. Es lo primero que pregunta
     quien decide por un programa: enséñamelo antes de inscribirme. */
  const puertas = await p.evaluate(() =>
    [...document.querySelectorAll('#how .pasoLink a')].map(a => a.getAttribute('href')));
  puertas.includes('reporte.html?ejemplo=1') && puertas.includes('reporte-es.csv')
    ? ok('y los dos enlaces al reporte siguen ahí')
    : mal('faltan los enlaces al reporte: ' + JSON.stringify(puertas));
  not(t, /No hay techo/,                            'sin la sección del tope');
  not(t, /Y el equipo que perdió|que lo perdió/,    'sin la del que perdió');
  /* SÓLO EN LAS SECCIONES. «El dinero no pasa por nosotros» sigue
     siendo el rótulo del enlace a custodia.html en el pie, y ahí se
     queda: lo que se quitó fue la sección que lo explicaba largo. */
  const tSec = await p.evaluate(() =>
    [...document.querySelectorAll('section')].map(s => s.innerText).join('\n'));
  /* LA FRASE SE QUEDA; LA SECCIÓN NO. «El dinero no pasa por
     nosotros» es ahora una línea del bloque «No cobramos», y es la
     respuesta a la primera pregunta que hace un director de
     programa. Lo que se quitó fue la sección de ocho párrafos que
     la explicaba, y eso se vigila por su rótulo. */
  not(tSec, /A dónde va el dinero/,                 'sin la sección larga del dinero');
  has(tSec, /Tus fondos\. Tu control/,                          'pero se dice que el dinero es suyo');
  has(tSec, /No recibimos, procesamos, guardamos ni cobramos/,    'y qué significa eso');
  not(t, /lavado de carros|car wash/,               'sin las comparaciones');

  /* LAS DOS QUE NO SE NEGOCIAN. Estaban antes y siguen: no se promete
     un enlace de pago —custodia.html dice que no procesamos nada— y
     no se dice ni se insinúa que una promesa sea deducible. */
  /* SE PROHÍBE PROMETERLO, NO NOMBRARLO. La portada dice «sin enlace
     de pago» —que es justo lo que custodia.html promete— y la regla
     anterior lo tomaba por una promesa de uno. Se vigila la promesa:
     un enlace de pago mencionado sin un «sin» delante. */
  const prometePago = /(?<!sin\s)enlace (?:para pagar|de pago)/i.test(t);
  !prometePago ? ok('y no se promete ningún enlace de pago')
               : mal('la portada promete un enlace de pago');
  has(t, /Sin enlaces de pago/, 'al contrario: dice que no lo hay');
  not(t, /deducib/i,                         'ni una palabra de deducciones');
  not(t, /\bdeuda\b|\bdeudor\b/,             'ni se le llama deuda a una promesa');

  // ════════ 8 · El español, sin JavaScript ════════
  di('8 · El español vive en el marcado');
  const sinJs = src.replace(/<script[\s\S]*?<\/script>/gi,' ')
                   .replace(/<style[\s\S]*?<\/style>/gi,' ')
                   .replace(/<!--[\s\S]*?-->/g,' ');
  const texto = sinJs.replace(/<[^>]+>/g,' ').replace(/&[a-z]+;|&#\d+;/gi,'x')
                     .replace(/\s+/g,' ').trim();
  texto.length >= 700
    ? ok('quedan ' + texto.length + ' caracteres sin ejecutar nada')
    : mal('sólo ' + texto.length + ': la portada volvió a ser un cascarón');
  has(texto, /Así de sencillo/,              'el titular está en el marcado');
  has(texto, /\$1 por cada promesa que cualifique/,'y el precio');
  has(texto, /Tus juegos ya están programados/, 'y el cierre');

  // ════════ 9 · Las llaves y el inglés ════════
  di('9 · Las dos tablas, iguales');
  const claves = [...new Set([...src.matchAll(/data-i="([^"]+)"/g)].map(m => m[1]))];
  const bloqueEn = src.split('en:{')[1].split('\n}')[0];
  const enk = new Set([...bloqueEn.matchAll(/\n([A-Za-z0-9_]+):'/g)].map(m => m[1]));
  const faltan = claves.filter(k => !enk.has(k));
  const demas  = [...enk].filter(k => !claves.includes(k));
  faltan.length === 0 ? ok('las ' + claves.length + ' llaves del marcado tienen inglés')
                      : mal('sin inglés: ' + faltan.join(', '));
  demas.length === 0  ? ok('y la tabla no lleva texto muerto')
                      : mal('texto muerto: ' + demas.join(', '));

  /* Ninguna llave dentro de otra: paint() recorre los [data-i] en
     orden y le mete innerHTML a cada uno, así que al pintar el padre
     el hijo se va del documento y se pinta desconectado. */
  const anidadas = await p.evaluate(() =>
    [...document.querySelectorAll('[data-i] [data-i]')].map(e => e.getAttribute('data-i')));
  anidadas.length === 0 ? ok('ninguna llave se pinta dentro de otra')
                        : mal('anidadas: ' + anidadas.join(', '));

  errs.length === 0 ? ok('y ni un error de página') : errs.forEach(e => mal(e));
  await c1.close();

  // ════════ 10 · El inglés, entero ════════
  di('10 · En inglés');
  const { c:c2, p:pe, errs:erre } = await abrir('en');
  const en = await pe.evaluate(() => document.body.innerText);
  has(en, /As simple as this/,            'el titular');
  has(en, /Get padrinos/i,                'los tres pasos');
  has(en, /Your funds\. Your control\./,  'y la declaración');
  has(en, /One game\. Every point counts/,'el ejemplo');
  has(en, /\$1 per qualifying pledge/,    'el precio');
  has(en, /\$99 maximum per game/,        'y su tope');
  has(en, /Your games are already scheduled/, 'el cierre');
  has(en, /Sign up my team/,              'y el botón');
  /* La frase de marca no se traduce: es la misma en las dos, a
     propósito, porque es lo que se repite en los términos. */
  has(en, /The power of many/i,           'el poder de muchos');
  has(en, /\$850 in pledges/,             'y los 50 padrinos');
  has(en, /We manage the pledges\. You manage the proceeds/, 'la frase de marca');
  has(en, /The amounts are pledges, not money collected/, 'y que son promesas');
  erre.length === 0 ? ok('sin errores de página') : erre.forEach(e => mal(e));
  await c2.close();

  // ════════ 11 · En el teléfono ════════
  di('11 · En el teléfono');
  for (const ancho of [430, 360]){
    const { c:c3, p:pm, errs:errm } = await abrir('es', ancho);
    const m = await pm.evaluate(() => ({
      corre: document.documentElement.scrollWidth > window.innerWidth,
      cartel: Math.round(document.querySelector('.cartel img').getBoundingClientRect().width),
      boton: !!document.querySelector('#signup a')
    }));
    !m.corre ? ok(ancho + 'px: la página no se mueve de lado')
             : mal(ancho + 'px: la página desborda a lo ancho');
    m.cartel <= ancho ? ok('  y el cartel cabe (' + m.cartel + 'px)')
                      : mal('  el cartel se sale: ' + m.cartel + 'px');
    m.boton ? ok('  con su botón de inscribir') : mal('  sin botón');
    errm.length === 0 || errm.forEach(e => mal(e));
    await c3.close();
  }

  await b.close();
  console.log('\n' + (bad === 0
    ? '✓ la portada son seis partes y nada más'
    : '✗ ' + bad + ' fallo(s)'));
  process.exit(bad === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1) });
