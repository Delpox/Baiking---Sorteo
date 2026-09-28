#!/usr/bin/env node
// Renderiza assets/img/og.html → assets/img/og.png (1200×630) para compartir en redes.
import path from 'node:path';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const cfg = JSON.parse(await readFile(path.join(root, 'config/campaign.json'), 'utf8'));
// Los tokens de og.html salen de la config para que la imagen no quede desactualizada.
const fecha = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' }).format(
  new Date(cfg.edicion.fecha_sorteo),
);
const html = (await readFile(path.join(root, 'assets/img/og.html'), 'utf8'))
  .replaceAll('{{fecha_sorteo}}', fecha)
  .replaceAll('{{edicion}}', cfg.edicion.nombre);
const tmp = path.join(root, 'assets/img/.og-render.html');
await writeFile(tmp, html);
try {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  await page.goto(`file://${tmp}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(root, 'assets/img/og.png'), type: 'png' });
  await browser.close();
} finally {
  await unlink(tmp);
}
console.log(`✔ assets/img/og.png (sorteo: ${fecha})`);
