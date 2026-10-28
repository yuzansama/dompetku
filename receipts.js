// Receipt photos: IndexedDB store `receipts` (localStorage is ~5 MB, too small for images) + JPEG compression.
import { fitSize } from './core.js';

let dbp;
const db = () => dbp ||= new Promise((resolve, reject) => {
  const req = indexedDB.open('dompetku', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('receipts', { keyPath: 'id' }).createIndex('userId', 'userId');
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const run = async (mode, fn) => {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('receipts', mode), store = tx.objectStore('receipts');
    const req = fn(store);
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
};

export const putReceipt = rec => run('readwrite', s => s.put(rec));
export const getReceipt = id => run('readonly', s => s.get(id));
export const deleteReceipt = id => run('readwrite', s => s.delete(id));
export const userReceipts = userId => run('readonly', s => s.index('userId').getAll(userId));
export const allReceiptIds = () => run('readonly', s => s.getAllKeys());

export async function deleteUserReceipts(userId) {
  for (const r of await userReceipts(userId)) await deleteReceipt(r.id);
}

// drop photos no transaction points at (e.g. the app was closed between saving the photo and the transaction)
export async function pruneOrphans(referenced) {
  for (const id of await allReceiptIds()) if (!referenced.has(id)) await deleteReceipt(id);
}

// longest side 1600 px, JPEG 0.8. <img> applies EXIF orientation, so phone photos come out upright.
export async function compress(file, max = 1600, quality = 0.8) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const [w, h] = fitSize(img.naturalWidth, img.naturalHeight, max);
    const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h); // transparent PNG screenshots would turn black in JPEG
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob) throw new Error('encode failed');
    return { blob, width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}
