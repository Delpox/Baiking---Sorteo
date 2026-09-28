#!/usr/bin/env node
// Capturas de pantalla (desktop + móvil) de todas las páginas con Playwright,
// y reporte de errores de consola. Salida en ./screenshots.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const outDir = path.join(root, 'screenshots');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  let file = path.join(root, p);
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const pages = [
  { name: 'home', url: '/index.html' },
  { name: 'gratuita', url: '/participa-sin-cargo.html' },
  { name: 'gracias', url: '/gracias.html?demo=1' },
  { name: 'gracias-transferencia', url: '/gracias.html?demo=1&transferencia=1' },
  { name: 'bases', url: '/bases-y-condiciones.html' },
  { name: 'sorteo', url: '/sorteo.html' },
  { name: 'admin', url: '/admin.html?demo=1' },
];
const viewports = [
  { tag: 'desktop', width: 1366, height: 860 },
  { tag: 'mobile', width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 },
];

const browser = await chromium.launch();
const problemas = [];
for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, deviceScaleFactor: vp.deviceScaleFactor || 1, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires', ignoreHTTPSErrors: true });
  for (const pg of pages) {
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && !/ERR_CERT|Failed to load resource/.test(m.text()) && problemas.push(`[${vp.tag}/${pg.name}] console: ${m.text()}`));
    page.on('pageerror', (e) => problemas.push(`[${vp.tag}/${pg.name}] pageerror: ${e.message}`));
    page.on('requestfailed', (r) => !r.url().includes('fonts.g') && problemas.push(`[${vp.tag}/${pg.name}] request failed: ${r.url()}`));
    await page.goto(`${base}${pg.url}`, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: '.reveal{opacity:1!important;transform:none!important;animation:none!important}' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, `${pg.name}-${vp.tag}.png`), fullPage: true });

    if (pg.name === 'home') {
      // Above the fold
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(outDir, `home-hero-${vp.tag}.png`), fullPage: false });
      // Modal de inscripción abierto
      await page.click('.hero [data-open-pack]');
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(outDir, `home-modal-${vp.tag}.png`), fullPage: false });
      // Confirmación en modo demo
      await page.fill('#f-nombre', 'Delfina');
      await page.fill('#f-apellido', 'Nogués');
      await page.fill('#f-dni', '35123456');
      await page.selectOption('#f-provincia', 'Buenos Aires');
      await page.fill('#f-email', 'delfina@ejemplo.com');
      await page.fill('#f-whatsapp', '11 5555 5555');
      await page.check('input[name="mayor_edad"]');
      await page.check('input[name="acepta_bases"]');
      await page.click('#btn-pagar');
      await page.waitForSelector('#modal-success:not([hidden])', { timeout: 5000 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(outDir, `home-confirmacion-${vp.tag}.png`), fullPage: false });
      // Variante: reserva por transferencia
      await page.reload({ waitUntil: 'networkidle' });
      await page.addStyleTag({ content: '.reveal{animation:none!important}' });
      await page.click('.hero [data-open-pack]');
      await page.waitForTimeout(300);
      if (await page.locator('#pago-tr').count()) {
        await page.check('#pago-tr');
        await page.fill('#f-nombre', 'Delfina');
        await page.fill('#f-apellido', 'Nogués');
        await page.fill('#f-dni', '35123456');
        await page.selectOption('#f-provincia', 'Buenos Aires');
        await page.fill('#f-email', 'delfina@ejemplo.com');
        await page.fill('#f-whatsapp', '11 5555 5555');
        await page.check('input[name="mayor_edad"]');
        await page.check('input[name="acepta_bases"]');
        await page.screenshot({ path: path.join(outDir, `home-modal-transferencia-${vp.tag}.png`), fullPage: false });
        await page.click('#btn-pagar');
        await page.waitForSelector('#modal-success:not([hidden])', { timeout: 5000 });
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(outDir, `home-reserva-transferencia-${vp.tag}.png`), fullPage: false });
      }
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
server.close();

if (problemas.length) {
  console.log('Problemas detectados:');
  for (const p of problemas) console.log(' -', p);
  process.exit(1);
}
console.log(`✔ Capturas generadas en ${path.relative(root, outDir)}/ sin errores de consola.`);
