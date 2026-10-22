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
  [/Cada Punto(?! que)|cadapunto\.com/,  'nombra el otro producto'],   // sin /i: "por cada punto" es español, no la marca
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
  'custodia.html': {
    es: [/El dinero no pasa por nosotros/, /No recibimos dinero de nadie/,
         /El marcador lo anota el juego/, /Nadie mete un marcador a mano/,
         /depende del tamaño de la plantilla/, /No hay columna de pagado/],
    en: [/The money does not pass through us/, /We do not receive any money/,
         /score is recorded by the game/, /Nobody enters a score by hand/,
         /set by the size of the roster/, /no paid column/]
  },
  'terms.html': {
    /* Las dos últimas son la promesa de QUIÉN manda los avisos. Están
       aquí porque los términos decían que los mandaba Hooporia sola al
       cerrar la ventana, y no es verdad: los manda el programa cuando
       pulsa el botón del reporte. Si alguien vuelve a poner que salen
       solos, esto falla — un documento que un programa firma no puede
       prometer un comportamiento que el código no tiene. */
    es: [/El marcador lo anota el juego, no una persona/,
         /la base de datos rechaza la segunda/, /una ventana que pone el programa/,
         /El programa lo revisa y manda los avisos/,
         /Hooporia\s+no le escribe a un padrino por su cuenta/],
    en: [/recorded by the game, not by a person/,
         /the database refuses a second/, /inside a window the program sets/,
         /The program reviews it and sends the notices/,
         /Hooporia does not write to a padrino on its\s+own/]
  },
  'privacy.html': {
    es: [/De una corrida/, /el nivel que alcanzó/, /una clave, que existe nada más/],
    en: [/From a run/, /the level he reached/, /a run key, which exists only/]
  },
  'cobro.html': {
    es: [/Nosotros anotamos las promesas\. Tu programa cobra/, /Hooporia no procesa pagos ni guarda dinero/,
         /Al cerrar la ventana del evento/, /no tiene columna de pagado y no la va a tener/],
    en: [/We record the pledges\. Your program collects/, /processes no payments and holds no money/,
         /When the event window closes/, /no paid column and never will/]
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
