/* ══════════════════════════════════════════════════════════════════
   LA DEMOSTRACIÓN DE BANDA

   Esta página se enseña de pie, en el borde de una cancha, en el
   teléfono de uno, a alguien que nunca ha visto nada parecido. Si
   algo falla ahí no hay segunda oportunidad: el entrenador no
   vuelve a pedirlo.

   Y es la única página del sitio donde un error de cuenta no se
   nota. Una cifra mal no da error, no sale en rojo y no rompe
   nada — simplemente le dices a alguien que recaudaría una
   cantidad que no es. Por eso aquí la aritmética se comprueba
   contra números calculados aparte, no contra lo que diga la
   propia página.

   Lo que mira:

     1 · la aritmética, incluidos los bordes
     2 · el viaje de ida y vuelta con el juego
     3 · que una puntuación inventada en la URL no la rompa
     4 · los dos idiomas
     5 · que quepa en un teléfono y no toque la base

       node prueba-demo.js
   ══════════════════════════════════════════════════════════════════ */
'use strict';
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

let fallos = 0;
const ok  = (m) => console.log('  ok   ' + m);
const mal = (m) => { fallos++; console.log('  MAL  ' + m); };
const eq  = (a, b, m) => (JSON.stringify(a) === JSON.stringify(b) ? ok(m)
  : mal(m + '\n         esperaba: ' + JSON.stringify(b) +
            '\n         vino:     ' + JSON.stringify(a)));
const si  = (v, m) => (v ? ok(m) : mal(m));

const AQUI = __dirname;
const url = (q) => 'file://' + path.join(AQUI, 'demo.html') + (q || '');

/* Los mismos números que la página, escritos APARTE a propósito. Si
   alguien cambia el ejemplo en demo.html y no aquí, la prueba lo
   dice — que es justo lo que tiene que pasar cuando se toca una
   cifra que se le enseña a un cliente. */
const PADRINOS = 4, TARIFA = 0.25, PLANTILLA = 12, PISO = 5;
const esperado = (p) => ({
  porPunto:  PADRINOS * TARIFA,
  unJugador: p * PADRINOS * TARIFA,
  programa:  p * PADRINOS * TARIFA * PLANTILLA,
  corto:     (p * TARIFA) < PISO
});

