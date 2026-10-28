// Sets sw.js CACHE to a hash of every cached app file, so any change ships to installed users
// (the browser re-installs the service worker only when sw.js bytes change). Run before each deploy:
//   node stamp.mjs        -> rewrites sw.js
// test.mjs fails while the stamp is stale.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
export function expectedCache() {
  const sw = readFileSync(dir + 'sw.js', 'utf8');
  const files = JSON.parse(sw.match(/const FILES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  const h = createHash('sha256');
  for (const f of files.filter(f => f !== './')) {
    const bytes = readFileSync(dir + f);
    // text files hashed with LF endings, so a CRLF checkout (git on Windows) gives the same stamp
    h.update(f).update(/\.(png|woff2)$/.test(f) ? bytes : bytes.toString('utf8').replace(/\r\n/g, '\n'));
  }
  return { sw, cache: 'dompetku-' + h.digest('hex').slice(0, 10) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { sw, cache } = expectedCache();
  writeFileSync(dir + 'sw.js', sw.replace(/const CACHE = '[^']*';/, `const CACHE = '${cache}';`));
  console.log('sw.js CACHE =', cache);
}
