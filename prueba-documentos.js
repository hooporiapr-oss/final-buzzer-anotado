/* ════════════════════════════════════════════════════════════════
   LAS CUATRO HOJAS — custodia, terms, privacy, cobro

   Son las que lee el tesorero de un programa antes de firmar algo.
   La prueba vigila dos cosas:

   1. Que la posición no se ablande. Nada de custodia, nada de
      cobrar, ninguna columna de pagado, y ni una palabra que diga
      que una promesa es deducible de impuestos.

   2. Que describan ESTE producto. El marcador lo anota el juego,
      por jugador, dentro de una ventana que pone el programa. Si
      vuelve a aparecer un entrenador metiendo un marcador final, o
      los catorce días y el juego el día quince, es que se colaron
      del otro producto.
   ════════════════════════════════════════════════════════════════ */
const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
const path = require('path');

let fallos = 0;
const ok  = (m) => console.log('    ok   ' + m);
const mal = (m) => { fallos++; console.log('    MAL  ' + m); };

/* Lo prohibido en las cuatro, en los dos idiomas. Si alguna de estas
   aparece, alguien aflojó la posición. */
const PROHIBIDO = [
  [/nosotros cobramos a/i,            'dice que cobramos a alguien'],
  [/fortress/i,                       'nombra el Fortress'],
  [/\bHooporia\b|hooporia\.com/i,       'nombra la marca retirada'],
  [/catorce días|fourteen days|día quince|day fifteen/i, 'la forma de 15 días del otro producto'],
  [/el entrenador lo entra|coach enters it/i, 'un entrenador metiendo el marcador'],
];

/* Y lo de los impuestos, que es la línea que no se cruza nunca: la
   palabra sólo puede salir dentro de una negación. */
/* La columna de pagado: la frase puede salir, pero sólo negada —
   "No hay columna de pagado" y "no tiene columna de pagado y no la va
   a tener" son las dos formas correctas. La negación va delante, así
   que se mira la línea entera. */
function columnaPagado(txt, dónde){
  const lineas = txt.split('\n').filter(l => /columna de pagado|paid column/i.test(l));
  const malas = lineas.filter(l => !/\bno\b|\bnot\b|never|nunca/i.test(l));
  if (malas.length) mal(dónde + ': la columna de pagado sale sin negar → ' + malas[0].trim().slice(0,70));
  else if (lineas.length) ok(dónde + ': la columna de pagado sólo sale negada');
}

function impuestos(txt, dónde){
  const lineas = txt.split('\n').filter(l => /deducib|deductib/i.test(l));
  if (!lineas.length) return ok(dónde + ': no menciona deducibilidad');
  const malas = lineas.filter(l => !/\bno\b|\bnot\b|never/i.test(l));
  if (malas.length) mal(dónde + ': habla de deducibilidad sin negarla → ' + malas[0].trim().slice(0,70));
  else ok(dónde + ': la deducibilidad sólo sale negada (' + lineas.length + ')');
}

