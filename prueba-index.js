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
  /* «PROGRAMA» ABRE LOS CUATRO PASOS. Decía «Promete. Juega. Anota.
     Cobra.» y empezaba por la promesa, que es el segundo movimiento.
     El primero es poner los juegos en el calendario, que es lo que
     el entrenador hace de todas formas — y en esta plataforma es
     donde empieza la recaudación. */
  has(t,/Programa\. Promete\. Juega\. Cobra\./,'los cuatro pasos, empezando por programar');
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
  has(t,/El calendario que recauda/,
      'marcador es un calendario de recaudación, no sólo un tablero');
  has(t,/cada juego sale con su enlace para recibir promesas por punto/,
      'cada juego sale con su enlace de prometer');
  has(t,/uno, diez o la temporada entera/,'uno, diez o la temporada entera');
  has(t,/\u00bfOrganizas torneos\? Tambi\u00e9n/i,'y el mismo sitio arma un torneo entero');
  not(t,/el tablero que tu torneo ya usa/,'y ya no da por hecho que tengas un torneo');
  /* ESCOGER VOLVIÓ A SER EL TRATO, y esta prueba está al revés de
     como estuvo dos días.

     Mientras todo juego programado salía con botón, «tú escoges en
     qué juegos van» era falso y había que vigilar que no se dijera.
     Desde el 30 de octubre de 2026 el entrenador escoge juego por
     juego —lo pide la base y lo pide la página de su equipo— así que
     ahora lo que hay que vigilar es que SÍ se diga: es la respuesta
     a lo primero que piensa un entrenador, que no va a pedirle
     dinero a su gente veinte veces en la temporada. */
  has(t,/t\u00fa decides en cu\u00e1les s\u00ed y en cu\u00e1les no/,
      'y dice que el entrenador escoge en cuáles van los padrinos');
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
  has(t,/para los dos equipos si los dos est\u00e1n inscritos/,
      'y que recaudan los dos equipos, si los dos están inscritos');
  has(t,/Tu programa recibe directamente lo que recaude/,
      'y que lo recaudado va directo al programa');

  console.log('\n3 · La cuenta, y que los dos equipos salen');
  has(t,/Sesenta y ocho puntos/,'la cuenta va sobre el juego del tablero');
  has(t,/48/,'con los padrinos que la montan');
  has(t,/que lo perdió/,'y el que perdió sale en la misma cuenta');
  has(t,/no se ha movido un peso/,'y se dice que no es una promesa');

  /* ── SIN TOPE DE PADRINOS ────────────────────────────────────────
     El tope de la licencia está en noventa y nueve y noventa y nueve
     acaba leyéndose como el techo de padrinos, que no lo es. La sección del tope enseña el MISMO
     juego con tres cantidades de padrinos, y sus números no se
     escriben a mano: salen de 68 puntos × 25¢ × padrinos.

     Se calculan aquí a partir de FEE y de la cuenta, y no se
     copian del marcado, porque una tabla que se queda vieja cuando
     alguien toca el precio es exactamente el fallo que esto existe
     para encontrar: la página seguiría leyéndose perfecta. */
  has(t,/No hay techo\. Ni de padrinos, ni de juegos/,'no hay techo: ni de padrinos, ni de juegos');
  has(t,/Nadie pone un límite/,'y se dice que nadie pone un límite');
  has(t,/un tío en Orlando|una prima en Nueva York/,'y que el padrino no tiene que ser del pueblo');
  has(t,/programa la temporada entera/,'y que se puede programar la temporada entera');
  {
    const PUNTOS = 68, CENTAVOS = 0.25;
    /* La tarifa se lee del propio index.html, igual que hace
       prueba-precio.js: así estas tres filas no pueden quedarse
       viejas cuando alguien toque el precio.

       YA NO ES UNA ESCALERA. Era una de seis tramos y ahora es un
       dólar por promesa que cualifica con tope de noventa y nueve,
       así que esto lee FEE y no TARIFAS. Cuando la escalera se
       retiró, lo que aquí quedó fue un indexOf devolviendo -1 y un
       new Function montando basura: el fichero entero se caía antes
       de la primera comprobación. */
    const _src = fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
    const _mf  = _src.indexOf('const FEE = {');
    if (_mf < 0) throw new Error('index.html ya no define FEE: el precio se movió de sitio');
    const FEE  = new Function('return ' +
      _src.slice(_src.indexOf('{', _mf), _src.indexOf('};', _mf) + 1))();
    const escalon = n => n > 0 ? Math.min(n, FEE.tope) * FEE.porPromesa : 0;
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
    if (bien) ok('las tres filas de padrinos cuadran con la cuenta y con la tarifa');

    /* ── Y EL SEGUNDO EJE: LOS JUEGOS ──────────────────────────────
       La dirección nueva de la plataforma. Un entrenador no tiene un
       juego, tiene una temporada, y cada fecha de esa temporada ya
       es un evento de recaudación que nadie estaba cobrando.

       El precio es POR JUEGO, así que veinte juegos son veinte
       licencias. Eso se calcula aquí igual que lo prometido: si
       alguna vez deja de multiplicar, la tabla estaría prometiendo
       una temporada a precio de un sábado. */
    const BASE = 48 * PUNTOS * CENTAVOS;          // $816 el juego
    const LIC  = escalon(48);                     // $48 el juego
    let bienT = true;
    for (const j of [1, 10, 20]){
      const pro = '$' + (BASE*j).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const lic = '$' + (LIC*j);
      if (!ci(new RegExp(pro.replace(/[$.]/g,'\\$&'))).test(t)){
        mal('faltan los ' + pro + ' de ' + j + ' juego(s)'); bienT = false;
      }
      if (!ci(new RegExp('\\' + lic + '\\b')).test(t)){
        mal('falta la licencia ' + lic + ' de ' + j + ' juego(s)'); bienT = false;
      }
    }
    if (bienT) ok('y las tres de la temporada: ' + LIC + ' por juego, multiplicado');

    /* ── LA CIFRA ESCRITA EN LETRAS ────────────────────────────────
       El párrafo de debajo de la tabla decía «son veinte licencias
       de veinticinco dólares» mucho después de que la tabla dijera
       $48 y $960. Sobrevivió a los guardias y al despliegue porque
       la cifra no lleva signo de dólar: buscando /\$25\b/ no hay
       nada que encontrar.

       Así que aquí se vigilan las letras. La palabra de la cifra se
       saca de la cuenta —no se escribe a mano— y además se prohíbe
       el lenguaje de la escalera retirada, que es lo que arrastraba
       la frase vieja. */
    const LETRAS = { 48:['cuarenta y ocho','forty-eight'], 99:['noventa y nueve','ninety-nine'],
                     25:['veinticinco','twenty-five'], 12:['doce','twelve'] };
    const palabra = LETRAS[LIC] && LETRAS[LIC][0];
    if (!palabra){
      mal('la licencia por juego es $' + LIC + ' y no hay palabra para ella: '
          + 'añádela a LETRAS para que esta comprobación siga sirviendo');
    } else if (ci(new RegExp(palabra + '\\s+dólares')).test(t)){
      ok('y la cifra escrita en letras dice ' + palabra + ', igual que la tabla');
    } else {
      mal('el párrafo de la temporada no dice «' + palabra + ' dólares»');
    }
    /* Las dos frases que sostenían la escalera. Si alguna vuelve,
       vuelve con ella un precio que ya no existe. */
    not(t,/por tramos|de 120 a 200|peldañ/i,'y no quedó lenguaje de la escalera');
    for (const [n,[es,en]] of Object.entries(LETRAS)){
      if (Number(n) === LIC) continue;
      if (ci(new RegExp('(' + es + '|' + en + ')[ -]+(dólares|dollar)')).test(t))
        mal('todavía se lee «' + es + ' dólares», que no es el precio de hoy');
    }
  }
  /* EL NÚMERO GRANDE DE LA TEMPORADA NO PUEDE QUEDARSE SOLO. Son
     dieciséis mil dólares en naranja; sin esta frase al lado, un
     entrenador los lee como dinero que va a entrar. */
  has(t,/Prometido no es cobrado[\s\S]{0,400}depende de tu cobro|dieciséis|Un lavado de\s+carros te da un sábado/,
      'y la temporada lleva al lado que prometido no es cobrado');
  /* NO ES UN POR CIENTO, Y AQUÍ HACE MÁS FALTA QUE EN NINGÚN SITIO:
     $500 entre $16,320 da un tres por ciento, y un entrenador hace
     esa división solo. La página tiene que adelantarse. */
  /* La cifra NO se escribe aquí: la comprueba contra la cuenta el
     bloque de LETRAS de más abajo. Esta línea sólo vigila la forma
     de la frase —veinte licencias, una por juego— que es lo que
     impide leer el total de la temporada como un por ciento. */
  has(t,/son veinte licencias de/,'y que la temporada son veinte licencias, no un por ciento');
  has(t,/una por juego/,'una por juego');
  /* El rótulo decía «sube por tramos y se para», que era la
     escalera. Lo que comprueba la línea —que la frase exista— no
     ha cambiado; lo que decía de sí misma sí. Un rótulo viejo en
     una prueba que pasa es peor que uno en la página: al que lee
     la salida le dice que se vigila algo que ya no está. */
  has(t,/la licencia no te persigue/,'y se dice que la licencia no te persigue');

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

  console.log('\n4 · El precio: un dólar por promesa que cualifica');
  /* YA NO HAY ESCALERA. Eran seis tramos por cantidad de promesas y
     ahora es un dólar por promesa que cualifica con tope de noventa
     y nueve por juego. Lo que esto vigila no es la aritmética
     —prueba-precio.js la cuadra contra las otras páginas— sino que
     la página siga diciendo las dos cifras y, sobre todo, la
     definición: sin «cualifica» explicado, un dólar por promesa se
     lee como un dólar por CADA promesa, y el padrino de cinco
     centavos cree que cuesta dinero. */
  has(t,/\$1 por cada promesa que cualifica/,'el dólar por promesa que cualifica');
  has(t,/Máximo \$99 por\s+juego/,'y el tope de noventa y nueve por juego');
  has(t,/alcanza \$5 o\s+más/,'qué es cualificar: que el valor final llegue a $5');
  has(t,/después de publicarse el marcador/,'y que se sabe cuando se pone el marcador');
  has(t,/no hay cargo/,'sin promesas que cualifiquen, no hay cargo');
  has(t,/se incluyen sin\s+costo/,'y pasado el tope, las demás van sin costo');
  has(t,/Nada por adelantado/,'nada por adelantado');
  has(t,/Sin porcentajes ni comisiones/,'sin por cientos y sin comisiones');
  has(t,/Sin suscripciones/,'y sin suscripciones');
  not(t,/\{[A-Z]\}/,'sin plantillas sin rellenar');

  /* Y QUE NO QUEDE UN PELDAÑO PINTADO. La escalera se pintaba desde
     JS; si alguien devuelve ese bloque, la página enseñaría dos
     precios a la vez y ninguno de los dos se leería como el falso. */
  const n=await p.evaluate(()=>document.querySelectorAll('.peldano').length);
  n===0?ok('no quedó ni un peldaño de la escalera retirada')
       :mal('todavía se pintan '+n+' peldaños de la escalera');

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
  has(en,/Schedule\. Pledge\. Play\. Paid\./,"los cuatro pasos, empezando por programar");
  has(en,/every point your team\s+scores/,'por punto del EQUIPO');
  has(en,/marcadorpr/,'marcadorpr sale nombrado');
  has(en,/\$1 for each pledge that qualifies/,'el dólar por promesa que cualifica');
  has(en,/\$99 maximum per game/,'y el tope por juego');
  has(en,/final value reaches \$5/,'qué es cualificar');
  has(en,/No qualifying pledges, no charge/,'sin promesas que cualifiquen, no hay cargo');
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
  has(crudo,/<h2[^>]*data-i="howH2">Programa\. Promete\. Juega\. Cobra\./,"y los titulares de sección igual");
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
     JS desde FEE, así que sus cinco frases no cuelgan de ningún
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
  has(src,/og:image"[^>]+content="https:\/\/cadapunto\.com\/cadapunto-card\.jpg"/,
      'la imagen de compartir, en absoluto');
  errs.length?errs.forEach(e=>mal(e)):ok('sin errores de página');

  await b.close();
  console.log('\n'+(bad===0?'✓ el índice de Cada Punto Cuenta pasa':'✗ '+bad+' fallo(s)'));
  process.exit(bad===0?0:1);
})().catch(e=>{console.error(e);process.exit(1)});
