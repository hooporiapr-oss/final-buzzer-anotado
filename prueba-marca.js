/* ════════════════════════════════════════════════════════════════
   LA MARCA — en todo el repo, de una vez

   Esto existe porque se me escaparon seis ficheros. Las páginas que
   adapté quedaron bien y las que copié "sin tocar" se quedaron con
   el nombre del otro producto en el título de la pestaña, en el pie
   que dice qué somos, y en el aviso del demo. Se desplegó así.

   Y la primera versión de esta prueba volvió a dejar pasar lo mismo,
   dos veces el mismo día, porque buscaba en el código y no en lo que
   lee una persona:

   1 · 'ANOTADO'. La marca de la cabecera va en versales. Buscando
       'Anotado' con A y el resto en minúscula, las trece cabeceras
       del sitio pasaron limpias. El nombre viejo estaba en la
       esquina de cada página.

   2 · 'cada&nbsp;<em>punto</em>&nbsp;<i>cuenta</i>'. Cuatro páginas
       —prometer.html entre ellas, la que abre un padrino— llevaban
       la marca de Cada Punto entera. Ningún patrón de "Cada Punto"
       la encuentra: entre las dos palabras hay una entidad y una
       etiqueta, así que la cadena "Cada Punto" no existe en el
       fichero. Lo que existe es en la pantalla.

   De ahí la regla de esta prueba: se busca en el TEXTO, con las
   etiquetas fuera y las entidades traducidas, y también en el código
   en crudo, porque hay nombre en sitios que no son texto —el content
   de un meta, un title, un alt— que al quitar etiquetas desaparecen.
   Las dos vistas, y lo que salte en cualquiera cuenta.

   ── Mayúsculas: ni sensible ni insensible ────────────────────────
   'anotado' en minúscula es castellano corriente —"lo que ha anotado
   cada uno", "el punto queda anotado"— y está en varias páginas con
   toda la razón. Y 'cada punto' en minúscula también ("por cada
   punto que meta"), igual que 'Cada punto' al empezar una frase.
   Buscar sin distinguir mayúsculas llena esto de falsos positivos y
   una prueba con falsos positivos se desactiva a la semana; buscar
   distinguiéndolas es lo que dejó pasar ANOTADO.

   Así que se busca sin distinguir y luego se mira lo encontrado: de
   'anotado' sólo se perdona lo que venga todo en minúscula, y de
   'cada punto' sólo lo que lleve la segunda palabra en minúscula,
   que es la que hace marca. ANOTADO, Anotado, CADA PUNTO y Cada
   Punto saltan; anotado, cada punto y Cada punto no.

   ── Y al revés ───────────────────────────────────────────────────
   No basta con que no esté el nombre malo: una página que perdiera
   el nombre bueno pasaría esta prueba callada. Así que también se
   exige que cada página diga 'Hooporia' —en cualquier caja, que la
   cabecera va en versales— al menos una vez.

   Lo que va en un comentario no cuenta: no lo lee un entrenador.
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

let fallos = 0;
const ok  = (m) => console.log('  ok   ' + m);
const mal = (m) => { fallos++; console.log('  MAL  ' + m); };

/* Quita comentarios de JS y de HTML: lo que va en un comentario no
   lo lee un entrenador. */
function sinComentarios(s){
  return s.replace(/<!--[\s\S]*?-->/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '');
}

/* Lo que queda en la pantalla: fuera las etiquetas, las entidades
   traducidas, y los espacios juntados. Aquí es donde aparece
   'cada punto cuenta' que en el código no está escrito así. */
