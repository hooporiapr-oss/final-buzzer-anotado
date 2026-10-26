/* ══════════════════════════════════════════════════════════════════
   EL PRECIO DICE LO MISMO EN TODAS PARTES

   El precio vive en siete sitios: PRECIO en index.html, los términos,
   la divulgación del dinero, el FAQ, la hoja de alta, el admin y las
   constantes de la demostración. Son siete copias de un número que un
   día va a cambiar, y nada obliga a que cambien juntas.

   Ya pasó con el piso de $5: estaba en 50 centavos en el servidor y
   en $5 en la página, y un padrino cuya promesa daba $2 leía que no
   debía nada y recibía un aviso pidiéndole $2. Un precio desfasado
   es peor: es lo que una escuela va a leer antes de firmar.

   Así que PRECIO en index.html manda —es el que se pinta y el que lee
   un entrenador— y esto comprueba que las otras seis no lo
   contradigan.

   ══ EL 26 DE OCTUBRE DE 2026 ESTA PRUEBA CAMBIÓ DE FORMA ══

   Vigilaba una escalera de seis peldaños por tamaño de plantilla
   —$29 hasta siete nenes, $599 hasta ochocientos— que cobraba por
   evento, y comprobaba que fuera monótona y contigua: que el precio
   no bajara al subir la plantilla, y que no hubiera huecos ni
   solapes entre peldaños.

   Esa escalera se retiró entera. Ahora hay UN número y se cobra por
   JUEGO con promesas encima: la plantilla no entra en el cálculo, así
   que un equipo de ocho y uno de cuarenta pagan lo mismo por el mismo
   juego. No hay peldaños que ordenar, así que esas comprobaciones no
   tienen objeto y se fueron con ellos.

   Lo que se vigila ahora es más simple y más duro: que el número sea
   UNO, que las siete copias lo digan, y que NINGUNA se haya quedado
   con una cifra de la escalera vieja — que es el fallo de verdad que
   deja este cambio, una página en la que nadie se fijó diciendo $599
   mientras el resto del sitio dice $5.

       node prueba-precio.js
   ══════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

let fallos = 0;
const ok  = (m) => console.log('  ok   ' + m);
const mal = (m) => { fallos++; console.log('  MAL  ' + m) };
const si  = (v, m) => (v ? ok(m) : mal(m));
const leer = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

/* El número, sacado de index.html tal cual se despliega. */
const idx = leer('index.html');
const mp = idx.match(/const PRECIO\s*=\s*(\d+)/);
const mm = idx.match(/const MINIMO\s*=\s*(\d+)/);
if (!mp) { console.log('  MAL  no encuentro PRECIO en index.html'); process.exit(1) }
if (!mm) { console.log('  MAL  no encuentro MINIMO en index.html'); process.exit(1) }
const PRECIO = +mp[1], MINIMO = +mm[1];

/* Las cifras de la escalera retirada. Cualquiera de éstas en una
   página de dinero es la frase vieja sin cambiar. */
const RETIRADAS = [29, 49, 149, 349, 599];

console.log('\n1 · El número, por dentro\n');
{
  si(PRECIO > 0, 'PRECIO es un número de verdad: $' + PRECIO);
  si(MINIMO > 0, 'y MINIMO también: ' + MINIMO + ' juegos');

  /* El mínimo es de INSCRIPCIÓN, no un cargo. Un programa se apunta
     con cinco juegos; si sólo consigue promesas en dos, paga dos. Si
     algún día esto se convirtiera en un cargo mínimo, la promesa de
     «sin promesas, sin cargo» se rompería — así que la página tiene
     que seguir diciendo con qué se inscribe uno y no cobrarlo. */
  si(!RETIRADAS.includes(PRECIO),
     'y no es ninguno de los peldaños retirados');

  /* Que la escalera no haya vuelto por la puerta de atrás. */
  si(idx.indexOf('const TARIFAS') === -1,
     'la escalera por plantilla no está de vuelta en index.html');
}

