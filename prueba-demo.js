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

// ── 7 · La corrida, de la portada al total ────────────────────────
console.log('\n7 · La corrida va de la portada al total, pasando por cuatro juegos\n');
{
  const SETS = ['002-recall.html','003-recognition.html','004-replay.html','001-fortress.html'];
  const pag = await navegador.newPage({ viewport: { width: 390, height: 844 } });
  pag.on('pageerror', (e) => mal('la página reventó: ' + e.message));
  const visitado = [];
  pag.on('framenavigated', (f) => {
    if (f === pag.mainFrame()) visitado.push(f.url().split('/').pop().split('?')[0]);
  });

  await pag.goto('file://' + path.join(AQUI, 'fortress-vr.html'));
  await pag.waitForTimeout(400);
  await pag.locator('#goAmistoso').click();
  await pag.waitForTimeout(900);

  /* LA CORRIDA SE ESCRIBE ANTES DE SALIR DE LA PORTADA. Esto es lo
     único que hace que cuatro páginas sean un solo juego: si no está
     escrita al momento de navegar, el set 1 se juega sin dueño. */
  const arranque = await pag.evaluate(() => {
    let c = null; try { c = JSON.parse(sessionStorage.getItem('cp-corrida')) } catch (e) {}
    return { donde: location.pathname.split('/').pop(), corrida: c };
  });
  si(arranque.donde === '002-recall.html', 'la portada manda al primer set');
  si(arranque.corrida && arranque.corrida.tipo === 'amistoso' && arranque.corrida.q === 1,
     'y la corrida ya está escrita antes de salir de ella');
  si(arranque.corrida && arranque.corrida.ms === 60000,
     'un set amistoso dura un minuto');

  /* Se acorta el set para poder recorrer los cuatro sin esperar
     cuatro minutos. Se toca el reloj de la corrida, que es
     exactamente lo que ?min= toca en una amistosa. */
  await pag.evaluate(() => {
    const c = JSON.parse(sessionStorage.getItem('cp-corrida'));
    c.ms = 2500; sessionStorage.setItem('cp-corrida', JSON.stringify(c));
  });
  await pag.reload();
  await pag.waitForTimeout(600);

  const cierres = [];
  for (let n = 1; n <= 4; n++) {
    let cerro = false;
    for (let i = 0; i < 160; i++) {
      let f = null;
      try {
        f = await pag.evaluate(() => ({
          fin: !!document.getElementById('fin') && !document.getElementById('fin').hidden,
          k: (document.getElementById('finK') || {}).textContent,
          n: (document.getElementById('finN') || {}).textContent,
          btn: document.getElementById('otra') && !document.getElementById('otra').hidden
               ? document.getElementById('otra').textContent : null
        }));
      } catch (e) { /* navegando entre set y portada */ }
      if (f && f.fin && f.btn) {
        cierres.push({ set: n, titulo: f.k, puntos: f.n });
        /* Del cuarto set no se sigue: ahí ya es la pantalla del total
           y el botón ofrece OTRO scrimmage. Tocarlo empezaría una
           corrida nueva y borraría justo lo que hay que mirar. */
        if (n < 4) {
          await pag.waitForTimeout(1700);        // el sello
          await pag.locator('#otra').click();
          await pag.waitForTimeout(900);
        }
        cerro = true; break;
      }
      await pag.waitForTimeout(200);
    }
    if (!cerro) { mal('el set ' + n + ' no cerró'); break }
  }
  si(cierres.length === 4, 'los cuatro sets cierran, uno por uno');

  /* El orden importa y no es decorativo: el cuarto que guarda cada
     página está clavado en ella (CORRIDA.QESTE), así que una página
     fuera de sitio guardaría el cuarto de otra. */
  /* Se quitan las repeticiones seguidas: una recarga de la misma
     página no es otro set, y lo que se mide es el ORDEN. */
  const jugados = visitado.filter((v) => SETS.indexOf(v) !== -1)
                          .filter((v, i, a) => v !== a[i - 1]);
  eq(jugados, SETS, 'y se juegan en el orden del scrimmage');

  /* Y entre set y set se pasa por la portada, que es donde vive el
     guardado, la caja de cuartos y el botón del siguiente. */
  si(visitado.filter((v) => v === 'fortress-vr.html').length >= 4,
     'volviendo a la portada entre set y set');

  const final = await pag.evaluate(() => ({
    k: (document.getElementById('finK') || {}).textContent,
    total: (document.getElementById('finN') || {}).textContent,
    corrida: (() => { try { return JSON.parse(sessionStorage.getItem('cp-corrida')) } catch (e) { return null } })()
  }));
  si(/SCRIMMAGE|JUEGO/i.test(final.k || ''), 'y el cuarto set termina en el total del juego');
  si(final.corrida && final.corrida.cuartos && final.corrida.cuartos.length === 4,
     'con los cuatro cuartos guardados en la corrida');
  await pag.close();
}

