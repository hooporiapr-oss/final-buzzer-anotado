/* ════════════════════════════════════════════════════════════════
   AYUDA — las treinta preguntas

   Este fichero lo rompí una vez con un find-and-replace que se comió
   las líneas que cerraban bloques de JavaScript. Por eso las dos
   listas de preguntas se reemplazaron enteras y por eso esto existe:
   para que un cambio que las rompa se note aquí y no en la cancha.

   Lo que vigila:
   - que las dos listas tengan el mismo número de preguntas, que es
     la forma más rápida de ver que a una le falta algo;
   - que todas estén repartidas en las seis secciones y ninguna
     quede fuera de sitio;
   - que ninguna respuesta haya vuelto al modelo del otro producto;
   - y que la de impuestos siga diciendo que no.
   ════════════════════════════════════════════════════════════════ */
const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, 'ayuda.html');

let fallos = 0;
const ok  = (m) => console.log('  ok   ' + m);
const mal = (m) => { fallos++; console.log('  MAL  ' + m); };
const di  = (m) => console.log('\n' + m);

/* Nada de esto puede volver: es el mecanismo del otro producto, y en
   la página que una familia abre cuando tiene una duda es donde más
   daño hace. */
const PROHIBIDO = [
  [/catorce días|fourteen days/i,          'los catorce días'],
  [/día quince|day fifteen/i,              'el día quince'],
  [/\bHooporia\b/i,                       'el nombre retirado'],
  [/cincuenta centavos|fifty cents/i,      'el mínimo de cincuenta centavos, que aquí no existe'],
  /* EL VOCABULARIO DEL PRODUCTO POR ESTUDIANTE. El FAQ seguía
     contestando sobre plantillas, retos, corridas y ventanas — un
     producto que se retiró — en la página que una familia abre
     justo cuando tiene una duda, que es donde más daño hace. */
  [/\bcorrida|\bel reto\b|\bun reto\b|official run/i, 'las corridas y los retos'],
  [/la plantilla|the roster/i,             'la plantilla de jugadores'],
  [/la ventana|the window/i,               'la ventana del reto'],
  [/lo reportas tú|you report the score/i, 'que el entrenador reporte el marcador'],
];

/* Y LO QUE «marcador final» DEJÓ DE SER. Estaba prohibido: el
   producto de antes no tenía uno, sólo corridas de un minuto. El de
   ahora se sostiene sobre él —se promete por punto y se cierra
   cuando el marcador se publica— así que ahora se EXIGE. */

