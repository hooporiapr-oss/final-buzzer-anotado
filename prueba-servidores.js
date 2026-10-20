/* ══════════════════════════════════════════════════════════════════
   CADA PÁGINA, A SU SERVIDOR

   Hooporia tiene su servidor desde que se separó del compartido.
   Pero separar el servidor no repunta las páginas, y tres se
   quedaron llamando al viejo sin que nada fallara a la vista:

     · reporte.html mandaba los avisos al compartido. Los correos
       salían —esa ruta existe en los dos— y la licencia no se
       facturaba nunca, porque el compartido no la tiene. El botón
       del admin sí apuntaba bien, así que la mitad que se probaba
       funcionaba y la que usa el entrenador no.
     · equipo.html pedía el alta al compartido, cuyo correo de
       bienvenida dice «Cada Punto».
     · ayuda.html sigue llamando al compartido a propósito: su ruta
       de chat no existe en el de Hooporia. Está apuntado abajo como
       excepción con nombre, no como olvido.

   Esto es un cortafuegos contra esa clase entera: cualquier página
   de Hooporia que nombre un servidor tiene que nombrar el suyo, y
   la lista de excepciones tiene que caber en una línea.

       node prueba-servidores.js
   ══════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

let fallos = 0;
const ok  = (m) => console.log('  ok   ' + m);
const mal = (m) => { fallos++; console.log('  MAL  ' + m); };

const MIO   = 'hooporia-server.onrender.com';
const AJENO = 'basketball-money-payments.onrender.com';

/* Las excepciones llevan el porqué escrito aquí. Una excepción sin
   motivo es un fallo que alguien apuntó en vez de arreglar. */
const PERMITIDO = {
  'ayuda.html': 'la ruta /coach/chat sólo existe en el compartido'
};

/* Y los sitios: cadapunto.com no se nombra en una página de
   Hooporia. Ese fue el fallo que costó la mañana del día que el
   enlace de alta de jugador llevaba al otro producto. */
const SITIO_AJENO = /cadapunto\.com/;

console.log('\n1 · El servidor que nombra cada página\n');
const paginas = fs.readdirSync(__dirname)
  .filter(f => f.endsWith('.html'))
  .sort();

for (const f of paginas) {
  const s = fs.readFileSync(path.join(__dirname, f), 'utf8');
  const tieneAjeno = s.indexOf(AJENO) !== -1;
  const tieneMio   = s.indexOf(MIO) !== -1;

  if (!tieneAjeno && !tieneMio) continue;          // no habla con ningún servidor

  if (tieneAjeno && PERMITIDO[f]) {
    ok(f + ' llama al compartido a propósito — ' + PERMITIDO[f]);
  } else if (tieneAjeno) {
    /* Se dice QUÉ ruta se va al servidor que no toca: saber que la
       cadena está no dice si es el alta, los avisos o el chat, y
       son tres arreglos distintos. */
    const rutas = (s.match(/(?:SERVER|API|SERVIDOR)\s*\+\s*'(\/[a-z/-]+)'/g) || [])
      .map(x => x.replace(/.*'(\/.*)'/, '$1'));
    mal(f + ' llama al servidor compartido' +
        (rutas.length ? ' (' + rutas.join(', ') + ')' : '') +
        ' — y no está en la lista de excepciones');
  } else {
    ok(f + ' llama al servidor de Hooporia');
  }
}

console.log('\n2 · Y ninguna nombra el sitio del otro producto\n');
let sucias = 0;
for (const f of paginas) {
  const s = fs.readFileSync(path.join(__dirname, f), 'utf8');
  const lineas = s.split('\n');
  /* Un comentario que CUENTA el fallo antiguo no es el fallo: los
     dos sitios donde se explica por qué un enlace no se arma con
     location.origin nombran cadapunto.com a propósito, y borrar esa
     explicación para que pase una prueba sería tirar justo lo que
     hace falta recordar.

     Hay que llevar la cuenta de si estamos DENTRO de un bloque
     /* ... *\/ y no mirar sólo cómo empieza cada línea: esas
     explicaciones ocupan ocho renglones y los de en medio empiezan
     por una palabra cualquiera. La primera versión de esto los
     marcó a los cuatro. */
  let dentro = false;
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const abre  = linea.lastIndexOf('/*');
    const cierra = linea.lastIndexOf('*/');
    const eraComentario = dentro;
    if (!dentro && abre !== -1 && cierra < abre) dentro = true;
    else if (dentro && cierra !== -1) dentro = false;

    if (!SITIO_AJENO.test(linea)) continue;
    const t = linea.trim();
    if (eraComentario || dentro) continue;
    if (t.indexOf('//') === 0 || t.indexOf('*') === 0 || t.indexOf('/*') === 0) continue;
    sucias++;
    mal(f + ':' + (i + 1) + ' nombra cadapunto.com — ' + t.slice(0, 72));
  }
}
if (!sucias) ok('ninguna página de Hooporia nombra cadapunto.com fuera de un comentario');

console.log('\n' + (fallos === 0
  ? '✓ cada página llama a su casa'
  : '✗ ' + fallos + ' fallo(s)'));
process.exit(fallos === 0 ? 0 : 1);
