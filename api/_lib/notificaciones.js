// Notificaciones al participante: mail (Resend) y WhatsApp (Meta Cloud API).
import { env } from './http.js';

const fmtFecha = (iso, tz = 'America/Argentina/Buenos_Aires') =>
  new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  }).format(new Date(iso));

const fmtNumero = (n) => String(n).padStart(4, '0');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function armarMailConfirmacion({ orden, numeros, campaign, baseUrl, gratuita = false }) {
  const bici = campaign.bicis.find((b) => b.id === orden.bici_preferida);
  const pack = campaign.packs.find((p) => p.id === orden.pack_id);
  const fecha = fmtFecha(campaign.edicion.fecha_sorteo);
  const lista = numeros.map(fmtNumero).join(' · ');
  const nombre = escapeHtml(orden.nombre);
  const plural = numeros.length > 1;

  const subject = gratuita
    ? `¡Listo, ${orden.nombre}! Registramos tu participación sin cargo · Baiking`
    : `¡Listo, ${orden.nombre}! Tu ${pack?.nombre || 'curso'} y ${plural ? 'tus participaciones' : 'tu participación'} · Baiking`;

  const intro = gratuita
    ? `Registramos tu participación <strong style="color:#fff">sin obligación de compra</strong>. Quedaste participando por tu <strong style="color:#fff">${escapeHtml(bici?.nombre || 'Polygon')}</strong> con la misma probabilidad que cualquier otra participación.`
    : `Confirmamos tu pago de <strong style="color:#fff">${escapeHtml(pack?.nombre || 'Curso')}</strong>. Ya tenés acceso al <strong style="color:#fff">${escapeHtml(campaign.curso.nombre)}</strong> y quedaste participando por tu <strong style="color:#fff">${escapeHtml(bici?.nombre || 'Polygon')}</strong>.`;

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#0b0f14;font-family:Inter,Arial,sans-serif;color:#f4f6f8">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#c9f31d;margin:0 0 12px">Baiking · ${escapeHtml(campaign.edicion.nombre)}</p>
    <h1 style="font-size:28px;line-height:1.15;margin:0 0 16px">¡Ya estás adentro, ${nombre}!</h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 20px;color:#c8d0d8">${intro}</p>

    <div style="background:#121820;border:1px solid #223041;border-radius:14px;padding:20px;margin:0 0 20px">
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#9aa6b2">
        ${numeros.length > 1 ? 'Tus números de participación' : 'Tu número de participación'}
      </p>
      <p style="margin:0;font-size:26px;font-weight:700;letter-spacing:.04em;color:#c9f31d">${lista}</p>
      <p style="margin:12px 0 0;font-size:13px;color:#9aa6b2">Orden ${escapeHtml(orden.id)}</p>
    </div>

    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:15px">
      <tr><td style="padding:8px 0;color:#9aa6b2">Sorteo en vivo</td><td style="padding:8px 0;text-align:right">${escapeHtml(fecha)} hs · Instagram @${escapeHtml(campaign.contacto.instagram)}</td></tr>
      <tr><td style="padding:8px 0;color:#9aa6b2">Bici elegida</td><td style="padding:8px 0;text-align:right">${escapeHtml(bici?.nombre || '')}</td></tr>
      <tr><td style="padding:8px 0;color:#9aa6b2">Participaciones</td><td style="padding:8px 0;text-align:right">${numeros.length}</td></tr>
    </table>

    ${
      gratuita
        ? ''
        : `<a href="${escapeHtml(campaign.curso.url_acceso || baseUrl)}" style="display:inline-block;background:#c9f31d;color:#0b0f14;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px">Entrar al curso</a>`
    }

    <p style="font-size:13px;line-height:1.6;color:#9aa6b2;margin:28px 0 0">
      Guardá este mail: es tu comprobante de participación. Podés ver tus participaciones cuando quieras en
      <a href="${escapeHtml(baseUrl)}/gracias?orden=${escapeHtml(orden.id)}" style="color:#c9f31d">${escapeHtml(baseUrl)}/gracias</a>.
      Bases y condiciones: <a href="${escapeHtml(baseUrl)}/bases-y-condiciones" style="color:#c9f31d">${escapeHtml(baseUrl)}/bases-y-condiciones</a>.
    </p>
    <p style="font-size:12px;line-height:1.6;color:#6b7784;margin:16px 0 0">
      ${escapeHtml(campaign.legal.aviso_corto)}
    </p>
  </div>
</body></html>`;

  const text = `¡Ya estás adentro, ${orden.nombre}!
${gratuita ? 'Registramos tu participación sin obligación de compra.' : `Confirmamos tu pago de ${pack?.nombre || 'Curso'} (${campaign.curso.nombre}).`}
${plural ? 'Tus participaciones' : 'Tu participación'}: ${lista}
Bici elegida: ${bici?.nombre || ''}
Sorteo en vivo: ${fecha} hs por Instagram @${campaign.contacto.instagram}
${gratuita ? '' : `Acceso al curso: ${campaign.curso.url_acceso || baseUrl}\n`}Orden: ${orden.id}
Bases y condiciones: ${baseUrl}/bases-y-condiciones`;

  return { subject, html, text };
}

export async function enviarMail({ to, subject, html, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env('MAIL_FROM'), to: [to], subject, html, text }),
  });
  if (!res.ok) throw new Error(`[resend] ${res.status}: ${await res.text()}`);
  return res.json();
}

export function whatsappConfigurado() {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

/**
 * Envía la plantilla aprobada en Meta Business con los parámetros:
 * {{1}} nombre · {{2}} números · {{3}} bici · {{4}} fecha del sorteo · {{5}} link de la orden
 * (ver docs/04-automatizaciones.md para el texto de la plantilla).
 */
export async function enviarWhatsApp({ orden, numeros, campaign, baseUrl }) {
  const bici = campaign.bicis.find((b) => b.id === orden.bici_preferida);
  const fecha = fmtFecha(campaign.edicion.fecha_sorteo);
  const to = String(orden.whatsapp).replace(/\D/g, '');

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: process.env.WHATSAPP_TEMPLATE_NAME || 'participacion_confirmada',
      language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'es_AR' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: orden.nombre },
            { type: 'text', text: numeros.map(fmtNumero).join(', ') },
            { type: 'text', text: bici?.nombre || 'Polygon' },
            { type: 'text', text: `${fecha} hs` },
            { type: 'text', text: `${baseUrl}/gracias?orden=${orden.id}` },
          ],
        },
      ],
    },
  };

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env('WHATSAPP_ACCESS_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`[whatsapp] ${res.status}: ${await res.text()}`);
  return res.json();
}
