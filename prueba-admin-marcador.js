/* ════════════════════════════════════════════════════════════════
   ADMIN = MARCADOR (mi-equipo.html)        node prueba-admin-marcador.js
   El coach: su calendario por día, añadir juegos ahí mismo, poner el
   marcador tocando el juego (pregunta, publica y manda los avisos),
   retirarlo, el enlace de padrinos y el de la página pública.
   El público (?e=<programa>): resultados y próximos, Prometer sólo en
   los juegos abiertos con padrinos, nada de cómo recaudar.
   ════════════════════════════════════════════════════════════════ */
const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, 'mi-equipo.html');
let bad = 0; const ok = m => console.log('  ok   ' + m), mal = m => { bad++; console.log('  MAL  ' + m) }, si = (c, m) => c ? ok(m) : mal(m);
const CAMP = '11111111-2222-3333-4444-555555555555';
let PUB_OVERRIDE = null;
const JUEGOS = [
 {game_id:'g1',juego:'vs Arecibo',fecha:'2026-11-07',hora:'2:00 PM',cancha:'Gimnasio Canóvanas',jugado:true,puntos:68,rival_puntos:61,promesas:12,recauda:true,es_prueba:false},
 {game_id:'g2',juego:'@ Caguas',fecha:'2026-11-14',hora:'10:00 AM',cancha:'Coliseo Caguas',jugado:false,puntos:null,rival_puntos:null,promesas:5,recauda:true,es_prueba:false},
 {game_id:'g4',juego:'vs Carolina',fecha:'2026-11-14',hora:'4:00 PM',cancha:'Cancha Quintas',jugado:false,puntos:null,rival_puntos:null,promesas:0,recauda:true,es_prueba:false},
 {game_id:'g3',juego:'vs Bayamón',fecha:'2026-11-21',hora:null,cancha:null,jugado:false,puntos:null,rival_puntos:null,promesas:0,recauda:false,es_prueba:false}];
