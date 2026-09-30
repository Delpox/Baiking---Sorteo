#!/usr/bin/env node
// Genera dist/mails.html: vista previa de todos los mails automáticos con datos de ejemplo
// (asunto, cuándo se manda, versión HTML tal cual la recibe la persona y versión texto).
// Sirve para revisar el copy y el formato antes de lanzar: node scripts/mails-preview.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import * as N from '../api/_lib/notificaciones.js';
const { armarMailComprobanteRecibido, armarMailConfirmacion, armarMailTransferencia, armarMailGratuitaPendiente } = N;

const root = path.resolve(new URL('..', import.meta.url).pathname);
const campaign = JSON.parse(await readFile(path.join(root, 'config/campaign.json'), 'utf8'));
const baseUrl = (campaign.marca?.sitio_url || 'https://participa.baiking.com.ar').replace(/\/$/, '');
const logoUri = `data:image/png;base64,${(await readFile(path.join(root, 'assets/img/logo-baiking-blanco.png'))).toString('base64')}`;

const pack = campaign.packs.find((p) => p.destacado) || campaign.packs[0];
const ahora = new Date('2026-10-20T15:12:00-03:00');
const orden = {
  id: 'd4f1c6a2-0b6e-4c8b-9d2a-5e7f1a2b3c4d',
  nombre: 'Delfina',
  apellido: 'Nogués',
  dni: '35123456',
  email: 'delfina@example.com',
  bici_preferida: campaign.bicis[0].id,
  pack_id: pack.id,
  cantidad_participaciones: pack.participaciones,
  monto: pack.precio,
  medio_pago: 'transferencia',
  created_at: ahora.toISOString(),
};
// Cada orden pagada tiene un bloque correlativo de números (cada $1 del producto = 1 participación).
const rango = { desde: 12001, hasta: 12000 + pack.participaciones, cantidad: pack.participaciones };
const gratuita = { ...orden, id: 'a9b8c7d6-1e2f-4a3b-8c9d-0e1f2a3b4c5d', pack_id: 'gratuita', medio_pago: 'gratuita', origen: 'gratuita', monto: 0, cantidad_participaciones: 1 };
const rangoGratuita = { desde: 38771, hasta: 38771, cantidad: 1 };

