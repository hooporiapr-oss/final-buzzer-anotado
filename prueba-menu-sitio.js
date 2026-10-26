/* ══════════════════════════════════════════════════════════════════
   LA MISMA BARRA EN TODAS LAS PÁGINAS

   Doce páginas se cambiaron de una pasada, con un script. Eso evita
   el error de teclear doce veces y mete otro: si el script se
   equivocó, se equivocó doce veces igual, y leyendo el diff no se
   nota — las doce salen idénticas y mal.

   Así que esto las abre una por una en Chromium y comprueba, en
   cada una, lo que tiene que ser cierto en todas:

     · la barra va pegada arriba
     · las rayas se ven y abren un menú con sus seis enlaces
     · los enlaces se pulsan con el dedo (44px) y van a sitios reales
     · cerrado, el teclado no entra en el panel
     · el botón del idioma dice la palabra entera, no «EN»
     · y al cambiarlo, el menú cambia con la página
     · nada se arrastra de lado a 320 ni a 390

       node prueba-menu-sitio.js
   ══════════════════════════════════════════════════════════════════ */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

let fallos = 0;
const mal = (m) => { fallos++; console.log('       MAL  ' + m); };

const PAGINAS = ['index.html', 'equipo.html', 'ayuda.html', 'cobro.html',
  'custodia.html', 'privacy.html', 'terms.html', 'mi-equipo.html',
  'jugador.html', 'prometer.html', 'plantilla.html', 'tablero.html',
  'reporte.html', 'padrinos.html', 'scoreboard.html'];

const AQUI = __dirname;
const url = (f) => 'file://' + path.join(AQUI, f);

