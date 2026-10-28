import * as C from './core.js';

// ---------- storage ----------
const KEY = 'dompetku.v1';
const fresh = () => ({ users: [], txs: [], session: null });
let db = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch { return fresh(); } })();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
  catch { toast('Gagal menyimpan: penyimpanan perangkat penuh'); return false; }
}
const me = () => db.users.find(u => u.id === db.session);
const myTx = () => db.txs.filter(t => t.userId === db.session);
const randomId = () => [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('');
const esc = C.escapeHtml;

// ---------- ui helpers ----------
const ICONS = {
  back: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>',
  home: '<path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
  list: '<path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>', up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  moon: '<path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 17h.01"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  x: '<path d="M7 7l10 10M17 7L7 17"/>',
};
const I = name => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

const qs = (path, q) => {
  const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v)).toString();
  return s ? `${path}?${s}` : path;
};
const topbar = (title, back) =>
  `<div class="topbar"><button class="icon-btn" data-go="${back}" aria-label="Kembali">${I('back')}</button><h2>${title}</h2><span></span></div>`;
const field = (label, name, value = '', attrs = '') =>
  `<label class="field"><span>${label}</span><input name="${name}" value="${esc(value)}" ${attrs}></label>`;
const pwField = (label, name, auto) =>
  `<label class="field"><span>${label}</span><div class="input"><input class="has-peek" type="password" name="${name}" autocomplete="${auto}" required>` +
  `<button type="button" class="peek" data-act="peek" aria-pressed="false">Lihat</button></div></label>`;
const tabbar = active => `<nav class="tabbar" aria-label="Menu utama">${[['beranda', 'home', 'Beranda'], ['riwayat', 'list', 'Riwayat'], ['profil', 'user', 'Profil']]
  .map(([p, icon, label]) => `<button data-go="${p}" ${p === active ? 'aria-current="page"' : ''}>${I(icon)}${label}</button>`).join('')}</nav>`;

