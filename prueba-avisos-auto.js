/* ══════════════════════════════════════════════════════════════════
   LOS AVISOS SALEN SOLOS AL PUBLICAR EL MARCADOR

   Antes el entrenador tenía que acordarse de pulsar «Mandar los
   avisos». El día que no se acordaba, los padrinos no se enteraban y
   el programa no cobraba. Ahora publicar el marcador los manda.

   Lo que mira, con la base y el servidor de mentira (la página de
   verdad, en un navegador de verdad):

     1 · Mi calendario: publicar pregunta primero, y al decir que sí
         guarda el marcador y manda los avisos — UNA llamada
     2 · decir que no: no se guarda nada y no sale nada
     3 · corregir el marcador vuelve a llamar (salen las correcciones)
     4 · retirar el marcador no manda nada
     5 · un juego sólo de marcador no llama al servidor de avisos
     6 · ya no hay botón de mandar para el entrenador
     7 · si el servidor falla, el marcador queda y se dice cómo reintentar
     8 · el reporte ya no tiene botón de mandar, y sigue pintando
     9 · el admin manda solo al publicar y tiene el reenvío de rescate

       node prueba-avisos-auto.js
   ══════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

let fallos = 0;
const ok  = (m) => console.log('  ok   ' + m);
const mal = (m) => { fallos++; console.log('  MAL  ' + m); };
const si  = (v, m) => (v ? ok(m) : mal(m));

const AQUI = __dirname;
const G1 = 'aaaaaaaa-0000-0000-0000-000000000001';   // con padrinos
const G2 = 'aaaaaaaa-0000-0000-0000-000000000002';   // sólo marcador

function juegos(jugado1) {
  return [
    { game_id: G1, juego: 'vs Rival Prueba', fecha: '2026-11-02', promesas: 1, recauda: true,
      jugado: jugado1, puntos: jugado1 ? 60 : null, rival_puntos: jugado1 ? 52 : null, es_prueba: true },
    { game_id: G2, juego: 'vs Sólo Marcador', fecha: '2026-11-03', promesas: 0, recauda: false,
      jugado: false, puntos: null, rival_puntos: null, es_prueba: false },
  ];
}

async function abrir(navegador, opciones) {
  const o = Object.assign({ jugado: false, servidor: 'ok', confirmar: true }, opciones || {});
  const pag = await navegador.newPage({ viewport: { width: 390, height: 844 } });
  const llamadas = { marcador: [], avisos: [] };
  let jugado = o.jugado;
  await pag.route('**/rest/v1/rpc/**', async (ruta) => {
    const nombre = ruta.request().url().split('/rpc/')[1];
    const args = JSON.parse(ruta.request().postData() || '{}');
    let cuerpo = { ok: true };
    if (nombre === 'juegos_del_codigo')
      cuerpo = { ok: true, campana: 'Programa Prueba', equipo: 'Equipo Prueba', juegos: juegos(jugado) };
    if (nombre === 'juego_marcador') { llamadas.marcador.push(args); jugado = args.p_mios !== null; }
    await ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) });
  });
  await pag.route('**/game-notices', async (ruta) => {
    llamadas.avisos.push(JSON.parse(ruta.request().postData() || '{}'));
    if (o.servidor === 'caido') return ruta.abort();
    await ruta.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, sent: 1, corrected: 0, skipped: 0, zero: 0, failed: 0,
                             undeliverable: 0, licencia: { estado: 'prueba' } }) });
  });
  pag.on('dialog', (d) => (o.confirmar ? d.accept() : d.dismiss()));
  await pag.goto('file://' + path.join(AQUI, 'mi-equipo.html'));
  await pag.evaluate(() => { try { localStorage.clear() } catch (e) {} });
  await pag.fill('#code', 'EQUIPOPRUEBA-1234');
  await pag.click('#tGo');
  await pag.waitForSelector('[data-mar]');
  return { pag, llamadas };
}

async function publicar(pag, id, a, b) {
  await pag.fill('[data-a="' + id + '"]', String(a));
  if (b != null) await pag.fill('[data-b="' + id + '"]', String(b));
  await pag.click('[data-mar="' + id + '"]');
  await pag.waitForTimeout(400);
}

