// Pure logic for Dompetku: no DOM, no storage. Tested by test.mjs (node test.mjs).

export const CATEGORIES = {
  expense: ['Makan', 'Transport', 'Tagihan', 'Belanja', 'Hiburan', 'Lainnya'],
  income: ['Gaji', 'Bonus', 'Hadiah', 'Lainnya'],
};
export const MAX_AMOUNT = 999_999_999_999;

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus',
  'September', 'Oktober', 'November', 'Desember'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const rupiah = n => (n < 0 ? '-' : '') + 'Rp ' + Math.abs(n).toLocaleString('id-ID');

// "1.250.000" / "Rp 1.250.000" -> 1250000; anything without digits -> 0
export const parseAmount = s => Number(String(s).replace(/\D/g, '').slice(0, 12)) || 0;
export const groupDigits = n => (n ? n.toLocaleString('id-ID') : '');

const pad = n => String(n).padStart(2, '0');
export const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };

export const shortDate = iso => { const d = parseIso(iso); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };
export const longDate = iso => { const d = parseIso(iso); return `${DAYS[d.getDay()]}, ${shortDate(iso)}`; };
export const monthLabel = ym => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
export const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const balance = txs => txs.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);

export const monthTotals = (txs, ym) => {
  const r = { income: 0, expense: 0 };
  for (const t of txs) if (t.date.startsWith(ym)) r[t.type] += t.amount;
  return r;
};

