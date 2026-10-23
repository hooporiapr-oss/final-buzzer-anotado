/* ══════════════════════════════════════════════════════════════════
   QUE LA PÁGINA DIGA POR QUÉ

   Un jugador puso su nombre, le dio al botón y la página contestó
   "No se pudo. Intenta otra vez." La página sabía exactamente qué
   había pasado —el error venía escrito en la respuesta— y lo tiró a
   la basura antes de enseñar esa línea. Recuperarlo costó cuatro
   viajes al editor de SQL de Supabase.

   El culpable era una sola línea, repetida en siete páginas:

       if(!r.ok) throw new Error('rpc');

   Un fetch que falla trae un cuerpo, y PostgREST mete ahí el message,
   el hint y los details de Postgres. Lanzar un Error con la palabra
   'rpc' y nada más es tirar justo eso.

   Esto comprueba las dos mitades del arreglo:

   1 · que ninguna página siga tirando el cuerpo del error.
   2 · que porque() saque la razón de las formas en que llega —una
       excepción, una respuesta con ok:false, una cadena pelada— y
       que no se desborde: es una línea de aviso debajo de un botón,
       no un registro.

       node prueba-porque.js
   ══════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const vm = require('vm');

let fallos = 0;
const ok  = (m) => console.log('  ok   ' + m);
const mal = (m) => { fallos++; console.log('  MAL  ' + m); };
const eq  = (a, b, m) => (a === b ? ok(m + (a ? ' → ' + a : ''))
  : mal(m + '\n         esperaba: ' + JSON.stringify(b) +
            '\n         vino:     ' + JSON.stringify(a)));

/* Las paginas que le piden algo a un servidor Y le ensenan el
   resultado a una persona que esta esperando. La lista se escribe a
   mano a proposito: no es "toda pagina que llama a algo", es aquella
   donde un fallo sale en pantalla debajo de un boton y alguien tiene
   que entender que paso.

   ayuda.html salio de la lista el 23 de octubre de 2026: se le quito
   el chat y con el la unica llamada que hacia. Una pagina que no
   pide nada no puede tirar el cuerpo de un error.

   prometer.html entro el 23 de octubre, y era la peor que faltaba:
   es la pagina donde promete un padrino. Cualquier fallo —tambien
   uno de la base— le salia como "parece que es tu internet", y de
   la razon no quedaba rastro en ningun sitio. Su carga ademas
   reintenta cada cuatro segundos, asi que un enlace mal copiado
   daba vueltas en silencio.

   Siguen fuera cuatro que si piden y no leen el cuerpo: admin.html
   y los tres tableros del juego. Queda escrito aqui para que se
   mire a proposito y no por sorpresa. */
const PAGINAS = ['equipo.html','jugador.html','mi-equipo.html',
                 'plantilla.html','prometer.html','reporte.html','tablero.html'];

console.log('\n1 · Ninguna página tira el cuerpo del error\n');
for (const p of PAGINAS) {
  const s = fs.readFileSync(__dirname + '/' + p, 'utf8');
  /* La línea vieja, la que costó la mañana. Se busca por su forma,
     no por su texto exacto: lo que no puede volver es lanzar sin
     haber leído la respuesta. */
  const tira = /if\s*\(!r\.ok\)\s*throw new Error\('rpc/.test(s);
  const lee  = /r\.text\(\)\.then\(function\(t\)\{/.test(s) &&
               /d\.message \|\| d\.hint/.test(s);
  if (tira)      mal(p + ': todavía lanza sin leer la respuesta');
  else if (!lee) mal(p + ': no lee el cuerpo del error');
  else           ok(p + ' lee el porqué antes de lanzar');
}

console.log('\n2 · Y porque() lo saca de donde venga\n');
/* Se saca la función de verdad de una página, no una copia. */
const fuente = fs.readFileSync(__dirname + '/jugador.html', 'utf8');
const i = fuente.indexOf('function porque(x){');
const j = fuente.indexOf('\n}', i) + 2;
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fuente.slice(i, j), ctx);
const porque = vm.runInContext('porque', ctx);

// Una excepción de verdad, con el message que puso Postgres
eq(porque(new Error('function join_roster does not exist')),
   ' — function join_roster does not exist',
   'de una excepción saca el message');

// Una respuesta que contestó que no, con su razón
eq(porque({ ok: false, why: 'sin promesas' }), ' — sin promesas',
   'de una respuesta con why, el why');
eq(porque({ error: 'ya_facturada' }), ' — ya_facturada',
   'y de una con error, el error');

// Lo que manda PostgREST cuando la función no existe
eq(porque({ message: 'Could not find the function', hint: 'perhaps you meant' }),
   ' — Could not find the function',
   'el message manda sobre el hint');
eq(porque({ hint: 'revisa el nombre' }), ' — revisa el nombre',
   'pero si sólo hay hint, vale el hint');

// Una cadena pelada
eq(porque('se cayó la red'), ' — se cayó la red', 'una cadena pasa tal cual');

// Y lo que NO puede pasar
eq(porque(null), '', 'sin nada que decir, no dice nada');
eq(porque(undefined), '', 'ni con undefined');
eq(porque({}), '', 'ni con un objeto vacío — no inventa una razón');

/* Esto va debajo de un botón, en una página que mira un nene con el
   teléfono en la mano. Un volcado de Postgres de dos mil caracteres
   ahí no ayuda a nadie. */
const largo = porque({ message: 'x'.repeat(500) });
eq(largo.length <= 165, true, 'y un error larguísimo se recorta (' + largo.length + ')');

console.log('\n' + (fallos === 0
  ? '✓ cuando algo falla, la página lo dice'
  : '✗ ' + fallos + ' fallo(s)'));
process.exit(fallos === 0 ? 0 : 1);