function txRow(t) {
  const cls = t.type === 'income' ? 'in' : 'out';
  return `<li><button class="tx" data-go="ubah/${t.id}"><span class="dot ${cls}">${t.category[0]}</span>` +
    `<span class="meta"><b>${esc(t.note || t.category)}</b><small>${t.note ? t.category + ' · ' : ''}${C.shortDate(t.date)}</small></span>` +
    `<span class="amt ${cls}">${t.type === 'income' ? '+' : '-'}${C.rupiah(t.amount)}</span></button></li>`;
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function showErrors(form, errs) {
  form.querySelectorAll('.err, .form-err').forEach(e => e.remove());
  for (const [name, msg] of Object.entries(errs)) {
    const div = document.createElement('div');
    div.textContent = msg;
    if (name === 'form') { div.className = 'form-err'; form.prepend(div); continue; }
    div.className = 'err';
    const el = form.elements[name];
    (el?.closest?.('.field, .check') || el?.[0]?.closest('.field') || form).append(div);
  }
  const first = form.querySelector('.err, .form-err');
  first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return Object.keys(errs).length === 0;
}

const thisMonth = () => C.isoDate(new Date()).slice(0, 7);
const brand = '<div class="brand"><img src="icon.svg" alt=""><b>Dompetku</b></div>';

// ---------- views ----------
const views = {
  masuk: () => `<section class="screen auth">${brand}
    <h1>Masuk</h1><p class="sub">Kelola uangmu dengan mudah</p>
    <form data-form="login" novalidate>
      ${field('Email', 'email', '', 'type="email" autocomplete="email" inputmode="email" required')}
      ${pwField('Password', 'password', 'current-password')}
      <div class="row" style="justify-content:flex-end;margin:-8px 0 12px"><button type="button" class="link-btn" data-go="lupa">Lupa password?</button></div>
      <button class="btn">Masuk</button>
    </form>
    <div class="divider">atau</div>
    <button class="btn outline" data-act="demo">Coba tanpa akun</button>
    <p class="foot">Belum punya akun? <button class="link-btn" data-go="daftar">Daftar</button></p></section>`,

  daftar: () => `<section class="screen auth">${topbar('', 'masuk')}
    <h1>Buat akun</h1><p class="sub">Mulai catat keuanganmu hari ini</p>
    <form data-form="register" novalidate>
      ${field('Nama lengkap', 'name', '', 'autocomplete="name" required')}
      ${field('Email', 'email', '', 'type="email" autocomplete="email" inputmode="email" required')}
      ${pwField('Password (minimal 8 karakter)', 'password', 'new-password')}
      ${pwField('Konfirmasi password', 'password2', 'new-password')}
      <label class="check"><input type="checkbox" name="agree"><span>Saya setuju dengan
        <button type="button" class="link-btn" style="padding:0" data-go="sk">syarat &amp; ketentuan</button></span></label>
      <button class="btn">Daftar</button>
    </form>
    <p class="foot">Sudah punya akun? <button class="link-btn" data-go="masuk">Masuk</button></p></section>`,

  lupa: () => `<section class="screen auth">${topbar('Lupa password', 'masuk')}
    <p class="sub">Atur ulang password untuk akun yang tersimpan di perangkat ini.</p>
    <form data-form="reset" novalidate>
      ${field('Email terdaftar', 'email', '', 'type="email" autocomplete="email" inputmode="email" required')}
      ${pwField('Password baru', 'password', 'new-password')}
      ${pwField('Ulangi password baru', 'password2', 'new-password')}
      <button class="btn">Simpan password baru</button>
    </form></section>`,

  sk: () => `<section class="screen auth">${topbar('Syarat & ketentuan', 'daftar')}<div class="prose">
    <h3>1. Data tersimpan di perangkatmu</h3><p>Dompetku tidak mengirim data ke server mana pun. Semua akun dan transaksi disimpan di browser perangkat ini.</p>
    <h3>2. Cadangan tanggung jawab pengguna</h3><p>Menghapus data browser atau aplikasi akan menghapus catatanmu. Gunakan Ekspor CSV di menu Bantuan untuk menyimpan cadangan.</p>
    <h3>3. Bukan nasihat keuangan</h3><p>Angka di aplikasi berasal dari catatanmu sendiri dan tidak menggantikan laporan bank.</p>
    <h3>4. Perubahan</h3><p>Ketentuan ini dapat berubah pada versi berikutnya dan akan ditampilkan di aplikasi.</p></div>
    <button class="btn" data-go="daftar" style="margin-top:24px">Saya mengerti</button></section>`,

  beranda: () => {
    const u = me(), txs = myTx(), ym = thisMonth(), tot = C.monthTotals(txs, ym);
    const recent = C.sortTx(txs).slice(0, 5);
    return `<section class="screen">
      <div class="hello"><div><h1>Halo, ${esc(u.name.split(' ')[0])}</h1><span class="muted">Selamat datang kembali</span></div>
        <button class="avatar" data-go="profil" aria-label="Buka profil">${esc(u.name[0].toUpperCase())}</button></div>
      ${C.reminderDue(u, txs, new Date()) ? `<div class="banner">${I('bell')}<p>Belum ada catatan hari ini. Yuk catat transaksimu.</p><button data-go="tambah">Catat</button></div>` : ''}
      <div class="balance"><small>Total saldo</small><strong>${C.rupiah(C.balance(txs))}</strong><small>${C.monthLabel(ym)}</small></div>
      <div class="stats">
        <button class="card stat" data-go="${qs('riwayat', { ym, type: 'income' })}"><span class="row"><span class="dot in">${I('down')}</span>Pemasukan</span><b class="in">${C.rupiah(tot.income)}</b></button>
        <button class="card stat" data-go="${qs('riwayat', { ym, type: 'expense' })}"><span class="row"><span class="dot out">${I('up')}</span>Pengeluaran</span><b class="out">${C.rupiah(tot.expense)}</b></button>
      </div>
      <div class="section-head"><h2>Transaksi terakhir</h2><button class="link-btn" data-go="riwayat">Lihat semua</button></div>
      ${recent.length ? `<ul class="card tx-list">${recent.map(txRow).join('')}</ul>`
        : `<div class="card empty">Belum ada transaksi.<button class="btn" data-go="tambah">Tambah transaksi pertama</button></div>`}
    </section>${tabbar('beranda')}<button class="fab" data-go="tambah" aria-label="Tambah transaksi">${I('plus')}</button>`;
  },

  riwayat: q => {
    const ym = q.get('ym') || thisMonth(), cat = q.get('cat') || '', type = q.get('type') || '';
    const txs = myTx(), tot = C.monthTotals(txs, ym);
    const groups = C.groupByDate(C.filterTx(txs, { ym, category: cat, type }));
    const cats = [...new Set([...C.CATEGORIES.expense, ...C.CATEGORIES.income])];
    return `<section class="screen"><h1>Riwayat</h1>
      <div class="card month"><button class="icon-btn" data-go="${qs('riwayat', { ym: C.shiftMonth(ym, -1), cat, type })}" aria-label="Bulan sebelumnya">${I('back')}</button>
        <b>${C.monthLabel(ym)}</b>
        <button class="icon-btn" data-go="${qs('riwayat', { ym: C.shiftMonth(ym, 1), cat, type })}" aria-label="Bulan berikutnya">${I('right')}</button></div>
      <div class="totals"><span class="muted">Masuk <b class="in">${C.rupiah(tot.income)}</b></span><span class="muted">Keluar <b class="out">${C.rupiah(tot.expense)}</b></span></div>
      ${type ? `<button class="pill" data-go="${qs('riwayat', { ym, cat })}">Hanya ${type === 'income' ? 'pemasukan' : 'pengeluaran'} ${I('x')}</button>` : ''}
      <div class="chips scroll" role="group" aria-label="Filter kategori">
        <button class="chip" aria-pressed="${!cat}" data-go="${qs('riwayat', { ym, type })}">Semua</button>
        ${cats.map(c => `<button class="chip" aria-pressed="${c === cat}" data-go="${qs('riwayat', { ym, type, cat: c })}">${c}</button>`).join('')}
      </div>
      ${groups.length ? groups.map(([date, list]) => `<div class="group-date">${C.longDate(date)}</div><ul class="card tx-list">${list.map(txRow).join('')}</ul>`).join('')
        : `<div class="card empty" style="margin-top:16px">Tidak ada transaksi${cat ? ` kategori ${cat}` : ''} di ${C.monthLabel(ym)}.<button class="btn" data-go="tambah">Tambah transaksi</button></div>`}
    </section>${tabbar('riwayat')}`;
  },

  tambah: () => txForm(null),
  ubah: (q, id) => {
    const t = myTx().find(x => x.id === id);
    return t ? txForm(t) : (setTimeout(() => go('beranda')), '');
  },

  profil: () => {
    const u = me(), saved = Math.max(0, C.balance(myTx())), pct = C.progress(saved, u.target);
    const themeName = { system: 'Ikuti sistem', light: 'Terang', dark: 'Gelap' }[u.theme || 'system'];
    const row = (go, icon, label, val = '') => `<li><button data-go="${go}">${I(icon)}<span class="grow">${label}</span>${val ? `<span class="val">${val}</span>` : ''}${I('right')}</button></li>`;
    return `<section class="screen"><h1>Profil</h1>
      <div class="profile-head"><div class="avatar big">${esc(u.name[0].toUpperCase())}</div><b>${esc(u.name)}</b><span class="muted">${esc(u.email)}</span></div>
      <button class="card goal" data-go="profil/target"><span class="muted" style="font-size:13px">Target tabungan</span>
        ${u.target ? `<b>${C.rupiah(saved)} / ${C.rupiah(u.target)}</b><div class="bar"><i style="width:${pct}%"></i></div>
          <small class="in" style="display:block;margin-top:8px;font-weight:600">${pct}% tercapai</small>`
        : '<b>Belum diatur</b><small class="muted">Ketuk untuk mengatur target</small>'}</button>
      <ul class="card menu">
        ${row('profil/ubah', 'edit', 'Ubah profil')}
        ${row('profil/password', 'lock', 'Ganti password')}
        ${row('profil/pengingat', 'bell', 'Pengingat harian', u.reminder ? `Aktif ${u.reminderTime}` : 'Nonaktif')}
        ${row('profil/tema', 'moon', 'Mode gelap', themeName)}
        ${row('bantuan', 'help', 'Bantuan')}
      </ul>
      <button class="btn danger" data-act="logout">Keluar</button></section>${tabbar('profil')}`;
  },

  'profil/ubah': () => {
    const u = me();
    return `<section class="screen form">${topbar('Ubah profil', 'profil')}<form data-form="profile" novalidate>
      ${field('Nama lengkap', 'name', u.name, 'autocomplete="name" required')}
      ${field('Email', 'email', u.email, 'type="email" autocomplete="email" inputmode="email" required')}
      <button class="btn">Simpan</button></form></section>`;
  },

  'profil/password': () => `<section class="screen form">${topbar('Ganti password', 'profil')}<form data-form="password" novalidate>
      ${pwField('Password lama', 'old', 'current-password')}
      ${pwField('Password baru (minimal 8 karakter)', 'password', 'new-password')}
      ${pwField('Ulangi password baru', 'password2', 'new-password')}
      <button class="btn">Simpan password</button></form></section>`,

  'profil/target': () => {
    const u = me();
    return `<section class="screen form">${topbar('Target tabungan', 'profil')}<form data-form="target" novalidate>
      <div class="field"><span class="muted" style="font-size:13px">Nominal target</span>
        <div class="amount"><span>Rp</span><input name="amount" inputmode="numeric" autocomplete="off" placeholder="0" value="${C.groupDigits(u.target)}" aria-label="Nominal target"></div></div>
      <p class="muted">Saldo saat ini ${C.rupiah(C.balance(myTx()))}. Progres = saldo ÷ target.</p>
      <div class="actions"><button class="btn">Simpan target</button>
        ${u.target ? '<button type="button" class="btn outline" data-act="cleartarget">Hapus target</button>' : ''}</div></form></section>`;
  },

  'profil/pengingat': () => {
    const u = me();
    return `<section class="screen form">${topbar('Pengingat harian', 'profil')}<form data-form="reminder" novalidate>
      <ul class="card menu" style="border:1px solid var(--border)"><li><label><span class="grow">Aktifkan pengingat</span>
        <input type="checkbox" class="switch" name="reminder" ${u.reminder ? 'checked' : ''}></label></li></ul>
      ${field('Jam pengingat', 'time', u.reminderTime || '20:00', 'type="time" required')}
      <p class="muted" style="font-size:14px">Setelah jam ini, Beranda menampilkan pengingat bila belum ada transaksi hari itu.</p>
      <button class="btn">Simpan</button></form></section>`;
  },

  'profil/tema': () => {
    const t = me().theme || 'system';
    const opt = (v, label) => `<li><label><span class="grow">${label}</span><input type="radio" name="theme" value="${v}" ${t === v ? 'checked' : ''}></label></li>`;
    return `<section class="screen form">${topbar('Mode gelap', 'profil')}
      <ul class="card menu radio-list" style="border:1px solid var(--border)">${opt('system', 'Ikuti sistem')}${opt('light', 'Terang')}${opt('dark', 'Gelap')}</ul>
      <p class="muted" style="font-size:14px">Perubahan langsung berlaku.</p></section>`;
  },

  bantuan: () => `<section class="screen form">${topbar('Bantuan', 'profil')}
    <h2 style="margin-bottom:10px">Pertanyaan umum</h2>
    <div class="card" style="border:1px solid var(--border);margin-bottom:24px">
      <details><summary>Di mana data saya disimpan?</summary><p>Di browser perangkat ini saja. Tidak ada yang dikirim ke server.</p></details>
      <details><summary>Bagaimana memasang ke layar utama?</summary><p>Android (Chrome): menu ⋮ lalu "Tambahkan ke layar utama". iPhone (Safari): tombol Bagikan lalu "Tambah ke Layar Utama".</p></details>
      <details><summary>Bisa dipakai tanpa internet?</summary><p>Bisa, setelah aplikasi dibuka sekali dengan koneksi.</p></details>
      <details><summary>Bagaimana mencadangkan data?</summary><p>Pakai Ekspor CSV di bawah. File bisa dibuka di Excel atau Google Sheets.</p></details>
    </div>
    <h2 style="margin-bottom:10px">Data</h2>
    <ul class="card menu" style="border:1px solid var(--border)">
      <li><button data-act="export">${I('download')}<span class="grow">Ekspor CSV</span></button></li>
      <li><button data-act="wipe" class="out">${I('trash')}<span class="grow">Hapus akun &amp; semua data</span></button></li>
    </ul></section>`,
};

function txForm(t) {
  const type = t?.type || 'expense';
  return `<section class="screen form">${topbar(t ? 'Ubah transaksi' : 'Tambah transaksi', lastMain)}
    <form data-form="tx" novalidate>
      <input type="hidden" name="id" value="${t?.id || ''}"><input type="hidden" name="type" value="${type}">
      <div class="segment" role="group" aria-label="Jenis transaksi">
        <button type="button" class="out" data-act="settype" data-type="expense" aria-pressed="${type === 'expense'}">Pengeluaran</button>
        <button type="button" class="in" data-act="settype" data-type="income" aria-pressed="${type === 'income'}">Pemasukan</button>
      </div>
      <div class="field"><span>Nominal</span><div class="amount"><span>Rp</span>
        <input name="amount" inputmode="numeric" autocomplete="off" placeholder="0" value="${C.groupDigits(t?.amount || 0)}" aria-label="Nominal"></div></div>
      <div class="field"><span>Kategori</span><input type="hidden" name="category" value="${t?.category || ''}"><div class="chips" id="cats">${catChips(type, t?.category)}</div></div>
      ${field('Tanggal', 'date', t?.date || C.isoDate(new Date()), 'type="date" required')}
      <label class="field"><span>Catatan (opsional)</span><textarea name="note" maxlength="100" placeholder="Contoh: makan siang bareng tim">${esc(t?.note || '')}</textarea></label>
      <div class="actions"><button class="btn">Simpan</button>
        ${t ? `<button type="button" class="btn danger" data-act="delete" data-id="${t.id}">Hapus transaksi</button>` : ''}</div>
    </form></section>`;
}
const catChips = (type, selected) => C.CATEGORIES[type]
  .map(c => `<button type="button" class="chip" data-act="setcat" data-cat="${c}" aria-pressed="${c === selected}">${c}</button>`).join('');

// ---------- forms ----------
const values = form => Object.fromEntries(new FormData(form));
const emailsExcept = id => db.users.filter(u => u.id !== id).map(u => u.email);
function signIn(user, msg) { db.session = user.id; if (save()) { toast(msg); go('beranda'); } }
function newUser(name, email, password) {
  const salt = randomId();
  return { id: randomId(), name: name.trim(), email: email.trim().toLowerCase(), salt, hash: C.hashPassword(password, salt),
    target: 0, theme: 'system', reminder: false, reminderTime: '20:00', createdAt: Date.now() };
}

const forms = {
  login(form) {
    const v = values(form), u = db.users.find(x => x.email === v.email.trim().toLowerCase());
    if (!v.email.trim() || !v.password) return showErrors(form, { form: 'Isi email dan password' });
    if (!u || C.hashPassword(v.password, u.salt) !== u.hash) return showErrors(form, { form: 'Email atau password salah' });
    signIn(u, `Halo lagi, ${u.name.split(' ')[0]}`);
  },
  register(form) {
    const v = values(form);
    if (!showErrors(form, C.validateRegister({ ...v, agree: !!v.agree }, db.users.map(u => u.email)))) return;
    const u = newUser(v.name, v.email, v.password);
    db.users.push(u);
    signIn(u, 'Akun dibuat. Selamat datang!');
  },
  reset(form) {
    const v = values(form), u = db.users.find(x => x.email === v.email.trim().toLowerCase());
    const errs = { ...(u ? {} : { email: 'Email tidak terdaftar di perangkat ini' }), ...C.validatePassword(v.password, v.password2) };
    if (!showErrors(form, errs)) return;
    u.hash = C.hashPassword(v.password, u.salt);
    if (save()) { toast('Password diganti. Silakan masuk.'); go('masuk'); }
  },
  tx(form) {
    const v = values(form);
    const tx = { type: v.type, amount: C.parseAmount(v.amount), category: v.category, date: v.date, note: v.note.trim() };
    if (!showErrors(form, C.validateTx(tx))) return;
    const old = db.txs.find(t => t.id === v.id && t.userId === db.session);
    if (old) Object.assign(old, tx);
    else db.txs.push({ ...tx, id: randomId(), userId: db.session, createdAt: Date.now() });
    if (save()) { toast(old ? 'Transaksi diperbarui' : 'Transaksi disimpan'); go(lastMain); }
  },
  profile(form) {
    const v = values(form), u = me();
    if (!showErrors(form, C.validateProfile(v, emailsExcept(u.id)))) return;
    Object.assign(u, { name: v.name.trim(), email: v.email.trim().toLowerCase() });
    if (save()) { toast('Profil disimpan'); go('profil'); }
  },
  password(form) {
    const v = values(form), u = me();
    const errs = { ...(C.hashPassword(v.old, u.salt) === u.hash ? {} : { old: 'Password lama salah' }), ...C.validatePassword(v.password, v.password2) };
    if (!showErrors(form, errs)) return;
    u.hash = C.hashPassword(v.password, u.salt);
    if (save()) { toast('Password diganti'); go('profil'); }
  },
  target(form) {
    const n = C.parseAmount(values(form).amount);
    if (!showErrors(form, n > 0 ? {} : { amount: 'Masukkan target lebih dari 0' })) return;
    me().target = n;
    if (save()) { toast('Target disimpan'); go('profil'); }
  },
  reminder(form) {
    const v = values(form), u = me();
    if (!showErrors(form, /^\d{2}:\d{2}$/.test(v.time) ? {} : { time: 'Pilih jam' })) return;
    Object.assign(u, { reminder: !!v.reminder, reminderTime: v.time });
    if (save()) { toast(u.reminder ? `Pengingat aktif jam ${v.time}` : 'Pengingat dimatikan'); go('profil'); }
  },
};

// ---------- actions ----------
const actions = {
  peek(btn) {
    const input = btn.previousElementSibling, show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? 'Sembunyikan' : 'Lihat';
    btn.setAttribute('aria-pressed', show);
  },
  demo() {
    let u = db.users.find(x => x.email === 'demo@dompetku.app');
    if (!u) {
      u = { ...newUser('Pengguna Demo', 'demo@dompetku.app', randomId()), target: 10_000_000 };
      db.users.push(u);
    }
    if (!db.txs.some(t => t.userId === u.id)) db.txs.push(...C.demoTransactions(u.id, new Date()));
    signIn(u, 'Mode demo: data contoh dimuat');
  },
  settype(btn) {
    const form = btn.form, type = btn.dataset.type;
    form.elements.type.value = type;
    form.querySelectorAll('[data-act="settype"]').forEach(b => b.setAttribute('aria-pressed', b === btn));
    if (!C.CATEGORIES[type].includes(form.elements.category.value)) form.elements.category.value = '';
    form.querySelector('#cats').innerHTML = catChips(type, form.elements.category.value);
  },
  setcat(btn) {
    btn.form.elements.category.value = btn.dataset.cat;
    btn.parentElement.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === btn));
  },
  delete(btn) {
    if (!confirm('Hapus transaksi ini?')) return;
    db.txs = db.txs.filter(t => !(t.id === btn.dataset.id && t.userId === db.session));
    if (save()) { toast('Transaksi dihapus'); go(lastMain); }
  },
  cleartarget() {
    me().target = 0;
    if (save()) { toast('Target dihapus'); go('profil'); }
  },
  export() {
    const csv = '﻿' + C.toCSV(myTx());
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })),
      download: `dompetku-${C.isoDate(new Date())}.csv`,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(`${myTx().length} transaksi diekspor`);
  },
  wipe() {
    if (!confirm('Hapus akun ini beserta semua transaksinya dari perangkat? Tindakan ini tidak bisa dibatalkan.')) return;
    const id = db.session;
    db.txs = db.txs.filter(t => t.userId !== id);
    db.users = db.users.filter(u => u.id !== id);
    db.session = null;
    if (save()) { toast('Akun dan data dihapus'); go('masuk'); }
  },
  logout() {
    db.session = null;
    if (save()) { toast('Sampai jumpa!'); go('masuk'); }
  },
};