const ENTIDADES = {
  '&nbsp;': ' ', '&#160;': ' ', '&#xa0;': ' ',
  '&amp;': '&', '&lt;': '<', '&gt;': '>',
  '&quot;': '"', '&#39;': "'", '&apos;': "'",
  '&mdash;': '—', '&ndash;': '–', '&middot;': '·'
};
function texto(s){
  return s.replace(/<[^>]*>/g, ' ')
          .replace(/&[a-z#0-9]+;/gi, (e) => ENTIDADES[e.toLowerCase()] || ' ')
          .replace(/\s+/g, ' ');
}

/* Los valores de atributo, que al quitar etiquetas se van con ellas
   y son justo donde vive el nombre en un meta o en un title. */
function atributos(s){
  const out = [];
  const re = /\b(?:content|title|alt|placeholder|aria-label|value)\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m;
  while ((m = re.exec(s)) !== null) out.push(m[2] !== undefined ? m[2] : m[3]);
  return out.join(' · ');
}

/* Las marcas que no pueden estar donde se vean. Cada una dice qué
   forma se perdona, por lo que explica la cabecera. */
const PROHIBIDOS = [
  {
    nombre: '"Anotado" (nombre retirado)',
    re: /\banotado\b/gi,
    // Sólo se perdona todo-minúscula: ahí es el participio castellano.
    malo: (hit) => hit !== hit.toLowerCase()
  },
  {
    nombre: '"Cada Punto" (el otro producto)',
    re: /\bcada\s+punto\b/gi,
    // La segunda palabra es la que hace marca: "cada punto" y
    // "Cada punto" son castellano; "Cada Punto" y "CADA PUNTO" no.
    malo: (hit) => /\s[A-Z]/.test(hit)
  },
  {
    nombre: 'cadapunto.com',
    re: /cadapunto\.com/gi,
    malo: () => true
  }
];

function buscar(cadena){
  const encontrados = [];
  for (const p of PROHIBIDOS){
    const hits = (cadena.match(p.re) || []).filter(p.malo);
    if (hits.length){
      const formas = [...new Set(hits)].join(', ');
      encontrados.push(hits.length + ' × ' + p.nombre + ' [' + formas + ']');
    }
  }
  return encontrados;
}

/* ── La marca, por dónde está y no por cómo se escribe ────────────
   Buscar nombres no basta, y la prueba de mutación lo enseñó: la
   marca de Cada Punto va escrita en MINÚSCULA en el código
   —cada&nbsp;<em>punto</em>&nbsp;<i>cuenta</i>— y la pinta en
   versales el CSS. Por caja es idéntica al castellano corriente
   "cada punto", así que perdonar la minúscula —que hay que
   perdonarla, está en varias frases— es perdonar justo la marca
   ajena entera.

   Lo que la distingue no son las palabras: es el sitio. Es lo que
   hay dentro del elemento de marca. Así que eso se comprueba
   aparte: lo que lea una persona en la esquina de la página tiene
   que ser HOOPORIA. y nada más. Sea cual sea la caja, sea cual sea
   la etiqueta que lo parta por dentro.

   Las tres páginas del juego no llevan ese elemento —son lienzo— y
   salen dichas por su nombre, que un hueco en silencio es como
   empezó todo esto. */
const MARCA_ESPERADA = 'HOOPORIA.';
function marca(s){
  const m = /<a[^>]*class="(?:mark|brand)"[^>]*>([\s\S]*?)<\/a>/i.exec(s);
  if (!m) return null;
  return texto(m[1]).replace(/\s+/g, '');
}

const archivos = fs.readdirSync(__dirname).filter(f => /\.html$/.test(f)).sort();
console.log(archivos.length + ' páginas\n');

for (const f of archivos){
  const limpio = sinComentarios(fs.readFileSync(path.join(__dirname, f), 'utf8'));

  /* Las dos vistas: lo que se lee en pantalla y el código en crudo
     con sus atributos. Lo que salte en cualquiera de las dos cuenta,
     porque cada una ve lo que la otra no. */
  const vistas = {
    'en pantalla': texto(limpio),
    'en atributos': atributos(limpio),
    'en el código': limpio
  };

  const encontrados = [];
  for (const [donde, cadena] of Object.entries(vistas)){
    for (const e of buscar(cadena)) encontrados.push(donde + ': ' + e);
  }

  const nuestro = (texto(limpio).match(/hooporia/gi) || []).length
                + (atributos(limpio).match(/hooporia/gi) || []).length;

  /* El elemento de marca, que es lo que mira una persona primero. */
  const m = marca(limpio);
  if (m !== null && m !== MARCA_ESPERADA){
    encontrados.push('la marca de la cabecera dice "' + m +
                     '" y tendría que decir "' + MARCA_ESPERADA + '"');
  }

  if (encontrados.length){
    mal(f);
    for (const e of [...new Set(encontrados)]) console.log('         → ' + e);
    // La línea, que es lo que ahorra el tiempo.
    const lineas = limpio.split('\n');
    for (let i = 0; i < lineas.length; i++){
      if (buscar(lineas[i]).length || buscar(texto(lineas[i])).length){
        console.log('         línea ' + (i + 1) + ': ' + lineas[i].trim().slice(0, 90));
        break;
      }
    }
  } else if (!nuestro){
    mal(f + ': no dice "Hooporia" en ningún sitio visible');
  } else {
    ok(f + ' (' + nuestro + ' × Hooporia' +
       (m === null ? ', sin elemento de marca' : '') + ')');
  }
}

console.log('\n' + (fallos === 0
  ? '✓ todas las páginas dicen Hooporia y ninguna nombra otra marca'
  : '✗ ' + fallos + ' página(s) con problema de marca'));
process.exit(fallos === 0 ? 0 : 1);
