/* ════════════════════════════════════════════════════════════════
   MI EQUIPO — donde aterriza un entrenador que ya tiene campaña

   Lo que esta página tiene que acertar es el aviso de arriba. En
   Cada Punto era "este juego ya se jugó y le falta el marcador".
   Aquí eso no existe — el marcador lo anota el juego — y poner ese
   aviso en Anotado sería pedirle al entrenador algo que no le toca.

   Lo que de verdad cuesta dinero aquí es un nene que no hizo su
   corrida antes de que cierre la ventana: sus padrinos prometieron
   por sus puntos y sin corrida sus puntos son cero.
   ════════════════════════════════════════════════════════════════ */
const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, 'mi-equipo.html');

let fallos = 0;
const ok  = (m) => console.log('  ok   ' + m);
const mal = (m) => { fallos++; console.log('  MAL  ' + m); };
const di  = (m) => console.log('\n' + m);
const has = (t,re,q) => re.test(t) ? ok(q) : mal(q + '  (no ' + re + ')');
const not = (t,re,q) => !re.test(t) ? ok(q) : mal(q + '  (apareció ' + re + ')');

/* Dos equipos: uno con la ventana abierta y tres sin jugar, otro sin
   reto ninguno. */
const CAMPS = [
  { id:'c-abierta', name:'Canóvanas 15U' },
  { id:'c-nada',    name:'Paradiso 17U'  }
];
const RETO_ABIERTO = { ok:true, hay:true, open:true,
  challenge_id:'r-1', opens_at:'2026-10-18T09:00:00Z', closes_at:'2026-10-24T20:00:00Z' };
const TABLERO = { ok:true, estado:'abierto', program:'Canóvanas BC', name:'Reto de octubre',
  nenes:[
    { nombre:'Uno',    jugados:4, total:45 },
    { nombre:'Dos',    jugados:4, total:36 },
    { nombre:'Tres',   jugados:0, total:0  },
    { nombre:'Cuatro', jugados:0, total:0  },
    { nombre:'Cinco',  jugados:0, total:0  }
  ]};

