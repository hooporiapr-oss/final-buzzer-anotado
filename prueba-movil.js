/* ══════════════════════════════════════════════════════════════════
   QUE QUEPA EN UN TELÉFONO

   Lo que había antes en la portada era una barra que se iba
   encogiendo: a 750px los enlaces bajaban a .8rem y a 430px «Cómo
   funciona» desaparecía con un display:none. El enlace seguía ahí,
   sin forma de llegar a él, y nadie lo iba a echar de menos porque
   nadie sabía que faltaba.

   Esto comprueba en un navegador de verdad —Chromium, no una
   expresión regular— las cuatro cosas que no se pueden dar por
   buenas leyendo CSS:

     1 · que no haya arrastre lateral en 320, 375, 430 y 768
     2 · que el menú abra, cierre por los cuatro caminos, y que
         cerrado no lo alcance el teclado
     3 · que el botón del idioma diga el idioma AL QUE lleva
     4 · que un #ancla no acabe debajo de la cabecera pegada

   Hace falta Chromium; en este taller está en /opt/pw-browsers.

       node prueba-movil.js
   ══════════════════════════════════════════════════════════════════ */
'use strict';
const path = require('path');
const { chromium } = require('playwright');

let fallos = 0;
const ok  = (m) => console.log('  ok   ' + m);
const mal = (m) => { fallos++; console.log('  MAL  ' + m); };
const eq  = (a, b, m) => (JSON.stringify(a) === JSON.stringify(b) ? ok(m)
  : mal(m + '\n         esperaba: ' + JSON.stringify(b) +
            '\n         vino:     ' + JSON.stringify(a)));
const si  = (v, m) => (v ? ok(m) : mal(m));

const PAGINA = 'file://' + path.join(__dirname, 'index.html');
const ANCHOS = [320, 375, 430, 768];

(async () => {
const navegador = await chromium.launch();

// ── 1 · Nada se sale de lado ──────────────────────────────────────
console.log('\n1 · Nada se arrastra de lado\n');
for (const w of ANCHOS) {
  const pag = await navegador.newPage({ viewport: { width: w, height: 780 } });
  await pag.goto(PAGINA);
  await pag.waitForTimeout(120);

  const m = await pag.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    visto:  document.documentElement.clientWidth
  }));
  /* Un píxel de margen: un borde a medio píxel en una pantalla de
     densidad rara no es un fallo de maquetación. */
  si(m.scroll <= m.visto + 1,
     w + 'px — sin arrastre lateral (' + m.scroll + ' en ' + m.visto + ')');

  /* Y quién se sale, si alguien se sale. Saberlo por su nombre vale
     más que saber que la suma no cuadra. */
  if (m.scroll > m.visto + 1) {
    const culpables = await pag.evaluate((ancho) => {
      const fuera = [];
      document.querySelectorAll('*').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > ancho + 1) {
          fuera.push((el.tagName.toLowerCase()) +
            (el.id ? '#' + el.id : '') +
            (el.className && typeof el.className === 'string'
              ? '.' + el.className.trim().split(/\s+/).join('.') : '') +
            ' → ' + Math.round(r.right));
        }
      });
      return fuera.slice(0, 6);
    }, m.visto);
    console.log('         se salen: ' + culpables.join(' | '));
  }
  await pag.close();
}

// ── 2 · El menú ───────────────────────────────────────────────────
console.log('\n2 · El menú abre, cierra, y cerrado no estorba\n');
{
  const pag = await navegador.newPage({ viewport: { width: 375, height: 780 } });
  await pag.goto(PAGINA);
  await pag.waitForTimeout(120);

  const rayas = pag.locator('#hamb');
  const menu  = pag.locator('#menu');

  si(await rayas.isVisible(), 'las rayas se ven en un teléfono');

  /* Cerrado tiene que estar fuera del alcance del teclado. Con
     max-height:0 a secas los enlaces siguen siendo tabulables y el
     foco se va a un panel invisible — por eso lleva visibility.

     Se comprueba intentando enfocar de verdad, no mirando
     offsetParent: dentro de un visibility:hidden el enlace SIGUE
     teniendo offsetParent, porque visibility no lo saca de la
     maquetación. Eso dio un falso fallo la primera vez. */
  const alcanzable = await pag.evaluate(() => {
    const a = document.querySelector('#menu a');
    if (!a) return false;
    a.focus();
    return document.activeElement === a;
  });
  si(!alcanzable, 'cerrado, el foco del teclado no entra en los enlaces');
  eq(await pag.evaluate(() =>
       getComputedStyle(document.querySelector('#menu a')).visibility),
     'hidden', 'porque heredan visibility:hidden, no sólo max-height:0');
  eq(await rayas.getAttribute('aria-expanded'), 'false', 'y lo dice en aria-expanded');

  await rayas.click();
  await pag.waitForTimeout(300);
  eq(await rayas.getAttribute('aria-expanded'), 'true', 'al pulsar, abre');
  si(await menu.locator('a[href="#how"]').isVisible(),
     'y «Cómo funciona» está ahí — el enlace que antes se escondía');

  /* El panel no puede taparse con la cabecera ni salirse de lado. */
  const caja = await menu.boundingBox();
  const cab  = await pag.locator('header').boundingBox();
  si(caja && cab && caja.y >= cab.y + cab.height - 1,
     'el panel sale POR DEBAJO de la cabecera, no encima de la marca');
  si(caja && caja.x >= -1 && caja.x + caja.width <= 375 + 1,
     'y de borde a borde sin pasarse (' + Math.round(caja.width) + 'px)');

  /* Los dedos. 44px es la medida de Apple y la de Google es 48; por
     debajo de 44 se falla el enlace y se abre el de al lado. */
  const bajos = await pag.evaluate(() => {
    const malos = [];
    document.querySelectorAll('#menu a').forEach(a => {
      const h = a.getBoundingClientRect().height;
      if (h < 44) malos.push(a.textContent.trim() + ' = ' + Math.round(h));
    });
    return malos;
  });
  eq(bajos, [], 'todos los enlaces del menú miden 44px o más de alto');

  // Cerrar pulsando un enlace
  await menu.locator('a[href="#precio"]').click();
  await pag.waitForTimeout(300);
  eq(await rayas.getAttribute('aria-expanded'), 'false',
     'pulsar un enlace lo cierra — no se queda tapando la sección');

  // Cerrar con Escape
  await rayas.click(); await pag.waitForTimeout(250);
  await pag.keyboard.press('Escape'); await pag.waitForTimeout(250);
  eq(await rayas.getAttribute('aria-expanded'), 'false', 'Escape lo cierra');

  // Y al ensanchar hasta escritorio
  await rayas.click(); await pag.waitForTimeout(250);
  await pag.setViewportSize({ width: 1200, height: 780 });
  await pag.waitForTimeout(300);
  eq(await rayas.getAttribute('aria-expanded'), 'false',
     'y al ensanchar a escritorio se cierra solo');
  si(!(await rayas.isVisible()), 'las rayas desaparecen en escritorio');
  si(await menu.locator('a[href="#how"]').isVisible(),
     'y los enlaces vuelven a la barra');

  await pag.close();
}

