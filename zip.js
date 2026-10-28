// Minimal ZIP writer (stored, no compression): JPEGs are already compressed, so deflate would gain nothing.
// zipParts([{ name, data: Uint8Array }]) -> array of byte chunks; new Blob(parts) is the archive, with no extra
// full-size copy (matters on phones with hundreds of photos). zip() joins them for tests. Tested in test.mjs.

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
export const crc32 = bytes => {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

// ponytail: no ZIP64, so the archive caps at 4 GB / 65535 files; far above what a phone holds here.
export function zip(files, now) {
  const all = zipParts(files, now);
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let p = 0;
  for (const part of all) { out.set(part, p); p += part.length; }
  return out;
}

export function zipParts(files, now = new Date()) {
  const enc = new TextEncoder();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const head = (sig, extra) => {
      const b = new DataView(new ArrayBuffer(extra));
      b.setUint32(0, sig, true);
      return b;
    };
    const local = head(0x04034b50, 30);
    local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); // version, UTF-8 names
    local.setUint16(10, time, true); local.setUint16(12, date, true);
    local.setUint32(14, crc, true); local.setUint32(18, size, true); local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    const cen = head(0x02014b50, 46);
    cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
    cen.setUint16(12, time, true); cen.setUint16(14, date, true);
    cen.setUint32(16, crc, true); cen.setUint32(20, size, true); cen.setUint32(24, size, true);
    cen.setUint16(28, name.length, true); cen.setUint32(42, offset, true);
    parts.push(new Uint8Array(local.buffer), name, f.data);
    central.push(new Uint8Array(cen.buffer), name);
    offset += 30 + name.length + size;
  }
  const cenSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
  return [...parts, ...central, new Uint8Array(end.buffer)];
}
