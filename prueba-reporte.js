/* ════════════════════════════════════════════════════════════════
   REPORTE — la página

   Es el documento que el programa se lleva, así que lo que importa
   es que los números de la pantalla sean los que devolvió la base, y
   que las dos cifras cuadren: el total de arriba tiene que ser la
   suma de la columna de abajo. Un reporte cuyas dos cifras no
   coinciden no lo vuelve a creer nadie.

   La respuesta de challenge_report() está interceptada con los
   mismos datos que se probaron contra Postgres de verdad, para que
   la página se compruebe contra números ya verificados.
   ════════════════════════════════════════════════════════════════ */
const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, 'reporte.html');

let fallos = 0;
const ok  = (m) => console.log('  ok   ' + m);
const mal = (m) => { fallos++; console.log('  MAL  ' + m); };
const di  = (m) => console.log('\n' + m);
const has = (t,re,q) => re.test(t) ? ok(q) : mal(q + '  (no ' + re + ')');
const not = (t,re,q) => !re.test(t) ? ok(q) : mal(q + '  (apareció ' + re + ')');

/* Lo que devolvió challenge_report() en Postgres 16.15, tal cual. */
const LISTA = { ok:true, by:'John Burgos', challenges:[
  { id:'cccccccc-0000-0000-0000-000000000001', reto:'Reto de octubre',
    campana:'Canóvanas 15U', juego:'fortress', estado:'closed',
    opens_at:'2026-10-10T09:00:00+00:00', closes_at:'2026-10-17T20:00:00+00:00',
    promesas:5 }]};

const REPORTE = { ok:true, campaign:'Canóvanas 15U',
  challenge:{ name:'Reto de octubre', game:'fortress', status:'closed',
              opens_at:'2026-10-10T09:00:00+00:00', closes_at:'2026-10-17T20:00:00+00:00' },
  players:[
    { nombre:'Ana (cuartos)',     puntos:45, cuartos:4, promesas:2, total:24.50 },
    { nombre:'Beto (corrida)',    puntos:36, cuartos:0, promesas:1, total:9.00 },
    { nombre:'Caro (no jugó)',    puntos:0,  cuartos:0, promesas:1, total:0.00 },
    { nombre:'Dani (sacado)',     puntos:0,  cuartos:0, promesas:1, total:0.00 },
    { nombre:'Eva (sin padrinos)',puntos:21, cuartos:0, promesas:0, total:0.00 }],
  pledges:[
    { jugador:'Ana (cuartos)',  padrino:'Abuela',      correo:'abuela@x.invalid',  tarifa:0.10, tope:null, puntos:45, total:4.50 },
    { jugador:'Ana (cuartos)',  padrino:'Tío Orlando', correo:'tio@x.invalid',     tarifa:1.00, tope:20,   puntos:45, total:20.00 },
    { jugador:'Beto (corrida)', padrino:'Vecino',      correo:'vecino@x.invalid',  tarifa:0.25, tope:null, puntos:36, total:9.00 },
    { jugador:'Caro (no jugó)', padrino:'Madrina',     correo:'madrina@x.invalid', tarifa:0.50, tope:null, puntos:0,  total:0.00 },
    { jugador:'Dani (sacado)',  padrino:'Primo',       correo:'primo@x.invalid',   tarifa:0.75, tope:null, puntos:0,  total:0.00 }],
  count:5, pledged:33.50, generated:'2026-10-18T11:52:53-04:00' };

