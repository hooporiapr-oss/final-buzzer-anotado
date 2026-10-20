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

await navegador.close();
console.log('\n' + (fallos === 0
  ? '✓ la cuenta cuadra, el viaje cierra y no deja rastro'
  : '✗ ' + fallos + ' fallo(s)'));
process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('\n✗ la prueba reventó:', e); process.exit(1) });
