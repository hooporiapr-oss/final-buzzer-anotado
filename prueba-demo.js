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

   Y de paso, que ninguna bola se monte sobre otra. Eso no era
   hipotético: la fila del casco —las cinco en línea, para el visor
   que sólo publica el giro— se solapaba en un teléfono de pie ya
   antes de que hubiera cuatro zonas, y no se veía porque la fila
   sólo sale con el casco puesto y el casco va apaisado.
   ══════════════════════════════════════════════════════════════════ */
console.log('\n8 · Las cuatro zonas valen lo mismo\n');
{
  const pag = await navegador.newPage({ viewport: { width: 390, height: 800 } });
  pag.on('pageerror', (e) => mal('la página reventó: ' + e.message));
  await pag.route('**/three.min.js', (ruta) =>
    ruta.fulfill({ path: '/opt/node-tools/vendor/three.min.js',
                   contentType: 'application/javascript' }));

  /* El juego entero vive dentro de un (function(){…})(), así que desde
     fuera no se ve ni una variable — y está bien que sea así: una
     página que expone sus tripas es una página que se puede trastear
     desde la consola.

     Para medirlo se sirve una COPIA con una línea de más, pegada justo
     antes de que la función se cierre. Lo que se prueba sigue siendo
     el fichero que se despliega, byte por byte, menos ese asa; nada de
     esto se sube. Si alguien renombra el cierre, el reemplazo no pega
     y la prueba lo dice en vez de pasar por otro camino. */
  const ASA = '\nwindow.__zonas={ZONAS:ZONAS,balls:balls,colocarBolas:colocarBolas,' +
              'cadenaNueva:cadenaNueva,siguienteNivel:siguienteNivel,limpiarT:limpiarT,' +
              'elegirZona:elegirZona,RADIO_GEO:RADIO_GEO,aro:function(){return aroPiezas[0]},' +
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
    centro: z.centro, fila: z.fila, abanico: z.abanico
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

    si(z.pases[z.centro].length === 4 && z.abanico[z.centro][0] === 0,
       z.nombre + ' · la del medio ayuda a las cuatro y está en x=0');

    /* La fila del casco: las cinco una vez, y cada salto un pase
       legal — así, en fila, el balón sigue yendo al de al lado. */
    si(z.fila.slice().sort().join() === '0,1,2,3,4',
       z.nombre + ' · la fila usa las cinco una vez (' + z.fila.join(' ') + ')');
    const saltos = [];
    for (let k = 0; k+1 < 5; k++)
      if (!z.pases[z.fila[k]].includes(z.fila[k+1])) saltos.push(z.fila[k]+'→'+z.fila[k+1]);
    si(saltos.length === 0, z.nombre + ' · y la fila es un camino de pases legales' +
       (saltos.length ? ' — ilegal: ' + saltos.join(', ') : ''));
  }

  // ── Que ninguna bola se monte, con el código de verdad ───────────
  for (const [etq, w, h, cabeza] of [
      ['abanico · teléfono de pie',  390,  800, false],
      ['abanico · monitor',         1440,  900, false],
      ['fila · casco apaisado',     1600,  900, true],
      ['fila · teléfono de pie',     390,  800, true]]) {
    await pag.setViewportSize({ width: w, height: h });
    await pag.waitForTimeout(150);
    const pegadas = await pag.evaluate(({ cabeza }) => {
      const H = window.__zonas, Z = H.ZONAS, B = H.balls;
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
  await pag.setViewportSize({ width: 390, height: 800 });
  await pag.waitForTimeout(200);

  /* ── Y que ninguna bola tape el aro ───────────────────────────────
     El 1-3-1 y el 3-2 tienen una bola arriba del todo en x=0, justo
     donde estaba el aro, y se lo comían. Si algún día alguien añade
     una zona con una bola ahí arriba, esto lo dice antes de que se
     vea en la cancha. Sólo de pie: apaisado el aro vive detrás de la
     pastilla del HUD y ahí no hay sitio para nadie. */
  const tapan = await pag.evaluate(() => {
    const H = window.__zonas, B = H.balls, malas = [];
    const ojo = new (H.aro().position.constructor)(0, 1.55, 0);
    const ang = (p) => {           // elevación vista desde el ojo
      const dx = p.x - ojo.x, dy = p.y - ojo.y, dz = p.z - ojo.z;
      return Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI;
    };
    const lado = (p) => Math.atan2(p.x - ojo.x, -(p.z - ojo.z)) * 180 / Math.PI;
    const zonaAntes = H.g('ZONA');
    for (let z = 0; z < H.ZONAS.length; z++) {
      H.s('ZONA', z); H.colocarBolas();
      const a = H.aro(), ra = a.geometry.parameters.radius;
      const dAro = a.position.distanceTo(ojo);
      const radioAro = Math.atan(ra / dAro) * 180 / Math.PI;
      const aAlto = ang(a.position), aLado = lado(a.position);
      for (let i = 0; i < 5; i++) {
        const rb = B[i].userData.base * H.RADIO_GEO;
        const radioBola = Math.atan(rb / B[i].position.distanceTo(ojo)) * 180 / Math.PI;
        const sep = Math.hypot(ang(B[i].position) - aAlto, lado(B[i].position) - aLado);
        if (sep < radioAro + radioBola)
          malas.push(H.ZONAS[z].nombre + ' bola ' + i + ' a ' + sep.toFixed(1) + '°');
      }
    }
    H.s('ZONA', zonaAntes); H.colocarBolas();
    return malas;
  });
  si(tapan.length === 0, 'de pie, ninguna bola tapa el aro en ninguna zona' +
     (tapan.length ? ' — tapan: ' + tapan.join(', ') : ''));

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

  const pista = (await pag.locator('#pista').textContent() || '');
  si(/2-1-2/.test(pista) && /(crece|grows)/.test(pista),
     'y la pantalla dice en qué zona estás y cómo crece («' + pista.trim() + '»)');
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

await navegador.close();
console.log('\n' + (fallos === 0
  ? '✓ la cuenta cuadra, el viaje cierra, las cuatro zonas valen lo mismo'
  : '✗ ' + fallos + ' fallo(s)'));
process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('\n✗ la prueba reventó:', e); process.exit(1) });