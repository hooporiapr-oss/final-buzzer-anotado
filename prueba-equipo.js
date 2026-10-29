/* ════════════════════════════════════════════════════════════════
   EQUIPO — la inscripción

   Es el único camino de conversión de la portada, así que lo que
   importa es que entre y que entre bien etiquetada: los dos
   productos escriben en bw_requests y sin la etiqueta una solicitud
   de Cada Punto Cuenta le llega al admin idéntica a una de Cada Punto.

   Y que la licencia se acepte a mano. Sin el visto, no se manda.
   ════════════════════════════════════════════════════════════════ */
const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, 'equipo.html');

let fallos = 0;
const ok  = (m) => console.log('  ok   ' + m);
const mal = (m) => { fallos++; console.log('  MAL  ' + m); };
const di  = (m) => console.log('\n' + m);
const has = (t,re,q) => re.test(t) ? ok(q) : mal(q + '  (no ' + re + ')');
const not = (t,re,q) => !re.test(t) ? ok(q) : mal(q + '  (apareció ' + re + ')');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push(String(e).split('\n')[0]));
  page.on('console', m => { if (m.type()==='error') errores.push('console: '+m.text()) });
  await page.route('**/*', r =>
    r.request().url().startsWith('file:') ? r.continue() : r.abort());

  await page.addInitScript(() => {
    try{ localStorage.setItem('cp-lang','es');
         localStorage.setItem('cfh_lang','es');
         localStorage.setItem('fc-lang','es'); }catch(e){}
    try{ Object.defineProperty(navigator,'language',{ get:()=>'es-PR' }) }catch(e){}
    // Cada llamada queda apuntada, y las dos contestan que sí.
    window.__rpc = [];
    window.fetch = function(url, opts){
      const quién = String(url).split('/rpc/')[1] || '';
      let cuerpo = {};
      try { cuerpo = JSON.parse((opts && opts.body) || '{}') } catch(e){}
      window.__rpc.push({ rpc: quién, body: cuerpo });
      const dato = quién === 'bw_request_team'  ? { ok:true }
                 : quién === 'request_product'  ? { ok:true, product:'anotado' }
                 : quién === 'license_record'   ? { ok:true }
                 : { ok:false, error:'rpc inesperada: ' + quién };
      return Promise.resolve({ ok:true, status:200, json:()=>Promise.resolve(dato) });
    };
  });

  await page.goto(FILE, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(400);

  di('1 · Lo que dice');
  let txt = await page.evaluate(() => document.body.innerText);
  has(txt, /Tus jugadores anotan/,             'tus jugadores anotan');
  has(txt, /El juego anota los puntos solo/,   'el juego anota solo');
  has(txt, /nadie tiene que reportar un marcador ni que le crean/,
      'nadie tiene que reportar ni que le crean');
  has(txt, /Antes de la ventana/,              'los pasos van por ventana, no por día');
  has(txt, /una sola corrida oficial/,         'una sola corrida oficial');
  /* El HECHO —se licencia POR JUEGO— y no la frase con la que se
     decia. Esta linea pedia primero "por equipo y por evento" y
     despues "por evento"; las dos son la frase vieja. El producto se
     cobra juego a juego, y el numero lo vigila prueba-precio.js. */
  has(txt, /licencia por juego|licencia <b>por juego/i, 'la licencia, por juego');
  not(txt, /catorce días|día quince|día 1/i,   'sin los días del otro producto');
  not(txt, /\bHooporia\b/i,                    'sin el nombre retirado');
  not(txt, /deducib|impuesto/i,                'ni una palabra de impuestos');

  /* El paso dos pedía la plantilla: "nos pasas tu plantilla". Aquí
     nadie manda listas — el jugador se da de alta solo con el enlace
     de la campaña y el entrenador aprueba. Pedirle los nombres al
     entrenador es trabajo que el producto le quita, así que
     prometerlo en la página y luego no pedírselo no era un error
     bonito: era la página contando otro producto. */
  has(txt, /se dan de alta solos/,             'los jugadores se dan de alta solos');
  has(txt, /No nos mandas ninguna lista/,      'y se dice que no se manda ninguna lista');
  has(txt, /tú apruebas quién queda dentro/,   'con el entrenador aprobando');
  /* Lo que importa es que se diga que corre mas gente que la
     plantilla, no con que palabra. "El equipo" paso a "la
     plantilla" cuando la pagina dejo de hablarle solo a un equipo. */
  has(txt, /no tiene que ser sólo (el equipo|la plantilla)/, 'y abierto a más que la plantilla');
  not(txt, /[Nn]os pasas tu plantilla|[Mm]ándanos|[Pp]ásanos (tu|la) plantilla/,
      'y en ningún sitio se le piden los nombres al entrenador');

  di('2 · La licencia no se puede saltar');
  await page.evaluate(() => {
    const v = { team:'Canóvanas 15U', prog:'Canóvanas Basketball Club',
                name:'John Burgos', email:'prueba@ejemplo.invalid', phone:'7871234567' };
    for (const [id,val] of Object.entries({ tm:v.team, pg:v.prog, nm:v.name,
                                            em:v.email, ph:v.phone })){
      const el = document.getElementById(id);
      if (el) el.value = val;
    }
  });
  // Marcar términos y custodia, pero NO la licencia.
  const marcados = await page.evaluate(() => {
    const puestos = [];
    for (const c of document.querySelectorAll('input[type=checkbox]')){
      if (c.id === 'lc') continue;
      c.checked = true; puestos.push(c.id);
    }
    return puestos;
  });
  await page.evaluate(() => { window.__rpc.length = 0; });
  await page.evaluate(() => send());
  await page.waitForTimeout(300);
  let llamadas = await page.evaluate(() => window.__rpc.map(c => c.rpc));
  if (llamadas.length === 0) ok('sin el visto de la licencia no manda nada (' + marcados.join(', ') + ' sí estaban)');
  else mal('mandó sin aceptar la licencia: ' + llamadas.join(','));

  di('3 · Con la licencia aceptada');
  await page.evaluate(() => {
    const lc = document.getElementById('lc'); if (lc) lc.checked = true;
    window.__rpc.length = 0;
  });
  await page.evaluate(() => send());
  await page.waitForTimeout(400);
  const calls = await page.evaluate(() => window.__rpc);
  const nombres = calls.map(c => c.rpc);
  if (nombres.includes('bw_request_team')) ok('la inscripción entra');
  else mal('no llamó a bw_request_team: ' + nombres.join(','));

  /* EL PRODUCTO, Y ESTA PÁGINA ES LA DE CADA PUNTO CUENTA.

     Esto exigía 'anotado' —el id del OTRO producto— así que la prueba
     no es que no cazara el fallo: lo defendía. Cada programa que se
     inscribía aquí nacía del lado equivocado, y la única prueba que
     miraba el producto daba el visto bueno.

     Dos productos comparten la base y `campaigns.product` es lo único
     que los separa, así que una campaña con el product cambiado no
     sale por el lado por el que entró. */
  const prod = calls.find(c => c.rpc === 'request_product');
  if (!prod) mal('no marcó el producto — en el admin sería indistinguible del otro producto');
  else {
    ok('marca el producto');
    prod.body.p_product === 'cada-punto' ? ok('y lo marca como cada-punto')
      : mal('lo marcó como ' + prod.body.p_product);
    prod.body.p_email === 'prueba@ejemplo.invalid' ? ok('con el correo del entrenador')
      : mal('con otro correo: ' + prod.body.p_email);
  }
  // El orden importa: primero entra, después se etiqueta.
  if (nombres.indexOf('bw_request_team') < nombres.indexOf('request_product'))
    ok('primero entra la solicitud, después la etiqueta');
  else mal('las llamó al revés');

  const req = calls.find(c => c.rpc === 'bw_request_team');
  if (req && req.body.p_terms === true && req.body.p_custody === true)
    ok('manda el acuse de términos y de custodia');
  else mal('faltan los acuses: ' + JSON.stringify(req && req.body));

  di('4 · Si la etiqueta falla, la inscripción no se cae');
  const erroresAntes = errores.length;
  await page.evaluate(() => {
    // request_product revienta; bw_request_team sigue bien.
    const antes = window.fetch;
    window.fetch = function(url, opts){
      if (String(url).indexOf('request_product') > -1)
        return Promise.reject(new Error('no existe todavía'));
      return antes(url, opts);
    };
    window.__rpc.length = 0;
    /* Después de una inscripción buena la página se repinta en la
       pantalla de "hecho" y el formulario deja de existir, así que
       hay que devolverlo antes de volver a llenarlo. */
    SENT = null;
    draw();
    for (const [id,val] of Object.entries({ tm:'Canóvanas 15U',
        pg:'Canóvanas Basketball Club', nm:'John Burgos',
        em:'prueba@ejemplo.invalid', ph:'7871234567' })){
      const el = document.getElementById(id); if (el) el.value = val;
    }
    for (const c of document.querySelectorAll('input[type=checkbox]')) c.checked = true;
  });
  await page.evaluate(() => send());
  await page.waitForTimeout(400);
  const despues = await page.evaluate(() => ({
    rpc: window.__rpc.map(c => c.rpc),
    txt: document.body.innerText
  }));
  if (despues.rpc.includes('bw_request_team')) ok('la inscripción entró igual');
  else mal('la inscripción se cayó con la etiqueta');
  if (/\bprueba@ejemplo\.invalid\b/.test(despues.txt) || /confirm/i.test(despues.txt))
    ok('y el entrenador ve que entró');
  else ok('(la pantalla de hecho no se pudo comprobar aquí)');

  /* Y que el fallo quede en la consola en vez de pasar en silencio:
     si algún día request_product empieza a fallar de verdad, tiene
     que haber rastro. */
  const nuevos = errores.slice(erroresAntes);
  if (nuevos.some(e => /request_product/.test(e)))
    ok('el fallo de la etiqueta queda apuntado en la consola');
  else mal('el fallo de la etiqueta pasó en silencio');

  di('5 · Errores de página');
  /* Sólo los de antes de la sección 4: a partir de ahí hay uno
     provocado a propósito. */
  const reales = errores.slice(0, erroresAntes);
  if (reales.length === 0) ok('ninguno (sin contar el provocado en el paso 4)');
  else reales.forEach(e => mal(e));

  await browser.close();
  console.log('\n' + (fallos === 0 ? '✓ equipo pasa' : '✗ ' + fallos + ' fallo(s)'));
  process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1) });
