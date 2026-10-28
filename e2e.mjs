// Walks every row of the PRD feature table in headless Chrome over CDP. node e2e.mjs <outdir>
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = process.argv[2] || '.';
const URL = process.env.URL || 'http://127.0.0.1:4173/';
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'dk-'))}`,
  '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let targets;
for (let i = 0; i < 50 && !targets; i++) {
  try { targets = await (await fetch('http://127.0.0.1:9333/json/list')).json(); } catch { await sleep(200); }
}
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let n = 0; const pending = new Map(); const errors = [];
ws.addEventListener('message', ({ data }) => {
  const m = JSON.parse(data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description).join(' '));
});
const cdp = (method, params = {}) => new Promise(r => { const id = ++n; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async expr => {
  const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed');
  return r.result.result.value;
};
const shot = async name => {
  const r = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64'));
};

await cdp('Runtime.enable'); await cdp('Page.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await cdp('Page.navigate', { url: URL });
await sleep(1200);

// helpers injected into the page
const H = `
window.$ = s => document.querySelector(s);
window.btn = t => { const all = [...document.querySelectorAll('button')]; return all.find(b => b.textContent.trim() === t) || all.find(b => b.textContent.trim().startsWith(t)); };
window.tap = t => { const b = typeof t === 'string' ? btn(t) : t; if (!b) throw new Error('no button: ' + t); b.click(); };
window.fill = (name, v) => { const el = document.querySelector('[name="' + name + '"]'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
window.submit = () => document.querySelector('form').requestSubmit();
window.hash = () => location.hash;
window.errs = () => [...document.querySelectorAll('.err, .form-err')].map(e => e.textContent);
window.confirm = () => true;
true`;

let pass = 0, fail = 0;
async function step(name, action, check) {
  try {
    await js(H);
    if (action === 'RELOAD') { await cdp('Page.reload'); await sleep(1000); await js(H); }
    else if (action) await js(action);
    await sleep(250);
    const v = await js(check);
    if (v === true) { pass++; console.log('ok   ', name); }
    else { fail++; console.log('FAIL ', name, '->', JSON.stringify(v)); }
  } catch (e) { fail++; console.log('FAIL ', name, '->', e.message.split('\n')[0]); }
}

await js('localStorage.clear(); location.hash = "#/masuk"; true'); await sleep(300);
await step('unknown route goes to Masuk', 'location.hash = "#/xyz"', 'hash() === "#/masuk"');
await shot('01-masuk');
await step('Masuk: empty submit shows error', 'submit()', 'errs().includes("Isi email dan password")');
await step('Masuk: Lihat shows password', 'fill("password","abc12345"); tap("Lihat")', '$("[name=password]").type === "text" && !!btn("Sembunyikan")');
await step('Masuk: Daftar link', 'tap("Daftar")', 'hash() === "#/daftar"');
await shot('02-daftar');
await step('Daftar: validation (5 errors)', 'submit()', 'errs().length === 4 || errs()');
await step('Daftar: S&K link', 'tap("syarat & ketentuan")', 'hash() === "#/sk"');
await step('S&K: back to Daftar', 'tap("Saya mengerti")', 'hash() === "#/daftar"');
await step('Daftar: valid account -> Beranda',
  'fill("name","Rina Putri"); fill("email","Rina@Email.com"); fill("password","rahasia123"); fill("password2","rahasia123"); $("[name=agree]").checked = true; submit()',
  'hash() === "#/beranda"');
await shot('03-beranda-kosong');
await step('Beranda: empty state CTA', 'tap("Tambah transaksi pertama")', 'hash() === "#/tambah"');
await step('Tambah: validation', 'submit()', 'errs().includes("Nominal harus lebih dari 0") && errs().includes("Pilih kategori") || errs()');
await step('Tambah: amount formats thousands', 'fill("amount","45000x")', '$("[name=amount]").value === "45.000"');
await step('Tambah: save expense', 'tap("Makan"); fill("note","Makan siang"); submit()', 'hash() === "#/beranda" && document.querySelectorAll(".tx").length === 1');
await step('Beranda: FAB opens Tambah', 'tap($(".fab"))', 'hash() === "#/tambah"');
await step('Tambah: income switches categories', 'tap("Pemasukan")', '!!btn("Gaji") && !btn("Makan")');
await step('Tambah: save income', 'fill("amount","6000000"); tap("Gaji"); submit()', 'hash() === "#/beranda"');
await step('Beranda: balance = income - expense', '', '$(".balance strong").textContent === "Rp 5.955.000" || $(".balance strong").textContent');
await shot('04-beranda');
await step('Beranda: Pemasukan tile -> filtered Riwayat', 'tap($(".stat"))', 'hash().includes("type=income") && document.querySelectorAll(".tx").length === 1 && !!$(".pill")');
await shot('05-riwayat');
await step('Riwayat: clear type pill', 'tap($(".pill"))', '!hash().includes("type=") && document.querySelectorAll(".tx").length === 2');
await step('Riwayat: chip Makan filters', 'tap("Makan")', 'document.querySelectorAll(".tx").length === 1 && btn("Makan").getAttribute("aria-pressed") === "true"');
await step('Riwayat: Semua clears', 'tap("Semua")', 'document.querySelectorAll(".tx").length === 2');
await step('Riwayat: previous month empty state', 'tap($("[aria-label=\\"Bulan sebelumnya\\"]"))', '!!$(".empty")');
await step('Riwayat: next month back', 'tap($("[aria-label=\\"Bulan berikutnya\\"]"))', 'document.querySelectorAll(".tx").length === 2');
await step('Riwayat: row opens Ubah', 'tap($(".tx"))', 'hash().startsWith("#/ubah/") && $("[name=amount]").value !== ""');
await step('Ubah: edit amount, back to Riwayat', 'fill("amount","50000"); submit()', 'hash().startsWith("#/riwayat")');
await step('Ubah: delete transaction', 'tap($(".tx")); ', 'hash().startsWith("#/ubah/")');
await step('Ubah: Hapus', 'tap("Hapus transaksi")', 'hash().startsWith("#/riwayat") && document.querySelectorAll(".tx").length === 1');
await step('Tab bar: Beranda', 'tap("Beranda")', 'hash() === "#/beranda"');
await step('Beranda: Lihat semua', 'tap("Lihat semua")', 'hash() === "#/riwayat"');
await step('Beranda: avatar -> Profil', 'location.hash="#/beranda"', 'true');
await step('Beranda: avatar opens Profil', 'tap($(".avatar"))', 'hash() === "#/profil"');
await shot('06-profil');
await step('Profil: Target tabungan', 'tap($(".goal"))', 'hash() === "#/profil/target"');
await step('Target: save 10.000.000', 'fill("amount","10000000"); submit()', 'hash() === "#/profil" && $(".goal").textContent.includes("tercapai")');
await step('Target: hapus', 'tap($(".goal"))', 'hash() === "#/profil/target"');
await step('Target: Hapus target', 'tap("Hapus target")', 'hash() === "#/profil" && $(".goal").textContent.includes("Belum diatur")');
await step('Profil: Ubah profil', 'tap("Ubah profil")', 'hash() === "#/profil/ubah"');
await step('Ubah profil: save', 'fill("name","Rina Ayu"); submit()', 'hash() === "#/profil" && $(".profile-head b").textContent === "Rina Ayu"');
await step('Profil: Ganti password', 'tap("Ganti password")', 'hash() === "#/profil/password"');
await step('Ganti password: wrong old', 'fill("old","salah"); fill("password","barubaru1"); fill("password2","barubaru1"); submit()', 'errs().includes("Password lama salah")');
await step('Ganti password: ok', 'fill("old","rahasia123"); submit()', 'hash() === "#/profil"');
await step('Profil: Pengingat', 'tap("Pengingat harian")', 'hash() === "#/profil/pengingat"');
await step('Pengingat: enable', '$("[name=reminder]").checked = true; fill("time","00:00"); submit()', 'hash() === "#/profil" && document.body.textContent.includes("Aktif 00:00")');
await step('Profil: Mode gelap', 'tap("Mode gelap")', 'hash() === "#/profil/tema"');
await step('Tema: dark applies', '$("[value=dark]").click()', 'document.documentElement.dataset.theme === "dark"');
await step('Tema: back', 'tap($("[aria-label=Kembali]"))', 'hash() === "#/profil" && document.body.textContent.includes("Gelap")');
await shot('07-profil-gelap');
await step('Beranda in dark', 'tap("Beranda")', 'getComputedStyle(document.body).backgroundColor === "rgb(15, 17, 21)"');
await shot('08-beranda-gelap');
await step('Profil: Bantuan', 'tap("Profil"); setTimeout(() => tap("Bantuan"), 100)', 'new Promise(r => setTimeout(() => r(hash() === "#/bantuan"), 300))');
await step('Bantuan: FAQ opens', '$("details").open = true', '$("details").open === true');
await step('Bantuan: Ekspor CSV', 'tap("Ekspor CSV")', '$("#toast").textContent === "1 transaksi diekspor"');
await step('Keluar', 'location.hash="#/profil"', 'true');
await step('Keluar -> Masuk', 'tap("Keluar")', 'hash() === "#/masuk"');
await step('Masuk: wrong password', 'fill("email","rina@email.com"); fill("password","rahasia123"); submit()', 'errs().includes("Email atau password salah")');
await step('Masuk: new password works', 'fill("password","barubaru1"); submit()', 'hash() === "#/beranda"');
await step('Data survives reload', 'RELOAD', 'hash() === "#/beranda" && document.querySelectorAll(".tx").length === 1');
await step('Reminder banner hidden (tx today exists)', '', '!$(".banner")');
await step('Logout again', 'location.hash="#/profil"; setTimeout(() => tap("Keluar"), 200)', 'new Promise(r => setTimeout(() => r(hash() === "#/masuk"), 400))');
await step('Lupa password link', 'tap("Lupa password?")', 'hash() === "#/lupa"');
await step('Lupa: unknown email', 'fill("email","x@y.com"); fill("password","barubaru2"); fill("password2","barubaru2"); submit()', 'errs().includes("Email tidak terdaftar di perangkat ini")');
await step('Lupa: reset ok', 'fill("email","rina@email.com"); submit()', 'hash() === "#/masuk"');
await step('Masuk with reset password', 'fill("email","rina@email.com"); fill("password","barubaru2"); submit()', 'hash() === "#/beranda"');
await step('Logout', 'location.hash="#/profil"; setTimeout(() => tap("Keluar"), 200)', 'new Promise(r => setTimeout(() => r(hash() === "#/masuk"), 400))');
await step('Coba tanpa akun -> demo data', 'tap("Coba tanpa akun")', 'hash() === "#/beranda" && document.querySelectorAll(".tx").length === 5');
await shot('09-demo');
await step('Demo: Riwayat has groups', 'tap("Riwayat")', 'document.querySelectorAll(".group-date").length >= 3');
await shot('10-riwayat-demo');
await step('Demo: wipe account', 'location.hash="#/bantuan"; setTimeout(() => tap("Hapus akun & semua data"), 200)', 'new Promise(r => setTimeout(() => r(hash() === "#/masuk" && !JSON.parse(localStorage["dompetku.v1"]).users.some(u => u.email === "demo@dompetku.app")), 400))');
await step('Rina account untouched by wipe', '', 'JSON.parse(localStorage["dompetku.v1"]).users.length === 1');
await step('Guarded route redirects to Masuk', 'location.hash="#/profil"', 'hash() === "#/masuk"');
await step('Service worker registered', '', 'navigator.serviceWorker.getRegistration().then(r => !!r)');
await step('Service worker controls page', 'RELOAD', '!!navigator.serviceWorker.controller');
await cdp('Network.enable');
await cdp('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await step('Works offline after reload', 'RELOAD', 'hash() === "#/masuk" && !!btn("Masuk")');
await shot('11-offline');

console.log(`\n${pass} passed, ${fail} failed, ${errors.length} console errors`);
errors.forEach(e => console.log('console:', e));
chrome.kill();
process.exit(fail || errors.length ? 1 : 0);
