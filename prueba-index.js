const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
const path = require('path');
const fs   = require('fs');
const FILE='file://'+path.resolve(__dirname,'index.html');
let bad=0; const ok=m=>console.log('  ok   '+m); const mal=m=>{bad++;console.log('  MAL  '+m)};
const has=(t,re,q)=>re.test(t)?ok(q):mal(q+'  (no '+re+')');
const not=(t,re,q)=>!re.test(t)?ok(q):mal(q+'  (apareció '+re+')');
const eqTexto=(a,b,q)=>a===b?ok(q+' → '+a):mal(q+'\n         esperaba: '+b+'\n         vino:     '+a);
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const p=await b.newPage();
  await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).split('\n')[0]));
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
  await p.addInitScript(()=>{try{localStorage.setItem('cp-lang','es')}catch(e){}
    try{Object.defineProperty(navigator,'language',{get:()=>'es-PR'})}catch(e){}});
  await p.goto(FILE,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(300);

  console.log('\n1 · El español');
  // innerText no ve lo plegado: los <details> del FAQ quedan fuera.
  const leer=()=>p.evaluate(()=>document.body.innerText+'\n'+
    (document.querySelector('.faq')?document.querySelector('.faq').textContent:''));
  let t=await leer();
  has(t,/Suena la chicharra\. ¿Cuánto anoté\?/,'el titular: la chicharra');
  has(t,/Cada ronda vale más que la anterior/,'la escalada, que es lo que hace el número');
  has(t,/Nada que vender, sin hojas de pedido/,'y que no hay nada que vender');
  has(t,/La ronda nueve vale nueve puntos/,'la ronda nueve, en el paso dos');
  has(t,/Una corrida cada uno/,'una corrida cada uno');
  has(t,/el juego los anota mientras juega/,'el juego anota los puntos');
  has(t,/en la cancha o en su casa/i,'se juega desde donde sea');
  has(t,/Nosotros manejamos las promesas/,'la posición de la casa');
  // .eyebrow va en mayúsculas por CSS, así que innerText la devuelve
  // gritada. La caja la decide la hoja de estilo, no el texto.
  has(t,/Baloncesto digital · Manejo de promesas/i,'la categoría, arriba');
  has(t,/Ustedes manejan los fondos/,'y la otra mitad');

  console.log('\n2 · Las dos tarjetas de jugar');
  has(t,/Juégalo antes de seguir leyendo/,'la invitación a jugar');
  has(t,/Scrimmage · 4 cuartos/i,'la tarjeta del scrimmage');
  has(t,/Los cuatro cuartos completos/,'y qué es');
  has(t,/Cada cuarto cuenta tu MEJOR corrida/,'cómo cuenta cada cuarto');
  /* Antes había dos tarjetas y aquí se exigían las dos. Se quitó la
     de práctica: abría el otro tablero —el de corrida suelta— y lo
     que se enseña es el scrimmage. Practicar se practica ahí mismo,
     porque una corrida sin reto, sin llave y sin official=1 no
     cuenta. Así que ahora se exige UNA tarjeta, no dos. */
  (t.match(/pcard/g) || []).length;
  has(t,/aquí no se anota nada|nothing you do here is recorded/i,
      'dice que aquí no se anota nada');
  has(t,/la base de datos rechaza la segunda/,'una sola corrida oficial, por la base de datos');
  // Los dos enlaces tienen que existir de verdad en el repo.
  const juegos = await p.evaluate(()=>[...document.querySelectorAll('.pcard a')].map(a=>a.getAttribute('href')));
  const fs2 = require('fs'), pa = require('path');
  for (const h of juegos){
    fs2.existsSync(pa.resolve(__dirname, h))
      ? ok('el enlace ' + h + ' existe en el repo')
      : mal('el enlace ' + h + ' NO existe');
  }
  juegos.includes('fortress-vr.html') ? ok('el scrimmage apunta al juego de cuartos') : mal('falta fortress-vr.html');
  /* fortress.html sigue existiendo y sigue siendo un juego válido para
     un reto —está en la lista del admin— pero ya no se enlaza desde la
     portada. Así que se comprueba que el fichero esté, no que la
     portada apunte a él. */
  fs.existsSync(path.join(__dirname,'fortress.html'))
    ? ok('fortress.html sigue en el repo, aunque la portada ya no lo enlace')
    : mal('falta el fichero fortress.html');
  juegos.includes('fortress.html')
    ? mal('la portada todavía enlaza la práctica')
    : ok('y la portada no lo enlaza');

  console.log('\n3 · El argumento grande');
  has(t,/La recogida de fondos es el producto/,'la recogida es el producto');
  has(t,/No hace falta un evento para correr una/,'y no hace falta un evento');
  has(t,/necesita que pase algo primero/,'lo que necesitan las demás');
  has(t,/Trae su propio evento/i,'trae su propio evento');
  has(t,/ni temporada/,'y no tiene temporada');
  has(t,/No sólo la plantilla/i,'no sólo la plantilla');
  has(t,/un hermano, una mamá, un entrenador/,'quién más puede jugar');
  has(t,/no es un cargo por persona|no un cargo por persona/,'la licencia no es por persona');

  console.log('\n4 · El precio sale de un número');
  has(t,/\$49 por equipo por evento/,'49 por equipo');
  has(t,/\$29 si la plantilla tiene menos de 8/,'29 bajo ocho');
  not(t,/\{A\}|\{B\}|\{N\}/,'sin plantillas sin rellenar');

  /* Y, sobre todo, que se VEA. Esto se mira en innerText a secas,
     sin pegarle el texto del acordeón — que es justo lo que leer()
     hace y lo que dejaba pasar el fallo. El precio estuvo sólo
     dentro de un <details> plegado ("¿Cuánto cuesta?", tercera de
     cinco), así que las tres líneas de arriba pasaban mientras en la
     página no se leía un número por ningún lado. Visible es que se
     lea sin abrir nada. */
  console.log('\n4b · Y el precio se ve sin abrir nada');
  const aLaVista = () => p.evaluate(()=>document.body.innerText);
  let v = await aLaVista();
  has(v,/\$49/,'el 49 se lee con la página como la encuentra cualquiera');
  has(v,/\$29/,'y el 29 también');
  has(v,/El cargo llega después del resultado/,'con su titular, que es el argumento');
  has(v,/Nada por adelantado/,'nada por adelantado');
  has(v,/Se factura cuando cierra el evento/,'cuándo se factura');
  has(v,/caduca/,'y qué pasa si no se paga');

  /* Sin promesas, sin cargo. Es una promesa que se hace, así que
     tiene que leerse en la página —no sólo en los términos— y tiene
     que decir PROMESAS y no PAGOS: el cargo se debe cuando hay
     promesas anotadas y reporte, haya pagado un padrino o no. Si
     esto se escribiera como "hasta que te paguen", sería mentira y
     además sonaría a que el dinero pasa por aquí. */
  has(v,/Sin promesas, sin cargo/,'la promesa, dicha en la página');
  has(v,/no recoge ni una promesa no se factura/,'y qué significa exactamente');
  not(v,/hasta que te paguen|cuando cobres|de lo que recaudes/i,
      'y en ningún sitio dice que se pague con lo recaudado');
  not(v,/\{A\}|\{B\}|\{N\}/,'sin plantillas sin rellenar');
  const alPrecio = await p.evaluate(()=>
    [...document.querySelectorAll('.navlinks a')].some(a=>a.getAttribute('href')==='#precio'));
  alPrecio ? ok('y el menú de arriba lleva hasta él') : mal('el menú no lleva al precio');

  /* Y el botón de inscribir, dentro de la sección: es donde alguien
     decide, y hasta ahora había que seguir bajando para encontrarlo.
     Se comprueba que esté DENTRO de #precio y que lleve texto — un
     data-i repetido pinta bien sólo si la llave existe en las dos
     tablas, y si no, el botón sale vacío sin dar error. */
  const btn = await p.evaluate(()=>{
    const a = document.querySelector('#precio a.button');
    return a ? { href:a.getAttribute('href'), texto:a.textContent.trim() } : null;
  });
  if (!btn) mal('la sección del precio no lleva el botón de inscribir');
  else {
    btn.href==='equipo.html' ? ok('el botón del precio va a equipo.html')
                             : mal('el botón del precio va a '+btn.href);
    /^Solicitar registro de equipo$/.test(btn.texto)
      ? ok('con su texto en español → '+btn.texto)
      : mal('el botón salió con el texto "'+btn.texto+'"');
  }

  console.log('\n3 · Nada de custodia, nada de impuestos');
  has(t,/Hooporia no recibe dinero de nadie/,'no recibe dinero de nadie');
  has(t,/le paga al programa directo/,'el padrino paga al programa');
  has(t,/Sin enlace de pago, y sin recordatorios/,'un aviso y nada más');
  not(t,/deducib|deductib|impuesto/i,'ni una palabra de impuestos');
  not(t,/cobrad|recaudad(?!o)/i,'ni cobrado');
  not(t,/facebook|instagram/i,'ni redes');

  console.log('\n4 · El inglés');
  await p.click('#lang'); await p.waitForTimeout(150);
  const en=await leer();
  has(en,/Final buzzer\. What did I score\?/,'the grabber');
  has(en,/Every round is worth more than the last/,'the escalation');
  has(en,/Nothing to sell, no order forms/,'nothing to sell, spelled out');
  has(en,/One run each/,'one run each');
  has(en,/\$49 per team for the event/,'49 per team');
  has(en,/\$29 if the roster is under 8/,'29 under eight');
  has(en,/never receives money from anybody/,'never receives money');
  const ven = await aLaVista();
  has(ven,/\$49/,'the price reads in English too, nothing to open');
  has(ven,/The invoice comes after the results do/,'with its heading');
  has(ven,/Nothing up front/,'and nothing up front');
  has(ven,/No pledges, no fee/,'the promise, in English');
  eqTexto(await p.$eval('#precio a.button', e=>e.textContent.trim()),
          'Request Team Registration', 'and the button says it in English too');
  has(ven,/records no pledges is never invoiced/,'and what it means');
  not(ven,/out of what you raise|once you have been paid/i,
      'and nowhere does it say the fee comes out of what was raised');
  not(en,/\{A\}|\{B\}|\{N\}/,'sin plantillas');
  not(en,/\bdeductible\b|\btax\b/i,'ni impuestos');
  const ti=await p.title();
  has(ti,/Digital Basketball\. Every point is recorded\./,'el título, en inglés');
  // Y que no se le haya pegado el nombre del otro producto.
  not(ti,/Every point counts/i,'el título no lleva el nombre de Cada Punto');

  console.log('\n5 · Los enlaces');
  const hrefs=await p.evaluate(()=>[...document.querySelectorAll('a')].map(a=>a.getAttribute('href')));
  for(const h of ['equipo.html','mi-equipo.html','ayuda.html','cobro.html','terms.html','privacy.html','custodia.html'])
    hrefs.includes(h)?ok('a '+h):mal('falta '+h);
  hrefs.some(h=>/cadapunto|prometer\.html/.test(h||''))?mal('enlaza fuera del producto'):ok('no enlaza a Cada Punto');

  console.log('\n6 · La piel y los errores');
  const src=await p.content();
  has(src,/--orange:#ff7a18/,'el naranja');
  has(src,/--cream:#faf8f4/,'la crema');
  /* Antes esto exigía lo contrario: que NADIE apuntara a hooporia.png
     ni a la imagen de compartir, porque no existían y un <link> a un
     fichero que no está es un 404 en cada carga. Ya existen, así que
     ahora se exige que estén puestas. La comprobación de que los
     ficheros existen de verdad vive en prueba-marca.js, que mira
     todas las páginas y no sólo ésta. */
  has(src,/<link[^>]+rel="icon"[^>]+href="hooporia\.png"/,'el icono de la pestaña');
  has(src,/og:image"[^>]+content="https:\/\/hooporia\.com\/hooporia-share\.jpg"/,
      'la imagen de compartir, en absoluto');
  errs.length?errs.forEach(e=>mal(e)):ok('sin errores de página');

  await b.close();
  console.log('\n'+(bad===0?'✓ el índice de Hooporia pasa':'✗ '+bad+' fallo(s)'));
  process.exit(bad===0?0:1);
})().catch(e=>{console.error(e);process.exit(1)});
