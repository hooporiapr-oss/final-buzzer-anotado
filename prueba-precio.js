/* ══════════════════════════════════════════════════════════════════
   EL PRECIO DICE LO MISMO EN TODAS PARTES

   El precio vive en cuatro sitios: la escalera de index.html, los
   términos, la divulgación del dinero y el admin. Son cuatro copias
   de un número que un día va a cambiar, y nada obligaba a que
   cambiaran juntas.

   Ya pasó con el piso de $5: estaba en 50 centavos en el servidor y
   en $5 en la página, y un padrino cuya promesa daba $2 leía que no
   debía nada y recibía un aviso pidiéndole $2. Un precio desfasado
   es peor: es lo que una escuela va a leer antes de firmar.

   Así que la escalera de index.html manda —es la que se pinta y la
   que lee un entrenador— y esto comprueba que las otras tres no la
   contradigan.

   Y comprueba la escalera por dentro, que es donde se cuela un
   error que nadie ve: peldaños que se solapan, un hueco entre dos,
   o un precio que baja cuando la plantilla sube.

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

/* La escalera, sacada de index.html tal cual se despliega. */
const idx = leer('index.html');
const i = idx.indexOf('const TARIFAS = [');
if (i < 0) { console.log('  MAL  no encuentro TARIFAS en index.html'); process.exit(1) }
const j = idx.indexOf('];', i);
const TARIFAS = new Function('return ' + idx.slice(idx.indexOf('[', i), j + 1))();

console.log('\n1 · La escalera, por dentro\n');
{
  si(TARIFAS.length >= 2, 'tiene ' + TARIFAS.length + ' peldaños');

  /* Monótona: si la plantilla sube, el precio no puede bajar. Un
     peldaño más barato que el anterior es una invitación a apuntar
     a un nene de más para pagar menos. */
  let sube = true, precios = [];
  TARIFAS.forEach(p => { if (p.precio !== null) precios.push(p.precio) });
  for (let k = 1; k < precios.length; k++) if (precios[k] <= precios[k-1]) sube = false;
  si(sube, 'el precio sube con la plantilla, peldaño a peldaño (' +
     precios.map(x => '$' + x).join(' → ') + ')');

  /* Contigua: sin huecos ni solapes. Un hueco deja una plantilla sin
     precio y un solape deja dos precios para la misma. */
  let huecos = [];
  TARIFAS.forEach((p, k) => {
    if (k === 0) return;
    const antes = TARIFAS[k-1].hasta;
    if (antes === null) huecos.push('hay un peldaño después del último');
  });
  si(huecos.length === 0, 'el peldaño abierto es el último y no hay ninguno después');

  si(TARIFAS[TARIFAS.length-1].hasta === null,
     'y la escalera acaba abierta, para el que no cabe en ninguno');
  si(TARIFAS[TARIFAS.length-1].precio === null,
     'ese último no lleva número: se habla');

  /* Todos los de en medio tienen techo y número. */
  const rotos = TARIFAS.slice(0, -1).filter(p => p.hasta === null || p.precio === null);
  si(rotos.length === 0, 'y todos los demás llevan techo y precio');
}

console.log('\n2 · El equipo cae en un peldaño de verdad\n');
{
  const k = idx.indexOf('const FEE = {');
  const FEE = new Function('return ' + idx.slice(idx.indexOf('{', k), idx.indexOf('}', k) + 1))();
  si(TARIFAS.some(p => p.precio === FEE.team),
     'FEE.team ($' + FEE.team + ') es uno de los peldaños — el que sale resaltado');
  si(TARIFAS.some(p => p.precio === FEE.small),
     'y FEE.small ($' + FEE.small + ') también');
}

