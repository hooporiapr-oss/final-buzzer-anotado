/* ONE SPORT PER TEAM   node prueba-deporte.js
   Signup asks basketball or volleyball and saves it; the admin list
   shows it; Admin, the public page and the pledge page label the team's
   sport; volleyball score box says "total points, all sets". */
const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
const path = require('path');
const DIR = 'file://' + path.resolve(__dirname) + '/';
let bad = 0; const si = (c, m) => { if (!c) bad++; console.log((c ? '  ok   ' : '  MAL  ') + m) };
const CAMP = '11111111-2222-3333-4444-555555555555', GID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const JUEGOS = [{ game_id: GID, juego:'vs Caguas', rival:'Caguas', fecha:'2026-11-20', hora:'5:00 PM', cancha:'Coliseo', casa:true, jugado:false, puntos:null, rival_puntos:null, recauda:true, abierto:true }];

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
  async function abrir(file, R, lang, init){
    const c = await b.newContext({ viewport:{ width:390, height:900 } }); const p = await c.newPage(); const errs = [], calls = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.route('**/*', r => { const u = r.request().url();
      if (u.startsWith('file:')) return r.continue();
      const m = u.match(/\/rpc\/([a-z_]+)/);
      if (m){ calls.push([m[1], r.request().postDataJSON && r.request().postDataJSON()]);
        return r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(R[m[1]] || { ok:true }) }); }
      if (/\/rest\/v1\//.test(u)) return r.fulfill({ status:201, contentType:'application/json', body:'[]' });
      r.abort(); });
    await p.addInitScript(([l, i]) => { try { localStorage.setItem('cp-lang', l); localStorage.setItem('cfh_lang', l); if (i) for (const k in i) localStorage.setItem(k, i[k]) } catch(e){} }, [lang || 'es', init || null]);
    await p.goto(DIR + file); await p.waitForTimeout(400);
    return { c, p, errs, calls };
  }

  console.log('\n1 · Signup asks for the sport and saves it');
  let { c, p, errs, calls } = await abrir('equipo.html', { bw_codigo_disponible:{ ok:true } });
  si(await p.locator('#dBal').innerText() === '🏀 Baloncesto' && await p.locator('#dVol').innerText() === '🏐 Voleibol', 'two buttons: Baloncesto / Voleibol');
  await p.fill('#tm', 'Voley 15U'); await p.fill('#pn', '4827'); await p.fill('#pg', 'Club Voley');
  await p.fill('#nm', 'Ana Prueba'); await p.fill('#em', 'ana@example.com');
  for (const k of ['#lc','#cu','#tc']) await p.check(k);
  await p.click('button[onclick="send()"]'); await p.waitForTimeout(300);
  si(/deporte del equipo/i.test(await p.locator('body').innerText()) && !calls.some(x => x[0] === 'bw_request_team'), 'no sport picked: it asks, nothing is sent');
  await p.click('#dVol'); 
  si(await p.locator('#dVol').getAttribute('aria-pressed') === 'true' && await p.locator('#dBal').getAttribute('aria-pressed') === 'false', 'Voleibol selected');
  await p.click('button[onclick="send()"]'); await p.waitForTimeout(800);
  const dep = calls.find(x => x[0] === 'bw_request_deporte');
  si(dep && dep[1].p_deporte === 'voleibol' && dep[1].p_email === 'ana@example.com', 'saves voleibol for that coach');
  const iT = calls.findIndex(x => x[0] === 'bw_request_team'), iD = calls.findIndex(x => x[0] === 'bw_request_deporte'), iP = calls.findIndex(x => x[0] === 'bw_request_pin');
  si(iT >= 0 && iT < iD && iD < iP, 'order: signup, sport, four numbers');
  si(!errs.length, 'no page errors ' + errs.join(' ')); await c.close();

  ({ c, p } = await abrir('equipo.html', {}, 'en'));
  si(await p.locator('#dBal').innerText() === '🏀 Basketball' && await p.locator('#dVol').innerText() === '🏐 Volleyball', 'English: Basketball / Volleyball');
  await c.close();

  console.log('\n2 · Admin signup list shows the sport');
  /* admin.html needs a signed-in admin; its card drawing is run on its own here. */
  const fuente = require('fs').readFileSync(path.join(__dirname, 'admin.html'), 'utf8');
  const fn = fuente.slice(fuente.indexOf('function pintarSolicitudes('));
  const cuerpo = fn.slice(0, fn.indexOf('\n}\n') + 2);
  ({ c, p } = await abrir('admin.html', {}));
  await p.setContent('<div id="solicitudes"></div>');
  await p.addScriptTag({ content: 'var SOL_TODAS=true;function $(i){return document.getElementById(i)}function esc(x){return String(x==null?"":x).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",\'"\':"&quot;"}[c]})}function cuando(x){return String(x)}\n' + cuerpo });
  const html = await p.evaluate(() => { pintarSolicitudes([
      { id:'1', equipo:'Voley 15U', deporte:'voleibol', estado:'pending', programa:'Club', coach:'Ana', email:'a@x.com', pedida:'2026-11-05' },
      { id:'2', equipo:'Hoops 15U', deporte:'baloncesto', estado:'pending', programa:'Club', coach:'Luis', email:'l@x.com', pedida:'2026-11-05' },
      { id:'3', equipo:'Old 15U', estado:'pending', programa:'Club', coach:'Old', email:'o@x.com', pedida:'2026-11-05' },
      { id:'4', equipo:'Done 15U', estado:'approved', programa:'Club', coach:'D', email:'d@x.com', pedida:'2026-11-01' }]);
    return [...document.querySelectorAll('#solicitudes .item')].map(e => e.innerText) });
  si(/Volleyball/.test(html[0]) && /Basketball/.test(html[1]), 'volleyball and basketball signups labeled');
  si(/Sport not chosen/.test(html[2]), 'pending with no sport: warned before approving');
  si(/Basketball/.test(html[3]) && !/not chosen/.test(html[3]), 'old approved signup: basketball, no warning');
  await c.close();

  console.log('\n3 · Admin (coach) shows the sport; volleyball score box explains points');
  ({ c, p, errs } = await abrir('mi-equipo.html', { juegos_del_codigo:{ ok:true, campana:'Club Voley', campana_id:CAMP, equipo:'Voley 15U', deporte:'voleibol', juegos:JUEGOS } }, 'es', { cp_code:'VOLEY15U-4827', cp_build:'VOLEY15U-4827' }));
  si(await p.locator('#mDep').isVisible() && await p.locator('#mDep').innerText() === '🏐 Voleibol', 'Admin shows 🏐 Voleibol');
  await p.locator('.r[data-id="' + GID + '"]').click(); await p.waitForTimeout(150);
  si(/sumando todos los sets/.test(await p.locator('.ed').innerText()), 'score box: total points, all sets');
  si(!errs.length, 'no page errors ' + errs.join(' ')); await c.close();
  ({ c, p } = await abrir('mi-equipo.html', { juegos_del_codigo:{ ok:true, campana:'Club', campana_id:CAMP, equipo:'Hoops', deporte:'baloncesto', juegos:JUEGOS } }, 'en', { cp_code:'HOOPS-1234', cp_build:'HOOPS-1234' }));
  si(await p.locator('#mDep').innerText() === '🏀 Basketball', 'basketball team: 🏀 Basketball');
  await p.locator('.r[data-id="' + GID + '"]').click(); await p.waitForTimeout(150);
  si(await p.locator('.enota').count() === 0, 'no volleyball note on basketball');
  await c.close();

  console.log('\n4 · Public page and pledge page');
  ({ c, p } = await abrir('mi-equipo.html?e=' + CAMP, { calendario_publico:{ ok:true, equipo:'Voley 15U', deporte:'voleibol', juegos:JUEGOS } }));
  si(await p.locator('#mDep').innerText() === '🏐 Voleibol', 'public page shows the sport');
  await c.close();
  ({ c, p } = await abrir('prometer.html?g=' + GID, { juego_publico:{ ok:true, equipo:'Voley 15U', juego:'vs Caguas', cancha:'Coliseo', hora:'5:00 PM', abierto:true, recauda:true, campana_id:CAMP, deporte:'voleibol', promesas:0 } }));
  si(/^🏐 Voleibol · vs Caguas/.test(await p.locator('#programa').innerText()), 'pledge page: ' + await p.locator('#programa').innerText());
  await c.close();
  ({ c, p } = await abrir('prometer.html?g=' + GID, { juego_publico:{ ok:true, equipo:'X', juego:'vs Caguas', abierto:true, recauda:true, promesas:0 } }));
  si(/^vs Caguas/.test(await p.locator('#programa').innerText()), 'older database (no sport): no label');
  await c.close();

  await b.close();
  console.log(bad ? '\n' + bad + ' FAILED' : '\nALL PASS'); process.exit(bad ? 1 : 0);
})();
