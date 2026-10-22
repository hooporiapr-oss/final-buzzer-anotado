/* ══════════════════════════════════════════════════════════════════
   LA PÁGINA DE CONSEGUIR PADRINOS

   Aquí aterriza un nene que va a salir a pedirle dinero a su abuela.
   Lo que esta página le diga, él se lo va a repetir a quince personas
   que confían en él — así que una frase equivocada aquí no se queda
   aquí: sale por la boca de un nene de doce años.

   Y tenía dos equivocadas de las caras:

     · HABLABA DEL MODELO VIEJO. Esta página viene de Cada Punto,
       donde la puntuación era del EQUIPO y era la misma para todos.
       En Hooporia cada jugador anota lo suyo. La tabla de textos ya
       estaba corregida, pero el markup no, y hay tres sitios donde el
       markup sí se lee: la vista previa de WhatsApp, Google, y el
       parpadeo antes de que paint() reescriba. Doce cadenas.

     · CONTRADECÍA AL SERVIDOR SOBRE EL DINERO. «No hay cantidad muy
       pequeña para pedir», decía. Pero el servidor cierra toda
       promesa que al final dé menos de $5 —invoice_status
       'too_small', no se debe nada y al programa no le llega nada— y
       prometer.html se lo dice al padrino en los dos idiomas. Un nene
       podía salir a conseguir padrinos de diez centavos y descubrir
       después que no contaban.

   Lo que mira:

     1 · que el markup y la tabla digan lo mismo, palabra por palabra
     2 · que no quede rastro del modelo del equipo
     3 · el piso de $5, dicho y calculado
     4 · la aritmética de la tabla de ejemplo y de la calculadora
     5 · los dos idiomas, y que no falte una llave en ninguno
     6 · que quepa en un teléfono y no hable con ningún servidor

       node prueba-padrinos.js
   ══════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

let fallos = 0;
const ok  = (m) => console.log('  ok   ' + m);
const mal = (m) => { fallos++; console.log('  MAL  ' + m); };
const eq  = (a, b, m) => (JSON.stringify(a) === JSON.stringify(b) ? ok(m)
  : mal(m + '\n         esperaba: ' + JSON.stringify(b) +
            '\n         vino:     ' + JSON.stringify(a)));
const si  = (v, m) => (v ? ok(m) : mal(m));

const AQUI = __dirname;
const FICHERO = path.join(AQUI, 'padrinos.html');
const PAGINA = 'file://' + FICHERO;
const fuente = fs.readFileSync(FICHERO, 'utf8');

/* La tabla de textos, sacada del fichero tal cual está. */
const _i = fuente.indexOf('var T = {'), _j = fuente.indexOf('\n};', _i);
const T = new Function('return ' + fuente.slice(_i + 8, _j + 2))();

