/* ════════════════════════════════════════════════════════════════
   EQUIPO, DE PRINCIPIO A FIN, CON EL JAVASCRIPT ENCENDIDO

   Las comprobaciones de estructura dicen que el español está en el
   marcado y que ninguna llave vive en dos sitios. No dicen que un
   entrenador pueda inscribirse.

   Esto se mete en la página como se metería una persona: escribe en
   los campos, pulsa el botón, marca las casillas. No llama a send()
   por la puerta de atrás ni le pone valores a los elementos desde
   fuera. Si el formulario se hubiera roto al mover el español al
   marcado, aquí se ve.

   La red se queda cortada: ninguna llamada sale de esta máquina.
   ════════════════════════════════════════════════════════════════ */
const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, 'equipo.html');

let fallos = 0;
const ok  = (m) => console.log('  ok   ' + m);
const mal = (m) => { fallos++; console.log('  MAL  ' + m); };
const di  = (m) => console.log('\n' + m);

const STUB = `
  window.__rpc = [];
  window.__post = [];
  window.fetch = function(url, opts){
    var u = String(url);
    var cuerpo = {};
    try { cuerpo = JSON.parse((opts && opts.body) || '{}') } catch(e){}
    if (u.indexOf('/rpc/') > -1){
      var quien = u.split('/rpc/')[1];
      window.__rpc.push({ rpc: quien, body: cuerpo });
      var dato = quien === 'bw_request_team' ? { ok:true }
               : quien === 'request_product' ? { ok:true }
               : quien === 'license_record'  ? { ok:true }
               : { ok:false, error:'rpc inesperada: ' + quien };
      return Promise.resolve({ ok:true, status:200, json:function(){ return Promise.resolve(dato) } });
    }
    window.__post.push({ url: u, body: cuerpo });
    return Promise.resolve({ ok:true, status:200, json:function(){ return Promise.resolve({ok:true}) } });
  };
`;