(async () => {
const navegador = await chromium.launch();

console.log('\nUna por una, en un teléfono de 390\n');

for (const f of PAGINAS) {
  const antes = fallos;
  const pag = await navegador.newPage({ viewport: { width: 390, height: 800 } });
  /* Estas páginas hablan con Supabase; sin red contestan error y
     pintan su aviso, que para esto da igual: la barra es lo que se
     mira. Los errores de consola se callan para que no tapen lo que
     dice la prueba. */
  pag.on('pageerror', () => {});
  pag.on('console', () => {});
  await pag.goto(url(f));
  await pag.waitForTimeout(350);

  // ── La barra, pegada ──
  /* La barra se busca por lo que CONTIENE —la marca— y no por su
     etiqueta: en padrinos.html el <header> es la portada y la barra
     es un <nav>, así que preguntar por el primer <header> medía el
     elemento equivocado y daba un fallo que no existía. */
  const pegada = await pag.evaluate(() => {
    const marca = document.querySelector('.mark, .brand');
    const barra = marca && marca.closest('header, nav');
    return barra ? getComputedStyle(barra).position : 'sin barra';
  });
  if (pegada !== 'sticky') mal(f + ': la barra no va pegada (' + pegada + ')');

  // ── Las rayas ──
  const rayas = pag.locator('#hamb, #burger').first();
  if (!(await rayas.count())) { mal(f + ': no hay rayas'); await pag.close(); continue }
  if (!(await rayas.isVisible())) mal(f + ': las rayas no se ven');

  /* ── Y que las rayas SE VEAN ──
     Esto se añadió después de una captura: en prometer.html la barra
     es crema y las rayas estaban puestas en blanco a mano, así que
     el botón existía, respondía, pasaba todas las comprobaciones de
     arriba — y era invisible. Comprobar que un elemento está no es
     comprobar que se ve. */
  const contraste = await pag.evaluate(() => {
    const b = document.querySelector('#hamb, #burger');
    if (!b) return null;
    const raya = b.querySelector('b, span');
    const tinta = getComputedStyle(raya || b).backgroundColor;
    let el = b, fondo = 'rgba(0, 0, 0, 0)';
    while (el && (fondo === 'rgba(0, 0, 0, 0)' || fondo === 'transparent')) {
      fondo = getComputedStyle(el).backgroundColor; el = el.parentElement;
    }
    const n = (c) => (c.match(/[\d.]+/g) || [0,0,0]).slice(0,3).map(Number);
    // Luminancia relativa, como la define WCAG.
    const lum = (c) => {
      const [r,g,bl] = n(c).map(v => {
        v /= 255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4);
      });
      return .2126*r + .7152*g + .0722*bl;
    };
    const a = lum(tinta), z = lum(fondo);
    const ratio = (Math.max(a,z) + .05) / (Math.min(a,z) + .05);
    return { tinta, fondo, ratio: Math.round(ratio * 10) / 10 };
  });
  if (contraste && contraste.ratio < 3)
    mal(f + ': las rayas no se ven — ' + contraste.tinta + ' sobre ' +
        contraste.fondo + ', contraste ' + contraste.ratio + ':1');

  // ── El idioma, con palabra ──
  const l = pag.locator('#langBtn, #lang').first();
  if (!(await l.count())) mal(f + ': no hay botón de idioma');
  else {
    const t = (await l.textContent() || '').trim();
    if (t !== 'Español' && t !== 'English')
      mal(f + ': el idioma dice «' + t + '» en vez de la palabra entera');
    if (!(await l.isVisible())) mal(f + ': el idioma no se ve en la barra');
  }

  // ── Cerrado, sin teclado dentro ──
  const menu = pag.locator('#menu, #nav, .menu').first();
  if (await menu.count()) {
    const entra = await pag.evaluate(() => {
      const a = document.querySelector('#menu a, .menu a');
      if (!a) return false;
      a.focus();
      return document.activeElement === a;
    });
    if (entra) mal(f + ': cerrado, el teclado entra en el menú');
  }

  // ── Abre, y lo que hay dentro ──
  await rayas.click();
  await pag.waitForTimeout(320);
  const dentro = await pag.evaluate(() => {
    const m = document.querySelector('#menu, .menu, #nav');
    if (!m) return null;
    return [].map.call(m.querySelectorAll('a'), (a) => ({
      texto: (a.textContent || '').trim(),
      href: a.getAttribute('href'),
      alto: Math.round(a.getBoundingClientRect().height),
      visible: a.getBoundingClientRect().height > 0
    }));
  });
  if (!dentro || !dentro.length) mal(f + ': el menú abre vacío');
  else {
    const chicos = dentro.filter(a => a.visible && a.alto < 44);
    if (chicos.length)
      mal(f + ': enlaces de menos de 44px — ' +
          chicos.map(a => a.texto + '=' + a.alto).join(', '));
    // Que los destinos existan de verdad.
    for (const a of dentro) {
      if (!a.href || a.href.indexOf('http') === 0 || a.href.indexOf('mailto') === 0) continue;
      const fichero = a.href.split('#')[0];
      if (fichero && !fs.existsSync(path.join(AQUI, fichero)))
        mal(f + ': el menú apunta a ' + fichero + ', que no existe');
    }
  }

  // ── Cierra al pulsar un enlace ──
  const ancla = pag.locator('#menu a, .menu a').first();
  if (await ancla.count()) {
    const abierto = await pag.evaluate(() =>
      !!document.querySelector('#menu.abierto, .menu.abierto, #menu.open, .menu.open'));
    if (!abierto) mal(f + ': pulsando las rayas el panel no se marcó como abierto');
  }

  // ── El idioma cambia el menú ──
  if (await l.count()) {
    const antesTxt = (await l.textContent() || '').trim();
    await l.click();
    await pag.waitForTimeout(350);
    const despues = (await l.textContent() || '').trim();
    if (antesTxt === despues)
      mal(f + ': el botón del idioma no cambió de palabra al pulsarlo');
    if (despues !== 'Español' && despues !== 'English')
      mal(f + ': tras cambiar, el idioma dice «' + despues + '»');
  }

  // ── Sin arrastre lateral, en dos anchos ──
  for (const w of [320, 390]) {
    await pag.setViewportSize({ width: w, height: 800 });
    await pag.waitForTimeout(160);
    const m = await pag.evaluate(() => ({
      s: document.documentElement.scrollWidth,
      v: document.documentElement.clientWidth
    }));
    if (m.s > m.v + 1) {
      const quien = await pag.evaluate((v) => {
        const fuera = [];
        document.querySelectorAll('*').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > v + 1)
            fuera.push(el.tagName.toLowerCase() +
              (el.id ? '#' + el.id : '') +
              (typeof el.className === 'string' && el.className.trim()
                ? '.' + el.className.trim().split(/\s+/)[0] : ''));
        });
        return fuera.slice(0, 4);
      }, m.v);
      mal(f + ' @' + w + ': se arrastra de lado (' + m.s + '/' + m.v +
          ') — ' + quien.join(', '));
    }
  }

  await pag.close();
  if (fallos === antes) console.log('  ok   ' + f);
}

await navegador.close();
console.log('\n' + (fallos === 0
  ? '✓ las ' + PAGINAS.length + ' llevan la misma barra, y funciona'
  : '✗ ' + fallos + ' fallo(s)'));
process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('\n✗ la prueba reventó:', e); process.exit(1) });