const mails = [
  {
    clave: 'comprobante',
    cuando: 'Al instante, cuando la persona toca "Participar" con el comprobante adjunto.',
    ...armarMailComprobanteRecibido({ orden, campaign, baseUrl }),
  },
  {
    clave: 'confirmacion',
    cuando: 'Cuando Baiking valida la transferencia (desde el panel, la planilla o la aprobación automática). Trae el bloque de participaciones y el link del producto.',
    ...armarMailConfirmacion({ orden, rango, campaign, baseUrl }),
  },
  {
    clave: 'carta',
    cuando: 'Al instante, cuando alguien completa el formulario de participación sin cargo.',
    ...armarMailGratuitaPendiente({ orden: gratuita, campaign, baseUrl }),
  },
  {
    clave: 'carta-confirmada',
    cuando: 'Cuando Baiking marca "Carta recibida" en el panel: la participación queda asignada.',
    ...armarMailConfirmacion({ orden: { ...gratuita, carta_recibida_at: ahora.toISOString() }, rango: rangoGratuita, campaign, baseUrl, gratuita: true }),
  },
  {
    clave: 'datos-transferencia',
    cuando: 'Solo si la orden entra sin comprobante (por ejemplo, si falló la subida): manda los datos y el link para subirlo.',
    ...armarMailTransferencia({ orden, campaign, baseUrl }),
  },
];
// Recordatorios (una semana antes y el día del sorteo): se agregan cuando existen en notificaciones.js.
const persona = { nombre: orden.nombre, email: orden.email };
if (typeof N.armarMailRecordatorioSemana === 'function') {
  mails.push({
    clave: 'recordatorio-semana',
    cuando: 'Una semana antes del sorteo, a las 10:00, a todas las personas con alguna orden (una por mail).',
    ...N.armarMailRecordatorioSemana({ persona, ordenes: [{ ...orden, estado: 'pagada' }], campaign, baseUrl }),
  });
}
if (typeof N.armarMailRecordatorioSorteo === 'function') {
  mails.push({
    clave: 'recordatorio-sorteo',
    cuando: 'El día del sorteo, a las 10:00, a todas las personas con participaciones confirmadas.',
    ...N.armarMailRecordatorioSorteo({ persona, rangos: [rango], campaign, baseUrl }),
  });
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// El HTML del mail se muestra dentro de la página; se reemplaza el logo remoto por la copia inline.
const cuerpo = (html) =>
  html
    .replace(/^[\s\S]*?<body[^>]*>/, '')
    .replace(/<\/body>[\s\S]*$/, '')
    .replaceAll(`${baseUrl}/assets/img/logo-baiking-blanco.png`, logoUri);

const page = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mails automáticos Baiking</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,500..900&family=Figtree:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light; --bg: #ffffff; --bg-2: #f7f5f6; --fg: #1c1a1b; --fg-2: #4a4649; --muted: #6e686b; --line: #e6e0e2; --rojo: #eb0627; --rojo-ink: #c40020; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font-family: Figtree, 'Helvetica Neue', Arial, sans-serif; line-height: 1.55; }
  .wrap { width: min(100% - 32px, 1100px); margin-inline: auto; padding-block: 32px 64px; }
  h1, h2 { font-family: Archivo, 'Helvetica Neue', Arial, sans-serif; font-weight: 800; font-stretch: 112%; letter-spacing: -0.015em; line-height: 1.05; margin: 0; }
  h1 { font-size: 34px; }
  .intro { color: var(--fg-2); max-width: 70ch; margin: 12px 0 0; }
  .toc { display: flex; flex-wrap: wrap; gap: 8px; margin: 22px 0 0; }
  .toc a { padding: 8px 12px; border: 1px solid var(--line); border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--fg); text-decoration: none; }
  .toc a:hover { border-color: var(--rojo); color: var(--rojo-ink); }
  section { margin-top: 44px; padding-top: 28px; border-top: 1px solid var(--line); }
  .num { font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--rojo-ink); }
  h2 { font-size: 24px; margin-top: 8px; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; margin: 14px 0 0; font-size: 14px; }
  dt { color: var(--muted); }
  dd { margin: 0; }
  dd b { font-weight: 700; }
  .cols { display: grid; grid-template-columns: minmax(0, 620px) minmax(0, 1fr); gap: 28px; margin-top: 18px; align-items: start; }
  .mail { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--bg-2); }
  .mail-bar { display: flex; gap: 10px; align-items: center; padding: 10px 14px; background: #fff; border-bottom: 1px solid var(--line); font-size: 13px; color: var(--muted); }
  .mail-bar b { color: var(--fg); }
  .texto { font-size: 13px; }
  .texto summary { cursor: pointer; font-weight: 600; color: var(--fg); }
  .texto pre { white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; line-height: 1.5; background: var(--bg-2); border: 1px solid var(--line); border-radius: 10px; padding: 14px; margin-top: 10px; color: var(--fg-2); }
  .notas { margin-top: 44px; padding: 22px 24px; border-radius: 14px; background: var(--bg-2); border: 1px solid var(--line); }
  .notas h2 { font-size: 20px; }
  .notas ul { margin: 12px 0 0; padding-left: 20px; color: var(--fg-2); }
  .notas li + li { margin-top: 6px; }
  @media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="wrap">
  <span class="num">Baiking · ${esc(campaign.edicion.nombre)}</span>
  <h1>Mails automáticos</h1>
  <p class="intro">Los ${mails.length} mails que manda el sistema solo, con datos de ejemplo. Cada uno tiene un solo botón, el logo arriba y la leyenda legal abajo. Remitente propuesto: <b>Baiking &lt;sorteo@baiking.com.ar&gt;</b>, con respuestas a <b>${esc(campaign.contacto.email)}</b>.</p>
  <nav class="toc">${mails.map((m, i) => `<a href="#m${i + 1}">${i + 1}. ${esc(m.subject.replace(' · Baiking', ''))}</a>`).join('')}</nav>

  ${mails
    .map(
      (m, i) => `
  <section id="m${i + 1}">
    <span class="num">Mail ${i + 1} de ${mails.length}</span>
    <h2>${esc(m.subject.replace(' · Baiking', ''))}</h2>
    <dl>
      <dt>Cuándo</dt><dd>${esc(m.cuando)}</dd>
      <dt>Asunto</dt><dd><b>${esc(m.subject)}</b></dd>
      <dt>Para</dt><dd>${esc(m.clave.startsWith('carta') ? gratuita.email : orden.email)}${m.replyTo ? ` · responder a ${esc(m.replyTo)}` : ''}</dd>
    </dl>
    <div class="cols">
      <div class="mail">
        <div class="mail-bar"><b>Baiking</b> &lt;sorteo@baiking.com.ar&gt; · ${esc(m.subject)}</div>
        ${cuerpo(m.html)}
      </div>
      <details class="texto">
        <summary>Versión en texto plano (la ven los clientes de mail sin HTML)</summary>
        <pre>${esc(m.text)}</pre>
      </details>
    </div>
  </section>`,
    )
    .join('')}

  <div class="notas">
    <h2>Qué falta decidir</h2>
    <ul>
      <li><b>Remitente.</b> Para mandar desde <i>@baiking.com.ar</i> hay que verificar el dominio en Resend (dos registros DNS). Una casilla de Gmail no sirve como remitente; sí como casilla de respuestas.</li>
      <li><b>Entrega de los productos.</b> Cada producto se manda como link en el mail de confirmación (<code>packs[].entrega_url</code> en la config; el curso usa el link de YouTube no listado en <code>curso.url_acceso</code>). Hoy los tres links están vacíos: hasta cargarlos, el mail avisa que el producto llega aparte.</li>
      <li><b>Recordatorios.</b> Los dos últimos mails (una semana antes y el día del sorteo) los manda un envío programado diario a las 10:00, una sola vez por edición y por persona.</li>
      <li><b>Ganador.</b> El aviso al ganador se hace a mano el día del sorteo (mail, WhatsApp y llamado).</li>
    </ul>
  </div>
</div>
</body>
</html>
`;

await mkdir(path.join(root, 'dist'), { recursive: true });
await writeFile(path.join(root, 'dist/mails.html'), page);
console.log(`✔ dist/mails.html (${mails.length} mails, ${(Buffer.byteLength(page) / 1024).toFixed(0)} KB)`);