(async () => {
const navegador = await chromium.launch();

// ── 1 · La aritmética ─────────────────────────────────────────────
console.log('\n1 · La cuenta, en los bordes y en el medio\n');
for (const p of [0, 19, 20, 21, 120, 347, 1000]) {
  const pag = await navegador.newPage({ viewport: { width: 390, height: 800 } });
  await pag.goto(url('?p=' + p));
  await pag.waitForTimeout(120);

  const e = esperado(p);
  const texto = await pag.locator('main').innerText();
  const dinero = (n) => '$' + n.toLocaleString('en-US',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* Se busca la cifra en la página tal cual, con sus comas y sus dos
     decimales: así la prueba falla también si el formato se rompe y
     el total sale como «1440» o «$1440.5». */
  const tieneJug = texto.indexOf(dinero(e.unJugador)) !== -1;
  const tienePro = texto.indexOf(dinero(e.programa)) !== -1;

  if (p === 0) {
    si(texto.indexOf('$0.00') !== -1, 'con 0 puntos la cuenta sale a cero y no se rompe');
  } else if (tieneJug && tienePro) {
    ok(p + ' puntos → ' + dinero(e.unJugador) + ' un jugador, ' +
       dinero(e.programa) + ' el programa');
  } else {
    mal(p + ' puntos: falta ' + (!tieneJug ? dinero(e.unJugador) + ' (jugador)' : '') +
        (!tienePro ? ' ' + dinero(e.programa) + ' (programa)' : '') +
        '\n         en: ' + texto.replace(/\s+/g, ' ').slice(0, 200));
  }

  // El aviso del piso sale exactamente cuando debe y no cuando no.
  const hayAviso = await pag.locator('.aviso').count() > 0;
  if (hayAviso !== e.corto) {
    mal(p + ' puntos: el aviso del piso ' + (hayAviso ? 'sale y no debería' :
        'no sale y debería') + ' (una promesa suelta da ' +
        dinero(p * TARIFA) + ')');
  }
  await pag.close();
}

{
  const pag = await navegador.newPage({ viewport: { width: 390, height: 800 } });
  await pag.goto(url('?p=19'));
  await pag.waitForTimeout(100);
  si(await pag.locator('.aviso').count() === 1,
     'a 19 puntos avisa: una promesa de $4.75 no pasa el piso de $5');
  await pag.goto(url('?p=20'));
  await pag.waitForTimeout(100);
  si(await pag.locator('.aviso').count() === 0,
     'y a 20 ya no, porque son $5 justos');
  await pag.close();
}

// ── 2 · El precio, dicho ──────────────────────────────────────────
console.log('\n2 · Y dice lo que cuesta\n');
{
  const pag = await navegador.newPage({ viewport: { width: 390, height: 800 } });
  await pag.goto(url('?p=120'));
  await pag.waitForTimeout(120);
  const t = await pag.locator('main').innerText();
  si(t.indexOf('$49.00') !== -1, 'la licencia de $49 está en la página');
  si(t.indexOf('$29.00') !== -1, 'y la de $29 para plantilla corta');
  si(/directly|directo/i.test(t), 'y que los padrinos le pagan al programa directo');
  await pag.close();
}

/* ── 2b · Qué es esto y qué es una corrida de verdad ──────────────
   Un entrenador que juega cuatro minutos y se cree que eso es el
   juego no sabe qué le están vendiendo — y en una banda, con el
   teléfono prestado, nadie está ahí para aclarárselo. La diferencia
   estaba dicha en gris y DEBAJO del botón, que es el sitio donde no
   se lee. Esto comprueba que esté, que esté ANTES del botón, y que
   los dos números —1 y 5— se puedan comparar de un vistazo. */
console.log('\n2b · Dice qué es esto y qué es una corrida oficial\n');
for (const [loc, etq] of [['en-US','en'], ['es-PR','es']]) {
  const ctx = await navegador.newContext({ locale: loc,
    viewport: { width: 390, height: 900 } });
  const pag = await ctx.newPage();
  await pag.goto(url());
  await pag.waitForTimeout(150);

  const d = await pag.evaluate(() => {
    const c = document.querySelector('.comparar');
    if (!c) return { falta: true };
    const b = document.querySelector('.btn');
    return {
      texto: c.innerText,
      antes: c.getBoundingClientRect().bottom <= b.getBoundingClientRect().top,
      columnas: getComputedStyle(c.querySelector('.cols'))
                  .gridTemplateColumns.split(' ').length
    };
  });
  si(!d.falta, etq + ' · la tabla de comparación está en la portada');
  if (d.falta) { await ctx.close(); continue }
  si(d.antes, etq + ' · y va ANTES del botón, no debajo');
  si(d.columnas === 2, etq + ' · en dos columnas, para comparar de un vistazo');
  si(/\b1 (minute|minuto)\b/.test(d.texto),
     etq + ' · dice que esta demostración lleva cuartos de 1 minuto');
  si(/\b5 (minutes|minutos)\b/.test(d.texto),
     etq + ' · y que una corrida oficial los lleva de 5');
  si(/(One per player|Una por jugador)/i.test(d.texto),
     etq + ' · y que la oficial es UNA por jugador');
  si(/(refuses a second|rechaza la segunda)/i.test(d.texto),
     etq + ' · y por qué: la base de datos rechaza la segunda');
  si(/(BEST|MEJOR)/.test(d.texto),
     etq + ' · y que cada cuarto se queda con la mejor tirada');
  await ctx.close();
}

// ── 3 · Una puntuación inventada en la URL ────────────────────────
console.log('\n3 · Lo que llega por la URL no la rompe\n');
for (const [q, qué] of [['?p=abc', 'texto'], ['?p=-5', 'un negativo'],
                        ['?p=', 'vacío'], ['', 'sin parámetro'],
                        ['?p=<script>alert(1)</script>', 'una inyección']]) {
  const pag = await navegador.newPage({ viewport: { width: 390, height: 800 } });
  let reventó = null;
  pag.on('pageerror', e => { reventó = e.message });
  await pag.goto(url(q));
  await pag.waitForTimeout(120);
  const t = await pag.locator('main').innerText();
  const hayBoton = await pag.locator('a[href*="demo=1"]').count() > 0;
  if (reventó) mal(qué + ': la página reventó — ' + reventó);
  else if (/NaN|undefined|null/.test(t)) mal(qué + ': sale NaN o undefined en pantalla');
  else if (!hayBoton) mal(qué + ': no ofrece jugar');
  else ok(qué + ' → vuelve a la portada y ofrece jugar');
  await pag.close();
}

// ── 4 · Los dos idiomas ───────────────────────────────────────────
console.log('\n4 · Los dos idiomas, y se queda el elegido\n');
{
  const ctx = await navegador.newContext({ locale: 'en-US',
                                           viewport: { width: 390, height: 800 } });
  const pag = await ctx.newPage();
  await pag.goto(url('?p=120'));
  await pag.waitForTimeout(150);

  eq(await pag.locator('#langBtn').textContent(), 'Español',
     'en inglés el botón ofrece español');
  /* innerText aplica text-transform, y los encabezados de los pasos
     van en versalitas: la primera versión buscaba «What it costs
     you» y la página decía «WHAT IT COSTS YOU». */
  si(/what it costs you/i.test(await pag.locator('main').innerText()),
     'y la página está en inglés');

  await pag.locator('#langBtn').click();
  await pag.waitForTimeout(150);
  eq(await pag.locator('#langBtn').textContent(), 'English', 'al pulsarlo cambia');
  const es = await pag.locator('main').innerText();
  si(/lo que te cuesta/i.test(es), 'y el texto también');
  /* El dinero también cambia de formato, que es la parte que se
     olvida: en es-PR el separador de miles no es el mismo. */
  si(/1[.,]440[.,]00/.test(es), 'incluidas las cifras (' +
     (es.match(/\$[\d.,]+0/) || ['?'])[0] + ')');

  await pag.reload();
  await pag.waitForTimeout(150);
  eq(await pag.locator('#langBtn').textContent(), 'English',
     'y al recargar sigue en español');
  await ctx.close();
}

// ── 5 · El teléfono, y que no toque la base ───────────────────────
console.log('\n5 · Cabe en un teléfono y no habla con nadie\n');
for (const w of [320, 390]) {
  const pag = await navegador.newPage({ viewport: { width: w, height: 800 } });
  const fuera = [];
  pag.on('request', r => {
    const u = r.url();
    if (u.indexOf('file://') !== 0) fuera.push(u);
  });
  await pag.goto(url('?p=120'));
  await pag.waitForTimeout(250);

  const m = await pag.evaluate(() => ({
    s: document.documentElement.scrollWidth,
    v: document.documentElement.clientWidth
  }));
  si(m.s <= m.v + 1, w + 'px — sin arrastre lateral');
  if (w === 390) {
    /* Lo importante de una demostración sin rastro: no escribe en
       Supabase porque no habla con Supabase. Se comprueba mirando
       QUÉ pide la página, no confiando en que no lo pida. */
    eq(fuera, [], 'no pide nada a ningún servidor — ni a Supabase');
    const altos = await pag.evaluate(() =>
      [].filter.call(document.querySelectorAll('a.btn'),
        a => a.getBoundingClientRect().height < 44).length);
    eq(altos, 0, 'y los botones se pulsan con el dedo');
  }
  await pag.close();
}

// ── 6 · La ida y la vuelta con el juego ───────────────────────────
console.log('\n6 · El juego devuelve la puntuación\n');
{
  const pag = await navegador.newPage({ viewport: { width: 390, height: 800 } });
  pag.on('pageerror', () => {});
  /* El juego baja three.js de un CDN que este taller no deja salir,
     y sin él su script muere antes de pintar los rótulos: el botón
     del scrimmage existía pero estaba vacío, y la prueba lo leía
     como un fallo del producto. Se sirve la copia vendida en local,
     que es lo mismo que el navegador del entrenador recibirá del
     CDN. */
  await pag.route('**/three.min.js', (ruta) =>
    ruta.fulfill({ path: '/opt/node-tools/vendor/three.min.js',
                   contentType: 'application/javascript' }));
  await pag.goto(url());
  await pag.waitForTimeout(150);

  const juega = pag.locator('a[href*="demo=1"]').first();
  si(await juega.count() > 0, 'la portada lleva al juego con ?demo=1');

  await juega.click();
  await pag.waitForTimeout(900);
  si(pag.url().indexOf('fortress-vr.html') !== -1, 'y abre el juego');

  /* El scrimmage NO arranca solo, y es a propósito: el cuarto lleva
     reloj de cinco minutos, y arrancarlo al cargar la página sería
     gastárselos mientras el teléfono cambia de mano. El toque en
     «Scrimmage» es el entrenador diciendo que está listo. Lo que sí
     tiene que pasar es que ese botón esté ahí y a la vista. */
  const listo = await pag.evaluate(() => {
    const b = document.getElementById('goAmistoso');
    if (!b) return 'no existe el botón de scrimmage';
    const r = b.getBoundingClientRect();
    if (r.height < 1) return 'el botón de scrimmage no se ve';
    if (!/scrimmage/i.test(b.textContent || '')) return 'el botón no dice scrimmage';
    return true;
  });
  si(listo === true, 'y ofrece el scrimmage de un toque' +
     (listo === true ? '' : ' — ' + listo));

  /* Y al final ofrece volver con el total. Se comprueba el camino,
     no se juega una partida entera: lo que importa es que el botón
     construya bien la URL de vuelta. */
  const vuelta = await pag.evaluate(() => {
    const s = document.documentElement.innerHTML;
    return s.indexOf("'demo.html?p='") !== -1 || s.indexOf('demo.html?p=') !== -1;
  });
  si(vuelta, 'y el final del juego vuelve a demo.html con el total');
  await pag.close();
}

// ── 7 · El reloj del cuarto ───────────────────────────────────────
console.log('\n7 · El cuarto dura lo que toca en cada sitio\n');
for (const [q, esperaba, qué] of [
    ['?demo=1', '1:00', 'en demostración'],
    ['', '1:00', 'en un scrimmage desde la portada'],
    /* Y lo que de verdad importa: que &demo=1 colado en un enlace
       oficial no acorte el cuarto de un nene que tiene padrinos
       detrás. Anotaría menos de lo que le toca y no se notaría
       hasta el reporte. */
    ['?c=11111111-1111-1111-1111-111111111111&p=22222222-2222-2222-2222-222222222222' +
     '&k=xxxx&official=1&demo=1', '5:00', 'con &demo=1 colado en un enlace oficial'],
    /* Y el otro camino para lo mismo: ?min= acortaba —o alargaba— el
       cuarto, y escribía justo sobre el número de la corrida oficial.
       &min=30 en un enlace de jugar daba cuartos de media hora en una
       corrida con padrinos detrás: más tiradas, sólo cuenta la mejor,
       y los puntos suben por el cuadrado. La tía del nene acabaría
       debiendo varias veces lo prometido y el reporte diría que anotó
       mucho. */
    ['?c=11111111-1111-1111-1111-111111111111&p=22222222-2222-2222-2222-222222222222' +
     '&k=xxxx&official=1&min=30', '5:00', 'con &min=30 colado en un enlace oficial'],
    ['?c=11111111-1111-1111-1111-111111111111&p=22222222-2222-2222-2222-222222222222' +
     '&k=xxxx&official=1&min=0.5', '5:00', 'y con &min=0.5, que acortaría'],
    /* Donde sí vale: el scrimmage y la demostración, que es donde
       hacía falta —una cola de nenes esperando el teléfono— y donde
       antes no hacía nada. */
    ['?min=0.5', '0:30', 'en un scrimmage, ?min= sí acorta'],
    ['?demo=1&min=0.5', '0:30', 'y en la demostración también']]) {
  const pag = await navegador.newPage({ viewport: { width: 390, height: 800 } });
  pag.on('pageerror', () => {});
  await pag.route('**/three.min.js', (ruta) =>
    ruta.fulfill({ path: '/opt/node-tools/vendor/three.min.js',
                   contentType: 'application/javascript' }));
  await pag.goto('file://' + path.join(AQUI, 'fortress-vr.html') + q);
  await pag.waitForTimeout(700);
  await pag.locator('#goAmistoso').click();
  await pag.waitForTimeout(600);

  /* Se lee el reloj en pantalla y no la constante: lo que importa es
     lo que ve el entrenador, y entre la constante y el reloj hay
     tres sitios donde el número se podía quedar en cinco. */
  const reloj = (await pag.locator('#reloj').textContent() || '').trim();
  if (reloj.indexOf(esperaba) === 0) ok(qué + ' el cuarto marca ' + reloj);
  else mal(qué + ' el reloj marca «' + reloj + '» y esperaba ' + esperaba);
  await pag.close();
}

/* ══════════════════════════════════════════════════════════════════
   8 · LAS CUATRO ZONAS VALEN LO MISMO

   Cada cuarto se juega en una zona distinta —Q1 el 2-1-2, Q2 el
   1-3-1, Q3 el 2-3, Q4 el 3-2— y dos de los cuatro renuevan la
   cadena en cada ronda en vez de alargarla.

   Lo que esta sección existe para impedir: que una zona sea más
   fácil que otra. Un padrino promete POR PUNTO, así que una zona
   más fácil es dinero de más por el mismo esfuerzo, y una más
   difícil es dinero de menos. No se nota jugando —parecen cuatro
   canchas bonitas— y no sale en ningún reporte.

   Son tres números que tienen que ser iguales en las cuatro, y se
   miden sobre la PÁGINA CORRIENDO, no sobre una copia de las tablas
   escrita aquí: lo que se mide es lo que se despliega.

   Y de paso, que la cancha de 5×5 pinte de verdad las cinco casillas
   que la zona declara, en cualquier pantalla. Eso no es hipotético:
   las casillas se podrían sacar de los ángulos viejos redondeando, y
   el 0,75 del 3-2 cae justo en la mitad entre dos columnas y redondea
   a un lado por la izquierda y al otro por la derecha. Por eso se
   declaran, y por eso se comprueba que lo declarado es lo pintado.
   ══════════════════════════════════════════════════════════════════ */
console.log('\n8 · Las cuatro zonas valen lo mismo\n');
{
  const pag = await navegador.newPage({ viewport: { width: 390, height: 800 } });
  pag.on('pageerror', (e) => mal('la página reventó: ' + e.message));

  /* El juego entero vive dentro de un (function(){…})(), así que desde
     fuera no se ve ni una variable — y está bien que sea así: una
     página que expone sus tripas es una página que se puede trastear
     desde la consola.

     Para medirlo se sirve una COPIA con una línea de más, pegada justo
     antes de que la función se cierre. Lo que se prueba sigue siendo
     el fichero que se despliega, byte por byte, menos ese asa; nada de
     esto se sube. Si alguien renombra el cierre, el reemplazo no pega
     y la prueba lo dice en vez de pasar por otro camino. */
  const ASA = '\nwindow.__zonas={ZONAS:ZONAS,celdas:celdas,bolas:bolas,colocarBolas:colocarBolas,' +
              'cadenaNueva:cadenaNueva,siguienteNivel:siguienteNivel,limpiarT:limpiarT,' +
              'elegirZona:elegirZona,ajustarCancha:ajustarCancha,' +
              'g:function(k){return eval(k)},s:function(k,v){eval(k+"=v")}};\n';
  const fuente = require('fs').readFileSync(path.join(AQUI, 'fortress-vr.html'), 'utf8');
  const CIERRE = '\n})();\n</script>';
  si(fuente.indexOf(CIERRE) > 0, 'el juego se cierra donde la prueba espera');
  await pag.route('**/fortress-vr.html', (ruta) =>
    ruta.fulfill({ contentType: 'text/html',
                   body: fuente.replace(CIERRE, ASA + CIERRE) }));

  await pag.goto('file://' + path.join(AQUI, 'fortress-vr.html'));
  await pag.waitForTimeout(700);
  await pag.locator('#goAmistoso').click();
  await pag.waitForTimeout(500);

  // ── Las tablas, leídas de la página ──────────────────────────────
  const zonas = await pag.evaluate(() => window.__zonas.ZONAS.map(z => ({
    nombre: z.nombre, nueva: !!z.nueva, pases: z.pases, entrada: z.entrada,
    centro: z.centro, rejilla: z.rejilla
  })));

  eq(zonas.map(z => z.nombre), ['2-1-2','1-3-1','2-3','3-2'],
     'son cuatro zonas, en orden de cuarto');
  eq(zonas.map(z => z.nueva), [false,true,false,true],
     'dos crecen y dos renuevan, alternando, y la de Q4 renueva');

  for (const z of zonas) {
    const d = [0,1,2,3,4].map(i => (z.pases[i] || []).length).sort();
    eq(d, [3,3,3,3,4], z.nombre + ' · ramificación ' + JSON.stringify(d));

    /* Simétrico, o la zona no es una zona: si el balón va de 0 a 2
       tiene que poder volver. */
    const asim = [];
    for (let a = 0; a < 5; a++) for (const b of z.pases[a])
      if (!(z.pases[b] || []).includes(a)) asim.push(a + '→' + b);
    si(asim.length === 0, z.nombre + ' · el mapa de pases es simétrico' +
       (asim.length ? ' — roto en ' + asim.join(', ') : ''));

    si(![0,1,2,3,4].some(a => z.pases[a].includes(a)),
       z.nombre + ' · nadie se pasa a sí mismo');

    const exc = [];
    for (let a = 0; a < 5; a++) for (let b = a+1; b < 5; b++)
      if (!z.pases[a].includes(b)) exc.push(a + '-' + b);
    si(exc.length === 2, z.nombre + ' · dos parejas excluidas (' + exc.join(', ') + ')');

    /* Dos entradas en las cuatro. Con una sola, el primer destello
       sería siempre el mismo y ese cuarto tendría un bit menos que
       recordar que los otros tres. */
    si(z.entrada.length === 2, z.nombre + ' · dos bolas de entrada (' + z.entrada.join(', ') + ')');

    /* La del medio ayuda a las cuatro Y está en la columna del medio
       de la rejilla, que es la que está siempre al frente y no hay que
       buscar. En el 2-3 es la del fondo y en el 3-2 la de arriba, pero
       en las cuatro cae en la columna 2. */
    si(z.pases[z.centro].length === 4 && z.rejilla[z.centro] % 5 === 2,
       z.nombre + ' · la del medio ayuda a las cuatro y está en la columna del medio');

    /* Las cinco casillas: distintas, dentro del tablero, y en orden de
       lectura — que es lo que hace que las teclas 1 a 5 coincidan con
       lo que se ve, en las cuatro zonas y no sólo en una. */
    const r = z.rejilla;
    si(r.length === 5 && new Set(r).size === 5 &&
       r.every((c) => Number.isInteger(c) && c >= 0 && c < 25),
       z.nombre + ' · cinco casillas distintas dentro del 5×5 (' + r.join(' ') + ')');
    si(r.every((c, k) => k === 0 || c > r[k-1]),
       z.nombre + ' · y van en orden de lectura, igual que las teclas 1 a 5');

    /* NINGUNA VIVA PEGADA A OTRA. En un teléfono, dos casillas
       contiguas son un dedo gordo y un punto perdido — y un punto
       perdido es dinero. Por eso las cuatro zonas se quedan en las
       filas 0, 2 y 4: así siempre hay una casilla vacía de por medio. */
    const pegadas = [];
    for (let a = 0; a < 5; a++) for (let b = a+1; b < 5; b++)
      if (Math.abs(Math.floor(r[a]/5) - Math.floor(r[b]/5)) <= 1 &&
          Math.abs(r[a]%5 - r[b]%5) <= 1) pegadas.push(r[a] + '/' + r[b]);
    si(pegadas.length === 0, z.nombre + ' · ninguna casilla viva toca a otra' +
       (pegadas.length ? ' — pegadas: ' + pegadas.join(', ') : ''));
  }

  /* ── LO DECLARADO ES LO PINTADO, EN CUALQUIER PANTALLA ───────────
     La tabla de arriba se lee de la página, pero una tabla buena con
     un bucle malo pinta otras casillas. Así que se mira la cancha de
     verdad: qué cinco llevan la clase 'viva' en cada zona.

     Y de paso lo que antes comprobaba el solape de las esferas: que
     la cancha quepa entera. En una rejilla dos casillas no se pueden
     montar —las pone el navegador— pero sí se puede salir del borde o
     meterse debajo del marcador, y eso pasó: estaba escrito a mano
     que el marcador medía 76 píxeles, y en un teléfono acostado y en
     un monitor la chapa del set caía encima del reloj. */
  for (const [etq, w, h] of [
      ['teléfono de pie',   390, 844],
      ['teléfono chico',    320, 568],
      ['tablet',            768,1024],
      ['monitor',          1440, 900]]) {
    await pag.setViewportSize({ width: w, height: h });
    await pag.waitForTimeout(320);
    const m = await pag.evaluate(() => {
      const H = window.__zonas, Z = H.ZONAS, malas = [];
      const zonaAntes = H.g('ZONA');
      for (let z = 0; z < Z.length; z++) {
        H.s('ZONA', z); H.colocarBolas();
        const vivas = [...document.querySelectorAll('#rej .celda')]
          .map((c, i) => c.classList.contains('viva') ? i : -1).filter((i) => i >= 0);
        if (vivas.join() !== Z[z].rejilla.join())
          malas.push(Z[z].nombre + ' pinta [' + vivas.join(' ') +
                     '] y declara [' + Z[z].rejilla.join(' ') + ']');
      }
      H.s('ZONA', zonaAntes); H.colocarBolas(); H.ajustarCancha();
      const r = document.getElementById('rej').getBoundingClientRect();
      const una = document.querySelector('#rej .celda').getBoundingClientRect();
      const hud = document.getElementById('hud').getBoundingClientRect();
      const pista = document.getElementById('pista').getBoundingClientRect();
      const chapa = document.getElementById('chapa').getBoundingClientRect();
      return { malas,
        cuadrada: Math.abs(r.width - r.height) <= 1,
        casilla: Math.round(una.width),
        dentro: r.left >= -1 && r.top >= -1 &&
                r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
        chapaDentro: chapa.top >= -1,
        /* La chapa del set va ENTERA por encima del marco y despegada
           de él: ni partida por la línea del marco —que es como estaba
           y en el teléfono se leía como un botón pegado al tablero— ni
           metida por debajo del reloj. */
        chapaArriba: chapa.bottom <= r.top + 1 ||
                     chapa.right <= r.left + 1,     // o al lado, si está acostado
        chapaBajoElHud: chapa.top >= hud.bottom - 1,
        chapaAlLado: getComputedStyle(document.getElementById('chapa')).bottom === 'auto',
        libreArriba: r.top >= hud.bottom,
        libreAbajo: r.bottom <= pista.top };
    });
    si(m.malas.length === 0, etq + ' — las cinco vivas son las declaradas, en las cuatro zonas' +
       (m.malas.length ? ' — ' + m.malas.join('; ') : ''));
    si(m.cuadrada && m.dentro && m.chapaDentro && m.libreArriba && m.libreAbajo,
       etq + ' — cuadrada, cabe entera y no pisa el marcador ni la pista (casilla de ' +
       m.casilla + 'px)' + (m.cuadrada ? '' : ' — NO es cuadrada') +
       (m.dentro ? '' : ' — se sale del borde') +
       (m.chapaDentro ? '' : ' — la chapa se sale por arriba') +
       (m.libreArriba ? '' : ' — pisa el marcador') +
       (m.libreAbajo ? '' : ' — pisa la pista'));
    si(m.chapaArriba && m.chapaBajoElHud && m.chapaDentro,
       etq + ' — la chapa del set va ' + (m.chapaAlLado ? 'al lado del' : 'encima del') +
       ' marco, despegada y sin tocar el reloj' +
       (m.chapaArriba ? '' : ' — se monta sobre el marco') +
       (m.chapaBajoElHud ? '' : ' — se mete debajo del marcador') +
       (m.chapaDentro ? '' : ' — se sale de la pantalla'));
    /* Una casilla de menos de 34px no se toca con el dedo. */
    si(m.casilla >= 34, etq + ' — la casilla se puede tocar (' + m.casilla + 'px)');
  }
  await pag.setViewportSize({ width: 390, height: 800 });
  await pag.waitForTimeout(320);

  /* ── ACOSTADO NO SE JUEGA, SE TAPA ───────────────────────────────
     Un teléfono tumbado dejaba la casilla en 33px y el dedo le daba a
     la de al lado — un punto perdido es dinero. No se puede trancar la
     orientación de verdad (el lock pide pantalla completa y en el
     Safari del iPhone no existe), así que encima va una pantalla que
     pide ponerlo de pie.

     Y tiene que distinguir un teléfono de una ventana de computadora
     bajita, que sí se juega: la regla pide pointer:coarse. Playwright
     emula el dedo con hasTouch, así que se prueban las dos. */
  for (const [etq, w, h, dedo, tapado] of [
      ['teléfono acostado', 844, 390, true,  true ],
      ['tablet acostada',  1024, 768, true,  false],
      ['ventana bajita',    900, 420, false, false]]) {
    const p2 = await navegador.newPage({ viewport: { width: w, height: h }, hasTouch: dedo });
    await p2.route('**/fortress-vr.html', (ruta) =>
      ruta.fulfill({ contentType: 'text/html', body: fuente }));
    await p2.goto('file://' + path.join(AQUI, 'fortress-vr.html'));
    await p2.waitForTimeout(400);
    const r = await p2.evaluate(() => {
      const e = document.getElementById('rotar');
      const b = e.getBoundingClientRect();
      return { visible: getComputedStyle(e).display !== 'none',
               cubre: b.width >= innerWidth - 1 && b.height >= innerHeight - 1,
               dice: (document.getElementById('rotarT').textContent || '').trim() };
    });
    if (tapado) {
      si(r.visible && r.cubre && r.dice.length > 0,
         etq + ' — se tapa entero y pide ponerlo de pie («' + r.dice + '»)');
    } else {
      si(!r.visible, etq + ' — se sigue jugando, sin pantalla de rotar');
    }
    await p2.close();
  }

  // ── Las cadenas: legales en las dos formas de crecer ─────────────
  const cad = await pag.evaluate(() => {
    const H = window.__zonas, Z = H.ZONAS;
    const out = { ilegales: [], noEntrada: [], largos: [], prefijo: { crece: 0, nueva: 0 } };
    const legal = (z, c) => {
      if (!Z[z].entrada.includes(c[0])) out.noEntrada.push(Z[z].nombre + ' ' + c.join(''));
      for (let k = 0; k+1 < c.length; k++)
        if (!Z[z].pases[c[k]].includes(c[k+1]))
          out.ilegales.push(Z[z].nombre + ' ' + c[k] + '→' + c[k+1]);
    };
    for (let z = 0; z < Z.length; z++) {
      H.s('ZONA', z);
      /* Doscientas cadenas por zona: con cinco sitios y tres salidas
         por sitio, una ilegal de vez en cuando no sale en diez. */
      for (let n = 1; n <= 12; n++) for (let t = 0; t < 200; t++) {
        const c = H.cadenaNueva(n);
        if (c.length !== n) out.largos.push(Z[z].nombre + ' pidió ' + n + ' y dio ' + c.length);
        legal(z, c);
      }
      /* Y la diferencia entre las dos formas, medida y no supuesta:
         creciendo, la ronda siguiente empieza por la cadena anterior
         entera. Renovando, casi nunca.

         Se mide subiendo hasta el nivel 5 y comparando la 6ª con la
         5ª, no la 2ª con la 1ª: una cadena de 1 es una bola de
         entrada, y hay dos, así que renovando coincidiría la mitad de
         las veces por puro azar. La primera versión de esto medía
         justo eso y daba 203 de 400 — un 50% que parecía un fallo del
         juego y era un fallo de la prueba. Con cinco de largo, la
         coincidencia es ½·(⅓)⁴ ≈ 0,6%. */
      for (let t = 0; t < 200; t++) {
        H.s('cadena', []); H.s('nivel', 0);
        for (let n = 0; n < 5; n++) { H.s('fase', 'turno'); H.siguienteNivel(); H.limpiarT() }
        const antes = H.g('cadena').slice();
        H.s('fase', 'turno'); H.siguienteNivel(); H.limpiarT();
        const ahora = H.g('cadena');
        if (antes.every((v, k) => ahora[k] === v)) out.prefijo[Z[z].nueva ? 'nueva' : 'crece']++;
        if (ahora.length !== H.g('nivel'))
          out.largos.push(Z[z].nombre + ' nivel ' + H.g('nivel') +
                          ' con cadena de ' + ahora.length);
      }
    }
    H.s('cadena', []); H.s('nivel', 0); H.s('voy', 0); H.s('fase', 'listo');
    H.s('ZONA', 0); H.colocarBolas();
    return out;
  });
  si(cad.ilegales.length === 0, 'toda cadena nueva es un camino de pases legales' +
     (cad.ilegales.length ? ' — ilegal: ' + cad.ilegales.slice(0,4).join(', ') : ''));
  si(cad.noEntrada.length === 0, 'y toda cadena empieza por una bola de entrada');
  si(cad.largos.length === 0, 'y el largo de la cadena es siempre el nivel' +
     (cad.largos.length ? ' — ' + cad.largos.slice(0,3).join('; ') : ''));
  /* 400 rondas en los dos cuartos que crecen: las 400 tienen que
     conservar la cadena anterior entera. En los que renuevan, con una
     cadena de cinco por delante la coincidencia es ~0,6%: por debajo
     del 5% es azar, por encima es que no está renovando. */
  eq(cad.prefijo.crece, 400, 'creciendo, la ronda siguiente conserva los cinco de antes');
  si(cad.prefijo.nueva < 20, 'renovando, no los conserva (coincidió ' +
     cad.prefijo.nueva + ' de 400 veces — azar puro)');

  // ── Y que el cuarto elija su zona, y se lea en pantalla ──────────
  const porCuarto = await pag.evaluate(() => {
    const H = window.__zonas;
    const antes = { a: H.g('AMISTOSO'), p: H.g('enPractica'),
                    c: H.g('cuartoActual'), z: H.g('ZONA') };
    const out = [];
    H.s('AMISTOSO', true); H.s('enPractica', false);
    for (let q = 1; q <= 4; q++) {
      H.s('cuartoActual', q); H.elegirZona(); out.push(H.ZONAS[H.g('ZONA')].nombre);
    }
    H.s('AMISTOSO', antes.a); H.s('enPractica', antes.p);
    H.s('cuartoActual', antes.c); H.s('ZONA', antes.z);
    return out;
  });
  eq(porCuarto, ['2-1-2','1-3-1','2-3','3-2'], 'cada cuarto se arma en su zona');

  /* ── UN COLOR POR SET, Y LAS SEÑALES IGUALES EN LOS CUATRO ───────
     Esto es lo que protege el color. Cada set pinta la cancha de otro
     color, y eso es sólo decorado: el marco, las vacías y el halo. Lo
     que NO puede cambiar de un set a otro es lo que significan los
     tres colores que valen puntos — encendida, buena y fallada. Si en
     el set 3 el "encendido" fuera verde, el nene que aprendió el color
     en el set 1 leería mal su propio juego, y lo que lee mal es plata.

     Se lee del estilo calculado y no del fichero, y con una espera por
     delante: el marco se funde en 0,45s y las casillas en 0,08s, y
     medido antes de tiempo lo que sale es el color de antes. Esa
     espera no es paranoia — midiendo sin ella, los cuatro sets daban
     violeta y parecía que el color no funcionaba. */
  const marcos = [], senales = [];
  for (let q = 1; q <= 4; q++) {
    await pag.evaluate((q) => {
      const H = window.__zonas;
      H.s('cuartoActual', q); H.s('enPractica', false); H.s('AMISTOSO', true);
      H.s('ZONA', q-1); H.colocarBolas();
    }, q);
    await pag.waitForTimeout(640);
    marcos.push(await pag.evaluate(() =>
      getComputedStyle(document.getElementById('rej')).borderTopColor));
    const tres = {};
    for (const clase of ['on','ok','mal']) {
      await pag.evaluate((clase) => {
        const H = window.__zonas, z = H.ZONAS[H.g('ZONA')];
        document.querySelectorAll('#rej .celda')[z.rejilla[0]].className = 'celda viva ' + clase;
      }, clase);
      await pag.waitForTimeout(170);
      tres[clase] = await pag.evaluate(() => {
        const H = window.__zonas, z = H.ZONAS[H.g('ZONA')];
        const s = getComputedStyle(document.querySelectorAll('#rej .celda')[z.rejilla[0]]);
        return s.backgroundColor + ' / ' + s.borderTopColor;
      });
    }
    senales.push(JSON.stringify(tres));
    await pag.evaluate(() => window.__zonas.colocarBolas());
  }
  si(new Set(marcos).size === 4,
     'los cuatro sets enmarcan la cancha de un color distinto (' + marcos.join('  ') + ')');
  si(new Set(senales).size === 1,
     'y las tres señales son idénticas en los cuatro: ' + (senales[0] || ''));

  /* El nombre de la zona vive en la chapa del marco y el modo de
     crecer en la pista. Antes iban los dos en la pista y en un
     teléfono de pie la línea partía en dos renglones. */
  await pag.evaluate(() => {
    const H = window.__zonas;
    H.s('cuartoActual', 1); H.s('ZONA', 0); H.colocarBolas();
  });
  const chapa = (await pag.locator('#chapa').textContent() || '');
  const pista = (await pag.locator('#pista').textContent() || '');
  si(/2-1-2/.test(chapa) && /\bSET\b/i.test(chapa),
     'la chapa del marco dice qué set y en qué zona («' + chapa.trim() + '»)');
  si(/(crece|grows)/.test(pista),
     'y la pista dice cómo crece la cadena («' + pista.trim() + '»)');
  /* Un minuto es un minuto, no «1 minutes». Sale en el scrimmage y en
     la demostración, que es la pantalla que más gente ve. */
  si(!/\b1 (minutes|minutos)\b/.test(pista), 'y dice «1 minute», no «1 minutes»');
  /* Y que la línea, ya larga con el nombre de la zona delante, no
     llegue al filo del cristal en un teléfono de pie. */
  const dentro = await pag.evaluate(() => {
    const r = document.getElementById('pista').getBoundingClientRect();
    const cs = getComputedStyle(document.getElementById('pista'));
    return { izq: parseFloat(cs.paddingLeft), der: parseFloat(cs.paddingRight),
             ancho: r.width, pantalla: innerWidth };
  });
  si(dentro.izq >= 12 && dentro.der >= 12,
     'y deja aire contra los bordes (' + dentro.izq + 'px / ' + dentro.der + 'px)');

  await pag.close();
}

/* ══════════════════════════════════════════════════════════════════
   9 · EL TABLERO DEL CASCO SIGUE EN PIE

   fortress-casco.html es la escena de tres dimensiones de siempre, y
   es el único sitio donde se juega con la cabeza: el giroscopio, la
   medida en tres pasos y el punto de mira que se llena. Eso no cabe en
   una rejilla plana, así que cuando el tablero de todos los días pasó
   al 5×5, esta página se quedó entera para los veintiún Pico.

   Entera y sin nadie mirándola, que es como se pudre el código. Así
   que las comprobaciones que protegían la escena se mudaron aquí con
   ella en vez de borrarse: la fila del casco y que ninguna bola se
   monte sobre otra. Lo que vale una cadena es lo mismo en las dos
   páginas —misma rotación, mismos puntos— y eso ya lo mide la sección
   8 sobre la rejilla; aquí se mide lo que sólo existe en la escena.
   ══════════════════════════════════════════════════════════════════ */
console.log('\n9 · El tablero del casco sigue en pie\n');
{
  const pag = await navegador.newPage({ viewport: { width: 390, height: 800 } });
  pag.on('pageerror', (e) => mal('la página del casco reventó: ' + e.message));
  await pag.route('**/three.min.js', (ruta) =>
    ruta.fulfill({ path: '/opt/node-tools/vendor/three.min.js',
                   contentType: 'application/javascript' }));

  const ASA = '\nwindow.__casco={ZONAS:ZONAS,balls:balls,colocarBolas:colocarBolas,' +
              'RADIO_GEO:RADIO_GEO,g:function(k){return eval(k)},s:function(k,v){eval(k+"=v")}};\n';
  const fuente = require('fs').readFileSync(path.join(AQUI, 'fortress-casco.html'), 'utf8');
  const CIERRE = '\n})();\n</script>';
  si(fuente.indexOf(CIERRE) > 0, 'el juego del casco se cierra donde la prueba espera');
  await pag.route('**/fortress-casco.html', (ruta) =>
    ruta.fulfill({ contentType: 'text/html',
                   body: fuente.replace(CIERRE, ASA + CIERRE) }));

  await pag.goto('file://' + path.join(AQUI, 'fortress-casco.html'));
  await pag.waitForTimeout(700);

  /* Su razón de existir: el botón del casco. Si un día desaparece, es
     que alguien dejó esta página sin lo único que no está en la otra. */
  si(await pag.locator('#goCabeza').count() === 1,
     'la página del casco ofrece el botón de jugar con la cabeza');
  si(/deviceorientation/.test(fuente) && /casco=1/.test(fuente),
     'y conserva el giroscopio y su enlace ?casco=1');

  await pag.locator('#go').click();
  await pag.waitForTimeout(600);

  const zc = await pag.evaluate(() => window.__casco.ZONAS.map((z) => ({
    nombre: z.nombre, pases: z.pases, fila: z.fila, centro: z.centro
  })));
  eq(zc.map((z) => z.nombre), ['2-1-2','1-3-1','2-3','3-2'],
     'las mismas cuatro zonas que en la rejilla, en el mismo orden');

  for (const z of zc) {
    /* La fila del casco: las cinco una vez, y cada salto un pase legal
       — así, en fila, el balón sigue yendo al de al lado y el nene que
       juega con el casco aprende la misma rotación. */
    si(z.fila.slice().sort().join() === '0,1,2,3,4',
       z.nombre + ' · la fila usa las cinco una vez (' + z.fila.join(' ') + ')');
    const saltos = [];
    for (let k = 0; k+1 < 5; k++)
      if (!z.pases[z.fila[k]].includes(z.fila[k+1])) saltos.push(z.fila[k]+'→'+z.fila[k+1]);
    si(saltos.length === 0, z.nombre + ' · y la fila es un camino de pases legales' +
       (saltos.length ? ' — ilegal: ' + saltos.join(', ') : ''));
  }

  // ── Que ninguna bola se monte sobre otra, con el código de verdad ─
  for (const [etq, w, h, cabeza] of [
      ['abanico · teléfono de pie',  390,  800, false],
      ['abanico · monitor',         1440,  900, false],
      ['fila · casco apaisado',     1600,  900, true],
      ['fila · teléfono de pie',     390,  800, true]]) {
    await pag.setViewportSize({ width: w, height: h });
    await pag.waitForTimeout(170);
    const pegadas = await pag.evaluate(({ cabeza }) => {
      const H = window.__casco, Z = H.ZONAS, B = H.balls;
      const modoAntes = H.g('MODO'), cabeceoAntes = H.g('hayCabeceo'), zonaAntes = H.g('ZONA');
      H.s('MODO', cabeza ? 'cabeza' : 'puntero');
      H.s('hayCabeceo', !cabeza);
      const malas = [];
      for (let z = 0; z < Z.length; z++) {
        H.s('ZONA', z); H.colocarBolas();
        /* El radio que de verdad tiene la bola pintada, no el que
           pedía la constante: colocarBolas lo recorta si no cabe. */
        const r = B[0].userData.base * H.RADIO_GEO;
        for (let a = 0; a < 5; a++) for (let b = a+1; b < 5; b++)
          if (B[a].position.distanceTo(B[b].position) < r*2)
            malas.push(Z[z].nombre + ' ' + a + '/' + b);
      }
      H.s('MODO', modoAntes); H.s('hayCabeceo', cabeceoAntes);
      H.s('ZONA', zonaAntes); H.colocarBolas();
      return malas;
    }, { cabeza });
    si(pegadas.length === 0, etq + ' — ninguna bola se monta en ninguna zona' +
       (pegadas.length ? ' — pegadas: ' + pegadas.join(', ') : ''));
  }

  await pag.close();
}

/* ══════════════════════════════════════════════════════════════════
   10 · DEL FINAL NO SE SALE SIN QUERER

   El nene acaba el cuarto set tocando casillas lo más rápido que
   puede. Suena la chicharra y la pantalla del total aparece debajo del
   dedo que ya venía bajando: ese toque caía en el primer botón que
   encontrara, y el primer botón empezaba otra tanda. El total —lo
   único que el nene y su padrino vinieron a ver— desaparecía sin que
   nadie lo hubiera leído. Pasó jugando de verdad, no en teoría.

   Tres puertas había, y dos se abrían solas:
     · «Practicar», justo debajo del número. Con los cuatro sets ya
       guardados no cambia ni un punto: era sólo una forma de borrar
       el total de la pantalla.
     · el botón de al lado, que empieza otro scrimmage.
     · Enter o espacio, que llamaban a armarSesion() por su cuenta y
       arrancaban una tanda sin pasar por ningún botón.

   Ahora la pantalla nace sellada segundo y medio. Y el sello se dice
   en los dos sitios —CSS y manejador— porque pointer-events:none
   sujeta un dedo pero no un clic que venga de una tecla o de un lector
   de pantalla.
   ══════════════════════════════════════════════════════════════════ */
console.log('\n10 · Del final no se sale sin querer\n');
{
  const pag = await navegador.newPage({ viewport: { width: 390, height: 844 } });
  pag.on('pageerror', (e) => mal('la página reventó: ' + e.message));
  const ASA = '\nwindow.__fin={cerrarCuarto:cerrarCuarto,finDeJuego:finDeJuego,' +
              'totalJuego:totalJuego,g:function(k){return eval(k)},s:function(k,v){eval(k+"=v")}};\n';
  const fuente = require('fs').readFileSync(path.join(AQUI, 'fortress-vr.html'), 'utf8');
  const CIERRE = '\n})();\n</script>';
  await pag.route('**/fortress-vr.html', (ruta) =>
    ruta.fulfill({ contentType: 'text/html', body: fuente.replace(CIERRE, ASA + CIERRE) }));
  await pag.goto('file://' + path.join(AQUI, 'fortress-vr.html'));
  await pag.waitForTimeout(300);
  await pag.locator('#goAmistoso').click();
  await pag.waitForTimeout(400);

  /* Cuatro sets cerrados con una cadena de 6 cada uno: 21 puntos por
     set, 84 en total — el orden de magnitud que sale jugando sets de
     un minuto de verdad. */
  for (let q = 1; q <= 4; q++) {
    await pag.evaluate((q) => {
      const H = window.__fin; H.s('cuartoActual', q); H.cerrarCuarto(q, 6, false);
    }, q);
    await pag.waitForTimeout(240);
    if (q < 4) { await pag.waitForTimeout(1500); await pag.locator('#otra').click();
                 await pag.waitForTimeout(240) }
  }

  const total = await pag.locator('#finN').textContent();
  eq(total, '84', 'cuatro sets de 21 puntos hacen 84 en la pantalla del total');
  si(await pag.locator('#practicar').isHidden(),
     'y «Practicar» no está: con el juego cerrado no cambia ni un punto');

  const sellado = await pag.evaluate(() => {
    const f = document.getElementById('fin');
    const b = [...f.querySelectorAll('button')].filter((x) => !x.hidden);
    return { clase: f.classList.contains('sellado'),
             muertos: b.every((x) => getComputedStyle(x).pointerEvents === 'none'),
             apagados: b.every((x) => parseFloat(getComputedStyle(x).opacity) < 0.6) };
  });
  si(sellado.clase && sellado.muertos && sellado.apagados,
     'la pantalla del total nace sellada: los botones no responden y se ven apagados');

  /* El toque de rebote, por las tres puertas a la vez — y el clic va
     con dispatchEvent a propósito: así entra por el manejador sin que
     el CSS lo pare, que es justo lo que hace un lector de pantalla. */
  await pag.evaluate(() => {
    document.getElementById('otra').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const p = document.getElementById('practicar');
    if (p) p.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await pag.keyboard.press('Enter');
  await pag.keyboard.press('Space');
  await pag.evaluate(() => {
    document.querySelectorAll('#rej .celda').forEach((c) =>
      c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  });
  await pag.waitForTimeout(200);

  const tras = await pag.evaluate(() => ({
    finALaVista: !document.getElementById('fin').hidden,
    total: document.getElementById('finN').textContent,
    fase: window.__fin.g('fase'),
    marcador: !document.getElementById('hud').hidden }));
  si(tras.finALaVista && tras.total === '84' && tras.fase === 'tiempo' && !tras.marcador,
     'y aguanta el toque de rebote: sigue el total, no empieza nada' +
     ' (fase ' + tras.fase + ', total ' + tras.total + ')');

  // Pasado el sello, el botón vuelve a servir: esto no es una trampa.
  await pag.waitForTimeout(1700);
  const abierto = await pag.evaluate(() => {
    const f = document.getElementById('fin');
    const b = document.getElementById('otra');
    return { sellado: f.classList.contains('sellado'),
             vivo: getComputedStyle(b).pointerEvents !== 'none',
             opaco: parseFloat(getComputedStyle(b).opacity) > 0.9 };
  });
  si(!abierto.sellado && abierto.vivo && abierto.opaco,
     'pasado el segundo y medio, el botón vuelve solo — no se queda trancado');

  /* En una corrida oficial no hay ni ese botón: terminado el juego, la
     pantalla del total es lo último que hay, y punto. */
  const oficial = await pag.evaluate(() => {
    const H = window.__fin;
    H.s('AMISTOSO', false); H.s('DEMO', false); H.s('JUEGO', true);
    H.finDeJuego();
    return [...document.querySelectorAll('#fin button')].filter((b) => !b.hidden)
      .map((b) => b.textContent);
  });
  eq(oficial, [], 'y en una corrida oficial el final no tiene ni un botón que tocar');

  await pag.close();
}

/* Y que la rejilla mande a quien llegue con un enlace viejo del casco:
   si el redirect se cae, ?casco=1 abre la rejilla y el que lleva el
   Pico puesto se queda mirando un tablero que no puede tocar. */
{
  const rejilla = require('fs').readFileSync(path.join(AQUI, 'fortress-vr.html'), 'utf8');
  si(/fortress-casco\.html/.test(rejilla) && /casco/.test(rejilla),
     'y la rejilla manda los enlaces ?casco=1 a fortress-casco.html');
}

await navegador.close();
console.log('\n' + (fallos === 0
  ? '✓ la cuenta cuadra, el viaje cierra, las cuatro zonas valen lo mismo\n' +
    '  y el tablero del casco sigue en pie'
  : '✗ ' + fallos + ' fallo(s)'));
process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('\n✗ la prueba reventó:', e); process.exit(1) });
