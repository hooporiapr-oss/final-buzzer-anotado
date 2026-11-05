/* PLEDGE PAGE → TEAM GAMES (prometer.html)   node prueba-prometer-equipo.js
   Upcoming games and Results links to the team's public page; the
   closed message sends people to the upcoming games instead of
   "ask them for the next link". Without campana_id (older database)
   the page behaves as before. Also: mi-equipo.html?e=..&t=jug opens on Results. */
const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
const path = require('path');
const DIR = 'file://' + path.resolve(__dirname) + '/';
let bad = 0; const si = (c, m) => { if (!c) bad++; console.log((c ? '  ok   ' : '  MAL  ') + m) };
const CAMP = '11111111-2222-3333-4444-555555555555';
const BASE = { ok:true, equipo:'Testa License', juego:'vs luis', cancha:'luis court', hora:'3:00 PM', fecha:'2026-11-07', promesas:0 };

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
  async function abrir(file, resp, lang, extra){
    const c = await b.newContext({ viewport:{ width:390, height:900 } }); const p = await c.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.route('**/*', r => { const u = r.request().url();
      if (u.startsWith('file:')) return r.continue();
      const m = u.match(/\/rpc\/([a-z_]+)/);
      if (m) return r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(m[1] === 'juego_publico' ? resp : (extra || {})) });
      r.abort(); });
    await p.addInitScript(l => { try { localStorage.setItem('cp-lang', l); localStorage.setItem('cfh_lang', l) } catch(e){} }, lang || 'es');
    await p.goto(DIR + file); await p.waitForTimeout(400);
    return { c, p, errs };
  }
  const vis = (p, s) => p.locator(s).isVisible();

  console.log('\n1 · Open game: links to upcoming games and results');
  let { c, p, errs } = await abrir('prometer.html?g=g2', { ...BASE, abierto:true, recauda:true, campana_id:CAMP });
  si(await vis(p, '#form'), 'the pledge form is there');
  si(await vis(p, '#juegosEq'), 'the links row shows');
  si(await p.locator('#aProx').innerText() === 'Próximos juegos' && await p.locator('#aProx').getAttribute('href') === 'mi-equipo.html?e=' + CAMP, 'Próximos juegos → team page');
  si(await p.locator('#aRes').innerText() === 'Resultados' && await p.locator('#aRes').getAttribute('href') === 'mi-equipo.html?e=' + CAMP + '&t=jug', 'Resultados → team page on results');
  si(!errs.length, 'no page errors ' + errs.join(' ')); await c.close();

  console.log('\n2 · Closed by score (the case reported)');
  ({ c, p, errs } = await abrir('prometer.html?g=g1', { ...BASE, abierto:false, recauda:true, jugado:true, puntos:50, rival_puntos:40, campana_id:CAMP }, 'en'));
  si(await vis(p, '#cerrado') && !(await vis(p, '#form')), 'closed block, no form');
  const t = await p.locator('#cerradoP').innerText();
  si(/see their upcoming games\.$/.test(t) && !/next link/.test(t), 'no more "ask them for the next link": ' + t);
  si(await vis(p, '#irProx') && await p.locator('#irProx').innerText() === 'See upcoming games' && await p.locator('#irProx').getAttribute('href') === 'mi-equipo.html?e=' + CAMP, 'button to upcoming games');
  si(await p.locator('#aProx').innerText() === 'Upcoming games' && await p.locator('#aRes').innerText() === 'Results', 'links in English');
  await p.click('#lang'); await p.waitForTimeout(150);
  si(/mira sus próximos juegos\.$/.test(await p.locator('#cerradoP').innerText()) && await p.locator('#irProx').innerText() === 'Ver los próximos juegos', 'switches to Spanish');
  si(!errs.length, 'no page errors'); await c.close();

  console.log('\n3 · Game with no pledges, and cancelled');
  ({ c, p } = await abrir('prometer.html?g=g3', { ...BASE, abierto:false, recauda:false, campana_id:CAMP }));
  si(/mira sus próximos juegos/.test(await p.locator('#cerradoP').innerText()) && await vis(p, '#irProx'), 'no-pledge game points to upcoming games');
  await c.close();
  ({ c, p } = await abrir('prometer.html?g=g5', { ...BASE, abierto:false, recauda:true, cancelado:true, campana_id:CAMP }));
  si(/Nadie debe nada\.$/.test(await p.locator('#cerradoP').innerText()) && await vis(p, '#irProx'), 'cancelled keeps its words, button still there');
  await c.close();

  console.log('\n4 · Database not updated yet (no campana_id): as before');
  ({ c, p } = await abrir('prometer.html?g=g1', { ...BASE, abierto:false, recauda:true, jugado:true, puntos:50, rival_puntos:40 }));
  si(/pídele el próximo enlace\.$/.test(await p.locator('#cerradoP').innerText()), 'old words kept');
  si(!(await vis(p, '#juegosEq')) && !(await vis(p, '#irProx')), 'no links, no button');
  await c.close();

  console.log('\n5 · Team page opens on Results from the link');
  const PUB = { ok:true, equipo:'Testa License', juegos:[
    { game_id:'a', juego:'vs luis', fecha:'2026-11-01', hora:'3:00 PM', cancha:'luis court', jugado:true, puntos:50, rival_puntos:40, recauda:true, abierto:false },
    { game_id:'b', juego:'@ pedro', fecha:'2026-11-20', hora:'5:00 PM', cancha:null, jugado:false, puntos:null, rival_puntos:null, recauda:true, abierto:true }] };
  ({ c, p } = await abrir('mi-equipo.html?e=' + CAMP + '&t=jug', {}, 'es', PUB));
  si((await p.locator('.tab.on').innerText()) === 'Resultados', 'Resultados tab selected');
  si(await p.locator('.r[data-id="a"]').count() === 1 && await p.locator('.r[data-id="b"]').count() === 0, 'only the played game');
  await c.close();
  ({ c, p } = await abrir('mi-equipo.html?e=' + CAMP, {}, 'es', PUB));
  si((await p.locator('.tab.on').innerText()) === 'Próximos juegos' && await p.locator('.r[data-id="b"]').count() === 1, 'without &t: upcoming games, as before');
  await c.close();

  await b.close();
  console.log(bad ? '\n' + bad + ' FAILED' : '\nALL PASS'); process.exit(bad ? 1 : 0);
})();
