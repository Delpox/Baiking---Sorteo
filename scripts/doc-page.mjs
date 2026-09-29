#!/usr/bin/env node
// Convierte un documento Markdown de docs/ en una página HTML con la identidad del sitio,
// lista para publicar como artifact (sin <html>/<head>/<body>: solo título, estilos y contenido).
//   node scripts/doc-page.mjs docs/07-puesta-en-marcha.md  →  dist/artifact/doc-07-puesta-en-marcha.html
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const entrada = process.argv[2];
if (!entrada) {
  console.error('Uso: node scripts/doc-page.mjs docs/<archivo>.md');
  process.exit(1);
}
const md = await readFile(path.join(root, entrada), 'utf8');

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

const lines = md.split('\n');
const out = [];
let titulo = 'Documento';
let i = 0;
const flushPara = (buf) => {
  if (buf.length) out.push(`<p>${inline(buf.join(' '))}</p>`);
  buf.length = 0;
};
const para = [];
while (i < lines.length) {
  const l = lines[i];
  if (/^```/.test(l)) {
    flushPara(para);
    const code = [];
    i++;
    while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
    i++;
    out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
    continue;
  }
  const h = l.match(/^(#{1,3})\s+(.*)$/);
  if (h) {
    flushPara(para);
    const n = h[1].length;
    if (n === 1) titulo = h[2];
    out.push(`<h${n}>${inline(h[2])}</h${n}>`);
    i++;
    continue;
  }
  if (/^\|/.test(l)) {
    flushPara(para);
    const rows = [];
    while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
    const celdas = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const head = celdas(rows[0]);
    const body = rows.slice(2).map(celdas);
    out.push(
      `<div class="tabla"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table></div>`,
    );
    continue;
  }
  const li = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
  if (li) {
    flushPara(para);
    const ordered = /\d/.test(li[2]);
    const items = [];
    while (i < lines.length) {
      const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
      if (!m) break;
      items.push(m[3]);
      i++;
    }
    out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
    continue;
  }
  if (!l.trim()) {
    flushPara(para);
    i++;
    continue;
  }
  para.push(l.trim());
  i++;
}
flushPara(para);

const html = `<title>${esc(titulo.length > 60 ? titulo.slice(0, 57) + '…' : titulo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,500..900&family=Figtree:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light; --bg: #ffffff; --bg-2: #f7f5f6; --fg: #1c1a1b; --fg-2: #4a4649; --muted: #6e686b; --line: #e6e0e2; --rojo: #eb0627; --rojo-ink: #c40020; --rojo-soft: #fff0f2; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font-family: Figtree, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.6; }
  .doc { width: min(100% - 32px, 860px); margin-inline: auto; padding-block: 36px 72px; }
  .marca { display: inline-block; background: var(--rojo); color: #fff; font-weight: 700; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; padding: 6px 10px; border-radius: 6px; }
  h1, h2, h3 { font-family: Archivo, 'Helvetica Neue', Arial, sans-serif; font-weight: 800; font-stretch: 112%; letter-spacing: -0.015em; line-height: 1.08; text-wrap: balance; }
  h1 { font-size: clamp(30px, 4.5vw, 42px); margin: 14px 0 10px; }
  h2 { font-size: 24px; margin: 44px 0 10px; padding-top: 22px; border-top: 1px solid var(--line); }
  h3 { font-size: 18px; margin: 26px 0 8px; }
  p { margin: 10px 0; color: var(--fg-2); max-width: 72ch; }
  ul, ol { margin: 10px 0; padding-left: 22px; color: var(--fg-2); }
  li + li { margin-top: 6px; }
  strong { color: var(--fg); }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; background: var(--bg-2); border: 1px solid var(--line); border-radius: 5px; padding: 1px 5px; }
  pre { background: var(--bg-2); border: 1px solid var(--line); border-radius: 12px; padding: 16px; overflow-x: auto; font-size: 13px; line-height: 1.5; }
  pre code { background: none; border: 0; padding: 0; }
  .tabla { overflow-x: auto; margin: 14px 0; border: 1px solid var(--line); border-radius: 12px; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { text-align: left; vertical-align: top; padding: 10px 12px; border-bottom: 1px solid var(--line); }
  th { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); background: var(--bg-2); }
  tr:last-child td { border-bottom: 0; }
  a { color: var(--rojo-ink); }
</style>
<div class="doc">
  <span class="marca">Baiking · documento de trabajo</span>
  ${out.join('\n')}
</div>
`;

const nombre = `doc-${path.basename(entrada, '.md')}.html`;
await mkdir(path.join(root, 'dist/artifact'), { recursive: true });
await writeFile(path.join(root, 'dist/artifact', nombre), html);
console.log(`✔ dist/artifact/${nombre} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
