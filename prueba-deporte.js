/* SPORT AND CATEGORY PER GAME   node prueba-deporte.js
   The program signs up once and lists its categories. In Admin the coach
   picks Basketball or Volleyball, filters by category, and each game he
   adds carries its sport and category (a new category joins the list).
   The public page and the pledge page show them. Two programs on one
   phone never open each other's Admin. */
const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
const path = require('path');
const DIR = 'file://' + path.resolve(__dirname) + '/';
let bad = 0; const si = (c, m) => { if (!c) bad++; console.log((c ? '  ok   ' : '  MAL  ') + m) };
const CAMP = '11111111-2222-3333-4444-555555555555';
const G = (id, dep, cat, extra) => Object.assign({ game_id:id, juego:'vs Caguas', rival:'Caguas', fecha:'2026-11-20', hora:'5:00 PM',
  cancha:'Coliseo', casa:true, jugado:false, puntos:null, rival_puntos:null, recauda:true, abierto:true, promesas:0, deporte:dep, categoria:cat }, extra || {});
const JUEGOS = [ G('aaaaaaaa-0000-0000-0000-000000000001', 'baloncesto', 'Mini'),
                 G('aaaaaaaa-0000-0000-0000-000000000002', 'baloncesto', 'Junior', { hora:'7:00 PM' }),
                 G('aaaaaaaa-0000-0000-0000-000000000003', 'voleibol',   'Mini',   { hora:'6:00 PM', juego:'vs Ponce', rival:'Ponce' }) ];

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
  async function abrir(file, R, lang, init){
    const c = await b.newContext({ viewport:{ width:390, height:900 } }); const p = await c.newPage(); const errs = [], calls = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.route('**/*', r => { const u = r.request().url();
      if (u.startsWith('file:')) return r.continue();
      const m = u.match(/\/rpc\/([a-z0-9_]+)/);
      if (m){ calls.push([m[1], r.request().postDataJSON && r.request().postDataJSON()]);
        const v = typeof R[m[1]] === 'function' ? R[m[1]](r.request().postDataJSON()) : R[m[1]];
        return r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(v || { ok:true }) }); }
      if (/\/rest\/v1\//.test(u)) return r.fulfill({ status:201, contentType:'application/json', body:'[]' });
      r.abort(); });
    await p.addInitScript(([l, i]) => { try { localStorage.setItem('cp-lang', l); localStorage.setItem('cfh_lang', l); if (i) for (const k in i) localStorage.setItem(k, i[k]) } catch(e){} }, [lang || 'es', init || null]);
    await p.goto(DIR + file); await p.waitForTimeout(400);
    if (init && await p.locator('#tEquipos .seguir').count()){ await p.locator('#tEquipos .seguir').first().click(); await p.waitForTimeout(400); }
    return { c, p, errs, calls };
  }
  const txt = (p, s) => p.locator(s).innerText();

  console.log('\n1 · Signup: program, code (2 letters + 4 numbers), name, email, phone');
  let { c, p, errs, calls } = await abrir('equipo.html', { bw_codigo6_libre: d => d.p_codigo === 'TK1111' ? { ok:false, reason:'usado' } : { ok:true, codigo:d.p_codigo } });
  si(await p.locator('#tm').count() === 0 && await p.locator('#pn').count() === 0 && await p.locator('#catIn').count() === 0 && await p.locator('#dBal').count() === 0,
     'no team name, no 4 numbers, no categories, no sport');
  const orden = await p.evaluate(() => [...document.querySelectorAll('input[type=text],input[type=email],input[type=tel]')].map(e => e.id).filter(Boolean));
  si(orden.join(',') === 'pg,cd,nm,em,ph', 'fields in order: ' + orden.join(','));
  await p.fill('#pg', 'Club Doble'); await p.fill('#nm', 'Ana Prueba'); await p.fill('#em', 'ana@example.com');
  for (const k of ['#el','#lc','#cu','#tc']) await p.check(k);
  for (const bad of ['', 'C4827', 'CPX482', '12CP34']){
    await p.fill('#cd', bad); await p.click('button[onclick="send()"]'); await p.waitForTimeout(150);
  }
  si(/dos letras y cuatro números/i.test(await p.locator('body').innerText()) && !calls.some(x => x[0] === 'bw_request_team'), 'wrong shapes: it asks, nothing is sent');
  await p.fill('#cd', 'tk-1111'); await p.click('button[onclick="send()"]'); await p.waitForTimeout(300);
  si(/ya está en uso/i.test(await p.locator('body').innerText()) && !calls.some(x => x[0] === 'bw_request_team'), 'taken code: pick another, nothing is sent');
  await p.fill('#cd', 'cp 4827'); await p.click('button[onclick="send()"]'); await p.waitForTimeout(800);
  const rt = calls.find(x => x[0] === 'bw_request_team'), rc = calls.find(x => x[0] === 'bw_request_codigo');
  si(rt && rt[1].p_team === 'Club Doble' && rt[1].p_program === 'Club Doble', 'the program signs up under its own name');
  si(rc && rc[1].p_codigo === 'CP4827' && rc[1].p_email === 'ana@example.com', 'code saved as CP4827');
  si(calls.findIndex(x => x[0] === 'bw_request_team') < calls.findIndex(x => x[0] === 'bw_request_codigo'), 'order: signup, then code');
  si(/CP4827/.test(await p.locator('body').innerText()), 'the done screen shows CP4827');
  si(!calls.some(x => /bw_request_(pin|categorias|deporte)|bw_codigo_disponible/.test(x[0])), 'nothing from the old signup is sent');
  si(!errs.length, 'no page errors ' + errs.join(' ')); await c.close();
  ({ c, p } = await abrir('equipo.html', {}, 'en'));
  si(await p.locator('label[for="cd"]').innerText() === 'Pick your code' && /on its own/.test(await p.locator('[data-i="codeAyuda"]').innerText()), 'English: Pick your code');
  await c.close();

  console.log('\n2 · Admin signup list shows the categories');
  const fuente = require('fs').readFileSync(path.join(__dirname, 'admin.html'), 'utf8');
  const fn = fuente.slice(fuente.indexOf('function pintarSolicitudes('));
  const cuerpo = fn.slice(0, fn.indexOf('\n}\n') + 2);
  ({ c, p } = await abrir('admin.html', {}));
  await p.setContent('<div id="solicitudes"></div>');
  await p.addScriptTag({ content: 'var SOL_TODAS=true;function $(i){return document.getElementById(i)}function esc(x){return String(x==null?"":x).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",\'"\':"&quot;"}[c]})}function cuando(x){return String(x)}\n' + cuerpo });
  const html = await p.evaluate(() => { pintarSolicitudes([
      { id:'1', equipo:'Club Doble', categorias:['Mini','Junior'], estado:'pending', programa:'Club', coach:'Ana', email:'a@x.com', pedida:'2026-11-06' },
      { id:'2', equipo:'Old', estado:'approved', programa:'Club', coach:'D', email:'d@x.com', pedida:'2026-11-01' }]);
    return [...document.querySelectorAll('#solicitudes .item')].map(e => e.innerText) });
  si(/Categories: Mini · Junior/.test(html[0]), 'categories listed on the signup');
  si(!/Sport not chosen|Basketball|Volleyball/.test(html.join(' ')), 'no sport warning on signups any more');
  await c.close();

  console.log('\n3 · Admin: Basketball / Volleyball switch, category filter, add a game');
  const R = { juegos_del_codigo:{ ok:true, campana:'Club Doble', campana_id:CAMP, equipo:'Club Doble', categorias:['Mini','Junior','14U'], juegos:JUEGOS },
              juego_crear:{ ok:true, game_id:'nuevo' } };
  ({ c, p, errs, calls } = await abrir('mi-equipo.html', R, 'es', { cp_code:'DOBLE-4827', cp_build:'DOBLE-4827' }));
  si((await p.locator('#mDepSw button').allInnerTexts()).join('|') === '🏀 Baloncesto|🏐 Voleibol', 'switch: 🏀 Baloncesto | 🏐 Voleibol');
  si(await p.locator('#mDepSw button.on').innerText() === '🏀 Baloncesto' && await p.locator('.r').count() === 2, 'opens on basketball: its 2 games');
  si((await p.locator('#mCats button').allInnerTexts()).join('|') === 'Todas|Mini|Junior|14U', 'categories: Todas | Mini | Junior | 14U');
  await p.locator('#mCats button', { hasText:'Junior' }).click(); await p.waitForTimeout(100);
  si(await p.locator('.r').count() === 1 && /Junior/.test(await p.locator('.r').first().innerText()), 'Junior filter: 1 game');
  await p.locator('#mDepSw button', { hasText:'Voleibol' }).click(); await p.waitForTimeout(100);
  si(await p.locator('.r').count() === 1 && /Ponce/.test(await p.locator('.r').first().innerText()), 'volleyball: its game (filter reset)');
  si(await p.evaluate(() => localStorage.getItem('cp_dep')) === 'voleibol', 'the switch is remembered on this phone');
  await p.locator('.r').first().click(); await p.waitForTimeout(100);
  si(/sumando todos los sets/.test(await p.locator('.ed').innerText()), 'volleyball score box: all-sets note');
  await p.locator('.eclose').click();
  await p.click('#mAdd'); await p.waitForTimeout(100);
  si(await txt(p, '#jDep') === 'Se añade a 🏐 Voleibol', 'add form: Se añade a 🏐 Voleibol');
  const ops = await p.locator('#jCat option').allInnerTexts();
  si(ops.join('|') === 'Mini|Junior|14U|Sin categoría|+ Añadir categoría…', 'category dropdown: ' + ops.join(' | '));
  await p.selectOption('#jCat', '__nueva');
  si(await p.locator('#jCatNueva').isVisible(), 'new category: a box appears');
  await p.fill('#jRival', 'Bayamón'); await p.fill('#jFecha', '2026-11-22');
  await p.click('#jCrear'); await p.waitForTimeout(200);
  si(!calls.some(x => x[0] === 'juego_crear'), 'empty new category: it asks first');
  await p.fill('#jCatNueva', '  Juvenil   Femenino '); await p.click('#jCrear'); await p.waitForTimeout(400);
  const jc = calls.find(x => x[0] === 'juego_crear');
  si(jc && jc[1].p_deporte === 'voleibol' && jc[1].p_categoria === 'Juvenil Femenino', 'game sent as voleibol / Juvenil Femenino');
  await p.selectOption('#jCat', 'Mini'); await p.fill('#jRival', 'Arecibo'); await p.fill('#jFecha', '2026-11-23');
  await p.locator('#mDepSw button', { hasText:'Baloncesto' }).click(); await p.waitForTimeout(100);
  si(await txt(p, '#jDep') === 'Se añade a 🏀 Baloncesto', 'switching sport changes where the game goes');
  await p.click('#jCrear'); await p.waitForTimeout(400);
  const jc2 = calls.filter(x => x[0] === 'juego_crear')[1];
  si(jc2 && jc2[1].p_deporte === 'baloncesto' && jc2[1].p_categoria === 'Mini', 'second game: baloncesto / Mini');
  si(!errs.length, 'no page errors ' + errs.join(' ')); await c.close();
  ({ c, p } = await abrir('mi-equipo.html', R, 'en', { cp_code:'DOBLE-4827', cp_build:'DOBLE-4827' }));
  si((await p.locator('#mDepSw button').allInnerTexts()).join('|') === '🏀 Basketball|🏐 Volleyball' && (await p.locator('#mCats button').first().innerText()) === 'All', 'English: Basketball | Volleyball, All');
  await c.close();

  console.log('\n4 · Master code: every program, rows name team and category');
  const MIX = JUEGOS.map(g => ({ ...g, campana: g.deporte === 'voleibol' ? 'Voley Club' : 'Testa License' }));
  ({ c, p, errs } = await abrir('mi-equipo.html', { juegos_del_codigo:{ ok:true, maestro:true, campana:null, campana_id:null, equipo:null, juegos:MIX } }, 'es', { cp_code:'ADMIN-MASTER', cp_build:'ADMIN-MASTER' }));
  const filas = await p.locator('.r').allInnerTexts();
  si(filas.length === 2 && filas.every(t => /Testa License/.test(t)) && filas.some(t => /Junior · Coliseo/.test(t)), 'basketball rows: team and category');
  si(!errs.length, 'no page errors ' + errs.join(' ')); await c.close();

  console.log('\n5 · Two programs on one phone: nothing opens by itself, one tap to switch');
  {
    const ctx = await b.newContext({ viewport:{ width:390, height:900 } }); const pg = await ctx.newPage(); const errs2 = [];
    pg.on('pageerror', e => errs2.push(String(e)));
    const RR = { 'HOOPS-1234': { ok:true, campana:'Hoops Club', campana_id:CAMP, equipo:'Hoops', juegos:[] },
                 'VOLEY-4827': { ok:true, campana:'Voley Club', campana_id:CAMP, equipo:'Voley', juegos:[] } };
    await pg.route('**/*', rt => { const u = rt.request().url();
      if (u.startsWith('file:')) return rt.continue();
      if (/juegos_del_codigo/.test(u)){ const k = (rt.request().postDataJSON() || {}).p_code;
        return rt.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(RR[k] || { ok:false }) }); }
      rt.abort(); });
    await pg.addInitScript(() => { try { localStorage.setItem('cp-lang','es') } catch(e){} });
    await pg.goto(DIR + 'mi-equipo.html'); await pg.waitForTimeout(300);
    si(await pg.locator('#tEquipos .seguir').count() === 0, 'first visit: just the code box');
    await pg.fill('#code', 'HOOPS-1234'); await pg.click('#tGo');
    await pg.waitForFunction(() => /Hoops/i.test(document.getElementById('hwho').textContent), null, { timeout:3000 }).catch(() => {});
    si(/Hoops Club/i.test(await txt(pg, '#hwho')), 'signed in as Hoops Club');
    si(await txt(pg, '#mCambiar') === '⇄ Cambiar de equipo', 'Admin has ⇄ Cambiar de equipo');
    await pg.click('#mCambiar'); await pg.waitForTimeout(200);
    si(await pg.locator('#gate').isVisible() && !(await pg.locator('#app').isVisible()) && !(await txt(pg, '#hwho')), 'switch: back to the list, header cleared');
    await pg.fill('#code', 'VOLEY-4827'); await pg.click('#tGo');
    await pg.waitForFunction(() => /Voley/i.test(document.getElementById('hwho').textContent), null, { timeout:3000 }).catch(() => {});
    si(/Voley Club/i.test(await txt(pg, '#hwho')), 'typing the other code opens the other program');
    await pg.waitForFunction(() => (JSON.parse(localStorage.getItem('cp_teams') || '[]')).length === 2, null, { timeout:3000 }).catch(() => {});
    await pg.reload({ waitUntil:'load' });
    await pg.waitForFunction(() => document.querySelectorAll('#tEquipos .seguir').length === 2, null, { timeout:3000 }).catch(() => {});
    const btns = await pg.locator('#tEquipos .seguir').allInnerTexts();
    si(await pg.locator('#gate').isVisible() && !(await pg.locator('#app').isVisible()), 'reopening opens NO program by itself');
    si(btns.join('|') === 'Voley Club|Hoops Club', 'both listed, last used first: ' + btns.join(' | '));
    await pg.locator('#tEquipos .seguir').nth(1).click();
    await pg.waitForFunction(() => /Hoops/i.test(document.getElementById('hwho').textContent), null, { timeout:3000 }).catch(() => {});
    si(/Hoops Club/i.test(await txt(pg, '#hwho')) && await pg.evaluate(() => localStorage.getItem('cp_code')) === 'HOOPS-1234', 'one tap: Hoops Club (other pages follow)');
    await pg.click('#hout'); await pg.waitForTimeout(400);
    const quedan = await pg.locator('#tEquipos .seguir').allInnerTexts();
    si(quedan.join('|') === 'Voley Club', 'Salir forgets only that program on this phone');
    await pg.fill('#code', 'MALO-0000'); await pg.click('#tGo'); await pg.waitForTimeout(300);
    si(!(await pg.locator('#app').isVisible()) && (await pg.locator('#tEquipos .seguir').count()) === 1, 'a wrong code opens nothing and forgets nothing');
    si(!errs2.length, 'no page errors ' + errs2.join(' '));
    await ctx.close();
  }

  console.log('\n6 · Public page and pledge page');
  ({ c, p } = await abrir('mi-equipo.html?e=' + CAMP, { calendario_publico:{ ok:true, equipo:'Club Doble', juegos:JUEGOS } }));
  si(await p.locator('#mDepSw').isVisible() && await p.locator('#mDepSw button.on').innerText() === '🏀 Baloncesto', 'plays both: the public gets the switch');
  si((await p.locator('#mCats button').allInnerTexts()).join('|') === 'Todas|Mini|Junior', 'and the categories in use');
  await p.locator('#mDepSw button', { hasText:'Voleibol' }).click(); await p.waitForTimeout(100);
  si(await p.locator('.r').count() === 1 && /Mini · Coliseo/.test(await p.locator('.r').first().innerText()), 'volleyball game with its category');
  await c.close();
  ({ c, p } = await abrir('mi-equipo.html?e=' + CAMP, { calendario_publico:{ ok:true, equipo:'Voley Club', juegos:[JUEGOS[2]] } }));
  si(!(await p.locator('#mDepSw').isVisible()) && await p.locator('.r').count() === 1, 'one sport only: no switch, its games shown');
  await c.close();
  ({ c, p } = await abrir('prometer.html?g=' + JUEGOS[2].game_id, { juego_publico:{ ok:true, equipo:'Club Doble', juego:'vs Ponce', cancha:'Coliseo', hora:'6:00 PM', abierto:true, recauda:true, campana_id:CAMP, deporte:'voleibol', categoria:'Mini', promesas:0 } }));
  si(/^🏐 Voleibol · Mini · vs Ponce/.test(await txt(p, '#programa')), 'pledge page: ' + await txt(p, '#programa'));
  await c.close();

  await b.close();
  console.log(bad ? '\n' + bad + ' FAILED' : '\nALL PASS'); process.exit(bad ? 1 : 0);
})();
