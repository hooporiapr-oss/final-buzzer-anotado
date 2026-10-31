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
const fs   = require('fs');
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
  /* LA PROMESA ES DEL EQUIPO, NO DEL JUGADOR. La página decía «tus
     jugadores anotan» y hablaba de ventanas y de una corrida
     oficial: el producto por estudiante, que se retiró. Lo que se
     vende hoy es un juego — el que ya se iba a jugar — y el
     marcador final haciendo la cuenta. Se vigila eso, que es lo que
     el entrenador firma dos pantallas más abajo. */
  has(txt, /que anote tu equipo/,              'se promete por los puntos del equipo');
  has(txt, /El juego ya lo ibas a jugar/,      'y el juego ya se iba a jugar');
  has(txt, /el marcador final hace la cuenta/, 'el marcador final hace la cuenta');
  has(txt, /Antes del juego/,                  'los pasos van por juego');
  has(txt, /Al publicarse el marcador/,        'y el último lo dispara el marcador');
  has(txt, /Ganen o pierdan, cada punto cuenta/,'ganen o pierdan, cada punto cuenta');
  not(txt, /ventana|corrida oficial|tus jugadores anotan/i,
      'y no quedó nada del producto por estudiante');
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
  /* AL REVÉS DE COMO ESTABA. Esta parte pedía que la página dijera
     que los jugadores se dan de alta solos y que el entrenador
     aprueba. Hoy dice lo contrario y a propósito: las campañas se
     abren a mano, una por una, y nada sale al aire hasta que el
     entrenador lo diga. Un guardia que exigiera la frase vieja
     estaría pidiendo que se volviera a prometer un alta automática
     que nadie quiere.

     Lo que sí se mantiene —y es lo que le quita trabajo— es que no
     hay listas: se promete por los puntos del EQUIPO, así que un
     solo enlace sirve para todas las familias. */
  has(txt, /Nadie se da de alta solo/,         'las campañas no se abren solas');
  has(txt, /a mano/,                           'se abren a mano, una por una');
  has(txt, /hasta que tú lo digas/,            'y nada sale al aire sin el entrenador');
  has(txt, /No hay listas de jugadores que mandar/,'no hay listas que mandar');
  has(txt, /ni nombres que escribir/,          'ni nombres que escribir');
  has(txt, /sirve para todas las familias/,    'un solo enlace para todas las familias');
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

  /* ──────────────────────────────────────────────────────────────
     6 · LA PÁGINA, CON EL JAVASCRIPT APAGADO

     Esta página se pintaba entera desde el diccionario. El marcado
     era <div id="app"></div>, así que a un buscador, a la vista
     previa de un enlace de WhatsApp o a cualquiera con una conexión
     que se cae a medias le llegaban 223 caracteres: la cabecera y el
     pie. Para el entrenador al que se le manda este enlace, una
     página en blanco.

     Es el único camino de conversión de la portada, así que esto se
     vigila. Lo que se mide es el fichero en crudo sin sus <script>,
     que es exactamente lo que ve quien no los ejecuta — no el DOM
     después de pintarlo, que saldría bien aunque el marcado estuviera
     vacío.
     ────────────────────────────────────────────────────────────── */
  di('6 · Con el JavaScript apagado');
  const crudo = fs.readFileSync(path.resolve(__dirname,'equipo.html'),'utf8');
  const PISO = 3000;
  const sinJs = crudo
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const texto = sinJs.replace(/<[^>]+>/g, ' ')
                     .replace(/&[a-z]+;|&#\d+;/gi, 'x')
                     .replace(/\s+/g, ' ').trim();

  texto.length >= PISO
    ? ok('quedan ' + texto.length + ' caracteres de texto (piso ' + PISO + ')')
    : mal('sólo quedan ' + texto.length + ' caracteres: la página volvió a ser un cascarón');

  /* Y QUE SEA LA PÁGINA, no un piso lleno de pie y menú. Se piden
     las frases que hacen el trabajo: el titular, la promesa, y la
     licencia que el entrenador acepta. */
  has(texto, /Tu equipo juega\. Tu programa recauda/, 'el titular está en el marcado');
  has(texto, /prometen unos centavos por cada punto/,  'y la promesa');
  has(texto, /Acepto la licencia por juego/,           'y la licencia que se acepta');
  has(texto, /un m[áa]ximo de \$99 por juego/,         'con su tope');
  has(texto, /Dinos de tu programa/,                   'y el formulario');
  has(texto, /Nombre del EQUIPO/,                      'con el rótulo que decide si funciona');

  /* EL MENÚ, EN ESPAÑOL. Estaba en inglés en el marcado y lo
     traducía el JavaScript, así que sin él la única parte legible
     de la página salía en el idioma equivocado. */
  has(texto, /Inicio/, 'el menú va en español');
  not(texto, /\bHow it works\b|\bSign up a team\b/, 'y no en inglés');

  /* ── Las dos reglas del convenio data-i ──────────────────────────
     Vienen de la portada y las dos se aprendieron a golpes. */
  const claves = [...crudo.matchAll(/data-i="([^"]+)"/g)].map(m => m[1]);
  const phs    = [...crudo.matchAll(/data-ph="([^"]+)"/g)].map(m => m[1]);
  const dicEn  = (crudo.split('en:{')[1] || '').split('\n};')[0];
  const faltan = [...claves, ...phs].filter(k => !new RegExp('\\b'+k+":\\s*'").test(dicEn));
  faltan.length === 0
    ? ok('las ' + (claves.length+phs.length) + ' llaves del marcado tienen inglés')
    : mal('sin inglés: ' + faltan.join(', '));

  /* Ninguna llave dentro de otra llave: draw() recorre los [data-i]
     en orden y le mete innerHTML a cada uno, así que al pintar el
     padre el hijo se va del documento y se pinta desconectado. */
  /* SE MIRA CON EL JAVASCRIPT APAGADO, y eso no es un detalle: con
     él encendido esta comprobación no puede fallar nunca. draw()
     corre al cargar y le mete innerHTML al padre, así que la llave
     anidada ya se fue del documento antes de que nadie la busque —
     el propio fallo borra su prueba. Apagándolo se mira el marcado
     tal y como salió del servidor. */
  const anidada = await (async () => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const pg  = await ctx.newPage();
    await pg.goto(FILE, { waitUntil:'domcontentloaded' });
    const r = await pg.evaluate(() => [...document.querySelectorAll('[data-i] [data-i]')]
      .map(e => e.getAttribute('data-i')));
    await ctx.close();
    return r;
  })();
  anidada.length === 0
    ? ok('ninguna llave se pinta dentro de otra')
    : mal('llaves anidadas: ' + anidada.join(', '));

  /* Y QUE EL ESPAÑOL NO VIVA EN LOS DOS SITIOS. Si una frase del
     marcado reapareciera en S.es, un día dirían cosas distintas y la
     que se leyera sería la del marcado: la otra envejecería sin que
     nadie la viera. Eso ya pasó con el precio en la portada. */
  const dicEs = (crudo.split('es:{')[1] || '').split('\n  },').shift() || '';
  const dobles = claves.filter(k => new RegExp('\\b'+k+":\\s*'").test(dicEs));
  dobles.length === 0
    ? ok('y el español del marcado no está duplicado en el diccionario')
    : mal('en los dos sitios: ' + dobles.join(', '));

  await browser.close();
  console.log('\n' + (fallos === 0 ? '✓ equipo pasa' : '✗ ' + fallos + ' fallo(s)'));
  process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1) });