// newest first: by date, then by creation time
export const sortTx = txs => [...txs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

// proof: 'ada' = has a receipt photo, 'tanpa' = has none
export const filterTx = (txs, { ym, category, type, proof } = {}) => txs.filter(t =>
  (!ym || t.date.startsWith(ym)) && (!category || t.category === category) && (!type || t.type === type) &&
  (!proof || (proof === 'ada') === !!t.receiptId));

// file name of a receipt photo inside the export ZIP, e.g. bukti/2026-10-28_makan_45000_a1b2c3.jpg
export const receiptFileName = t =>
  `bukti/${t.date}_${t.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}_${t.amount}_${String(t.receiptId).slice(0, 6)}.jpg`;

export const formatBytes = n => n < 1024 * 1024
  ? `${Math.max(1, Math.round(n / 1024)).toLocaleString('id-ID')} KB`
  : `${(n / 1024 / 1024).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;

// shrink (never enlarge) so the longest side is at most `max`
export const fitSize = (w, h, max) => {
  const s = Math.min(1, max / Math.max(w, h));
  return [Math.round(w * s), Math.round(h * s)];
};

// [[date, [tx...]], ...] newest date first
export const groupByDate = txs => {
  const groups = new Map();
  for (const t of sortTx(txs)) {
    if (!groups.has(t.date)) groups.set(t.date, []);
    groups.get(t.date).push(t);
  }
  return [...groups];
};

export const progress = (saved, target) => (target > 0 ? Math.max(0, Math.min(100, Math.round(saved / target * 100))) : 0);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateRegister({ name, email, password, password2, agree }, takenEmails = []) {
  const e = {};
  if (!name.trim()) e.name = 'Nama wajib diisi';
  if (!EMAIL.test(email.trim())) e.email = 'Format email tidak valid';
  else if (takenEmails.includes(email.trim().toLowerCase())) e.email = 'Email sudah terdaftar';
  Object.assign(e, validatePassword(password, password2));
  if (!agree) e.agree = 'Setujui syarat & ketentuan dulu';
  return e;
}

export function validatePassword(password, password2) {
  const e = {};
  if (password.length < 8) e.password = 'Password minimal 8 karakter';
  if (password !== password2) e.password2 = 'Konfirmasi password tidak sama';
  return e;
}

export function validateProfile({ name, email }, takenEmails = []) {
  const e = {};
  if (!name.trim()) e.name = 'Nama wajib diisi';
  if (!EMAIL.test(email.trim())) e.email = 'Format email tidak valid';
  else if (takenEmails.includes(email.trim().toLowerCase())) e.email = 'Email sudah dipakai akun lain';
  return e;
}

export function validateTx({ type, amount, category, date, note }) {
  const e = {};
  if (!CATEGORIES[type]) e.type = 'Pilih jenis transaksi';
  if (!(amount > 0)) e.amount = 'Nominal harus lebih dari 0';
  else if (amount > MAX_AMOUNT) e.amount = 'Nominal terlalu besar';
  if (!CATEGORIES[type]?.includes(category)) e.category = 'Pilih kategori';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) e.date = 'Tanggal tidak valid';
  if ((note || '').length > 100) e.note = 'Catatan maksimal 100 karakter';
  return e;
}

// true when the reminder should show: enabled, its time has passed today, and nothing logged today
export function reminderDue(user, txs, now) {
  if (!user.reminder) return false;
  const [h, m] = (user.reminderTime || '20:00').split(':').map(Number);
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return false;
  const today = isoDate(now);
  return !txs.some(t => t.date === today);
}

const csvCell = v => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
export const toCSV = txs => ['tanggal,jenis,kategori,nominal,catatan,bukti',
  ...sortTx(txs).map(t => [t.date, t.type === 'income' ? 'pemasukan' : 'pengeluaran', t.category, t.amount, t.note || '',
    t.receiptId ? receiptFileName(t) : '']
    .map(csvCell).join(','))].join('\n');

export const escapeHtml = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Demo data relative to `today` so the demo always looks current.
export function demoTransactions(userId, today) {
  const day = n => { const d = new Date(today); d.setDate(d.getDate() - n); return isoDate(d); };
  const rows = [
    [0, 'expense', 45000, 'Makan', 'Makan siang'], [1, 'expense', 22000, 'Makan', 'Kopi susu'],
    [2, 'expense', 200000, 'Tagihan', 'Token listrik'], [2, 'expense', 28000, 'Transport', 'Ojek online'],
    [3, 'income', 6000000, 'Gaji', 'Gaji bulanan'], [4, 'expense', 650000, 'Belanja', 'Belanja bulanan'],
    [6, 'expense', 120000, 'Hiburan', 'Nonton bioskop'], [9, 'expense', 350000, 'Tagihan', 'Internet rumah'],
    [12, 'income', 500000, 'Bonus', 'Bonus proyek'], [15, 'expense', 85000, 'Transport', 'Bensin'],
  ];
  return rows.map(([ago, type, amount, category, note], i) =>
    ({ id: `demo-${i}`, userId, type, amount, category, date: day(ago), note, createdAt: i }));
}

// --- password hashing: SHA-256 stretched with a per-user salt ---
// Pure JS on purpose: crypto.subtle only exists on https/localhost, and the app must also
// run when opened from a phone over plain http on the LAN.
// ponytail: local-only gate, data sits unencrypted in localStorage anyway; move to a server-side
// hash (argon2/bcrypt) if accounts ever leave the device.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);

export function sha256(bytes) {
  const len = bytes.length, total = ((len + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(total);
  m.set(bytes); m[len] = 0x80;
  const bits = len * 8;
  for (let i = 0; i < 8; i++) m[total - 1 - i] = Math.floor(bits / 2 ** (8 * i)) & 0xff;
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = (m[o + 4 * i] << 24) | (m[o + 4 * i + 1] << 16) | (m[o + 4 * i + 2] << 8) | m[o + 4 * i + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i];
      const t2 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c));
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) out[4 * i + j] = h[i] >>> (24 - 8 * j);
  return out;
}

const hex = b => [...b].map(x => x.toString(16).padStart(2, '0')).join('');
export const sha256Hex = s => hex(sha256(new TextEncoder().encode(s)));

export function hashPassword(password, salt, rounds = 5000) {
  const enc = new TextEncoder();
  let h = sha256(enc.encode(salt + ':' + password));
  const saltBytes = enc.encode(salt);
  for (let i = 1; i < rounds; i++) {
    const buf = new Uint8Array(32 + saltBytes.length);
    buf.set(h); buf.set(saltBytes, 32);
    h = sha256(buf);
  }
  return hex(h);
}