(async () => {
const navegador = await chromium.launch();

console.log('\n1 · Publicar manda los avisos');
{
  const { pag, llamadas } = await abrir(navegador);
  let pregunta = '';
  pag.removeAllListeners('dialog');
  pag.on('dialog', (d) => { pregunta = d.message(); d.accept(); });
  await publicar(pag, G1, 60, 52);
  si(/60–52/.test(pregunta) && /(un correo|ONE email)/i.test(pregunta), 'pregunta antes, con el marcador y lo que va a pasar');
  si(llamadas.marcador.length === 1 && llamadas.marcador[0].p_mios === 60, 'guarda el marcador 60–52');
  si(llamadas.avisos.length === 1 && llamadas.avisos[0].game_id === G1, 'y manda los avisos de ese juego, UNA vez');
  si(llamadas.avisos[0] && llamadas.avisos[0].code === 'EQUIPOPRUEBA-1234' || llamadas.avisos[0].code === 'EQUIPOPRUEBA1234',
     'con el código del entrenador');
  const msg = await pag.textContent('#jm');
  si(/(1 notice|1 aviso)/i.test(msg), 'y dice cuántos salieron: «' + msg.trim() + '»');
  await pag.close();
}

console.log('\n2 · Decir que no');
{
  const { pag, llamadas } = await abrir(navegador, { confirmar: false });
  await publicar(pag, G1, 60, 52);
  si(llamadas.marcador.length === 0, 'no se guarda el marcador');
  si(llamadas.avisos.length === 0, 'y no sale ningún aviso');
  await pag.close();
}

console.log('\n3 · Corregir el marcador');
{
  const { pag, llamadas } = await abrir(navegador, { jugado: true });
  await publicar(pag, G1, 70, 52);
  si(llamadas.marcador.length === 1 && llamadas.marcador[0].p_mios === 70, 'guarda el 70');
  si(llamadas.avisos.length === 1, 'y vuelve a llamar: salen las correcciones');
  await pag.close();
}

console.log('\n4 · Retirar el marcador');
{
  const { pag, llamadas } = await abrir(navegador, { jugado: true });
  await pag.click('[data-ret="' + G1 + '"]');
  await pag.waitForTimeout(400);
  si(llamadas.marcador.length === 1 && llamadas.marcador[0].p_mios === null, 'retira el marcador');
  si(llamadas.avisos.length === 0, 'y no manda nada');
  await pag.close();
}

console.log('\n5 · Juego sólo de marcador');
{
  const { pag, llamadas } = await abrir(navegador);
  await publicar(pag, G2, 40, 38);
  si(llamadas.marcador.length === 1, 'guarda su marcador');
  si(llamadas.avisos.length === 0, 'y no llama al servidor de avisos: no tiene padrinos');
  await pag.close();
}

console.log('\n6 · Sin botón de mandar para el entrenador');
{
  const { pag } = await abrir(navegador, { jugado: true });
  si(await pag.locator('[data-avi]').count() === 0, 'no hay botón «Mandar los avisos»');
  si(await pag.locator('a[href="reporte.html"]').count() > 0, 'el enlace al reporte sigue');
  await pag.close();
}

console.log('\n7 · El servidor de avisos no contesta');
{
  const { pag, llamadas } = await abrir(navegador, { servidor: 'caido' });
  await publicar(pag, G1, 60, 52);
  const msg = (await pag.textContent('#jm')).trim();
  si(llamadas.marcador.length === 1, 'el marcador se guarda igual');
  si(/(mismo marcador|same score)/i.test(msg), 'y dice cómo reintentar: «' + msg + '»');
  await pag.close();
}

console.log('\n8 · El reporte');
{
  const s = fs.readFileSync(path.join(AQUI, 'reporte.html'), 'utf8');
  si(!/pedirConfirma|mandarAvisos/.test(s), 'ya no tiene botón ni función de mandar');
  si(/function bajarCSV/.test(s), 'el CSV sigue');
  const pag = await navegador.newPage();
  const errores = [];
  pag.on('pageerror', (e) => errores.push(e.message));
  await pag.goto('file://' + path.join(AQUI, 'reporte.html'));
  await pag.waitForTimeout(300);
  si(errores.length === 0, 'carga sin errores' + (errores.length ? ': ' + errores[0] : ''));
  await pag.close();
}

console.log('\n9 · El admin');
{
  const s = fs.readFileSync(path.join(AQUI, 'admin.html'), 'utf8');
  const m = s.slice(s.indexOf('function jgMarcador'), s.indexOf('function jgPrueba'));
  si(/jgAvisos\(id\)/.test(m), 'publicar un marcador desde el admin manda los avisos');
  si(/Publish the score/.test(m), 'y pregunta antes');
  si(/data-avisos=/.test(s) && /Resend missing notices/.test(s), 'tiene el reenvío de rescate');
  si(/servidor\('\/game-notices'/.test(s), 'que usa la misma ruta del servidor');
  const pag = await navegador.newPage();
  const errores = [];
  pag.on('pageerror', (e) => errores.push(e.message));
  await pag.goto('file://' + path.join(AQUI, 'admin.html'));
  await pag.waitForTimeout(300);
  si(errores.length === 0, 'el admin carga sin errores' + (errores.length ? ': ' + errores[0] : ''));
  await pag.close();
}

await navegador.close();
console.log('\n' + (fallos === 0 ? '✓ los avisos salen solos al publicar el marcador' : '✗ ' + fallos + ' fallo(s)'));
process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('\n✗ la prueba reventó:', e); process.exit(1) });
