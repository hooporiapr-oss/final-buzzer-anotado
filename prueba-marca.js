/* ════════════════════════════════════════════════════════════════
   LA MARCA — en todo el repo, de una vez

   Esto existe porque se me escaparon seis ficheros. Las páginas que
   adapté quedaron bien y las que copié "sin tocar" se quedaron con
   el nombre del otro producto en el título de la pestaña, en el pie
   que dice qué somos, y en el aviso del demo. Se desplegó así.

   Comprobarlo página por página no lo cazó, porque las pruebas sólo
   miraban las páginas que yo había adaptado. Esta mira TODOS los
   .html del repo, incluidos los que nadie recuerda haber tocado.

   Lo único que se permite es dentro de un comentario: el de index.html
   dice que la hoja de estilo es la misma que la de cadapunto.com, y
   eso es verdad y no lo ve nadie.
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

let fallos = 0;
const ok  = (m) => console.log('  ok   ' + m);
const mal = (m) => { fallos++; console.log('  MAL  ' + m); };

/* Quita comentarios de JS y de HTML antes de buscar: lo que va en un
   comentario no lo lee un entrenador. */
function sinComentarios(s){
  return s.replace(/<!--[\s\S]*?-->/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '');
}

const archivos = fs.readdirSync(__dirname).filter(f => /\.html$/.test(f)).sort();
console.log(archivos.length + ' páginas\n');

for (const f of archivos){
  const crudo = fs.readFileSync(path.join(__dirname, f), 'utf8');
  const s = sinComentarios(crudo);
  const marca  = (s.match(/Cada Punto/g) || []).length;
  const dominio = (s.match(/cadapunto\.com/g) || []).length;
  if (marca || dominio){
    mal(f + ': ' + marca + ' × "Cada Punto"' + (dominio ? ', ' + dominio + ' × cadapunto.com' : ''));
    // Enseñar la primera, que es lo que ahorra el tiempo.
    const l = s.split('\n').find(l => /Cada Punto|cadapunto\.com/.test(l));
    if (l) console.log('         → ' + l.trim().slice(0, 100));
  } else {
    ok(f);
  }
}

console.log('\n' + (fallos === 0
  ? '✓ ninguna página nombra el otro producto donde se vea'
  : '✗ ' + fallos + ' página(s) con el nombre del otro producto'));
process.exit(fallos === 0 ? 0 : 1);