(async () => {
  const browser = await chromium.launch({
    executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
  const page = await browser.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push(String(e).split('\n')[0]));
  page.on('console', m => { if (m.type()==='error') errores.push('console: '+m.text()) });
  await page.route('**/*', r =>
    r.request().url().startsWith('file:') ? r.continue() : r.abort());

  await page.addInitScript(({camps, reto, tablero}) => {
    try{ localStorage.setItem('cp-lang','es');
         localStorage.setItem('cfh_lang','es');
         localStorage.setItem('fc-lang','es'); }catch(e){}
    try{ Object.defineProperty(navigator,'language',{get:()=>'es-PR'}) }catch(e){}
    window.__rpc = [];
    window.fetch = function(url, opts){
      const quién = String(url).split('/rpc/')[1] || '';
      let cuerpo = {};
      try { cuerpo = JSON.parse((opts && opts.body)||'{}') } catch(e){}
      window.__rpc.push({ rpc: quién, body: cuerpo });
      let dato = { ok:false, error:'rpc inesperada: '+quién };
      if (quién === 'builder_check')  dato = { ok:true, by:'John Burgos', campaigns:camps };
      if (quién === 'cp_reto_vivo')   dato = cuerpo.p_campaign === 'c-abierta'
                                            ? reto : { ok:true, hay:false };
      if (quién === 'cp_tablero')     dato = tablero;
      return Promise.resolve({ ok:true, status:200, json:()=>Promise.resolve(dato) });
    };
  }, { camps: CAMPS, reto: RETO_ABIERTO, tablero: TABLERO });

  await page.goto(FILE, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(350);

  di('1 · La puerta');
  let visible = await page.evaluate(() => !/hide/.test(document.getElementById('gate').className));
  visible ? ok('pide el código antes de enseñar nada') : mal('entró sin código');

  await page.evaluate(() => {
    document.getElementById('code').value = 'CODIGO-DE-PRUEBA';
    document.getElementById('cert').checked = true;
    entrar(false);
  });
  await page.waitForTimeout(500);

  di('2 · Qué llamó, y en qué orden');
  const llamadas = await page.evaluate(() => window.__rpc.map(c => c.rpc + (c.body.p_campaign ? ':'+c.body.p_campaign : '')));
  const nombres = llamadas.map(x => x.split(':')[0]);
  nombres[0] === 'builder_check' ? ok('primero comprueba el código') : mal('empezó por ' + nombres[0]);
  nombres.filter(n => n==='cp_reto_vivo').length === 2
    ? ok('pregunta por el reto de cada campaña (2)')
    : mal('cp_reto_vivo salió ' + nombres.filter(n=>n==='cp_reto_vivo').length + ' veces');
  nombres.filter(n => n==='cp_tablero').length === 1
    ? ok('y pide el tablero sólo de la que tiene reto (1)')
    : mal('cp_tablero salió ' + nombres.filter(n=>n==='cp_tablero').length + ' veces');
  not(nombres.join(','), /game_board/, 'no llama a game_board, que es del otro producto');

  di('3 · El aviso de arriba');
  let txt = await page.evaluate(() => document.body.innerText);
  has(txt, /Falta que jueguen/i,                      'el aviso es sobre quién no ha jugado');
  has(txt, /3 jugadores no han hecho su corrida/,      'y cuenta los tres');
  has(txt, /sin corrida sus puntos son cero/,          'dice por qué importa');
  not(txt, /falta el marcador|reportas tú|reportar/i,  'no le pide un marcador a nadie');
  not(txt, /día de juego/i,                            'y no habla de días de juego');

  di('4 · Cada equipo');
  has(txt, /Canóvanas 15U/,       'el equipo con ventana abierta');
  has(txt, /Paradiso 17U/,        'y el que no tiene reto');
  has(txt, /Cierra el/,           'dice cuándo cierra la ventana');
  has(txt, /24 de octubre/,       'y la fecha es la de closes_at, no la de opens_at');
  has(txt, /Sin reto abierto/,    'el otro dice que no tiene reto');
  has(txt, /en la plantilla/i,    'cuenta la plantilla');
  has(txt, /ya jugaron/i,         'y cuántos jugaron');
  const nums = await page.evaluate(() =>
    [...document.querySelectorAll('.team .num b')].map(b => b.textContent));
  nums.slice(0,2).join('/') === '5/2'
    ? ok('cinco en la plantilla, dos ya jugaron')
    : mal('los números salieron ' + nums.slice(0,2).join('/'));

  di('5 · Los enlaces');
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('#teams a, #todo a')].map(a => a.getAttribute('href')));
  hrefs.some(h => h === 'tablero.html?camp=c-abierta') ? ok('al tablero, con la campaña')
    : mal('el enlace al tablero salió ' + JSON.stringify(hrefs));
  hrefs.some(h => h === 'plantilla.html') ? ok('a la plantilla') : mal('falta la plantilla');
  // reporte.html todavía no existe en este repo: mejor sin enlace que
  // con un 404.
  not(hrefs.join(','), /reporte\.html/, 'sin enlace al reporte, que aún no existe aquí');
  // Y cada enlace que sí hay tiene que existir en el repo.
  const fs2 = require('fs');
  const todos = await page.evaluate(() =>
    [...document.querySelectorAll('a')].map(a => a.getAttribute('href')));
  for (const h of [...new Set(todos)].filter(h => h && /\.html$/.test(h.split('?')[0]))){
    fs2.existsSync(path.resolve(__dirname, h.split('?')[0]))
      ? ok(h.split('?')[0] + ' existe')
      : mal(h.split('?')[0] + ' NO existe en el repo');
  }

  di('6 · En inglés');
  await page.evaluate(() => toggleLang());
  await page.waitForTimeout(200);
  const en = await page.evaluate(() => document.body.innerText);
  has(en, /Still to play/i,                        'el aviso, traducido');
  has(en, /have not taken their run/i,             'la cuenta, traducida');
  /* Con la ventana abierta y fecha, la línea de estado enseña la
     fecha de cierre y no "Window open" — a propósito: la fecha dice
     más. "Window open" sólo sale si no hay fecha. */
  has(en, /Closes .*October 24|Closes /i,          'el cierre, traducido');
  has(en, /No challenge open/i,                    'y el estado del que no tiene reto');
  has(en, /on the roster/i,                        'la plantilla, traducida');
  not(en, /game day|report the score/i,            'sin lo del otro producto');

  di('7 · Errores de página');
  if (errores.length === 0) ok('ninguno');
  else errores.forEach(e => mal(e));

  await browser.close();
  console.log('\n' + (fallos === 0 ? '✓ mi-equipo pasa' : '✗ ' + fallos + ' fallo(s)'));
  process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1) });