// ── 8 · La corrida oficial ────────────────────────────────────────
console.log('\n8 · La corrida oficial no pierde un cuarto\n');
{
  const pag = await navegador.newPage({ viewport: { width: 390, height: 844 } });
  pag.on('pageerror', (e) => mal('la página reventó: ' + e.message));

  /* El servidor se corta a propósito: lo que se mide aquí no es que
     guarde, es qué hace cuando NO puede. */
  const intentos = [];
  await pag.route('**/rest/v1/**', (r) => {
    intentos.push(r.request().url().split('/').pop());
    r.abort();
  });

  await pag.goto('file://' + path.join(AQUI,
    'fortress-vr.html') + '?c=RETO1&p=JUG1&k=LLAVE1&official=1');
  await pag.waitForTimeout(500);
  await pag.locator('#goAmistoso').click();
  await pag.waitForTimeout(900);

  const oficial = await pag.evaluate(() => {
    let c = null; try { c = JSON.parse(sessionStorage.getItem('cp-corrida')) } catch (e) {}
    return c;
  });
  si(oficial && oficial.tipo === 'oficial', 'una corrida oficial se marca como oficial');
  si(oficial && oficial.ms === 5 * 60 * 1000, 'y su set dura cinco minutos, no uno');
  si(oficial && oficial.reto === 'RETO1' && oficial.jugador === 'JUG1' && oficial.llave === 'LLAVE1',
     'y la identidad viaja con ella de página en página');

  await pag.evaluate(() => {
    const c = JSON.parse(sessionStorage.getItem('cp-corrida'));
    c.ms = 2500; sessionStorage.setItem('cp-corrida', JSON.stringify(c));
  });
  await pag.reload();

  /* Se mira mientras la página puede estar navegando — del set a la
     portada —, y una lectura justo en ese salto revienta sola. No es
     un fallo de la página: es haber preguntado a mitad de un paso.
     Se ignora esa lectura y se vuelve a preguntar. */
  let parada = null;
  for (let i = 0; i < 160; i++) {
    let t = null;
    try {
      t = await pag.evaluate(() => ({
        fin: !!document.getElementById('fin') && !document.getElementById('fin').hidden,
        p: (document.getElementById('finP') || {}).textContent,
        btn: document.getElementById('otra') && !document.getElementById('otra').hidden
             ? document.getElementById('otra').textContent : null
      }));
    } catch (e) { /* navegando */ }
    if (t && t.fin && t.btn) { parada = t; break }
    await pag.waitForTimeout(200);
  }

  si(intentos.length > 0, 'un cuarto oficial se manda a guardar en cuanto se cierra');
  si(!!parada, 'y la pantalla entre sets aparece');
  /* LO IMPORTANTE: con el guardado caído NO se sigue. El cuarto se
     jugó; si la corrida avanzara, ese cuarto quedaría jugado y sin
     guardar, y eso en una corrida oficial es plata del padrino. */
  si(parada && !/set\s*2|cuarto\s*2/i.test(parada.btn || ''),
     'y con el guardado caído no ofrece el set siguiente');
  si(parada && /again|reintent/i.test(parada.btn || ''),
     'sino volver a mandarlo');
  await pag.close();
}

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
  /* LA PANTALLA DEL TOTAL SE LLEGA CON LA CORRIDA HECHA, no jugando
     cuatro sets de verdad. Se siembra una corrida con sus cuatro
     cuartos ya guardados y se entra por ?entre=1, que es por donde
     entra el set 4 cuando termina. Mide lo mismo y no tarda cuatro
     minutos. */
  const SEMBRADA = {
    tipo: 'amistoso', ms: 60000, q: 5, lang: 'en', demo: false,
    cuartos: [{ q: 1, puntos: 21 }, { q: 2, puntos: 21 },
              { q: 3, puntos: 21 }, { q: 4, puntos: 21 }]
  };

  const pag = await navegador.newPage({ viewport: { width: 390, height: 844 } });
  pag.on('pageerror', (e) => mal('la página reventó: ' + e.message));
  await pag.addInitScript((c) => {
    try { sessionStorage.setItem('cp-corrida', JSON.stringify(c)) } catch (e) {}
  }, SEMBRADA);
  await pag.goto('file://' + path.join(AQUI, 'fortress-vr.html') + '?entre=1');
  await pag.waitForTimeout(700);

  const total = await pag.locator('#finN').textContent();
  si(total === '84', 'cuatro sets de 21 puntos hacen 84 en la pantalla del total');

  const practicar = await pag.evaluate(() =>
    document.getElementById('practicar').hidden);
  si(practicar, 'y «Practicar» no está: con el juego cerrado no cambia ni un punto');

  /* NACE SELLADA. El toque que venía persiguiendo una casilla no
     puede caer encima del botón y empezar otro scrimmage encima del
     número que el nene y su padrino vinieron a ver. */
  const sellada = await pag.evaluate(() => {
    const f = document.getElementById('fin');
    return f.classList.contains('sellado');
  });
  si(sellada, 'la pantalla del total nace sellada');

  const antes = await pag.locator('#finN').textContent();
  await pag.evaluate(() => {
    const o = document.getElementById('otra');
    if (o) o.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await pag.waitForTimeout(250);
  const despues = await pag.evaluate(() => ({
    total: document.getElementById('finN').textContent,
    donde: location.search
  }));
  si(despues.total === antes && despues.donde.indexOf('entre') !== -1,
     'y aguanta el toque de rebote: sigue el total, no empieza nada');

  await pag.waitForTimeout(1700);
  const libre = await pag.evaluate(() =>
    !document.getElementById('fin').classList.contains('sellado'));
  si(libre, 'pasado el segundo y medio el botón vuelve solo — no se queda trancado');
  await pag.close();
}

/* Y EN UNA CORRIDA OFICIAL EL FINAL NO TIENE NI UN BOTÓN. Se juega
   una vez: ofrecer «otro scrimmage» ahí sería ofrecer repetir algo
   que no se repite. */
{
  const SEMBRADA = {
    tipo: 'oficial', ms: 5 * 60 * 1000, q: 5, lang: 'en', demo: false,
    reto: 'RETO1', jugador: 'JUG1', llave: 'LLAVE1',
    cuartos: [{ q: 1, puntos: 21 }, { q: 2, puntos: 21 },
              { q: 3, puntos: 21 }, { q: 4, puntos: 21 }]
  };
  const pag = await navegador.newPage({ viewport: { width: 390, height: 844 } });
  pag.on('pageerror', (e) => mal('la página reventó: ' + e.message));
  await pag.route('**/rest/v1/**', (r) => r.abort());
  await pag.addInitScript((c) => {
    try { sessionStorage.setItem('cp-corrida', JSON.stringify(c)) } catch (e) {}
  }, SEMBRADA);
  await pag.goto('file://' + path.join(AQUI, 'fortress-vr.html') +
                 '?entre=1&c=RETO1&p=JUG1&k=LLAVE1&official=1');
  await pag.waitForTimeout(900);
  const botones = await pag.evaluate(() =>
    ['otra', 'practicar'].filter((id) => {
      const e = document.getElementById(id);
      return e && !e.hidden;
    }));
  eq(botones, [], 'y en una corrida oficial el final no tiene ni un botón que tocar');
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
  ? '✓ la cuenta cuadra, la corrida llega al total sin perder un cuarto\n' +
    '  y el tablero del casco sigue en pie'
  : '✗ ' + fallos + ' fallo(s)'));
process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('\n✗ la prueba reventó:', e); process.exit(1) });
