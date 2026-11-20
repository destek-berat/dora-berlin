// Run from the GitHub repository root as: node scripts/build-cloudflare.mjs
// Publish only safe static assets. Never publish backend source or setup SQL.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const output = 'dist';
mkdirSync(output, { recursive: true });

for (const name of [
  'index.html', 'admin.html', 'gizlilik-politikasi.html',
  'hakkimizda.html', 'mesafeli-satis-sozlesmesi.html', 'teslimat-iade.html',
  'favicon.ico',
]) {
  if (!existsSync(name)) throw new Error(`Eksik site dosyası: ${name}`);
  cpSync(name, join(output, name));
}

if (existsSync('assets')) cpSync('assets', join(output, 'assets'), { recursive: true });
// Only the checkout endpoints count as paid/limited serverless invocations.
writeFileSync(join(output, '_routes.json'), JSON.stringify({
  version: 1, include: ['/api/checkout-start', '/api/checkout-callback'], exclude: [],
}));
console.log('Cloudflare Pages dosyaları dist/ içine hazırlandı.');