(async () => {
  const browser = await chromium.launch({
    executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
  const page = await browser.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push(String(e).split('\n')[0]));
  page.on('console', m => { if (m.type()==='error') errores.push('console: '+m.text()) });
  await page.route('**/*', r =>
    r.request().url().startsWith('file:') ? r.continue() : r.abort());

  await page.addInitScript(({lista, reporte}) => {
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
      const dato = quién === 'challenge_list'   ? lista
                 : quién === 'challenge_report' ? reporte
                 : { ok:false, error:'rpc inesperada: '+quién };
      return Promise.resolve({ ok:true, status:200, json:()=>Promise.resolve(dato) });
    };
  }, { lista: LISTA, reporte: REPORTE });

  await page.goto(FILE, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(300);

  di('1 · La puerta, y los dos pasos con un botón');
  let visible = await page.evaluate(() => !/hide/.test($('gate').className));
  visible ? ok('pide el código antes de nada') : mal('no pidió el código');
  let botón = await page.evaluate(() => $('tGo').textContent.trim());
  botón === 'Buscar mis retos' ? ok('el botón dice "Buscar mis retos"')
    : mal('el botón dice "' + botón + '"');

  await page.evaluate(() => { $('code').value='CODIGO-BUENO'; seguir() });
  await page.waitForTimeout(300);
  const opciones = await page.evaluate(() =>
    [...document.querySelectorAll('#reto option')].map(o => o.textContent));
  opciones.length === 1 ? ok('la lista trae el reto') : mal('trajo ' + opciones.length);
  has(opciones.join(' '), /Canóvanas 15U · Reto de octubre/, 'con campaña y nombre');
  has(opciones.join(' '), /5 promesas/, 'y cuántas promesas tiene');
  botón = await page.evaluate(() => $('tGo').textContent.trim());
  botón === 'Ver el reporte' ? ok('y el botón cambia a "Ver el reporte"')
    : mal('el botón quedó en "' + botón + '"');

  di('2 · El reporte');
  await page.evaluate(() => seguir());
  await page.waitForTimeout(350);
  const llamadas = await page.evaluate(() => window.__rpc.map(c => c.rpc));
  llamadas.join(',') === 'challenge_list,challenge_report'
    ? ok('llamó challenge_list y después challenge_report')
    : mal('llamó: ' + llamadas.join(','));
  const arg = await page.evaluate(() =>
    window.__rpc.find(c => c.rpc==='challenge_report').body);
  arg.p_code === 'CODIGO-BUENO' && arg.p_challenge === 'cccccccc-0000-0000-0000-000000000001'
    ? ok('con el código y el reto escogido') : mal('con ' + JSON.stringify(arg));

  let txt = await page.evaluate(() => document.body.innerText);
  has(txt, /Reto de octubre/,  'el nombre del reto');
  has(txt, /Canóvanas 15U/,    'la campaña');
  has(txt, /\$33\.50/,         'el total prometido');
  has(txt, /\b5\b/,            'las cinco promesas');
  has(txt, /3\s*\n?\s*JUGARON|jugaron/i, 'cuántos jugaron');
  has(txt, /Lo prometido no es lo recaudado/, 'la nota de prometido vs recaudado');
  has(txt, /Hooporia no sabe quién pagó/, 'y que no sabemos quién pagó');

  di('3 · Que las dos cifras cuadren');
  const nums = await page.evaluate(() => {
    const tablas = [...document.querySelectorAll('#out table')];
    const porJugador = [...tablas[0].querySelectorAll('tbody tr')].map(tr => {
      const td = [...tr.querySelectorAll('td')].map(t => t.textContent.trim());
      return { nombre: td[0], puntos:+td[1], cuartos:+td[2], promesas:+td[3],
               total: parseFloat(td[4].replace('$','')) };
    });
    const promesas = [...tablas[1].querySelectorAll('tbody tr')].map(tr => {
      const td = [...tr.querySelectorAll('td')].map(t => t.textContent.trim());
      return { padrino: td[0], total: parseFloat(td[5].replace('$','')) };
    });
    const pie = tablas[1].querySelector('tfoot td.num').textContent.trim();
    return { porJugador, promesas, pie };
  });

  const sumaJug = nums.porJugador.reduce((a,x) => a + x.total, 0);
  const sumaProm = nums.promesas.reduce((a,x) => a + x.total, 0);
  Math.abs(sumaJug - 33.50) < 0.005
    ? ok('la columna por jugador suma $33.50')
    : mal('la columna por jugador suma ' + sumaJug.toFixed(2));
  Math.abs(sumaProm - 33.50) < 0.005
    ? ok('la columna de promesas suma $33.50')
    : mal('la columna de promesas suma ' + sumaProm.toFixed(2));
  nums.pie === '$33.50' ? ok('y el pie de la tabla dice lo mismo')
    : mal('el pie dice ' + nums.pie);

  di('4 · Los casos que se ven raros pero son correctos');
  const ana = nums.porJugador.find(j => /Ana/.test(j.nombre));
  ana && ana.puntos === 45 && ana.cuartos === 4 && ana.total === 24.50
    ? ok('Ana: 45 puntos en 4 cuartos, $24.50 (una con tope que mordió)')
    : mal('Ana salió ' + JSON.stringify(ana));
  const tio = nums.promesas.find(p => /Tío/.test(p.padrino));
  tio && tio.total === 20
    ? ok('el tope de Tío Orlando baja 45 a $20.00')
    : mal('el tope no mordió: ' + JSON.stringify(tio));
  has(txt, /no jugó/, 'los que no jugaron lo dicen');
  const caro = nums.porJugador.find(j => /Caro/.test(j.nombre));
  caro && caro.promesas === 1 && caro.total === 0
    ? ok('Caro tiene una promesa y $0.00 — no jugó')
    : mal('Caro salió ' + JSON.stringify(caro));
  const eva = nums.porJugador.find(j => /Eva/.test(j.nombre));
  eva && eva.puntos === 21 && eva.promesas === 0
    ? ok('Eva jugó 21 puntos y nadie le prometió')
    : mal('Eva salió ' + JSON.stringify(eva));

  di('5 · Lo que no puede salir');
  not(txt, /cobrad|recaudad[oa]\b(?!.*no)/i, 'nada de cobrado');
  not(txt, /\bpagad[oa]\b|\bpaid\b/i,        'ninguna columna de pagado');
  not(txt, /999|888|777/,                    'ni los números del modelo viejo');
  not(txt, /deducib|impuesto/i,              'ni una palabra de impuestos');
  not(txt, /Cada Punto/,                     'ni el otro producto');

  di('6 · En inglés');
  await page.evaluate(() => toggleLang());
  await page.waitForTimeout(200);
  const en = await page.evaluate(() => document.body.innerText);
  has(en, /The challenge report|Challenge report/i, 'el título');
  has(en, /Pledged is not collected/,  'la nota, traducida');
  has(en, /does not know who paid/,    'y que no sabemos quién pagó');
  has(en, /did not play/,              '"no jugó", traducido');
  has(en, /\$33\.50/,                  'y el total no cambió');

  di('7 · Volver y el CSV');
  await page.evaluate(() => toggleLang());
  await page.waitForTimeout(150);
  const csv = await page.evaluate(() => {
    // Interceptar la descarga para leer lo que se habría bajado.
    let capturado = null, nombre = null;
    const crear = URL.createObjectURL;
    URL.createObjectURL = function(b){ capturado = b; return 'blob:x' };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function(){ nombre = this.download };
    bajarCSV();
    URL.createObjectURL = crear;
    HTMLAnchorElement.prototype.click = click;
    if (!capturado) return { nombre:null, texto:null, bom:null };
    /* Dos lecturas del mismo blob: el texto para el contenido, y los
       primeros bytes para el BOM. text() descodifica UTF-8 y se come
       un BOM inicial por especificación, así que leyendo texto no se
       puede comprobar — hay que mirar EF BB BF a pelo. */
    return Promise.all([
      capturado.text(),
      capturado.slice(0,3).arrayBuffer()
    ]).then(([t, b3]) => ({
      nombre, texto:t,
      bom: Array.from(new Uint8Array(b3))
    }));
  });
  csv.nombre ? ok('baja un fichero: ' + csv.nombre) : mal('no bajó nada');
  if (csv.nombre){
    /[^\x00-\x7F]/.test(csv.nombre) ? mal('el nombre lleva acentos: ' + csv.nombre)
      : ok('sin acentos en el nombre del fichero');
    /^hooporia-/.test(csv.nombre) ? ok('y empieza por hooporia-') : mal('nombre raro');
  }
  if (csv.texto){
    (csv.bom && csv.bom[0]===0xEF && csv.bom[1]===0xBB && csv.bom[2]===0xBF)
      ? ok('lleva el BOM (EF BB BF), para que Excel no rompa los acentos')
      : mal('sin BOM, Excel enseñaría CanÃ³vanas — bytes: ' + JSON.stringify(csv.bom));
    /Tío Orlando/.test(csv.texto) ? ok('los acentos van bien dentro') : mal('acentos mal en el CSV');
    const lineas = csv.texto.split('\r\n').filter(Boolean);
    lineas.length === 7 ? ok('siete líneas: cabecera, cinco promesas y el total')
      : mal(lineas.length + ' líneas: ' + JSON.stringify(lineas.slice(0,2)));
    /33\.50/.test(csv.texto) ? ok('y el total también va en el CSV') : mal('falta el total');
  }

  await page.evaluate(() => volver());
  await page.waitForTimeout(150);
  const vuelta = await page.evaluate(() => ({
    puerta: !/hide/.test($('gate').className),
    salida: /hide/.test($('out').className)
  }));
  vuelta.puerta && vuelta.salida ? ok('"ver otro reto" devuelve la puerta')
    : mal('volver() dejó la pantalla a medias');

  di('8 · Errores de página');
  if (errores.length === 0) ok('ninguno');
  else errores.forEach(e => mal(e));

  await browser.close();
  console.log('\n' + (fallos === 0 ? '✓ el reporte pasa' : '✗ ' + fallos + ' fallo(s)'));
  process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1) });