// ---------- router ----------
const PUBLIC = new Set(['masuk', 'daftar', 'lupa', 'sk']);
const MAIN = new Set(['beranda', 'riwayat']);
let lastMain = 'beranda', lastPath = '';
const go = path => { location.hash = '#/' + path; };

function render() {
  const [raw, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  let [path, id] = raw.startsWith('ubah/') ? ['ubah', raw.slice(5)] : [raw, null];
  const user = me();
  if (!views[path]) return go(user ? 'beranda' : 'masuk');
  if (!PUBLIC.has(path) && !user) return go('masuk');
  if (user && (path === 'masuk' || path === 'daftar')) return go('beranda');
  if (MAIN.has(path)) lastMain = raw + (query ? '?' + query : '');
  document.documentElement.dataset.theme = user?.theme || 'system';
  document.getElementById('app').innerHTML = views[path](new URLSearchParams(query), id);
  if (raw !== lastPath) window.scrollTo(0, 0);
  lastPath = raw;
}

const app = document.getElementById('app');
app.addEventListener('click', e => {
  const el = e.target.closest('[data-go], [data-act]');
  if (!el) return;
  if (el.dataset.go !== undefined) go(el.dataset.go);
  else actions[el.dataset.act]?.(el, e);
});
app.addEventListener('submit', e => { e.preventDefault(); forms[e.target.dataset.form]?.(e.target); });
app.addEventListener('input', e => {
  if (e.target.name === 'amount') e.target.value = C.groupDigits(C.parseAmount(e.target.value));
});
app.addEventListener('change', e => {
  if (e.target.name !== 'theme') return;
  me().theme = e.target.value;
  document.documentElement.dataset.theme = e.target.value;
  if (save()) toast('Tema diganti');
});
window.addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
