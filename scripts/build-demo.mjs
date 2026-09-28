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

const css = await readFile(path.join(root, 'assets/css/styles.css'), 'utf8');
const app = await readFile(path.join(root, 'assets/js/app.js'), 'utf8');
const gracias = await readFile(path.join(root, 'assets/js/gracias.js'), 'utf8');
const sprite = await readFile(path.join(root, 'assets/img/sprite.svg'), 'utf8');
const cfg = JSON.parse(await readFile(path.join(root, 'config/campaign.json'), 'utf8'));

// Evita cerrar el <script> desde datos inline.
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
const preload = `<script>window.__CAMPAIGN__=${safe(JSON.stringify(cfg))};window.__SPRITE__=${safe(JSON.stringify(sprite))};</script>`;

function inline(html) {
  return html
    .replace('<link rel="stylesheet" href="assets/css/styles.css">', `<style>\n${css}\n</style>`)
    .replace('<script src="assets/js/app.js" defer></script>', `${preload}\n<script>\n${safe(app)}\n</script>`)
    .replace('<script src="assets/js/gracias.js" defer></script>', `<script>\n${safe(gracias)}\n</script>`);
}

const pages = ['index.html', 'participa-sin-cargo.html', 'bases-y-condiciones.html', 'gracias.html', 'sorteo.html'];
for (const file of pages) {
  const html = inline(await readFile(path.join(root, file), 'utf8'));
  await writeFile(path.join(dist, file), html);
  console.log(`✔ dist/${file} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
}

// Variante "artifact": solo el contenido (la herramienta agrega el esqueleto del documento).
const home = inline(await readFile(path.join(root, 'index.html'), 'utf8'));
const head = home.match(/<head>([\s\S]*?)<\/head>/)[1];
const bodyMatch = home.match(/<body([^>]*)>([\s\S]*?)<\/body>/);
const bodyAttrs = bodyMatch[1];
const body = bodyMatch[2];
const page = (bodyAttrs.match(/data-page="([^"]+)"/) || [])[1] || 'home';
const keep = head
  .split('\n')
  .filter((l) => /<link|<style|<\/style|^\s*$/.test(l) || !/^\s*<(meta|title)/.test(l))
  .join('\n');
// `keep` conserva links de fuentes y el bloque <style>; quitamos metas y título del sitio.
const styleStart = keep.indexOf('<style>');
const styleEnd = keep.indexOf('</style>') + '</style>'.length;
const fontLinks = [...head.matchAll(/<link[^>]*(fonts\.googleapis|fonts\.gstatic)[^>]*>/g)].map((m) => m[0]).join('\n');
const artifact = `<title>Baiking Participá</title>
${fontLinks}
${keep.slice(styleStart, styleEnd)}
<script>document.body.dataset.page='${page}';</script>
${body}`;
await writeFile(path.join(dist, 'artifact', 'index.html'), artifact);
console.log(`✔ dist/artifact/index.html (${(Buffer.byteLength(artifact) / 1024).toFixed(0)} KB)`);