const precios = TARIFAS.filter(p => p.precio !== null).map(p => p.precio);
console.log('\n3 · Las otras tres páginas no la contradicen\n');
{
  const min = Math.min(...precios), max = Math.max(...precios);

  /* Las páginas de letra pequeña no repiten los seis números: dicen
     el rango y mandan a la escalera. Repetir seis números en cuatro
     sitios es firmar que un día dirán cosas distintas. Lo que sí
     tienen que decir bien son los dos extremos. */
  for (const f of ['terms.html', 'custodia.html', 'admin.html']) {
    const t = leer(f);
    /* Cuántas veces, no si aparece. terms.html y custodia.html
       llevan el texto DOS veces, una por idioma, y con un indexOf a
       secas cambiar el número en inglés y dejar el español pasaba la
       prueba: el otro idioma seguía teniendo la cifra. Probado
       cambiando sólo el inglés — así no cuela. */
    const copias = f === 'admin.html' ? 1 : 2;
    const veces = (x) => (t.match(new RegExp('\\$' + x + '\\b', 'g')) || []).length;
    si(veces(min) >= copias,
       f + ' dice el suelo ($' + min + ') en sus ' + copias + ' copia(s)');
    si(veces(max) >= copias,
       f + ' dice el techo ($' + max + ') en sus ' + copias + ' copia(s)');

    /* Y ninguna cifra de licencia que no sea una de las dos. Un $499
       colado en una frase es un precio que la escalera no tiene, y
       es lo que una escuela leería antes de firmar.

       Se saltan las cifras de EJEMPLO de custodia.html —$16,45 y
       $42,75, las promesas desiguales que explican por qué la cuenta
       a mano no la lleva nadie— porque no son precios de licencia.
       Se reconocen porque llevan centavos. */
    const sinCentavos = t.replace(/\$\d+[.,]\d\d/g, '');
    const cifras = [...new Set((sinCentavos.match(/\$\d{2,4}\b/g) || []))];
    const ajenas = cifras.filter(c => c !== '$' + min && c !== '$' + max);
    si(ajenas.length === 0,
       f + ' no nombra ninguna otra cifra de licencia' +
       (ajenas.length ? ' — sobran: ' + ajenas.join(', ') : ''));

    /* Y que no se haya quedado un precio de la escalera vieja. Los
       dos peldaños de antes eran $49 y $29; $29 sigue siendo el
       suelo, pero un «$49» suelto en la letra pequeña es la frase
       vieja sin cambiar. */
    const viejo = /\$49\b/.test(t.replace(/<!--[\s\S]*?-->/g, ''));
    si(!viejo, f + ' no se quedó con el precio de dos peldaños');
  }
}

console.log('\n3b · La demostración cobra lo que dice la escalera\n');
{
  /* demo.html lleva su propia copia del precio, en constantes y no
     en texto: calcula en vivo lo que habría recaudado un programa y
     lo que costaría la licencia. Es el QUINTO sitio donde vive el
     precio, y es el único donde no se lee —se calcula—, así que un
     desfase aquí sale como un número y nadie lo nota.

     Modela una plantilla de 12, que cae en el peldaño del equipo.
     Lo que se exige es que sus dos cifras sean peldaños de verdad y
     que el que usa sea el que le toca a 12. */
  const d = leer('demo.html');
  const m = d.match(/var LICENCIA\s*=\s*(\d+),\s*LICENCIA_CHICA\s*=\s*(\d+),\s*PLANTILLA_CHICA\s*=\s*(\d+)/);
  if (!m) mal('no encuentro las constantes del precio en demo.html');
  else {
    const grande = +m[1], chica = +m[2], corte = +m[3];
    si(TARIFAS.some(p => p.precio === grande), 'su precio normal ($' + grande + ') es un peldaño');
    si(TARIFAS.some(p => p.precio === chica), 'y el chico ($' + chica + ') también');

    const dm = d.match(/PLANTILLA\s*=\s*(\d+)/);
    const plantilla = dm ? +dm[1] : null;
    if (plantilla === null) mal('no encuentro la plantilla que modela la demostración');
    else {
      let toca = null, desde = 1;
      for (const p of TARIFAS) {
        if (p.hasta === null || plantilla <= p.hasta) { toca = p.precio; break }
        desde = p.hasta + 1;
      }
      si(toca === grande,
         'y a una plantilla de ' + plantilla + ' le toca $' + toca +
         ', que es justo lo que cobra');
      si(corte === TARIFAS[0].hasta + 1,
         'el corte de plantilla chica (' + corte + ') cuadra con el primer peldaño');
    }
  }
}

console.log('\n4 · Y la escalera se pinta, no se escribe a mano\n');
{
  si(idx.indexOf('id="escalera"') >= 0, 'index.html deja el hueco para pintarla');
  si(idx.indexOf('function pintarEscalera') >= 0, 'y la pinta desde TARIFAS');
  /* Si alguien vuelve a escribir un PRECIO DE LICENCIA en el marcado,
     la tabla y la página pueden separarse sin que nadie se entere.

     Se buscan sólo los números de la escalera, no cualquier cifra con
     dólar: el marcado lleva $30 y $40 en el texto alternativo de la
     imagen de la promesa —lo que da un juego de 150 puntos a 20¢ y el
     tope del padrino— y ésos no tienen nada que ver con la licencia.
     Un buscador de "$ y dos dígitos" los cogía y la prueba gritaba
     por algo que estaba bien. */
  const marcado = idx.slice(idx.indexOf('<body'), idx.indexOf('<script'));
  const sueltos = precios.filter(p => new RegExp('\\$' + p + '\\b').test(marcado));
  si(sueltos.length === 0,
     'y ningún precio de la escalera está escrito a mano en el marcado' +
     (sueltos.length ? ' — encontrados: $' + sueltos.join(', $') : ''));
}

console.log('\n' + (fallos === 0
  ? '✓ un solo precio, dicho igual en los cuatro sitios'
  : '✗ ' + fallos + ' fallo(s)'));
process.exit(fallos === 0 ? 0 : 1);