// ── 3 · El idioma ─────────────────────────────────────────────────
console.log('\n3 · El botón dice el idioma al que lleva\n');
{
  /* Navegador en inglés: la página sale en inglés y el botón tiene
     que ofrecer español. */
  const ctx = await navegador.newContext({ locale: 'en-US',
                                           viewport: { width: 375, height: 780 } });
  const pag = await ctx.newPage();
  await pag.goto(PAGINA);
  await pag.waitForTimeout(150);

  eq(await pag.locator('#lang').textContent(), 'Español',
     'en inglés, el botón dice «Español»');
  eq(await pag.getAttribute('html', 'lang'), 'en', 'y el html está en en');
  si(await pag.locator('#lang').isVisible(),
     'el idioma se queda a la vista, no dentro del menú');

  await pag.locator('#lang').click();
  await pag.waitForTimeout(150);
  eq(await pag.locator('#lang').textContent(), 'English',
     'al pulsarlo, ahora dice «English»');
  eq(await pag.getAttribute('html', 'lang'), 'es', 'y la página se fue a español');
  si((await pag.locator('[data-i="navPrice"]').first().textContent()).indexOf('Cu') === 0,
     'los enlaces también («Cuánto cuesta»)');

  /* Y que se quede. Se guarda con las mismas llaves que el resto de
     la casa, así que recargar tiene que respetarlo. */
  await pag.reload();
  await pag.waitForTimeout(150);
  eq(await pag.locator('#lang').textContent(), 'English',
     'y al recargar sigue en español');

  await ctx.close();
}

// ── 4 · Las anclas, con la cabecera pegada ────────────────────────
console.log('\n4 · La cabecera pegada no tapa lo que buscas\n');
{
  const pag = await navegador.newPage({ viewport: { width: 375, height: 780 } });
  await pag.goto(PAGINA);
  await pag.waitForTimeout(120);

  const pegada = await pag.evaluate(() =>
    getComputedStyle(document.querySelector('header')).position);
  eq(pegada, 'sticky', 'la cabecera va pegada');

  for (const id of ['play', 'how', 'precio', 'faq']) {
    /* Se pulsa el enlace de verdad, desde el menú, que es como llega
       un usuario — y se espera a que el desplazamiento PARE. Con un
       waitForTimeout fijo y scroll-behavior:smooth la medida se toma
       a mitad del viaje: la primera versión de esto daba por bueno
       un #precio a 3045px de la cabecera, que no es que estuviera
       bien colocado, es que todavía no había llegado. */
    await pag.evaluate(() => { window.scrollTo(0, 0); location.hash = '' });
    await pag.waitForTimeout(150);
    await pag.locator('#hamb').click();
    await pag.waitForTimeout(260);
    await pag.locator('#menu a[href="#' + id + '"]').click();

    await pag.waitForFunction(() => {
      // Dos lecturas iguales seguidas = ya no se mueve.
      const y = Math.round(window.scrollY);
      const antes = window.__y;
      window.__y = y;
      return antes === y;
    }, null, { timeout: 5000, polling: 120 });

    const m = await pag.evaluate((i) => {
      const s = document.getElementById(i);
      const h = document.querySelector('header').getBoundingClientRect();
      return { arriba: Math.round(s.getBoundingClientRect().top),
               cabecera: Math.round(h.height) };
    }, id);
    /* La sección tiene que quedar por debajo del borde de abajo de
       la cabecera. Sin scroll-padding-top queda justo detrás, y el
       titular al que saltaste no se lee. Y no muy por debajo: si
       sobran cien píxeles, el hueco se nota como un error. */
    si(m.arriba >= m.cabecera - 2 && m.arriba <= m.cabecera + 40,
       '#' + id + ' aterriza justo debajo de la cabecera (' + m.arriba +
       ' con cabecera de ' + m.cabecera + ')');
  }
  await pag.close();
}

await navegador.close();
console.log('\n' + (fallos === 0
  ? '✓ cabe en un teléfono, el menú se comporta y el idioma se entiende'
  : '✗ ' + fallos + ' fallo(s)'));
process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('\n✗ la prueba reventó:', e); process.exit(1) });
