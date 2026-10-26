/* ══════════════════════════════════════════════════════════════════
   LA SALIDA DE CADA TABLERO

   Tres páginas de juego y ninguna tenía salida propia hacia donde
   estaba el nene antes:

   · fortress-vr.html —el scrimmage, el tablero que la portada
     enseña— no tenía ni un enlace. Se entra desde la portada y la
     única forma de volver era el botón de atrás del navegador, que
     en un casco no está donde uno cree.

   · fortress.html y fortress131.html sí tenían botones, pero los
     tres iban a index.html. Desde que la portada enseña un solo
     tablero, a estas dos páginas se llega por un enlace, y quien
     cae ahí buscando los cuatro sets tenía que volver a la
     portada y empezar otra vez.

   Lo que se comprueba aquí no es que exista un <a>, que eso lo ve
   cualquiera: es CUÁNDO se ve y A DÓNDE va.

   El cuándo es lo que importa en el scrimmage. El botón se ve en la
   portada y en la pantalla de final, y NO se ve mientras se juega:
   una corrida oficial es una sola en la vida de ese reto, y un
   enlace en una esquina durante el juego es una corrida perdida por
   un toque sin querer. La página enciende y apaga esas capas en una
   docena de puntos, así que el botón no se apaga a mano en cada
   sitio —se ata al estado de las capas—, y esto comprueba el atado
   de verdad, en un navegador de verdad, moviendo las capas.

   El a dónde es lo que importa en las otras dos. setBackLink() les
   reescribe el href a los tres botones de siempre cuando hay reto;
   si alguien mete el botón nuevo en esa lista, el nene vuelve a
   quedarse sin vuelta al scrimmage y nadie se enteraría.

       node prueba-atras.js
   ══════════════════════════════════════════════════════════════════ */
const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
const path = require('path');

let bad = 0;
const ok  = (m) => console.log('  ok   ' + m);
const mal = (m) => { bad++; console.log('  MAL  ' + m); };
const eq  = (a, b, m) => (a === b ? ok(m + (typeof a === 'string' && a ? ' → ' + a : ''))
  : mal(m + '\n         esperaba: ' + b + '\n         vino:     ' + a));

