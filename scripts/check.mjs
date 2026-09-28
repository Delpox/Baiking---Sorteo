#!/usr/bin/env node
// Verificaciones rápidas antes de publicar: configuración coherente,
// íconos referenciados existentes, assets enlazados presentes y sintaxis del backend.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const errores = [];
const avisos = [];

// --- config ---
const cfg = JSON.parse(readFileSync(path.join(root, 'config/campaign.json'), 'utf8'));
const ids = (arr) => arr.map((x) => x.id);
const unique = (arr) => new Set(arr).size === arr.length;

if (!unique(ids(cfg.packs))) errores.push('packs: ids duplicados');
if (!unique(ids(cfg.bicis))) errores.push('bicis: ids duplicados');
if (cfg.packs.filter((p) => p.destacado).length !== 1) avisos.push('packs: debería haber exactamente un pack destacado');
for (const p of cfg.packs) {
  if (!(Number.isFinite(p.precio) && p.precio > 0)) errores.push(`pack ${p.id}: precio inválido`);
  if (!(Number.isInteger(p.participaciones) && p.participaciones > 0)) errores.push(`pack ${p.id}: participaciones inválidas`);
}
for (let i = 1; i < cfg.packs.length; i++) {
  const a = cfg.packs[i - 1], b = cfg.packs[i];
  if (b.participaciones <= a.participaciones || b.precio <= a.precio) avisos.push(`packs: ${b.id} no es creciente respecto de ${a.id}`);
  if (b.precio / b.participaciones > a.precio / a.participaciones) avisos.push(`packs: ${b.id} sale más caro por unidad que ${a.id}`);
}
const fs = new Date(cfg.edicion.fecha_sorteo).getTime();
const cv = new Date(cfg.edicion.cierre_ventas).getTime();
if (!(cv < fs)) errores.push('edicion: cierre_ventas debe ser anterior a fecha_sorteo');
if (fs < Date.now()) avisos.push('edicion: la fecha del sorteo ya pasó');
if (!['demo', 'api', 'externo'].includes(cfg.checkout.modo)) errores.push('checkout.modo inválido');
if (cfg.checkout.modo === 'externo') {
  for (const p of cfg.packs) if (!p.url_externa) errores.push(`pack ${p.id}: falta url_externa (modo externo)`);
}
if (!/^\d{11,14}$/.test(cfg.contacto.whatsapp)) errores.push('contacto.whatsapp debe ser numérico con código de país (549...)');
const pendientes = JSON.stringify(cfg).match(/\[A CONFIRMAR\][^"]*/g) || [];
if (pendientes.length) avisos.push(`config: ${pendientes.length} valores marcados [A CONFIRMAR]`);

// --- íconos ---
const sprite = readFileSync(path.join(root, 'assets/img/sprite.svg'), 'utf8');
const symbols = new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
const htmls = ['index.html', 'gracias.html', 'participa-sin-cargo.html', 'bases-y-condiciones.html', 'sorteo.html', 'admin.html'];
const jsFiles = ['assets/js/app.js', 'assets/js/gracias.js', 'assets/js/admin.js'];
for (const f of [...htmls, ...jsFiles]) {
  const src = readFileSync(path.join(root, f), 'utf8');
  for (const m of src.matchAll(/#(ico-[a-z-]+|art-[a-z]+)/g)) {
    if (!symbols.has(m[1])) errores.push(`${f}: ícono #${m[1]} no existe en sprite.svg`);
  }
  if (f.endsWith('.html')) {
    for (const m of src.matchAll(/(?:href|src)="(assets\/[^"#?]+)"/g)) {
      if (!existsSync(path.join(root, m[1]))) errores.push(`${f}: asset faltante ${m[1]}`);
    }
    for (const m of src.matchAll(/href="([a-z-]+\.html)(?:#[^"]*)?"/g)) {
      if (!existsSync(path.join(root, m[1]))) errores.push(`${f}: página enlazada faltante ${m[1]}`);
    }
  }
}
for (const b of cfg.bicis) if (!symbols.has(`art-${b.ilustracion}`)) errores.push(`bici ${b.id}: ilustración art-${b.ilustracion} inexistente`);

// --- sintaxis JS (frontend + backend) ---
const apiFiles = [
  'api/checkout.js', 'api/orden.js', 'api/export.js', 'api/participacion-gratuita.js', 'api/webhooks/mercadopago.js',
  'api/admin.js', 'api/ping.js', 'api/comprobante.js', 'api/inbound-email.js', 'api/progreso.js',
  'api/_lib/db.js', 'api/_lib/http.js', 'api/_lib/mercadopago.js', 'api/_lib/notificaciones.js', 'api/_lib/confirmar.js',
  'api/_lib/comprobante.js',
];
for (const f of [...apiFiles, ...jsFiles, 'scripts/sorteo.mjs', 'scripts/build-demo.mjs', 'scripts/screenshots.mjs', 'scripts/og-image.mjs']) {
  try {
    execFileSync(process.execPath, ['--check', path.join(root, f)], { stdio: 'pipe' });
  } catch (e) {
    errores.push(`${f}: error de sintaxis\n${e.stderr}`);
  }
}

// --- resumen ---
for (const a of avisos) console.log(`⚠  ${a}`);
for (const e of errores) console.log(`✖  ${e}`);
if (errores.length) {
  console.log(`\n${errores.length} error(es).`);
  process.exit(1);
}
console.log(`\n✔ Todo en orden (${avisos.length} aviso(s)). Packs: ${cfg.packs.length} · Bicis: ${cfg.bicis.length} · Modo checkout: ${cfg.checkout.modo}`);