(async () => {
  const browser = await chromium.launch({
    executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
  const cuentas = {};

  for (const L of ['es','en']){
    const page = await browser.newPage();
    const errores = [];
    page.on('pageerror', e => errores.push(String(e).split('\n')[0]));
    page.on('console', m => { if (m.type()==='error') errores.push('console: '+m.text()) });
    await page.route('**/*', r =>
      r.request().url().startsWith('file:') ? r.continue() : r.abort());
    await page.addInitScript(`try{
      localStorage.setItem('cp-lang','${L}');
      localStorage.setItem('cfh_lang','${L}');
      localStorage.setItem('fc-lang','${L}');
    }catch(e){}`);
    await page.goto(FILE, { waitUntil:'domcontentloaded' });
    await page.waitForTimeout(450);

    di(L);

    const forma = await page.evaluate(() => ({
      preguntas: document.querySelectorAll('details').length,
      secciones: [...document.querySelectorAll('h2')].map(h => h.textContent.trim()),
      vacias: [...document.querySelectorAll('details')]
        .filter(d => (d.querySelector('.a')||{textContent:''}).textContent.trim().length < 20).length,
      sinResumen: [...document.querySelectorAll('details')]
        .filter(d => !d.querySelector('summary') ||
                     !d.querySelector('summary').textContent.trim()).length
    }));
    cuentas[L] = forma.preguntas;

    forma.preguntas >= 25 ? ok(forma.preguntas + ' preguntas')
      : mal('sólo salieron ' + forma.preguntas + ' preguntas — ¿se comió algo la lista?');
    forma.secciones.length === 7 ? ok('las siete secciones: ' + forma.secciones.join(' · '))
      : mal('salieron ' + forma.secciones.length + ' secciones: ' + forma.secciones.join(' · '));
    forma.vacias === 0 ? ok('ninguna respuesta vacía')
      : mal(forma.vacias + ' respuesta(s) sin contenido');
    forma.sinResumen === 0 ? ok('todas tienen su pregunta')
      : mal(forma.sinResumen + ' sin pregunta');

    /* Lo plegado no sale en innerText: hay que leer el textContent de
       cada <details> o la mitad de la página es invisible. */
    const txt = await page.evaluate(() =>
      document.body.innerText + '\n' +
      [...document.querySelectorAll('details')].map(d => d.textContent).join('\n'));

    const quiero = L === 'es'
      ? [[/se publica el marcador/,             'el marcador se publica, no lo reporta nadie'],
         [/pones el marcador final y mandas los avisos/, 'y lo pone el entrenador en Mi calendario'],
         [/llega a \$5 o más/,          'qué es una promesa que cualifica'],
         [/\$1 por cada promesa que cualifica/,  'el precio'],
         [/máximo de \$99 por juego/,           'y su tope'],
         [/Sin suscripción y sin mínimo/,       'sin suscripción ni mínimo'],
         [/Un correo, cuando se publica/,                  'un solo aviso al padrino'],
         [/Sin enlace de pago y sin recordatorios/, 'sin enlace de pago ni recordatorios'],
         [/El dinero no pasa por nosotros/,     'el dinero no pasa por nosotros'],
         [/no decimos que una promesa sea deducible/, 'impuestos: no decimos que lo sea'],
         [/Ganen o pierdan, cada punto cuenta/, 'ganen o pierdan, cada punto cuenta'],
         [/queda suspendido hasta que se complete el pago/, 'qué pasa si no se paga']]
      : [[/the score is posted/,                'the score is posted, nobody reports it'],
         [/you post the final score and send the notices/, 'and the coach posts it in My schedule'],
         [/reaches \$5 or more/,        'what a qualifying pledge is'],
         [/\$1 for each qualifying pledge/,     'the price'],
         [/\$99 maximum per game/,              'and its cap'],
         [/No subscription and no minimum/,     'no subscription, no minimum'],
         [/One email, when the score/,                  'one notice to the padrino'],
         [/No payment link and no reminders/,   'no payment link, no reminders'],
         [/The money does not pass through us/, 'the money does not pass through us'],
         [/we do not say a pledge is deductible/, 'tax: we do not say that it is'],
         [/Win or lose, every point counts/,    'win or lose, every point counts'],
         [/suspended until payment is completed/, 'what happens if it is not paid']];

    for (const [re, qué] of quiero)
      re.test(txt) ? ok(qué) : mal('falta: ' + qué + '  ' + re);

    for (const [re, qué] of PROHIBIDO)
      if (re.test(txt)) mal('volvió ' + qué + '  ' + re);

    /* LAS TRES PUERTAS. El FAQ contesta con ejemplos que se pueden
       abrir: la hoja de promesa, el aviso al padrino y el reporte.
       Si alguno se cae, la respuesta se queda en una promesa. */
    const puertas = await page.evaluate(() =>
      [...document.querySelectorAll('details a')].map(a => a.getAttribute('href')));
    for (const h of ['prometer.html?ejemplo=1','aviso.html','reporte.html?ejemplo=1','custodia.html'])
      puertas.includes(h) ? ok('enlaza a ' + h) : mal('falta el enlace a ' + h);

    if (errores.length === 0) ok('sin errores de página');
    else errores.forEach(e => mal(e));

    await page.close();
  }

  di('las dos listas');
  cuentas.es === cuentas.en
    ? ok('el mismo número de preguntas en los dos idiomas (' + cuentas.es + ')')
    : mal('español ' + cuentas.es + ', inglés ' + cuentas.en + ' — a una le falta algo');

  await browser.close();
  console.log('\n' + (fallos === 0 ? '✓ ayuda pasa' : '✗ ' + fallos + ' fallo(s)'));
  process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1) });