const url = (f, q) => 'file://' + path.resolve(__dirname, f) + (q || '');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
                                    args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });

  /* Una página por prueba, en español, y sin red — con una
     excepción: three.js. El scrimmage se cae entero sin él (el
     fichero toca THREE al cargar), así que sin three.js lo que se
     probaría es una página muerta. Se le sirve de un fichero local
     si está; si no está, se prueba igual pero moviendo las capas a
     mano, que es lo que se podía hacer antes. Supabase sigue
     cortado a propósito: la página tiene que aguantarlo, y de paso
     esa llamada cortada nos dice si se cree oficial. */
  const TRES = (() => {
    const p = '/opt/node-tools/vendor/three.min.js';
    try { return require('fs').existsSync(p) ? p : null } catch (e) { return null }
  })();

  async function abrir(f, q, lang, vista) {
    const p = await b.newPage({ viewport: vista || { width: 430, height: 844 } });
    p.fuera = [];
    /* La dirección ENTERA además del dominio. El dominio sólo no
       alcanza para el botón de practicar: lo que importa de ése no es
       que salga a hooporia.mobi, es que salga al hub CON su equipo en
       la cola — sin ella el jugador se queda sin equipo para siempre,
       y eso no se ve en el nombre del host. */
    p.fueraUrl = [];
    await p.route('**/*', r => {
      const u = r.request().url();
      if (u.startsWith('file:')) return r.continue();
      if (TRES && /three\.min\.js/.test(u)) return r.fulfill({ path: TRES });
      try { p.fuera.push(new URL(u).hostname); p.fueraUrl.push(u) } catch (e) {}
      return r.abort();
    });
    await p.addInitScript(l => {
      try { localStorage.setItem('cp-lang', l); localStorage.setItem('cfh_lang', l);
            localStorage.setItem('fc-lang', l) } catch (e) {}
    }, lang || 'es');
    await p.goto(url(f, q), { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(250);
    return p;
  }

  // ── 1 · El scrimmage ───────────────────────────────────────────
  console.log('\n1 · fortress-vr.html, el scrimmage: salida a la portada\n');
  {
    const p = await abrir('fortress-vr.html');

    const a = await p.evaluate(() => {
      const el = document.getElementById('atras');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { href: el.getAttribute('href'),
               destino: el.href.split('/').pop(),
               texto: el.textContent.trim(),
               tag: el.tagName,
               ancho: Math.round(r.width), alto: Math.round(r.height),
               // Que no se lo coma el botón de idioma ni el marcador.
               izq: Math.round(r.left), arriba: Math.round(r.top) };
    });
    if (!a) { mal('no hay botón de volver en el scrimmage'); }
    else {
      eq(a.tag, 'A', 'es un enlace de verdad, no un botón con onclick');
      eq(a.href, 'index.html', 'y va a la portada');
      eq(a.destino, 'index.html', 'el destino resuelto, por si el href fuera relativo raro');
      eq(a.texto, '← Inicio', 'en español dice Inicio');
      eq(a.ancho > 60 && a.alto > 24, true, 'se puede tocar con el dedo (' + a.ancho + '×' + a.alto + ')');
      eq(a.izq < 40 && a.arriba < 60, true, 'arriba a la izquierda, enfrente del idioma');
    }

    // El inglés sale del mismo sitio que el resto del sitio.
    await p.click('#lang');
    await p.waitForTimeout(80);
    eq(await p.$eval('#atras', e => e.textContent.trim()), '← Home',
       'en inglés dice Home');
    await p.click('#lang');
    await p.waitForTimeout(80);

    /* Y ahora lo que de verdad cierra esto: mover las capas como las
       mueve el juego y ver si el botón obedece. No se llama a
       arrancar() —eso necesita three.js y una tarjeta de vídeo—, se
       hace lo único que arrancar() hace a la vista: tapar la
       portada. */
    const visible = () => p.evaluate(() => {
      const el = document.getElementById('atras');
      return getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
    });
    const capa = (id, oculta) => p.evaluate(([i, o]) => {
      document.getElementById(i).hidden = o;
    }, [id, oculta]);

    eq(await visible(), true, 'en la portada se ve');

    await capa('tapa', true);                 // arranca la tanda
    await p.waitForTimeout(60);
    eq(await visible(), false, 'jugando NO se ve — un toque aquí cuesta la corrida');

    await capa('fin', false);                 // suena la chicharra
    await p.waitForTimeout(60);
    eq(await visible(), true, 'en la pantalla de final vuelve, que es cuando se quiere salir');

    await capa('fin', true);                  // siguiente cuarto
    await p.waitForTimeout(60);
    eq(await visible(), false, 'y se va otra vez al empezar el cuarto siguiente');

    await capa('tapa', false);
    await p.waitForTimeout(60);
    eq(await visible(), true, 'de vuelta en la portada, de vuelta el botón');

    await p.close();
  }

  // ── 1b · El de abajo, el que devuelve a la portada del tablero ──
  console.log('\n1b · fortress-vr.html: el botón de abajo, jugando\n');
  {
    const err = [];
    const p = await abrir('fortress-vr.html');
    p.on('pageerror', e => err.push(String(e).split('\n')[0]));

    /* YA NO SE JUEGA EN ESTA PÁGINA. Desde que el scrimmage son
       cuatro juegos en cuatro páginas, tocar «Scrimmage» sale de
       aquí: escribe la corrida y navega al primer set. Así que el
       estado «jugando» se monta a mano, moviendo las mismas capas
       que movía el juego.

       Lo que se mide sigue valiendo: el botón de abajo aparece y
       desaparece solo, mirando las capas, y eso es lo que evita que
       se quede encima del tablero. Lo que ya no se puede es llegar
       ahí tocando, y por eso no se toca. */
    const jugar = async (si) => {
      await p.evaluate(s => {
        document.getElementById('tapa').hidden = s;
        document.getElementById('hud').hidden = !s;
        document.getElementById('pista').hidden = !s;
      }, si);
      await p.waitForTimeout(120);
    };
    const volverVisible = () => p.evaluate(() => {
      const el = document.getElementById('volver');
      return !el.hidden && getComputedStyle(el).display !== 'none'
             && el.getBoundingClientRect().width > 0;
    });

    eq(await volverVisible(), false, 'en la portada no está — ahí está el juego, sin empezar');

    await jugar(true);
    await p.waitForTimeout(60);
    eq(await volverVisible(), true, 'jugando sí está');

    const caja = await p.evaluate(() => {
      const r = document.getElementById('volver').getBoundingClientRect();
      const pi = document.getElementById('pista').getBoundingClientRect();
      return { texto: document.getElementById('volver').textContent.trim(),
               tag: document.getElementById('volver').tagName,
               ancho: Math.round(r.width), alto: Math.round(r.height),
               abajo: Math.round(innerHeight - r.bottom),
               centrado: Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 3,
               pisaLaPista: !(pi.bottom <= r.top || pi.top >= r.bottom) };
    });
    eq(caja.tag, 'BUTTON', 'es un botón y no un enlace — recargar perdería la tanda');
    eq(caja.texto, '← Volver al tablero', 'y lo dice en español');
    eq(caja.abajo < 30, true, 'pegado abajo (' + caja.abajo + 'px del borde)');
    eq(caja.centrado, true, 'centrado, donde ya está la mano');
    eq(caja.ancho > 100 && caja.alto > 30, true,
       'se toca con el dedo (' + caja.ancho + '×' + caja.alto + ')');
    eq(caja.pisaLaPista, false, 'y la pista de abajo se sube, no se montan');

    /* Lo que de verdad tiene que pasar al tocarlo: la portada del
       TABLERO, sin recargar nada. Si esto llamara a una función que
       da por hecho que three.js ya construyó la escena, reventaría
       aquí y no en la cancha. */
    await p.click('#volver');
    await p.waitForTimeout(120);
    const tras = await p.evaluate(() => ({
      tapa: !document.getElementById('tapa').hidden,
      hud:  !document.getElementById('hud').hidden,
      volver: !document.getElementById('volver').hidden,
      atras: getComputedStyle(document.getElementById('atras')).display !== 'none',
      lang: getComputedStyle(document.getElementById('lang')).display !== 'none'
    }));
    eq(tras.tapa, true,  'al tocarlo vuelve la portada del tablero');
    eq(tras.hud, false,  'y se apaga el marcador');
    eq(tras.volver, false, 'y el botón se va con ella');
    eq(tras.atras, true, 'y reaparece el de salir a la portada del sitio');
    eq(tras.lang, true,  'y el de idioma, que se esconde al arrancar la tanda');
    eq(err.length, 0, 'sin un solo error de javascript' + (err.length ? ': ' + err[0] : ''));
    await p.close();
  }

  /* ── 1b-sal · El botón de practicar es una salida, no un juego ──
     Practicar se mudó al Cognitivo Gym, así que el primer botón de la
     portada ya no arranca nada aquí: sale del sitio. Esto va en su
     propia página porque tocarlo desmonta el documento, y lo que
     venga detrás se encuentra la página a medio irse.

     Lo que protege: que nadie le devuelva el arranque local sin
     querer. Ese mismo botón, con un juego atado, es con el que se
     empieza un cuarto oficial — y ahí NO puede salir del sitio. */
  {
    console.log('\n1b-sal · el botón de practicar sale al gimnasio\n');
    const p = await abrir('fortress-vr.html');
    const rotulo = await p.$eval('#go', e => e.textContent.trim());
    eq(/Cognitivo Gym/i.test(rotulo), true,
       'el primer botón nombra el gimnasio («' + rotulo + '»)');
    await p.click('#go');
    await p.waitForTimeout(400);
    /* AL GIMNASIO. Esto esperaba cognitivo.digital mientras aquél iba
       a ser el sitio principal del gimnasio; desde que el sitio
       principal volvió a ser el recaudador, mandar ahí a quien toca
       PRACTICAR lo devolvería a una página de promesas.

       Se comprueba la dirección entera y no el dominio suelto: lo que
       tiene que salir es el hub CON su equipo, porque sin la cola el
       jugador acaba sin equipo y no sale en el tablero de nadie. */
    const alGimnasio = p.fueraUrl.some(function(u){
      return u.indexOf('hooporia.mobi/fortress-mobile-hub.html?e=demo') !== -1;
    });
    eq(alGimnasio, true, 'y al tocarlo sale hacia el hub del gimnasio, con su equipo' +
       (p.fuera.length ? ' — pidió: ' + p.fuera.join(', ') : ' — no pidió nada fuera'));
    await p.close();
  }

  // ── 1b-bis · El scrimmage sale de esta página ──────────────────
  {
    console.log('\n1b-bis · el scrimmage ya no se juega aquí: sale al primer set\n');
    const p = await abrir('fortress-vr.html');
    const err = []; p.on('pageerror', e => err.push(String(e).split('\n')[0]));

    eq(await p.$eval('#goAmistoso', e => e.textContent.trim()), 'Scrimmage · 4 sets',
       'el segundo botón de la portada es el scrimmage');
    await p.click('#goAmistoso');
    await p.waitForTimeout(900);

    /* ANTES ESTE BOTÓN EMPEZABA A JUGAR AQUÍ MISMO y lo que se medía
       era el botón de abajo, el de volver al tablero. Ahora los
       cuatro sets son cuatro juegos en cuatro páginas, así que lo que
       hace es escribir la corrida y navegar. Se mide eso, que es lo
       que de verdad pasa. */
    const donde = await p.evaluate(() => location.pathname.split('/').pop());
    eq(donde, '002-recall.html', 'tocarlo lleva al primer set');

    const corrida = await p.evaluate(() => {
      try { return JSON.parse(sessionStorage.getItem('cp-corrida')) } catch (e) { return null }
    });
    eq(!!corrida && corrida.q === 1 && corrida.tipo === 'amistoso', true,
       'y la corrida va escrita antes de salir — sin ella el set 1 no tendría dueño');
    eq(err.length, 0, 'sin errores' + (err.length ? ': ' + err[0] : ''));
    await p.close();
  }

  // ── 1b-ter · La foto de la portada ─────────────────────────────
  console.log('\n1b-ter · la foto de la marca en la portada del tablero\n');
  {
    const p = await abrir('fortress-vr.html');
    const foto = await p.evaluate(() => {
      const el = document.getElementById('tapaFoto');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const go = document.getElementById('go').getBoundingClientRect();
      return { src: el.getAttribute('src'),
               ancho: Math.round(r.width), alto: Math.round(r.height),
               proporcion: r.width / r.height,
               alt: el.alt,
               // El botón de empezar tiene que seguir cabiendo.
               botonALaVista: go.bottom <= innerHeight && go.top >= 0 };
    });
    if (!foto) { mal('no hay foto en la portada del tablero'); }
    else {
      eq(foto.src, 'compartir.jpg', 'es nuestra imagen de compartir');
      /* Lo que de verdad se comprueba: que la caja tenga la
         proporción del fichero. El atributo height="630" del <img>
         llega como alto fijo y, sin height:auto, aspect-ratio no
         manda: la caja sale cuadrada de más, el object-fit:cover
         recorta por arriba y se lleva el 21 — que es el número que
         cuenta la historia entera. Un recorte así no da error en
         ninguna parte; sólo desaparece lo importante. */
      eq(Math.abs(foto.proporcion - 1200 / 630) < 0.02, true,
         'y se ve entera, sin recortar el 21 (' + foto.ancho + '×' + foto.alto + ')');
      eq(foto.botonALaVista, true, 'sin empujar el botón de empezar fuera de la pantalla');
      /* El alt se comprueba por lo que TIENE que cumplir, no por la
         frase exacta. Llevaba la frase escrita a mano y el día que
         cambió la imagen —se fue el aro, el nene ya no tira— la
         prueba cantó dos fallos por un alt que era correcto y
         describía bien el dibujo nuevo. Una prueba que hay que
         editar cada vez que mejora la página no vigila: estorba.

         Lo que de verdad importa: que diga algo, que nombre la
         cuenta que cuenta la historia, y que CAMBIE de idioma — que
         es un atributo y no texto de la etiqueta, y por eso se
         olvida. */
      eq(foto.alt.length > 25, true, 'con un alt que dice algo');
      eq(/1, *3, *6, *10, *15, *21/.test(foto.alt), true,
         'y que nombra la escalera de puntos');
      var altEs = foto.alt;
    }
    await p.click('#lang');
    await p.waitForTimeout(80);
    var altEn = await p.$eval('#tapaFoto', e => e.alt);
    eq(altEn.length > 25 && altEn !== altEs, true,
       'y en inglés el alt cambia — es un atributo, no texto de la etiqueta');
    eq(/1, *3, *6, *10, *15, *21/.test(altEn), true,
       'y el inglés también nombra la escalera');
    await p.close();

    /* En pantalla baja —un teléfono tumbado, el casco— la foto
       sobra: lo que hace falta ahí es el botón. */
    const bajo = await abrir('fortress-vr.html', '', 'es', { width: 740, height: 420 });
    eq(await bajo.$eval('#tapaFoto', e => getComputedStyle(e).display), 'none',
       'en una pantalla baja la foto se quita sola');
    eq(await bajo.evaluate(() => {
      const r = document.getElementById('go').getBoundingClientRect();
      return r.bottom <= innerHeight && r.top >= 0;
    }), true, 'y el botón de empezar sigue a la vista');
    await bajo.close();
  }

  // ── 1c · Y en una corrida oficial, no ──────────────────────────
  console.log('\n1c · fortress-vr.html: en corrida oficial no aparece\n');
  {
    /* Una corrida oficial es una sola en la vida de ese reto. Un
       botón abajo que la abandona de un toque sin querer es la
       forma más barata de perderla, y es un toque que no se puede
       deshacer. */
    const p = await abrir('fortress-vr.html', '?c=RETO1&p=JUG1&k=LLAVE&official=1');
    /* Que se cree oficial no se puede preguntar desde fuera —todo
       el fichero vive dentro de una función—, pero se ve: sólo en
       ese caso sale a buscar el estado del juego a Supabase. Sin
       esta comprobación, la de abajo pasaría también el día que la
       página dejara de reconocer sus propios parámetros. */
    eq(p.fuera.some(h => /supabase/.test(h)), true,
       'la página se sabe oficial con esos parámetros (va a buscar su juego)');
    await p.evaluate(() => {
      document.getElementById('tapa').hidden = true;
      document.getElementById('hud').hidden = false;
    });
    await p.waitForTimeout(60);
    eq(await p.evaluate(() => document.getElementById('volver').hidden), true,
       'y jugándola, el botón de abajo no está');
    await p.close();
  }

  // ── 2 · Los otros dos tableros ─────────────────────────────────
  for (const f of ['fortress.html', 'fortress131.html']) {
    console.log('\n2 · ' + f + ': salida al scrimmage, abajo\n');
    const p = await abrir(f);

    const a = await p.evaluate(() => {
      const el = document.getElementById('toScrim');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const best = document.getElementById('bestLine');
      return { href: el.getAttribute('href'),
               destino: el.href.split('/').pop(),
               texto: el.textContent.trim(),
               tag: el.tagName,
               ancho: Math.round(r.width), alto: Math.round(r.height),
               // Dentro de la portada del juego, y por debajo de todo.
               enIntro: !!el.closest('#screen-intro'),
               debajo: !!best && r.top >= best.getBoundingClientRect().bottom };
    });
    if (!a) { mal('no hay botón al scrimmage en ' + f); }
    else {
      eq(a.tag, 'A', 'es un enlace');
      eq(a.href, 'fortress-vr.html', 'y va al scrimmage, no a la portada del sitio');
      eq(a.destino, 'fortress-vr.html', 'el destino resuelto');
      eq(a.enIntro, true, 'vive en la pantalla de portada del juego');
      eq(a.debajo, true, 'y abajo, debajo de la mejor marca');
      eq(a.ancho > 60 && a.alto > 24, true, 'se toca con el dedo (' + a.ancho + '×' + a.alto + ')');
      /* El texto se compara en minúsculas a propósito: .to-scrim
         lleva text-transform:uppercase y lo que se lee en pantalla
         va gritado. La caja la decide la hoja de estilo, no el
         texto, y una prueba que mire la caja falla el día que
         alguien quite el uppercase sin que nada esté roto. */
      eq(a.texto.toLowerCase(), '← el scrimmage', 'en español dice El scrimmage');
    }

    await p.click('#langBtn');
    await p.waitForTimeout(80);
    eq((await p.$eval('#toScrim', e => e.textContent.trim())).toLowerCase(),
       '← the scrimmage', 'en inglés dice The scrimmage');
    await p.close();

    /* Y con un reto encima. setBackLink() reescribe los tres botones
       de siempre a index.html cuando hay c y p; este no es de esa
       lista y tiene que seguir apuntando al scrimmage. */
    const o = await abrir(f, '?c=RETO1&p=JUG1&k=LLAVE&official=1');
    eq(await o.$eval('#toScrim', e => e.getAttribute('href')), 'fortress-vr.html',
       'en corrida oficial setBackLink no se lo lleva a index.html');

    /* Y de paso los tres de siempre, que es donde salió un 404
       escondido: en fortress131.html el cambio de marca convirtió
       'challenges.html?c=' + reto en 'index.html' + reto, así que
       con un reto encima los tres botones apuntaban a
       index.htmlRETO1&p=… Un enlace roto que sólo aparece cuando
       hay reto es un enlace que nadie prueba. */
    for (const id of ['introBack', 'homeBtn', 'backToPledge']) {
      eq(await o.$eval('#' + id, e => e.getAttribute('href')), 'index.html',
         '#' + id + ' con reto va a la portada, sin cola de parámetros');
    }
    await o.close();

    const t = await abrir(f, '?tryout=DEMO9');
    for (const id of ['introBack', 'homeBtn', 'backToPledge']) {
      eq(await t.$eval('#' + id, e => e.getAttribute('href')), 'index.html',
         '#' + id + ' en prueba abierta, igual');
    }
    await t.close();
  }

  await b.close();
  console.log('\n' + (bad === 0 ? '✓ los tres tableros tienen salida'
                                : '✗ ' + bad + ' fallo(s)'));
  process.exit(bad === 0 ? 0 : 1);
})();
