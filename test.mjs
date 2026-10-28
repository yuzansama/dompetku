// Self-check for core.js: node test.mjs
import assert from 'node:assert/strict';
import * as c from './core.js';

assert.equal(c.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
assert.equal(c.sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
assert.equal(c.sha256Hex('a'.repeat(1000)), '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
assert.equal(c.hashPassword('rahasia123', 's1'), c.hashPassword('rahasia123', 's1'));
assert.notEqual(c.hashPassword('rahasia123', 's1'), c.hashPassword('rahasia123', 's2'));

assert.equal(c.rupiah(1250000), 'Rp 1.250.000');
assert.equal(c.rupiah(-45000), '-Rp 45.000');
assert.equal(c.parseAmount('Rp 1.250.000'), 1250000);
assert.equal(c.parseAmount('abc'), 0);
assert.equal(c.groupDigits(45000), '45.000');

assert.equal(c.shiftMonth('2026-01', -1), '2025-12');
assert.equal(c.shiftMonth('2026-12', 1), '2027-01');
assert.equal(c.monthLabel('2026-10'), 'Oktober 2026');
assert.equal(c.longDate('2026-10-27'), 'Selasa, 27 Okt');

const txs = [
  { id: 1, type: 'income', amount: 6000000, category: 'Gaji', date: '2026-10-25', createdAt: 1 },
  { id: 2, type: 'expense', amount: 45000, category: 'Makan', date: '2026-10-27', createdAt: 2 },
  { id: 3, type: 'expense', amount: 22000, category: 'Makan', date: '2026-10-27', createdAt: 3 },
  { id: 4, type: 'expense', amount: 100000, category: 'Tagihan', date: '2026-09-30', createdAt: 4 },
];
assert.equal(c.balance(txs), 6000000 - 45000 - 22000 - 100000);
assert.deepEqual(c.monthTotals(txs, '2026-10'), { income: 6000000, expense: 67000 });
assert.deepEqual(c.sortTx(txs).map(t => t.id), [3, 2, 1, 4]);
assert.deepEqual(c.filterTx(txs, { ym: '2026-10', category: 'Makan' }).map(t => t.id), [2, 3]);
assert.deepEqual(c.filterTx(txs, { type: 'income' }).map(t => t.id), [1]);
assert.deepEqual(c.groupByDate(txs).map(([d, l]) => [d, l.length]), [['2026-10-27', 2], ['2026-10-25', 1], ['2026-09-30', 1]]);

assert.equal(c.progress(4200000, 10000000), 42);
assert.equal(c.progress(-5, 100), 0);
assert.equal(c.progress(500, 100), 100);
assert.equal(c.progress(5, 0), 0);

const ok = { name: 'Rina', email: 'rina@email.com', password: 'rahasia123', password2: 'rahasia123', agree: true };
assert.deepEqual(c.validateRegister(ok), {});
assert.deepEqual(Object.keys(c.validateRegister({ ...ok, name: ' ', email: 'x@y', password: 'short', password2: 'other', agree: false })).sort(),
  ['agree', 'email', 'name', 'password', 'password2']);
assert.equal(c.validateRegister(ok, ['rina@email.com']).email, 'Email sudah terdaftar');

const tx = { type: 'expense', amount: 45000, category: 'Makan', date: '2026-10-28', note: '' };
assert.deepEqual(c.validateTx(tx), {});
assert.ok(c.validateTx({ ...tx, amount: 0 }).amount);
assert.ok(c.validateTx({ ...tx, category: 'Gaji' }).category);
assert.ok(c.validateTx({ ...tx, note: 'x'.repeat(101) }).note);

const user = { reminder: true, reminderTime: '20:00' };
assert.equal(c.reminderDue(user, [], new Date(2026, 9, 28, 19, 59)), false);
assert.equal(c.reminderDue(user, [], new Date(2026, 9, 28, 20, 0)), true);
assert.equal(c.reminderDue(user, [{ date: '2026-10-28' }], new Date(2026, 9, 28, 21, 0)), false);
assert.equal(c.reminderDue({ reminder: false }, [], new Date(2026, 9, 28, 21, 0)), false);

assert.equal(c.toCSV([{ ...tx, note: 'makan, "enak"' }]),
  'tanggal,jenis,kategori,nominal,catatan\n2026-10-28,pengeluaran,Makan,45000,"makan, ""enak"""');
assert.equal(c.escapeHtml('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');

const demo = c.demoTransactions('u1', new Date(2026, 9, 28));
assert.equal(demo.length, 10);
assert.deepEqual(c.validateTx(demo[0]), {});
assert.equal(demo[0].date, '2026-10-28');

console.log('core.js: all checks passed');