console.log('\n2 · La portada lo pinta de PRECIO y no a mano\n');
{
  /* El número va en el marcado como $5 para que la página se lea
     aunque el JS no corra, pero lo pinta el JS desde PRECIO. Lo que
     no puede pasar es que el marcado diga una cifra y PRECIO otra:
     entonces el número salta al cargar y nadie sabe cuál es. */
  const m = idx.match(/id="precioNum"[^>]*>\$(\d+)</);
  if (!m) mal('no encuentro el número en el marcado de la portada');
  else si(+m[1] === PRECIO,
    'el marcado dice $' + m[1] + ' y PRECIO dice $' + PRECIO + ' — el mismo');

  si(/num\.textContent\s*=\s*'\$'\s*\+\s*PRECIO/.test(idx),
     'y el pintor lo mete desde PRECIO, no desde una cifra escrita');
}

console.log('\n3 · Las otras seis no lo contradicen\n');
{
  /* Las páginas de letra pequeña no repiten el número en cifra:
     lo dicen con palabras —«cinco dólares por juego»— porque una
     cifra repetida en siete sitios es una cifra que un día dirá
     cosas distintas. Lo que sí tienen que decir bien es el MODELO:
     por juego, con promesas, y que un juego sin promesas no se
     factura.

     equipo.html entró en esta lista el 23 de octubre de 2026, y era
     el peor de los que faltaban: su línea lic: es la que un programa
     MARCA para aceptar la licencia. Si ahí dice un precio que no es,
     lo que se ha aceptado no es lo que se va a facturar. */
  const PAGINAS = [
    ['terms.html',    2],
    ['custodia.html', 2],
    ['ayuda.html',    2],
    ['equipo.html',   4],   // lic: y fineP:, en los dos idiomas
    ['admin.html',    1]
  ];

  for (const [f, copias] of PAGINAS) {
    const t = leer(f);
    const sinComentarios = t.replace(/<!--[\s\S]*?-->/g, '');

    /* POR JUEGO, dicho tantas veces como copias tiene la página.
       Contar y no sólo buscar: terms y custodia llevan el texto dos
       veces, una por idioma, y con un indexOf a secas cambiar el
       inglés y dejar el español pasaba la prueba. */
    /* «per-game» con guión cuenta igual que «per game»: la línea que
       un programa marca dice «the per-game license», y exigir la
       forma sin guión la dejaba fuera por un carácter. */
    const porJuego = (sinComentarios.match(/per[- ]game|por juego/gi) || []).length;
    si(porJuego >= copias,
       f + ' dice «por juego» en sus ' + copias + ' copia(s) (' + porJuego + ')');

    /* Y QUE UN JUEGO SIN PROMESAS NO SE FACTURA. Es la única promesa
       que estas páginas hacen sobre dinero, y la que hace que el
       mínimo de inscripción no sea un cargo. */
    /* Cada página lo dice con sus palabras —«no fee is invoiced for
       it», «no se le factura ningún cargo»— así que se busca la IDEA
       y no una frase concreta: promesas ninguna, y cargo ninguno.
       Pedir una redacción exacta hacía fallar a terms.html, que lo
       dice perfectamente desde antes de este cambio. */
    const sinCargo =
      /no pledges,? no fee/i.test(sinComentarios) ||
      /sin promesas,? sin cargo/i.test(sinComentarios) ||
      /records no pledges[\s\S]{0,60}?(not invoiced|no fee)/i.test(sinComentarios) ||
      /ni una promesa,?[\s\S]{0,40}?no se (le )?factura/i.test(sinComentarios);
    si(sinCargo, f + ' dice que un juego sin promesas no se factura');

    /* NINGUNA CIFRA DE LA ESCALERA RETIRADA. Éste es el fallo que
       deja este cambio: una página en la que nadie se fijó diciendo
       $599 mientras el resto del sitio dice $5.

       Se saltan las cifras de EJEMPLO de custodia.html —$16,20,
       $6,45 y $42,75, las promesas desiguales que explican por qué la
       cuenta a mano no la lleva nadie— porque no son precios de
       licencia. Se reconocen porque llevan centavos. */
    const sinCentavos = sinComentarios.replace(/\$\d+[.,]\d\d/g, '');
    const quedan = RETIRADAS.filter(n => new RegExp('\\$' + n + '\\b').test(sinCentavos));
    si(quedan.length === 0,
       f + ' no se quedó con ninguna cifra de la escalera vieja' +
       (quedan.length ? ' — sobran: ' + quedan.map(n => '$' + n).join(', ') : ''));

    /* Ni con el vocabulario del modelo viejo, que es por dónde se
       cuela media frase sin cambiar: cobrar POR EVENTO y fijar el
       cargo SEGÚN LA PLANTILLA eran las dos piezas del precio
       retirado.

       Se busca la AFIRMACIÓN y no la palabra. Las páginas nuevas
       dicen «no depende del tamaño de la plantilla» y «does not
       change with the size of the roster» —que es copy correcto y
       deliberado: niega justo el modelo viejo— y una regex que
       mirara el sustantivo a secas suspendía las cuatro páginas por
       decir bien lo que tienen que decir. */
    const viejo =
      /licen[cs]\w*\s+per\s+event/i.test(sinComentarios) ||
      /se licencia por evento|licencia por evento/i.test(sinComentarios) ||
      /fee set by the size of the roster/i.test(sinComentarios) ||
      /cargo fijo (que depende del|según el) tamaño/i.test(sinComentarios);
    si(!viejo, f + ' ya no cobra por evento ni fija el cargo por plantilla');
  }
}

