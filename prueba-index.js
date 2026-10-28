const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
const path = require('path');
const fs   = require('fs');
const FILE='file://'+path.resolve(__dirname,'index.html');
let bad=0; const ok=m=>console.log('  ok   '+m); const mal=m=>{bad++;console.log('  MAL  '+m)};
/* EL TEXTO SE LEE SIN MAYÚSCULAS.

   Media página va en versalitas por CSS —rótulos, ojos, etiquetas del
   tablero— y innerText las devuelve gritadas. Cuatro comprobaciones
   han fallado ya por eso, todas por una frase que la página decía
   perfectamente.

   Así que has() y not() no distinguen mayúsculas, y punto. Ninguna
   comprobación de esta prueba depende de la caja de una letra: la
   caja la decide la hoja de estilo, no el texto. */
const ci = re => new RegExp(re.source, re.flags.includes('i') ? re.flags : re.flags + 'i');
const has=(t,re,q)=>ci(re).test(t)?ok(q):mal(q+'  (no '+re+')');
const not=(t,re,q)=>!ci(re).test(t)?ok(q):mal(q+'  (apareció '+re+')');
const eqTexto=(a,b,q)=>a===b?ok(q+' → '+a):mal(q+'\n         esperaba: '+b+'\n         vino:     '+a);
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const p=await b.newPage();
  await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).split('\n')[0]));
  /* Esta prueba corta TODO lo que no sea file:, que es lo correcto —
     una prueba no sale a la red. La portada pide la tipografía a
     fonts.googleapis.com, así que ese corte deja un error de
     consola que es de la prueba y no de la página. Se ignora ése y
     sólo ése: cualquier otro sigue siendo un fallo. */
  p.on('console',m=>{
    if(m.type()!=='error')return;
    if(/Failed to load resource/.test(m.text()))return;
    errs.push('console: '+m.text());
  });
  await p.addInitScript(()=>{try{localStorage.setItem('cp-lang','es')}catch(e){}
    try{Object.defineProperty(navigator,'language',{get:()=>'es-PR'})}catch(e){}});
  await p.goto(FILE,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(300);

  /* ── Un ayudante que sabe leer una negación ──────────────────────
     Tres veces en dos días una comprobación ha fallado porque la
     página decía bien lo que tenía que decir. «No nos llevamos un por
     ciento de lo que recaudes» casa con /de lo que recaudes/ y es
     exactamente lo contrario de lo que esa regex busca.

     niega() mira lo que hay DELANTE de cada aparición: si en los
     ochenta caracteres anteriores hay una negación, esa aparición no
     cuenta como afirmación. */
  const AFIRMA = (t, re) => {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    for (const m of t.matchAll(g)) {
      const antes = t.slice(Math.max(0, m.index - 80), m.index);
      if (!/\b(no|not|never|ni|nunca|ningún|ninguna|sin|don't|do not|does not)\b/i.test(antes))
        return true;
    }
    return false;
  };
  const noAfirma = (t, re, q) => AFIRMA(t, re) ? mal(q + '  (lo afirma: ' + re + ')') : ok(q);

  console.log('\n1 · El español');
  const leer=()=>p.evaluate(()=>document.body.innerText);
  let t=await leer();

  /* EL TITULAR ES EL ARGUMENTO. Ganes o pierdas, el marcador de TU
     equipo recauda: el que pierde también cobra, y eso es lo que
     ningún otro recaudador deportivo puede decir. */
  has(t,/Ganes o pierdas/,'el titular: ganes o pierdas');
  has(t,/tu marcador es la recaudación/,'y que el marcador ES la recaudación');

  /* LOS DOS EQUIPOS, EN EL TABLERO. Si algún día se queda sólo el que
     gana, el argumento se cae sin que nadie lo note: la página
     seguiría leyéndose perfectamente. */
  has(t,/Canóvanas/,'el tablero enseña al que ganó');
  has(t,/Arecibo/,'y al que perdió');
  has(t,/\$816\.00/,'con lo que recaudó el primero');
  has(t,/\$732\.00/,'y lo que recaudó el segundo');
  has(t,/Los dos programas llevan promesas/,'y lo dice con todas las letras');

  /* LO PROMETIDO NO ES LO RECAUDADO, en la portada y no sólo en las
     páginas de detrás.

     La portada enseñaba $816.00 en naranja sin decir ni una vez que
     es una promesa. Un entrenador lo multiplica por diez juegos y
     espera que entren $8,160; lo que entre depende de su cobro. La
     frase estaba en ayuda, equipo y reporte — las tres por detrás de
     la única página que lee todo el mundo.

     Y se vigila que el número grande no vuelva a quedarse solo: ésta
     es la línea que impide que la página prometa algo que no puede
     cumplir. */
  has(t,/Prometido no es cobrado/,'lo prometido no es lo cobrado, dicho en la portada');
  has(t,/depende de tu cobro/,'y de quién depende lo que entre');
  has(t,/Prometido sobre los 68/,'y la cifra del tablero se etiqueta como promesa');
  not(t,/Los dos programas recaudan/,'y ya no dice que los dos recaudan, que suena a cobrado');
  has(t,/no la recaudación/,'perder cuesta puntos, no la recaudación');

  /* Y QUE ES UN EJEMPLO. Un marcador con un dólar delante se lee como
     un resultado si no se le dice lo contrario, y aquí nadie
     prometió nada. */
  /* En versalitas por CSS, así que innerText la devuelve gritada.
     La caja la decide la hoja de estilo, no el texto. */
  has(t,/Ejemplo/i,'el tablero se marca como ejemplo');
  has(t,/no un resultado/,'y dice que no es un resultado');

  console.log('\n2 · Los cuatro pasos y el calendario');
  has(t,/Promete\. Juega\. Anota\. Cobra\./,'los cuatro pasos');
  has(t,/por cada punto que anota tu equipo/,'por punto del EQUIPO, no de un nene');
  /* LA RECAUDACIÓN ES POR JUEGO, Y EL TORNEO ES LO DE MÁS.
     Esto exigía «el tablero que tu torneo ya usa», que daba por hecho
     que el entrenador tiene un torneo — mientras la portada, cuatro
     pantallas más arriba, le decía que no necesita ninguno. Las dos
     cosas no podían ser verdad a la vez.

     Ahora se vigila el orden correcto: la recaudación corre sobre
     marcador juego a juego, y el torneo es lo que el mismo tablero
     sabe hacer ADEMÁS. Si algún día vuelve a darse la vuelta, la
     portada vuelve a contradecirse sola. */
  has(t,/corre sobre marcadorpr, juego\s+a juego/,'la recaudación corre sobre marcador, juego a juego');
  has(t,/la recaudación siempre va juego por juego/,'y se dice que siempre va juego por juego');
  has(t,/el mismo tablero te arma un torneo/,'el torneo lo arma el mismo tablero');
  has(t,/Eso es lo de más/,'y queda dicho que el torneo es lo de más, no el precio de entrada');
  not(t,/el tablero que tu torneo ya usa/,'y ya no da por hecho que tengas un torneo');
  /* UN AVISO, NO UN ENLACE DE PAGO.

     La portada prometía «un enlace para pagarle directo a tu
     programa» mientras custodia.html —la divulgación que lee una
     escuela antes de firmar— dice desde antes «un aviso, y nada más:
     sin enlace de pago y sin recordatorios». Las dos estaban vivas
     diciendo cosas distintas sobre lo que recibe un padrino.

     Manda custodia. Esto vigila que la portada no vuelva a prometer
     un enlace de pago ni recordatorios que el producto no manda. */
  has(t,/un aviso con el marcador final/,'el padrino recibe un aviso');
  has(t,/Sin enlace de pago y sin recordatorios/,'y se dice que no lleva enlace de pago');
  not(t,/enlace para pagar/,'y la portada ya no promete uno');

  /* MARCADOR ES LA OTRA MITAD, y la portada tiene que decirlo: es lo
     que hace que esto no sea un recaudador más. */
  has(t,/marcadorpr/,'marcadorpr sale nombrado');
  has(t,/El cuadro se llena solo/,'y que el cuadro se llena solo');
  has(t,/Nadie escribe un número dos veces/,'y que el marcador no se escribe dos veces');
  has(t,/cómo recaudar/,'un equipo sin campaña ve cómo conseguirla');

  console.log('\n3 · La cuenta, y que los dos equipos salen');
  has(t,/Sesenta y ocho puntos/,'la cuenta va sobre el juego del tablero');
  has(t,/48/,'con los padrinos que la montan');
  has(t,/que lo perdió/,'y el que perdió sale en la misma cuenta');
  has(t,/no se ha movido un peso/,'y se dice que no es una promesa');

  /* ── SIN TOPE DE PADRINOS ────────────────────────────────────────
     La escalera termina en cuarenta y ocho y cuarenta y ocho acababa
     leyéndose como la respuesta. La sección del tope enseña el MISMO
     juego con tres cantidades de padrinos, y sus números no se
     escriben a mano: salen de 68 puntos × 25¢ × padrinos.

     Se calculan aquí a partir de TARIFAS y de la cuenta, y no se
     copian del marcado, porque una tabla que se queda vieja cuando
     alguien toca el precio es exactamente el fallo que esto existe
     para encontrar: la página seguiría leyéndose perfecta. */
  has(t,/no es un techo|no un techo/,'cuatro por jugador es un ejemplo, no un techo');
  has(t,/Nadie pone un límite/,'y se dice que nadie pone un límite');
  has(t,/un tío en Orlando|una prima en Nueva York/,'y que el padrino no tiene que ser del pueblo');
  {
    const PUNTOS = 68, CENTAVOS = 0.25;
    /* La escalera se lee del propio index.html, igual que hace
       prueba-precio.js: así estas tres filas no pueden quedarse
       viejas cuando alguien toque el precio. */
    const _src = fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
    const _mt  = _src.indexOf('const TARIFAS = [');
    const TAR  = new Function('return ' +
      _src.slice(_src.indexOf('[', _mt), _src.indexOf('];', _mt) + 1))();
    const escalon = n => { for (const p of TAR)
                             if (p.hasta !== null && n <= p.hasta) return p.precio;
                           return null; };
    const dinero = n => '$' + (n * PUNTOS * CENTAVOS)
                          .toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    let bien = true;
    for (const n of [12, 48, 120]){
      const esperado = dinero(n), lic = '$' + escalon(n);
      if (!ci(new RegExp(esperado.replace(/[$.]/g,'\\$&'))).test(t)){
        mal('faltan los ' + esperado + ' de ' + n + ' padrinos'); bien = false;
      }
      if (!ci(new RegExp('\\' + lic + '\\b')).test(t)){
        mal('falta la licencia ' + lic + ' del tramo de ' + n); bien = false;
      }
    }
    if (bien) ok('las tres filas del tope cuadran con la cuenta y con la escalera');
  }
  has(t,/la licencia no te persigue/,'y se dice que la licencia sube por tramos y se para');

  /* ── NADIE «DEBE» NADA ───────────────────────────────────────────
     La portada decía tres veces que no se debe nada y una que le
     mandamos al padrino «un aviso de lo que le debe a tu programa».
     Todas eran verdad y todas suenan a factura: el padrino no está
     firmando una deuda, está diciendo que si el equipo juega él pone
     unos centavos por punto.

     Se vigila la palabra, no la idea: la idea se sigue contando
     entera —la promesa sólo cuenta cuando se juega, y al padrino le
     llega su total y a quién se lo entrega—, sólo que por el lado
     que no asusta. Es la clase de palabra que vuelve sola al
     reescribir un párrafo. */
  not(t,/\bse debe\b|\ble debe\b|\bdeben\b|\bdeuda\b|\bdeudor/,
      'no se le dice a nadie que debe nada');

  console.log('\n4 · El precio sale de la escalera');
  /* La escalera, por PROMESAS del juego. Se exigen los dos extremos:
     los de en medio los comprueba prueba-precio.js, que además mira
     que las otras seis páginas digan lo mismo. */
  has(t,/Hasta 10 promesas/,'el peldaño de abajo');
  has(t,/201 promesas o más/,'y el de arriba, abierto');
  has(t,/Hablemos/,'que no lleva número: se habla');
  has(t,/y nada más/,'y que lo fija cuántas promesas, nada más');
  has(t,/Sin promesas, sin cargo/,'la promesa que se hace sobre el cargo');
  has(t,/cinco juegos para empezar/,'y con cuántos juegos se inscribe uno');
  not(t,/\{[A-Z]\}/,'sin plantillas sin rellenar');

  const n=await p.evaluate(()=>document.querySelectorAll('.peldano').length);
  n===6?ok('la escalera se pintó entera: '+n+' peldaños'):mal('salieron '+n+' peldaños');

  console.log('\n5 · Nada de custodia, nada de impuestos');
  has(t,/El dinero .*no pasa por nosotros/s,'el dinero no pasa por nosotros');
  has(t,/estrictamente un proveedor de software/,'la frase legal, que sostiene lo demás');
  has(t,/manejan sus fondos de forma independiente/,'y quién maneja los fondos');
  has(t,/No procesamos pagos/,'no procesamos pagos');
  has(t,/no les cobramos absolutamente nada/,'y al padrino no se le cobra nada');

  /* Y QUE NO SE DIGA LO CONTRARIO. Con niega(): la página dice «no
     nos llevamos un por ciento de lo que recaudes», que casa con la
     regex y es justo lo que queremos que diga. */
  noAfirma(t,/hasta que te paguen|cuando cobres|de lo que recaudes/i,
     'en ningún sitio dice que el cargo salga de lo recaudado');
  noAfirma(t,/deducib/i,'ni promete ninguna deducción');

  console.log('\n6 · El inglés');
  await p.click('#lang'); await p.waitForTimeout(200);
  const en=await leer();
  /* Cada línea de arriba tiene su pareja aquí a propósito: un cambio
     de copy en un idioma y no en el otro es exactamente el fallo que
     esta sección existe para encontrar. */
  has(en,/Win or lose/,'el titular: ganes o pierdas');
  has(en,/your score is the fundraiser/,'y que el marcador ES la recaudación');
  has(en,/\$816\.00/,'lo que recaudó el que ganó');
  has(en,/\$732\.00/,'y lo que recaudó el que perdió');
  has(en,/Both programs have pledges/,'y lo dice con todas las letras');
  has(en,/Prometido no es cobrado/,'lo prometido no es lo cobrado, en la portada');
  has(en,/depends on\s+your collecting/,'y de quién depende lo que entre');
  has(en,/Pledged on Can/,'y la cifra del tablero se etiqueta como promesa');
  not(en,/Both programs raise\b/,'y ya no dice que los dos recaudan');
  has(en,/not the fundraiser/,'perder cuesta puntos, no la recaudación');
  has(en,/Example/i,'el tablero se marca como ejemplo');
  has(en,/Pledge\. Play\. Post\. Paid\./,'los cuatro pasos');
  has(en,/every point your team\s+scores/,'por punto del EQUIPO');
  has(en,/marcadorpr/,'marcadorpr sale nombrado');
  has(en,/Nobody types a number twice/,'y que el marcador no se escribe dos veces');
  has(en,/Up to 10 pledges/,'el peldaño de abajo');
  has(en,/201 pledges or more/,'y el de arriba, abierto');
  has(en,/No pledges, no fee/,'la promesa sobre el cargo');
  has(en,/strictly a pledge management software provider/i,'la frase legal');
  has(en,/independently manage all proceeds/i,'y quién maneja los fondos');
  has(en,/one notice with the final score/,'el padrino recibe un aviso');
  has(en,/No payment link and no reminders/,'y se dice que no lleva enlace de pago');
  not(en,/link to pay your program/,'y la portada ya no promete uno');
  noAfirma(en,/out of what you raise|once you have been paid|percentage of/i,
     'y no dice que el cargo salga de lo recaudado');
  noAfirma(en,/\bdeductible\b/i,'ni promete ninguna deducción');
  /* Y la misma vigilancia en inglés, donde «owed» es todavía más
     seco que «se debe». */
  not(en,/\bowes?\b|\bowed\b|\bowing\b|\bdebt\b/,'y en inglés tampoco se le debe nada a nadie');
  has(en,/no ceiling|not a ceiling/i,'el tope negado, también en inglés');
  has(en,/\$2,040\.00/,'y la fila de los 120 padrinos');
  not(en,/\{[A-Z]\}/,'sin plantillas');

  const ti=await p.title();
  has(ti,/Every point is recorded\./,'el título, en inglés');
  not(ti,/Hooporia/i,'el título no se quedó con el nombre retirado');

  console.log('\n7 · Los enlaces');
  const hrefs=await p.evaluate(()=>[...document.querySelectorAll('a')].map(a=>a.getAttribute('href')));
  for(const h of ['equipo.html','mi-equipo.html','ayuda.html','cobro.html','terms.html','privacy.html','custodia.html'])
    hrefs.includes(h)?ok('a '+h):mal('falta '+h);
  hrefs.some(h=>/cadapunto|cognitivo\.digital|prometer\.html/.test(h||''))?mal('enlaza fuera del producto'):ok('no enlaza a Cada Punto');
  /* EL GIMNASIO YA NO SALE DE LA PORTADA, y por eso esto está al
     revés de como estaba.

     Hasta el 28 de octubre de 2026 la portada llevaba una sección de
     Cognitivo Gym con su enlace al hub, y aquí se exigía esa
     dirección entera con su ?e=demo. La sección se retiró: la
     portada es del recaudador y nada más, y una sección de juegos
     gratis en medio del argumento del dinero le quitaba el sitio a
     lo que sí tiene que decir.

     Ahora se vigila lo contrario — que no vuelva a colarse — porque
     retirar una comprobación sin poner otra deja la puerta abierta a
     que reaparezca sin que nadie se entere. El gimnasio sigue vivo
     en su sitio: fortress-vr.html sale hacia él, y eso lo comprueba
     prueba-atras.js, que es su prueba. */
  hrefs.some(h=>/hooporia\.mobi|fortress-mobile-hub/.test(h||''))
    ?mal('la portada volvió a enlazar al gimnasio')
    :ok('la portada no enlaza al gimnasio: es del recaudador y nada más');

  /* EL ESPAÑOL MANDA EN CRUDO. Lo que lee WhatsApp cuando un
     entrenador pasa el enlace es el HTML tal cual, sin ejecutar el
     pintor, así que el título y la descripción del <head> tienen que
     estar en español aunque el marcado del cuerpo esté en inglés. Con
     el título en inglés ahí arriba, la vista previa salía en inglés
     por mucho que la página se abriera en español. */
  const crudo = fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  has(crudo,/<html lang="es"/,'el html arranca declarado en español');
  has(crudo,/<title>[^<]*Cada punto queda anotado/,'y el título en crudo va en español');
  has(crudo,/name="description" content="Recaudación/,'y la descripción también');
  not(crudo,/navigator\.language/,'y el arranque no lo decide el idioma del navegador');

  /* ── Y EL CUERPO TAMBIÉN, EN CRUDO ──────────────────────────────
     Ésta es la comprobación que faltaba el 28 de octubre de 2026.

     El inglés vivía en el marcado y el español en la tabla, así que
     la página sólo se ponía en español DESPUÉS de correr el pintor.
     Todo lo que lee el HTML sin ejecutarlo lo veía en inglés: la
     vista previa del editor, ver-código-fuente, el fichero copiado a
     mano, los rastreadores. Y nada lo decía, porque en el navegador
     se veía perfecto.

     Se mira el titular, que es lo primero que lee cualquiera de
     ésos, y se mira que la tabla de traducción NO tenga un bloque
     'es:' — si vuelve a aparecer, es que alguien le dio la vuelta
     otra vez. */
  has(crudo,/<h1[^>]*>\s*Ganes o pierdas/,'el titular va en español en el marcado, no sólo al pintar');
  /* Y QUE EL PINTOR NO PUEDA DESHACERLO. La portada no lee el idioma
     guardado: las tres llaves las comparten las quince páginas, y un
     «English» pulsado una vez en equipo.html dejaba la portada
     abriéndose en inglés para siempre, encima de un marcado que está
     en español y sin nada que lo delatara. */
  not(crudo,/locale\s*=\s*localStorage\.getItem/,
      'y el arranque no lo decide un idioma guardado por otra página');
  has(crudo,/<h2[^>]*data-i="howH2">Promete\. Juega\. Anota\. Cobra\./,'y los titulares de sección igual');
  has(crudo,/const translations=\{\s*\n?en:\{/,'la tabla de traducción es la del inglés');
  not(crudo,/\n\s*es:\{/,'y no hay una tabla de español: el español es el marcado');

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
  const sinEs = llaves.marcado.filter(k=>!(k in TAB.en));
  /* Una llave está VIVA si tiene un elemento con data-i... o si el
     JS le pone el inglés a mano. La escalera del precio la pinta el
     JS desde TARIFAS, así que sus cinco frases no cuelgan de ningún
     elemento del marcado y aquí salían como texto muerto cuando no
     lo son. Se cuentan las dos formas. */
  const aMano = [...fuenteIdx.matchAll(/spanish\.([A-Za-z0-9_]+)\s*=/g)].map(m=>m[1]);
  const vivas = new Set([...llaves.marcado, ...aMano]);
  const muertas = Object.keys(TAB.en).filter(k=>!vivas.has(k));
  sinEs.length===0
    ? ok('las '+llaves.marcado.length+' llaves del marcado tienen inglés (y '+aMano.length+' más las pone el JS)')
    : mal('sin inglés: '+sinEs.join(', '));
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
