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
   exige que cada página diga 'Cada Punto Cuenta' —en cualquier caja, que la
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
    nombre: '"Hooporia" (nombre retirado)',
    re: /\bhooporia\b/gi,
    /* No se perdona ninguna forma. No es una palabra castellana: si
       aparece, es el nombre viejo que se quedó. La única excepción
       está fuera del texto, en hooporia-server.onrender.com, y es la
       dirección de un servicio de Render — se comprueba más abajo
       que ninguna PÁGINA diga el nombre, y el servidor se mira en
       prueba-servidores.js. */
    malo: () => true
  },
  {
    nombre: 'hooporia.com (dominio retirado)',
    re: /hooporia\.com/gi,
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
   ESTA COMPROBACIÓN ES LA QUE MANDA, y desde el 22 de octubre de
   2026 es casi la única que puede mandar.

   Mientras la marca fue "Hooporia" se podía contar la palabra: no
   existe en castellano, así que cada aparición era la marca. "Cada
   Punto Cuenta" no es así. Es una frase corriente —"cada punto
   cuenta" lo dice padrinos.html hablando de promesas, y lo dice
   bien— y además es LITERALMENTE de lo que va el producto: una
   promesa por cada punto. Contar las palabras aquí no distingue la
   marca del castellano, y nunca va a distinguirla.

   Lo que la distingue no son las palabras: es el sitio. Es lo que
   hay dentro del elemento de marca. Lo que lea una persona en la
   esquina de la página tiene que ser CADA PUNTO CUENTA. y nada
   más — sea cual sea la caja, sea cual sea la etiqueta que lo
   parta por dentro.

   Las tres páginas del juego no llevan ese elemento —son lienzo— y
   salen dichas por su nombre, que un hueco en silencio es como
   empezó todo esto. */
/* DOS NOMBRES, Y CADA UNO EN SU SITIO.

   Cognitivo Gym es la marca —la casa— y Cada Punto Cuenta es el
   recaudador que corre dentro de ella. La portada ya lleva el nombre
   de la casa; las demás páginas son páginas de recaudar y siguen
   llevando el del recaudador.

   Esto se irá moviendo página por página según avance el cambio de
   marca. Mientras tanto, la lista dice exactamente cuáles ya pasaron
   — que es mejor que una regla floja que deje pasar cualquiera de los
   dos en cualquier sitio y no cante nada. */
const MARCA_CASA = 'COGNITIVO GYM.';
const MARCA_RECAUDA = 'CADA PUNTO CUENTA.';
const PAGINAS_DE_LA_CASA = ['index.html'];
function marcaEsperada(f){
  return PAGINAS_DE_LA_CASA.indexOf(f) !== -1 ? MARCA_CASA : MARCA_RECAUDA;
}
function marca(s){
  const m = /<a[^>]*class="(?:mark|brand)"[^>]*>([\s\S]*?)<\/a>/i.exec(s);
  if (!m) return null;
  /* Los huecos se APRIETAN, no se borran. Antes se borraban todos,
     y con una marca de una palabra daba igual: HOOPORIA partida en
     <em>HOOPO</em><i>RIA</i> tenía que comparar igual que entera.
     Con tres palabras borrarlos devuelve CADAPUNTOCUENTA. y la
     prueba canta dieciséis páginas que están bien.

     Apretando se consiguen las dos cosas: el salto de línea entre
     etiquetas y el &nbsp; cuentan como un hueco, y la marca sigue
     comparando igual la escriba quien la escriba. */
  return texto(m[1])
           .replace(/\s+/g, ' ')
           /* Y el punto se vuelve a pegar. Va en su propia etiqueta
              —<i>.</i>, que el CSS pinta en naranja— así que al
              quitar etiquetas queda un hueco delante y la marca sale
              "CADA PUNTO CUENTA ." con un espacio que nadie ve en la
              página. Eso es un artefacto de leer el código, no una
              marca mal escrita. */
           .replace(/\s+([.!?])/g, '$1')
           .trim();
}

const archivos = fs.readdirSync(__dirname).filter(f => /\.html$/.test(f)).sort();
console.log(archivos.length + ' páginas\n');

for (const f of archivos){
  /* Fuera la dirección del servicio de Render antes de buscar
     nombres. Lleva "hooporia" dentro y no es marca: es el host al
     que llaman cuatro páginas, y renombrarlo cambiaría la url del
     webhook de Stripe. Que ninguna página lo diga de más se
     comprueba en prueba-servidores.js, que es su sitio. */
  /* Y fuera también la dirección del gimnasio móvil, por la misma
     razón: lleva "hooporia" dentro y no es marca, es dónde vive el
     hub de los juegos. El botón de la cabecera de index.html sale
     ahí. Esta excepción se había retirado cuando el botón de
     practicar pasó a cognitivo.digital y no quedaba ninguna url con
     la palabra dentro; volvió el 25 de octubre de 2026 con la
     cabecera nueva.

     Es a la DIRECCIÓN ENTERA, no a la palabra: "Hooporia" escrito
     como marca sigue cayendo, que es lo que esto vigila. Cuando el
     hub se mude a cognitivogym.com, esta excepción se retira —y hay
     que retirarla, porque una excepción que ya no tapa nada acaba
     tapando otra cosa por accidente. */
  const limpio = sinComentarios(fs.readFileSync(path.join(__dirname, f), 'utf8'))
                   .split('hooporia-server.onrender.com').join('EL-SERVIDOR')
                   .split('hooporia.mobi').join('EL-GIMNASIO');

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

  /* La cuenta, ahora floja a propósito. Con "Hooporia" cada
     aparición era la marca; con "cada punto cuenta" no se puede
     saber si lo que se contó es la marca o una frase sobre promesas.
     Se deja porque una página que no dice el nombre NI LLEVA
     elemento de marca sigue siendo un fallo que conviene cantar —
     pero el que de verdad comprueba la marca es el bloque de arriba,
     y es el que hay que mirar cuando esto falle. */
  const nuestro = (texto(limpio).match(/cada\s+punto\s+cuenta/gi) || []).length
                + (atributos(limpio).match(/cada\s+punto\s+cuenta/gi) || []).length;

  /* El elemento de marca, que es lo que mira una persona primero. */
  const m = marca(limpio);
  const esperada = marcaEsperada(f);
  if (m !== null && m !== esperada){
    encontrados.push('la marca de la cabecera dice "' + m +
                     '" y tendría que decir "' + esperada + '"');
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
    mal(f + ': no dice "Cada Punto Cuenta" en ningún sitio visible');
  } else {
    ok(f + ' (' + nuestro + ' × Cada Punto Cuenta' +
       (m === null ? ', sin elemento de marca' : '') + ')');
  }
}

/* ── Que las imágenes de marca estén, y existan ──────────────────
   Una página puede nombrar a Cada Punto Cuenta perfectamente y seguir saliendo
   en blanco cuando un entrenador la manda por WhatsApp. Esto mira las
   dos cosas que deciden eso: que cada página apunte al icono y a la
   imagen de compartir, y que los dos ficheros existan de verdad.

   La de compartir se exige en ABSOLUTO: WhatsApp y los demás no
   resuelven rutas relativas, así que una relativa da exactamente la
   misma vista previa en blanco que no poner nada — y pasaría
   cualquier prueba que sólo mirara si la etiqueta está. */
const IMAGENES = ['logo.png', 'compartir.jpg'];
console.log('');
for (const img of IMAGENES){
  fs.existsSync(path.join(__dirname, img))
    ? ok(img + ' existe')
    : mal(img + ' NO existe, y las páginas lo nombran');
}
for (const f of archivos){
  const s = fs.readFileSync(path.join(__dirname, f), 'utf8');
  const icono = /<link[^>]+rel="icon"[^>]+href="logo\.png"/.test(s);
  const abs   = /og:image"[^>]+content="https:\/\/cognitivo\.digital\/compartir\.jpg"/.test(s);
  const rel   = /og:image"[^>]+content="(?!https?:)/.test(s);
  /* La imagen de compartir se exige donde compartir el enlace tiene
     sentido. Una página marcada noindex —el admin— no se manda por
     WhatsApp ni sale en una búsqueda: está detrás de una sesión y
     sólo entra quien ya sabe que existe. El icono de pestaña sí se
     le pide, que ése se ve en cuanto se abre. */
  const privada = /<meta[^>]+name="robots"[^>]+noindex/.test(s);
  if (!icono)              mal(f + ': sin icono de pestaña');
  else if (rel)            mal(f + ': og:image en relativo, la vista previa saldría en blanco');
  else if (!abs && !privada) mal(f + ': sin og:image absoluta');
}
if (!fallos) ok('cada página lleva su icono, y las públicas su imagen de compartir');

/* ── El prefijo del codigo que se lleva el entrenador ────────────
   Es lo unico de la marca que alguien copia a mano y vuelve a
   teclear, y es el unico sitio donde la marca NO es texto de la
   pagina: se arma en JavaScript en el momento de crear el codigo.
   Por eso sobrevivio al cambio de nombre — todo lo demas se leia en
   el marcado y esto no.

   Y no se arregla despues: el codigo se enseña una vez y la base
   solo guarda su hash, asi que un prefijo equivocado se va con el
   entrenador y no vuelve. */
console.log('');
{
  const a = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8');
  const m = a.match(/var recien = '([A-Z]+)-'/);
  if (!m) mal('no encuentro el prefijo del codigo en admin.html');
  else {
    const p = m[1];
    const retiradas = ['HOO', 'HOOP', 'ANOT', 'APOY'];
    retiradas.indexOf(p) === -1
      ? ok('el codigo del entrenador empieza por ' + p + '-, y no por una marca retirada')
      : mal('el codigo del entrenador todavia empieza por ' + p + '-');
  }
}

console.log('\n' + (fallos === 0
  ? '✓ todas las páginas dicen Cada Punto Cuenta, nombran sus imágenes y ninguna nombra otra marca'
  : '✗ ' + fallos + ' página(s) con problema de marca'));
process.exit(fallos === 0 ? 0 : 1);
