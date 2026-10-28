// Layout check: every screen at phone widths must have no horizontal overflow and no input under 16px
// (iOS Safari zooms into smaller inputs and the page then pans). URL=... node fit.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL = process.env.URL || 'http://127.0.0.1:4173/';
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9334', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'dkf-'))}`,
  '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50 && !targets; i++) {
  try { targets = await (await fetch('http://127.0.0.1:9334/json/list')).json(); } catch { await sleep(200); }
}
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let n = 0; const pending = new Map();
ws.addEventListener('message', ({ data }) => { const m = JSON.parse(data); if (m.id) pending.get(m.id)?.(m); });
const cdp = (method, params = {}) => new Promise(r => { const id = ++n; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async e => (await cdp('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result.result.value;

const ROUTES = ['masuk', 'daftar', 'lupa', 'sk', 'beranda', 'riwayat', 'tambah', 'profil', 'profil/ubah', 'profil/password',
  'profil/target', 'profil/pengingat', 'profil/tema', 'bantuan'];
const PROBE = `(() => {
  const W = document.documentElement.clientWidth, out = [];
  if (document.documentElement.scrollWidth > W) out.push('page scrollWidth ' + document.documentElement.scrollWidth + ' > ' + W);
  for (const el of document.querySelectorAll('#app *')) {
    if (el.closest('.chips.scroll') && !el.matches('.chips.scroll')) continue; // horizontal chip strip scrolls on purpose
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > W + 0.5 || r.left < -0.5)) out.push((el.className || el.tagName) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
  }
  for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select'))
    if (parseFloat(getComputedStyle(el).fontSize) < 16) out.push('input font ' + getComputedStyle(el).fontSize + ' ' + el.name);
  return [...new Set(out)].slice(0, 6);
})()`;

let bad = 0;
await cdp('Page.navigate', { url: URL }); await sleep(1200);
for (const width of [320, 360, 390]) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 2, mobile: true });
  for (const logged of [false, true]) {
    await js(`localStorage.clear(); location.hash = '#/masuk'; true`);
    await cdp('Page.reload'); await sleep(1000); // the app keeps its db in memory, so reload to really log out
    if (logged) {
      // demo data plus one huge amount to stress number widths
      await js(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Coba tanpa akun').click(); true`); await sleep(400);
      await js(`(() => { const db = JSON.parse(localStorage['dompetku.v1']); db.txs.push({ id: 'big', userId: db.session, type: 'income', amount: 999999999999, category: 'Bonus', date: new Date().toISOString().slice(0, 10), note: 'Nominal maksimum untuk uji lebar layar', createdAt: 99 }); db.users[0].target = 999999999999; localStorage['dompetku.v1'] = JSON.stringify(db); location.reload(); return true; })()`);
      await sleep(1200);
    }
    for (const r of ROUTES.filter(r => ['masuk', 'daftar', 'lupa', 'sk'].includes(r) !== logged)) {
      await js(`location.hash = '#/${r}'; true`); await sleep(250);
      const issues = await js(PROBE);
      if (issues.length) { bad++; console.log(`FAIL ${width}px #/${r}:`, issues.join(' | ')); }
    }
  }
}
console.log(bad ? `${bad} screen(s) do not fit` : 'all screens fit at 320/360/390 px, inputs >= 16px');
chrome.kill();
process.exit(bad ? 1 : 0);