async function corrida(browser, lang, correo){
  di((lang === 'es' ? 'ESPAÑOL' : 'ENGLISH') + ' — una inscripción entera');
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', e => errores.push(String(e).split('\n')[0]));
  p.on('console', m => { if (m.type() === 'error') errores.push('console: ' + m.text()) });
  await p.addInitScript(STUB);
  await p.goto(FILE + '?lang=' + lang, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(450);

  const msg = () => p.evaluate(() => (document.getElementById('msg') || {}).textContent || '');
  const rpcs = () => p.evaluate(() => window.__rpc.map(c => c.rpc));

  // ── 1 · el botón con todo vacío ───────────────────────────────
  await p.click('.btn');
  await p.waitForTimeout(150);
  let m = await msg();
  (m && /equipo|team/i.test(m)) ? ok('vacío: pide el nombre del equipo — "' + m.slice(0,46) + '"')
                                : mal('vacío: no avisó de nada (' + m + ')');
  (await rpcs()).length === 0 ? ok('y no mandó nada')
                              : mal('mandó algo con el formulario vacío');

  // ── 2 · los cinco campos, escritos como los escribe una persona ──
  for (const [sel, val] of [['#tm','Canóvanas 15U'], ['#pg','Canóvanas Basketball Club'],
                            ['#nm','John Burgos'], ['#em', correo], ['#ph','7871234567']]){
    await p.click(sel); await p.fill(sel, val);
  }
  const escrito = await p.evaluate(() => ['tm','pg','nm','em','ph']
    .map(i => document.getElementById(i).value));
  escrito.every(v => v) ? ok('los cinco campos aceptan lo que se escribe')
                        : mal('algún campo no recogió: ' + JSON.stringify(escrito));

  // ── 3 · sin marcar la licencia, no entra ──────────────────────
  await p.click('.btn'); await p.waitForTimeout(150);
  m = await msg();
  (m && /licencia|license/i.test(m)) ? ok('sin la licencia marcada se para — "' + m.slice(0,46) + '"')
                                     : mal('dejó pasar sin licencia (' + m + ')');
  (await rpcs()).length === 0 ? ok('y sigue sin mandar nada') : mal('mandó sin licencia');

  // ── 4 · marcando por el texto, que es como se marca de verdad ──
  await p.click('[data-i="lic"]');
  await p.click('.btn'); await p.waitForTimeout(150);
  m = await msg();
  (m && /dinero|money|custodia/i.test(m)) ? ok('falta la de custodia y lo dice — "' + m.slice(0,42) + '"')
                                          : mal('no pidió la de custodia (' + m + ')');

  await p.click('[data-i="custody"]');
  await p.click('.btn'); await p.waitForTimeout(150);
  m = await msg();
  (m && /t[ée]rminos|terms/i.test(m)) ? ok('y los términos — "' + m.slice(0,42) + '"')
                                      : mal('no pidió los términos (' + m + ')');
  const marcadas = await p.evaluate(() => ['lc','cu','tc']
    .map(i => document.getElementById(i).checked));
  (marcadas[0] && marcadas[1] && !marcadas[2])
    ? ok('pulsar el texto marca su casilla (lc y cu sí, tc todavía no)')
    : mal('las casillas no siguieron al texto: ' + JSON.stringify(marcadas));

  // ── 5 · completa ──────────────────────────────────────────────
  await p.click('[data-i="terms"]');
  await p.click('.btn');
  await p.waitForTimeout(500);

  const llamadas = await rpcs();
  llamadas.includes('bw_request_team') ? ok('con las tres marcadas, la solicitud sale')
                                       : mal('no salió: ' + llamadas.join(','));
  llamadas.indexOf('bw_request_team') < llamadas.indexOf('request_product')
    ? ok('primero la solicitud, después la etiqueta del producto')
    : mal('en el orden equivocado: ' + llamadas.join(','));

  const req = await p.evaluate(() => window.__rpc.find(c => c.rpc === 'bw_request_team').body);
  (req.p_team === 'Canóvanas 15U' && req.p_program === 'Canóvanas Basketball Club' &&
   req.p_email === correo && req.p_terms === true && req.p_custody === true)
    ? ok('con el equipo, el programa, el correo y los dos acuses')
    : mal('payload raro: ' + JSON.stringify(req));

  const prod = await p.evaluate(() => (window.__rpc.find(c => c.rpc === 'request_product')||{}).body);
  (prod && prod.p_product === 'cada-punto')
    ? ok('etiquetada como cada-punto, no como el otro producto')
    : mal('etiqueta: ' + JSON.stringify(prod));

  // ── 6 · el acuse de licencia lleva el texto QUE SE VIO ─────────
  const lic = await p.evaluate(() => (window.__rpc.find(c => c.rpc === 'license_record')||{}).body);
  const esperado = lang === 'es' ? /Acepto la licencia por juego/ : /I accept the per-game license/;
  (lic && esperado.test(lic.p_terms))
    ? ok('el acuse guarda la licencia en el idioma que vio el entrenador')
    : mal('el acuse no lleva la licencia: ' + JSON.stringify(lic && lic.p_terms || '').slice(0,70));
  (lic && /\$99/.test(lic.p_terms) && /(cualifica|qualif)/i.test(lic.p_terms))
    ? ok('y con el tope y la definición dentro')
    : mal('la licencia guardada no trae el tope o la definición');

  // ── 7 · la pantalla de hecho ──────────────────────────────────
  const fin = await p.evaluate(() => ({
    appOculto: document.getElementById('app').hidden,
    hecho:     !document.getElementById('done').hidden,
    txt:       document.getElementById('done').innerText,
    campos:    !!document.getElementById('tm')
  }));
  fin.hecho && fin.appOculto ? ok('sale el acuse de recibo y el formulario se esconde')
                             : mal('el acuse no apareció');
  fin.txt.includes(correo) ? ok('con el correo al que se le va a escribir')
                           : mal('el acuse no dice el correo: ' + fin.txt.slice(0,70));
  fin.campos ? ok('y el formulario sigue existiendo debajo, no se destruyó')
             : mal('el formulario se destruyó');

  errores.length === 0 ? ok('ni un error de página en toda la corrida')
                       : errores.forEach(e => mal(e));

  await p.screenshot({ path: require('os').tmpdir() + '/hecho-' + lang + '.png' });
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox']
  });
  await corrida(browser, 'es', 'prueba.es@ejemplo.invalid');
  await corrida(browser, 'en', 'prueba.en@ejemplo.invalid');
  await browser.close();
  console.log('\n' + (fallos === 0
    ? '════════ la inscripción funciona entera, en los dos idiomas ════════'
    : '✗ ' + fallos + ' fallo(s)'));
  process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1) });