console.log('\n4 · La demostración cobra lo que dice la portada\n');
{
  /* demo.html lleva su propia copia del precio, en una constante y no
     en texto: calcula en vivo lo que habría recaudado un programa y
     lo que costaría la licencia. Es el único sitio donde el precio no
     se LEE —se calcula— así que un desfase aquí sale como un número
     creíble y falso, y no lo nota nadie.

     Tenía DOS constantes y un corte de plantilla, porque había dos
     precios según el tamaño del equipo. Con el precio por juego la
     plantilla no entra, así que ahora es una sola y tiene que valer
     exactamente lo que vale PRECIO. */
  const d = leer('demo.html');
  const m = d.match(/var LICENCIA\s*=\s*(\d+)/);
  if (!m) mal('no encuentro LICENCIA en demo.html');
  else si(+m[1] === PRECIO,
    'su licencia ($' + m[1] + ') es la de la portada ($' + PRECIO + ')');

  si(!/LICENCIA_CHICA|PLANTILLA_CHICA/.test(d),
     'y ya no lleva las dos tarifas por plantilla');

  /* La fila del precio sigue saliendo de la constante y no de una
     cifra escrita en el rótulo. */
  si(/fila\(T\('cl1'\),\s*money\(LICENCIA\)\)/.test(d),
     'y la fila del precio se pinta desde la constante');
}

