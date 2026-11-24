import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
// Keep inlined code from closing the script tag early.
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');

const template = read('src/template.html');
const out = template
  .replace('/*__LAWS__*/', () => safe(read('data/laws.js')))
  .replace('/*__APP__*/', () => safe(read('src/app.js')));
if (out.includes('/*__')) throw new Error('a placeholder was not replaced');
writeFileSync(join(here, 'index.html'), out);
console.log('wrote index.html,', out.length, 'bytes');