const PAGINAS = {
  /* LA LÍNEA DEL PRECIO CAMBIÓ EL 26 DE OCTUBRE DE 2026. Exigía la
     escalera por plantilla —«depende del tamaño de la plantilla» y
     «set by the size of the roster»— y la divulgación ahora licencia
     POR JUEGO, cinco dólares por cada juego con promesas.

     La de español, además, estaba pasando por accidente: el texto
     nuevo dice «NO depende del tamaño de la plantilla» y la regex
     vieja casaba dentro de esa negación. Pasaba por decir lo
     contrario de lo que se le pedía, que es la peor manera de pasar.
     Ahora las dos piden el modelo que la página dice de verdad. */
  'custodia.html': {
    /* Desde el 2 de noviembre de 2026: el marcador lo publica el
       programa, la promesa es por los puntos del equipo, y lo único
       que se factura es la licencia del programa. Y que una
       suspensión nunca le quita al programa su información. */
    es: [/El dinero no pasa por nosotros/, /No recibimos dinero de nadie/,
         /El marcador final lo publica el programa/, /Lo único que facturamos es la licencia del programa/,
         /se licencia por juego/, /No hay columna de pagado/,
         /Una suspensión nunca le quita al programa su información/],
    en: [/The money does not pass through us/, /We do not receive any money/,
         /final score is published by the program/, /The only thing we invoice is the program/,
         /licensed per game/, /no paid column/,
         /A suspension never takes a program/]
  },
  'terms.html': {
    /* REESCRITOS EL 2 DE NOVIEMBRE DE 2026 para el modelo de un juego
       a la vez: el programa registra el juego y publica el marcador,
       la promesa es por los puntos del EQUIPO, y Cada Punto Cuenta no
       toca el dinero. Se vigila eso, y que los avisos sigan siendo
       del programa —nunca salen solos— con su única excepción: la
       corrección. Si alguien vuelve a poner que salen solos, o que
       hay recordatorios, esto falla. */
    es: [/Funciona un juego a la vez/, /cada punto que anote el\s+equipo/,
         /el programa entra y publica el marcador final/,
         /no recibe, no guarda, no procesa, no verifica, no cobra y no lleva\s+cuenta de ningún pago/,
         /Cada Punto Cuenta no le escribe a un padrino por\s+su cuenta/,
         /recibe un aviso de corrección con la cantidad corregida/],
    en: [/It works\s+one game at a time/, /every point the\s+team/,
         /the program enters and publishes the final score/,
         /does not receive, hold, process, verify, collect or track any\s+payment/,
         /Cada Punto Cuenta does not write to a padrino\s+on its own/,
         /receives one correction notice with\s+the corrected amount/]
  },
  'privacy.html': {
    /* Lo que se recoge hoy: el padrino, el programa y el juego. Nada de
       corridas. Y Stripe, que factura la licencia del programa y no
       toca dinero de promesas. */
    es: [/De un juego\./, /el juego sobre el que prometiste/, /Stripe/,
         /No maneja dinero de promesas/, /Una suspensión nunca le quita al programa su\s+información/],
    en: [/From a game\./, /the game you pledged on/, /Stripe/,
         /It handles no pledge money/, /A suspension never takes a program.s\s+information/]
  },
  'cobro.html': {
    es: [/Nosotros anotamos las promesas\. Tu programa cobra/, /Cada Punto Cuenta no procesa pagos ni guarda dinero/,
         /Cuando publicas el marcador final de un juego/, /no tiene columna de pagado y no la va a tener/],
    en: [/We record the pledges\. Your program collects/, /processes no payments and holds no money/,
         /When you publish a game.s final score/, /no paid column and never will/]
  }
};

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox']
  });

  for (const [archivo, esperado] of Object.entries(PAGINAS)){
    console.log('\n' + archivo);
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
      await page.goto('file://' + path.resolve(__dirname, archivo),
                      { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);

      // Los <details> plegados no salen en innerText.
      const txt = await page.evaluate(() => {
        const extra = [...document.querySelectorAll('details,.faq')]
          .map(e => e.textContent).join('\n');
        return document.body.innerText + '\n' + extra;
      });

      console.log('  ' + L + '  (' + txt.length + ' chars)');
      if (txt.length < 1500) mal('la página salió casi vacía');

      for (const re of esperado[L])
        re.test(txt) ? ok(String(re)) : mal('falta ' + re);

      for (const [re, qué] of PROHIBIDO)
        if (re.test(txt)) mal(qué + '  ' + re);

      impuestos(txt, L);
      columnaPagado(txt, L);

      if (errores.length) errores.forEach(e => mal(e));
      await page.close();
    }
  }

  await browser.close();
  console.log('\n' + (fallos === 0
    ? '✓ las cuatro hojas pasan'
    : '✗ ' + fallos + ' fallo(s)'));
  process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1) });
