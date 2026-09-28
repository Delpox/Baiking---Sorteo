#!/usr/bin/env node
// Empaqueta cada página en un único archivo HTML (CSS, JS, sprite y config
// inline) para compartirla sin servidor. Salida:
//   dist/*.html            páginas completas y autocontenidas
//   dist/artifact/index.html  la landing sin <html>/<head>/<body> (formato que
//                             espera la herramienta de artifacts de Claude)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const dist = path.join(root, 'dist');
await mkdir(path.join(dist, 'artifact'), { recursive: true });

const sprite = await readFile(path.join(root, 'assets/img/sprite.svg'), 'utf8');
const cfg = JSON.parse(await readFile(path.join(root, 'config/campaign.json'), 'utf8'));

const cacheBin = new Map();
async function binary(rel) {
  if (!cacheBin.has(rel)) {
    try {
      cacheBin.set(rel, await readFile(path.join(root, rel)));
    } catch {
      cacheBin.set(rel, null);
    }
  }
  return cacheBin.get(rel);
}
// Las imágenes que referencia la config (logo, fotos de las bicis, del local, de Gastón)
// van inline como data URI, para que la versión autocontenida las muestre.
const MIME = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
async function dataUri(rel) {
  const ext = (rel.match(/\.(png|webp|jpe?g)$/i) || [])[1]?.toLowerCase();
  if (!ext) return null;
  const buf = await binary(rel);
  if (!buf || buf.length > 600 * 1024) return null;
  return `data:${MIME[ext]};base64,${buf.toString('base64')}`;
}
async function inlinarImagenes(obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && /^assets\/img\/[^\s"]+\.(png|webp|jpe?g)$/i.test(v)) {
      const uri = await dataUri(v);
      if (uri) obj[k] = uri;
    } else if (v && typeof v === 'object') {
      await inlinarImagenes(v);
    }
  }
}
await inlinarImagenes(cfg);

// Evita cerrar el <script> desde datos inline.
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
const preload = `<script>window.__CAMPAIGN__=${safe(JSON.stringify(cfg))};window.__SPRITE__=${safe(JSON.stringify(sprite))};</script>`;

const cache = new Map();
async function asset(rel) {
  if (!cache.has(rel)) cache.set(rel, await readFile(path.join(root, rel), 'utf8'));
  return cache.get(rel);
}

// OJO: replace() con un string de reemplazo interpreta "$$", "$&", "$'" y "$`"
// como patrones especiales (y el código usa "$$"). Siempre pasar una función.
async function inline(html) {
  const links = [...html.matchAll(/<link rel="stylesheet" href="(assets\/css\/[^"]+)">/g)];
  for (const m of links) {
    const css = await asset(m[1]);
    html = html.replace(m[0], () => `<style>\n${css}\n</style>`);
  }
  const scripts = [...html.matchAll(/<script src="(assets\/js\/[^"]+)" defer><\/script>/g)];
  for (const m of scripts) {
    const js = await asset(m[1]);
    const pre = m[1].endsWith('/app.js') ? `${preload}\n` : '';
    html = html.replace(m[0], () => `${pre}<script>\n${safe(js)}\n</script>`);
  }
  // Imágenes chicas (logo, favicons) como data URI, para que el archivo sea autocontenido.
  const imgs = [...html.matchAll(/(src|href)="(assets\/img\/[^"]+\.(?:png|webp|jpe?g))"/g)];
  for (const m of imgs) {
    const uri = await dataUri(m[2]);
    if (!uri) continue;
    html = html.replace(m[0], () => `${m[1]}="${uri}"`);
  }
  return html;
}

const pages = ['index.html', 'participa-sin-cargo.html', 'bases-y-condiciones.html', 'gracias.html', 'sorteo.html', 'admin.html'];
for (const file of pages) {
  const html = await inline(await readFile(path.join(root, file), 'utf8'));
  await writeFile(path.join(dist, file), html);
  console.log(`✔ dist/${file} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
}

// Variante "artifact": solo el contenido (la herramienta agrega el esqueleto del documento).
async function artifactFlavor(file, titulo, extraScript = '') {
  const html = await inline(await readFile(path.join(root, file), 'utf8'));
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
  const bodyMatch = html.match(/<body([^>]*)>([\s\S]*?)<\/body>/);
  const bodyAttrs = bodyMatch[1];
  const body = bodyMatch[2];
  const page = (bodyAttrs.match(/data-page="([^"]+)"/) || [])[1] || 'home';
  const clase = (bodyAttrs.match(/class="([^"]+)"/) || [])[1] || '';
  const styles = [...head.matchAll(/<style>[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
  const fontLinks = [...head.matchAll(/<link[^>]*(fonts\.googleapis|fonts\.gstatic)[^>]*>/g)].map((m) => m[0]).join('\n');
  const out = `<title>${titulo}</title>
${fontLinks}
${styles}
<script>document.body.dataset.page='${page}';${clase ? `document.body.classList.add('${clase}');` : ''}${extraScript}</script>
${body}`;
  await writeFile(path.join(dist, 'artifact', file), out);
  console.log(`✔ dist/artifact/${file} (${(Buffer.byteLength(out) / 1024).toFixed(0)} KB)`);
}
await artifactFlavor('index.html', 'Baiking Participá');
await artifactFlavor('admin.html', 'Panel Baiking', 'window.__ADMIN_DEMO__=true;');
