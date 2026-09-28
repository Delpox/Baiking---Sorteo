#!/usr/bin/env node
// Renderiza assets/img/og.html → assets/img/og.png (1200×630) para compartir en redes.
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
await page.goto(`file://${path.join(root, 'assets/img/og.html')}`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(root, 'assets/img/og.png'), type: 'png' });
await browser.close();
console.log('✔ assets/img/og.png');