const PUBLICO = JUEGOS.map(g => ({ game_id:g.game_id, juego:g.juego, fecha:g.fecha, hora:g.hora, cancha:g.cancha, jugado:g.jugado,
  puntos:g.puntos, rival_puntos:g.rival_puntos, recauda:g.recauda, abierto: !g.jugado && g.recauda }));

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
  async function abrir(q, lang, ancho){
    const c = await b.newContext({ viewport:{ width: ancho || 390, height: 900 } });
    const p = await c.newPage(); const llamadas = []; const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.route('**/*', r => {
      const u = r.request().url();
      if (u.startsWith('file:')) return r.continue();
      const m = u.match(/\/rpc\/([a-z_]+)/);
      if (m) { const body = JSON.parse(r.request().postData() || '{}'); llamadas.push([m[1], body]);
        const R = { juegos_del_codigo: { ok:true, campana:'Canóvanas 15U', campana_id: CAMP, equipo:'Canóvanas', juegos: JUEGOS },
                    calendario_publico: body.p_campaign === CAMP ? { ok:true, equipo:'Canóvanas', juegos: PUB_OVERRIDE || PUBLICO } : { ok:false, reason:'no-existe' },
                    juego_marcador: { ok:true }, juego_crear: { ok:true, game_id:'g9' }, juego_recaudar: { ok:true } }[m[1]] || {};
        return r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(R) }); }
      if (/game-notices/.test(u)) { llamadas.push(['/game-notices', JSON.parse(r.request().postData() || '{}')]);
        return r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ ok:true, sent:5 }) }); }
      r.abort();
    });
    await p.addInitScript(l => { try { localStorage.setItem('cp-lang', l); localStorage.setItem('cfh_lang', l) } catch(e){} }, lang || 'es');
    await p.goto(FILE + (q || ''));
    await p.waitForTimeout(300);
    return { c, p, llamadas, errs };
  }

  console.log('\n1 · El coach entra y ve su calendario como Marcador');
  let { c, p, llamadas, errs } = await abrir('', 'es');
  await p.fill('#code', 'CANOVANAS15U-4827'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  si((await p.locator('#mH1').innerText()) === 'Tus 4 juegos, del 7 al 21 de noviembre', 'el titular, con el mes una vez: ' + await p.locator('#mH1').innerText());
  si((await p.locator('#hwho').innerText()).toLowerCase() === 'canóvanas 15u', 'el programa en la barra');
  si(await p.locator('.day').count() === 3, 'tres días');
  const dias = await p.locator('.day h2').allInnerTexts();
  si(/^Sábado 7 de noviembre/i.test(dias[0]), 'cada día con su nombre: ' + dias[0].split('\n')[0]);
  const orden = await p.locator('.day').nth(1).locator('.r .t').allInnerTexts();
  si(orden[0] === '10:00 AM' && orden[1] === '4:00 PM', 'dentro del día, por hora');
  si(await p.locator('.r[data-id="g2"] .m').innerText().then(t => /^Caguas\s*vs\s*Canóvanas/.test(t)), 'de visita, el local primero (como Marcador)');
  si(/68/.test(await p.locator('.r[data-id="g1"] .sc').innerText()) && await p.locator('.r[data-id="g1"] .won').count() === 1, 'el jugado con su marcador y el ganador marcado');
  si(await p.locator('#mAlta.hide').count() === 1 && (await p.locator('#mAdd').innerText()).includes('Añadir'), 'añadir un juego, plegado arriba');
  si(await p.isVisible('#mPub'), 'y el botón de la página pública');

  console.log('\n2 · Añadir un juego, ahí mismo');
  await p.click('#mAdd'); si(await p.isVisible('#jRival'), 'se abre el formulario');
  await p.fill('#jRival', 'Humacao'); await p.fill('#jFecha', '2026-11-28'); await p.selectOption('#jRecauda', '1');
  await p.click('#jCrear'); await p.waitForTimeout(300);
  const crear = llamadas.find(x => x[0] === 'juego_crear');
  si(crear && crear[1].p_rival === 'Humacao' && crear[1].p_fecha === '2026-11-28' && crear[1].p_recauda === true, 'juego_crear con rival, fecha y padrinos sí');

  console.log('\n3 · Poner el marcador tocando el juego');
  await p.click('.r[data-id="g2"]');
  const ph = await p.locator('.r[data-id="g2"] .ep').evaluateAll(e => e.map(x => x.placeholder));
  si(ph[0].startsWith('Caguas') && ph[1].startsWith('Canóvana'), 'las dos casillas, en el orden de la fila');
  await p.locator('.r[data-id="g2"] .ep').nth(0).fill('50');
  await p.locator('.r[data-id="g2"] .ep').nth(1).fill('55');
  p.once('dialog', d => d.dismiss()); await p.click('.r[data-id="g2"] .esave'); await p.waitForTimeout(200);
  si(!llamadas.some(x => x[0] === 'juego_marcador'), 'si dice que no a la pregunta, no se publica nada');
  let pregunta = ''; p.once('dialog', d => { pregunta = d.message(); d.accept() }); await p.click('.r[data-id="g2"] .esave'); await p.waitForTimeout(400);
  si(/55–50/.test(pregunta), 'la pregunta trae nuestro marcador primero: 55–50');
  const mar = llamadas.find(x => x[0] === 'juego_marcador');
  si(mar && mar[1].p_mios === 55 && mar[1].p_suyos === 50 && mar[1].p_game === 'g2', 'publica 55 nuestros, 50 de ellos');
  si(llamadas.some(x => x[0] === '/game-notices' && x[1].game_id === 'g2'), 'y salen los avisos a los padrinos');
  await p.click('.r[data-id="g1"]');
  p.once('dialog', d => d.accept()); await p.click('.r[data-id="g1"] .edel'); await p.waitForTimeout(300);
  const ret = llamadas.filter(x => x[0] === 'juego_marcador').pop();
  si(ret && ret[1].p_game === 'g1' && ret[1].p_mios === null, 'retirar un marcador ya puesto');
  await p.click('.r[data-id="g4"]'); si(await p.locator('.r[data-id="g4"] .ed').count() === 1, 'tocar abre el marcador');
  si((await p.locator('.r[data-id="g4"] .eclose').innerText()).startsWith('Cerrar'), 'con un botón «Cerrar» claro');
  await p.click('.r[data-id="g4"] .eclose'); si(await p.locator('.r .ed').count() === 0, '«Cerrar» lo cierra');
  await p.click('.r[data-id="g4"]'); await p.click('.r[data-id="g4"] .t'); si(await p.locator('.r .ed').count() === 0, 'tocar el juego otra vez lo cierra');
  await p.click('.r[data-id="g4"]'); await p.click('.r[data-id="g3"]');
  si(await p.locator('.r .ed').count() === 1 && await p.locator('.r[data-id="g3"] .ed').count() === 1, 'abrir otro juego cierra el anterior');
  await p.click('.r[data-id="g3"] .eclose');
  const antes = llamadas.length; await p.click('.r[data-id="g4"] [data-cop]'); await p.waitForTimeout(150);
  si(await p.locator('.r[data-id="g4"] .ed').count() === 0, 'copiar el enlace no abre el marcador');

  console.log('\n4 · Pestañas e idioma');
  await p.click('.tab[data-f="jug"]'); si(await p.locator('.r').count() === 1, 'Jugados: sólo el jugado');
  await p.click('.tab[data-f=""]');
  await p.click('#langBtn'); await p.waitForTimeout(200);
  si((await p.locator('#mH1').innerText()) === 'Your 4 games, November 7 to 21', 'en inglés: ' + await p.locator('#mH1').innerText());
  si(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'nada se sale de lado en el teléfono');
  si(errs.length === 0, 'sin errores' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await c.close();

  console.log('\n5 · La página pública');
  ({ c, p, llamadas, errs } = await abrir('?e=' + CAMP, 'es'));
  si(await p.isVisible('#app') && !(await p.isVisible('#gate')), 'abre el calendario sin pedir código');
  si(await p.locator('#hKick').innerText() === 'CALENDARIO' && (await p.locator('#hwho').innerText()).toLowerCase() === 'canóvanas', 'dice Calendario y el equipo');
  si((await p.locator('#mH1').innerText()).startsWith('Los 4 juegos'), 'Los 4 juegos');
  const tabs = await p.locator('#mTabs .tab').allInnerTexts();
  si(tabs.join('|') === 'Próximos juegos|Resultados', 'dos enlaces: Próximos juegos y Resultados');
  si((await p.locator('#mTabs .tab.on').innerText()) === 'Próximos juegos' && await p.locator('.r').count() === 3, 'abre en los próximos');
  const proms = await p.locator('a.pl.prom').evaluateAll(a => a.map(x => x.getAttribute('href')));
  si(proms.length === 2 && proms.every(h => /prometer\.html\?g=g[24]$/.test(h)), 'Prometer sólo en los dos abiertos con padrinos');
  await p.click('#mTabs .tab[data-f="jug"]');
  si(await p.locator('.r').count() === 1 && await p.locator('.r[data-id="g1"] a.pl.prom').count() === 0 && /68/.test(await p.locator('.r[data-id="g1"] .sc').innerText()), 'Resultados: el jugado, con su marcador y sin Prometer');
  await p.click('#mTabs .tab[data-f="prox"]');
  si(await p.locator('.r[data-id="g3"] a.pl.prom').count() === 0, 'el de solo marcador: sin Prometer');
  si(!(await p.isVisible('#mAdd')) && !(await p.isVisible('#mPub')) && await p.locator('[data-cop]').count() === 0, 'nada del coach: ni añadir, ni enlaces, ni copiar');
  si(!/c[oó]mo recaudar/i.test(await p.locator('body').innerText()), 'y ningún «cómo recaudar»');
  si(!/promesas/i.test(await p.locator('#mStat').innerText()), 'sin cuentas de promesas');
  await p.click('.r[data-id="g2"]'); si(await p.locator('.ed').count() === 0, 'tocar un juego no abre nada');
  si(llamadas.every(x => x[0] === 'calendario_publico'), 'sólo pide el calendario público');
  await p.click('#mCoach a'); si(await p.isVisible('#gate'), 'el coach puede entrar desde ahí');
  si(errs.length === 0, 'sin errores' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await c.close();
  console.log('\n6 · El enlace público en el teléfono del coach');
  ({ c, p, llamadas, errs } = await abrir('?e=' + CAMP, 'es'));
  await p.evaluate(() => { localStorage.setItem('cp_code','CANOVANAS15U-4827'); localStorage.setItem('cp_build','CANOVANAS15U-4827') });
  await p.reload(); await p.waitForTimeout(400);
  si(await p.evaluate(() => document.body.classList.contains('publico')) && !(await p.isVisible('#mAdd')), 'abre lo público aunque el coach haya entrado: sin «Añadir un juego»');
  await p.click('#mCoach a');
  /* Nov 6, 2026: a remembered code is offered as a button, not opened by
     itself — two teams on one phone must never land in each other's Admin. */
  si(await p.isVisible('#gate') && await p.locator('#tEquipos .seguir').count() === 1 && !(await p.isVisible('#mAdd')), '«¿Eres el coach?» ofrece su equipo, sin entrar solo');
  await p.locator('#tEquipos .seguir').first().click();
  await p.waitForSelector('#mAdd', { state:'visible', timeout:3000 }).then(() => ok('un toque y está en su Admin'), () => mal('«Continuar» no llevó a su Admin'));
  await c.close();
  console.log('\n7 · Cuando no hay nada publicado');
  for (const [nombre, lista, esperado] of [
      ['sin juegos', [], /todavía no ha publicado juegos\. Vuelve pronto/],
      ['sin resultados', PUBLICO.filter(g => !g.jugado), /Todavía no hay resultados publicados\. Vuelve pronto/],
      ['sin próximos', PUBLICO.filter(g => g.jugado), /No hay juegos próximos publicados todavía\. Vuelve pronto/]]) {
    PUB_OVERRIDE = lista;
    ({ c, p } = await abrir('?e=' + CAMP, 'es'));
    if (nombre === 'sin resultados') await p.click('#mTabs .tab[data-f="jug"]');
    si(esperado.test(await p.locator('#teams').innerText()), nombre + ': «' + (await p.locator('#teams').innerText()).trim() + '»');
    si(!/Añade|Add your first/i.test(await p.locator('body').innerText()), '  y nada de «añade tu primero»');
    await c.close();
  }
  PUB_OVERRIDE = null;
  ({ c, p, errs } = await abrir('?e=99999999-2222-3333-4444-555555555555', 'es'));
  si(/no existe/.test(await p.locator('#gm').innerText()), 'un enlace que no es de nadie: lo dice');
  await c.close();

  await b.close();
  console.log('\n' + (bad ? '✗ ' + bad + ' fallo(s)' : '✓ Admin es Marcador: el coach maneja su calendario y el público lo ve'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1) });
