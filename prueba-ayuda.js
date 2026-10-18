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
  [/marcador final|final score/i,          'un marcador final'],
  [/lo reportas tú|you report the score/i, 'que el entrenador reporte el marcador'],
  [/Cada Punto/,                           'el nombre del otro producto'],
  [/cincuenta centavos|fifty cents/i,      'el mínimo de cincuenta centavos, que aquí no existe'],
  [/puntos del equipo|points the team/i,   'promesas por los puntos del equipo'],
];

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
    forma.secciones.length === 6 ? ok('las seis secciones: ' + forma.secciones.join(' · '))
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
      ? [[/El juego lo anota solo/,              'el juego anota solo'],
         [/una sola corrida oficial/,            'una sola corrida oficial'],
         [/la segunda la rechaza la base de datos/, 'y la segunda la rechaza la base'],
         [/Tú pones la ventana/,                 'la ventana la pone el programa'],
         [/por equipo, por reto/,                'la licencia, por reto'],
         [/45 puntos son \$4\.50/,               'el ejemplo del padrino, con su cuenta'],
         [/No decimos que lo sea/,               'impuestos: no decimos que lo sea'],
         [/no los escribió una persona/,         'por qué los puntos son de verdad']]
      : [[/The game records it itself/,          'the game records it itself'],
         [/one official run/,                    'one official run'],
         [/the database refuses the second/,     'and the database refuses the second'],
         [/You set the window/,                  'the program sets the window'],
         [/per team, per challenge/,             'licensed per challenge'],
         [/45-point run is \$4\.50/,             'the padrino example, with its sum'],
         [/We do not say that it is/,            'tax: we do not say that it is'],
         [/a person did not write them/,         'why the points are real']];

    for (const [re, qué] of quiero)
      re.test(txt) ? ok(qué) : mal('falta: ' + qué + '  ' + re);

    for (const [re, qué] of PROHIBIDO)
      if (re.test(txt)) mal('volvió ' + qué + '  ' + re);

    // El ejemplo del padrino tiene que cuadrar: 45 puntos a 10¢.
    if (/45/.test(txt) && /4\.50/.test(txt)) ok('45 × $0.10 = $4.50, y la página lo dice así');
    else mal('el ejemplo no cuadra');

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