console.log('\n4b · Y al padrino no se le suma nada\n');
{
  /* ESTA SECCIÓN EXISTE POR UN FALLO QUE SE ESCAPÓ.

     El 26 de octubre de 2026 se portó scoreboard.html desde la
     generación anterior. Se le miró la marca, la barra, los enlaces
     y las cuatro pruebas del sitio, y pasó todas — porque ninguna
     miraba lo que esa página le dice a un padrino sobre dinero.

     Y lo que le decía era que a su promesa se le añadía un 20% de
     plataforma. No era sólo texto: la línea se calculaba y los
     botones de tarifa enseñaban el total multiplicado por 1.20. Una
     promesa de $25.00 le salía por $30.00.

     Ese cargo se retiró del producto cuando Cada Punto pasó a
     licenciarse al programa. Los términos, la divulgación, el FAQ y
     la hoja de alta dicen desde entonces que no es un por ciento de
     nada y que al padrino no se le cobra nada. La página portada
     decía lo contrario, en la pantalla donde alguien promete.

     Las páginas que mira esto son las que ve un padrino. No se les
     exige que hablen de la licencia —no es asunto suyo— sino que no
     le sumen nada a lo que prometió. */
  const DEL_PADRINO = ['prometer.html', 'scoreboard.html',
                       'padrinos.html', 'jugador.html'];

  for (const f of DEL_PADRINO) {
    let t;
    try { t = leer(f) } catch (e) { mal('no encuentro ' + f); continue }
    const limpio = t.replace(/<!--[\s\S]*?-->/g, '')
                    .replace(/\/\*[\s\S]*?\*\//g, '');

    /* Un por ciento de plataforma, dicho de cualquier manera. */
    const porCiento = /platform fee|cargo de plataforma|% de plataforma|\d+% platform/i
      .test(limpio);
    si(!porCiento, f + ' no le nombra ningún cargo de plataforma al padrino');

    /* Y sin calcularlo por lo bajo. Ésta es la que habría cazado el
       fallo: el texto se puede cambiar y dejar la cuenta puesta, y
       entonces la página dice una cosa y cobra otra. */
    const calcula = /\*\s*0\.20\b|\*\s*1\.20\b|\*\s*0,20\b/.test(limpio);
    si(!calcula, f + ' tampoco se lo calcula por lo bajo');
  }
}

console.log('\n5 · Y nadie promete una deducción\n');
{
  /* No es una comprobación de precio, pero vive aquí porque es la
     frase que se cuela cuando alguien reescribe una página de
     dinero: «deducible de impuestos» no lo decimos en ningún sitio
     y en ningún idioma. */
  for (const f of ['index.html', 'terms.html', 'custodia.html',
                   'ayuda.html', 'equipo.html', 'demo.html']) {
    const t = leer(f).replace(/<!--[\s\S]*?-->/g, '');
    /* Se permite la frase que lo NIEGA —«no decimos que una promesa
       sea deducible», «we do not issue tax receipts»— que es justo
       lo que custodia.html y los términos TIENEN que decir. Lo que
       no se permite es afirmarlo.

       Así que se mira cada mención por separado y se le lee lo que
       lleva delante: si en los sesenta caracteres anteriores hay una
       negación, es la frase que nos protege y no la que nos hunde.
       Con una regex a secas, las dos páginas que mejor lo dicen eran
       las dos que suspendían. */
    const menciones = [...t.matchAll(/deducib\w*|tax deduction|deducción de impuestos/gi)];
    const afirmadas = menciones.filter(m => {
      const antes = t.slice(Math.max(0, m.index - 80), m.index);
      /* «ni» cuenta como negación, y hacía falta: los términos dicen
         «no decimos que su pago sea caritativo NI que es deducible»,
         donde la única negación cerca de la palabra es ésa. Sin ella
         la página que mejor lo niega era la que suspendía. */
      if (/\b(no|not|never|ni|nunca|ningún|ninguna|sin|don't|do not|does not)\b/i.test(antes)) return false;
      /* Y una PREGUNTA no es una afirmación. El FAQ titula una de sus
         entradas «¿Esto es deducible de impuestos?» justamente para
         contestar que no; leer ese título como una promesa de
         deducción es leerlo al revés. */
      const hasta = t.slice(m.index, m.index + 80);
      if (/^[^.!]*\?/.test(hasta) || /¿[^?]*$/.test(antes)) return false;
      return true;
    });
    si(afirmadas.length === 0,
       f + ' no promete ninguna deducción' +
       (menciones.length ? ' (' + menciones.length + ' mención(es), todas negadas)' : ''));
  }
}

console.log('\n' + (fallos === 0
  ? '✓ el precio dice lo mismo en los siete sitios'
  : '✗ ' + fallos + ' fallo(s)'));
process.exit(fallos ? 1 : 0);