(async () => {
const navegador = await chromium.launch();

// ── 1 · El markup dice lo mismo que la tabla ──────────────────────
console.log('\n1 · El markup y la tabla, palabra por palabra\n');
{
  /* paint() reescribe cada [data-t] al cargar, así que el markup no
     se ve... salvo en los tres sitios donde sí: la vista previa al
     compartir, el robot de Google, y el parpadeo de antes. Por eso
     doce frases del equipo sobrevivieron meses sin que nadie las
     viera. Que coincidan no es pulcritud: es que las tres copias de
     la página digan lo mismo. */
  const re = /(<([a-z0-9]+)(?:[^>]*?)\bdata-t="([^"]+)"(?:[^>]*?)>)([\s\S]*?)(<\/\2>)/g;
  const fuera = [], sinLlave = [];
  const limpia = (x) => x.trim().replace(/\s+/g, ' ');
  let m, claves = new Set();
  while ((m = re.exec(fuente))) {
    const k = m[3];
    if (claves.has(k)) continue;
    claves.add(k);
    if (!(k in T.en)) { sinLlave.push(k); continue }
    if (limpia(m[4]) !== limpia(String(T.en[k]))) fuera.push(k);
  }
  si(claves.size > 60, 'la página tiene ' + claves.size + ' textos con data-t');
  eq(sinLlave, [], 'todos existen en la tabla en inglés');
  eq(fuera, [], 'y el markup dice exactamente lo mismo que la tabla');
}

// ── 2 · Ni rastro del modelo del equipo ───────────────────────────
console.log('\n2 · Ni rastro de la puntuación del equipo\n');
{
  /* Hooporia puntúa POR JUGADOR: cuatro cuartos suyos, su mejor
     cadena en cada uno. Cualquier frase que hable de lo que anota el
     equipo es de Cada Punto y aquí miente. */
  const sospechas = [
    /the team scores/i, /one team point/i, /the score is the team/i,
    /same for every(body|one) on the team/i, /points the team scored/i,
    /puntos? del equipo/i, /anota el equipo/i, /la puntuación es del equipo/i,
    /picks a game/i, /escoge el juego/i,          // Cada Punto tenía varios juegos
    /your coach provides the final score/i,        // aquí lo anota el juego
    /at tip-?off/i
  ];
  const malas = [];
  const todo = JSON.stringify(T) + fuente;
  sospechas.forEach(r => { if (r.test(todo)) malas.push(String(r)) });
  eq(malas, [], 'ninguna frase del modelo del equipo, en el markup ni en las dos tablas');

  /* Y la descripción, que es la única que paint() no toca y la que
     sale cuando un nene manda su enlace por WhatsApp. */
  const desc = (fuente.match(/<meta name="description" content="([^"]+)"/) || [])[1] || '';
  si(desc.length > 60, 'la página tiene descripción (' + desc.length + ' letras)');
  si(!/team/i.test(desc), 'y la descripción no habla del equipo');
  si(/run|padrinos/i.test(desc), 'y sí de la corrida y de los padrinos');
}

// ── 3 · El piso de $5 ─────────────────────────────────────────────
console.log('\n3 · El piso de $5, dicho y calculado\n');
{
  /* El servidor cierra la promesa que da menos de $5. Si esta página
     no lo dice, un nene sale a buscar padrinos de diez centavos para
     una corrida corta y ninguno cuenta. */
  ['en','es'].forEach(l => {
    si(/\$5/.test(T[l].pisoP || ''), l + ' · la página explica el piso de $5');
    si(/(closes out|se cierra)/.test(T[l].pisoP || ''),
       l + ' · y dice qué pasa: la promesa se cierra');
    si(/(nothing is owed|no se debe nada)/.test(T[l].pisoP || ''),
       l + ' · y que no se debe nada');
    si((T[l].bajoPiso || '').indexOf('{A}') >= 0 && (T[l].bajoPiso || '').indexOf('{P}') >= 0,
       l + ' · el aviso de la calculadora lleva sus dos huecos');
  });

  const pag = await navegador.newPage({ viewport: { width: 390, height: 844 } });
  await pag.goto(PAGINA);
  await pag.waitForTimeout(200);

  const mueve = async (puntos, padrinos, centavos) => {
    await pag.evaluate(({ p, n, c }) => {
      const set = (id, v) => {
        const el = document.getElementById(id);
        el.value = String(v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('rounds', p); set('pad', n); set('rate', c);
    }, { p: puntos, n: padrinos, c: centavos });
    await pag.waitForTimeout(60);
    return {
      ppv:  (await pag.locator('#oPPV').textContent()).trim(),
      tot:  (await pag.locator('#oTotal').textContent()).trim(),
      piso: (await pag.locator('#oPiso').textContent()).trim()
    };
  };

  /* Por encima del piso no debe decir nada: un aviso que sale siempre
     deja de leerse. */
  let r = await mueve(100, 10, 25);
  eq(r.ppv, '$2.50', '100 puntos · 10 padrinos · 25¢ → valor por punto $2.50');
  eq(r.tot, '$250',  'y el total $250');
  eq(r.piso, '', 'y sin aviso de piso, porque cada promesa da $25');

  /* Y por debajo sí. Cinco centavos en una corrida de 40 son $2. */
  r = await mueve(40, 10, 5);
  si(r.piso.indexOf('$2.00') >= 0,
     '40 puntos a 5¢ → avisa que esa promesa da $2.00' +
     (r.piso ? '' : ' — NO AVISÓ'));
  si(/\$5/.test(r.piso), 'y nombra el piso de $5');
  /* Y el número gordo baja a cero, que es lo que de verdad llega al
     programa cuando las diez promesas se cierran. Dejarlo en $20.00
     con el aviso debajo era enseñarle al nene que cinco centavos dan
     veinte dólares: el número gordo gana siempre. */
  eq(r.tot, '$0.00', 'y el número gordo baja a $0.00, que es lo que llegaría');
  si(/(receives nothing|no le llega nada)/.test(r.piso),
     'y el aviso dice que al programa no le llega nada');

  /* El filo exacto: $5 justos pasan, un centavo menos no. */
  r = await mueve(100, 10, 5);   // 5¢ × 100 = $5.00 justos
  eq(r.piso, '', '$5.00 justos pasan el piso');
  r = await mueve(80, 10, 5);    // 5¢ × 80 = $4.00
  si(r.piso !== '', 'y $4.00 no');

  await pag.close();
}

// ── 4 · La aritmética que ve el nene ──────────────────────────────
console.log('\n4 · La tabla de ejemplo cuadra\n');
{
  /* Las seis filas son un valor por punto por el largo de una corrida.
     Se comprueban contra una cuenta hecha aquí, no contra la página:
     una cifra mal en esta tabla no da error, no sale en rojo, y
     manda a un nene a prometerle a su tía un número que no es.

     EL LARGO NO SE ESCRIBE AQUÍ, se saca de la cabecera de la tabla.
     Antes decía 100 a mano y la prueba fallaba al subir la página a
     150 —una prueba que grita cuando la página mejora— y, peor, no
     habría dicho nada si alguien cambiaba la cabecera y dejaba las
     seis cifras viejas. Leyéndolo de la página, las tres cosas que
     tienen que cuadrar —cabecera, filas y barra— se comprueban entre
     ellas y da igual qué número sea. */
  const pag = await navegador.newPage({ viewport: { width: 390, height: 844 } });
  await pag.goto(PAGINA);
  await pag.waitForTimeout(200);

  const cabRun = (await pag.locator('.lhead span').last().textContent()).trim();
  const mRun = cabRun.match(/(\d{2,4})/);
  if (!mRun) mal('la cabecera de la tabla no dice de qué corrida habla («' + cabRun + '»)');
  const corrida = mRun ? +mRun[1] : 0;
  si(corrida >= 40 && corrida <= 180,
     'la cabecera habla de una corrida de ' + corrida + ' puntos, que cabe en la barra');
  const acumulado = [1.00, 1.25, 1.35, 1.85, 3.85, 5.00];
  const filas = await pag.evaluate(() =>
    Array.from(document.querySelectorAll('.mrow')).map(f => ({
      val: f.querySelector('.val').textContent.trim(),
      amt: f.querySelector('.amt').textContent.trim()
    })));
  eq(filas.length, 6, 'la tabla tiene seis filas');
  filas.forEach((f, k) => {
    const v = acumulado[k];
    eq(f.val, '$' + v.toFixed(2), 'fila ' + (k+1) + ' · el punto vale $' + v.toFixed(2));
    eq(f.amt, '$' + (v * corrida).toFixed(2),
       'fila ' + (k+1) + ' · y una corrida de ' + corrida + ' da $' + (v*corrida).toFixed(2));
  });

  /* Las barras, en el rango de una corrida de cuatro sets. */
  const barra = await pag.evaluate(() => {
    const r = document.getElementById('rounds');
    return { min: +r.min, max: +r.max, val: +r.value };
  });
  si(barra.min >= 40 && barra.max >= 180,
     'la barra de puntos llega de ' + barra.min + ' a ' + barra.max);
  si(barra.val === corrida, 'y arranca en los mismos ' + corrida + ' de la tabla');

  await pag.close();
}

// ── 5 · Los dos idiomas ───────────────────────────────────────────
console.log('\n5 · Los dos idiomas, completos\n');
{
  const en = Object.keys(T.en), es = Object.keys(T.es);
  eq(en.filter(k => !(k in T.es)), [], 'ninguna llave inglesa falta en español');
  eq(es.filter(k => !(k in T.en)), [], 'ni al revés');
  const vacias = en.filter(k => !String(T.es[k] || '').trim());
  eq(vacias, [], 'y ninguna española está vacía');

  const pag = await navegador.newPage({ viewport: { width: 390, height: 844 } });
  await pag.goto(PAGINA);
  await pag.waitForTimeout(200);

  eq(await pag.locator('#lang').textContent(), 'Español',
     'en inglés el botón ofrece español');
  await pag.locator('#lang').click();
  await pag.waitForTimeout(150);
  eq(await pag.getAttribute('html', 'lang'), 'es', 'al pulsarlo la página se va a español');
  eq(await pag.locator('#lang').textContent(), 'English', 'y el botón ofrece volver');
  si(/piso/i.test(await pag.locator('body').textContent()),
     'y el piso de $5 también se explica en español');

  await pag.reload();
  await pag.waitForTimeout(200);
  eq(await pag.getAttribute('html', 'lang'), 'es', 'y al recargar sigue en español');
  await pag.close();
}

// ── 6 · El teléfono, y que no hable con nadie ─────────────────────
console.log('\n6 · Cabe en un teléfono y no habla con ningún servidor\n');
{
  for (const w of [320, 390, 430]) {
    const pag = await navegador.newPage({ viewport: { width: w, height: 844 } });
    const red = [];
    pag.on('request', (r) => { if (!r.url().startsWith('file://')) red.push(r.url()) });
    await pag.goto(PAGINA);
    await pag.waitForTimeout(250);
    const m = await pag.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      visto:  document.documentElement.clientWidth
    }));
    si(m.scroll <= m.visto + 1, w + 'px — sin arrastre lateral');
    if (w === 390) {
      eq(red, [], 'y no le pide nada a ningún servidor');
      /* El aviso del piso, cuando sale, tiene que caber también. */
      await pag.evaluate(() => {
        const set = (id, v) => { const e = document.getElementById(id);
          e.value = String(v); e.dispatchEvent(new Event('input', { bubbles:true })) };
        set('rounds', 40); set('rate', 5);
      });
      await pag.waitForTimeout(80);
      const m2 = await pag.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        visto:  document.documentElement.clientWidth
      }));
      si(m2.scroll <= m2.visto + 1, 'y tampoco con el aviso del piso puesto');
    }
    await pag.close();
  }
}

await navegador.close();
console.log('\n' + (fallos === 0
  ? '✓ dice lo mismo en los tres sitios, y lo mismo que el servidor'
  : '✗ ' + fallos + ' fallo(s)'));
process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('\n✗ la prueba reventó:', e); process.exit(1) });
