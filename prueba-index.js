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
  /* El acordeón de preguntas ya no vive en la portada —se fue entero
     a ayuda.html cuando la página se condensó— así que leer() es
     ahora innerText a secas. Se deja la función porque medio fichero
     la llama, y porque si algún día vuelve algo plegado, aquí es
     donde hay que pegarlo. */
  const leer=()=>p.evaluate(()=>document.body.innerText+'\n'+
    (document.querySelector('.faq')?document.querySelector('.faq').textContent:''));
  let t=await leer();
  has(t,/Juega\. Anota\. Recauda\./,'el titular: los tres verbos');
  has(t,/Juego|juego/,'y habla del juego');
  /* LOS TRES PASOS CAMBIARON DE SUJETO el 26 de octubre de 2026. Eran
     el nene y su corrida de cuatro sets —«Una corrida cada uno», «el
     juego anota cada punto mientras juega», «en la cancha o en su
     casa»— y ahora son el equipo y su juego del calendario. La
     corrida por jugador no desapareció del producto; desapareció de
     la PORTADA, que es lo que esto vigila. */
  has(t,/Los padrinos prometen en el juego/,'quién promete y sobre qué');
  has(t,/por cada punto que anote el equipo/,'por punto del EQUIPO, no de un nene');
  has(t,/El marcador entra en el tablero/,'el marcador entra por el tablero');
  has(t,/Al programa se le paga/,'y al programa se le paga');
  has(t,/Nosotros manejamos las promesas/,'la posición de la casa');
  // .eyebrow va en mayúsculas por CSS, así que innerText la devuelve
  // gritada. La caja la decide la hoja de estilo, no el texto.
  has(t,/Manejo de promesas automatizado/i,'la categoría, arriba');
  has(t,/Ustedes manejan los fondos/,'y la otra mitad');

  /* AQUÍ SE EXIGÍAN TRES FRASES QUE LA PORTADA YA NO DICE, y conviene
     saber cuáles por si alguna hacía falta:

       · «Suena la chicharra. ¿Cuánto anoté?» — el titular viejo, que
         se cambió a propósito por los tres verbos.
       · «Cada ronda vale más que la anterior» y «La ronda nueve vale
         nueve puntos» — cómo escala la puntuación. Eso se fue con la
         condensación y hoy vive en demo.html y en padrinos.html, que
         es donde a alguien le importa el número.
       · «Nada que vender, sin hojas de pedido» — ése NO está en
         ninguna otra parte del sitio. Es la diferencia con la
         recaudación de toda la vida, y hoy la portada no la dice. */

  console.log('\n2 · Las puertas al juego');
  /* EL GIMNASIO DEJÓ DE SER UNA DEMOSTRACIÓN. Decía «Juégalo antes
     de seguir leyendo» —pruébalo para entender lo que vendemos— y
     ahora es lo que de verdad es: entrenamiento gratis entre juegos,
     que es lo que trae de vuelta a un equipo la semana que no juega.
     Se exige que diga GRATIS, porque es la palabra que hace el
     trabajo, y que siga llevando al gimnasio. */
  has(t,/gratis entre juegos/i,'el gimnasio, como entrenador gratis');
  /* QUE NO SE PAGA, dicho donde ahora se dice. Estaba pegado a la
     línea del botón —«Sin inscripción, sin cargo»— y el 26 de
     octubre de 2026 bajó a su propia frase, debajo de las cuatro
     estaciones, porque es lo que decide si alguien entra. */
  has(t,/nada que pagar/,'y que no hay nada que pagar');
  has(t,/Sin cuenta, sin inscripción, sin tarjeta/,'ni puerta que cruzar');

  /* LAS CUATRO ESTACIONES, una por una. Aquí había un botón y una
     línea: lo que hay dentro del gimnasio no se decía en ningún
     sitio de la portada, y es la pieza que trae de vuelta a un
     equipo la semana que no juega. */
  ['The Recall','The Recognition','The Replay','The Fortress']
    .forEach(function(n){ has(t,new RegExp(n),'está '+n) });
  has(t,/En la cancha/i,'y cada una dice a qué se parece en una cancha');
  /* Y que ese parecido siga siendo un PARECIDO. Son juegos de
     memoria y atención: decir que hacen mejor a un jugador sería
     vender algo que nadie ha medido, y es la clase de frase que se
     cuela cuando se reescribe una sección para que luzca. */
  not(t,/te hace mejor|mejora tu juego|mejores jugadores|rendimiento garantizado/i,
      'sin prometer que mejora a nadie');

  /* AQUÍ SE EXIGÍA LA TARJETA DEL SCRIMMAGE y ya no existe: se quitó
     de la portada a propósito. Las dos puertas al juego son ahora la
     del titular y la del paso de la ventana, y las dos van a la
     demo. Al scrimmage se llega desde demo.html al terminar, que es
     cuando tiene sentido querer los cuatro cuartos.

     Lo que sí se sigue exigiendo es que TODA puerta al juego lleve a
     un fichero que exista. Ese es el fallo que importa —un botón a
     una página que no está— y no cuál de los dos tableros se
     enseña. */
  const juegos = await p.evaluate(()=>
    [...document.querySelectorAll('a[href$=".html"]')]
      .map(a=>a.getAttribute('href'))
      .filter(h=>/^(demo|fortress|fortress-vr)\.html/.test(h)));
  const fs2 = require('fs'), pa = require('path');
  /* LA PORTADA YA NO LLEVA A NINGÚN JUEGO DE ESTE SITIO, y desde el
     26 de octubre de 2026 eso es a propósito. El botón de la demo
     era el último que quedaba y se quitó del paso de LA VENTANA.

     Esto exigía lo contrario —que hubiera al menos una puerta, y que
     una de ellas fuera la demo— porque el fallo de verdad era una
     portada que se quedara sin camino al producto sin que nadie lo
     notara. Ahora no hay ninguna, así que lo que se vigila cambia:
     ya no «que haya», sino que lo que haya apunte a un fichero que
     existe, y que la demo siga EN EL REPO aunque nadie la enlace.

     Un fichero que no se enlaza desde ningún sitio es un fichero que
     alguien borra en una limpieza dentro de seis meses. Esta línea
     es lo único que queda diciendo que demo.html tiene que seguir
     ahí. */
  ok('la portada tiene ' + juegos.length + ' puerta(s) a un juego de este sitio');
  for (const h of [...new Set(juegos)]){
    fs2.existsSync(pa.resolve(__dirname, h.split('?')[0]))
      ? ok('el enlace ' + h + ' existe en el repo')
      : mal('el enlace ' + h + ' NO existe');
  }
  fs2.existsSync(pa.join(__dirname, 'demo.html'))
    ? ok('demo.html sigue en el repo, aunque la portada ya no la enlace')
    : mal('falta demo.html');
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
  /* ESTE ARGUMENTO SE DIO LA VUELTA, y conviene saber por qué.

     Decía «No hay cancha que reservar. No hay calendario que cuadrar.
     No hay marcadores que anotar.» Era cierto cuando el evento era
     una corrida de cuatro sets en un teléfono: no hacía falta nada.

     Con promesas por juego, el calendario es justo la pieza que hace
     que esto funcione —son los juegos que el equipo YA tiene— y el
     marcador es lo que cierra la promesa. Negar las dos cosas en la
     portada era tirar por la borda la razón por la que un entrenador
     dice que sí.

     Lo que sobrevive es el titular, que ahora es literal: el juego es
     el evento. */
  /* EL TITULAR DE ESTA SECCIÓN SE FUE EL 26 DE OCTUBRE DE 2026, y
     conviene saber a dónde.

     La sección llevaba «El juego es el evento» y la línea del
     calendario de cuando sólo tenía debajo un botón al gimnasio. Con
     las cuatro estaciones dentro pasó a ser el gimnasio, y ahora se
     titula COGNITIVO GYM.

     Lo que decía NO se perdió, y por eso esto no se borra sino que
     mira donde vive ahora: el rótulo de los tres pasos y la frase
     del precio. Un entrenador tiene que seguir leyendo en la portada
     que no hay nada que montar — es la objeción que trae antes que
     ninguna otra. Si algún día desaparece de ahí también, que lo
     diga una prueba y no un cliente. */
  has(t,/juegos que ya juegas/i,'el calendario ya existe: no hay que montarlo');
  has(t,/juegos de tu calendario/,'y se escoge en cuáles van las promesas');
  not(t,/No hay calendario que cuadrar|No hay marcadores que anotar/,
      'y ya no dice lo contrario de lo que vendemos');
  /* Y que el gimnasio se anuncie como lo que es. */
  has(t,/COGNITIVO GYM/,'la sección del gimnasio lleva su nombre');

  /* La parrilla de seis recuadros se fue con la condensación: «Trae
     su propio evento», «No sólo la plantilla», «un hermano, una mamá,
     un entrenador», «ni temporada». Dos de esas ideas sobreviven
     dentro del precio, que es donde pesan, y se exigen ahí abajo:
     que el precio sea POR EVENTO y no por persona. Las otras dos ya
     no se dicen en ningún sitio de la portada. */

  console.log('\n4 · El precio sale de un número');
  /* El precio y su etiqueta son dos elementos, así que en innerText
     caen en líneas distintas: la regex tiene que cruzar el salto. Con
     /\$49 por equipo por evento/ en una sola línea esto fallaba
     aunque la página lo dijera perfectamente. */
  /* LA ESCALERA SE RETIRÓ ENTERA. Eran seis peldaños por tamaño de
     plantilla —$29 hasta siete nenes, $599 hasta ochocientos, y
     «Hablemos» arriba del todo— y cobraban por evento.

     Ahora hay UN número y se cobra por juego con promesas. La
     plantilla no entra: un equipo de ocho y uno de cuarenta pagan lo
     mismo por el mismo juego. Así que lo que se exige ya no son
     cuatro peldaños sino que el número salga del sitio donde vive, y
     que la plantilla NO aparezca en el cálculo. */
  has(t,/\$5\b/,'el número, a la vista');
  has(t,/Cada juego en el que pongas promesas/,'y qué se paga con él');
  has(t,/sea el juego que sea/,'el mismo precio para cualquier juego');
  not(t,/Plantilla hasta|Plantilla de \d/,'y la escalera por plantilla ya no está');
  not(t,/\$29\b|\$49\b|\$349\b|\$599\b/,'ni ninguno de sus peldaños');
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
  has(v,/\$5\b/,'el 5 se lee con la página como la encuentra cualquiera');
  has(v,/Cinco dólares por juego/,'con su titular, que es el argumento');
  has(v,/Nada por adelantado/,'nada por adelantado');
  has(v,/Se factura por los juegos que llevaron promesas/,'cuándo se factura');
  /* EL MÍNIMO ES DE INSCRIPCIÓN, NO UN CARGO. Un programa se apunta
     con cinco juegos; si sólo consigue promesas en dos, paga dos.
     Decirlo al revés —cobrar cinco hagas lo que hagas— rompería la
     única promesa que esta página hace sobre dinero. */
  has(v,/se inscribe con cinco para empezar/,'el mínimo es con lo que te inscribes');
  not(v,/mínimo de \$|cargo mínimo|se cobran cinco/i,'y en ningún sitio es un cargo mínimo');
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
    /* Que el boton INSCRIBA y que vaya en español, no la palabra
       exacta: "equipo" paso a "programa" el 23 de octubre, porque la
       pagina de alta ya inscribe programas y el boton que lleva a
       ella decia otra cosa. Lo que no puede pasar es que salga en
       ingles con la pagina en español, que es el fallo de verdad. */
    /* El texto pasó a «Inscribir mi equipo» el 26 de octubre de 2026,
       que es lo que dice el botón de marcadorpr del que llega casi
       todo el mundo. Que las dos puertas digan lo mismo es lo que
       hace que alguien sepa que ha llegado al sitio correcto. */
    /^Inscribir mi equipo$/.test(btn.texto)
      ? ok('con su texto en español → '+btn.texto)
      : mal('el botón salió con el texto "'+btn.texto+'"');
  }

  console.log('\n5 · Nada de custodia, nada de impuestos');
  /* Esto lo decían las preguntas del acordeón, que se fueron enteras
     a ayuda.html. La idea sigue en la portada, en la sección de la
     posición y en el pie, y es la que no puede faltar: que el dinero
     no pasa por aquí. Se exige donde está hoy.

     Lo que ya NO dice la portada es «Sin enlace de pago, y sin
     recordatorios». Eso vive en padrinos.html y en ayuda.html. */
  has(t,/estrictamente un proveedor de software de manejo de promesas/,
      'Cada Punto Cuenta es sólo el software de las promesas');
  has(t,/manejan sus fondos de forma independiente/,'y los fondos los manejan ellos');
  has(t,/El dinero no pasa por nosotros/,'y el pie lo dice sin rodeos');
  /* La frase cambió de forma al pasar a promesas por juego: antes era
     «al programa se le paga directo» y ahora el padrino recibe un
     enlace «para pagarle directo al programa». Lo que se vigila es lo
     mismo y es lo único que importa aquí — que el dinero vaya del
     padrino AL PROGRAMA y que la página diga que no pasa por
     nosotros. Es la pareja en español de la línea del inglés. */
  has(t,/pagarle directo al programa/,'el padrino le paga al programa');
  has(t,/El dinero no pasa por nosotros/,'y que no pasa por nosotros');
  not(t,/deducib|deductib|impuesto/i,'ni una palabra de impuestos');
  not(t,/cobrad|recaudad(?!o)/i,'ni cobrado');
  not(t,/facebook|instagram/i,'ni redes');

  console.log('\n6 · El inglés');
  await p.click('#lang'); await p.waitForTimeout(150);
  const en=await leer();
  /* Las mismas frases que en español, una por una. Cada línea de
     arriba tiene su pareja aquí a propósito: un cambio de copy que
     se haga en un idioma y no en el otro es exactamente el fallo que
     esta sección existe para encontrar. */
  /* El titular son los tres verbos y nada más. Llevó la marca
     delante del 25 al 26 de octubre de 2026, mientras la página fue
     Cognitivo Gym; con el nombre de vuelta sobra, porque el rótulo
     que va justo encima ya dice Cada Punto Cuenta y repetirlo dos
     renglones seguidos no añade nada. */
  has(en,/Play\. Score\. Raise Money\./,'el titular: los tres verbos');
  not(en,/Cognitivo Gym\. Play/,'y no se quedó con la marca de la casa delante');
  has(en,/Automated pledge management/i,'the category line');
  /* La pareja en inglés del cambio de arriba: el titular se fue a
     COGNITIVO GYM y lo que decía vive en los tres pasos y el precio. */
  has(en,/games you already play/i,'the calendar is already there');
  has(en,/games on your schedule/,'and you pick which carry pledges');
  has(en,/COGNITIVO GYM/,'the gym section is named');
  not(en,/No gym to book|No schedule to coordinate/,'and it no longer denies it');
  has(en,/Padrinos pledge on the game/,'who pledges, and on what');
  has(en,/every point the team scores/,'per point the TEAM scores');
  has(en,/\$5\b/,'the number');
  has(en,/Each game you put pledges on/,'and what it buys');
  not(en,/Roster up to|Roster of \d/,'the roster ladder is gone');
  not(en,/\$29\b|\$49\b|\$349\b|\$599\b/,'and so are its steps');
  has(en,/strictly a pledge management software provider/i,'only the pledge software');
  has(en,/independently manage all proceeds/i,'and they hold the proceeds');
  has(en,/The money does not pass through us/,'and the footer says it plainly');
  has(en,/pay the program directly/,'the padrino pays the program');
  has(en,/never passes through us/,'and it never passes through us');
  const ven = await aLaVista();
  has(ven,/\$5\b/,'the price reads in English too, nothing to open');
  has(ven,/Five dollars a game/,'with its heading');
  has(ven,/signs up for five to start/,'the five is what you sign up with');
  has(ven,/Nothing up front/,'and nothing up front');
  has(ven,/No pledges, no fee/,'the promise, in English');
  has(await p.$eval('#precio a.button', e=>e.textContent.trim()),
      /^Sign up my team$/, 'and the button says it in English too');
  has(ven,/records no pledges is never invoiced/,'and what it means');
  not(ven,/out of what you raise|once you have been paid/i,
      'and nowhere does it say the fee comes out of what was raised');
  not(en,/\{A\}|\{B\}|\{N\}/,'sin plantillas');
  not(en,/\bdeductible\b|\btax\b/i,'ni impuestos');
  const ti=await p.title();
  has(ti,/Every point is recorded\./,'el título, en inglés');
  /* Esta línea miraba al revés: guardaba que no se colara «Every
     point counts», el nombre del otro producto. Ese nombre es el
     nuestro desde el 22 de octubre de 2026. Lo que no puede quedarse
     en el título es el retirado. */
  not(ti,/Hooporia/i,'el título no se quedó con el nombre retirado');

  console.log('\n7 · Los enlaces');
  const hrefs=await p.evaluate(()=>[...document.querySelectorAll('a')].map(a=>a.getAttribute('href')));
  for(const h of ['equipo.html','mi-equipo.html','ayuda.html','cobro.html','terms.html','privacy.html','custodia.html'])
    hrefs.includes(h)?ok('a '+h):mal('falta '+h);
  hrefs.some(h=>/cadapunto|cognitivo\.digital|prometer\.html/.test(h||''))?mal('enlaza fuera del producto'):ok('no enlaza a Cada Punto');
  /* El botón de la cabecera sale a propósito, y es el único que
     sale: el hub de los juegos vive en el gimnasio móvil. Va en
     absoluto porque es otro dominio, así que la comprobación mira
     la dirección entera y no un trozo. */
  /* Y CON SU COLA. ?e=demo es lo que mete al que entra por aquí en el
     equipo abierto. El equipo se fija al emitir el código y no cambia
     después, así que sin la cola todo el que entrara por la portada
     jugaría solo para siempre — y el tablero no tiene cómo decírselo.
     Por eso se comprueba la dirección entera y no sólo el fichero. */
  hrefs.some(h=>h==='https://hooporia.mobi/fortress-mobile-hub.html?e=demo')
    ?ok('y la cabecera entra al gimnasio, con equipo')
    :mal('la cabecera ya no entra al gimnasio con su equipo');

  /* ── Las dos listas de llaves, una contra la otra ────────────────
     El inglés se recoge del MARCADO y el español vive en la tabla,
     así que las dos listas tienen que ser la misma lista. Las dos
     formas de que se separen hacen daño distinto:

       · una llave en el marcado SIN español deja ese trozo en inglés
         para el que lee en español, sin dar ningún error;
       · una llave en la tabla SIN marcado es texto muerto — había 31
         (la parrilla de seis recuadros, el acordeón de preguntas y
         las tarjetas viejas de jugar), sobrevividas a dos
         condensaciones de la portada, y nadie lo iba a notar nunca
         porque una traducción de más no rompe nada. */
  console.log('\n7a · Ninguna llave dentro de otra llave');
  {
    /* paint() recorre todos los [data-i] en orden del documento y le
       mete innerHTML a cada uno. Si una llave vive DENTRO de otra, al
       pintar el padre el hijo se va del documento, y cuando el
       recorrido llega al hijo ya está desconectado: su texto existe
       en las dos tablas y no se lee en ninguna de las dos.

       Pasó el 26 de octubre de 2026 con la frase que dice que el
       gimnasio no se paga, metida en un span dentro del <p> de la
       frase de arriba. Se perdía entera y en los dos idiomas, y no
       había nada que lo dijera: las dos tablas la tenían, las llaves
       cuadraban, y la página sencillamente no la enseñaba. */
    const anidadas = await p.evaluate(() =>
      [...document.querySelectorAll('[data-i] [data-i]')].map((el) => {
        const padre = el.parentElement.closest('[data-i]');
        return (padre ? padre.dataset.i : '?') + ' › ' + el.dataset.i;
      }));
    anidadas.length === 0
      ? ok('ninguna llave se pinta dentro de otra')
      : anidadas.forEach((x) => mal('llave anidada, se va a perder al pintar: ' + x));
  }

  console.log('\n7b · Las llaves del marcado y las de la tabla, iguales');
  const llaves = await p.evaluate(()=>{
    const marcado=[...new Set([...document.querySelectorAll('[data-i]')]
      .map(e=>e.dataset.i))];
    return { marcado };
  });
  const fuenteIdx = fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  const _i = fuenteIdx.indexOf('const translations');
  const _j = fuenteIdx.indexOf('\n};', _i);
  const TAB = new Function('return '+fuenteIdx.slice(fuenteIdx.indexOf('{',_i), _j+2))();
  const sinEs = llaves.marcado.filter(k=>!(k in TAB.es));
  /* Una llave está VIVA si tiene un elemento con data-i... o si el
     JS le pone el inglés a mano. La escalera del precio la pinta el
     JS desde TARIFAS, así que sus cinco frases no cuelgan de ningún
     elemento del marcado y aquí salían como texto muerto cuando no
     lo son. Se cuentan las dos formas. */
  const aMano = [...fuenteIdx.matchAll(/english\.([A-Za-z0-9_]+)\s*=/g)].map(m=>m[1]);
  const vivas = new Set([...llaves.marcado, ...aMano]);
  const muertas = Object.keys(TAB.es).filter(k=>!vivas.has(k));
  sinEs.length===0
    ? ok('las '+llaves.marcado.length+' llaves del marcado tienen español (y '+aMano.length+' más las pone el JS)')
    : mal('sin español: '+sinEs.join(', '));
  muertas.length===0
    ? ok('y la tabla no lleva ninguna de más')
    : mal('texto muerto en la tabla: '+muertas.join(', '));

  console.log('\n8 · La piel y los errores');
  const src=await p.content();
  has(src,/--orange:#ff7a18/,'el naranja');
  has(src,/--cream:#faf8f4/,'la crema');
  /* Antes esto exigía lo contrario: que NADIE apuntara a logo.png
     ni a la imagen de compartir, porque no existían y un <link> a un
     fichero que no está es un 404 en cada carga. Ya existen, así que
     ahora se exige que estén puestas. La comprobación de que los
     ficheros existen de verdad vive en prueba-marca.js, que mira
     todas las páginas y no sólo ésta. */
  has(src,/<link[^>]+rel="icon"[^>]+href="logo\.png"/,'el icono de la pestaña');
  has(src,/og:image"[^>]+content="https:\/\/cadapunto\.com\/compartir\.jpg"/,
      'la imagen de compartir, en absoluto');
  errs.length?errs.forEach(e=>mal(e)):ok('sin errores de página');

  await b.close();
  console.log('\n'+(bad===0?'✓ el índice de Cada Punto Cuenta pasa':'✗ '+bad+' fallo(s)'));
  process.exit(bad===0?0:1);
})().catch(e=>{console.error(e);process.exit(1)});
